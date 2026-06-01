import React, { useState, useMemo } from 'react';
import { 
  Book, 
  Search, 
  Mic, 
  Cpu, 
  Users, 
  Clock, 
  Trophy, 
  Bookmark, 
  MousePointer, 
  ShieldAlert, 
  Download, 
  Sparkles, 
  FileText, 
  CheckCircle, 
  HelpCircle,
  Command,
  HelpCircle as HelpIcon,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ManualChapter {
  id: string;
  title: string;
  category: 'core' | 'reading' | 'voice' | 'roles' | 'ai';
  icon: any;
  shortDesc: string;
  content: React.ReactNode;
}

export function UserManualView() {
  const [activeTab, setActiveTab] = useState<'all' | 'core' | 'reading' | 'voice' | 'roles' | 'ai'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChapterId, setSelectedChapterId] = useState<string>('getting-started');

  const chapters: ManualChapter[] = useMemo(() => [
    {
      id: 'getting-started',
      title: 'Getting Started with LibraryCore',
      category: 'core',
      icon: Book,
      shortDesc: 'Welcome guide to navigating and mastering Academic Library Elite (v2.0).',
      content: (
        <div className="space-y-6">
          <div className="p-6 bg-gradient-to-r from-primary/10 via-secondary/5 to-transparent rounded-3xl border border-primary/15 relative overflow-hidden">
            <div className="absolute top-4 right-4 animate-pulse"><Sparkles className="w-5 h-5 text-primary" /></div>
            <h4 className="text-lg font-display font-black text-text-main mb-2">Welcome Scholar!</h4>
            <p className="text-sm text-text-secondary leading-relaxed">
              <strong>LibraryCore v2.0</strong> is a premier, AI-powered digital learning ecosystem. It merges high-fidelity electronic document readers with real-time class conferencing, automated testing mechanisms, deep focused study aids, and natural voice navigation interfaces.
            </p>
          </div>

          <h5 className="font-display font-bold text-text-main text-base uppercase tracking-wider">Fast-Track Navigation</h5>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-card rounded-2xl border border-border flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0 font-mono font-black">1</div>
              <div>
                <p className="font-bold text-sm text-text-main">Set Up Profile</p>
                <p className="text-xs text-text-muted mt-1">Select your favorite subjects (e.g. Physics, Law, Medicine) to tailor your smart library algorithm.</p>
              </div>
            </div>
            <div className="p-5 bg-card rounded-2xl border border-border flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-secondary/10 text-secondary flex items-center justify-center flex-shrink-0 font-mono font-black">2</div>
              <div>
                <p className="font-bold text-sm text-text-main">Explore Documents</p>
                <p className="text-xs text-text-muted mt-1">Visit your Catalog to load resources, filter by academic levels, and open the high-fidelity interactive reader.</p>
              </div>
            </div>
            <div className="p-5 bg-card rounded-2xl border border-border flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center flex-shrink-0 font-mono font-black">3</div>
              <div>
                <p className="font-bold text-sm text-text-main">Enable Voice Control</p>
                <p className="text-xs text-text-muted mt-1">Click the microphone icon in the bottom-right corner to speak commands like "Open Deep Tracker" or "Read Business Essentials" verbally.</p>
              </div>
            </div>
            <div className="p-5 bg-card rounded-2xl border border-border flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0 font-mono font-black">4</div>
              <div>
                <p className="font-bold text-sm text-text-main">Join Classrooms</p>
                <p className="text-xs text-text-muted mt-1">Participate in live student workspaces containing whiteboards, collaborative code boxes, or video chats.</p>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'advanced-reader',
      title: 'Advanced Reading Engine (Scroll & Highlights)',
      category: 'reading',
      icon: Bookmark,
      shortDesc: 'Master automatic cloud progress saving, annotations, notes, and bookmark syncing.',
      content: (
        <div className="space-y-6">
          <p className="text-sm text-text-secondary leading-relaxed">
            The **Advanced Reader** is a state-of-the-art PDF/EPUB module that supports high-speed rendering, smart typography resizing, night mode, and active research utilities.
          </p>

          <div className="border border-border rounded-3xl overflow-hidden bg-section p-6 space-y-4">
            <h5 className="font-display font-bold text-text-main text-sm uppercase tracking-wider flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-500" /> Key Mechanics & Active Interactions
            </h5>
            
            <ul className="space-y-3.5 text-sm text-text-secondary">
              <li className="flex gap-3">
                <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                <span>
                  <strong>Real-time Progress Saving:</strong> As you scroll or jump to different page numbers, your current page coordinates are automatically stored locally and synchronized to **Firestore**. When reloading this file on any mobile, tablet, or desktop browser, you will instantly pick up exactly where you left off.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                <span>
                  <strong>Smart Selection Highlighting:</strong> Drag your cursor or touch-hold to select text within any document page. Instantly press the top-right tool button or use voice triggers to highlight the excerpt. Every highlight is stored securely on the cloud.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="w-1.5 h-1.5 bg-primary rounded-full mt-2 flex-shrink-0" />
                <span>
                  <strong>Custom Note Taking & Bookmarks:</strong> Save personal annotations, annotations, or conceptual breakdowns aligned directly to specific pages. View them nicely summarized in the Reader sidebar, export notes to text, or press the bookmark tab to register standard jump points.
                </span>
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-2xl">
              <p className="text-xs font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-widest font-mono mb-1">PRO-TIP: SELECT WITH EASE</p>
              <p className="text-xs text-text-secondary">To highlight digital text perfectly, toggle the Selection Mode in the top-bar toolbar of the core reader.</p>
            </div>
            <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl">
              <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest font-mono mb-1">SYNC CONCURRENT DEVS</p>
              <p className="text-xs text-text-secondary">If study progress isn't updating immediately, verify your active cloud indicator in the main system topbar.</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'voice-control',
      title: 'Voice Command Registry (Speech-to-Text)',
      category: 'voice',
      icon: Mic,
      shortDesc: 'A comprehensive dictionary of natural spoken keywords to command the active application workspace.',
      content: (
        <div className="space-y-6">
          <p className="text-sm text-text-secondary leading-relaxed">
            Unleash touch-free exploration with the built-in **Voice Registry**. Simply turn on the master microphone, and the voice service will instantly listen for precise commands, parsing speech intents into swift responsive transitions.
          </p>

          <table className="w-full text-left text-sm border-collapse rounded-2xl overflow-hidden border border-border">
            <thead>
              <tr className="bg-primary/5 border-b border-border text-[11px] font-black uppercase tracking-wider text-primary">
                <th className="p-4">What to Say (Keyword Phrase)</th>
                <th className="p-4">System action Triggered</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-medium">
              <tr>
                <td className="p-4 font-mono text-xs text-text-main">"Open Library" / "Go to Library"</td>
                <td className="p-4 text-text-secondary">Loads the full resource catalog, active course listings, and academic categories.</td>
              </tr>
              <tr>
                <td className="p-4 font-mono text-xs text-text-main">"Open Deep Tracker" / "Go to Tracker"</td>
                <td className="p-4 text-text-secondary">Jumps instantly to the Deep Study Tracker containing interactive Pomodoro loops.</td>
              </tr>
              <tr>
                <td className="p-4 font-mono text-xs text-text-main">"Open AI Chat" / "Open Assistant"</td>
                <td className="p-4 text-text-secondary">Opens the AI Companion window for smart prompt querying and flashcards.</td>
              </tr>
              <tr>
                <td className="p-4 font-mono text-xs text-text-main">"Read [Book / Document Name]"</td>
                <td className="p-4 text-text-secondary">Automatically queries the active document list and pops open the reading runner (e.g. <em>"Read Deep Learning"</em>).</td>
              </tr>
              <tr>
                <td className="p-4 font-mono text-xs text-text-main">"Close Reader" / "Exit Book"</td>
                <td className="p-4 text-text-secondary">Safely terminates the active document modal, committing progress logs to storage.</td>
              </tr>
              <tr>
                <td className="p-4 font-mono text-xs text-text-main">"Find [Search Phrase]"</td>
                <td className="p-4 text-text-secondary">Instantly filters all subjects and content materials by specified query text.</td>
              </tr>
              <tr>
                <td className="p-4 font-mono text-xs text-text-main">"Toggle Theme" / "Change Theme"</td>
                <td className="p-4 text-text-secondary">Quickly switches between Library Slate theme configurations and light view modes.</td>
              </tr>
              <tr>
                <td className="p-4 font-mono text-xs text-text-main">"Scroll Down" / "Scroll Up"</td>
                <td className="p-4 text-text-secondary">Simulates continuous mousewheel operations, convenient for long articles.</td>
              </tr>
            </tbody>
          </table>

          <div className="bg-warning/5 border border-warning/15 p-5 rounded-3xl flex items-start gap-4">
            <Command className="w-6 h-6 text-warning mt-1 flex-shrink-0" />
            <div>
              <p className="font-bold text-sm text-text-main">Continuous Audio Safeguards</p>
              <p className="text-xs text-text-secondary leading-relaxed mt-1">
                To trigger verbal operations error-free, ensure your browser micro-permission is granted. For privacy, the active microphone closes automatic detection loops when navigating off-focus or clicking active buttons.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'role-matrix',
      title: 'Academy Roles & Access Control',
      category: 'roles',
      icon: Users,
      shortDesc: 'Understand operational privileges: Student, Teacher, Professor, and Board Administrator.',
      content: (
        <div className="space-y-6">
          <p className="text-sm text-text-secondary leading-relaxed">
            The platform provides full-featured role-based user management (RBAC). Your specified avatar badge confirms your primary role and unlocks specialized utilities across panels.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 border border-border rounded-2xl bg-card">
              <span className="text-[10px] bg-primary/10 text-primary font-black uppercase tracking-widest px-2.5 py-1 rounded-full font-mono">Student</span>
              <p className="font-bold text-base text-text-main mt-3">Scholar & Learner</p>
              <ul className="space-y-2 text-xs text-text-secondary mt-3">
                <li>• Access all library catalogs</li>
                <li>• Keep personal bookmarks & notes</li>
                <li>• Start Pomodoro study sessions</li>
                <li>• Answer custom quizzes & track grade GPA</li>
              </ul>
            </div>
            <div className="p-5 border border-border rounded-2xl bg-card">
              <span className="text-[10px] bg-emerald-500/10 text-emerald-500 font-black uppercase tracking-widest px-2.5 py-1 rounded-full font-mono">Teacher</span>
              <p className="font-bold text-base text-text-main mt-3">Professor & Mentor</p>
              <ul className="space-y-2 text-xs text-text-secondary mt-3">
                <li>• Upload PDF and EPUB textbooks</li>
                <li>• Build custom academic courses</li>
                <li>• Host collaborative classrooms</li>
                <li>• Generate auto quizzes for students</li>
              </ul>
            </div>
            <div className="p-5 border border-border rounded-2xl bg-card">
              <span className="text-[10px] bg-amber-500/10 text-amber-500 font-black uppercase tracking-widest px-2.5 py-1 rounded-full font-mono">Admin</span>
              <p className="font-bold text-base text-text-main mt-3">Board Admin</p>
              <ul className="space-y-2 text-xs text-text-secondary mt-3">
                <li>• Manage full user inventories</li>
                <li>• Audit database security keys</li>
                <li>• Edit LMS parameters</li>
                <li>• Oversee global learning reports</li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'ai-features',
      title: 'Genius AI Assistant & Active Recall',
      category: 'ai',
      icon: Cpu,
      shortDesc: 'Utilize next-generation neural chat models to draft questions, solve hard problems, and summarize articles.',
      content: (
        <div className="space-y-6">
          <p className="text-sm text-text-secondary leading-relaxed">
            The workspace bridges advanced server-side Gemini API interfaces to dynamically supercharge standard reference textbooks into hyper-personalized study guides.
          </p>

          <div className="border border-border rounded-3xl p-6 bg-slate-900 text-white space-y-4">
            <h5 className="font-display font-black text-primary text-sm uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-warning" /> AI Power tools
            </h5>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <p className="font-bold text-sm text-white">Smart Quiz Master</p>
                <p className="text-xs text-slate-300 mt-1">Select any document in your local list, choose the preferred difficulty of testing, and press <strong>"Generate Assessment"</strong>. AI generates real-time multiple-choice and conceptual challenges instantly.</p>
              </div>
              <div className="p-4 bg-white/5 rounded-xl border border-white/10">
                <p className="font-bold text-sm text-white">Explanations & Flashcards</p>
                <p className="text-xs text-slate-300 mt-1">Stuck on a tricky page? Leverage the AI Companion chat view. It reads the excerpt context and breaks down complex jargon, even helping you draft active recall cards.</p>
              </div>
            </div>
          </div>

          <div className="p-5 bg-primary/5 rounded-[2rem] border border-primary/20 flex gap-4">
            <HelpIcon className="w-6 h-6 text-primary flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm text-text-main">Need expert mentoring?</p>
              <p className="text-xs text-text-secondary mt-1">
                Head to the <strong>Expert Chat</strong> tab to communicate directly with highly recognized subject advisors, or launch simulated AI professors who advise under specific academic paradigms.
              </p>
            </div>
          </div>
        </div>
      )
    }
  ], []);

  const filteredChapters = chapters.filter(c => {
    const matchesTab = activeTab === 'all' || c.category === activeTab;
    const matchesSearch = c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.shortDesc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const selectedChapter = chapters.find(c => c.id === selectedChapterId) || chapters[0];

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="p-8 sm:p-12 md:p-16 rounded-[3rem] bg-gradient-to-br from-slate-900 to-slate-850 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(139,92,246,0.15),transparent_40%)]" />
        <div className="absolute top-8 right-8 w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center border border-white/10 backdrop-blur-md">
          <BookOpen className="w-12 h-12 text-primary" />
        </div>
        
        <div className="relative z-10 max-w-2xl">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-primary bg-primary/10 px-4 py-2 rounded-full border border-primary/20">Documentation v2.0</span>
          <h2 className="text-4xl sm:text-5xl font-display font-black tracking-tight mt-6 mb-4">
            Library<span className="text-primary">Core</span> System Manual
          </h2>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed font-medium">
            Master the complete academic suite. Explore standard reading mechanics, cloud sync configurations, natural voice triggers, and advanced AI test generators.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Navigation & Sidebar Panel */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 bg-white border border-border rounded-[2rem] shadow-sm space-y-5">
            <h3 className="font-display font-black text-text-main text-base uppercase tracking-wider">Chapters</h3>
            
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input 
                type="text"
                placeholder="Search instructions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 bg-section rounded-2xl border border-border focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none transition-all text-sm font-bold placeholder-text-muted"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-1.5">
              {(['all', 'core', 'reading', 'voice', 'roles', 'ai'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider border transition-all ${
                    activeTab === tab 
                      ? 'bg-primary border-primary text-white shadow-md shadow-primary/15'
                      : 'bg-section border-border text-text-secondary hover:text-text-main hover:border-text-muted'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Chapter list */}
            <div className="space-y-1.5 pt-2">
              <AnimatePresence mode="popLayout">
                {filteredChapters.map(chapter => {
                  const Icon = chapter.icon;
                  const isSelected = selectedChapterId === chapter.id;
                  
                  return (
                    <motion.button
                      key={chapter.id}
                      onClick={() => setSelectedChapterId(chapter.id)}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className={`w-full flex items-center gap-3.5 p-3.5 rounded-2xl text-left border transition-all group ${
                        isSelected 
                          ? 'bg-primary/5 border-primary/15 text-primary' 
                          : 'bg-transparent border-transparent text-text-secondary hover:text-text-main hover:bg-hover'
                      }`}
                    >
                      <div className={`p-2.5 rounded-xl transition-all ${
                        isSelected ? 'bg-primary text-white shadow-md' : 'bg-section group-hover:bg-primary/5'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <p className="font-bold text-sm tracking-tight truncate">{chapter.title}</p>
                        <p className="text-[10px] text-text-muted truncate mt-0.5">{chapter.shortDesc}</p>
                      </div>
                      <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${
                        isSelected ? 'translate-x-0 text-primary' : '-translate-x-1 opacity-0 group-hover:opacity-100 group-hover:translate-x-0'
                      }`} />
                    </motion.button>
                  );
                })}

                {filteredChapters.length === 0 && (
                  <div className="text-center py-8 text-text-muted">
                    <p className="text-sm font-bold">No documentation chapters found</p>
                    <p className="text-xs">Try different terms or clear the filter.</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Dynamic Content Panel */}
        <div className="lg:col-span-8 p-6 sm:p-10 bg-white border border-border rounded-[2.5rem] shadow-sm min-h-[500px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedChapter.id}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              <div className="flex items-center gap-4 border-b border-border pb-6">
                <div className="p-3 bg-primary/10 text-primary rounded-2xl">
                  {React.createElement(selectedChapter.icon, { className: "w-6 h-6" })}
                </div>
                <div>
                  <h3 className="text-2xl sm:text-3xl font-display font-black text-text-main tracking-tight">
                    {selectedChapter.title}
                  </h3>
                  <p className="text-xs text-text-muted font-bold uppercase tracking-widest mt-1">
                    Category: <span className="text-primary font-black">{selectedChapter.category}</span>
                  </p>
                </div>
              </div>

              <div className="prose prose-slate max-w-none">
                {selectedChapter.content}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
