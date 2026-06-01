import React from 'react';
import { Menu, Search, ChevronDown, Settings, HelpCircle, Sparkles, Cloud, Wifi } from 'lucide-react';
import { User } from '../types';
import { NotificationBell } from './NotificationBell';

interface TopBarProps {
  user: User;
  onMenuClick: () => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  setActiveTab: (tab: string) => void;
  unreadNotificationsCount: number;
  onToggleNotifications: () => void;
  isNotificationCenterOpen: boolean;
}

export function TopBar({ 
  user, 
  onMenuClick, 
  searchQuery, 
  setSearchQuery, 
  setActiveTab,
  unreadNotificationsCount,
  onToggleNotifications,
  isNotificationCenterOpen
}: TopBarProps) {
  return (
    <header className="h-20 bg-white border-b border-border sticky top-0 z-30 px-4 sm:px-8 flex items-center justify-between transition-colors shadow-sm">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-text-muted hover:bg-primary/5 rounded-xl transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
        
        {/* Mobile Logo */}
        <div className="lg:hidden flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('dashboard')}>
          <div className="w-12 h-12 flex items-center justify-center">
            <img src="/logo.png" className="w-full h-full object-contain" alt="Logo" />
          </div>
          <span className="font-display font-bold text-text-main tracking-tight">Library<span className="text-primary">Core</span></span>
        </div>

        <div className="hidden lg:flex items-center gap-2">
          <div className="px-3 py-1.5 rounded-full bg-primary/5 border border-primary/10 flex items-center gap-2 shadow-sm">
            <Sparkles className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-bold text-text-main uppercase tracking-widest">Premium Core</span>
          </div>
          <div className="px-3 py-1.5 rounded-full bg-emerald-500/5 border border-emerald-500/10 flex items-center gap-2 shadow-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Offline Synced</span>
          </div>
        </div>
      </div>

      {/* Centered Search Bar */}
      <div className="hidden md:flex items-center gap-3 px-6 py-2.5 bg-section border border-border rounded-2xl w-[450px] group focus-within:bg-white focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/5 transition-all shadow-sm">
        <Search className="w-4 h-4 text-text-muted group-focus-within:text-primary transition-colors" />
        <input 
          type="text" 
          placeholder="Search library, notes, or ask AI..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-none outline-none text-sm w-full text-text-main placeholder:text-text-muted"
        />
        <div className="flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 rounded bg-white border border-border text-[10px] text-text-muted font-mono shadow-sm">⌘</kbd>
          <kbd className="px-1.5 py-0.5 rounded bg-white border border-border text-[10px] text-text-muted font-mono shadow-sm">K</kbd>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        <div className="hidden sm:flex items-center gap-2">
          <button className="p-2.5 text-text-muted hover:text-primary hover:bg-primary/5 rounded-xl transition-all relative">
            <HelpCircle className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveTab('settings')}
            className="p-2.5 text-text-muted hover:text-primary hover:bg-primary/5 rounded-xl transition-all relative"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>

        <div className="h-8 w-px bg-border hidden sm:block" />

        <NotificationBell 
          unreadCount={unreadNotificationsCount} 
          onClick={onToggleNotifications}
          isOpen={isNotificationCenterOpen}
        />

        <div className="flex items-center gap-3 pl-2 group cursor-pointer" onClick={() => setActiveTab('settings')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary p-0.5 shadow-lg shadow-primary/20 group-hover:scale-105 transition-transform">
            <div className="w-full h-full rounded-[10px] bg-white flex items-center justify-center overflow-hidden">
              <img 
                src={user.avatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                alt="Avatar" 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-text-secondary group-hover:text-text-main transition-colors" />
        </div>
      </div>
    </header>
  );
}
