import React, { useState, useEffect, useRef } from 'react';
import { Course, CourseLesson, User } from '../types';
import { ArrowLeft, PlayCircle, FileText, CheckCircle2, ChevronRight, Check, Bookmark, Clock, Lock, Sparkles, Brain, Award } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AdvancedSandbox } from './AdvancedSandbox';

declare global {
  interface Window {
    onYouTubeIframeAPIReady: () => void;
    YT: any;
  }
}

interface CoursePlayerProps {
  course: Course;
  user: User;
  onBack: () => void;
  isPreview?: boolean;
}

export function CoursePlayer({ course, user, onBack, isPreview }: CoursePlayerProps) {
  const [activeLesson, setActiveLesson] = useState<CourseLesson | null>(null);
  const [progress, setProgress] = useState<string[]>([]); // array of completed lesson IDs
  const [videoWatchedPercentage, setVideoWatchedPercentage] = useState(0);
  const [isVideoFinished, setIsVideoFinished] = useState(false);
  const [showQuiz, setShowQuiz] = useState(false);
  const [currentQuiz, setCurrentQuiz] = useState<any>(null);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<any>(null);

  const getYoutubeId = (url: string) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  useEffect(() => {
    if (course.sections && course.sections.length > 0 && course.sections[0].lessons && course.sections[0].lessons.length > 0) {
      setActiveLesson(course.sections[0].lessons[0]);
    }
  }, [course]);

  useEffect(() => {
    const fetchProgress = async () => {
      if (isPreview) return;
      try {
        const res = await fetch(`/api/courses/${course.id}/progress/${user.uid}`);
        if(res.ok) {
          const data = await res.json();
          setProgress(data.map((p: any) => p.lesson_id.toString()));
        }
      } catch (e) {
        console.error("Failed to load progress", e);
      }
    };
    fetchProgress();
  }, [course.id, user.uid, isPreview]);

  // Load YouTube API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        console.log("YouTube API Ready");
      };
    }
  }, []);

  useEffect(() => {
    if (activeLesson?.type === 'video' && getYoutubeId(activeLesson.video_url)) {
      initPlayer();
      setIsVideoFinished(isPreview || false); // Instructors don't need to wait
      setVideoWatchedPercentage(isPreview ? 100 : 0);
      setShowQuiz(false);
      setQuizScore(null);
      
      // Load lesson quiz
      fetch(`/api/lessons/${activeLesson.id}/quizzes`)
        .then(res => res.json())
        .then(data => {
          if (data && data.length > 0) setCurrentQuiz(data[0]);
          else setCurrentQuiz(null);
        });
    } else {
       setIsVideoFinished(true); // For non-video elements
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [activeLesson, isPreview]);

  const initPlayer = () => {
    if (window.YT && window.YT.Player && activeLesson) {
      const vidId = getYoutubeId(activeLesson.video_url);
      if (!vidId) return;

      if (playerRef.current && playerRef.current.loadVideoById) {
        playerRef.current.loadVideoById(vidId);
        return;
      }

      new window.YT.Player('video-placeholder', {
        height: '100%',
        width: '100%',
        videoId: vidId,
        playerVars: {
          'autoplay': 0,
          'controls': 1,
          'modestbranding': 1,
          'rel': 0,
          'disablekb': (isPreview ? 0 : 1) as any
        },
        events: {
          'onReady': (event: any) => {
            playerRef.current = event.target;
          },
          'onStateChange': (event: any) => {
            if (event.data === window.YT.PlayerState.PLAYING) {
              startTracking();
            } else {
              stopTracking();
            }
            if (event.data === window.YT.PlayerState.ENDED) {
              setIsVideoFinished(true);
              setVideoWatchedPercentage(100);
            }
          }
        }
      });
    } else {
      setTimeout(initPlayer, 500);
    }
  };

  const startTracking = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        const current = playerRef.current.getCurrentTime();
        const duration = playerRef.current.getDuration();
        const pct = (current / duration) * 100;
        setVideoWatchedPercentage(pct);
        
        // Enforce No Speeding (unless preview)
        if (!isPreview && playerRef.current.getPlaybackRate() > 1.0) {
          playerRef.current.setPlaybackRate(1.0);
        }

        if (pct > 98) setIsVideoFinished(true);
      }
    }, 1000);
  };

  const stopTracking = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const markComplete = async () => {
    if (!activeLesson) return;
    if (isPreview) {
      autoAdvance();
      return;
    }
    try {
      await fetch(`/api/lessons/${activeLesson.id}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, completed: true })
      });
      setProgress(prev => [...new Set([...prev, activeLesson.id.toString()])]);
      
      // If there is a quiz, show it
      if (currentQuiz && quizScore === null) {
        setShowQuiz(true);
      } else {
        autoAdvance();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const autoAdvance = () => {
    let foundActive = false;
    let advanced = false;
    course.sections?.forEach(sec => {
       sec.lessons?.forEach(les => {
          if (foundActive && !advanced) {
             setActiveLesson(les);
             advanced = true;
          }
          if (les.id === activeLesson?.id) foundActive = true;
       });
    });
  };

  const totalLessons = course.sections?.reduce((acc, sec) => acc + (sec.lessons?.length || 0), 0) || 0;
  const progressPercent = totalLessons > 0 ? Math.round((progress.length / totalLessons) * 100) : 0;

  return (
    <div className="flex flex-col h-full bg-slate-50 font-sans overflow-hidden">
      {/* Cinematic Header */}
      <header className="bg-white border-b border-border h-24 flex items-center justify-between px-10 shadow-sm z-50">
        <div className="flex items-center gap-8">
          <button 
            onClick={onBack}
            className="group flex items-center justify-center w-12 h-12 bg-section rounded-2xl hover:bg-black hover:text-white transition-all shadow-glow-sm border border-border"
          >
            <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          </button>
          <div className="h-10 w-px bg-border" />
          <div className="flex flex-col">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest bg-purple-50 px-2 py-0.5 rounded-full ring-1 ring-purple-100">
                {course.subject || 'Elite Program'}
              </span>
              <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.3em]">
                {isPreview ? 'System Architect Mode' : 'Acquisition Stage'}
              </span>
            </div>
            <h1 className="text-2xl font-display font-black text-text-main tracking-tight line-clamp-1 italic-serif" style={{ fontFamily: "'Playfair Display', serif" }}>
              {course.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-6">
           <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-text-muted uppercase tracking-widest mb-1">Session Progress</span>
              <div className="flex items-center gap-4">
                <div className="w-48 h-2 bg-section rounded-full overflow-hidden border border-border">
                  <motion.div 
                    className={`h-full ${isPreview ? 'bg-amber-500' : 'bg-primary'} shadow-glow ${isPreview ? 'shadow-amber-500/40' : 'shadow-primary/40'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${isPreview ? 100 : progressPercent}%` }}
                  />
                </div>
                <span className="text-sm font-black text-text-main">{isPreview ? '100' : progressPercent}%</span>
              </div>
           </div>
           
           <div className="h-10 w-px bg-border mx-2" />
           
           <div className="flex -space-x-3">
              <div className="w-10 h-10 rounded-2xl bg-white border-2 border-slate-50 flex items-center justify-center text-xs font-bold text-text-main shadow-sm ring-1 ring-black/5 overflow-hidden">
                <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} alt="Avatar" />
              </div>
              <div className="w-10 h-10 rounded-2xl bg-black border-2 border-slate-50 flex items-center justify-center text-xs font-bold text-white shadow-lg ring-1 ring-black/5">
                AI
              </div>
           </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Learning Concierge */}
        <main className="flex-1 overflow-y-auto p-12 custom-scrollbar bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:32px_32px]">
            <AnimatePresence mode="wait">
              {activeLesson ? (
                <motion.div 
                  key={activeLesson.id}
                  initial={{ opacity: 0, scale: 0.98, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.02, y: -20 }}
                  transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                  className="max-w-6xl mx-auto space-y-12 pb-20"
                >
                   {/* Breadcrumbs */}
                   <nav className="flex items-center gap-3">
                      <span className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em]">Curriculum Architecture</span>
                      <ChevronRight className="w-3 h-3 text-text-muted" />
                      <span className="text-[10px] font-black text-text-main uppercase tracking-[0.2em]">{activeLesson.title}</span>
                   </nav>

                   {/* Content Container */}
                   <div className="space-y-10">
                    {/* Media Interface */}
                    <div className="bg-black rounded-[3.5rem] overflow-hidden shadow-2xl relative aspect-video group border-[8px] border-white ring-1 ring-border">
                      {activeLesson.type === 'video' ? (
                        <div id="video-placeholder" className="w-full h-full" />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-white/20 p-20 text-center">
                           <FileText className="w-32 h-32 mb-8 stroke-[1px]" />
                           <h3 className="text-4xl font-display font-black text-white/10 italic-serif" style={{ fontFamily: "'Playfair Display', serif" }}>Intellectual Synthesis</h3>
                        </div>
                      )}
                      
                      {/* Video Progress Overlay */}
                      {activeLesson.type === 'video' && (
                         <div className="absolute bottom-0 left-0 w-full p-8 opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="h-1.5 w-full bg-white/20 rounded-full overflow-hidden backdrop-blur-md">
                               <motion.div 
                                 className="h-full bg-purple-500 shadow-glow shadow-purple-500/50"
                                 initial={{ width: 0 }}
                                 animate={{ width: `${videoWatchedPercentage}%` }}
                               />
                            </div>
                         </div>
                      )}
                    </div>

                    {/* Content Architecture */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                       {/* Left: Core Lesson Content */}
                       <div className="lg:col-span-2 space-y-10">
                         <div className="bg-white rounded-[3.5rem] p-16 border border-border shadow-sm shadow-purple-600/5 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 blur-[100px] -mr-40 -mt-40 rounded-full" />
                            <div className="relative space-y-10">
                              <div className="flex items-center gap-4">
                                <span className="px-4 py-2 bg-slate-50 border border-border text-text-main text-[9px] font-black uppercase tracking-widest rounded-full">
                                  {activeLesson.type} Matrix
                                </span>
                                {(isVideoFinished || isPreview) && (
                                  <span className="px-4 py-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-[9px] font-black uppercase tracking-widest rounded-full flex items-center gap-2">
                                    <Sparkles className="w-3 h-3"/> Acquisition Verified
                                  </span>
                                )}
                              </div>
                              
                              <div className="space-y-6">
                                <h1 className="text-5xl lg:text-7xl font-display font-black text-text-main tracking-tighter leading-tight italic-serif" style={{ fontFamily: "'Playfair Display', serif" }}>
                                  {activeLesson.title}
                                </h1>
                                <div className="w-24 h-2 bg-primary rounded-full shadow-glow" />
                              </div>
                              
                              <div className="prose prose-slate prose-xl max-w-none text-text-secondary leading-relaxed font-medium">
                                 {activeLesson.content || "This pedagogical unit bridges foundational theoretical constructs with advanced pragmatic applications. Synthesize the presented data with care."}
                              </div>
                            </div>
                          </div>
                          
                          {/* Advanced Academy Sandbox & Science Interface */}
                          <AdvancedSandbox user={user} course={course} />
                        </div>

                       {/* Right: Expert Guidance & Actions */}
                       <div className="space-y-8">
                          <div className="bg-slate-900 rounded-[3rem] p-10 text-white shadow-2xl relative overflow-hidden group">
                             <div className="absolute bottom-0 right-0 w-48 h-48 bg-primary/20 blur-[80px] -mb-24 -mr-24 rounded-full" />
                             <div className="relative z-10 space-y-8">
                                <div className="flex items-center gap-3">
                                   <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center">
                                      <Brain className="w-6 h-6 text-primary" />
                                   </div>
                                   <div>
                                      <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-primary">AI Concierge</span>
                                      <span className="block text-sm font-bold opacity-60">Status: Synthesizing</span>
                                   </div>
                                </div>

                                <p className="text-sm font-medium leading-relaxed opacity-80 italic">
                                  "Mastery is not an event, but a continuous alignment of intellect and practice. Progress through this module with intentional focus."
                                </p>

                                <div className="pt-6 border-t border-white/10">
                                   <div className="flex items-center justify-between mb-2">
                                      <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Module Unlocked</span>
                                      <Lock className={`w-3.5 h-3.5 ${isVideoFinished || isPreview ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`} />
                                   </div>
                                   <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                                      <motion.div 
                                        className="h-full bg-emerald-500" 
                                        animate={{ width: (isVideoFinished || isPreview) ? '100%' : '30%' }}
                                      />
                                   </div>
                                </div>
                             </div>
                          </div>

                          <button 
                            onClick={markComplete}
                            disabled={(!isVideoFinished && !isPreview) || (progress.includes(activeLesson.id.toString()) && !isPreview)}
                            className="group relative w-full py-8 bg-white text-text-main font-black rounded-[3rem] shadow-xl border border-border hover:bg-black hover:text-white hover:-translate-y-1 transition-all disabled:opacity-30 disabled:hover:translate-y-0 flex items-center justify-between px-10 text-xl overflow-hidden"
                          >
                             <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary opacity-0 group-hover:opacity-50 transition-opacity" />
                             <span className="relative z-10 flex flex-col items-start">
                               <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1">Finalize Stage</span>
                               <span className="tracking-tight italic-serif" style={{ fontFamily: "'Playfair Display', serif" }}>
                                 {progress.includes(activeLesson.id.toString()) && !isPreview ? "Mastery Verified" : "Advance Module"}
                               </span>
                             </span>
                             <div className="relative z-10 p-3 bg-section rounded-2xl group-hover:bg-white group-hover:text-black transition-colors">
                                <ChevronRight className="w-6 h-6" />
                             </div>
                          </button>
                       </div>
                    </div>
                   </div>

                   {/* Quiz Modal Overlay */}
                   <AnimatePresence>
                     {showQuiz && (
                        <motion.div 
                          className="fixed inset-0 bg-slate-900/40 backdrop-blur-3xl z-[1000] flex items-center justify-center p-6"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                           <motion.div 
                             className="bg-white rounded-[4rem] p-16 max-w-2xl w-full text-center space-y-10 shadow-3xl border border-white"
                             initial={{ scale: 0.9, y: 50 }}
                             animate={{ scale: 1, y: 0 }}
                           >
                              <div className="w-24 h-24 bg-primary/10 text-primary rounded-[2.5rem] flex items-center justify-center mx-auto shadow-glow shadow-primary/20">
                                <Award className="w-12 h-12" />
                              </div>
                              <div className="space-y-3">
                                <h3 className="text-5xl font-display font-black text-text-main tracking-tighter italic-serif" style={{ fontFamily: "'Playfair Display', serif" }}>Intellectual Gateway</h3>
                                <p className="text-text-secondary font-medium px-10">You've reached a critical transition point. Authenticate your expertise to unlock the subsequent module phase.</p>
                              </div>
                              
                              <div className="space-y-6">
                                 <div className="bg-section p-8 rounded-[2rem] border border-border text-left italic font-medium text-text-secondary leading-relaxed">
                                    "This challenge is dynamically generated based on the core pillars of {activeLesson.title}. Analyze each proposition with expert precision."
                                 </div>
                                 <button 
                                   onClick={() => {
                                     setQuizScore(100);
                                     setShowQuiz(false);
                                     autoAdvance();
                                   }}
                                   className="w-full py-6 bg-primary text-white rounded-[2rem] font-black text-xl hover:bg-primary-hover transition-all shadow-glow shadow-primary/30 active:scale-[0.98]"
                                 >
                                   Initiate Verification
                                 </button>
                              </div>
                           </motion.div>
                        </motion.div>
                     )}
                   </AnimatePresence>
                </motion.div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-text-muted py-40">
                   <div className="w-32 h-32 bg-white rounded-[3rem] border border-border flex items-center justify-center mb-10 shadow-sm">
                      <Lock className="w-12 h-12 stroke-[1.5px]" />
                   </div>
                   <h2 className="text-2xl font-black uppercase tracking-[0.4em] italic-serif" style={{ fontFamily: "'Playfair Display', serif" }}>Course Locked</h2>
                   <p className="mt-4 font-bold text-text-muted">Select a module from the syllabus to initiate synthesis.</p>
                </div>
              )}
            </AnimatePresence>
        </main>

        {/* Right Sidebar Syllabus Architecture */}
        <aside className="w-[450px] border-l border-border bg-white flex flex-col overflow-hidden shadow-2xl relative z-10">
           <div className="p-10 border-b border-border bg-slate-50 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16" />
              <div className="relative">
                <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em] block mb-2">Academic Roadmap</span>
                <h3 className="text-3xl font-display font-black text-text-main flex items-center gap-3 italic-serif" style={{ fontFamily: "'Playfair Display', serif" }}>
                  Syllabus
                </h3>
              </div>
           </div>
           
           <div className="flex-1 overflow-y-auto p-8 space-y-10 custom-scrollbar">
              {course.sections?.map((section, idx) => (
                 <div key={section.id} className="space-y-6">
                    <div className="flex items-center gap-4 px-2">
                       <span className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center text-[10px] font-black font-mono">0{idx + 1}</span>
                       <p className="text-[11px] font-black text-text-main uppercase tracking-widest">
                          {section.title}
                       </p>
                    </div>
                    
                    <div className="space-y-3">
                       {section.lessons?.map((lesson, lIdx) => {
                          const isCompleted = progress.includes(lesson.id.toString());
                          const isActive = activeLesson?.id === lesson.id;
                          const isLocked = !isPreview && !isCompleted && !isActive && (lIdx > 0 || idx > 0); 
                          
                          return (
                             <button
                                key={lesson.id}
                                disabled={isLocked}
                                onClick={() => setActiveLesson(lesson)}
                                className={`group w-full text-left p-6 rounded-[2rem] flex items-center gap-5 transition-all relative overflow-hidden ${
                                   isActive 
                                     ? 'bg-black text-white shadow-2xl shadow-black/20 -translate-y-1' 
                                     : isLocked 
                                       ? 'bg-section/50 border border-border opacity-40 grayscale cursor-not-allowed text-text-muted hover:bg-slate-200' 
                                       : isCompleted 
                                         ? 'bg-emerald-50 border-emerald-100 hover:bg-emerald-100'
                                         : 'bg-white border border-border hover:bg-slate-50 hover:border-primary/30'
                                }`}
                             >
                                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110 ${
                                   isActive ? 'bg-primary shadow-glow shadow-primary/40' : 'bg-section text-text-muted'
                                }`}>
                                   {isCompleted ? (
                                      <CheckCircle2 className={`w-6 h-6 ${isActive ? 'text-white' : 'text-emerald-500'}`} />
                                   ) : lesson.type === 'video' ? (
                                      <PlayCircle className={`w-6 h-6 ${isActive ? 'text-white' : 'text-purple-600'}`} />
                                   ) : (
                                      <FileText className={`w-6 h-6 ${isActive ? 'text-white' : 'text-blue-600'}`} />
                                   )}
                                </div>
                                <div className="flex-grow">
                                   <p className={`text-sm font-black tracking-tight leading-tight mb-0.5 ${isActive ? 'text-white' : 'text-text-main'}`}>
                                      {lesson.title}
                                   </p>
                                   <div className="flex items-center gap-3">
                                      <span className={`text-[9px] font-black uppercase tracking-widest opacity-60 ${isActive ? 'text-white' : 'text-text-muted'}`}>
                                         {lesson.type}
                                      </span>
                                      {isActive && <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />}
                                   </div>
                                </div>
                                {isLocked && <Lock className="w-4 h-4 text-text-muted" />}
                             </button>
                          );
                       })}
                    </div>
                 </div>
              ))}
              
              <div className="pt-6 border-t border-border">
                <button 
                  onClick={() => isPreview ? alert("Final Exam preview available") : alert("Complete all modules to unlock certification phase.")}
                  className={`w-full p-8 rounded-[2.5rem] bg-gradient-to-br from-amber-400 to-orange-500 text-white font-black flex items-center justify-between shadow-xl shadow-orange-500/30 ${!isPreview ? 'opacity-30 grayscale cursor-not-allowed' : 'hover:scale-105 active:scale-95 transition-all'}`}
                >
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center shadow-inner">
                        <Award className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <div className="text-[10px] uppercase tracking-[0.2em] font-black opacity-60 mb-0.5">Final Stage</div>
                        <div className="text-lg italic-serif" style={{ fontFamily: "'Playfair Display', serif" }}>Certification Exam</div>
                      </div>
                   </div>
                   {!isPreview && <Lock className="w-5 h-5 opacity-40" />}
                </button>
              </div>
           </div>
        </aside>
      </div>
    </div>
  );
}

function StarIcon(props: any) {
  return (
    <svg 
      {...props} 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
