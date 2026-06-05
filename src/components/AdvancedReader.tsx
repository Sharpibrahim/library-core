import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import { useInView } from 'react-intersection-observer';
import { 
  X, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Search, 
  Bookmark, 
  MessageSquare, 
  Highlighter, 
  Layout, 
  PanelLeft, 
  PanelRight, 
  Bot, 
  Download, 
  Sun, 
  Moon,
  FileText,
  List,
  Loader2,
  Sparkles,
  Type,
  CheckCircle2,
  User as UserIcon,
  Printer,
  RotateCw,
  Plus,
  Trash2,
  Trophy,
  RefreshCw,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getGeminiResponse } from '../services/gemini';
import { Resource, User } from '../types';
import { SharpAIChat } from './SharpAIChat';
import { getSubjectCover } from '../constants/subjectImages';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  onSnapshot, 
  collection, 
  query, 
  doc, 
  getDoc, 
  setDoc, 
  where, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../firebase';

import 'react-pdf/dist/Page/TextLayer.css';
import 'react-pdf/dist/Page/AnnotationLayer.css';

// Set up the worker securely using the exact matching version of PDF.js
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface AdvancedReaderProps {
  resource: Resource;
  user: User;
  onClose: () => void;
  onDelete?: (id: string) => void;
}

interface Annotation {
  id: string;
  page: number;
  text: string;
  type: 'highlight' | 'note';
  color?: string;
  comment?: string;
  timestamp: number;
}

