import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  BookOpen, 
  Clock, 
  Star, 
  MessageSquare, 
  Highlighter, 
  Layout,
  ArrowRight,
  TrendingUp,
  Flame,
  Calendar,
  ChevronRight,
  Library,
  Layers,
  Search,
  GraduationCap,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Resource, ReadingProgress, StudySet, Course } from '../types';
import { getSubjectCover } from '../constants/subjectImages';
import { db } from '../firebase';
import { onSnapshot, collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';

interface StudyDashboardProps {
  user: User;
  onOpenResource: (resource: Resource) => void;
  resources: Resource[];
  courses?: Course[];
  onOpenCourse?: (course: Course) => void;
}

export function StudyDashboard({ user, onOpenResource, resources, courses = [], onOpenCourse }: StudyDashboardProps) {
  const [readingHistory, setReadingHistory] = useState<ReadingProgress[]>([]);
  const [studySets, setStudySets] = useState<StudySet[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [enrolledCourses, setEnrolledCourses] = useState<any[]>([]);

  useEffect(() => {
    // Load local history initially for instant render
    const saved = localStorage.getItem(`reading-history-${user.uid}`);
    if (saved) {
      setReadingHistory(JSON.parse(saved));
    }

    // Real-time synchronization of reading progress from Firestore
    let unsubscribeProgress = () => {};
    if (user?.uid) {
      try {
        const progressRef = collection(db, 'users', user.uid, 'progress');
        const qProgress = query(progressRef, orderBy('updatedAt', 'desc'));
        
        unsubscribeProgress = onSnapshot(qProgress, (snapshot) => {
          const docsData: ReadingProgress[] = [];
          snapshot.forEach((docSnap) => {
            const d = docSnap.data();
            docsData.push({
              id: docSnap.id,
              userId: user.uid,
              resourceId: d.resourceId,
              lastPage: d.lastPage || 1,
              totalPages: d.totalPages || 1,
              updatedAt: d.updatedAt || new Date().toISOString(),
              title: d.title || 'Untitled Book',
              coverUrl: d.coverUrl || '',
              author: d.author || 'Unknown Author'
            } as ReadingProgress);
          });
          
          if (docsData.length > 0) {
            setReadingHistory(docsData);
            localStorage.setItem(`reading-history-${user.uid}`, JSON.stringify(docsData));
          } else if (!saved) {
            // Mock some history only if both local and remote are empty
            const mockHistory: ReadingProgress[] = resources.slice(0, 3).map(r => ({
              id: `hist-${r.id}`,
              userId: user.uid,
              resourceId: r.id,
              lastPage: 5,
              totalPages: 24,
              updatedAt: new Date().toISOString(),
              title: r.title,
              coverUrl: r.coverUrl || getSubjectCover(r.subject),
              author: r.author
            }));
            setReadingHistory(mockHistory);
          }
        }, (error) => {
          console.warn('Syncing progress from firestore failed:', error);
        });
      } catch (e) {
        console.warn('Failed to listen to reading progress:', e);
      }
    }

    // Real-time Study Sets
    const qSets = query(collection(db, 'study_sets'), orderBy('createdAt', 'desc'));
    const unsubscribeSets = onSnapshot(qSets, (snapshot) => {
      const sets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudySet));
      setStudySets(sets);
    });

    const fetchEnrolled = async () => {
      try {
        const res = await fetch(`/api/users/${user.uid}/enrollments`);
        if (res.ok) {
           const data = await res.json();
           
           // For each enrollment, fetch the progress percentage
           const detailed = await Promise.all(data.map(async (e: any) => {
              const progRes = await fetch(`/api/courses/${e.course_id}/progress/${user.uid}`);
              const progData = await progRes.json();
              
              // Get lesson count
              const courseRes = await fetch(`/api/courses/${e.course_id}`);
              const courseData = await courseRes.json();
              const totalLessons = courseData.lesson_count || courseData.sections?.reduce((acc: number, s: any) => acc + (s.lessons?.length || 0), 0) || 1;
              
              return {
                 ...e,
                 details: courseData,
                 progressPercent: Math.round((progData.length / totalLessons) * 100)
              };
           }));
           
           setEnrolledCourses(detailed);
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchEnrolled();

    return () => {
      unsubscribeSets();
      unsubscribeProgress();
    };
  }, [user.uid, resources.length]);

  const stats = [
    { label: 'Books Read', value: readingHistory.length, icon: BookOpen, color: 'text-primary', bg: 'bg-primary/10', onClick: () => window.dispatchEvent(new CustomEvent('changeTab', { detail: 'library' })) },
    { label: 'Study Streak', value: '12 Days', icon: Flame, color: 'text-orange-500', bg: 'bg-orange-500/10' },
    { label: 'Total Files', value: resources.length, icon: Library, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Quiz Master', value: 'Test Me', icon: Trophy, color: 'text-warning', bg: 'bg-warning/10', onClick: () => window.dispatchEvent(new CustomEvent('changeTab', { detail: 'quizzes' })) },
  ];

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="space-y-10 pb-20">
      {/* Welcome Header */}
      <div className="relative rounded-[3rem] bg-primary-gradient p-10 overflow-hidden shadow-2xl shadow-primary/20">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <h1 className="text-4xl md:text-5xl font-display font-black text-white mb-4 tracking-tight">
              Study Hub, {user.fullName.split(' ')[0]}
            </h1>
            <p className="text-white/80 font-medium max-w-md leading-relaxed">
              Your academic progress is looking great! You've covered 3 new topics this week.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-white/20 backdrop-blur-md p-6 rounded-[2.5rem] border border-white/20">
            <div className="w-16 h-16 rounded-3xl bg-white flex items-center justify-center text-primary shadow-lg">
               <Trophy className="w-8 h-8" />
            </div>
            <div>
               <p className="text-xs font-black text-white/70 uppercase tracking-widest mb-1">Scholar ID</p>
               <p className="text-2xl font-black text-white">#{user.contactCode || '00001'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Enrolled Courses */}
      {enrolledCourses.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                <GraduationCap className="w-5 h-5" />
              </div>
              <h2 className="text-2xl font-display font-black text-text-main tracking-tight">Active Learning Paths</h2>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence>
            {enrolledCourses.map((enrollment, i) => (
              <motion.div 
                key={enrollment.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ y: -5 }}
                className="bg-white rounded-[2.5rem] border border-border p-6 shadow-soft hover:border-purple-600 transition-all group cursor-pointer"
                onClick={() => onOpenCourse?.(enrollment.details)}
              >
                <div className="relative h-32 rounded-2xl overflow-hidden mb-4">
                  <img src={enrollment.details.thumbnail_url || `https://picsum.photos/seed/${enrollment.course_id}/400/200`} className="w-full h-full object-cover" alt="" />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent" />
                  <div className="absolute bottom-3 left-3 text-white text-[10px] font-black uppercase tracking-widest bg-purple-600 px-2 py-1 rounded-md">
                    {enrollment.details.subject}
                  </div>
                </div>
                
                <h3 className="font-bold text-gray-900 mb-2 line-clamp-1 group-hover:text-purple-600 transition-colors uppercase tracking-tight">{enrollment.details.title}</h3>
                
                <div className="space-y-3 pt-2 border-t border-gray-50">
                  <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    <span>Course Progress</span>
                    <span className="text-purple-600">{enrollment.progressPercent}%</span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden p-0.5">
                    <motion.div 
                      className="h-full bg-purple-600 rounded-full shadow-[0_0_8px_rgba(168,85,247,0.4)]"
                      initial={{ width: 0 }}
                      animate={{ width: `${enrollment.progressPercent}%` }}
                    />
                  </div>
                  <div className="flex justify-end pt-2">
                    <button className="flex items-center gap-2 text-[10px] font-black text-purple-600 uppercase tracking-widest group-hover:gap-3 transition-all">
                      Continue <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
            </AnimatePresence>
          </div>
        </section>
      )}
      {/* Stats Board */}
      <motion.div 
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {stats.map((stat, i) => (
          <motion.div 
            key={i}
            variants={item}
            onClick={stat.onClick}
            className={`bg-white p-6 rounded-[2rem] border border-border shadow-soft flex flex-col gap-4 hover:border-primary transition-all group ${stat.onClick ? 'cursor-pointer' : ''}`}
          >
            <div className={`w-12 h-12 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-1">{stat.label}</p>
              <p className="text-2xl font-black text-text-main data-mono">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        {/* Recently Read */}
        <div className="xl:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
               <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Clock className="w-5 h-5" />
               </div>
               <h2 className="text-2xl font-display font-black text-text-main tracking-tight">Pick Up Where You Left Off</h2>
            </div>
            <button className="text-xs font-bold text-primary hover:underline flex items-center gap-1">
               View All History <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {readingHistory.map((hist, i) => (
              <motion.div 
                key={i}
                whileHover={{ y: -5 }}
                className="bg-white rounded-[2.5rem] border border-border p-6 shadow-soft flex gap-6 hover:border-primary transition-all group cursor-pointer relative"
                onClick={() => {
                   const res = resources.find(r => r.id === hist.resourceId);
                   if (res) onOpenResource(res);
                }}
              >
                <button 
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (!confirm('Remove this from your history?')) return;
                    const newHistory = readingHistory.filter((_, index) => index !== i);
                    setReadingHistory(newHistory);
                    localStorage.setItem(`reading-history-${user.uid}`, JSON.stringify(newHistory));
                    if (user?.uid && hist.resourceId) {
                      try {
                        const progressDocRef = doc(db, 'users', user.uid, 'progress', hist.resourceId);
                        await deleteDoc(progressDocRef);
                      } catch (err) {
                        console.error('Failed to delete progress from firestore:', err);
                      }
                    }
                  }}
                  className="absolute top-4 right-4 p-2 text-text-muted hover:text-error opacity-0 group-hover:opacity-100 transition-all rounded-xl hover:bg-error/5"
                  title="Remove from history"
                >
                  <X className="w-4 h-4" />
                </button>
                <div className="w-24 h-32 rounded-2xl overflow-hidden shadow-md flex-shrink-0">
                  <img src={hist.coverUrl || ''} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                </div>
                <div className="flex flex-col justify-between py-2 overflow-hidden">
                  <div>
                    <h3 className="font-bold text-sm text-text-main line-clamp-1 group-hover:text-primary transition-colors">{hist.title}</h3>
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">{hist.author}</p>
                  </div>
                  <div className="space-y-4">
                     <div className="space-y-2">
                        <div className="flex justify-between items-center text-[8px] font-black text-text-muted uppercase tracking-tighter">
                           <span>Page {hist.lastPage} of {hist.totalPages}</span>
                           <span>{Math.round((hist.lastPage / hist.totalPages) * 100)}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-section rounded-full overflow-hidden">
                           <div className="h-full bg-primary rounded-full" style={{ width: `${(hist.lastPage / hist.totalPages) * 100}%` }} />
                        </div>
                     </div>
                     <button className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-widest group-hover:gap-3 transition-all">
                        Resume Reading <ArrowRight className="w-3 h-3" />
                     </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Study Sets */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
             <div className="p-2 rounded-xl bg-accent/10 text-accent">
                <Layers className="w-5 h-5" />
             </div>
             <h2 className="text-2xl font-display font-black text-text-main tracking-tight">Study Sets</h2>
          </div>
          
          <div className="space-y-4">
            {studySets.map((set, i) => (
              <motion.div 
                key={i}
                whileHover={{ scale: 1.02 }}
                className="bg-white p-6 rounded-[2rem] border border-border shadow-soft group cursor-pointer hover:bg-section transition-all"
              >
                <div className="flex justify-between items-start mb-4">
                   <div className="px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-[8px] font-black text-primary uppercase tracking-widest">
                      {set.subject}
                   </div>
                   <div className="flex items-center gap-1 text-[8px] font-black text-text-muted uppercase tracking-tighter bg-section px-2 py-1 rounded-lg">
                      <Library className="w-3 h-3" /> {set.resourceIds.length} Resources
                   </div>
                </div>
                <h3 className="font-bold text-sm text-text-main mb-2">{set.title}</h3>
                <p className="text-xs text-text-secondary leading-relaxed line-clamp-2 mb-4">{set.description}</p>
                <button className="w-full py-3 bg-white border border-border rounded-xl text-[10px] font-black text-text-main uppercase tracking-widest group-hover:border-primary group-hover:text-primary transition-all flex items-center justify-center gap-2">
                   Open Set <ChevronRight className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
