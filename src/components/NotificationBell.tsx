import React from 'react';
import { Bell } from 'lucide-react';
import { motion } from 'motion/react';

interface NotificationBellProps {
  unreadCount: number;
  onClick: () => void;
  isOpen: boolean;
}

export function NotificationBell({ unreadCount, onClick, isOpen }: NotificationBellProps) {
  return (
    <button 
      onClick={onClick}
      className={`
        relative p-2.5 rounded-xl transition-all group overflow-hidden
        ${isOpen 
          ? 'bg-primary text-white shadow-lg shadow-primary/30' 
          : 'text-text-muted hover:text-primary hover:bg-primary/5 bg-section border border-border sm:border-none'}
      `}
    >
      <Bell className={`w-5 h-5 ${unreadCount > 0 && !isOpen ? 'animate-bounce' : ''}`} />
      
      {unreadCount > 0 && !isOpen && (
        <motion.span 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute top-2.5 right-2.5 w-2 h-2 bg-primary rounded-full border-2 border-white shadow-[0_0_10px_rgba(139,92,246,0.5)]"
        />
      )}
      
      {/* Visual active indicator when open */}
      {isOpen && (
        <motion.div 
          layoutId="bell-active"
          className="absolute inset-0 bg-white/10"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />
      )}
    </button>
  );
}
