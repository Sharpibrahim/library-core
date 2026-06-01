import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Check, Info, AlertTriangle, AlertCircle, Trash2 } from 'lucide-react';
import { Notification } from '../types';

interface NotificationCenterProps {
  notifications: Notification[];
  isOpen: boolean;
  onClose: () => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
}

export function NotificationCenter({ 
  notifications, 
  isOpen, 
  onClose, 
  onMarkRead, 
  onMarkAllRead,
  onClearAll
}: NotificationCenterProps) {
  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <Check className="w-4 h-4 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-rose-500" />;
      default: return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const getBg = (type: string) => {
    switch (type) {
      case 'success': return 'bg-emerald-500/10 border-emerald-500/20';
      case 'warning': return 'bg-amber-500/10 border-amber-500/20';
      case 'error': return 'bg-rose-500/10 border-rose-500/20';
      default: return 'bg-blue-500/10 border-blue-500/20';
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', { 
      hour: 'numeric', 
      minute: 'numeric',
      hour12: true 
    }).format(date);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60] lg:hidden"
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20, x: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20, x: 20 }}
            className="fixed top-24 right-4 sm:right-8 w-[calc(100%-2rem)] sm:w-[400px] bg-white border border-border rounded-3xl shadow-2xl z-[70] flex flex-col overflow-hidden max-h-[80vh]"
          >
            {/* Header */}
            <div className="p-6 border-b border-border flex items-center justify-between bg-section/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-text-main leading-tight">Notifications</h3>
                  <p className="text-xs font-bold text-text-muted uppercase tracking-widest">{unreadCount} unread</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-hover rounded-xl text-text-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-3 min-h-[200px]">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-16 h-16 rounded-[2rem] bg-section flex items-center justify-center text-text-muted mb-4">
                    <Bell className="w-8 h-8 opacity-20" />
                  </div>
                  <p className="text-sm font-bold text-text-muted">All caught up!</p>
                  <p className="text-xs text-text-muted/60 mt-1">No new notifications at the moment.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <motion.div
                    key={notif.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => !notif.read && onMarkRead(notif.id)}
                    className={`
                      p-4 rounded-[1.5rem] border transition-all cursor-pointer group relative
                      ${notif.read 
                        ? 'bg-white border-border text-text-secondary' 
                        : 'bg-primary/5 border-primary/20 text-text-main shadow-sm'}
                    `}
                  >
                    <div className="flex gap-4">
                      <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center border ${getBg(notif.type)}`}>
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-bold text-sm truncate pr-2">{notif.title}</p>
                          <span className="text-[10px] font-bold text-text-muted whitespace-nowrap">{formatTime(notif.createdAt)}</span>
                        </div>
                        <p className={`text-xs leading-relaxed ${notif.read ? 'text-text-muted' : 'text-text-secondary'} line-clamp-2`}>
                          {notif.message}
                        </p>
                      </div>
                    </div>
                    
                    {!notif.read && (
                      <div className="absolute top-4 right-4 w-2 h-2 bg-primary rounded-full animate-pulse" />
                    )}
                  </motion.div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-border bg-section/30 flex items-center gap-4">
              {notifications.length > 0 && (
                <button 
                  onClick={onMarkAllRead}
                  className="flex-grow py-2.5 px-4 rounded-xl bg-white border border-border text-xs font-bold text-text-main hover:bg-hover transition-all flex items-center justify-center gap-2"
                >
                  <Check className="w-3 h-3" />
                  Mark all
                </button>
              )}
              <button 
                onClick={() => {
                  onClose();
                  (window as any).dispatchEvent(new CustomEvent('changeTab', { detail: 'notifications' }));
                }}
                className="flex-grow py-2.5 px-4 rounded-xl bg-primary text-white text-xs font-bold hover:brightness-110 transition-all flex items-center justify-center gap-2"
              >
                View all
              </button>
              {notifications.length > 0 && (
                <button 
                  onClick={onClearAll}
                  className="p-2.5 rounded-xl bg-white border border-border text-text-muted hover:text-error hover:border-error/30 hover:bg-error/5 transition-all"
                  title="Clear all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
