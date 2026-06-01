import React, { useState, useEffect } from 'react';
import { 
  Filter, 
  Grid, 
  List, 
  Search, 
  X, 
  BookOpen, 
  Star, 
  Clock, 
  ChevronDown,
  LayoutGrid,
  LayoutList,
  FileText,
  PlayCircle,
  GraduationCap,
  ClipboardList,
  Layers,
  Sparkles,
  SearchCode,
  ArrowRight,
  TrendingUp,
  Award,
  BookMarked,
  Shapes,
  Brain,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Resource, User, StudySet } from '../types';
import { ResourceCard } from './ResourceCard';
import { getGeminiResponse } from '../services/gemini';
import { getSubjectCover } from '../constants/subjectImages';
import { db } from '../firebase';
import { onSnapshot, collection, query, orderBy, where, deleteDoc, doc, addDoc } from 'firebase/firestore';

interface LibraryViewProps {
  resources: Resource[];
  user: User;
  onRead: (resource: Resource) => void;
  onDelete: (id: string) => void;
  externalSearchQuery?: string;
  setSearchQuery: (query: string) => void;
  createNotification?: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

const MAIN_CATEGORIES = [
  { id: 'all', label: 'All Resources', icon: Layers, color: 'bg-primary/10 text-primary', borderColor: 'border-primary/20' },
  { id: 'studyset', label: 'Study Sets', icon: Shapes, color: 'bg-purple-500/10 text-purple-600', borderColor: 'border-purple-500/20' },
  { id: 'book', label: 'Core Textbooks', icon: BookOpen, color: 'bg-blue-500/10 text-blue-600', borderColor: 'border-blue-500/20' },
  { id: 'pastpaper', label: 'Past Papers', icon: FileText, color: 'bg-orange-500/10 text-orange-600', borderColor: 'border-orange-500/20' },
  { id: 'video', label: 'Videos', icon: PlayCircle, color: 'bg-red-500/10 text-red-600', borderColor: 'border-red-500/20' },
  { id: 'subject', label: 'Subjects', icon: GraduationCap, color: 'bg-blue-500/10 text-blue-600', borderColor: 'border-blue-500/20' },
  { id: 'note', label: 'Expert Notes', icon: ClipboardList, color: 'bg-emerald-500/10 text-emerald-600', borderColor: 'border-emerald-500/20' },
];

const GENRES = [
  'All Genres',
  'Science',
  'Mathematics',
  'History',
  'Literature',
  'Technology',
  'Art',
  'Philosophy'
];

const CLASS_LEVELS = ['All Levels', 'S1', 'S2', 'S3', 'S4', 'S5', 'S6'];

export function LibraryView({ resources, user, onRead, onDelete, externalSearchQuery = '', setSearchQuery, createNotification }: LibraryViewProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeMainCategory, setActiveMainCategory] = useState('all');
  const [selectedGenre, setSelectedGenre] = useState('All Genres');
  const [selectedClass, setSelectedClass] = useState('All Levels');
  const [internalSearchQuery, setInternalSearchQuery] = useState('');
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiSearchResults, setAiSearchResults] = useState<string[] | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [studySets, setStudySets] = useState<StudySet[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'study_sets'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const sets = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StudySet));
      
      // If we have no study sets in Firestore yet, add the default ones
      if (sets.length === 0 && user.role === 'admin') {
        const defaultSets = [
          {
            title: 'S4 Physics Final Prep',
            description: 'The ultimate collection of past papers and expert notes for S4 candidates.',
            subject: 'Physics',
            creatorId: user.uid,
            creatorName: user.fullName,
            resourceIds: resources.filter(r => r.subject === 'Physics').slice(0, 4).map(r => r.id),
            createdAt: new Date().toISOString(),
            isPublic: true,
            color: '#E0E7FF'
          },
          {
            title: 'Modern Mathematics Review',
            description: 'Detailed analysis of complex algebra and calculus concepts.',
            subject: 'Mathematics',
            creatorId: user.uid,
            creatorName: user.fullName,
            resourceIds: resources.filter(r => r.subject === 'Mathematics').slice(0, 3).map(r => r.id),
            createdAt: new Date().toISOString(),
            isPublic: true,
            color: '#FDF2F8'
          }
        ];
        defaultSets.forEach(s => addDoc(collection(db, 'study_sets'), s));
      }
      setStudySets(sets);
    });
    return () => unsubscribe();
  }, [user.uid, resources.length]);

  const handleDeleteStudySet = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this study set?')) return;
    try {
      await deleteDoc(doc(db, 'study_sets', id));
      if (createNotification) {
        createNotification('Study Set Removed', 'The study set has been successfully deleted.', 'success');
      }
    } catch (err: any) {
      console.error('Failed to delete study set:', err);
      if (createNotification) {
        createNotification('Delete Failed', err.message || 'Failed to delete study set.', 'error');
      }
    }
  };

  const searchQuery = externalSearchQuery || internalSearchQuery;

  const getResourceCategory = (r: Resource): string => {
    const type = r.type?.toLowerCase() || '';
    const genre = r.genre?.toLowerCase() || '';
    if (genre.includes('past paper') || genre.includes('pastpaper') || type.includes('past paper') || type.includes('pastpaper')) return 'pastpaper';
    if (type === 'video' || genre.includes('video')) return 'video';
    if (genre.includes('note') || type.includes('note') || ['syllabus', 'revision', 'assignment', 'interactive'].includes(genre)) return 'note';
    if (genre.includes('subject') || type === 'subject') return 'subject';
    if (genre === 'book' || type === 'epub' || type === 'book' || genre.includes('textbook')) return 'book';
    return 'book'; // Default anything else (like general uploaded PDFs) to 'book' so they show up!
  };

  const handleSemanticSearch = async () => {
    if (!searchQuery) return;
    setIsAiSearching(true);
    setAiSearchResults(null);
    try {
      const titles = resources.map(r => `[${r.id}] ${r.title} (${r.subject})`).join('\n');
      const prompt = `User is looking for: "${searchQuery}". 
      From the following list of resources, return ONLY the IDs of the most relevant results as a simple comma-separated string:
      ${titles}`;
      const response = await getGeminiResponse(prompt, "Academic library semantic search");
      const ids = response.match(/[a-zA-Z0-9_-]{10,}/g) || [];
      setAiSearchResults(ids);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAiSearching(false);
    }
  };

  const filteredResources = resources.filter(r => {
    // Priority 1: AI Results
    if (aiSearchResults && aiSearchResults.length > 0) {
      return aiSearchResults.includes(r.id);
    }

    const matchesSearch = r.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         r.author.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         (r.subject?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
                         (r.className?.toLowerCase() || '').includes(searchQuery.toLowerCase());
    
    const category = getResourceCategory(r);

    let matchesMainCategory = true;
    if (activeMainCategory !== 'all') {
      matchesMainCategory = category === activeMainCategory;
    }

    const matchesGenre = selectedGenre === 'All Genres' || r.genre === selectedGenre;
    const matchesClass = selectedClass === 'All Levels' || r.className === selectedClass || (selectedClass === 'O-Level' && ['S1','S2','S3','S4'].includes(r.className || ''));

    return matchesSearch && matchesMainCategory && matchesGenre && matchesClass;
  });

  const renderResourceRow = (title: string, catId: string, icon: any) => {
    const Icon = icon;
    const items = resources.filter(r => getResourceCategory(r) === catId).slice(0, 6);
    if (items.length === 0) return null;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-text-main tracking-tight italic-serif">{title}</h2>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-0.5">Curated for your goals</p>
            </div>
          </div>
          <button 
            onClick={() => setActiveMainCategory(catId)}
            className="flex items-center gap-2 text-primary font-bold text-xs hover:gap-3 transition-all"
          >
            See all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(r => (
            <ResourceCard key={r.id} resource={r} currentUser={user} onRead={onRead} onDelete={onDelete} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-700 max-w-7xl mx-auto w-full pb-20">
      <style>{`
        .italic-serif {
          font-family: 'Playfair Display', Georgia, serif;
          font-style: italic;
        }
        .data-mono {
          font-family: 'JetBrains Mono', 'Courier New', monospace;
        }
      `}</style>

      {/* Expert Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 py-8 px-8 bg-white border border-border rounded-[3rem] shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-3xl -mr-32 -mt-32" />
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
            <Sparkles className="w-3 h-3 text-primary animate-pulse" />
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">Master Discovery</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-display font-black text-text-main tracking-tighter italic-serif">Library Hub</h1>
          <p className="text-text-secondary font-medium max-w-xl text-lg leading-relaxed">
            Your centralized node for expert academic assets. Access categorized <span className="text-primary font-bold">past papers</span>, <span className="text-orange-500 font-bold">video analysis</span>, and <span className="text-emerald-500 font-bold">synthesized notes</span>.
          </p>
        </div>
        
        <div className="relative z-10 flex flex-col items-end gap-3">
          <div className="flex bg-section p-1.5 rounded-[1.5rem] border border-border">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-primary shadow-lg' : 'text-text-muted hover:text-text-main hover:bg-white/50'}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white text-primary shadow-lg' : 'text-text-muted hover:text-text-main hover:bg-white/50'}`}
            >
              <LayoutList className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Categories Navigation Ribbon */}
      <div className="sticky top-4 z-40 px-4">
        <div className="bg-white/80 backdrop-blur-xl border border-white/50 p-2 rounded-[2.5rem] shadow-2xl flex flex-wrap items-center justify-center gap-2 max-w-4xl mx-auto ring-1 ring-black/5">
          {MAIN_CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeMainCategory === cat.id;
            return (
              <motion.button
                key={cat.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => setActiveMainCategory(cat.id)}
                className={`flex items-center gap-3 px-6 py-4 rounded-[2rem] transition-all duration-500 ${
                  isActive 
                    ? `bg-primary text-white shadow-xl shadow-primary/30` 
                    : 'bg-transparent text-text-secondary hover:bg-section hover:text-text-main'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isActive ? 'bg-white/20' : cat.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className="text-sm font-black tracking-tight">{cat.label}</span>
                {isActive && (
                  <motion.div layoutId="nav-dot" className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_white]" />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-12">
        {/* Sidebar: Navigation & Goals */}
        <div className="lg:col-span-1 space-y-10">
          <div className="bg-white border border-border rounded-[3rem] p-10 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
            <div className="relative z-10 flex items-center gap-4 mb-4">
              <TrendingUp className="w-6 h-6 text-primary" />
              <h3 className="text-sm font-black uppercase tracking-[0.15em] text-text-main">Subjects</h3>
            </div>
            <div className="flex flex-wrap gap-2.5 mb-10">
              {GENRES.map((genre) => (
                <button
                  key={genre}
                  onClick={() => setSelectedGenre(genre)}
                  className={`px-4 py-2.5 rounded-[1.2rem] text-xs font-bold transition-all border-2 ${
                    selectedGenre === genre 
                      ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105' 
                      : 'bg-section text-text-secondary border-transparent hover:border-border hover:bg-white hover:text-text-main'
                  }`}
                >
                  {genre}
                </button>
              ))}
            </div>

            <div className="relative z-10 flex items-center gap-4 mb-4">
              <Award className="w-6 h-6 text-accent" />
              <h3 className="text-sm font-black uppercase tracking-[0.15em] text-text-main">Class Levels</h3>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {CLASS_LEVELS.map((cls) => (
                <button
                  key={cls}
                  onClick={() => setSelectedClass(cls)}
                  className={`px-4 py-2.5 rounded-[1.2rem] text-xs font-bold transition-all border-2 ${
                    selectedClass === cls 
                      ? 'bg-accent text-white border-accent shadow-lg shadow-accent/20 scale-105' 
                      : 'bg-section text-text-secondary border-transparent hover:border-border hover:bg-white hover:text-text-main'
                  }`}
                >
                  {cls}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Main Content: Discovery Nodes */}
        <div className="lg:col-span-3 space-y-16">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div className="relative flex-grow group max-w-2xl flex items-center gap-4">
              <div className="relative flex-grow">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted group-focus-within:text-primary transition-colors" />
                <input 
                  type="text"
                  placeholder="Ask AI for something specific or type keywords..."
                  value={internalSearchQuery}
                  onChange={(e) => {
                    setInternalSearchQuery(e.target.value);
                    if (aiSearchResults) setAiSearchResults(null);
                  }}
                  className="w-full pl-16 pr-8 py-5.5 bg-white border border-border rounded-[2rem] focus:outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary text-base text-text-main placeholder-text-muted transition-all shadow-sm font-medium"
                />
              </div>
              <button 
                onClick={handleSemanticSearch}
                disabled={!searchQuery || isAiSearching}
                className="btn-primary h-[60px] px-8 rounded-[1.8rem] flex items-center gap-2 relative overflow-hidden group shadow-xl hover:shadow-primary/30"
              >
                {isAiSearching ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Brain className="w-5 h-5" />
                )}
                <span className="hidden md:block">Smart Search</span>
              </button>
            </div>
            <div className="flex flex-col items-end shrink-0">
              <div className="flex items-center gap-2 px-6 py-3 bg-white border border-border rounded-2xl shadow-sm">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-bold text-text-main uppercase tracking-widest data-mono">{filteredResources.length} Assets Found</span>
              </div>
            </div>
          </div>

          <AnimatePresence mode="popLayout">
            {activeMainCategory === 'studyset' ? (
              <motion.div 
                key="studysets-view"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-8"
              >
                {studySets.map((set) => (
                  <div key={set.id} className="bg-white p-8 rounded-[3rem] border border-border hover:border-primary shadow-soft transition-all group overflow-hidden relative">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-16 -mt-16" />
                    <div className="flex justify-between items-start mb-6">
                      <div className="flex items-center gap-3">
                        <div className="p-3 rounded-2xl bg-primary/10 text-primary">
                          <Shapes className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="text-xl font-display font-black text-text-main group-hover:text-primary transition-colors">{set.title}</h3>
                          <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{set.subject} • {set.resourceIds.length} Assets</p>
                        </div>
                      </div>
                      {((user.role === 'admin' || user.email === 'sharpibrah@gmail.com') || (set.creatorId === user.uid)) && (
                        <button 
                          onClick={(e) => handleDeleteStudySet(set.id, e)}
                          className="p-2 rounded-lg text-error hover:bg-error/10 transition-colors"
                          title="Delete Study Set"
                        >
                           <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-text-secondary leading-relaxed mb-8">{set.description}</p>
                    <div className="flex -space-x-3 mb-8">
                       {set.resourceIds.slice(0, 4).map((rid, idx) => {
                         const res = resources.find(r => r.id === rid);
                         return (
                           <div key={idx} className="w-12 h-16 rounded-lg border-2 border-white bg-section overflow-hidden shadow-md">
                              <img src={res?.coverUrl || getSubjectCover(res?.subject)} className="w-full h-full object-cover" alt="" />
                           </div>
                         );
                       })}
                       {set.resourceIds.length > 4 && (
                         <div className="w-12 h-16 rounded-lg border-2 border-white bg-section flex items-center justify-center text-[10px] font-black text-primary shadow-md italic">
                            +{set.resourceIds.length - 4}
                         </div>
                       )}
                    </div>
                    <button 
                      onClick={() => {
                        // Logic to open first resource in set or show set detail
                        const firstRes = resources.find(r => r.id === set.resourceIds[0]);
                        if (firstRes) onRead(firstRes);
                      }}
                      className="w-full py-4 bg-section text-text-main hover:bg-primary hover:text-white rounded-2xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-inner"
                    >
                      Start Study Set <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </motion.div>
            ) : activeMainCategory === 'all' && !searchQuery ? (
              <motion.div 
                key="grouped-view"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-20"
              >
                {renderResourceRow('Core Textbooks & Reference', 'book', BookOpen)}
                {renderResourceRow('Authentic Past Papers', 'pastpaper', FileText)}
                {renderResourceRow('Video Analysis & Guides', 'video', PlayCircle)}
                {renderResourceRow('Expert Synthesized Notes', 'note', ClipboardList)}
                {renderResourceRow('Subject Overviews', 'subject', GraduationCap)}
              </motion.div>
            ) : filteredResources.length > 0 ? (
              <motion.div 
                key="grid-view"
                layout
                className={`grid gap-10 ${viewMode === 'grid' ? 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3' : 'grid-cols-1'}`}
              >
                {filteredResources.map((resource) => (
                  <motion.div
                    key={resource.id}
                    layout
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.5, type: 'spring', damping: 25 }}
                  >
                    <ResourceCard 
                      resource={resource} 
                      currentUser={user}
                      onRead={onRead}
                      onDelete={onDelete}
                    />
                  </motion.div>
                ))}
              </motion.div>
            ) : (
              <motion.div 
                key="empty-view"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-40 bg-white border border-dashed border-border rounded-[4rem] shadow-inner"
              >
                <div className="w-28 h-28 rounded-full bg-section flex items-center justify-center text-text-muted mb-8 group overflow-hidden relative">
                  <div className="absolute inset-0 bg-primary/5 animate-pulse" />
                  <SearchCode className="w-12 h-12 relative z-10" />
                </div>
                <h3 className="text-3xl font-display font-bold text-text-main mb-3 italic-serif">No discovery nodes matched</h3>
                <p className="text-text-secondary text-center max-w-sm mb-12 px-6 font-medium">We couldn't link your query to any active academic assets. Adjust your filters or redefine your research intent.</p>
                <button 
                  onClick={() => {
                    setInternalSearchQuery('');
                    setActiveMainCategory('all');
                    setSelectedGenre('All Genres');
                  }}
                  className="px-12 py-5 bg-primary text-white rounded-[1.8rem] font-black shadow-2xl shadow-primary/30 hover:scale-[1.08] transition-all uppercase tracking-widest text-xs"
                >
                  Reset Framework
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
