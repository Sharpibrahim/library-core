import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, 
  Play, 
  Pause, 
  RotateCcw, 
  Trophy, 
  GraduationCap, 
  Award, 
  Sparkles, 
  BookOpen, 
  User, 
  CheckCircle, 
  TrendingUp, 
  Plus, 
  Volume2, 
  MessageSquare, 
  Send, 
  ChevronRight, 
  Search, 
  FileText, 
  Sliders, 
  Calendar, 
  Flame,
  AlertCircle,
  FileCheck,
  Download,
  Activity,
  Users,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, Cell } from 'recharts';
import { User as UserType, Course, Classroom, ClassAssignment, ClassSubmission } from '../types';
import { db } from '../firebase';
import { collection, addDoc, onSnapshot, query, where, orderBy } from 'firebase/firestore';

interface DeepStudyTrackerProps {
  user: UserType;
  courses?: Course[];
}

// Global Synthetic Focus Audio Engine (Generates binaural/lofi patterns via Web Audio)
let audioCtxInstance: AudioContext | null = null;
let currentSynthNode: AudioNode | null = null;
let isAudioPlaying = false;

function toggleSyntheticFocusSound(soundType: 'none' | 'lofi' | 'rain' | 'binaural', volume: number) {
  try {
    // Stop previous sound
    if (currentSynthNode) {
      try { (currentSynthNode as any).stop(); } catch (e) {}
      try { (currentSynthNode as any).disconnect(); } catch (e) {}
      currentSynthNode = null;
    }
    
    if (soundType === 'none') {
      isAudioPlaying = false;
      return;
    }

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    if (!audioCtxInstance) {
      audioCtxInstance = new AudioContextClass();
    }
    
    const ctx = audioCtxInstance;
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const mainGain = ctx.createGain();
    mainGain.gain.setValueAtTime((volume / 100) * 0.15, ctx.currentTime);

    if (soundType === 'rain') {
      // Create Pink/Brown noise for soothing rain effect
      const bufferSize = 2 * ctx.sampleRate;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise filter approximation
        output[i] = (lastOut + (0.02 * white)) / 1.02;
        lastOut = output[i];
        output[i] *= 3.5; // compensation volume
      }
      const noiseNode = ctx.createBufferSource();
      noiseNode.buffer = noiseBuffer;
      noiseNode.loop = true;
      noiseNode.connect(mainGain);
      mainGain.connect(ctx.destination);
      noiseNode.start(0);
      currentSynthNode = noiseNode;
    }
    else if (soundType === 'binaural') {
      // Binaural beat (focus theta wave: 200Hz - 206Hz)
      const oscLeft = ctx.createOscillator();
      const oscRight = ctx.createOscillator();
      const pannerLeft = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      const pannerRight = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      oscLeft.type = 'sine';
      oscLeft.frequency.setValueAtTime(204, ctx.currentTime);
      oscRight.type = 'sine';
      oscRight.frequency.setValueAtTime(210, ctx.currentTime);

      if (pannerLeft && pannerRight) {
        pannerLeft.pan.setValueAtTime(-1, ctx.currentTime);
        pannerRight.pan.setValueAtTime(1, ctx.currentTime);
        oscLeft.connect(pannerLeft).connect(mainGain);
        oscRight.connect(pannerRight).connect(mainGain);
      } else {
        oscLeft.connect(mainGain);
        oscRight.connect(mainGain);
      }

      mainGain.connect(ctx.destination);
      oscLeft.start(0);
      oscRight.start(0);
      
      // Stop helper wrapper
      currentSynthNode = {
        stop: () => {
          oscLeft.stop();
          oscRight.stop();
        },
        disconnect: () => {
          oscLeft.disconnect();
          oscRight.disconnect();
        }
      } as any;
    }
    else if (soundType === 'lofi') {
      // Simple repetitive soothing acoustic sequence
      let scale = [130.81, 164.81, 196.00, 261.63, 329.63, 392.00]; // C Major Chord Notes
      let noteIndex = 0;
      
      const intervalId = setInterval(() => {
        if (!audioCtxInstance || soundType !== 'lofi') {
          clearInterval(intervalId);
          return;
        }
        const noteOsc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        noteOsc.type = 'sine';
        // Smoothly alternate major frequencies
        const freq = scale[noteIndex % scale.length];
        noteOsc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        noteGain.gain.setValueAtTime(0.08 * (volume / 100), ctx.currentTime);
        noteGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
        
        noteOsc.connect(noteGain).connect(ctx.destination);
        noteOsc.start();
        noteOsc.stop(ctx.currentTime + 1.5);
        noteIndex++;
      }, 1000);

      currentSynthNode = {
        stop: () => {
          clearInterval(intervalId);
        },
        disconnect: () => {}
      } as any;
    }
    
    isAudioPlaying = true;
  } catch (err) {
    console.warn("Synth Audio failed: ", err);
  }
}

