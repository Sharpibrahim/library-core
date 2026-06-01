import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, MicOff, Volume2, Command, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Resource } from '../types';

interface VoiceControlProps {
  onNavigate: (tab: string) => void;
  onLogout: () => void;
  onToggleTheme: () => void;
  onSearch?: (query: string) => void;
  onReadResource?: (resource: Resource | null) => void;
  resources?: Resource[];
}

export function VoiceControl({ 
  onNavigate, 
  onLogout, 
  onToggleTheme, 
  onSearch,
  onReadResource,
  resources = []
}: VoiceControlProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSupported, setIsSupported] = useState(true);
  const [isShowHelp, setIsShowHelp] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<'idle' | 'listening' | 'error' | 'restarting'>('idle');
  const [voiceLogs, setVoiceLogs] = useState<string[]>([]);
  const recognitionRef = useRef<any>(null);
  const isListeningRef = useRef(false);

  const addLog = useCallback((msg: string) => {
    console.log(`[Voice] ${msg}`);
    setVoiceLogs(prev => [msg, ...prev].slice(0, 5));
  }, []);

  const startVoiceEngine = useCallback(() => {
    if (!recognitionRef.current) {
      addLog('No recognition instance found');
      return;
    }
    try {
      setVoiceStatus('listening');
      addLog('Calling recognition.start()...');
      recognitionRef.current.start();
    } catch (e: any) {
      addLog(`Start error: ${e.message}`);
      if (e.name === 'InvalidStateError') {
        // Already started
        setVoiceStatus('listening');
      }
    }
  }, [addLog]);

  const stopVoiceEngine = useCallback(() => {
    if (!recognitionRef.current) return;
    try {
      setVoiceStatus('idle');
      addLog('Calling recognition.stop()...');
      recognitionRef.current.stop();
    } catch (e) {
      addLog('Stop error');
    }
  }, [addLog]);

  useEffect(() => {
    isListeningRef.current = isListening;
    if (isListening) {
      startVoiceEngine();
    } else {
      stopVoiceEngine();
    }
  }, [isListening, startVoiceEngine, stopVoiceEngine]);

  useEffect(() => {
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      addLog('SpeechRecognition NOT supported');
      return;
    }

    addLog('Initializing SpeechRecognition...');
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const resultTranscript = event.results[current][0].transcript;
      setTranscript(resultTranscript);
      addLog(`Result: "${resultTranscript.slice(0, 20)}..."`);

      if (event.results[current].isFinal) {
        processCommand(resultTranscript);
        setTimeout(() => setTranscript(''), 2000);
      }
    };

    recognition.onstart = () => {
      addLog('Event: onstart');
      setVoiceStatus('listening');
    };

    recognition.onerror = (event: any) => {
      const err = event.error;
      addLog(`Event: onerror (${err})`);
      
      if (err === 'no-speech') return;
      
      setVoiceStatus('error');
      if (err === 'not-allowed') {
        triggerFeedback('Microphone permission denied');
        setIsListening(false);
      } else if (err === 'network') {
        triggerFeedback('Voice control requires internet');
        setIsListening(false);
      } else {
        triggerFeedback(`Voice error: ${err}`);
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      addLog('Event: onend');
      if (isListeningRef.current) {
        addLog('Active session ended, restarting...');
        setVoiceStatus('restarting');
        setTimeout(() => {
          if (isListeningRef.current) startVoiceEngine();
        }, 500);
      } else {
        setVoiceStatus('idle');
      }
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      }
    };
  }, [startVoiceEngine, addLog]);

  const processCommand = useCallback((command: string) => {
    const cmd = command.toLowerCase();
    
    // Core Navigation & Actions
    if (cmd.includes('search for') || cmd.includes('find')) {
      const query = cmd.split(/search for|find/)[1]?.trim();
      if (query && onSearch) {
        onSearch(query);
        triggerFeedback(`Searching for "${query}"`);
        return;
      }
    }

    // Document Reading Modes Verbally - Close
    if (cmd.includes('close reader') || cmd.includes('stop reading') || cmd.includes('exit book') || cmd.includes('close book')) {
      if (onReadResource) {
        onReadResource(null);
        triggerFeedback('Closing Document Reader');
        return;
      }
    }

    // Document Reading Modes Verbally - Open Specific Book
    if (cmd.includes('read ') || cmd.includes('open book ') || cmd.includes('open document ') || cmd.includes('open paper ')) {
      let targetTitle = cmd
        .replace('open book', '')
        .replace('open document', '')
        .replace('open paper', '')
        .replace('read book', '')
        .replace('read document', '')
        .replace('read paper', '')
        .replace('read', '')
        .trim();

      if (targetTitle && resources.length > 0) {
        const matched = resources.find(r => 
          r.title?.toLowerCase().includes(targetTitle) || 
          targetTitle.includes(r.title?.toLowerCase() || '')
        );
        if (matched && onReadResource) {
          onReadResource(matched);
          triggerFeedback(`Opening Document: "${matched.title}"`);
          return;
        } else {
          triggerFeedback(`Book "${targetTitle}" not found in catalog`);
        }
      }
    }

    if (cmd.includes('dashboard') || cmd.includes('home')) {
      onNavigate('dashboard');
      triggerFeedback('Navigating to Dashboard');
    } else if (cmd.includes('library') || cmd.includes('books')) {
      onNavigate('library');
      triggerFeedback('Opening Library');
    } else if (cmd.includes('courses') || cmd.includes('academy') || cmd.includes('learning')) {
      onNavigate('courses');
      triggerFeedback('Opening Academy Courses');
    } else if (cmd.includes('classroom') || cmd.includes('class') || cmd.includes('school')) {
      onNavigate('classrooms');
      triggerFeedback('Opening Classrooms');
    } else if (cmd.includes('study-tracker') || cmd.includes('deep tracker') || cmd.includes('study tracker') || cmd.includes('tracker') || cmd.includes('gpa') || cmd.includes('performance') || cmd.includes('gradebook') || cmd.includes('grades')) {
      onNavigate('study-tracker');
      triggerFeedback('Opening Deep Study Tracker');
    } else if (cmd.includes('quizzes') || cmd.includes('exam') || cmd.includes('test') || cmd.includes('assessment')) {
      onNavigate('quizzes');
      triggerFeedback('Opening Assessments');
    } else if (cmd.includes('assistant') || cmd.includes('chat') || cmd.includes('ai assistant') || cmd.includes('ai chat') || cmd.includes('talk to ai')) {
      onNavigate('ai-assistant');
      triggerFeedback('Opening AI Assistant');
    } else if (cmd.includes('community') || cmd.includes('expert') || cmd.includes('teachers') || cmd.includes('messages')) {
      onNavigate('messages');
      triggerFeedback('Opening Expert Community');
    } else if (cmd.includes('upload') || cmd.includes('add file') || cmd.includes('new book')) {
      onNavigate('upload');
      triggerFeedback('Opening Upload Center');
    } else if (cmd.includes('admin') || cmd.includes('manage') || cmd.includes('lms admin') || cmd.includes('lms management')) {
      onNavigate('admin-panel');
      triggerFeedback('Opening Admin Center');
    } else if (cmd.includes('history') || cmd.includes('recent') || cmd.includes('logs')) {
      onNavigate('history');
      triggerFeedback('Opening Activity History');
    } else if (cmd.includes('settings') || cmd.includes('preferences') || cmd.includes('options') || cmd.includes('profile')) {
      onNavigate('settings');
      triggerFeedback('Opening Settings');
    } else if (cmd.includes('manual') || cmd.includes('guide') || cmd.includes('user manual') || cmd.includes('help book') || cmd.includes('documentation')) {
      onNavigate('user-manual');
      triggerFeedback('Opening System User Manual');
    } else if (cmd.includes('logout') || cmd.includes('sign out')) {
      onLogout();
      triggerFeedback('Logging out...');
    } else if (cmd.includes('theme') || cmd.includes('dark mode') || cmd.includes('light mode') || cmd.includes('toggle color')) {
      onToggleTheme();
      triggerFeedback('Toggling theme');
    } else if (cmd.includes('create class') || cmd.includes('new classroom')) {
      onNavigate('classrooms');
      triggerFeedback('Opening Classrooms to create one');
      setTimeout(() => window.dispatchEvent(new CustomEvent('toggleCreateClass', { detail: true })), 500);
    } else if (cmd.includes('scroll down')) {
       window.scrollBy({ top: 500, behavior: 'smooth' });
       triggerFeedback('Scrolling down');
    } else if (cmd.includes('scroll up')) {
       window.scrollBy({ top: -500, behavior: 'smooth' });
       triggerFeedback('Scrolling up');
    } else if (cmd.includes('refresh') || cmd.includes('reload')) {
       window.location.reload();
    } else if (cmd.includes('help') || cmd.includes('commands') || cmd.includes('what can i say')) {
       triggerFeedback('Showing voice commands...');
       setIsShowHelp(true);
    } else if (cmd.includes('back') || cmd.includes('go back')) {
       window.history.back();
       triggerFeedback('Going back');
    }
  }, [onNavigate, onLogout, onToggleTheme, onSearch, onReadResource, resources]);

  const triggerFeedback = (text: string) => {
    setFeedbackText(text);
    setShowFeedback(true);
    setTimeout(() => setShowFeedback(false), 3000);
  };

  return (
    <>
      <div className="fixed bottom-8 right-8 z-[100] flex flex-col items-end gap-4">
        <AnimatePresence>
          {transcript && (
            <motion.div
              key="voice-transcript"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-slate-900/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl max-w-xs text-right"
            >
              <div className="flex items-center justify-end gap-2 mb-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-primary">Live Transcript</span>
                <Volume2 className="w-3 h-3 text-primary animate-pulse" />
              </div>
              <p className="text-white text-sm font-medium italic">"{transcript}"</p>
            </motion.div>
          )}

          {showFeedback && (
            <motion.div
              key="voice-feedback"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="bg-emerald-500 text-white px-6 py-3 rounded-2xl shadow-2xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3"
            >
              <div className="w-2 h-2 rounded-full bg-white animate-ping" />
              {feedbackText}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
           {isShowHelp && (
             <motion.div
               key="voice-help-overlay"
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.9 }}
               className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md"
               onClick={() => setIsShowHelp(false)}
             >
                <div className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-lg w-full space-y-6" onClick={e => e.stopPropagation()}>
                   <div className="flex items-center justify-between">
                      <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Voice Commands</h3>
                      <button onClick={() => setIsShowHelp(false)} className="p-2 hover:bg-white/5 rounded-full text-slate-500">
                         <X className="w-6 h-6" />
                      </button>
                   </div>
                   <div className="grid grid-cols-1 gap-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                      {[
                        { cmd: 'Open [Section]', desc: 'Navigate between systems (e.g. "Open Library", "Open Deep Tracker", "Open AI Chat")' },
                        { cmd: 'Find [Term]', desc: 'Search the catalog (e.g. "Find Physics books")' },
                        { cmd: 'Read [Book Name]', desc: 'Trigger document reading mode (e.g., "Read Deep Learning")' },
                        { cmd: 'Close Reader', desc: 'Exit document reading mode verbally' },
                        { cmd: 'Create Class', desc: 'Jump to classroom and open the creation tool' },
                        { cmd: 'Toggle Theme', desc: 'Switch between dark and light modes' },
                        { cmd: 'Scroll Down/Up', desc: 'Control page scrolling' },
                        { cmd: 'Back / Refresh', desc: 'Browser control commands' },
                        { cmd: 'Logout', desc: 'Safely sign out of the account' }
                      ].map((item) => (
                        <div key={item.cmd} className="p-4 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-between group">
                           <div>
                              <p className="text-xs font-black text-primary uppercase tracking-widest">{item.cmd}</p>
                              <p className="text-[10px] text-slate-400 font-medium">{item.desc}</p>
                           </div>
                           <div className="p-2 rounded-lg bg-primary/20 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                              <Mic className="w-3 h-3" />
                           </div>
                        </div>
                      ))}
                   </div>
                   
                   {/* Diagnostic Section */}
                   <div className="mt-4 p-4 rounded-2xl bg-black/40 border border-white/5 font-mono text-[10px] space-y-2 text-left">
                      <div className="flex justify-between border-b border-white/10 pb-1 mb-2">
                         <span className="text-slate-500 uppercase font-black">Voice Status</span>
                         <span className={`uppercase font-black ${voiceStatus === 'error' ? 'text-red-500' : 'text-emerald-500'}`}>{voiceStatus}</span>
                      </div>
                      <div className="space-y-1 overflow-hidden">
                         {voiceLogs.length > 0 ? (
                           voiceLogs.map((log, i) => (
                             <div key={i} className="text-slate-400 flex gap-2">
                               <span className="text-slate-700 min-w-[20px]">[{voiceLogs.length - i}]</span>
                               <span className="truncate">{log}</span>
                             </div>
                           ))
                         ) : (
                           <div className="text-slate-600 italic">No activity logs yet...</div>
                         )}
                      </div>
                   </div>

                   <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-widest pt-4 border-t border-white/5">
                      "Listening for your command now..."
                   </p>
                </div>
             </motion.div>
           )}
        </AnimatePresence>

        <button
          onClick={() => {
            console.log('Mic button clicked. Current state:', isListening, 'Supported:', isSupported);
            if (!isSupported) {
              triggerFeedback('Voice not supported in this browser');
              return;
            }
            setIsListening(!isListening);
          }}
          className={`
            w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 group relative
            ${!isSupported ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 
              isListening 
              ? 'bg-red-500 text-white shadow-red-500/40 ring-4 ring-red-500/20' 
              : 'bg-white text-slate-900 border border-slate-100 hover:border-primary/50'
            }
          `}
        >
          {!isSupported ? (
            <MicOff className="w-6 h-6" />
          ) : isListening ? (
            <Mic className="w-6 h-6 animate-pulse" />
          ) : (
            <MicOff className="w-6 h-6 text-slate-400 group-hover:text-primary transition-colors" />
          )}
          
          <div className="absolute -top-12 right-0 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
             <div className="bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2">
                {isListening ? (
                  <>
                    <div className={`w-2 h-2 rounded-full ${voiceStatus === 'listening' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-bounce'}`} />
                    {voiceStatus === 'listening' ? 'Listening' : voiceStatus === 'restarting' ? 'Connecting...' : 'Active'}
                  </>
                ) : 'Voice Control'}
             </div>
          </div>
        </button>
      </div>

      {!isListening && (
        <div className="fixed bottom-12 right-32 z-[90] pointer-events-none">
           <motion.div 
             initial={{ opacity: 0 }}
             animate={{ opacity: [0, 1, 1, 0] }}
             transition={{ duration: 4, repeat: Infinity, repeatDelay: 10 }}
             className="flex items-center gap-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-xl text-slate-400"
           >
             <Command className="w-4 h-4" />
             <span className="text-[10px] font-bold uppercase tracking-widest font-mono">Say "Open Library", "Deep Tracker" or "Read [Book]"</span>
           </motion.div>
        </div>
      )}
    </>
  );
}
