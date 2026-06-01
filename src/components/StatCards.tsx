import React, { useState, useEffect } from 'react';
import { TrendingUp, Users, Book, FileText, PenTool } from 'lucide-react';
import { motion } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

export function StatCards() {
  const [statsData, setStatsData] = useState({
    books: 0,
    pastpapers: 0,
    notes: 0,
    students: 0
  });

  useEffect(() => {
    // Listen to resources
    const unsubResources = onSnapshot(collection(db, 'resources'), (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      setStatsData(prev => ({
        ...prev,
        books: docs.filter(d => d.type === 'book').length,
        pastpapers: docs.filter(d => d.type === 'past_paper').length,
        notes: docs.filter(d => d.type === 'note').length,
      }));
    }, (error) => {
      console.error('Failed to snapshot resources in StatCards:', error);
    });

    // Listen to users for students count
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      setStatsData(prev => ({
        ...prev,
        students: docs.filter(d => d.role === 'student').length
      }));
    }, (error) => {
      console.error('Failed to snapshot users in StatCards:', error);
    });

    return () => {
      unsubResources();
      unsubUsers();
    };
  }, []);

  const stats = [
    { label: 'Books in Shelf', value: statsData.books.toString(), trend: '+5%', icon: Book, color: 'from-blue-500 to-indigo-600' },
    { label: 'Past Papers', value: statsData.pastpapers.toString(), trend: '+12%', icon: FileText, color: 'from-purple-500 to-pink-600' },
    { label: 'Notes', value: statsData.notes.toString(), trend: '+8%', icon: PenTool, color: 'from-amber-500 to-orange-600' },
    { label: 'Active Students', value: statsData.students.toString(), trend: '+15%', icon: Users, color: 'from-emerald-500 to-teal-600' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm card-hover flex items-center gap-5"
          >
            <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${stat.color} p-3.5 text-white shadow-lg`}>
              <Icon className="w-full h-full" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-2xl font-bold text-slate-900">{stat.value}</span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-green-50 text-green-600 rounded-full border border-green-100 flex items-center gap-0.5">
                  <TrendingUp className="w-2.5 h-2.5" />
                  {stat.trend}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
