import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  Terminal, 
  Command, 
  BookOpen, 
  LayoutDashboard, 
  Settings, 
  MessageSquare, 
  Bell, 
  Upload, 
  GraduationCap,
  Sparkles,
  ArrowRight,
  User,
  ShieldCheck
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (tab: string) => void;
  userRole: string;
}

const COMMAND_GROUPS = [
  {
    title: 'Navigation',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, shortcut: 'D' },
      { id: 'library', label: 'Library Hub', icon: BookOpen, shortcut: 'L' },
      { id: 'courses', label: 'Elite Courses', icon: BookOpen, shortcut: 'E' },
      { id: 'classrooms', label: 'Classrooms', icon: GraduationCap, shortcut: 'C' },
      { id: 'messages', label: 'Expert Chat', icon: MessageSquare, shortcut: 'M' },
      { id: 'ai-assistant', label: 'AI Assistant', icon: Sparkles, shortcut: 'A' },
      { id: 'upload', label: 'Upload Center', icon: Upload, shortcut: 'U' },
      { id: 'notifications', label: 'Notifications', icon: Bell, shortcut: 'N' },
    ]
  },
  {
    title: 'System',
    items: [
      { id: 'settings', label: 'Profile Settings', icon: User, shortcut: 'P' },
      { id: 'admin-panel', label: 'LMS Admin', icon: ShieldCheck, shortcut: 'G', adminOnly: true },
    ]
  }
];

export function CommandPalette({ isOpen, onClose, onNavigate, userRole }: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const isAdmin = userRole === 'admin';

  const filteredItems = COMMAND_GROUPS.flatMap(group => 
    group.items.filter(item => {
      if (item.adminOnly && !isAdmin) return false;
      return item.label.toLowerCase().includes(search.toLowerCase());
    })
  );

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % filteredItems.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % filteredItems.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        onNavigate(filteredItems[selectedIndex].id);
        onClose();
      }
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filteredItems, selectedIndex, onNavigate, onClose]);

  useEffect(() => {
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      setSelectedIndex(0);
      setSearch('');
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleKeyDown]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[200]"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white rounded-[2.5rem] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] z-[210] overflow-hidden border border-border"
          >
            <div className="relative border-b border-border p-6 bg-section/30">
              <Search className="absolute left-10 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
              <input 
                autoFocus
                type="text"
                placeholder="Search commands or navigate..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-16 pr-8 py-4 bg-transparent text-lg font-medium text-text-main placeholder-text-muted focus:outline-none"
              />
              <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-border shadow-sm">
                <Terminal className="w-3 h-3 text-text-muted" />
                <span className="text-[10px] font-black text-text-muted uppercase tracking-widest">ESC Close</span>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
              {COMMAND_GROUPS.map((group, groupIdx) => {
                const groupItems = group.items.filter(item => {
                  if (item.adminOnly && !isAdmin) return false;
                  return item.label.toLowerCase().includes(search.toLowerCase());
                });

                if (groupItems.length === 0) return null;

                return (
                  <div key={group.title} className="mb-6 last:mb-0">
                    <p className="px-4 mb-2 text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">{group.title}</p>
                    <div className="space-y-1">
                      {groupItems.map((item) => {
                        const Icon = item.icon;
                        const absoluteIndex = filteredItems.indexOf(item);
                        const isSelected = selectedIndex === absoluteIndex;

                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              onNavigate(item.id);
                              onClose();
                            }}
                            className={`
                              w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 relative
                              ${isSelected 
                                ? 'bg-primary text-white shadow-xl shadow-primary/20 scale-[1.02]' 
                                : 'text-text-secondary hover:bg-section hover:text-text-main'}
                            `}
                          >
                            <div className={`
                              p-2 rounded-xl transition-all duration-300
                              ${isSelected ? 'bg-white/20' : 'bg-section group-hover:bg-primary/10'}
                            `}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <span className="font-bold text-sm tracking-tight">{item.label}</span>
                            
                            <div className="ml-auto flex items-center gap-2">
                              {isSelected ? (
                                <ArrowRight className="w-4 h-4 animate-in fade-in slide-in-from-left-2" />
                              ) : (
                                <div className="px-2 py-1 rounded-lg bg-section border border-border text-[10px] font-black text-text-muted transition-colors group-hover:border-primary/20">
                                  {item.shortcut}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {filteredItems.length === 0 && (
                <div className="py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-section rounded-[2rem] flex items-center justify-center mx-auto text-text-muted opacity-20">
                    <Search className="w-10 h-10" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-text-main">No commands found</p>
                    <p className="text-xs text-text-muted">Try a different search term</p>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-section/30 border-t border-border flex items-center justify-between">
              <div className="flex items-center gap-6">
                 <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                       <kbd className="px-1.5 py-1 rounded bg-white border border-border text-[9px] font-black text-text-muted shadow-sm">↑</kbd>
                       <kbd className="px-1.5 py-1 rounded bg-white border border-border text-[9px] font-black text-text-muted shadow-sm">↓</kbd>
                    </div>
                    <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Navigate</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <kbd className="px-1.5 py-1 rounded bg-white border border-border text-[9px] font-black text-text-muted shadow-sm">Enter</kbd>
                    <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Select</span>
                 </div>
              </div>
              <div className="flex items-center gap-2 text-[9px] font-black text-primary uppercase tracking-widest bg-primary/10 px-3 py-1.5 rounded-full">
                 <Command className="w-3 h-3" />
                 LibraryCore Matrix
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