export function DeepStudyTracker({ user, courses: coursesProp = [] }: DeepStudyTrackerProps) {
  const [courses, setCourses] = useState<Course[]>(coursesProp);
  // Navigation inside Tracker Panel
  const [trackerTab, setTrackerTab] = useState<'timer' | 'gradebook' | 'charts' | 'advisor'>('timer');
  const isAdminOrTeacher = user.role === 'admin' || user.role === 'teacher';

  // --- TIME TRACKER STATES ---
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [timerActive, setTimerActive] = useState(false);
  const [timerMode, setTimerMode] = useState<'focus' | 'short_break' | 'long_break'>('focus');
  const [selectedSubject, setSelectedSubject] = useState('General Academy');
  const [sessionNotes, setSessionNotes] = useState('');
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [soundType, setSoundType] = useState<'none' | 'lofi' | 'rain' | 'binaural'>('none');
  const [ambientVolume, setAmbientVolume] = useState(50);
  const intervalRef = useRef<any>(null);

  // Load courses in background dynamically if not provided by prop
  useEffect(() => {
    async function loadCourses() {
      try {
        const res = await fetch('/api/courses');
        if (res.ok) {
          const data = await res.json();
          setCourses(data);
          if (data.length > 0) {
            setSelectedSubject(data[0].title);
          }
        }
      } catch (e) {
        console.warn("Could not load courses list inside study tracker: ", e);
      }
    }
    loadCourses();
  }, []);

  // --- GRADEBOOK STATES (Student Report Card) ---
  const [studentGrades, setStudentGrades] = useState<any[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [issuedCertificates, setIssuedCertificates] = useState<any[]>([]);

  // --- TEACHER GRADING INTERFACE STATES ---
  const [teacherClasses, setTeacherClasses] = useState<Classroom[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [classAssignments, setClassAssignments] = useState<ClassAssignment[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<ClassAssignment | null>(null);
  const [gradingSubmission, setGradingSubmission] = useState<ClassSubmission | null>(null);
  const [gradeStatus, setGradeStatus] = useState<'completed' | 'needs_improvement'>('completed');
  const [gradeScore, setGradeScore] = useState<string>('95');
  const [gradeFeedback, setGradeFeedback] = useState<string>('');
  const [submittingGrade, setSubmittingGrade] = useState(false);
  const [issuingCertCourseId, setIssuingCertCourseId] = useState<string>('');

  // --- MODALS OR HIGHLIGHTS ---
  const [activeCertificateModal, setActiveCertificateModal] = useState<any | null>(null);

  // --- AI STUDY ADVISOR COUNSELING STATES ---
  const [advisorAdvice, setAdvisorAdvice] = useState<string>('');
  const [requestingAdvice, setRequestingAdvice] = useState(false);

  // Load study logs from live Firestore db matching current user
  useEffect(() => {
    const qLogs = query(
      collection(db, 'study_logs'), 
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    
    const unsubscribe = onSnapshot(qLogs, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRecentLogs(logs);
    }, (err) => {
      console.warn("Firestore study_logs snapshot error (likely index rule warning - falling back):", err);
      // Fallback empty
    });

    return () => unsubscribe();
  }, [user.uid]);

  // Fetch student grades from database automatically
  const fetchGrades = async () => {
    setLoadingGrades(true);
    try {
      const res = await fetch(`/api/users/${user.uid}/grades`);
      if (res.ok) {
        const data = await res.json();
        setStudentGrades(data);
      }
      
      const resCerts = await fetch(`/api/users/${user.uid}/certificates`);
      if (resCerts.ok) {
        const certData = await resCerts.json();
        setIssuedCertificates(certData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingGrades(false);
    }
  };

  useEffect(() => {
    fetchGrades();
  }, [user.uid]);

  // Fetch teacher taught classrooms if user is instructor
  useEffect(() => {
    if (isAdminOrTeacher) {
      const fetchTeacherData = async () => {
        try {
          const res = await fetch(`/api/users/${user.uid}/classes`);
          if (res.ok) {
            const data = await res.json();
            setTeacherClasses(data);
            if (data.length > 0) {
              setSelectedClassId(data[0].id.toString());
            }
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchTeacherData();
    }
  }, [user.uid, isAdminOrTeacher]);

  // Fetch assignments inside selected classroom
  useEffect(() => {
    if (selectedClassId) {
      const fetchLessons = async () => {
        try {
          const res = await fetch(`/api/classes/${selectedClassId}`);
          if (res.ok) {
            const data = await res.json();
            // Pull assignments unorganized or general
            const fetched: ClassAssignment[] = data.unorganizedAssignments || [];
            if (data.topics) {
              data.topics.forEach((t: any) => {
                if (t.assignments) fetched.push(...t.assignments);
              });
            }
            setClassAssignments(fetched);
            if (fetched.length > 0) {
              // Fetch detailed assignment with submissions
              fetchAssignmentSubmissions(fetched[0].id);
            } else {
              setSelectedAssignment(null);
            }
          }
        } catch (e) {
          console.error(e);
        }
      };
      fetchLessons();
    }
  }, [selectedClassId]);

  const fetchAssignmentSubmissions = async (assignmentId: string) => {
    try {
      const res = await fetch(`/api/assignments/${assignmentId}`);
      if (res.ok) {
        const data = await res.json();
        setSelectedAssignment(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // --- FOCUS TIMER CONTROL MECHANISM ---
  useEffect(() => {
    if (timerActive) {
      intervalRef.current = setInterval(() => {
        if (seconds > 0) {
          setSeconds(prev => prev - 1);
        } else if (seconds === 0) {
          if (minutes === 0) {
            handleTimerComplete();
          } else {
            setMinutes(prev => prev - 1);
            setSeconds(59);
          }
        }
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerActive, minutes, seconds]);

  const handleTimerComplete = async () => {
    setTimerActive(false);
    playAlarmBeep();

    if (timerMode === 'focus') {
      const durationCompleted = timerMode === 'focus' ? 25 : (timerMode === 'short_break' ? 5 : 15);
      
      // Save session study log to cloud database synchronously
      try {
        await addDoc(collection(db, 'study_logs'), {
          userId: user.uid,
          studentName: user.fullName,
          subject: selectedSubject,
          duration: durationCompleted,
          notes: sessionNotes || 'Standard focus study session completed.',
          createdAt: new Date().toISOString()
        });
        
        // Add local alert
        alert("🎉 High-concentration focus session finished! Your study logs are synced.");
      } catch (err) {
        console.warn("Session logging skip: ", err);
      }
    } else {
      alert("☕ Break finished! Ready to lock in your next subject study goal?");
    }
    
    // Switch state
    resetTimer();
  };

  const playAlarmBeep = () => {
    try {
      const ctxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (ctxClass) {
        const ctx = new ctxClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3); // G5
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
        osc.start();
        osc.stop(ctx.currentTime + 0.55);
      }
    } catch (e) {}
  };

  const resetTimer = () => {
    setTimerActive(false);
    setSeconds(0);
    if (timerMode === 'focus') setMinutes(25);
    else if (timerMode === 'short_break') setMinutes(5);
    else setMinutes(15);
  };

  const setMode = (m: 'focus' | 'short_break' | 'long_break') => {
    setTimerMode(m);
    setTimerActive(false);
    setSeconds(0);
    if (m === 'focus') setMinutes(25);
    else if (m === 'short_break') setMinutes(5);
    else setMinutes(15);
  };

  // Sound selection hook
  const handleSoundChange = (val: typeof soundType) => {
    setSoundType(val);
    toggleFocusAudio(val, ambientVolume);
  };

  const handleVolumeChange = (vol: number) => {
    setAmbientVolume(vol);
    if (soundType !== 'none') {
      toggleFocusAudio(soundType, vol);
    }
  };

  const toggleFocusAudio = (type: typeof soundType, vol: number) => {
    toggleSyntheticFocusSound(type, vol);
  };

  // Clean ambient audio on unmount
  useEffect(() => {
    return () => {
      toggleSyntheticFocusSound('none', 0);
    };
  }, []);

  // --- GRADING SUBMISSION ACTION ---
  const handleApplyGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission || !selectedAssignment) return;
    setSubmittingGrade(true);
    
    try {
      // Build feedback combining score and textual notes
      const feedbackString = `[Score Grade: ${gradeScore}%] ${gradeFeedback}`;
      
      const res = await fetch(`/api/submissions/${gradingSubmission.id}/grade`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: gradeStatus,
          feedback: feedbackString
        })
      });
      
      if (res.ok) {
        alert("🏆 Grade and qualifying feedback posted successfully!");
        setGradingSubmission(null);
        setGradeFeedback('');
        // Refresh details
        fetchAssignmentSubmissions(selectedAssignment.id);
      }
    } catch (err: any) {
      console.error(err);
      alert("Grade entry error: " + err.message);
    } finally {
      setSubmittingGrade(false);
    }
  };

  // --- ISSUE CERTIFICATE TO STUDENT ---
  const handleIssueCertificate = async (studentUid: string, studentName: string) => {
    if (!issuingCertCourseId) {
      alert("Please select a target Course to certificate.");
      return;
    }
    const currentCourse = courses.find(c => c.id.toString() === issuingCertCourseId);
    if (!currentCourse) return;

    if (!confirm(`Are you sure you want to issue an Elite Academic Excellence Certificate to ${studentName} for the "${currentCourse.title}" course?`)) {
      return;
    }

    try {
      const res = await fetch('/api/certificates/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_uid: studentUid,
          course_id: currentCourse.id,
          template_data: {
            award: 'Academic Distinction - Summa Cum Laude excellence',
            teacher: user.fullName,
            date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
          }
        })
      });

      if (res.ok) {
        const certResult = await res.json();
        alert(`🎖️ Verifiable Digital Certificate issued! Code: ${certResult.certificate_code}`);
      } else {
        const errObj = await res.json();
        alert(`Certificate failed: ${errObj.error || 'Server error'}`);
      }
    } catch (e: any) {
      alert("Error issuing certificate: " + e.message);
    }
  };

  // --- FETCH CHAT DIAGNOSTIC ADVICE FROM GEMINI COACH ---
  const handleQueryAdvisor = async () => {
    setRequestingAdvice(true);
    try {
      const currentEnrolled = courses.map(c => c.title);
      const res = await fetch('/api/study-tracker/advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.fullName || user.username || 'Scholar',
          grades: studentGrades,
          studyLogs: recentLogs.slice(0, 5),
          coursesCovered: currentEnrolled
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setAdvisorAdvice(data.advice);
      } else {
        setAdvisorAdvice("The Advisor failed to parse the profile metrics. Make sure you have at least 1 course or study log!");
      }
    } catch (e: any) {
      setAdvisorAdvice("Connection error. Our servers are operating offline at the moment. Please try again in a few seconds.");
    } finally {
      setRequestingAdvice(false);
    }
  };

  // Calculate student analytical standings
  const computedGPA = () => {
    if (studentGrades.length === 0) return 3.25; // default fallback
    let totalScore = 0;
    let counted = 0;
    studentGrades.forEach(grade => {
      // Parse out score from "[Score Grade: 95%] Excellent..."
      const match = grade.feedback?.match(/\[Score Grade:\s*(\d+)%\]/);
      if (match) {
        totalScore += parseInt(match[1]);
        counted++;
      } else if (grade.status === 'completed') {
        totalScore += 90;
        counted++;
      }
    });

    if (counted === 0) return 3.42;
    const avgPercent = totalScore / counted;
    // Map percentage to scale of 4.0
    return Math.min(4.0, Number((4.0 * (avgPercent / 100)).toFixed(2)));
  };

  const getAwardLevel = (gpa: number) => {
    if (gpa >= 3.9) return { label: 'Summa Cum Laude', style: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
    if (gpa >= 3.7) return { label: 'Magna Cum Laude', style: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20' };
    if (gpa >= 3.5) return { label: 'Cum Laude', style: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
    return { label: 'Dean List Standings', style: 'bg-slate-500/10 text-slate-500 border-slate-500/20' };
  };

  const parsedGPA = computedGPA();
  const awardInfo = getAwardLevel(parsedGPA);

  // Recharts metric calculations
  const studyHoursBySubjectData = () => {
    const counts: { [key: string]: number } = {};
    recentLogs.forEach(entry => {
      const sub = entry.subject || 'General Studies';
      counts[sub] = (counts[sub] || 0) + Number(entry.duration || 25);
    });
    
    const colors = ['#8B5CF6', '#10B981', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899'];
    return Object.keys(counts).map((key, i) => ({
      name: key,
      Minutes: counts[key],
      color: colors[i % colors.length]
    }));
  };

  const timelinePerformanceData = [
    { week: 'Wk 1', GPA: 3.2 },
    { week: 'Wk 2', GPA: 3.4 },
    { week: 'Wk 3', GPA: 3.5 },
    { week: 'Wk 4', GPA: Number(parsedGPA.toFixed(2)) },
  ];

  return (
    <div className="space-y-8 pb-12">
      {/* Dynamic Master Board Header */}
      <div className="relative rounded-[2.5rem] bg-slate-900 text-white p-8 overflow-hidden shadow-2xl border border-slate-800">
        <div className="absolute top-0 right-0 w-80 h-80 bg-red-500/10 rounded-full blur-[90px] -translate-y-1/3 translate-x-1/3" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-500/10 rounded-full blur-[90px] translate-y-1/3 -translate-x-1/3" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="p-2 bg-gradient-to-tr from-purple-500 to-red-500 rounded-2xl flex items-center justify-center text-white shrink-0">
                <Activity className="w-5 h-5 animate-pulse" />
              </span>
              <span className="text-xs font-black uppercase tracking-[0.25em] text-red-400">LibraryCore Analytics Platform</span>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-display font-black tracking-tight leading-tight uppercase">
              Deep Study Tracker <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-red-400">&</span> Academic Gradebook
            </h1>
            <p className="text-slate-400 max-w-xl text-xs font-medium leading-relaxed">
              Track focused Pomodoro study sessions with synthetic ambient soundscapes, review official graded assignments, load digital verification certificates, or grade student works in real-time.
            </p>
          </div>
          
          {/* Quick Stats Widget */}
          <div className="bg-slate-950/80 backdrop-blur-md border border-slate-800 p-5 rounded-3xl min-w-[220px]">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Academic Performance Status</p>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black font-mono tracking-tight text-white">{parsedGPA.toFixed(2)}</span>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">GPA Status</span>
            </div>
            <div className="mt-2.5 flex items-center gap-1.5">
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase border ${awardInfo.style}`}>
                {awardInfo.label}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Primary Tab Navigation */}
      <div className="flex overflow-x-auto gap-4 border-b border-border pb-1 shrink-0 scrollbar-none">
        <button
          onClick={() => setTrackerTab('timer')}
          className={`flex items-center gap-2 pb-4 px-6 font-bold text-sm tracking-tight border-b-2 transition-all shrink-0 ${trackerTab === 'timer' ? 'border-primary text-primary font-black' : 'border-transparent text-text-muted hover:text-text-main'}`}
        >
          <Clock className="w-4 h-4" /> Focus Workspace
        </button>
        <button
          onClick={() => setTrackerTab('gradebook')}
          className={`flex items-center gap-2 pb-4 px-6 font-bold text-sm tracking-tight border-b-2 transition-all shrink-0 ${trackerTab === 'gradebook' ? 'border-primary text-primary font-black' : 'border-transparent text-text-muted hover:text-text-main'}`}
        >
          <GraduationCap className="w-4 h-4" /> Integrated Gradebook
        </button>
        <button
          onClick={() => setTrackerTab('charts')}
          className={`flex items-center gap-2 pb-4 px-6 font-bold text-sm tracking-tight border-b-2 transition-all shrink-0 ${trackerTab === 'charts' ? 'border-primary text-primary font-black' : 'border-transparent text-text-muted hover:text-text-main'}`}
        >
          <TrendingUp className="w-4 h-4" /> Performance Metrics
        </button>
        <button
          onClick={() => setTrackerTab('advisor')}
          className={`flex items-center gap-2 pb-4 px-6 font-bold text-sm tracking-tight border-b-2 transition-all shrink-0 ${trackerTab === 'advisor' ? 'border-primary text-primary font-black' : 'border-transparent text-text-muted hover:text-text-main'}`}
        >
          <Sparkles className="w-4 h-4" /> AI Academic Counselor
        </button>
      </div>

      {/* Tab Panels */}
      <AnimatePresence mode="wait">
        <motion.div
          key={trackerTab}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -15 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          
          {/* ==================== 1. TIMER FLOW ==================== */}
          {trackerTab === 'timer' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              
              {/* Left Column: Pomodoro circular panel */}
              <div className="lg:col-span-2 bg-white rounded-3xl border border-border p-8 flex flex-col items-center justify-between shadow-soft min-h-[500px]">
                <div className="w-full flex items-center justify-between border-b border-gray-100 pb-4 mb-6">
                  <h3 className="text-lg font-display font-bold text-text-main">Custom Pomodoro Focus Engine</h3>
                  
                  <div className="flex gap-2">
                    {(['focus', 'short_break', 'long_break'] as const).map(option => (
                      <button
                        key={option}
                        onClick={() => setMode(option)}
                        className={`text-[10px] uppercase font-black tracking-widest px-3 py-1.5 rounded-xl transition-all ${timerMode === option ? 'bg-primary text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                      >
                        {option.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Big Circular Ring Clock */}
                <div className="relative w-64 h-64 flex items-center justify-center my-6">
                  {/* Outer SVG progress ring */}
                  <svg className="absolute w-full h-full transform -rotate-90">
                    <circle 
                      cx="128" 
                      cy="128" 
                      r="115" 
                      stroke="#f3f4f6" 
                      strokeWidth="10" 
                      fill="transparent" 
                    />
                    <motion.circle 
                      cx="128" 
                      cy="128" 
                      r="115" 
                      stroke="var(--color-primary, #8b5cf6)" 
                      strokeWidth="10" 
                      fill="transparent" 
                      strokeDasharray="722.5"
                      animate={{
                        strokeDashoffset: 722.5 - (722.5 * ((minutes * 60 + seconds) / (timerMode === 'focus' ? 1500 : (timerMode === 'short_break' ? 300 : 900))))
                      }}
                      transition={{ ease: "linear", duration: 1 }}
                      strokeLinecap="round"
                    />
                  </svg>
                  
                  {/* Inside timer text elements */}
                  <div className="text-center z-10">
                    <span className="text-5xl font-black font-mono tracking-tight text-text-main block">
                      {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
                    </span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-text-muted mt-2 block">
                      {timerActive ? 'Focus locked' : 'Paused'}
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4 my-4">
                  <button
                    onClick={() => setTimerActive(!timerActive)}
                    className="w-16 h-16 rounded-full bg-primary hover:bg-primary-hover flex items-center justify-center text-white shadow-lg active:scale-95 transition-all text-lg cursor-pointer"
                    title={timerActive ? 'Pause' : 'Start'}
                  >
                    {timerActive ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-1" />}
                  </button>
                  <button
                    onClick={resetTimer}
                    className="w-12 h-12 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-text-secondary active:scale-95 transition-all cursor-pointer"
                    title="Reset Timer"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>

                {/* Study Scope Target selector */}
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-100 pt-6 mt-6">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary block mb-1.5">Linked Subject / Learning Path</label>
                    <select
                      value={selectedSubject}
                      onChange={(e) => setSelectedSubject(e.target.value)}
                      className="w-full bg-slate-50 border border-border px-3 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary transition-colors text-text-main"
                    >
                      {courses.length > 0 ? (
                        courses.map(course => (
                          <option key={course.id} value={course.title}>{course.title}</option>
                        ))
                      ) : (
                        <>
                          <option value="General Academic Modules">General Academic Modules</option>
                          <option value="Advanced Research Methods">Advanced Research Methods</option>
                          <option value="System Optimization Labs">System Optimization Labs</option>
                        </>
                      )}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary block mb-1.5">Focus Goal Memo</label>
                    <input
                      type="text"
                      placeholder="e.g. Completing draft, practicing quizzes..."
                      value={sessionNotes}
                      onChange={(e) => setSessionNotes(e.target.value)}
                      className="w-full bg-slate-50 border border-border px-3 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary transition-colors text-text-main"
                    />
                  </div>
                </div>

              </div>

              {/* Right Column: Audio settings & Live logs */}
              <div className="space-y-8">
                
                {/* Ambience Audio Console */}
                <div className="bg-slate-900 text-white rounded-3xl p-6 border border-slate-800 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-center gap-2 mb-4">
                    <Volume2 className="w-4 h-4 text-purple-400" />
                    <h3 className="text-sm font-semibold tracking-tight uppercase text-purple-300">Ambient Studio Synth</h3>
                  </div>
                  <p className="text-slate-400 text-[11px] leading-relaxed mb-4">
                    Block high-frequency cognitive distractions. Select an algorithmic waveform, put on headphones, and start studying.
                  </p>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { id: 'none', label: 'Silenced' },
                        { id: 'lofi', label: 'Lofi Chords' },
                        { id: 'rain', label: 'Rain Noise' },
                        { id: 'binaural', label: 'Binaural Focus' },
                      ] as const).map(soundItem => (
                        <button
                          key={soundItem.id}
                          onClick={() => handleSoundChange(soundItem.id)}
                          className={`text-[10px] font-bold tracking-tight px-3 py-2 rounded-xl border transition-all ${soundType === soundItem.id ? 'bg-purple-600 border-purple-500 text-white shadow-md' : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200'}`}
                        >
                          {soundItem.label}
                        </button>
                      ))}
                    </div>

                    {soundType !== 'none' && (
                      <div className="space-y-1.5 pt-2">
                        <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          <span>Volume Level</span>
                          <span className="text-purple-400">{ambientVolume}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={ambientVolume}
                          onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Focus logs list */}
                <div className="bg-white rounded-3xl border border-border p-6 shadow-soft flex-grow flex flex-col">
                  <div className="flex items-center gap-2 pb-3 border-b border-gray-100 mb-4 shrink-0">
                    <Calendar className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-bold text-text-main font-sans">Recent Success Study Logs</h3>
                  </div>

                  <div className="space-y-3 overflow-y-auto max-h-[220px] pr-1 flex-grow">
                    {recentLogs.length === 0 ? (
                      <div className="text-center py-10 text-gray-400 text-xs">
                        <Clock className="w-8 h-8 mx-auto text-gray-300 mb-2 stroke-1" />
                        <p className="font-semibold">No finished logs recorded yet.</p>
                        <p className="text-[10px] text-gray-400 mt-1">Complete your first 25m interval above!</p>
                      </div>
                    ) : (
                      recentLogs.map((log: any) => (
                        <div key={log.id} className="p-3 bg-slate-50 rounded-2xl border border-gray-100 flex items-start gap-3">
                          <span className="p-2 bg-primary/10 text-primary rounded-xl shrink-0 text-xs font-black">25m</span>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-gray-900 block truncate leading-tight">{log.subject}</span>
                            <span className="text-[10px] text-gray-500 block truncate mt-0.5">{log.notes}</span>
                            <span className="text-[9px] text-gray-400 font-mono mt-0.5 block">{new Date(log.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* ==================== 2. INTEGRATED GRADEBOOK ==================== */}
          {trackerTab === 'gradebook' && (
            <div className="space-y-8">
              
              {isAdminOrTeacher ? (
                /* TEACHER CONTROL PORTAL PANEL */
                <div className="bg-white rounded-3xl border border-border p-8 shadow-soft">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-gray-100 pb-6 mb-8">
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">Instructor Board</span>
                      <h2 className="text-2xl font-display font-black text-text-main tracking-tight mt-3">LMS Class Grading Hub</h2>
                      <p className="text-slate-500 text-xs font-medium leading-relaxed mt-0.5">Grade uploaded student submissions, post constructive evaluations, and issue distinguished academic excellence certificates.</p>
                    </div>

                    {/* Class Select dropdown */}
                    <div className="flex flex-wrap items-center gap-4">
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-wider text-text-secondary block mb-1">Target Class</label>
                        <select
                          value={selectedClassId}
                          onChange={(e) => setSelectedClassId(e.target.value)}
                          className="bg-slate-50 border border-border px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary transition-colors text-text-main min-w-[150px]"
                        >
                          {teacherClasses.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Course select to issue cert */}
                      <div>
                        <label className="text-[9px] font-bold uppercase tracking-wider text-text-secondary block mb-1">Certifiable Course</label>
                        <select
                          value={issuingCertCourseId}
                          onChange={(e) => setIssuingCertCourseId(e.target.value)}
                          className="bg-slate-50 border border-border px-3 py-2 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary transition-colors text-text-main min-w-[180px]"
                        >
                          <option value="">-- Choose Course --</option>
                          {courses.map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Submission Selector Board */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    
                    {/* Left side: Assignments lists */}
                    <div className="space-y-4 border-r border-gray-100 pr-0 lg:pr-6">
                      <div className="flex items-center gap-2 pb-2 mb-2 border-b border-gray-50">
                        <FileCheck className="w-4 h-4 text-purple-600" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-text-main">Assignments List</h3>
                      </div>

                      {classAssignments.length === 0 ? (
                        <p className="text-gray-400 text-xs py-6 text-center">No assignments added inside this classroom.</p>
                      ) : (
                        classAssignments.map(asg => (
                          <button
                            key={asg.id}
                            onClick={() => fetchAssignmentSubmissions(asg.id)}
                            className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start gap-3 ${selectedAssignment?.id === asg.id ? 'bg-purple-500/5 border-purple-500/30 text-purple-950' : 'bg-slate-50 border-gray-100 hover:border-gray-200 text-text-main'}`}
                          >
                            <div className="p-2 rounded-xl bg-white border border-gray-100 text-text-secondary shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <strong className="text-xs block font-bold truncate leading-tight mb-1">{asg.title}</strong>
                              <span className="text-[10px] text-gray-400 uppercase tracking-widest block font-black">{asg.assignment_type}</span>
                            </div>
                          </button>
                        ))
                      )}
                    </div>

                    {/* Middle: submissions for selected assignment */}
                    <div className="lg:col-span-2 space-y-6">
                      <div className="flex items-center justify-between border-b border-gray-50 pb-2">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-indigo-500" />
                          <h3 className="text-xs font-black uppercase tracking-widest text-text-main">Student Submissions ({selectedAssignment?.submissions?.length || 0})</h3>
                        </div>
                      </div>

                      {!selectedAssignment ? (
                        <div className="text-center py-16 text-gray-400 text-xs border border-dashed border-gray-100 rounded-3xl bg-slate-50">
                          <AlertCircle className="w-8 h-8 mx-auto text-gray-300 mb-2 stroke-1" />
                          <p className="font-semibold">Choose an assignment to fetch students' work</p>
                        </div>
                      ) : selectedAssignment.submissions?.length === 0 ? (
                        <div className="text-center py-16 text-gray-400 text-xs border border-dashed border-gray-100 rounded-3xl bg-slate-50">
                          <p className="font-semibold">No students have uploaded work for this module yet.</p>
                          <p className="text-[10px]">When students submit, files and essays will register here instantly.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {selectedAssignment.submissions?.map((sub: any) => (
                            <div 
                              key={sub.id} 
                              className="bg-slate-50 border border-gray-100 p-5 rounded-2xl flex flex-col justify-between group hover:border-primary transition-all relative"
                            >
                              <div>
                                <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                                  <div>
                                    <span className="text-xs font-bold text-gray-950 block">{sub.student_name || 'Classroom Student'}</span>
                                    <span className="text-[9px] text-zinc-400 block font-mono">{new Date(sub.submitted_at).toLocaleString()}</span>
                                  </div>
                                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full border ${sub.status === 'completed' ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border-amber-500/20'}`}>
                                    {sub.status}
                                  </span>
                                </div>

                                <p className="text-xs text-text-secondary leading-relaxed bg-white border border-gray-100 p-3.5 rounded-xl block truncate-line-clamp-2 max-h-16 overflow-y-auto mb-4">
                                  {sub.content || 'No text content provided.'}
                                </p>
                              </div>

                              <div className="flex gap-2 shrink-0">
                                <button
                                  onClick={() => {
                                    setGradingSubmission(sub);
                                    // Set fields
                                    const match = sub.feedback?.match(/\[Score Grade:\s*(\d+)%\]/);
                                    if (match) setGradeScore(match[1]);
                                    setGradeFeedback(sub.feedback?.replace(/\[Score Grade:\s*\d+%\]\s*/, '') || '');
                                  }}
                                  className="flex-grow btn-secondary px-4 py-2 text-[10px] font-black uppercase tracking-widest text-center"
                                >
                                  Evaluate & Grade
                                </button>
                                <button
                                  onClick={() => handleIssueCertificate(sub.student_uid || sub.student_id?.toString(), sub.student_name || 'Student')}
                                  disabled={!issuingCertCourseId}
                                  className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 hover:bg-amber-500 hover:text-white transition-all text-xs"
                                  title="Issue digital certificate of course completion"
                                >
                                  <Award className="w-4 h-4 border-0" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              ) : (
                /* STUDENT REPORT CARD SYSTEM */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                  
                  {/* Left Column: Grade lists */}
                  <div className="lg:col-span-2 space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                        <GraduationCap className="w-5 h-5 animate-pulse" />
                      </div>
                      <h2 className="text-2xl font-display font-black text-text-main tracking-tight uppercase">Your Academic Transcript</h2>
                    </div>

                    {loadingGrades ? (
                      <div className="py-20 text-center text-text-muted">Analyzing database files...</div>
                    ) : studentGrades.length === 0 ? (
                      <div className="text-center py-20 bg-white border border-border rounded-3xl p-8 flex flex-col items-center">
                        <Award className="w-12 h-12 text-zinc-300 stroke-1 mb-4" />
                        <h4 className="font-bold text-text-main">No Graded Academic Items Available</h4>
                        <p className="text-text-muted text-xs max-w-sm mt-1 leading-relaxed">
                          Your submitted assignments in Classrooms are currently pending teacher review. Once graded, your percentage metrics and custom advisor audits will list here.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {studentGrades.map(grade => {
                          // Extract custom score if exists
                          const scoreMatch = grade.feedback?.match(/\[Score Grade:\s*(\d+)%\]/);
                          const cleanScore = scoreMatch ? `${scoreMatch[1]}%` : '-';
                          const cleanFeedback = grade.feedback?.replace(/\[Score Grade:\s*\d+%\]\s*/, '') || 'Excellent evaluation - check classroom stream.';
                          
                          return (
                            <div key={grade.id} className="bg-white border border-border p-6 rounded-3xl shadow-sm hover:border-purple-500/30 transition-all flex flex-col md:flex-row justify-between md:items-center gap-6">
                              <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] bg-slate-100 text-zinc-500 font-black tracking-widest uppercase px-2 py-0.5 rounded-md">{grade.class_name || 'Classroom Module'}</span>
                                  <span className="text-[10px] bg-indigo-50 text-indigo-500 font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">{grade.assignment_type}</span>
                                </div>
                                <h4 className="text-base font-bold text-text-main leading-tight">{grade.assignment_title}</h4>
                                <p className="text-xs text-text-muted leading-relaxed block max-w-lg">
                                  <strong className="text-text-main">Feedback:</strong> {cleanFeedback}
                                </p>
                              </div>

                              <div className="flex items-center gap-4 shrink-0 bg-slate-50 md:bg-transparent p-4 md:p-0 rounded-2xl border md:border-0 border-gray-150">
                                <div className="text-right">
                                  <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">Achieved Grade</p>
                                  <p className="text-2xl font-black text-primary font-mono tracking-tighter mt-0.5">{cleanScore}</p>
                                </div>
                                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary text-sm font-black font-mono">
                                  {scoreMatch ? (parseInt(scoreMatch[1]) >= 90 ? 'A' : parseInt(scoreMatch[1]) >= 80 ? 'B' : 'C') : 'A'}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Right Column: Certificates collection */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                        <Award className="w-5 h-5 animate-bounce" />
                      </div>
                      <h2 className="text-2xl font-display font-black text-text-main tracking-tight uppercase">Distinction Credentials</h2>
                    </div>

                    <div className="bg-gradient-to-tr from-amber-500/5 to-yellow-500/5 border border-amber-500/20 rounded-3xl p-6 relative overflow-hidden shadow-sm">
                      <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
                      <p className="text-xs text-amber-800 font-bold leading-relaxed mb-4">
                        Verifiable electronic credentials issued directly by your course leaders upon complete course module masteries.
                      </p>

                      {issuedCertificates.length === 0 ? (
                        <div className="text-center py-10 bg-white/40 border border-amber-500/10 rounded-2xl">
                          <CheckCircle className="w-8 h-8 text-amber-500/40 mx-auto mb-2 stroke-1" />
                          <p className="text-xs text-amber-900 font-bold">No issued credentials yet</p>
                          <p className="text-[10px] text-amber-700/60 mt-1 max-w-[180px] mx-auto">Excel on test submissions for verifiable course excellence stamps.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {issuedCertificates.map(cert => (
                            <button
                              key={cert.id}
                              onClick={() => {
                                const temp = cert.template_data ? JSON.parse(cert.template_data) : {};
                                setActiveCertificateModal({
                                  ...cert,
                                  parsedTemplate: temp
                                });
                              }}
                              className="w-full text-left bg-white border border-amber-500/20 p-4 rounded-2xl flex items-center justify-between shadow-sm hover:scale-101 active:scale-99 transition-all cursor-pointer border-l-4 border-l-amber-500"
                            >
                              <div className="min-w-0 flex-1">
                                <strong className="text-xs text-slate-800 block truncate leading-snug font-sans">{cert.course_title}</strong>
                                <span className="text-[9.5px] text-amber-600 block font-mono mt-0.5">{cert.certificate_code}</span>
                              </div>
                              <Plus className="w-4 h-4 text-amber-500 shrink-0 ml-3" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

          {/* ==================== 3. ANALYTICAL METRIC CHARTS ==================== */}
          {trackerTab === 'charts' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              {/* Study Hours breakdown */}
              <div className="bg-white rounded-3xl border border-border p-6 shadow-soft flex flex-col justify-between min-h-[380px]">
                <div className="pb-4 border-b border-gray-100 mb-6">
                  <h3 className="text-sm font-black uppercase tracking-wider text-text-main font-display">Study Hours Distribution</h3>
                  <p className="text-text-muted text-xs mt-0.5">Focus minutes completed across dynamic learning paths.</p>
                </div>
                
                {studyHoursBySubjectData().length === 0 ? (
                  <div className="flex-grow flex flex-col items-center justify-center text-gray-400 text-xs py-20">
                    <Activity className="w-8 h-8 text-gray-300 stroke-1 mb-2 animate-pulse" />
                    <span>Focus log values require timer completions to compile analytics graphs.</span>
                  </div>
                ) : (
                  <div className="w-full h-64 shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={studyHoursBySubjectData()}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={9} tickLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} />
                        <Tooltip />
                        <Bar dataKey="Minutes" radius={[8, 8, 0, 0]}>
                          {studyHoursBySubjectData().map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Cumulative GPA Trends */}
              <div className="bg-white rounded-3xl border border-border p-6 shadow-soft flex flex-col justify-between min-h-[380px]">
                <div className="pb-4 border-b border-gray-100 mb-6">
                  <h3 className="text-sm font-black uppercase tracking-wider text-text-main font-display">GPA Progression Line</h3>
                  <p className="text-text-muted text-xs mt-0.5">Average grades trend charting historical evaluations.</p>
                </div>

                <div className="w-full h-64 shrink-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timelinePerformanceData}>
                      <defs>
                        <linearGradient id="gradegpa" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.01}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="week" stroke="#94a3b8" fontSize={9} tickLine={false} />
                      <YAxis domain={[2.0, 4.0]} stroke="#94a3b8" fontSize={9} tickLine={false} />
                      <Tooltip />
                      <Area type="monotone" dataKey="GPA" stroke="#8b5cf6" strokeWidth={2.5} fillOpacity={1} fill="url(#gradegpa)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>
          )}

          {/* ==================== 4. AI STUDY ADVISOR COUNSELOR ==================== */}
          {trackerTab === 'advisor' && (
            <div className="max-w-4xl mx-auto bg-slate-950 text-white rounded-[2.5rem] p-8 border border-slate-800 shadow-2xl relative overflow-hidden min-h-[460px]">
              
              {/* Vibe lines in background */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/5 rounded-full blur-[90px] -mr-40 -mt-20 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-red-500/5 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

              <div className="relative z-10 flex flex-col h-full justify-between gap-6">
                
                {/* Header info */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 pb-6 border-b border-slate-900">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1 px-3 bg-purple-500/10 border border-purple-500/20 text-purple-400 font-sans uppercase tracking-[0.2em] text-[9px] rounded-full">Gemini Intelligent Guidance</span>
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <h2 className="text-2xl font-display font-black tracking-tight text-slate-100 uppercase">Consult AI Academic Counselor</h2>
                    <p className="text-slate-400 text-xs font-medium max-w-lg leading-relaxed mt-1">
                      Our secure deep learning agent parses your entire course load, quiz scores, and focus session intervals dynamically to deliver custom strategic counseling summaries.
                    </p>
                  </div>

                  <button
                    onClick={handleQueryAdvisor}
                    disabled={requestingAdvice}
                    className="md:self-center h-12 bg-gradient-to-r from-purple-600 to-red-500 hover:from-purple-700 hover:to-red-600 text-white px-6 font-bold text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 shadow-lg cursor-pointer max-w-[240px]"
                  >
                    {requestingAdvice ? (
                      <>
                        <RotateCcw className="w-4 h-4 animate-spin border-0" />
                        <span>Gathering metrics...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        <span>Run Academic Diagnostic</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Response area */}
                <div className="flex-grow min-h-[220px] bg-slate-950/80 border border-slate-900 rounded-2xl p-6 overflow-y-auto max-h-[400px] leading-relaxed relative selection:bg-purple-600/30">
                  {requestingAdvice ? (
                    <div className="space-y-4 py-8 text-center text-slate-400 text-xs">
                      <Activity className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-2" />
                      <p className="font-semibold uppercase tracking-wider">Evaluating student index files...</p>
                      <p className="text-[10px] text-slate-500">Retrieving course grades and building customized Pomodoro focus intervals.</p>
                    </div>
                  ) : advisorAdvice ? (
                    <div className="prose prose-invert prose-xs max-w-none text-slate-200">
                      {/* Splitting Markdown sections into custom visuals */}
                      {advisorAdvice.split('##').map((sect, secIndex) => {
                        if (secIndex === 0 && !sect.includes('##')) {
                          return <p key={secIndex} className="text-slate-300 font-semibold mb-4 italic leading-relaxed text-xs">{sect}</p>;
                        }
                        const firstLineEnd = sect.indexOf('\n');
                        const header = sect.substring(0, firstLineEnd).trim();
                        const content = sect.substring(firstLineEnd).trim();

                        return (
                          <div key={secIndex} className="mb-6 bg-slate-900/40 p-5 rounded-2xl border border-slate-850/60 shadow-sm">
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-red-400 font-black tracking-wider block text-xs uppercase mb-2 font-display">{header}</span>
                            <p className="whitespace-pre-line text-slate-300 text-xs font-sans leading-relaxed">{content}</p>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-center py-12 text-slate-500 text-xs font-medium">
                      <MessageSquare className="w-10 h-10 text-slate-700 stroke-1 mb-2.5" />
                      <p className="font-semibold text-slate-400">Your Advisor Session is ready to initiate.</p>
                      <p className="max-w-xs text-[11px] mt-1 text-slate-500">Click the button above to authorize the AI Study Advisor to analyze your academic diagnostic profile.</p>
                    </div>
                  )}
                </div>

              </div>

            </div>
          )}

        </motion.div>
      </AnimatePresence>

      {/* ==================== INDIVIDUAL MODALS & GRADE FORMS ==================== */}
      
      {/* 1. TEACHER EVALUATION OVERLAY / GRADING FORM */}
      <AnimatePresence>
        {gradingSubmission && (
          <div className="fixed inset-0 z-[600] bg-gray-950/70 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-3xl p-8 max-w-xl w-full shadow-2xl relative overflow-hidden"
            >
              <button 
                onClick={() => setGradingSubmission(null)}
                className="absolute top-6 right-6 p-2 rounded-xl hover:bg-slate-100 text-zinc-400 hover:text-zinc-700 transition-colors"
              >
                <X className="w-5 h-5 border-0" />
              </button>

              <div className="mb-6 pb-4 border-b border-gray-100">
                <span className="text-[9px] font-black uppercase tracking-widest text-purple-600 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">Grading Sheet</span>
                <h3 className="text-xl font-display font-black tracking-tight text-gray-950 mt-3">Evaluate Submission</h3>
                <p className="text-xs text-zinc-500">Student: {gradingSubmission.student_name}</p>
              </div>

              {/* Submited paper text box */}
              <div className="bg-slate-50 border border-zinc-150 p-4 rounded-2xl max-h-36 overflow-y-auto mb-6 text-xs text-slate-800 font-sans leading-relaxed">
                <strong className="text-[10px] uppercase block tracking-wider font-bold text-zinc-500 mb-2 font-sans">Uploaded coursework text</strong>
                {gradingSubmission.content}
              </div>

              {/* Submission Grade Form */}
              <form onSubmit={handleApplyGrade} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary block mb-1">Percentage Score (0 - 100)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={gradeScore}
                      onChange={(e) => setGradeScore(e.target.value)}
                      className="w-full bg-slate-50 border border-zinc-250 px-3.5 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary focus:bg-white text-gray-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary block mb-1">Submission status</label>
                    <select
                      value={gradeStatus}
                      onChange={(e: any) => setGradeStatus(e.target.value)}
                      className="w-full bg-slate-50 border border-zinc-250 px-3.5 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary focus:bg-white text-gray-900"
                    >
                      <option value="completed">Completed / Approved</option>
                      <option value="needs_improvement">Needs Improvement</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-text-secondary block mb-1">Qualitative Feedback Notes</label>
                  <textarea
                    required
                    rows={3}
                    placeholder="Provide constructive assessment and specific module review tags..."
                    value={gradeFeedback}
                    onChange={(e) => setGradeFeedback(e.target.value)}
                    className="w-full bg-slate-50 border border-zinc-250 px-3.5 py-2.5 rounded-xl text-xs font-semibold focus:outline-none focus:border-primary focus:bg-white text-gray-900 leading-relaxed font-sans"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submittingGrade}
                  className="w-full h-12 bg-primary hover:bg-primary-hover text-white font-bold text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-purple-200"
                >
                  {submittingGrade ? <span>Saving grading...</span> : (
                    <>
                      <CheckCircle className="w-4 h-4 border-0" />
                      <span>Approve & Apply Grade</span>
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. EXQUISITE MERIT CERTIFICATE VIEW MODAL */}
      <AnimatePresence>
        {activeCertificateModal && (
          <div className="fixed inset-0 z-[600] bg-gray-950/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-stone-50 text-slate-900 rounded-[2rem] p-8 max-w-2xl w-full border-12 border-double border-amber-600 shadow-2xl relative overflow-hidden"
            >
              {/* Gold flourishes */}
              <div className="absolute top-0 left-0 w-32 h-32 border-t-4 border-l-4 border-amber-500/20 -translate-x-4 -translate-y-4 pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-32 h-32 border-b-4 border-r-4 border-amber-500/20 translate-x-4 translate-y-4 pointer-events-none" />

              <button 
                onClick={() => setActiveCertificateModal(null)}
                className="absolute top-6 right-6 p-2 rounded-xl hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
              >
                <X className="w-5 h-5 border-0" />
              </button>

              <div className="text-center py-6 space-y-4 max-w-xl mx-auto selection:bg-amber-100">
                <span className="text-[2.5rem] block leading-none">🎖️</span>
                <span className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600 font-sans block mt-2">LibraryCore Elite LMS</span>
                
                <h3 className="text-2xl font-serif font-bold text-stone-900 italic tracking-tight">
                  Certificate of Academic Distinction
                </h3>
                
                <div className="w-24 h-0.5 bg-amber-500 mx-auto" />

                <p className="text-xs font-serif text-stone-500 italic leading-relaxed mt-4">
                  This international credential verifies that our esteemed candidate student
                </p>

                <h4 className="text-2xl font-display font-black tracking-tight text-slate-800 uppercase italic">
                  {activeCertificateModal.student_name || user.fullName}
                </h4>

                <p className="text-xs font-serif text-stone-500 italic max-w-md mx-auto leading-relaxed">
                  has completed full module requirements, quiz sessions, and peer lectures inside the curriculum of
                </p>

                <strong className="text-lg font-display font-black text-slate-900 block tracking-tight uppercase leading-none">
                  {activeCertificateModal.course_title}
                </strong>

                <p className="text-[10px] font-mono text-stone-400 mt-2 block">
                  Credential hash: {activeCertificateModal.certificate_code}
                </p>

                {/* Bottom Signature section resembling traditional letters of merit */}
                <div className="grid grid-cols-2 gap-8 pt-8 border-t border-stone-200 mt-8 max-w-md mx-auto">
                  <div className="text-center">
                    <span className="font-serif italic text-xs text-stone-800 border-b border-b-stone-300 pb-1.5 block max-w-[140px] mx-auto">
                      {activeCertificateModal.parsedTemplate?.teacher || 'Course Instructor'}
                    </span>
                    <span className="text-[8px] font-black uppercase text-stone-400 tracking-wider mt-1 block">Sponsoring Instructor</span>
                  </div>
                  <div className="text-center">
                    <span className="font-serif italic text-xs text-stone-800 border-b border-b-stone-300 pb-1.5 block max-w-[140px] mx-auto">
                      {activeCertificateModal.parsedTemplate?.date || new Date().toLocaleDateString()}
                    </span>
                    <span className="text-[8px] font-black uppercase text-stone-400 tracking-wider mt-1 block">Date of Attainment</span>
                  </div>
                </div>

                <div className="pt-6">
                  <button
                    onClick={() => {
                      alert("📥 Preparing verifiable PDF certificate file payload...");
                      window.print();
                    }}
                    className="h-10 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white px-6 font-bold text-[10px] uppercase tracking-wider rounded-xl inline-flex items-center gap-2 shadow-md cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" /> Print Credential
                  </button>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
