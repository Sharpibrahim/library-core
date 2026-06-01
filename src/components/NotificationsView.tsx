import React from 'react';
import { Bell, Trash2, Check, Info, AlertTriangle, AlertCircle, X, ChevronRight, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Notification } from '../types';

interface NotificationsViewProps {
  notifications: Notification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onClearAll: () => void;
  onDelete: (id: string) => void;
}

export function NotificationsView({ 
  notifications, 
  onMarkRead, 
  onMarkAllRead, 
  onClearAll,
  onDelete
}: NotificationsViewProps) {
  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type: string) => {
    switch (type) {
      case 'success': return <Check className="w-5 h-5 text-emerald-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'error': return <AlertCircle className="w-5 h-5 text-rose-500" />;
      default: return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'success': return 'bg-emerald-500';
      case 'warning': return 'bg-amber-500';
      case 'error': return 'bg-rose-500';
      default: return 'bg-primary';
    }
  };

  const getTimeAgo = (dateInput: any) => {
    if (!dateInput) return '';
    const date = dateInput.toDate ? dateInput.toDate() : new Date(dateInput);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Panel */}
      <div className="bg-white rounded-[2.5rem] p-8 border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-6 shadow-sm">
        <div className="flex items-center gap-5">
          <div className="w-16 h-16 rounded-[1.8rem] bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <Bell className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-text-main tracking-tight">Notification Center</h1>
            <p className="text-text-muted font-medium mt-1">You have <span className="text-primary font-bold">{unreadCount}</span> unread messages</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {notifications.length > 0 && (
            <>
              <button 
                onClick={onMarkAllRead}
                className="flex items-center gap-2 px-6 py-3 bg-section border border-border rounded-2xl text-sm font-bold text-text-main hover:bg-hover transition-all"
              >
                <Check className="w-4 h-4" />
                Mark all read
              </button>
              <button 
                onClick={onClearAll}
                className="p-3 bg-rose-50 border border-rose-100 rounded-2xl text-rose-500 hover:bg-rose-100 transition-all"
                title="Clear all"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="bg-white rounded-[2.5rem] p-20 text-center border border-border border-dashed">
            <div className="w-24 h-24 rounded-full bg-section flex items-center justify-center text-text-muted mx-auto mb-6 opacity-20">
              <Bell className="w-12 h-12" />
            </div>
            <h2 className="text-2xl font-display font-bold text-text-main mb-2">No notifications found</h2>
            <p className="text-text-muted font-medium max-w-sm mx-auto">We'll let you know when something important happens in your library!</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout" initial={false}>
            {notifications.map((notif) => (
              <motion.div
                key={notif.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`
                  bg-white rounded-[2rem] p-6 border transition-all relative group shadow-sm
                  ${notif.read ? 'border-border' : 'border-primary/20 bg-primary/[0.02] shadow-primary/5'}
                `}
              >
                <div className="flex gap-6">
                  {/* Status Strip */}
                  <div className={`absolute top-0 bottom-0 left-0 w-1.5 rounded-l-[2rem] ${getStatusColor(notif.type)} ${notif.read ? 'opacity-20' : 'opacity-100'}`} />
                  
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-2xl flex-shrink-0 flex items-center justify-center border shadow-sm ${
                    notif.type === 'success' ? 'bg-emerald-50 border-emerald-100' :
                    notif.type === 'warning' ? 'bg-amber-50 border-amber-100' :
                    notif.type === 'error' ? 'bg-rose-50 border-rose-100' : 'bg-blue-50 border-blue-100'
                  }`}>
                    {getIcon(notif.type)}
                  </div>

                  {/* Content */}
                  <div className="flex-grow pt-1">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <h3 className={`text-lg font-bold tracking-tight ${notif.read ? 'text-text-secondary' : 'text-text-main'}`}>
                          {notif.title}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-xs font-bold text-text-muted uppercase tracking-widest">
                          <Clock className="w-3 h-3" />
                          {getTimeAgo(notif.createdAt)}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        {!notif.read && (
                          <button 
                            onClick={() => onMarkRead(notif.id)}
                            className="p-2.5 bg-section border border-border rounded-xl text-text-muted hover:text-primary transition-all"
                            title="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button 
                          onClick={() => onDelete(notif.id)}
                          className="p-2.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    
                    <p className={`text-base leading-relaxed max-w-2xl ${notif.read ? 'text-text-muted' : 'text-text-secondary'}`}>
                      {notif.message}
                    </p>

                    {/* Unread indicator */}
                    {!notif.read && (
                      <div className="mt-4 flex items-center gap-2 text-xs font-black text-primary uppercase tracking-[0.2em] animate-pulse">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                        New Alert
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
