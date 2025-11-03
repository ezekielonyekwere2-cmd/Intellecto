import React, { ReactNode, useState, useRef, useEffect } from 'react';
import { ChatMessage as Message } from '../types';
import { IntellectoIcon } from './icons/Icons';
import CodeBlock from './CodeBlock';

interface ChatMessageProps {
    message: Message;
    children?: ReactNode;
    onEditMessage?: (messageId: string, newText: string) => void;
}

const ChatMessage: React.FC<ChatMessageProps> = ({ message, children, onEditMessage }) => {
    const { id, role, text, image, generatedImage, sources, isError } = message;

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editedText, setEditedText] = useState(text);
    
    const pressTimerRef = useRef<number | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const isUser = role === 'user';
    
    // Close menu on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Long press handlers for mouse and touch
    const handlePressStart = () => {
        pressTimerRef.current = window.setTimeout(() => {
            setIsMenuOpen(true);
        }, 500); // 500ms for long press
    };

    const handlePressEnd = () => {
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
    };
    
    const handleCopy = () => {
        navigator.clipboard.writeText(text);
        setIsMenuOpen(false);
    };

    const handleEditClick = () => {
        setEditedText(text);
        setIsEditing(true);
        setIsMenuOpen(false);
    };

    const handleSaveEdit = () => {
        if (onEditMessage && editedText.trim() && editedText.trim() !== text) {
            onEditMessage(id, editedText.trim());
        }
        setIsEditing(false);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        setEditedText(text); // Reset changes
    };


    const renderText = (inputText: string) => {
        if (!inputText && !children) return null;
        if (children) return children;
        
        const parts = inputText.split(/(```[\s\S]*?```)/g);
        return parts.map((part, index) => {
            if (part.startsWith('```') && part.endsWith('```')) {
                const code = part.slice(3, -3).trim();
                return <CodeBlock key={index} code={code} />;
            }
            return part && <div key={index} className="whitespace-pre-wrap">{part}</div>;
        });
    };
    
    const bubbleClass = isUser 
        ? 'bg-blue-600 text-white' 
        : isError 
        ? 'bg-red-800/50 text-gray-200' 
        : 'bg-gray-700 text-gray-200';
    
    const alignmentClass = isUser ? 'justify-end' : 'justify-start';

    // Editing View
    if (isUser && isEditing) {
        return (
            <div className={`flex justify-end w-full`}>
                <div className={`max-w-2xl w-full flex flex-col p-2 rounded-xl bg-blue-600`}>
                    <textarea 
                        value={editedText}
                        onChange={(e) => setEditedText(e.target.value)}
                        className="w-full bg-blue-700/50 text-white rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
                        rows={Math.max(3, editedText.split('\n').length)}
                        autoFocus
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSaveEdit();
                            } else if (e.key === 'Escape') {
                                handleCancelEdit();
                            }
                        }}
                    />
                    <div className="flex justify-end items-center mt-2 space-x-2">
                        <button onClick={handleCancelEdit} className="px-3 py-1 text-xs rounded-md text-gray-200 hover:bg-white/10">Cancel</button>
                        <button onClick={handleSaveEdit} className="px-3 py-1 text-xs rounded-md bg-white text-blue-700 font-semibold hover:bg-gray-200">Save & Submit</button>
                    </div>
                </div>
            </div>
        );
    }

    // Display View
    return (
        <div ref={wrapperRef} className={`flex ${alignmentClass} w-full`}>
            <div 
                className={`max-w-2xl p-4 rounded-xl relative ${bubbleClass} ${isUser ? 'cursor-pointer' : ''}`}
                onMouseDown={isUser ? handlePressStart : undefined}
                onMouseUp={isUser ? handlePressEnd : undefined}
                onTouchStart={isUser ? handlePressStart : undefined}
                onTouchEnd={isUser ? handlePressEnd : undefined}
                onContextMenu={(e) => { if (isUser) e.preventDefault() }}
            >
                 {isMenuOpen && (
                    <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 flex items-center bg-gray-900 border border-gray-600 rounded-lg shadow-lg z-10 p-1 animate-fade-in-up">
                        <button onClick={handleCopy} className="px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 rounded-md">Copy</button>
                        <div className="h-4 w-px bg-gray-600 mx-1"></div>
                        <button onClick={handleEditClick} className="px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 rounded-md">Edit</button>
                    </div>
                )}

                {image && (
                    <img src={image} alt="User upload" className="rounded-lg mb-2 max-h-60 w-auto object-cover" />
                )}
                {generatedImage && (
                    <img src={generatedImage} alt="Generated by AI" className="rounded-lg mb-2 max-h-96 w-auto object-contain" />
                )}
                <div className="prose prose-invert max-w-none prose-p:my-0">
                    {renderText(text)}
                </div>
                 {sources && sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-500/50">
                        <h4 className="text-xs font-semibold text-gray-400 mb-1">Sources:</h4>
                        <ul className="text-sm space-y-1">
                            {sources.map((source, i) => (
                                <li key={i}>
                                    <a href={source.uri} target="_blank" rel="noopener noreferrer" className={`${isUser ? 'text-blue-200' : 'text-blue-400'} hover:underline break-all`}>
                                        {i + 1}. {source.title || source.uri}
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ChatMessage;