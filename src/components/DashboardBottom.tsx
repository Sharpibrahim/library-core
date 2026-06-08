import React, { useState, useEffect } from 'react';
import { BookOpen, Clock, Plus, ArrowRight, MessageSquare, Heart, LogIn, Upload, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, query, where, orderBy, limit } from 'firebase/firestore';

interface DashboardBottomProps {
  user: User;
}

export function DashboardBottom({ user }: DashboardBottomProps) {
  const [borrowedResources, setBorrowedResources] = useState<any[]>([]);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    setIsLoading(true);

    // Filtered resources for current user
    const qResources = query(
      collection(db, 'resources'), 
      where('borrowedBy', '==', user.uid),
      where('status', '==', 'borrowed')
    );
    const unsubResources = onSnapshot(qResources, (snapshot) => {
      setBorrowedResources(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Activity log for current user
    const qActivity = query(
      collection(db, 'activityLog'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubActivity = onSnapshot(qActivity, (snapshot) => {
      setRecentActivity(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setIsLoading(false);
    }, (error) => {
      console.error('Activity log listener error:', error);
      setIsLoading(false);
    });

    return () => {
      unsubResources();
      unsubActivity();
    };
  }, [user?.uid]);

  const getActivityIcon = (action: string) => {
    switch (action?.toLowerCase()) {
      case 'login': return { icon: LogIn, color: 'bg-blue-100 text-blue-600' };
      case 'borrow': return { icon: ArrowDownToLine, color: 'bg-amber-100 text-amber-600' };
      case 'return': return { icon: ArrowUpFromLine, color: 'bg-green-100 text-green-600' };
      case 'upload': return { icon: Upload, color: 'bg-purple-100 text-purple-600' };
      default: return { icon: BookOpen, color: 'bg-slate-100 text-slate-600' };
    }
  };

  const getTimeAgo = (dateString: string) => {
    if (!dateString) return 'Recently';
    let dStr = String(dateString);
    if (dStr.includes(' ') && !dStr.includes('T')) {
      dStr = dStr.replace(' ', 'T');
    }
    const date = new Date(dStr);
    const now = new Date();
    if (isNaN(date.getTime())) return 'Recently';
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} mins ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
      {/* Continue Reading */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-serif font-bold text-slate-900">Continue Reading</h3>
          <button className="text-xs font-bold text-primary uppercase tracking-widest hover:underline">View All</button>
        </div>
        
        <div className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : borrowedResources.length > 0 ? (
            borrowedResources.map((book, index) => (
              <div key={book.id} className="group">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-slate-900 group-hover:text-primary transition-colors">{book.title}</h4>
                    <p className="text-xs text-slate-400">{book.author}</p>
                  </div>
                  <span className="text-sm font-bold text-slate-900">In Progress</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '50%' }}
                    transition={{ duration: 1, delay: index * 0.2 }}
                    className="h-full bg-gradient-to-r from-blue-500 to-indigo-600"
                  />
                </div>
                <button className="w-full py-3 bg-slate-50 hover:bg-primary hover:text-white text-slate-600 text-xs font-bold uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 group/btn">
                  Continue
                  <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                </button>
              </div>
            ))
          ) : (
            <div className="text-center py-10">
              <BookOpen className="mx-auto h-12 w-12 text-slate-200 mb-3" />
              <p className="text-slate-500 text-sm">You haven't borrowed any resources yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm p-8">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-xl font-serif font-bold text-slate-900">Recent Activity</h3>
          <button className="text-xs font-bold text-primary uppercase tracking-widest hover:underline">Clear</button>
        </div>

        <div className="space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : recentActivity.length > 0 ? (
            recentActivity.map((activity, index) => {
              const { icon: Icon, color } = getActivityIcon(activity.action);
              return (
                <div key={index} className="flex items-start gap-4 group">
                  <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-grow">
                    <p className="text-sm font-medium text-slate-700 leading-snug">{activity.details || `Performed ${activity.action}`}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Clock className="w-3 h-3 text-slate-300" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{getTimeAgo(activity.createdAt)}</span>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10">
              <Clock className="mx-auto h-12 w-12 text-slate-200 mb-3" />
              <p className="text-slate-500 text-sm">No recent activity found.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
