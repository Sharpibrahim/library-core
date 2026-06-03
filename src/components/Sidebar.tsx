import React from 'react';
import { 
  LayoutDashboard, 
  Library, 
  FileText, 
  Bot, 
  BarChart3, 
  Settings, 
  LogOut,
  X,
  Users,
  ClipboardList,
  Trophy,
  BookOpen,
  ChevronRight,
  Bell,
  Upload,
  Sparkles,
  ShieldCheck,
  MessageSquare,
  HelpCircle,
  Clock
} from 'lucide-react';
import { motion } from 'motion/react';
import { User as UserType } from '../types';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  user: UserType;
  hasNewMessage?: boolean;
  onToggleNotifications?: () => void;
  onOpenTutorial?: () => void;
}

const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'courses', label: 'Elite Courses', icon: BookOpen },
  { id: 'quizzes', label: 'Quiz Master', icon: Trophy, sparkles: true },
  { id: 'classrooms', label: 'Classrooms', icon: Users },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'messages', label: 'Expert Chat', icon: MessageSquare, badge: true },
  { id: 'ai-assistant', label: 'AI Assistant', icon: Bot },
  { id: 'settings', label: 'System Settings', icon: Settings },
  { id: 'upload', label: 'Upload Content', icon: Upload },
];

const ADMIN_ITEMS = [
  { id: 'admin-panel', label: 'LMS Management', icon: ShieldCheck },
];

export function Sidebar({ activeTab, setActiveTab, onLogout, isOpen, setIsOpen, user, hasNewMessage, onToggleNotifications, onOpenTutorial }: SidebarProps) {
  const isAdmin = user.role === 'admin';
  const isTeacher = user.role === 'teacher';

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-md z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 left-0 bottom-0 z-50 w-[280px] bg-white border-r border-border transition-transform duration-300 ease-in-out shadow-2xl shadow-primary/5
        lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex flex-col h-full">
          {/* Logo Section */}
          <div className="p-8 flex items-center justify-between">
            <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setActiveTab('dashboard')}>
              <div className="w-20 h-20 flex items-center justify-center group-hover:scale-110 transition-all duration-500">
                <img src="/logo.png" alt="LibraryCore Logo" className="w-full h-full object-contain" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold tracking-tighter text-text-main leading-none">
                  Library<span className="text-primary">Core</span>
                </h1>
                <div className="flex items-center gap-1.5 mt-1">
                  <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(16,185,129,0.4)] animate-pulse" />
                  <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">v2.0 Active</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              className="lg:hidden p-2 hover:bg-hover rounded-lg transition-colors text-text-muted"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Navigation Menu */}
          <nav className="flex-grow px-4 py-2 space-y-1 overflow-y-auto custom-scrollbar">
            <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-text-muted mb-4 ml-1">Main Menu</p>
            {MENU_ITEMS.filter((item) => {
              if (item.id === 'upload') {
                return isAdmin || isTeacher;
              }
              return true;
            }).map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              const showBadge = (item as any).badge && hasNewMessage;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    if (window.innerWidth < 1024) setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative
                    ${isActive 
                      ? 'bg-primary/5 text-primary border border-primary/10' 
                      : 'text-text-secondary hover:text-text-main hover:bg-primary/5'}
                  `}
                >
                  <div className={`
                    p-2 rounded-xl transition-all duration-300 relative
                    ${isActive ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-section group-hover:bg-primary/10'}
                  `}>
                    <Icon className="w-4 h-4" />
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-accent rounded-full border-2 border-white animate-pulse" />
                    )}
                    {(item as any).sparkles && (
                      <Sparkles className="absolute -top-1.5 -right-1.5 w-3 h-3 text-warning animate-pulse" />
                    )}
                  </div>
                  <span className="font-bold text-sm tracking-tight">{item.label}</span>
                  
                  {isActive && (
                    <motion.div 
                      layoutId="active-indicator"
                      className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                    />
                  )}
                  
                  {!isActive && (
                    <ChevronRight className="ml-auto w-4 h-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
                  )}
                </button>
              );
            })}

            {(isAdmin || isTeacher) && (
              <>
                <div className="pt-6 pb-2">
                  <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-text-muted ml-1">Management</p>
                </div>
                {ADMIN_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setActiveTab(item.id);
                        if (window.innerWidth < 1024) setIsOpen(false);
                      }}
                      className={`
                        w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative
                        ${isActive 
                          ? 'bg-amber-500/5 text-amber-500 border border-amber-500/10' 
                          : 'text-text-secondary hover:text-text-main hover:bg-amber-500/5'}
                      `}
                    >
                      <div className={`
                        p-2 rounded-xl transition-all duration-300
                        ${isActive ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-section group-hover:bg-amber-500/10'}
                      `}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-sm tracking-tight">{item.label}</span>
                    </button>
                  );
                })}
              </>
            )}

            <div className="pt-6 pb-2">
              <p className="px-4 text-[10px] font-bold uppercase tracking-widest text-text-muted ml-1">Support</p>
            </div>
            
            <button
              onClick={() => {
                setActiveTab('user-manual');
                if (window.innerWidth < 1024) setIsOpen(false);
              }}
              className={`
                w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative
                ${activeTab === 'user-manual' 
                  ? 'bg-primary/5 text-primary border border-primary/10' 
                  : 'text-text-secondary hover:text-text-main hover:bg-primary/5'}
              `}
            >
              <div className={`
                p-2 rounded-xl transition-all duration-300 relative
                ${activeTab === 'user-manual' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-section group-hover:bg-primary/10'}
              `}>
                <BookOpen className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm tracking-tight">User Manual</span>
              <Sparkles className="ml-auto w-3.5 h-3.5 text-primary group-hover:rotate-12 transition-transform animate-pulse" />
            </button>

            <button
              onClick={() => {
                if (onOpenTutorial) onOpenTutorial();
                if (window.innerWidth < 1024) setIsOpen(false);
              }}
              className="w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative text-text-secondary hover:text-text-main hover:bg-primary/5"
            >
              <div className="p-2 rounded-xl bg-section group-hover:bg-primary/10 transition-all duration-300">
                <HelpCircle className="w-4 h-4" />
              </div>
              <span className="font-bold text-sm tracking-tight">Software Tutorial</span>
            </button>
          </nav>

          {/* User Profile Card */}
          <div className="p-4 mt-auto">
            <div className="p-5 rounded-[2rem] bg-section border border-border relative overflow-hidden group shadow-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              
              <div className="relative z-10 flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-secondary p-0.5">
                    <div className="w-full h-full rounded-[14px] bg-white flex items-center justify-center overflow-hidden">
                      <img 
                        src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                        alt="Avatar" 
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-success border-2 border-white" />
                </div>
                
                <div className="flex-grow min-w-0">
                  <p className="font-bold text-sm text-text-main truncate">{user.fullName}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-[10px] font-bold text-text-secondary uppercase tracking-widest truncate">{user.role}</p>
                    <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-mono font-black">{user.contactCode}</span>
                  </div>
                </div>
                
                <button 
                  onClick={onLogout}
                  className="p-2 hover:bg-error/10 rounded-xl text-text-muted hover:text-error transition-all"
                  title="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
