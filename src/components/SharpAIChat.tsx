import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Loader2 } from 'lucide-react';
import { getGeminiResponse } from '../services/gemini';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { User } from '../types';

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  isOffline?: boolean;
}

interface SharpAIChatProps {
  user: User;
  resourceId?: string;
  className?: string;
}

export function SharpAIChat({ user, resourceId, className = '' }: SharpAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    { id: '1', role: 'ai', text: 'Hello! I am LibraryCore AI. I can analyze **videos**, **books**, and your **study habits**. How can I assist your learning today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const reply = await getGeminiResponse(userMessage, resourceId ? `Currently reading resource ID: ${resourceId}` : undefined);
      
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'ai', 
        text: reply
      }]);
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'ai', text: 'Sorry, I encountered an error while processing your request.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`flex flex-col bg-white border border-border rounded-3xl overflow-hidden shadow-xl h-full ${className}`}>
      <div className="bg-gradient-to-r from-primary to-secondary text-white px-8 py-5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-4">
          <div className="p-1.5 bg-white rounded-xl shadow-lg">
            <img src="/logo.png" alt="LibraryCore" className="w-5 h-5 object-contain" />
          </div>
          <h3 className="font-bold text-sm uppercase tracking-[0.2em]">LibraryCore AI Assistant</h3>
        </div>
      </div>
      
      <div className="flex-grow overflow-y-auto p-8 space-y-8 custom-scrollbar bg-[#F8FAFC]/50 selection:bg-primary/20">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-4 sm:gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg transition-transform hover:scale-105 overflow-hidden ${msg.role === 'user' ? 'bg-white border border-border' : 'bg-white border border-border'}`}>
              {msg.role === 'user' ? (
                <img 
                  src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                  alt="Avatar" 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <img src="/logo.png" alt="AI" className="w-6 h-6 sm:w-7 sm:h-7 object-contain" />
              )}
            </div>
            <div className={`px-6 py-5 rounded-[2rem] max-w-[85%] shadow-xl ${msg.role === 'user' ? 'bg-primary text-white rounded-tr-sm font-medium' : 'bg-white text-text-main rounded-tl-sm border border-border ring-1 ring-black/5'}`}>
              {msg.role === 'ai' ? (
                <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none text-text-main leading-relaxed">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.text}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="text-sm sm:text-base whitespace-pre-wrap leading-relaxed">{msg.text}</p>
              )}
              {msg.isOffline && (
                <div className="mt-2 flex items-center gap-2 text-[10px] font-bold text-secondary uppercase tracking-widest">
                  <div className="w-2 h-2 bg-secondary rounded-full animate-pulse shadow-[0_0_8px_rgba(139,92,246,0.5)]" />
                  Offline AI
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex gap-4 sm:gap-6">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white border border-border flex items-center justify-center flex-shrink-0 shadow-lg">
              <img src="/logo.png" alt="AI" className="w-6 h-6 sm:w-7 sm:h-7 object-contain" />
            </div>
            <div className="px-6 py-5 rounded-[2rem] bg-white text-text-muted rounded-tl-sm flex items-center gap-4 border border-border shadow-md ring-1 ring-black/5">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-xs font-black animate-pulse tracking-[0.2em] uppercase text-primary">AI is analyzing...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="p-5 border-t border-border bg-white flex gap-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask LibraryCore AI about this resource..."
          className="flex-grow px-5 py-3 bg-section border border-border rounded-2xl focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary text-sm text-text-main placeholder-text-muted transition-all"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="btn-primary p-3.5 rounded-2xl transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
