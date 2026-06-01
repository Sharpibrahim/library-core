import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, BookOpen, Clock, ArrowRight, Search, 
  Users, TrendingUp, BookMarked, PlayCircle, Plus, Trash2, Eye, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Course, User } from '../types';
import { CourseBuilder } from './CourseBuilder';
import { CoursePlayer } from './CoursePlayer';
import { CourseDetailPage } from './CourseDetailPage';

interface CoursesViewProps {
  user: User;
}

const CATEGORIES = ['All', 'Science', 'Mathematics', 'Technology', 'Arts', 'History'];

export function CoursesView({ user }: CoursesViewProps) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [enrollCode, setEnrollCode] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);
  
  const [viewMode, setViewMode] = useState<'list' | 'build' | 'play' | 'details'>('list');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<number[]>([]);

  const canCreate = user.role === 'teacher' || user.role === 'admin';

  const fetchCourses = async () => {
    try {
      const res = await fetch('/api/courses');
      if (res.ok) {
        const data = await res.json();
        setCourses(data);
      }
    } catch(e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCourses = courses.filter(course => {
    const matchesCategory = activeCategory === 'All' || course.category === activeCategory || course.subject === activeCategory;
    const matchesSearch = course.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         (course.description?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  useEffect(() => {
    fetchCourses();
    fetchEnrolledCourses();
  }, []);

  const fetchEnrolledCourses = async () => {
    try {
      const res = await fetch(`/api/users/${user.uid}/enrollments`);
      if (res.ok) {
        const data = await res.json();
        setEnrolledCourseIds(data.map((e: any) => Number(e.course_id)));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenCourse = async (course: Course) => {
    try {
       const res = await fetch(`/api/courses/${course.id}`);
       if (res.ok) {
         const fullCourse = await res.json();
         setSelectedCourse(fullCourse);
         setViewMode('details');
       }
    } catch(e) {
      console.error(e);
    }
  };

  const handleEnrollAndPlay = async (courseId: number | string) => {
    setIsEnrolling(true);
    try {
       // Enroll
       await fetch(`/api/courses/${courseId}/enroll`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ userId: user.uid })
       });
       
       // Play
       const res = await fetch(`/api/courses/${courseId}`);
       if (res.ok) {
         const fullCourse = await res.json();
         setSelectedCourse(fullCourse);
         setViewMode('play');
         fetchEnrolledCourses();
       }
    } catch(e) {
      console.error(e);
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleEditCourse = async (course: Course, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
       const res = await fetch(`/api/courses/${course.id}`);
       if (res.ok) {
         const fullCourse = await res.json();
         setSelectedCourse(fullCourse);
         setViewMode('build');
       }
    } catch(e) {
      console.error(e);
    }
  };

  const handleEnrollByCode = async () => {
    if (!enrollCode) return;
    setIsEnrolling(true);
    try {
      const res = await fetch('/api/courses/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id || null, userUid: user.uid, courseCode: enrollCode })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Successfully enrolled!');
        setEnrollCode('');
        fetchCourses();
      } else {
        alert(data.error || 'Enrollment failed');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to enroll');
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleDeleteCourse = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this course?')) return;
    try {
      const res = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchCourses();
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (viewMode === 'build') {
    return <CourseBuilder user={user} onBack={() => { setViewMode('list'); fetchCourses(); }} existingCourse={selectedCourse || undefined} />;
  }

  if (viewMode === 'play' && selectedCourse) {
    return <CoursePlayer course={selectedCourse} user={user} onBack={() => setViewMode('details')} />;
  }

  if (viewMode === 'details' && selectedCourse) {
    const isEnrolled = enrolledCourseIds.includes(Number(selectedCourse.id));
    return (
      <CourseDetailPage 
        course={selectedCourse} 
        user={user} 
        onBack={() => setViewMode('list')} 
        onEnroll={() => handleEnrollAndPlay(selectedCourse.id)}
        isEnrolling={isEnrolling}
        isEnrolled={isEnrolled}
      />
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto w-full space-y-12 pb-20 font-sans">
      
      {/* Expert Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 py-10 px-10 bg-white border border-border rounded-[3.5rem] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 blur-3xl -mr-40 -mt-40" />
        <div className="relative z-10 space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20">
            <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-purple-600">Curricula Mastery</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-black text-text-main tracking-tighter italic-serif" style={{ fontFamily: "'Playfair Display', serif", fontStyle: 'italic' }}>Course Catalog</h1>
          <p className="text-text-secondary font-medium max-w-xl text-lg leading-relaxed">
            Elevate your academic journey with structured <span className="text-purple-600 font-bold">masterclasses</span> and comprehensive <span className="text-blue-600 font-bold">lesson paths</span> designed for peak performance.
          </p>
        </div>
        
        <div className="relative z-10 flex flex-col items-end gap-4 shadow-2xl shadow-purple-600/5 p-2 rounded-[2.5rem] bg-slate-50 border border-slate-100">
          <div className="flex bg-white/80 backdrop-blur-md p-1.5 rounded-[2rem] border border-border shadow-sm">
            <div className="relative group max-w-xs flex items-center">
               <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-400 group-focus-within:text-purple-600 transition-colors" />
               <input 
                  type="text" 
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 pr-4 py-3 bg-transparent text-sm font-bold outline-none w-48 transition-all focus:w-64"
               />
            </div>
            <div className="w-px h-6 bg-border mx-2 mt-2" />
            <div className="flex items-center gap-2 px-3">
               <input 
                  type="text" 
                  placeholder="Code"
                  value={enrollCode}
                  onChange={(e) => setEnrollCode(e.target.value.toUpperCase())}
                  className="w-16 bg-transparent text-xs font-black uppercase text-purple-600 placeholder-purple-300 outline-none"
               />
               <button 
                  onClick={handleEnrollByCode}
                  disabled={isEnrolling}
                  className="bg-purple-600 text-white p-2 rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-600/20 active:scale-95"
               >
                  <ArrowRight className="w-4 h-4" />
               </button>
            </div>
          </div>
        </div>
      </div>

      {/* Category Ribbon */}
      <div className="flex items-center justify-center gap-2 overflow-x-auto pb-4 px-4 no-scrollbar">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`
              px-8 py-4 rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all
              ${activeCategory === cat 
                ? 'bg-purple-600 text-white shadow-2xl shadow-purple-600/30 ring-4 ring-purple-600/10' 
                : 'bg-white border border-border text-text-secondary hover:bg-section hover:scale-105'}
            `}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Course Grid */}
      <div className="space-y-10 animate-in fade-in duration-700">
        <div className="flex items-center justify-between px-2">
          <div>
             <h2 className="text-3xl font-black text-text-main tracking-tight">Available Academies</h2>
             <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-1">Found {filteredCourses.length} personalized results</p>
          </div>
          {canCreate && (
             <button 
                onClick={() => { setSelectedCourse(null); setViewMode('build'); }}
                className="flex items-center gap-3 px-8 py-4 bg-white border-2 border-primary/20 text-primary rounded-[2rem] text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-glow-sm hover:shadow-glow active:scale-95"
              >
                <Plus className="w-4 h-4" /> Design Masterclass
              </button>
          )}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-[400px] rounded-2xl bg-gray-100 animate-pulse border border-gray-200" />
            ))}
          </div>
        ) : filteredCourses.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <AnimatePresence mode="popLayout">
              {filteredCourses.map((course, index) => (
                <motion.div
                  key={course.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="bg-white rounded-2xl border border-gray-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col group cursor-pointer"
                  onClick={() => handleOpenCourse(course)}
                >
                  <div className="relative h-60 overflow-hidden bg-section border-b border-border p-3">
                    <div className="w-full h-full rounded-[1.5rem] overflow-hidden relative">
                      <img 
                        src={course.thumbnail_url || `https://picsum.photos/seed/${course.id}/600/400`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" 
                        alt={course.title}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                    
                    <div className="absolute top-6 left-6 flex flex-col gap-2">
                       <div className="flex gap-2">
                          <span className="bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-full text-[9px] font-black text-purple-600 uppercase tracking-widest shadow-xl ring-1 ring-black/5">
                            {course.category || course.subject}
                          </span>
                          {course.course_code && (
                            <span className="bg-purple-600 text-white px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-xl shadow-purple-600/20">
                              {course.course_code}
                            </span>
                          )}
                       </div>
                    </div>

                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[80%] opacity-0 group-hover:opacity-100 group-hover:translate-y-0 translate-y-4 transition-all duration-300">
                       <button className="w-full py-3 bg-white text-purple-600 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-2xl hover:bg-purple-600 hover:text-white transition-all">
                          View Curriculum
                       </button>
                    </div>
                  </div>
                  
                  <div className="p-8 flex-grow flex flex-col">
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <h3 className="text-xl font-display font-black text-text-main line-clamp-2 group-hover:text-purple-600 transition-colors leading-snug">
                        {course.title}
                      </h3>
                    </div>
                    
                    <p className="text-text-secondary text-sm font-medium leading-relaxed mb-8 line-clamp-2 italic">
                       {course.description || "Synthesizing complex methodologies into digestible academic nodes."}
                    </p>
                    
                    <div className="grid grid-cols-3 gap-4 py-6 border-y border-border mb-8 bg-section/30 -mx-8 px-8">
                      <div className="flex flex-col items-center text-center">
                        <BookOpen className="w-4 h-4 text-purple-600 mb-2" />
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-tighter">{course.lesson_count || 0} Modules</span>
                      </div>
                      <div className="flex flex-col items-center text-center border-x border-border">
                        <TrendingUp className="w-4 h-4 text-blue-600 mb-2" />
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-tighter">{course.difficulty || 'Expert'}</span>
                      </div>
                      <div className="flex flex-col items-center text-center">
                        <Users className="w-4 h-4 text-emerald-600 mb-2" />
                        <span className="text-[10px] font-black text-text-muted uppercase tracking-tighter">{course.student_count || 0} Students</span>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-100 overflow-hidden">
                          <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${course.teacherName || 'T'}`} className="w-full h-full" alt="" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Instructor</span>
                          <span className="text-sm font-bold text-gray-700">{course.teacherName || 'Library Staff'}</span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {(user.role === 'admin' || canCreate) && (course.teacher_id === user.uid || course.teacher_uid === user.uid) && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenCourse(course).then(() => {
                                setViewMode('play'); // This will trigger the player
                              });
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 text-purple-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-purple-100 transition-colors"
                          >
                            <Eye className="w-3 h-3" /> Preview
                          </button>
                        )}
                        {canCreate && (course.teacher_id === user.uid || course.teacher_uid === user.uid) && (
                           <button 
                              onClick={(e) => handleEditCourse(course, e)}
                              className="text-xs font-bold text-blue-600 hover:underline"
                           >
                              Edit
                           </button>
                        )}
                        {(user.role === 'admin' || (canCreate && (
                           (course.teacher_uid && course.teacher_uid === user.uid) || 
                           (course.teacher_id && user.id && String(course.teacher_id) === String(user.id))
                        ))) && (
                           <button 
                              onClick={(e) => handleDeleteCourse(course.id, e)}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-100 transition-colors"
                           >
                              <Trash2 className="w-3 h-3" /> Delete
                           </button>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="text-center py-32 bg-white rounded-3xl border border-gray-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
            <GraduationCap className="mx-auto h-16 w-16 text-gray-300 mb-6" />
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No courses found</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              We couldn't find any courses matching your filters.
            </p>
          </div>
        )}
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
