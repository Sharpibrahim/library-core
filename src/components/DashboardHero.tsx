import React, { useState, useEffect } from 'react';
import { BookOpen, FileText, PenTool, GraduationCap } from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '../types';
import { auth, db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

interface DashboardHeroProps {
  user: User;
}

export function DashboardHero({ user }: DashboardHeroProps) {
  const [statsData, setStatsData] = useState({
    books: 0,
    pastpapers: 0,
    notes: 0,
    courses: 0
  });

  useEffect(() => {
    if (!auth.currentUser) {
      // Fetch resources fallback
      fetch('/api/resources')
        .then(res => res.ok ? res.json() : [])
        .then(docs => {
          setStatsData(prev => ({
            ...prev,
            books: docs.filter((d: any) => d.type === 'book').length,
            pastpapers: docs.filter((d: any) => d.type === 'past_paper').length,
            notes: docs.filter((d: any) => d.type === 'note').length,
          }));
        })
        .catch(err => console.warn('Failed to get offline resources for DashboardHero:', err));

      // Fetch courses fallback
      fetch('/api/courses')
        .then(res => res.ok ? res.json() : [])
        .then(docs => {
          setStatsData(prev => ({
            ...prev,
            courses: docs.length
          }));
        })
        .catch(err => console.warn('Failed to get offline courses for DashboardHero:', err));

      return;
    }

    // Listen to resources to calculate stats
    const unsubResources = onSnapshot(collection(db, 'resources'), (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      setStatsData(prev => ({
        ...prev,
        books: docs.filter(d => d.type === 'book').length,
        pastpapers: docs.filter(d => d.type === 'past_paper').length,
        notes: docs.filter(d => d.type === 'note').length,
      }));
    }, (error) => {
      console.warn('Blocked snapshot of resources in DashboardHero:', error.message);
    });

    // Listen to courses
    const unsubCourses = onSnapshot(collection(db, 'courses'), (snapshot) => {
      setStatsData(prev => ({
        ...prev,
        courses: snapshot.size
      }));
    }, (error) => {
      console.warn('Blocked snapshot of courses in DashboardHero:', error.message);
    });

    return () => {
      unsubResources();
      unsubCourses();
    };
  }, []);

  const stats = [
    { label: 'Books in Shelf', value: statsData.books.toString(), icon: BookOpen, delay: 0.1 },
    { label: 'Past Papers', value: statsData.pastpapers.toString(), icon: FileText, delay: 0.2 },
    { label: 'Notes', value: statsData.notes.toString(), icon: PenTool, delay: 0.3 },
    { label: 'Active Courses', value: statsData.courses?.toString() || '0', icon: GraduationCap, delay: 0.4 },
  ];

  return (
    <section className="dashboard-gradient rounded-[2.5rem] p-8 sm:p-12 text-white relative overflow-hidden shadow-2xl shadow-primary/20 mb-10">
      {/* Animated Background */}
      <div className="absolute inset-0 animate-dots opacity-20" />
      
      <div className="relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-4xl sm:text-5xl font-serif font-bold mb-4">
            Welcome back, <span className="italic">{user.username}</span>! 👋
          </h1>
          <p className="text-white/70 text-lg max-w-xl mb-10">
            You've made great progress this week. Keep exploring new resources and expanding your knowledge.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: stat.delay }}
                className="glass-stat-card group hover:bg-white/20 transition-all duration-300"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-white/10 rounded-lg group-hover:scale-110 transition-transform">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">{stat.label}</span>
                </div>
                <div className="text-3xl font-bold">{stat.value}</div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