export function AdvancedReader({ resource, user, onClose, onDelete }: AdvancedReaderProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRightPanelOpen, setIsRightPanelOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'thumbnails' | 'toc' | 'bookmarks' | 'manage'>('thumbnails');
  const [videoChapters, setVideoChapters] = useState<{ time: string; title: string, seconds: number }[]>([
    { time: '0:00', title: 'Introduction to Concepts', seconds: 0 },
    { time: '2:15', title: 'Core Methodology', seconds: 135 },
    { time: '5:40', title: 'Data Analysis & Results', seconds: 340 },
    { time: '8:20', title: 'Conclusion & Next Steps', seconds: 500 },
  ]);
  const [rightPanelTab, setRightPanelTab] = useState<'ai' | 'notes' | 'highlights'>('ai');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('library-theme') as 'light' | 'dark') || 'light';
  });
  const [annotations, setAnnotations] = useState<Annotation[]>(() => {
    const saved = localStorage.getItem(`annotations-${resource.id}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [bookmarks, setBookmarks] = useState<number[]>(() => {
    const saved = localStorage.getItem(`bookmarks-${resource.id}`);
    return saved ? JSON.parse(saved) : [];
  });
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<{questions: any[], currentQuestion: number, score: number, finished: boolean} | null>(null);
  const [isOfflineReady, setIsOfflineReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [newNote, setNewNote] = useState('');
  const [isNotesLoading, setIsNotesLoading] = useState(false);
  const [pageTextCache, setPageTextCache] = useState<Record<number, string>>({});

  const isVideo = resource.type?.toLowerCase() === 'video' || 
                  resource.fileUrl?.includes('youtube.com') || 
                  resource.fileUrl?.includes('youtu.be') ||
                  resource.fileUrl?.toLowerCase().split('?')[0].endsWith('.mp4');
  const isPDF = resource.type?.toLowerCase() === 'pdf' || 
                resource.fileUrl?.toLowerCase().split('?')[0].endsWith('.pdf');

  useEffect(() => {
    const checkFile = async () => {
      if (!resource.fileUrl || isVideo) return;
      
      // If it's not explicitly a PDF by type, but ends with .pdf, we treat it as PDF
      if (!isPDF) return;

      try {
        console.log('[Reader] Checking file availability:', resource.fileUrl);
        const response = await fetch(resource.fileUrl, { method: 'HEAD' });
        if (!response.ok) {
          console.warn('[Reader] File check pre-flight returned status (non-blocking):', response.status);
        }
      } catch (err) {
        console.warn('[Reader] Pre-fetch check failed:', err);
      }
    };
    
    setLoadError(null);
    checkFile();
  }, [resource.fileUrl, isVideo, isPDF]);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Reset scroll to top when new resource is opened
    if (containerRef.current) {
      const scrollContainer = containerRef.current.querySelector('main');
      if (scrollContainer) scrollContainer.scrollTop = 0;
    }
    setCurrentPage(1);
    setRotation(0);
    setScale(1.0);
  }, [resource.id]);

  useEffect(() => {
    if (window.innerWidth < 1280) {
      setIsSidebarOpen(false);
      setIsRightPanelOpen(false);
    }
  }, []);

  useEffect(() => {
    const checkCache = async () => {
      if (resource.fileUrl && 'caches' in window) {
        const cache = await caches.open('library-files-cache');
        const response = await cache.match(resource.fileUrl);
        setIsOfflineReady(!!response);
        
        // Auto-cache on first view
        if (!response) {
          try {
            await cache.add(resource.fileUrl);
            setIsOfflineReady(true);
          } catch (e) {
            console.warn('Auto-caching failed:', e);
          }
        }
      }
    };
    checkCache();
  }, [resource.fileUrl]);

  const toggleOffline = async () => {
    if (!resource.fileUrl || !('caches' in window)) return;
    const cache = await caches.open('library-files-cache');
    if (isOfflineReady) {
      await cache.delete(resource.fileUrl);
      setIsOfflineReady(false);
    } else {
      try {
        await cache.add(resource.fileUrl);
        setIsOfflineReady(true);
      } catch (e) {
        console.error('Offline save failed', e);
      }
    }
  };
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        // Subtract sidebar and right panel widths if open
        let width = containerRef.current.clientWidth;
        if (isSidebarOpen) width -= 280;
        if (isRightPanelOpen) width -= 520;
        setContainerWidth(width - 40);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, [isSidebarOpen, isRightPanelOpen]);

  // Real-time synchronization of annotations from Firestore
  useEffect(() => {
    if (!user?.uid || !resource?.id) return;

    try {
      const annotationsRef = collection(db, 'users', user.uid, 'annotations');
      const q = query(annotationsRef, where('resourceId', '==', resource.id));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const docsData: Annotation[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          docsData.push({
            id: docSnap.id,
            page: d.page || 1,
            text: d.text || '',
            type: d.type || 'highlight',
            comment: d.comment || '',
            timestamp: d.timestamp || Date.now()
          } as Annotation);
        });
        docsData.sort((a, b) => b.timestamp - a.timestamp);
        setAnnotations(docsData);
        localStorage.setItem(`annotations-${resource.id}`, JSON.stringify(docsData));
      }, (error) => {
        console.warn('Real-time annotations sync failed:', error);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn('Failed to register annotations listener:', e);
    }
  }, [user?.uid, resource?.id]);

  // Real-time synchronization of bookmarks from Firestore
  useEffect(() => {
    if (!user?.uid || !resource?.id) return;

    try {
      const bookmarkDocRef = doc(db, 'users', user.uid, 'bookmarks', resource.id);
      
      const unsubscribe = onSnapshot(bookmarkDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && Array.isArray(data.pages)) {
            setBookmarks(data.pages);
            localStorage.setItem(`bookmarks-${resource.id}`, JSON.stringify(data.pages));
          }
        }
      }, (error) => {
        console.warn('Real-time bookmarks sync failed:', error);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn('Failed to register bookmarks listener:', e);
    }
  }, [user?.uid, resource?.id]);

  // Load remote reading progress on mount or resource change
  useEffect(() => {
    if (!user?.uid || !resource?.id) return;
    
    const loadRemoteProgress = async () => {
      try {
        const docRef = doc(db, 'users', user.uid, 'progress', resource.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const remoteData = docSnap.data();
          if (remoteData?.lastPage) {
            setCurrentPage(remoteData.lastPage);
          }
        }
      } catch (e) {
        console.warn('Failed to load remote progress on start:', e);
      }
    };

    loadRemoteProgress();
  }, [user?.uid, resource?.id]);

  // Sync reading progress to local storage and Firestore
  useEffect(() => {
    if (numPages && currentPage > 0) {
      const progress = {
        resourceId: resource.id,
        lastPage: currentPage,
        totalPages: numPages,
        updatedAt: new Date().toISOString(),
        title: resource.title,
        coverUrl: resource.coverUrl || getSubjectCover(resource.subject),
        author: resource.author
      };
      
      const savedHistory = JSON.parse(localStorage.getItem(`reading-history-${user.uid}`) || '[]');
      const filtered = savedHistory.filter((h: any) => h.resourceId !== resource.id);
      const newHistory = [progress, ...filtered].slice(0, 10);
      localStorage.setItem(`reading-history-${user.uid}`, JSON.stringify(newHistory));

      // Sync progress to Firestore
      if (user?.uid) {
        const syncRemoteProgress = async () => {
          try {
            const docRef = doc(db, 'users', user.uid, 'progress', resource.id);
            await setDoc(docRef, {
              ...progress,
              userId: user.uid
            });
          } catch (e) {
            console.warn('Failed to sync reading progress to Firestore:', e);
          }
        };
        syncRemoteProgress();
      }
    }
  }, [currentPage, numPages, resource, user.uid]);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('library-theme', newTheme);
    const root = window.document.documentElement;
    if (newTheme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
  };

  const toggleBookmark = async () => {
    let newBookmarks: number[] = [];
    if (bookmarks.includes(currentPage)) {
      newBookmarks = bookmarks.filter(p => p !== currentPage);
    } else {
      newBookmarks = [...bookmarks, currentPage].sort((a, b) => a - b);
    }
    setBookmarks(newBookmarks);
    localStorage.setItem(`bookmarks-${resource.id}`, JSON.stringify(newBookmarks));

    if (user?.uid) {
      try {
        const docRef = doc(db, 'users', user.uid, 'bookmarks', resource.id);
        await setDoc(docRef, {
          resourceId: resource.id,
          userId: user.uid,
          pages: newBookmarks
        });
      } catch (err) {
        console.error('Failed to sync bookmarks to Firestore:', err);
      }
    }
  };

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    if (currentPage > 1) {
      setTimeout(() => {
        const pageElement = document.getElementById(`pdf-page-${currentPage}`);
        if (pageElement) {
          pageElement.scrollIntoView({ behavior: 'auto' });
        }
      }, 500);
    }
  };

  const jumpToPage = (page: number) => {
    setCurrentPage(page);
    const pageElement = document.getElementById(`pdf-page-${page}`);
    if (pageElement) {
      pageElement.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // AI Functions
  const askAIAboutPage = async () => {
    setIsAiLoading(true);
    setRightPanelTab('ai');
    const pageCtx = resource.type === 'video' ? 'this video' : `page ${currentPage}`;
    const extractedText = pageTextCache[currentPage] ? `\n\nExtracted Text from ${pageCtx}:\n"${pageTextCache[currentPage].substring(0, 3000)}"` : '';
    const prompt = `Can you explain the key concepts found in ${pageCtx} of "${resource.title}" by ${resource.author}? The genre is ${resource.genre}.${extractedText}`;
    const response = await getGeminiResponse(prompt, `Title: ${resource.title}\nAuthor: ${resource.author}\nDescription: ${resource.description}`);
    setAiInsight(response);
    setIsAiLoading(false);
  };

  const summarizePage = async () => {
    setIsAiLoading(true);
    setRightPanelTab('ai');
    const pageCtx = resource.type === 'video' ? 'this video' : `page ${currentPage}`;
    const extractedText = pageTextCache[currentPage] ? `\n\nExtracted Text from ${pageCtx}:\n"${pageTextCache[currentPage].substring(0, 3000)}"` : '';
    const prompt = `Please provide a concise summary of the themes and information presented in ${pageCtx} of "${resource.title}".${extractedText}`;
    const response = await getGeminiResponse(prompt, `Title: ${resource.title}\nAuthor: ${resource.author}\nDescription: ${resource.description}`);
    setAiInsight(response);
    setIsAiLoading(false);
  };

  const explainContent = async () => {
    setIsAiLoading(true);
    setRightPanelTab('ai');
    const pageCtx = resource.type === 'video' ? 'this video' : `page ${currentPage}`;
    const extractedText = pageTextCache[currentPage] ? `\n\nExtracted Text from ${pageCtx}:\n"${pageTextCache[currentPage].substring(0, 3000)}"` : '';
    const prompt = `Identify and explain any potentially complex academic terms or concepts that might appear in ${pageCtx} of this ${resource.genre} resource titled "${resource.title}".${extractedText}`;
    const response = await getGeminiResponse(prompt, `Title: ${resource.title}\nAuthor: ${resource.author}\nDescription: ${resource.description}`);
    setAiInsight(response);
    setIsAiLoading(false);
  };

  const generateAIQuiz = async () => {
    setIsAiLoading(true);
    setRightPanelTab('ai');
    const pageCtx = resource.type === 'video' ? 'this video' : `page ${currentPage}`;
    const prompt = `Based on the content of ${pageCtx} from "${resource.title}", generate 5 academic multiple choice questions for a student. 
    Format your response EXACTLY as a JSON array of objects:
    [
      {
        "text": "The question...",
        "options": ["A", "B", "C", "D"],
        "correctAnswer": 0,
        "explanation": "Why A is correct..."
      }
    ]
    Only return the JSON. No other text.`;
    
    try {
      const response = await getGeminiResponse(prompt, `Resource: ${resource.title} (${resource.subject})`);
      const cleanJson = response.replace(/```json|```/g, '').trim();
      const questions = JSON.parse(cleanJson);
      setActiveQuiz({
        questions,
        currentQuestion: 0,
        score: 0,
        finished: false
      });
      setAiInsight(null);
    } catch (err) {
      console.error('Quiz generation failed:', err);
      setAiInsight('Failed to generate quiz. Please try again.');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleQuizAnswer = (selectedIndex: number) => {
    if (!activeQuiz) return;
    const isCorrect = selectedIndex === activeQuiz.questions[activeQuiz.currentQuestion].correctAnswer;
    const newScore = isCorrect ? activeQuiz.score + 1 : activeQuiz.score;
    
    if (activeQuiz.currentQuestion + 1 >= activeQuiz.questions.length) {
      setActiveQuiz({ ...activeQuiz, score: newScore, finished: true });
    } else {
      setActiveQuiz({ ...activeQuiz, score: newScore, currentQuestion: activeQuiz.currentQuestion + 1 });
    }
  };

  const handleDeleteAnnotation = async (id: string) => {
    setAnnotations(prev => prev.filter(a => a.id !== id));
    if (user?.uid) {
      try {
        const docRef = doc(db, 'users', user.uid, 'annotations', id);
        await deleteDoc(docRef);
      } catch (e) {
        console.error('Failed to delete annotation:', e);
      }
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const noteId = Date.now().toString();
    const note: Annotation = {
      id: noteId,
      page: currentPage,
      text: '', // Text selection could go here
      type: 'note',
      comment: newNote,
      timestamp: Date.now()
    };
    
    setAnnotations(prev => [note, ...prev.filter(a => a.id !== noteId)]);
    setNewNote('');
    setRightPanelTab('notes');

    if (user?.uid && resource?.id) {
      try {
        const docRef = doc(db, 'users', user.uid, 'annotations', noteId);
        await setDoc(docRef, {
          id: noteId,
          resourceId: resource.id,
          userId: user.uid,
          page: currentPage,
          text: '',
          type: 'note',
          comment: note.comment,
          timestamp: note.timestamp
        });
      } catch (err) {
        console.error('Failed to sync note to Firestore:', err);
      }
    }
  };

  const handleHighlight = async () => {
    const selection = window.getSelection();
    const selectedText = selection ? selection.toString() : '';
    
    const hlId = Date.now().toString();
    const highlight: Annotation = {
      id: hlId,
      page: currentPage,
      text: selectedText || `Page ${currentPage} Highlight`,
      type: 'highlight',
      timestamp: Date.now()
    };
    
    setAnnotations(prev => [highlight, ...prev.filter(a => a.id !== hlId)]);
    setRightPanelTab('highlights');

    if (user?.uid && resource?.id) {
      try {
        const docRef = doc(db, 'users', user.uid, 'annotations', hlId);
        await setDoc(docRef, {
          id: hlId,
          resourceId: resource.id,
          userId: user.uid,
          page: currentPage,
          text: highlight.text,
          type: 'highlight',
          timestamp: highlight.timestamp
        });
      } catch (err) {
        console.error('Failed to sync highlight to Firestore:', err);
      }
    }
  };

  const handlePrint = () => {
    if (resource.fileUrl) {
      const printWindow = window.open(resource.fileUrl, '_blank');
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.print();
        };
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  const rotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const getYoutubeId = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  return (
    <div className={`fixed inset-0 z-[100] flex flex-col transition-colors duration-300 ${theme === 'dark' ? 'bg-[#0F172A] text-[#F8FAFC]' : 'bg-[#F8FAFC] text-[#1E293B]'}`}>
      
      {/* Top Toolbar */}
      <header className={`h-16 flex items-center justify-between px-4 border-b transition-colors ${theme === 'dark' ? 'bg-[#1E293B] border-white/10' : 'bg-white border-border shadow-sm'}`}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-2 rounded-lg transition-colors ${isVideo ? 'hidden' : ''} ${theme === 'dark' ? 'hover:bg-white/5 text-slate-400' : 'hover:bg-primary/5 text-text-muted'}`}
          >
            <PanelLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary-gradient text-white shadow-lg shadow-primary/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm line-clamp-1 tracking-tight">{resource.title}</h2>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{resource.author}</p>
            </div>
          </div>
        </div>

        {!isVideo && (
          <div className="flex items-center gap-2 bg-section p-1 rounded-xl border border-border shadow-inner">
            <button 
              onClick={() => jumpToPage(Math.max(1, currentPage - 1))}
              className="p-1.5 hover:bg-white rounded-lg transition-colors shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-1 px-2">
              <input 
                type="number" 
                value={currentPage}
                onChange={(e) => jumpToPage(parseInt(e.target.value) || 1)}
                className="w-10 bg-transparent text-center text-sm font-bold outline-none text-text-main"
              />
              <span className="text-xs text-text-muted">/ {numPages || '?'}</span>
            </div>
            <button 
              onClick={() => jumpToPage(Math.min(numPages || 1, currentPage + 1))}
              className="p-1.5 hover:bg-white rounded-lg transition-colors shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          {!isVideo && (
            <div className="flex items-center gap-1 bg-section p-1 rounded-xl border border-border shadow-inner">
              <button onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))} className="p-1.5 hover:bg-white rounded-lg shadow-sm" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
              <span className="text-[10px] font-bold w-12 text-center text-text-main">{Math.round(scale * 100)}%</span>
              <button onClick={() => setScale(prev => Math.min(3, prev + 0.1))} className="p-1.5 hover:bg-white rounded-lg shadow-sm" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
            </div>
          )}

          {!isVideo && (
            <div className="flex items-center gap-1 bg-section p-1 rounded-xl border border-border shadow-inner">
              <button onClick={rotate} className="p-1.5 hover:bg-white rounded-lg shadow-sm" title="Rotate"><RotateCw className="w-4 h-4" /></button>
              <button onClick={handlePrint} className="p-1.5 hover:bg-white rounded-lg shadow-sm" title="Print"><Printer className="w-4 h-4" /></button>
              <button onClick={toggleFullscreen} className="p-1.5 hover:bg-white rounded-lg shadow-sm" title="Fullscreen"><Maximize2 className="w-4 h-4" /></button>
            </div>
          )}
          
          {!isVideo && (
            <button 
              onClick={toggleBookmark}
              className={`p-2 rounded-lg transition-all ${bookmarks.includes(currentPage) ? 'text-primary bg-primary/10 shadow-sm' : 'text-text-muted hover:bg-primary/5'}`}
              title="Bookmark Page"
            >
              <Bookmark className="w-5 h-5" fill={bookmarks.includes(currentPage) ? 'currentColor' : 'none'} />
            </button>
          )}

          {!isVideo && (
            <button 
              onClick={handleHighlight}
              className="p-2 rounded-lg text-text-muted hover:bg-primary/5 transition-all"
              title="Highlight Selection"
            >
              <Highlighter className="w-5 h-5" />
            </button>
          )}

          {!isVideo && (
            <a 
              href={resource.fileUrl || '#'} 
              download={resource.title}
              target="_blank"
              rel="noreferrer"
              className="p-2 rounded-lg text-text-muted hover:bg-primary/5 transition-all"
              title="Download Original File"
            >
              <Download className="w-5 h-5" />
            </a>
          )}

          {!isVideo && (
            <button 
              onClick={toggleOffline}
              className={`p-2 rounded-lg transition-all flex items-center gap-2 ${isOfflineReady ? 'text-success bg-success/10 shadow-sm' : 'text-text-muted hover:bg-primary/5'}`}
              title={isOfflineReady ? 'Available Offline' : 'Mark for Offline Mode'}
            >
              {isOfflineReady ? <CheckCircle2 className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
            </button>
          )}

          <button 
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-primary/5 text-text-muted transition-all"
          >
            {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          <div className="w-px h-6 bg-border mx-1" />

          <button 
            onClick={() => setIsRightPanelOpen(!isRightPanelOpen)}
            className={`p-2 rounded-lg transition-all ${isRightPanelOpen ? 'text-primary bg-primary/10 shadow-sm' : 'text-text-muted hover:bg-primary/5'}`}
          >
            <PanelRight className="w-5 h-5" />
          </button>

          {((user.role === 'admin' || user.email === 'sharpibrah@gmail.com' || user.email === 'sharpwhite@gmail.com' || resource.uploadedBy === user.uid) && onDelete) && (
            <button 
              onClick={() => {
                if (confirm('Are you sure you want to delete this resource? This action cannot be undone.')) {
                  onDelete(resource.id);
                  onClose();
                }
              }}
              className="p-2 rounded-lg text-red-500 hover:bg-red-500/10 transition-all"
              title="Delete Resource"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}

          <button 
            onClick={onClose}
            className="p-2 hover:bg-error/10 hover:text-error rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </header>

      <div className="flex-grow flex overflow-hidden relative" ref={containerRef}>
        
        {/* Left Sidebar */}
        {!isVideo && (
          <AnimatePresence>
            {isSidebarOpen && (
              <motion.aside 
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                className={`w-[280px] flex flex-col border-r transition-colors ${theme === 'dark' ? 'bg-[#1E293B] border-white/10' : 'bg-white border-border shadow-sm'}`}
              >
                <div className="flex border-b border-border">
                  <button 
                    onClick={() => setSidebarTab('thumbnails')}
                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${sidebarTab === 'thumbnails' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-slate-500 hover:text-primary hover:bg-primary/5'}`}
                  >
                    Thumbnails
                  </button>
                  <button 
                    onClick={() => setSidebarTab('toc')}
                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${sidebarTab === 'toc' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-slate-500 hover:text-primary hover:bg-primary/5'}`}
                  >
                    Contents
                  </button>
                  <button 
                    onClick={() => setSidebarTab('bookmarks')}
                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${sidebarTab === 'bookmarks' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-slate-500 hover:text-primary hover:bg-primary/5'}`}
                  >
                    Bookmarks
                  </button>
                  <button 
                    onClick={() => setSidebarTab('manage')}
                    className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${sidebarTab === 'manage' ? 'text-red-500 border-b-2 border-red-500 bg-red-50/50' : 'text-slate-500 hover:text-red-500 hover:bg-red-50/50'}`}
                  >
                    Manage
                  </button>
                </div>
                
                <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
                  {sidebarTab === 'thumbnails' ? (
                    <div className="grid grid-cols-2 gap-4">
                      {numPages && Array.from(new Array(numPages), (el, index) => (
                        <div 
                          key={index} 
                          onClick={() => jumpToPage(index + 1)}
                          className={`cursor-pointer group relative rounded-lg overflow-hidden border-2 transition-all ${currentPage === index + 1 ? 'border-primary shadow-lg' : 'border-transparent hover:border-primary/30'}`}
                        >
                          <div className="aspect-[3/4] bg-section flex items-center justify-center">
                            <span className="text-[10px] font-bold text-slate-400 group-hover:text-primary transition-colors">{index + 1}</span>
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-black/60 py-1 text-center">
                            <span className="text-[8px] font-bold text-white uppercase tracking-tighter">Page {index + 1}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : sidebarTab === 'bookmarks' ? (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
                         <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1 font-mono">Study Bookmarks</p>
                         <p className="text-xs text-slate-500 leading-relaxed">Save critical pages to quickly reference and navigate back to them later during studies.</p>
                      </div>
                      
                      <div className="space-y-2">
                        {bookmarks.length > 0 ? (
                          bookmarks.map((page) => (
                            <div 
                              key={page}
                              onClick={() => jumpToPage(page)}
                              className="w-full flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800 border border-border dark:border-white/10 hover:border-primary hover:bg-primary/5 transition-all text-left shadow-sm group cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs flex-shrink-0">
                                    {page}
                                 </div>
                                 <div>
                                    <p className="text-xs font-bold text-text-main">Page {page}</p>
                                    <p className="text-[9px] text-text-muted font-bold uppercase tracking-widest font-mono">Bookmarked</p>
                                 </div>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setBookmarks(bookmarks.filter(p => p !== page));
                                }}
                                className="p-2 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-colors flex-shrink-0"
                                title="Delete Bookmark"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))
                        ) : (
                          <div className="text-center py-10 space-y-3">
                             <div className="w-12 h-12 rounded-full bg-section flex items-center justify-center mx-auto">
                               <Bookmark className="w-6 h-6 text-slate-400" />
                             </div>
                             <p className="text-xs text-slate-500">No bookmarks on this document yet.</p>
                             <p className="text-[10px] text-slate-400">Click the bookmark icon in the top header to save the current page.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : sidebarTab === 'manage' ? (
                    <div className="space-y-6">
                       <div className="p-4 bg-red-50/50 rounded-2xl border border-red-100 mb-6">
                          <p className="text-[10px] font-black text-red-600 uppercase tracking-widest mb-2">Danger Zone</p>
                          <p className="text-xs font-medium text-slate-600 leading-relaxed">Actions performed here cannot be reversed. Use with caution.</p>
                       </div>
                       
                       <div className="space-y-3">
                         <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 px-1">Resource Actions</h4>
                         
                         <a 
                           href={resource.fileUrl} 
                           target="_blank" 
                           rel="noreferrer"
                           className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-border hover:border-primary hover:bg-primary/5 transition-all text-left shadow-sm group"
                         >
                            <div className="w-8 h-8 rounded-lg bg-section flex items-center justify-center text-text-muted group-hover:text-primary transition-colors">
                               <Download className="w-4 h-4" />
                            </div>
                            <div>
                               <p className="text-xs font-bold text-text-main">Download File</p>
                               <p className="text-[9px] font-bold text-text-muted uppercase">Original Source</p>
                            </div>
                         </a>

                         {((user.role === 'admin' || user.email === 'sharpibrah@gmail.com' || user.email === 'sharpwhite@gmail.com' || resource.uploadedBy === user.uid) && onDelete) && (
                           <button 
                             onClick={() => {
                               if (confirm('Are you sure you want to permanently delete this PDF? This action is instant and cannot be undone.')) {
                                 onDelete(resource.id);
                                 onClose();
                               }
                             }}
                             className="w-full flex items-center gap-3 p-3 rounded-xl bg-white border border-red-100 hover:border-red-500 hover:bg-red-50 transition-all text-left shadow-sm group"
                           >
                              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all duration-300">
                                 <Trash2 className="w-4 h-4" />
                              </div>
                              <div>
                                 <p className="text-xs font-bold text-red-600">Delete Permanently</p>
                                 <p className="text-[9px] font-bold text-red-400 uppercase">Remove from Library</p>
                              </div>
                           </button>
                         )}
                       </div>

                       <div className="pt-6 border-t border-border mt-6">
                         <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3 px-1">System Info</h4>
                         <div className="space-y-2 px-1">
                           <div className="flex justify-between text-[10px] font-medium text-slate-500">
                             <span>Resource ID:</span>
                             <span className="font-mono">{resource.id}</span>
                           </div>
                           <div className="flex justify-between text-[10px] font-medium text-slate-500">
                             <span>Storage Mode:</span>
                             <span>{isNaN(Number(resource.id)) ? 'Cloud (Firestore)' : 'Local (SQLite)'}</span>
                           </div>
                         </div>
                       </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500 italic">Table of contents not available for this document.</p>
                    </div>
                  )}
                </div>
              </motion.aside>
            )}
          </AnimatePresence>
        )}

        {/* Main Viewer */}
        <main className="flex-grow overflow-y-auto bg-[#F8FAFC] p-4 sm:p-8 custom-scrollbar relative flex flex-col items-center">
          {loadError ? (
            <div className="text-center p-12 bg-white rounded-[2rem] border border-red-100 shadow-xl max-w-md mx-auto my-12">
              <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center text-red-500 mx-auto mb-6">
                 <X className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-text-main mb-2">Could Not Open PDF</h3>
              <p className="text-sm text-text-muted mb-8 leading-relaxed">
                {loadError}
              </p>
              
              <div className="space-y-3">
                <a 
                  href={resource.fileUrl} 
                  target="_blank" 
                  rel="noreferrer"
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" /> Try Opening Traditionally
                </a>
                
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full py-3 bg-section text-text-main rounded-xl font-bold text-sm hover:bg-white transition-all"
                >
                  Reload Application
                </button>
                
                <button 
                  onClick={onClose}
                  className="w-full py-3 text-text-muted rounded-xl font-bold text-sm hover:bg-section transition-all"
                >
                  Go Back
                </button>
              </div>
            </div>
          ) : isVideo ? (
            <div className="flex-grow flex items-center justify-center w-full h-full">
              <div className="w-full max-w-5xl aspect-video rounded-[2rem] overflow-hidden shadow-2xl border-4 border-white bg-black">
                <iframe
                  src={`https://www.youtube.com/embed/${getYoutubeId(resource.fileUrl || '')}`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          ) : isPDF ? (
            <div className="max-w-full mx-auto flex flex-col items-center">
              <Document
                file={resource.fileUrl}
                onLoadSuccess={onDocumentLoadSuccess}
                onLoadError={(error) => {
                  console.error('PDF Load Error:', error);
                  setLoadError(error.message);
                }}
                loading={
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="w-10 h-10 animate-spin text-primary" />
                    <p className="text-sm font-medium animate-pulse">Loading Document...</p>
                  </div>
                }
              >
                {numPages && Array.from(new Array(numPages), (el, index) => (
                  <PageItem 
                    key={index + 1}
                    pageNumber={index + 1}
                    width={containerWidth * scale}
                    rotate={rotation}
                    onVisible={() => setCurrentPage(index + 1)}
                    onTextExtracted={(text) => {
                      setPageTextCache(prev => ({ ...prev, [index + 1]: text }));
                    }}
                  />
                ))}
              </Document>
            </div>
          ) : (
            <div className="text-center p-12 bg-white rounded-[2rem] border border-border shadow-xl max-w-md mx-auto">
              <div className="w-16 h-16 bg-section rounded-2xl flex items-center justify-center text-primary mx-auto mb-6">
                 <FileText className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-text-main mb-2">{resource.title}</h3>
              <p className="text-sm text-text-muted mb-8 leading-relaxed">
                This resource is an {resource.type || 'article'}. Standard PDF viewing is not available, but you can use the AI assistant on the right to discuss its content.
              </p>
              <button 
                onClick={onClose}
                className="btn-primary w-full py-3"
              >
                Close Reader
              </button>
            </div>
          )}
        </main>

        {/* Right Panel */}
        <AnimatePresence>
          {isRightPanelOpen && (
            <motion.aside 
              initial={{ x: 520 }}
              animate={{ x: 0 }}
              exit={{ x: 520 }}
              className={`w-[520px] flex flex-col border-l transition-colors ${theme === 'dark' ? 'bg-[#1E293B] border-white/10' : 'bg-white border-border shadow-sm'}`}
            >
              <div className="flex border-b border-border">
                {[
                  { id: 'ai', icon: Bot, label: 'AI' },
                  { id: 'notes', icon: MessageSquare, label: 'Notes' },
                  { id: 'highlights', icon: Highlighter, label: 'Marks' }
                ].map(tab => (
                  <button 
                    key={tab.id}
                    onClick={() => setRightPanelTab(tab.id as any)}
                    className={`flex-1 py-4 flex flex-col items-center gap-1 transition-colors ${rightPanelTab === tab.id ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-slate-500 hover:text-primary hover:bg-primary/5'}`}
                  >
                    <tab.icon className="w-4 h-4" />
                    <span className="text-[8px] font-bold uppercase tracking-widest">{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="flex-grow overflow-y-auto custom-scrollbar">
                {rightPanelTab === 'ai' ? (
                  <div className="h-full flex flex-col">
                    <div className="p-6 border-b border-border bg-primary/5">
                      <div className="flex items-center gap-2 mb-3">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <h3 className="font-bold text-sm tracking-tight">Study Assistant</h3>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <button onClick={summarizePage} className="w-full text-left px-3 py-2 rounded-xl bg-white border border-border text-[10px] font-bold hover:border-primary hover:text-primary transition-all flex items-center gap-2 shadow-sm">
                          <List className="w-3 h-3 text-primary" /> Summarize Current Page
                        </button>
                        <button onClick={explainContent} className="w-full text-left px-3 py-2 rounded-xl bg-white border border-border text-[10px] font-bold hover:border-primary hover:text-primary transition-all flex items-center gap-2 shadow-sm">
                          <Type className="w-3 h-3 text-secondary" /> Explain Complex Terms
                        </button>
                        <button onClick={askAIAboutPage} className="w-full text-left px-4 py-3 rounded-xl bg-white border border-border text-[10px] font-bold hover:border-primary hover:text-primary transition-all flex items-center gap-2 shadow-sm">
                          <div className="w-4 h-4 bg-primary/5 rounded flex items-center justify-center">
                            <img src="/logo.png" alt="" className="w-3 h-3 object-contain" />
                          </div>
                          Ask AI about this page
                        </button>
                        <button onClick={generateAIQuiz} className="w-full text-left px-3 py-2 rounded-xl bg-primary text-white text-[10px] font-bold hover:bg-primary-dark transition-all flex items-center gap-2 shadow-lg shadow-primary/20">
                          <Trophy className="w-3 h-3" /> Test Me: Generate Quiz
                        </button>
                      </div>
                    </div>
                    <div className="flex-grow p-4 relative">
                      {isAiLoading && (
                        <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
                          <Loader2 className="w-8 h-8 animate-spin text-primary" />
                          <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">AI is analyzing...</p>
                        </div>
                      )}
                      
                      {activeQuiz ? (
                         <div className="h-full flex flex-col p-4 bg-white rounded-3xl border border-border shadow-soft">
                            {activeQuiz.finished ? (
                               <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-grow flex flex-col items-center justify-center text-center p-6">
                                  <div className="w-20 h-20 bg-success-gradient rounded-full flex items-center justify-center text-white mb-6 shadow-xl">
                                     <Trophy className="w-10 h-10" />
                                  </div>
                                  <h3 className="text-xl font-display font-black text-text-main mb-2">Quiz Completed!</h3>
                                  <p className="text-sm text-text-secondary mb-6">Your Academic Score: <span className="text-primary font-bold">{activeQuiz.score}/{activeQuiz.questions.length}</span></p>
                                  <div className="space-y-3 w-full">
                                    <button 
                                      onClick={() => generateAIQuiz()}
                                      className="w-full py-4 bg-primary text-white rounded-2xl font-bold text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                                    >
                                      <RefreshCw className="w-4 h-4" /> Try Different Questions
                                    </button>
                                    <button 
                                      onClick={() => setActiveQuiz(null)}
                                      className="w-full py-4 bg-section text-text-main rounded-2xl font-bold text-xs uppercase tracking-widest"
                                    >
                                      Back to Chat
                                    </button>
                                  </div>
                               </motion.div>
                            ) : (
                               <div className="flex flex-col h-full">
                                  <div className="flex justify-between items-center mb-6">
                                     <span className="text-[10px] font-black text-primary uppercase tracking-widest">Question {activeQuiz.currentQuestion + 1} of {activeQuiz.questions.length}</span>
                                     <button onClick={() => setActiveQuiz(null)} className="text-text-muted"><X className="w-4 h-4" /></button>
                                  </div>
                                  <h4 className="text-sm font-bold text-text-main mb-8 leading-relaxed">
                                     {activeQuiz.questions[activeQuiz.currentQuestion].text}
                                  </h4>
                                  <div className="space-y-3 flex-grow">
                                     {activeQuiz.questions[activeQuiz.currentQuestion].options.map((option: string, i: number) => (
                                        <button 
                                          key={i}
                                          onClick={() => handleQuizAnswer(i)}
                                          className="w-full p-4 text-left bg-section border border-border hover:border-primary hover:bg-primary/5 rounded-2xl text-xs font-medium transition-all group flex items-center gap-4"
                                        >
                                           <div className="w-8 h-8 rounded-xl bg-white border border-border flex items-center justify-center font-bold text-[10px] group-hover:text-primary transition-colors">
                                              {String.fromCharCode(65 + i)}
                                           </div>
                                           {option}
                                        </button>
                                     ))}
                                  </div>
                                  <div className="mt-6 p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center gap-3">
                                     <HelpCircle className="w-4 h-4 text-primary" />
                                     <p className="text-[10px] font-medium text-text-secondary leading-tight italic">AI is generating these questions based on your current view to test understanding.</p>
                                  </div>
                               </div>
                            )}
                         </div>
                      ) : aiInsight ? (
                        <div className="h-full flex flex-col gap-4">
                          <div className="glass-card p-6 bg-white border border-primary/20 overflow-y-auto max-h-[500px] custom-scrollbar shadow-2xl ring-1 ring-black/5">
                            <div className="flex justify-between items-center mb-4">
                              <div className="flex items-center gap-2">
                                <div className="w-5 h-5 bg-primary/5 rounded flex items-center justify-center">
                                  <img src="/logo.png" alt="" className="w-3 h-3 object-contain" />
                                </div>
                                <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mt-0.5">AI Insight • Page {currentPage}</span>
                              </div>
                              <button 
                                onClick={() => setAiInsight(null)}
                                className="text-[8px] font-bold text-text-muted hover:text-text-main uppercase tracking-widest"
                              >
                                Clear
                              </button>
                            </div>
                            <div className="prose prose-sm dark:prose-invert max-w-none text-text-main leading-relaxed">
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {aiInsight}
                              </ReactMarkdown>
                            </div>
                          </div>
                          <div className="flex-grow">
                            <SharpAIChat user={user} resourceId={resource.id} className="h-full border-none shadow-none bg-transparent" />
                          </div>
                        </div>
                      ) : (
                        <SharpAIChat user={user} resourceId={resource.id} className="h-full border-none shadow-none bg-transparent" />
                      )}
                    </div>
                  </div>
                ) : rightPanelTab === 'notes' ? (
                  <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-sm">My Study Notes</h3>
                    </div>

                    <div className="space-y-3 p-4 rounded-2xl bg-primary/5 border border-primary/20">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">Add Note to Page {currentPage}</p>
                      <textarea 
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        placeholder="Type your study insights here..."
                        className="w-full bg-transparent border-none focus:ring-0 text-xs font-medium resize-none min-h-[100px] text-text-main p-0"
                      />
                      <button 
                        onClick={handleAddNote}
                        disabled={!newNote.trim()}
                        className="w-full py-3 bg-primary text-white rounded-xl text-[10px] font-bold uppercase tracking-widest disabled:opacity-50 transition-all flex items-center justify-center gap-2"
                      >
                        <Plus className="w-3 h-3" /> Save Note
                      </button>
                    </div>

                    <div className="space-y-4">
                      {annotations.filter(a => a.type === 'note').length > 0 ? (
                        annotations.filter(a => a.type === 'note').sort((a, b) => b.timestamp - a.timestamp).map(note => (
                          <div 
                            key={note.id} 
                            onClick={() => jumpToPage(note.page)}
                            className="p-4 rounded-2xl bg-section border border-border shadow-sm group hover:border-primary transition-all cursor-pointer"
                          >
                            <div className="flex justify-between items-center mb-3">
                              <div className="flex items-center gap-2">
                                 <div className="w-5 h-5 rounded-full bg-primary/20 border border-primary/20 flex items-center justify-center">
                                    <UserIcon className="w-3 h-3 text-primary" />
                                 </div>
                                 <span className="text-[8px] font-black text-text-muted uppercase tracking-widest">Page: {note.page}</span>
                              </div>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAnnotation(note.id);
                                }}
                                className="text-error opacity-60 hover:opacity-100 transition-opacity p-1 hover:bg-red-500/10 rounded-lg flex items-center justify-center"
                              >
                                <Trash2 className="w-3" />
                              </button>
                            </div>
                            <p className="text-xs font-medium leading-relaxed text-text-main">"{note.comment}"</p>
                            <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                               <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">{new Date(note.timestamp).toLocaleTimeString()}</span>
                               <span className="text-[8px] font-black text-primary uppercase tracking-widest">View Context</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10 space-y-3">
                          <div className="w-12 h-12 rounded-full bg-section flex items-center justify-center mx-auto">
                            <MessageSquare className="w-6 h-6 text-slate-400" />
                          </div>
                          <p className="text-xs text-slate-500">No notes yet. Select text to add a note.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 space-y-6">
                    <div className="flex items-center justify-between">
                       <h3 className="font-bold text-sm">My Study Marks</h3>
                       <button 
                         onClick={handleHighlight}
                         className="flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-lg hover:shadow-primary/30 transition-all"
                       >
                         <Highlighter className="w-3 h-3" /> Add Mark
                       </button>
                    </div>

                    <div className="space-y-4">
                      {annotations.filter(a => a.type === 'highlight').length > 0 ? (
                        annotations.filter(a => a.type === 'highlight').sort((a, b) => b.timestamp - a.timestamp).map(hl => (
                          <div 
                            key={hl.id} 
                            onClick={() => jumpToPage(hl.page)}
                            className="p-4 rounded-2xl border-l-4 border-primary bg-primary/5 shadow-sm hover:bg-primary/10 transition-all cursor-pointer group"
                          >
                            <div className="flex justify-between items-center mb-2">
                               <span className="text-[8px] font-bold text-primary uppercase tracking-widest block">Page {hl.page}</span>
                               <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteAnnotation(hl.id);
                                }}
                                className="text-error opacity-60 hover:opacity-100 transition-opacity p-1 hover:bg-red-500/10 rounded-lg flex items-center justify-center"
                              >
                                <Trash2 className="w-3" />
                              </button>
                            </div>
                            <p className="text-xs italic leading-relaxed line-clamp-3">"{hl.text}"</p>
                            <div className="mt-2 flex justify-end">
                               <span className="text-[8px] font-black text-primary uppercase tracking-widest">Jump to Mark</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10 space-y-3">
                          <div className="w-12 h-12 rounded-full bg-section flex items-center justify-center mx-auto">
                            <Highlighter className="w-6 h-6 text-slate-400" />
                          </div>
                          <p className="text-xs text-slate-500">No highlights yet. Select text to highlight.</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Progress Bar */}
      <div className="h-1 bg-slate-200 dark:bg-white/5">
        <motion.div 
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${(currentPage / (numPages || 1)) * 100}%` }}
        />
      </div>
    </div>
  );
}

function PageItem({ pageNumber, width, onVisible, rotate, onTextExtracted }: { pageNumber: number; width: number; onVisible: () => void; rotate: number; onTextExtracted?: (text: string) => void }) {
  const { ref, inView } = useInView({
    threshold: 0.1, // Trigger earlier for smoother scrolling
    triggerOnce: false,
    rootMargin: '200px 0px' // Load pages slightly before they enter the viewport
  });

  useEffect(() => {
    if (inView) onVisible();
  }, [inView, onVisible]);

  return (
    <div ref={ref} id={`pdf-page-${pageNumber}`} className="mb-12 shadow-[0_12px_24px_rgba(15,23,42,0.1)] bg-white">
      {inView ? (
        <Page 
          pageNumber={pageNumber}
          width={width}
          rotate={rotate}
          renderTextLayer={true}
          renderAnnotationLayer={true}
          onLoadSuccess={async (page) => {
            if (onTextExtracted) {
              try {
                const textContent = await page.getTextContent();
                const text = textContent.items.map((item: any) => item.str).join(' ');
                onTextExtracted(text);
              } catch (err) {
                console.error("Failed to extract page text", err);
              }
            }
          }}
          loading={
            <div style={{ width, height: width * 1.41 }} className="bg-white flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Rendering Page {pageNumber}...</span>
            </div>
          }
        />
      ) : (
        <div 
          style={{ width, height: width * 1.41 }} 
          className="bg-white flex flex-col items-center justify-center gap-2 border border-slate-100 dark:border-white/5"
        >
          <div className="w-10 h-10 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center">
            <span className="text-xs font-bold text-slate-300">{pageNumber}</span>
          </div>
          <span className="text-[8px] font-bold text-slate-300 uppercase tracking-widest">Scroll to load</span>
        </div>
      )}
    </div>
  );
}
