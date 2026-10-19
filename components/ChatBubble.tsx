import React, { useEffect, useRef, useState } from 'react';
import type { ChatMessage } from '../App';
import { MessageSquare, X, Send, Bot, User } from 'lucide-react';

interface ChatBubbleProps {
  messages: ChatMessage[];
  isLoading: boolean;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onSendMessage: (message: string) => void;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ messages, isLoading, isOpen, setIsOpen, onSendMessage }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages, isLoading]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 ${isOpen ? 'opacity-0 scale-90 pointer-events-none' : 'opacity-100 scale-100'}`}>
        <button
          onClick={() => setIsOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white w-14 h-14 rounded-2xl shadow-xl flex items-center justify-center transition-all hover:scale-105"
          aria-label="Open AI Assistant"
        >
          <MessageSquare className="w-6 h-6" />
        </button>
      </div>

      {/* Chat Window */}
      <div className={`fixed bottom-6 right-6 z-50 w-[92vw] max-w-md h-[70vh] max-h-[580px] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
        <header className="flex items-center justify-between p-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-semibold text-sm text-slate-900">Production AI Assistant</h3>
              <p className="text-[13px] text-emerald-600 flex items-center gap-1 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span> Online • Little Nap PMS
              </p>
            </div>
          </div>
          <button 
            onClick={() => setIsOpen(false)} 
            className="p-1 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <main className="flex-1 p-4 overflow-y-auto bg-slate-50/50">
          <div className="space-y-3.5">
            {messages.length === 0 && !isLoading && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white text-slate-700 border border-slate-200 rounded-2xl p-3 text-[13px] shadow-xs max-w-[85%]">
                  <p className="leading-relaxed">
                    Hello! I'm your assistant. Ask me anything about orders (e.g. <em>"Where is my latest order?"</em>), upcoming dispatches, or department bottlenecks.
                  </p>
                </div>
              </div>
            )}

            {messages.map((msg, index) => (
              <div key={index} className={`flex items-end gap-2.5 ${msg.author === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.author === 'ai' && (
                  <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 mb-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                )}
                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-[13px] ${
                  msg.author === 'user' 
                    ? 'bg-indigo-600 text-white shadow-xs rounded-br-xs' 
                    : 'bg-white text-slate-800 border border-slate-200 shadow-xs rounded-bl-xs'
                }`}>
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex items-start gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-3 shadow-xs">
                  <div className="flex items-center space-x-1.5">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse"></div>
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse [animation-delay:0.4s]"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <footer className="p-3 border-t border-slate-200 bg-white">
          <form onSubmit={handleSend} className="flex items-center gap-2">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about an order or step..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[13px] text-slate-800 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 placeholder-slate-400 focus:outline-none"
              disabled={isLoading}
            />
            <button 
              type="submit" 
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl p-2 disabled:opacity-50 flex-shrink-0 transition-colors shadow-xs" 
              disabled={isLoading || !input.trim()}
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </footer>
      </div>
    </>
  );
};

export default ChatBubble;
