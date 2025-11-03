import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage as Message } from '../types';
import { textToSpeech, decode, decodeAudioData } from '../services/geminiService';
import { SpeakerIcon, SendIcon, PaperclipIcon, CloseIcon, MicIcon, ImageIcon, CameraIcon } from './icons/Icons';
import { LiveVoice } from './App';
import Camera from './Camera';
import WelcomeScreen from './WelcomeScreen';
import ChatMessage from './ChatMessage';

interface ChatProps {
    messages: Message[];
    onSendMessage: (prompt: string, imageFile: File | null) => void;
    onEditMessage: (messageId: string, newText: string) => void;
    isLoading: boolean;
    voice: LiveVoice;
    isAutoListenEnabled: boolean;
}

// Helper hook to get the previous value of a prop or state.
function usePrevious<T>(value: T): T | undefined {
    const ref = useRef<T>();
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
}

const TypingIndicator = () => (
    <ChatMessage
        message={{
            id: 'typing-indicator',
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


const Chat: React.FC<ChatProps> = ({ messages, onSendMessage, onEditMessage, isLoading, voice, isAutoListenEnabled }) => {
  const [input, setInput] = useState('');
  const [isTtsEnabled, setIsTtsEnabled] = useState(true);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAttachmentMenuOpen, setIsAttachmentMenuOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  // Voice Input State
  const [isListening, setIsListening] = useState(false);
  const [userManuallyStopped, setUserManuallyStopped] = useState(false);
  const [isTtsPlaying, setIsTtsPlaying] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [micPermission, setMicPermission] = useState<PermissionState>('prompt');
  const speechRecognitionRef = useRef<SpeechRecognition | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const prevIsLoading = usePrevious(isLoading);

  useEffect(() => {
    // @ts-ignore
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });

    const handleClickOutside = (event: MouseEvent) => {
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(event.target as Node)) {
        setIsAttachmentMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    const checkMicPermission = async () => {
        if (!navigator.permissions) {
            console.warn("Permissions API is not supported. Relying on onerror.");
            return;
        }
        try {
            const permissionStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
            setMicPermission(permissionStatus.state);
            if (permissionStatus.state === 'denied') {
                setMicError("Microphone access is denied. Please enable it in your browser's site settings.");
            }
            permissionStatus.onchange = () => {
                setMicPermission(permissionStatus.state);
                 if (permissionStatus.state === 'denied') {
                    setMicError("Microphone access is denied. Please enable it in your browser's site settings.");
                } else {
                    setMicError(null);
                }
            };
        } catch (error) {
            console.error("Could not query microphone permission:", error);
        }
    };
    checkMicPermission();

    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const recognition = new SpeechRecognitionAPI();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onstart = () => {
        setIsListening(true);
        setMicError(null);
      };

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const finalTranscript = event.results[0][0].transcript.trim();
        if (finalTranscript) {
          onSendMessage(finalTranscript, null);
          setUserManuallyStopped(false);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        if (event.error === 'not-allowed') {
          setMicError("Microphone access was denied. Please enable it in your browser settings to use voice input.");
          setMicPermission('denied');
        } else if (event.error !== 'no-speech' && event.error !== 'network' && event.error !== 'aborted') {
          console.error("Speech recognition error:", event.error, event.message);
          setMicError("An error occurred with speech recognition. Please try again.");
        }
        setIsListening(false);
      };
      
      speechRecognitionRef.current = recognition;
    } else {
      console.warn("Speech Recognition API is not supported in this browser.");
      setMicError("Speech recognition is not supported in this browser.");
      setMicPermission('denied');
    }

    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        speechRecognitionRef.current?.stop();
    }
  }, [onSendMessage]);

  useEffect(() => {
    if (isAutoListenEnabled && !isLoading && !isListening && !userManuallyStopped && !isTtsPlaying && !micError) {
        try {
            speechRecognitionRef.current?.start();
        } catch (e) {
            if (e instanceof DOMException && e.name === 'InvalidStateError') {
                console.warn('Speech recognition already started. Ignoring auto-start call.');
            } else {
                console.error("Could not start auto-listening:", e);
                setMicError("An error occurred trying to start auto-listening.");
            }
        }
    }

    if (!isAutoListenEnabled && isListening) {
        speechRecognitionRef.current?.stop();
    }
  }, [isAutoListenEnabled, isLoading, isListening, userManuallyStopped, messages, isTtsPlaying, micError]);


  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const playTextAudio = useCallback(async (base64Audio: string) => {
    if (!audioContextRef.current || !base64Audio) return;
    
    if (activeAudioSourceRef.current) {
        activeAudioSourceRef.current.onended = null;
        activeAudioSourceRef.current.stop();
        activeAudioSourceRef.current = null;
    }
    
    speechRecognitionRef.current?.stop();
    setIsTtsPlaying(true);
    
    try {
        if (audioContextRef.current.state === 'suspended') {
            await audioContextRef.current.resume();
        }
        const audioBuffer = await decodeAudioData(
            decode(base64Audio),
            audioContextRef.current,
            24000,
            1,
        );
        const source = audioContextRef.current.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContextRef.current.destination);
        
        activeAudioSourceRef.current = source;

        source.onended = () => {
          setIsTtsPlaying(false);
          if (activeAudioSourceRef.current === source) {
            activeAudioSourceRef.current = null;
          }
        };
        source.start();
    } catch (error) {
        console.error("Error playing audio:", error);
        setIsTtsPlaying(false);
        activeAudioSourceRef.current = null;
    }
  }, []);
  
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    // Only play TTS for new messages (isLoading changed from true to false)
    if (isTtsEnabled && prevIsLoading && !isLoading && lastMessage?.role === 'model' && lastMessage.text && !lastMessage.isError) {
        textToSpeech(lastMessage.text, voice).then(playTextAudio).catch(console.error);
    }
  }, [isLoading, prevIsLoading, messages, isTtsEnabled, playTextAudio, voice]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 200; // max height in pixels
      textareaRef.current.style.height = `${Math.min(scrollHeight, maxHeight)}px`;
      if (scrollHeight > maxHeight) {
        textareaRef.current.style.overflowY = 'auto';
      } else {
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [input]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if(fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSend = (prompt?: string) => {
    const finalInput = typeof prompt === 'string' ? prompt : input;
    if ((!finalInput.trim() && !imageFile) || isLoading) return;

    onSendMessage(finalInput, imageFile);
    
    setInput('');
    removeImage();
    setUserManuallyStopped(false);
  };
  
  const toggleListening = () => {
    if (micPermission === 'denied') {
        setMicError("Microphone access is denied. Please enable it in your browser's site settings.");
        return;
    }

    const recognition = speechRecognitionRef.current;
    if (!recognition) {
        setMicError("Sorry, your browser doesn't support speech recognition.");
        return;
    }

    if (isListening) {
        recognition.stop();
        setUserManuallyStopped(true);
    } else {
        try {
            recognition.start();
            setUserManuallyStopped(false);
        } catch (e) {
            console.error("Could not start speech recognition:", e);
            setMicError("An error occurred trying to start speech recognition.");
        }
    }
  };
  
  return (
    <div className="flex flex-col h-full bg-gray-800 relative">
      {isCameraOpen && (
        <Camera
          onClose={() => setIsCameraOpen(false)}
          onCapture={(file) => {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setIsCameraOpen(false);
          }}
        />
      )}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length <= 1 ? (
          <WelcomeScreen onPromptClick={handleSend} />
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                onEditMessage={onEditMessage}
              />
            ))}
            {isLoading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>
      
      <div className="p-4 w-full sticky bottom-0 bg-gray-800/80 backdrop-blur-sm">
        <div className="w-full max-w-3xl mx-auto flex flex-col items-center">
            {micError && (
                <p className="text-center text-red-400 text-sm mb-2 px-4">{micError}</p>
            )}
            <div className="relative w-full p-2 border border-gray-600 rounded-xl bg-gray-700 flex items-center gap-2">
                <button
                    onClick={toggleListening}
                    className={`p-2 rounded-full transition-colors flex-shrink-0 ${
                        isListening 
                        ? 'bg-red-500 text-white' 
                        : micPermission === 'denied'
                        ? 'text-gray-500 cursor-not-allowed'
                        : 'text-gray-400 hover:bg-gray-600'
                    }`}
                    aria-label={micPermission === 'denied' ? "Microphone access denied" : isListening ? "Stop listening" : "Start voice input"}
                    disabled={isLoading || micPermission === 'denied'}
                    >
                    <MicIcon />
                </button>
                 <div ref={attachmentMenuRef} className="relative">
                    <button
                        onClick={() => setIsAttachmentMenuOpen(prev => !prev)}
                        className="p-2 rounded-full text-gray-400 hover:bg-gray-600 disabled:text-gray-600 disabled:cursor-not-allowed"
                        aria-label="Attach file"
                        disabled={isLoading}
                    >
                        <PaperclipIcon />
                    </button>
                    {isAttachmentMenuOpen && (
                    <div className="absolute bottom-full mb-2 left-0 bg-gray-900 rounded-lg shadow-lg p-2 w-48 z-10 border border-gray-700">
                        <button
                        onClick={() => { fileInputRef.current?.click(); setIsAttachmentMenuOpen(false); }}
                        className="w-full flex items-center px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-md"
                        >
                        <ImageIcon />
                        <span className="ml-3">Upload Image</span>
                        </button>
                        <button
                        onClick={() => { setIsCameraOpen(true); setIsAttachmentMenuOpen(false); }}
                        className="w-full flex items-center px-3 py-2 text-sm text-gray-200 hover:bg-gray-700 rounded-md mt-1"
                        >
                        <CameraIcon />
                        <span className="ml-3">Use Camera</span>
                        </button>
                    </div>
                    )}
                </div>
                 <button onClick={() => setIsTtsEnabled(!isTtsEnabled)} className={`p-2 rounded-full transition-colors ${isTtsEnabled ? 'text-white' : 'text-gray-400'} hover:bg-gray-600`}>
                    <SpeakerIcon muted={!isTtsEnabled}/>
                </button>
              
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => {if(e.key === 'Enter' && !e.shiftKey){ e.preventDefault(); handleSend()}}}
                placeholder={
                    isListening 
                        ? "Listening..." 
                        : micPermission === 'denied'
                        ? "Voice input disabled. Type a message."
                        : "Message Intellecto..."
                }
                className="flex-1 bg-transparent focus:outline-none resize-none"
                disabled={isLoading}
                rows={1}
                style={{maxHeight: '200px'}}
              />
                { (input.trim() || imageFile) &&
                    <button 
                        onClick={() => handleSend()} 
                        disabled={isLoading} 
                        className="p-2 bg-blue-600 text-white rounded-full transition-colors hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                        aria-label="Send message"
                    >
                        <SendIcon />
                    </button>
                }
            </div>
            {imagePreview && (
                <div className="mt-3 p-2 border border-gray-600 rounded-lg bg-gray-700 relative w-fit self-start">
                  <img src={imagePreview} alt="Preview" className="h-24 w-auto rounded-md" />
                  <button
                      onClick={removeImage}
                      className="absolute top-0 right-0 -mt-2 -mr-2 bg-gray-900 rounded-full p-1 text-white hover:bg-gray-600 focus:outline-none"
                      aria-label="Remove image"
                  >
                      <CloseIcon className="w-4 h-4" />
                  </button>
                </div>
            )}
             <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept="image/*"
            />
        </div>
      </div>
    </div>
  );
};

export default Chat;