import React, { useState, useCallback, useEffect } from 'react';
import { FeatureMode, ChatSession, ChatMessage } from '../types';
import Chat from './Chat';
import ImageEditor from './ImageEditor';
import { EditIcon, MenuIcon, CloseIcon, PlusIcon, TrashIcon, GlobeIcon } from './icons/Icons';
import { startChat, summarize, generateImage, generateComplexText, fileToBase64 } from '../services/geminiService';
import { Chat as GenAIChat, GenerateContentResponse } from '@google/genai';
import GroundingSearch from './GroundingSearch';

export type LiveVoice = 'Zephyr' | 'Puck' | 'Kore';

const CHAT_SESSIONS_KEY = 'intellecto-chat-sessions';
const createInitialMessage = (): ChatMessage => ({
    id: `initial-${Date.now()}`,
    role: 'model', 
    text: 'Hello! I am Intellecto. I can access up-to-date information, generate images, solve complex problems, and use Maps to provide accurate answers. How can I help?' 
});

const App: React.FC = () => {
  const [activeFeature, setActiveFeature] = useState<FeatureMode>(FeatureMode.CHAT);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [liveVoice, setLiveVoice] = useState<LiveVoice>('Zephyr');
  const [isAutoListenEnabled, setIsAutoListenEnabled] = useState(true);

  // Chat State
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // Load chat sessions from local storage on initial render
  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem(CHAT_SESSIONS_KEY);
      if (savedSessions) {
        const parsedSessions: ChatSession[] = JSON.parse(savedSessions);
        // Ensure all messages have IDs
        const sanitizedSessions = parsedSessions.map(session => ({
            ...session,
            messages: session.messages.map(message => ({
                ...message,
                id: message.id || `${message.role}-${Date.now()}-${Math.random()}`,
            }))
        }));

        if (sanitizedSessions.length > 0) {
            setChatSessions(sanitizedSessions);
            setActiveChatId(sanitizedSessions[0].id);
        } else {
            handleNewChat();
        }
      } else {
        handleNewChat();
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
      handleNewChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save chat sessions to local storage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(chatSessions));
    } catch (error)      {
      console.error("Failed to save chat history:", error);
    }
  }, [chatSessions]);
  
  const handleNewChat = () => {
    const newId = Date.now().toString();
    const newSession: ChatSession = {
      id: newId,
      title: 'New Chat',
      messages: [createInitialMessage()],
    };
    setChatSessions(prev => [newSession, ...prev]);
    setActiveChatId(newId);
    setActiveFeature(FeatureMode.CHAT);
    setIsSidebarOpen(false);
  };

  const handleSelectChat = (id: string) => {
    setActiveChatId(id);
    setActiveFeature(FeatureMode.CHAT);
    setIsSidebarOpen(false);
  };

  const handleDeleteChat = (idToDelete: string) => {
    const updatedSessions = chatSessions.filter(s => s.id !== idToDelete);
    setChatSessions(updatedSessions);
    if (activeChatId === idToDelete) {
        if (updatedSessions.length > 0) {
            setActiveChatId(updatedSessions[0].id);
        } else {
            handleNewChat();
        }
    }
  };
  
  const updateSessionMessages = (sessionId: string, newMessages: ChatMessage[], newTitle?: string) => {
      setChatSessions(prev => prev.map(s => {
          if (s.id === sessionId) {
              const updatedSession = { ...s, messages: newMessages };
              if (newTitle) {
                  updatedSession.title = newTitle;
              }
              return updatedSession;
          }
          return s;
      }));
  };

  // Helper function to process API responses (text, function calls)
  const handleApiResponse = async (response: GenerateContentResponse, currentMessages: ChatMessage[]) => {
      if (!activeChatId) return;

      let updatedMessages = [...currentMessages];

      // Always add the text response from the model first.
      if (response.text) {
          const modelResponse: ChatMessage = { id: `model-${Date.now()}`, role: 'model', text: response.text };
          updatedMessages.push(modelResponse);
          updateSessionMessages(activeChatId, updatedMessages);
      }
      
      if (response.functionCalls && response.functionCalls.length > 0) {
        const functionCall = response.functionCalls[0];
        
        let thinkingMessage: ChatMessage | null = null;
        
        // Handle functions that are immediate
        if (functionCall.name === 'openApplication') {
            const { appName, query } = functionCall.args;
            let uri = '';
            switch (String(appName).toLowerCase()) {
                case 'email': uri = `mailto:${query || ''}`; break;
                case 'phone': uri = `tel:${query || ''}`; break;
                case 'sms':   uri = `sms:${query || ''}`; break;
                case 'maps':  uri = `https://maps.google.com/?q=${encodeURIComponent(String(query) || '')}`; break;
                case 'spotify': uri = query ? `spotify:search:${encodeURIComponent(String(query))}` : 'spotify:'; break;
                default: console.warn(`Unsupported app name: ${appName}`); break;
            }
            if (uri) {
                window.open(uri, '_self');
            }
            return; // Action complete
        }

        // Handle functions that require waiting and have a "thinking" state
        if (functionCall.name === 'generateImage') {
            thinkingMessage = { id: `thinking-${Date.now()}`, role: 'model', text: `Generating an image of "${functionCall.args.prompt}"...` };
        } else if (functionCall.name === 'solveComplexTask') {
            thinkingMessage = { id: `thinking-${Date.now()}`, role: 'model', text: `Thinking about your request: "${functionCall.args.prompt}"...` };
        }
        
        if (thinkingMessage) {
            updateSessionMessages(activeChatId, [...updatedMessages, thinkingMessage]);
            let finalMessages = [...updatedMessages, thinkingMessage!];
            let functionResult;
            if (functionCall.name === 'generateImage') {
                const imageUrl = await generateImage(functionCall.args.prompt as string, functionCall.args.aspectRatio as string);
                functionResult = { id: `gen-img-${Date.now()}`, role: 'model', text: `Here is the image of "${functionCall.args.prompt}":`, generatedImage: imageUrl };
            } else if (functionCall.name === 'solveComplexTask') {
                const complexResponse = await generateComplexText(functionCall.args.prompt as string);
                functionResult = { id: `complex-${Date.now()}`, role: 'model', text: complexResponse.text };
            }

            if(functionResult) {
                // Replace the "thinking" message with the final result
                finalMessages = finalMessages.filter(msg => msg.id !== thinkingMessage!.id);
                finalMessages.push(functionResult);
            }
            updateSessionMessages(activeChatId, finalMessages);
        }
      }
  };


  const handleSendMessage = async (prompt: string, imageFile: File | null) => {
    const command = prompt.trim().toLowerCase();

    // --- Command Handling Logic ---
    switch (command) {
        case 'new chat':
            handleNewChat();
            return;
        case 'delete this chat':
            if (activeChatId) {
                const activeSession = chatSessions.find(s => s.id === activeChatId);
                if (activeSession && window.confirm(`Are you sure you want to delete the chat "${activeSession.title}"?`)) {
                    handleDeleteChat(activeChatId);
                }
            }
            return;
        case 'clear history':
            if (window.confirm('Are you sure you want to delete all your chats? This action cannot be undone.')) {
                setChatSessions([]);
                handleNewChat();
            }
            return;
        case 'help':
            if (activeChatId) {
                const activeSession = chatSessions.find(s => s.id === activeChatId);
                if (activeSession) {
                    const helpText = `You can control the app with these commands:\n\n*   **"new chat"**: Starts a new chat.\n*   **"delete this chat"**: Deletes the current chat.\n*   **"clear history"**: Deletes all chats.\n*   **"help"**: Shows this message.\n\nYou can also ask me to perform actions like:\n* "Edit a photo to be black and white"\n* "Search for the weather in London"\n* "Send an email to contact@example.com"\n* "Call 555-123-4567"\n* "Find the nearest park on Maps"`;
                    const helpMessage: ChatMessage = {
                        id: `help-${Date.now()}`,
                        role: 'model',
                        text: helpText,
                    };
                    updateSessionMessages(activeChatId, [...activeSession.messages, helpMessage]);
                }
            }
            return;
    }
    // --- End Command Handling ---

    if (!activeChatId) return;

    const activeSession = chatSessions.find(s => s.id === activeChatId);
    if (!activeSession) return;
    
    setIsLoading(true);
    
    let userMessage: ChatMessage;
    const messageId = `user-${Date.now()}`;
    if (imageFile) {
        const imagePreview = URL.createObjectURL(imageFile);
        userMessage = { id: messageId, role: 'user', text: prompt, image: imagePreview };
    } else {
        userMessage = { id: messageId, role: 'user', text: prompt };
    }
    
    const updatedMessages = [...activeSession.messages, userMessage];
    updateSessionMessages(activeChatId, updatedMessages);
    
    // Auto-generate title for new chats
    if (activeSession.messages.length === 1 && prompt.length > 0) {
        try {
            const newTitle = await summarize(prompt);
            updateSessionMessages(activeChatId, updatedMessages, newTitle);
        } catch (error) {
            console.warn("Could not generate title:", error);
        }
    }

    try {
      // History for the API is the state *before* adding the new user message
      const chat: GenAIChat = startChat(activeSession.messages.slice(1)); 
      
      let response;
      if (imageFile) {
        const base64 = await fileToBase64(imageFile);
        const imagePart = { inlineData: { data: base64, mimeType: imageFile.type } };
        const textPart = { text: prompt };
        response = await chat.sendMessage({ message: {parts: [textPart, imagePart]} });
      } else {
        response = await chat.sendMessage({ message: prompt });
      }

      await handleApiResponse(response, updatedMessages);
      
    } catch (error: any) {
      console.error("Error sending message:", error);
      let errorMessageText = 'Sorry, something went wrong. Please try again.';
      try {
        const errorJson = JSON.parse(error.message);
        if (errorJson?.error?.status === 'RESOURCE_EXHAUSTED') {
          errorMessageText = `You exceeded your current quota. \n\n*   [Monitor your usage](https://ai.dev/usage?tab=rate-limit)\n*   [Learn more about rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)`;
        }
      } catch (e) { /* Not a JSON error, use default message */ }

      const errorMessage: ChatMessage = { 
        id: `error-${Date.now()}`, 
        role: 'model', 
        text: errorMessageText,
        isError: true,
      };
      updateSessionMessages(activeChatId, [...updatedMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditMessage = async (messageId: string, newText: string) => {
    if (!activeChatId) return;

    const activeSession = chatSessions.find(s => s.id === activeChatId);
    if (!activeSession) return;
    
    const messageIndex = activeSession.messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1 || activeSession.messages[messageIndex].role !== 'user') return;

    // 1. Create history up to the point of edit, with the edited message.
    const truncatedHistory = activeSession.messages.slice(0, messageIndex);
    const editedMessage: ChatMessage = { 
        ...activeSession.messages[messageIndex], 
        text: newText 
    };
    const newMessagesForUi = [...truncatedHistory, editedMessage];

    // 2. Update UI to show the edited message and remove subsequent ones.
    updateSessionMessages(activeChatId, newMessagesForUi);
    setIsLoading(true);

    try {
        // 3. For the API, history is everything *before* the message we're "resending".
        const chat: GenAIChat = startChat(truncatedHistory.slice(1));
        
        // 4. Send the edited text as the new message.
        // Note: Editing messages with images is not supported in this flow, as the File object is not persisted.
        const response = await chat.sendMessage({ message: newText });

        // 5. Process the response and append it to our new UI state.
        await handleApiResponse(response, newMessagesForUi);

    } catch (error: any) {
        console.error("Error sending edited message:", error);
        let errorMessageText = 'Sorry, something went wrong while rewriting the response. Please try again.';
        try {
            const errorJson = JSON.parse(error.message);
            if (errorJson?.error?.status === 'RESOURCE_EXHAUSTED') {
              errorMessageText = `You exceeded your current quota. \n\n*   [Monitor your usage](https://ai.dev/usage?tab=rate-limit)\n*   [Learn more about rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)`;
            }
        } catch(e) { /* Not a JSON error */ }
        const errorMessage: ChatMessage = { 
            id: `error-${Date.now()}`, 
            role: 'model', 
            text: errorMessageText,
            isError: true,
        };
        updateSessionMessages(activeChatId, [...newMessagesForUi, errorMessage]);
    } finally {
        setIsLoading(false);
    }
};


  const activeChat = chatSessions.find(c => c.id === activeChatId);

  return (
    <div className="flex h-screen bg-gray-900 text-gray-200">
      <div className="md:hidden fixed top-4 left-4 z-40">
        <button onClick={() => setIsSidebarOpen(true)} className="text-white p-2 rounded-md bg-gray-800">
          <MenuIcon />
        </button>
      </div>

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0 transition-transform duration-300 ease-in-out w-72 bg-gray-900 p-4 flex flex-col z-30`}>
        <div className="flex justify-between items-center mb-6">
            <h1 className="text-xl font-semibold">Intellecto AI</h1>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white">
                <CloseIcon />
            </button>
        </div>
        
        <button onClick={handleNewChat} className="w-full flex items-center p-3 mb-6 text-sm rounded-lg hover:bg-gray-700 transition-colors font-medium border border-gray-600">
          <PlusIcon />
          <span className="ml-2">New Chat</span>
        </button>

        <div className="flex-1 overflow-y-auto -mr-2 pr-2 space-y-2">
            {chatSessions.map(session => (
                <div key={session.id} className={`relative group flex items-center p-3 rounded-lg cursor-pointer transition-colors ${activeChatId === session.id ? 'bg-gray-700' : 'hover:bg-gray-700/50'}`} onClick={() => handleSelectChat(session.id)}>
                    <span className="flex-1 truncate text-sm">{session.title}</span>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteChat(session.id);}} className="ml-2 text-gray-400 opacity-0 group-hover:opacity-100 hover:text-white transition-opacity">
                        <TrashIcon />
                    </button>
                </div>
            ))}
        </div>
        
        <div className="mt-4 border-t border-gray-700 pt-4 space-y-2">
            <button onClick={() => { setActiveFeature(FeatureMode.IMAGE_EDIT); setIsSidebarOpen(false); }} className="w-full flex items-center p-3 text-sm rounded-lg hover:bg-gray-700 transition-colors">
                <EditIcon />
                <span className="ml-3">Image Studio</span>
            </button>
            <button onClick={() => { setActiveFeature(FeatureMode.GROUNDED_SEARCH); setIsSidebarOpen(false); }} className="w-full flex items-center p-3 text-sm rounded-lg hover:bg-gray-700 transition-colors">
                <GlobeIcon />
                <span className="ml-3">Grounded Search</span>
            </button>
        </div>

        <div className="mt-4 border-t border-gray-700 pt-4 px-1">
          <label htmlFor="voice-select" className="block text-xs font-medium text-gray-400 mb-2">Spoken Voice</label>
          <select 
            id="voice-select" 
            value={liveVoice} 
            onChange={e => setLiveVoice(e.target.value as LiveVoice)}
            className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="Zephyr" className="bg-gray-800">Zephyr (Male)</option>
            <option value="Puck" className="bg-gray-800">Puck (Male)</option>
            <option value="Kore" className="bg-gray-800">Kore (Female)</option>
          </select>

          <div className="flex items-center justify-between mt-4">
            <label htmlFor="auto-listen-toggle" className="text-xs font-medium text-gray-400">Auto-Listen in Chat</label>
            <label htmlFor="auto-listen-toggle" className="inline-flex relative items-center cursor-pointer">
              <input 
                type="checkbox" 
                id="auto-listen-toggle" 
                className="sr-only peer" 
                checked={isAutoListenEnabled} 
                onChange={() => setIsAutoListenEnabled(!isAutoListenEnabled)}
              />
              <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col bg-gray-800">
        <div className="flex-1 overflow-y-auto">
          {activeFeature === FeatureMode.CHAT && activeChat && (
              <Chat 
                  messages={activeChat.messages} 
                  onSendMessage={handleSendMessage} 
                  onEditMessage={handleEditMessage}
                  isLoading={isLoading} 
                  voice={liveVoice}
                  isAutoListenEnabled={isAutoListenEnabled}
              />
          )}
          {activeFeature === FeatureMode.IMAGE_EDIT && <ImageEditor />}
          {activeFeature === FeatureMode.GROUNDED_SEARCH && <GroundingSearch />}
        </div>
      </main>
    </div>
  );
};

export default App;