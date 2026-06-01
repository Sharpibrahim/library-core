import React, { useState } from 'react';
import { Course, User } from '../types';
import { 
  ArrowLeft, BookOpen, Clock, Users, Play, Star, CheckCircle2, 
  ChevronDown, ChevronUp, Globe, Award, ShieldCheck, Share2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CourseDetailPageProps {
  course: Course;
  user: User;
  onBack: () => void;
  onEnroll: () => void;
  isEnrolling?: boolean;
  isEnrolled?: boolean;
}

export function CourseDetailPage({ course, user, onBack, onEnroll, isEnrolling, isEnrolled }: CourseDetailPageProps) {
  const [expandedSections, setExpandedSections] = useState<number[]>(course.sections?.map(s => s.id as any) || []);

  const toggleSection = (id: number) => {
    setExpandedSections(prev => 
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    );
  };

  const totalLessons = course.sections?.reduce((acc, s) => acc + (s.lessons?.length || 0), 0) || 0;

  return (
    <div className="max-w-6xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-700 pb-32">
      {/* Hero Section */}
      <div className="relative rounded-[3rem] overflow-hidden bg-gray-900 shadow-2xl mb-12 group">
        <div className="absolute inset-0">
          <img 
            src={course.thumbnail_url || `https://picsum.photos/seed/${course.id}/1200/600`}
            className="w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-1000" 
            alt=""
          />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/40 to-transparent" />
        </div>

        <div className="relative z-10 p-10 lg:p-20 flex flex-col items-start gap-6 max-w-3xl">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-white/70 hover:text-white mb-4 text-sm font-bold uppercase tracking-widest transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Catalog
          </button>
          
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-purple-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg shadow-lg shadow-purple-600/30">
              {course.category || 'Professional'}
            </span>
            <span className="px-3 py-1 bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-lg backdrop-blur-md">
              {course.difficulty || 'Intermediate'}
            </span>
          </div>

          <h1 className="text-5xl lg:text-6xl font-black text-white leading-tight">
            {course.title}
          </h1>

          <p className="text-xl text-gray-300 leading-relaxed max-w-2xl">
            {course.description || "Unlock your potential with this comprehensive course designed to take you from foundational concepts to advanced mastery."}
          </p>

          <div className="flex flex-wrap gap-8 py-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md">
                <BookOpen className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Lessons</div>
                <div className="text-white font-black">{totalLessons} Modules</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md">
                <Clock className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Duration</div>
                <div className="text-white font-black">~12.5 Hours</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center backdrop-blur-md">
                <Users className="w-6 h-6 text-pink-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-gray-400 uppercase tracking-widest">Students</div>
                <div className="text-white font-black">{course.student_count || 0}+ Enrolled</div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-4">
             {isEnrolled ? (
               <button 
                onClick={onEnroll}
                className="px-10 py-5 bg-purple-600 text-white rounded-2xl font-black text-xl hover:bg-purple-700 transition-all flex items-center gap-3 shadow-xl shadow-purple-600/30 active:scale-95"
               >
                 <Play className="w-6 h-6 fill-current" /> Continue Learning
               </button>
             ) : (
               <button 
                onClick={onEnroll}
                disabled={isEnrolling}
                className="px-10 py-5 bg-white text-gray-900 rounded-2xl font-black text-xl hover:bg-gray-100 transition-all flex items-center gap-3 shadow-xl active:scale-95 disabled:opacity-50"
               >
                 {isEnrolling ? "Enrolling..." : "Enroll Now Free"} <CheckCircle2 className="w-6 h-6" />
               </button>
             )}
             <button className="p-5 bg-white/10 text-white rounded-2xl hover:bg-white/20 transition-all backdrop-blur-md border border-white/10">
                <Share2 className="w-6 h-6" />
             </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Left Column: Content */}
        <div className="lg:col-span-2 space-y-12">
          {/* What you'll learn */}
          <section className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-sm space-y-6">
            <h3 className="text-2xl font-black text-gray-900">What you'll learn</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                "Foundational architectural principles",
                "Advanced implementation strategies",
                "Scalable system design patterns",
                "Industry-standard best practices",
                "Hands-on project development",
                "AI-assisted workflow optimization"
              ].map((point, idx) => (
                <div key={idx} className="flex gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <span className="text-gray-600 font-medium">{point}</span>
                </div>
              ))}
            </div>
          </section>

          {/* Curriculum */}
          <section className="space-y-6">
            <div className="flex items-center justify-between px-4">
              <h3 className="text-2xl font-black text-gray-900">Course Content</h3>
              <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">
                {course.sections?.length || 0} Sections • {totalLessons} Lessons
              </div>
            </div>

            <div className="space-y-4">
              {course.sections?.map((section, idx) => (
                <div key={section.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden transition-all">
                  <button 
                    onClick={() => toggleSection(section.id as any)}
                    className="w-full px-8 py-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black">
                        {idx + 1}
                      </div>
                      <div className="text-left">
                        <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Section {idx + 1}</div>
                        <div className="text-lg font-black text-gray-900">{section.title}</div>
                      </div>
                    </div>
                    {expandedSections.includes(section.id as any) ? <ChevronUp className="text-gray-400" /> : <ChevronDown className="text-gray-400" />}
                  </button>

                  <AnimatePresence>
                    {expandedSections.includes(section.id as any) && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden bg-gray-50/50"
                      >
                        <div className="px-8 pb-6 pt-2 space-y-1">
                          {section.lessons?.map((lesson, lIdx) => (
                            <div key={lesson.id} className="flex items-center justify-between py-3 px-4 rounded-xl hover:bg-white transition-all group">
                              <div className="flex items-center gap-4">
                                <Play className="w-4 h-4 text-purple-600 opacity-20 group-hover:opacity-100 transition-opacity" />
                                <span className="text-gray-700 font-bold">{lesson.title}</span>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-xs font-bold text-gray-400 font-mono">10:00</span>
                                <Globe className="w-4 h-4 text-gray-300" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column: Instructor & Stats */}
        <div className="space-y-8">
          <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-sm space-y-6 sticky top-24">
            <h4 className="text-lg font-black text-gray-900">The Instructor</h4>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-purple-100 overflow-hidden shadow-inner">
                <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${course.teacherName || 'T'}`} className="w-full h-full" alt="" />
              </div>
              <div>
                <div className="font-black text-gray-900">{course.teacherName || 'Library Senior Staff'}</div>
                <div className="text-xs text-gray-400 font-bold">Educational Specialist</div>
              </div>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed italic">
              "Passionately driving educational innovation through technology. My mission is to make advanced topics accessible to every curious mind."
            </p>
            <div className="flex flex-col gap-3 pt-4 border-t border-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Award className="w-4 h-4" /> Verified Academy</span>
                <ShieldCheck className="w-4 h-4 text-blue-500" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2"><Users className="w-4 h-4" /> Support Community</span>
                <span className="text-xs font-bold text-green-500">Active</span>
              </div>
            </div>
            
            <button 
              onClick={onEnroll}
              className="w-full py-4 bg-black text-white rounded-2xl font-black hover:bg-gray-900 transition-all shadow-xl active:scale-95"
            >
              {isEnrolled ? "Get Learning Now" : "Unlock Full Access"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
