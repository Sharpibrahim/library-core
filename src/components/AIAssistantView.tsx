import React, { useState, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  BrainCircuit, 
  MessageSquare, 
  FileSearch, 
  Lightbulb,
  Trash2,
  Paperclip,
  Mic,
  Zap,
  FileText,
  X,
  History,
  RotateCcw,
  Compass,
  CheckCircle,
  TrendingDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { getGeminiStream, GeminiPart } from '../services/gemini';
import { db } from '../firebase';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  deleteDoc, 
  getDocs,
  doc 
} from 'firebase/firestore';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: any;
  file?: {
    name: string;
    type: string;
  };
}

interface AIAssistantViewProps {
  user: User;
}

export function AIAssistantView({ user }: AIAssistantViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<{ name: string; type: string; data: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load chat history from Firestore
  useEffect(() => {
    const q = query(
      collection(db, 'users', user.uid, 'chatMessages'),
      orderBy('timestamp', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedMessages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
      
      if (loadedMessages.length === 0) {
        setMessages([
          {
            id: 'welcome',
            role: 'assistant',
            content: `Hello ${user.fullName || user.username}! I'm your LibraryCore AI Assistant. How can I help you with your studies today? You can now upload PDF files for me to analyze!`,
            timestamp: new Date()
          }
        ]);
      } else {
        setMessages(loadedMessages);
      }
    });

    return () => unsubscribe();
  }, [user.uid, user.fullName, user.username]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, streamingContent]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File is too large. Please select a file under 10MB.');
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64Data = (event.target?.result as string).split(',')[1];
        setSelectedFile({
          name: file.name,
          type: file.type,
          data: base64Data
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedFile) || isTyping) return;

    const currentInput = input;
    const currentFile = selectedFile;
    setInput('');
    setSelectedFile(null);
    setIsTyping(true);
    setStreamingContent('');

    const userMessageData: any = {
      role: 'user',
      content: currentInput || (currentFile ? "Analyze this document." : ""),
      timestamp: serverTimestamp(),
    };

    if (currentFile) {
      userMessageData.file = { 
        name: currentFile.name, 
        type: currentFile.type 
      };
    }

    try {
      // Save User Message to Firestore
      const userMsgRef = await addDoc(collection(db, 'users', user.uid, 'chatMessages'), userMessageData);

      let filePart: GeminiPart | undefined;
      if (currentFile) {
        filePart = {
          inlineData: {
            mimeType: currentFile.type,
            data: currentFile.data
          }
        };
      }

      // Convert history for Gemini - and make sure we don't include the message we just added
      // if it has already been added to 'messages' via snapshot.
      // We want the 10 messages PRIOR to the current one.
      const history = messages
        .filter(m => m.id !== 'welcome')
        .slice(-10)
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const stream = await getGeminiStream(userMessageData.content, history, filePart);
      
      let fullResponse = '';
      for await (const chunk of stream) {
        const text = chunk.text;
        if (text) {
          fullResponse += text;
          setStreamingContent(fullResponse);
        }
      }

      // Save AI Message to Firestore
      await addDoc(collection(db, 'users', user.uid, 'chatMessages'), {
        role: 'assistant',
        content: fullResponse,
        timestamp: serverTimestamp()
      });

    } catch (error: any) {
      console.error('AI Error:', error);
      const errorMessage = error?.message || "Something went wrong with the AI connection.";
      await addDoc(collection(db, 'users', user.uid, 'chatMessages'), {
        role: 'assistant',
        content: `**Error:** ${errorMessage}\n\nPlease check your internet connection or try again. This can sometimes happen if the AI model is overloaded.`,
        timestamp: serverTimestamp()
      });
    } finally {
      setIsTyping(false);
      setStreamingContent('');
    }
  };

  const clearChat = async () => {
    // Check if we have documents to delete
    const q = query(collection(db, 'users', user.uid, 'chatMessages'));
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;

    try {
      const deletePromises = snapshot.docs.map(d => deleteDoc(doc(db, 'users', user.uid, 'chatMessages', d.id)));
      await Promise.all(deletePromises);
      // Reset local messages to welcome
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: `Hello ${user.fullName || user.username}! I'm your LibraryCore AI Assistant. Chat cleared. How can I help you?`,
          timestamp: new Date()
        }
      ]);
    } catch (err) {
      console.error('Failed to clear chat:', err);
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col gap-4 animate-in fade-in duration-700 max-w-none mx-auto w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-2">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-white border border-border flex items-center justify-center shadow-sm overflow-hidden flex-shrink-0">
            <img src="/logo.png" alt="LibraryCore" className="w-5 h-5 object-contain" />
          </div>
          <div>
            <h1 className="text-lg font-display font-black text-text-main tracking-tight leading-none uppercase">
              LibraryCore AI Assistant
            </h1>
            <p className="text-text-muted font-bold text-[9px] uppercase tracking-[0.2em] mt-1">Study Companion</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={clearChat}
            className="px-3 py-1.5 rounded-lg bg-white border border-border text-text-muted hover:text-error hover:border-error/20 transition-all text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm"
          >
            <Trash2 className="w-3.5 h-3.5" /> Clear
          </button>
          <button className="px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 transition-all text-[9px] font-black uppercase tracking-widest flex items-center gap-2 shadow-sm">
            <Zap className="w-3.5 h-3.5" /> Pro
          </button>
        </div>
      </div>

      <div className="flex-grow flex flex-col min-h-0">
        {/* Chat Area - No Container shadow/border */}
        <div className="flex-grow flex flex-col overflow-hidden">
          {/* Messages */}
          <div 
            ref={scrollRef}
            className="flex-grow overflow-y-auto p-4 sm:p-10 space-y-8 sm:space-y-12 custom-scrollbar bg-[#F8FAFC]/30"
          >
            <AnimatePresence mode="popLayout">
              {messages.map((msg) => (
                <motion.div 
                  key={msg.id}
                  initial={{ opacity: 0, y: 10, scale: 0.99 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  className={`flex gap-3 sm:gap-4 ${msg.role === 'user' ? 'flex-row-reverse text-right' : ''} max-w-4xl mx-auto w-full`}
                >
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm ${msg.role === 'assistant' ? 'bg-white border border-border' : 'bg-primary/10'}`}>
                    {msg.role === 'assistant' ? (
                      <img src="/logo.png" alt="AI" className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
                    ) : (
                      <img 
                        src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                        alt="User" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    )}
                  </div>
                  <div className={`max-w-[85%] sm:max-w-[75%] space-y-2 ${msg.role === 'user' ? 'items-end' : ''}`}>
                    {msg.file && (
                      <div className="inline-flex items-center gap-2 px-2 py-1 bg-white border border-border rounded-lg shadow-xs mb-1">
                        <FileText className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] font-black text-text-main truncate max-w-[150px]">{msg.file.name}</span>
                      </div>
                    )}
                    <div className={`px-4 py-3 sm:px-6 sm:py-4 rounded-2xl sm:rounded-3xl text-sm leading-relaxed prose prose-sm max-w-none ${msg.role === 'assistant' ? 'bg-white text-text-main border border-border shadow-xs' : 'bg-primary text-white shadow-sm'}`}>
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                    <p className="text-[8px] font-black text-text-muted uppercase tracking-tighter px-2 opacity-40">
                      {msg.timestamp?.toDate ? msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {(isTyping || streamingContent) && (
              <div className="flex gap-3 sm:gap-4 max-w-4xl mx-auto w-full">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden shadow-sm">
                  <img src="/logo.png" alt="AI" className="w-5 h-5 sm:w-6 sm:h-6 object-contain" />
                </div>
                <div className="max-w-[85%] sm:max-w-[75%] space-y-2">
                  <div className="px-4 py-3 sm:px-6 sm:py-4 rounded-2xl sm:rounded-3xl text-sm leading-relaxed shadow-xs bg-white text-text-main border border-border prose prose-sm max-w-none">
                    {streamingContent ? (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {streamingContent}
                      </ReactMarkdown>
                    ) : (
                      <div className="flex gap-1.5 py-1">
                        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                        <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 sm:p-6 bg-white border-t border-border mt-auto">
            {selectedFile && (
              <div className="mb-3 inline-flex items-center gap-2 px-3 py-1 bg-primary/5 border border-primary/20 rounded-xl animate-in zoom-in-95">
                <FileText className="w-4 h-4 text-primary" />
                <span className="text-[9px] font-black text-primary uppercase tracking-tight truncate max-w-[150px]">{selectedFile.name}</span>
                <button 
                  onClick={() => setSelectedFile(null)}
                  className="p-1 hover:bg-primary/10 rounded-lg text-primary transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
            
            <form onSubmit={handleSend} className="relative max-w-4xl mx-auto w-full">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={selectedFile ? "Ask about file..." : "Send a message..."}
                className="w-full pl-6 pr-24 sm:pr-40 py-3 sm:py-4 bg-[#F8FAFC] border border-[#E2E8F0] rounded-2xl outline-none focus:bg-white focus:border-primary transition-all text-text-main placeholder:text-text-muted shadow-sm text-sm font-medium"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 sm:gap-2">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileChange} 
                  accept=".pdf" 
                  className="hidden" 
                />
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 text-text-muted hover:text-primary transition-all"
                  title="Upload PDF"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <button 
                  type="submit"
                  disabled={(!input.trim() && !selectedFile) || isTyping}
                  className="px-4 py-2 bg-primary text-white rounded-xl hover:brightness-110 disabled:opacity-50 transition-all shadow-md shadow-primary/10 flex items-center gap-2 font-black text-[10px] uppercase tracking-widest group"
                >
                  <span>Send</span>
                  <Send className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
