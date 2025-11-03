import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage as Message } from '../types';
import { generateGroundedText } from '../services/geminiService';
import ChatMessage from './ChatMessage';
import { SendIcon } from './icons/Icons';

const TypingIndicator = () => (
    <ChatMessage
        message={{
            id: 'typing-indicator-gs',
            role: 'model',
            text: '',
        }}
    >
        <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
        </div>
    </ChatMessage>
);


const GroundingSearch: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [useMaps, setUseMaps] = useState(true);
  const [location, setLocation] = useState<{ latitude: number, longitude: number } | undefined>();
  const [locationError, setLocationError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getLocation = useCallback(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLocationError(null);
        },
        () => {
          setLocationError("Unable to retrieve your location. Maps grounding will be less accurate.");
        }
      );
    } else {
      setLocationError("Geolocation is not supported by your browser.");
    }
  }, []);
  
  useEffect(() => {
    setMessages([{ id: `gs-initial-${Date.now()}`, role: 'model', text: 'Ask me anything that requires up-to-date information or location-based knowledge. I will use Google Search and Maps to provide accurate, grounded answers.' }]);
    getLocation();
  }, [getLocation]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { id: `gs-user-${Date.now()}`, role: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setLocationError(null);

    try {
      const response = await generateGroundedText(input, useMaps, location);
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const sources = groundingChunks?.map((chunk: any) => ({
        uri: chunk.web?.uri || chunk.maps?.uri,
        title: chunk.web?.title || chunk.maps?.title
      })).filter((source: any) => source.uri);

      const modelMessage: Message = { id: `gs-model-${Date.now()}`, role: 'model', text: response.text, sources };
      setMessages(prev => [...prev, modelMessage]);

    } catch (error) {
      console.error('Error generating grounded text:', error);
      const errorMessage: Message = { id: `gs-error-${Date.now()}`, role: 'model', text: 'Sorry, I couldn\'t fetch a grounded response. Please try again.', isError: true };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-800 text-gray-200">
        <div className="p-4 bg-gray-900 border-b border-gray-700 flex justify-between items-center">
            <div>
                <h2 className="text-xl font-bold">Grounded Search</h2>
                <p className="text-sm text-gray-400">Powered by Google Search & Maps for factual answers.</p>
            </div>
            <div className="flex items-center">
                <label htmlFor="use-maps" className="mr-3 text-sm text-gray-300">Use Maps</label>
                 <label htmlFor="use-maps" className="inline-flex relative items-center cursor-pointer">
                    <input 
                        type="checkbox" 
                        id="use-maps" 
                        className="sr-only peer" 
                        checked={useMaps} 
                        onChange={() => setUseMaps(!useMaps)}
                    />
                    <div className="w-9 h-5 bg-gray-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
            </div>
        </div>
        {locationError && <div className="bg-yellow-800 text-yellow-100 p-2 text-center text-sm">{locationError}</div>}
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <ChatMessage 
              key={msg.id}
              message={msg}
            />
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
      </div>
      
       <div className="p-4 w-full sticky bottom-0 bg-gray-800/80 backdrop-blur-sm">
        <div className="w-full max-w-3xl mx-auto">
            <div className="relative w-full flex items-center bg-gray-700 border border-gray-600 rounded-xl p-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Ask a question..."
                    className="w-full bg-transparent focus:outline-none pl-2"
                    disabled={isLoading}
                />
                { input.trim() &&
                    <button 
                        onClick={handleSend} 
                        disabled={isLoading}
                        className="p-2 bg-blue-600 text-white rounded-full transition-colors hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        aria-label="Send message"
                    >
                        <SendIcon />
                    </button>
                }
            </div>
        </div>
      </div>
    </div>
  );
};

export default GroundingSearch;