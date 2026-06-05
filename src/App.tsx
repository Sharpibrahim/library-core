import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Library, 
  Search, 
  Plus, 
  LogOut, 
  User as UserIcon, 
  Filter, 
  Bot, 
  X, 
  ArrowDownToLine,
  Sparkles,
  MessageSquare,
  Bell
} from 'lucide-react';
import { Resource, User, Notification } from './types';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { onSnapshot, collection, query, orderBy, doc, getDoc, setDoc, where, updateDoc, deleteDoc, writeBatch, getDocs, Timestamp, serverTimestamp } from 'firebase/firestore';
import { ResourceCard } from './components/ResourceCard';
import { AdminPanel } from './components/AdminPanel';
import { CatalogPanel } from './components/CatalogPanel';
import { LoginForm } from './components/LoginForm';
import { AdvancedReader } from './components/AdvancedReader';
import { SharpAIChat } from './components/SharpAIChat';
import { SubjectSelection } from './components/SubjectSelection';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { UploadSection } from './components/UploadSection';
import { StudyDashboard } from './components/StudyDashboard';
import { LibraryView } from './components/LibraryView';
import { AIAssistantView } from './components/AIAssistantView';
import { NotificationsView } from './components/NotificationsView';
import { SettingsView } from './components/SettingsView';
import { HistoryView } from './components/HistoryView';
import { LMSAdmin } from './components/LMSAdmin';
import { CoursesView } from './components/CoursesView';
import { CoursePlayer } from './components/CoursePlayer';
import { ClassroomList } from './components/ClassroomList';
import { Course } from './types';
import { QuizzesView } from './components/QuizzesView';
import { ExpertChatView } from './components/ExpertChatView';
import { VoiceControl } from './components/VoiceControl';
import { CommandPalette } from './components/CommandPalette';
import { NotificationCenter } from './components/NotificationCenter';
import { OnboardingTutorial } from './components/OnboardingTutorial';
import { UserManualView } from './components/UserManualView';
import { motion, AnimatePresence } from 'motion/react';
import { SyncService } from './lib/syncService';
import { playNotificationSound } from './lib/sounds';

// Beautiful high-fidelity, dual-pitch notification chime sound
const playChimeNotificationSound = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // First high tone (sweet & clear)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
    osc1.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.15); // A5
    
    gain1.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
    
    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    
    osc1.start();
    osc1.stop(audioCtx.currentTime + 0.35);

    // Second complementary note (slightly trailing for harmonic resonance)
    setTimeout(() => {
      try {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
        osc2.frequency.exponentialRampToValueAtTime(1174.66, audioCtx.currentTime + 0.15); // D6
        
        gain2.gain.setValueAtTime(0.10, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
        
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.4);
      } catch (innerErr) {
        console.warn('Second note failed', innerErr);
      }
    }, 120);
  } catch (e) {
    console.warn('AudioContext not allowed or unsupported by user interaction rules yet.', e);
  }
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  
  // Dashboard State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  const [readingResource, setReadingResource] = useState<Resource | null>(null);
  const [selectedDashboardCourse, setSelectedDashboardCourse] = useState<Course | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [activeNotification, setActiveNotification] = useState<Notification | null>(null);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'up' | 'down'>('up');

  // SyncService Background Initialization & Network Status Hooks
  useEffect(() => {
    SyncService.initialize();
    
    // Subscribe to dynamic online/offline state machine
    const unsubscribeStatus = SyncService.subscribe((online) => {
      setServerStatus(online ? 'up' : 'down');
    });

    return () => {
      unsubscribeStatus();
    };
  }, []);

  useEffect(() => {
    // Show tutorial for new users or if not completed
    if (currentUser) {
      const tutorialStatus = localStorage.getItem(`tutorial-completed-${currentUser.uid}`);
      if (!tutorialStatus) {
        setIsTutorialOpen(true);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }

      // Quick shortcuts
      if ((e.metaKey || e.ctrlKey) && !isCommandPaletteOpen) {
        const key = e.key.toLowerCase();
        const routes: Record<string, string> = {
          'd': 'dashboard',
          'l': 'library',
          'e': 'courses',
          'c': 'classrooms',
          'm': 'messages',
          'a': 'ai-assistant',
          'u': 'upload',
          'p': 'settings',
          'n': 'notifications'
        };
        if (routes[key]) {
          e.preventDefault();
          setActiveTab(routes[key]);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen]);

  useEffect(() => {
    if (!currentUser || !auth.currentUser) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
      setNotifications(notifsList);
      
      // Check for new unread notifications to show toast
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          // Only show toast for very recent notifications (within last 10 seconds)
          const now = Date.now();
          const createdAt = data.createdAt?.toMillis ? data.createdAt.toMillis() : now;
          if (!data.read && (now - createdAt < 10000)) {
            const isNotificationsEnabled = currentUser?.masterNotifications ?? true;
            if (isNotificationsEnabled) {
              const preferredSound = currentUser?.notificationSound || 'classic';
              playNotificationSound(preferredSound);
            }
            setActiveNotification({ id: change.doc.id, ...data } as Notification);
            setTimeout(() => setActiveNotification(null), 5000);
          }
        }
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [currentUser]);

  const handleMarkRead = useCallback(async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  }, []);

  const handleMarkAllRead = useCallback(async () => {
    if (!currentUser) return;
    try {
      const q = query(
        collection(db, 'notifications'),
        where('userId', '==', currentUser.uid),
        where('read', '==', false)
      );
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.error('Failed to mark all notifications as read:', err);
    }
  }, [currentUser]);

  const handleClearAll = useCallback(async () => {
    if (!currentUser) return;
    if (!window.confirm('Clear all notifications?')) return;
    try {
      const q = query(collection(db, 'notifications'), where('userId', '==', currentUser.uid));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (err) {
      console.error('Failed to clear notifications:', err);
    }
  }, [currentUser]);

  const handleDeleteNotification = useCallback(async (id: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.error('Failed to delete notification:', err);
    }
  }, []);

  const createNotification = useCallback(async (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    if (!currentUser) return;
    try {
      await setDoc(doc(collection(db, 'notifications')), {
        userId: currentUser.uid,
        title,
        message,
        type,
        read: false,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to create notification:', err);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser || !auth.currentUser) return;

    // Listener for new messages across all user's conversations
    const q = query(
      collection(db, 'conversations'), 
      where('participants', 'array-contains', currentUser.uid),
      orderBy('lastMessageTimestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified') {
          const data = change.doc.data();
          const participants = data.participants || [];
          
          if (participants.includes(currentUser.uid) && data.lastMessageSenderId !== currentUser.uid) {
             const prevLastMsg = (change as any).doc._document?.data?.value?.mapValue?.fields?.lastMessageTimestamp?.timestampValue;
             // Only notify if the new timestamp is after the previous one (to avoid initial snapshots)
             createNotification(
                'New Message',
                data.lastMessage || 'You have a new message',
                'info'
             );
          }
        }
      });
    }, (error) => {
      console.warn('Conversations real-time subscription turned off or pending auth:', error.message);
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    const handleTabChange = (e: any) => setActiveTab(e.detail);
    window.addEventListener('changeTab', handleTabChange);
    return () => window.removeEventListener('changeTab', handleTabChange);
  }, []);

  // Auth & User Listener
  useEffect(() => {
    let userUnsubscribe: (() => void) | null = null;
    
    // Pre-load offline session instantly to recognize role/theme, but wait for auth to render!
    const savedUserJson = localStorage.getItem('library_core_current_user');
    if (savedUserJson) {
      try {
        const cachedUser = JSON.parse(savedUserJson);
        setCurrentUser(cachedUser);
      } catch (e) {
        console.error("Local storage user restore failed:", e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      (window as any).firebaseUser = firebaseUser;
      
      if (userUnsubscribe) {
        userUnsubscribe();
        userUnsubscribe = null;
      }

      if (firebaseUser) {
        // Real-time listener for the user document
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        userUnsubscribe = onSnapshot(userDocRef, async (userDoc) => {
          if (userDoc.exists()) {
            const userData = userDoc.data() as User;
            if (!userData.contactCode) {
              const prefix = userData.role === 'admin' ? 'ADMIN' : userData.role === 'teacher' ? 'TR' : 'STUDENT';
              const contactCode = `${prefix}-${Math.floor(10000 + Math.random() * 90000).toString()}`;
              await updateDoc(userDocRef, { contactCode });
              // Snapshot will trigger again with updated data
            } else {
              const fullUser = {
                ...userData,
                avatarUrl: userData.avatarUrl || firebaseUser.photoURL || null
              };
              setCurrentUser(fullUser);
              localStorage.setItem('library_core_current_user', JSON.stringify(fullUser));

              // Sync to SQLite
              try {
                const syncResponse = await fetch('/api/users/sync', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email,
                    fullName: userData.fullName || firebaseUser.displayName,
                    role: userData.role,
                    className: userData.class
                  })
                });
                if (syncResponse.ok) {
                  const syncData = await syncResponse.json();
                  setCurrentUser(prev => prev ? { ...prev, id: syncData.id } : null);
                }
              } catch (e) {
                console.error('SQL Sync failed:', e);
              }
            }
          } else {
            // Check if user was deleted in real time (we had a valid cache session, but now database document is missing)
            const existsInStorage = localStorage.getItem('library_core_current_user');
            if (existsInStorage) {
              console.log('[REAL-TIME DELETION] Active user document is missing in Firestore. Logging out instantly.');
              setCurrentUser(null);
              localStorage.removeItem('library_core_current_user');
              await signOut(auth);
              return;
            }

            // New user from Google or Admin Override
            const isAdminEmail = firebaseUser.email === 'sharpibrah@gmail.com' || 
                                 firebaseUser.email === 'sharpwhite@librarycore.com' ||
                                 firebaseUser.email === 'sharpwhite@gmail.com' ||
                                 ((firebaseUser.isAnonymous || !firebaseUser.email) && sessionStorage.getItem('admin_override_active') === 'true');
            const rolePrefix = isAdminEmail ? 'ADMIN' : 'STUDENT';
            const contactCode = isAdminEmail ? 'ADMIN' : `${rolePrefix}-${Math.floor(10000 + Math.random() * 90000).toString()}`;
            const newUser: User = {
              uid: firebaseUser.uid,
              username: isAdminEmail ? 'sharpwhite' : (firebaseUser.email?.split('@')[0] || 'user'),
              fullName: isAdminEmail ? 'Sharp Ibrahim Admin' : (firebaseUser.displayName || 'Unnamed Scholar'),
              class: isAdminEmail ? 'Administrator' : null,
              role: isAdminEmail ? 'admin' : 'student',
              favoriteSubjects: null,
              email: isAdminEmail ? (firebaseUser.email || 'sharpwhite@gmail.com') : (firebaseUser.email || null),
              avatarUrl: firebaseUser.photoURL || null,
              contactCode
            };
            await setDoc(userDocRef, newUser);
            localStorage.setItem('library_core_current_user', JSON.stringify(newUser));
            
            // Sync to SQLite
            try {
              const syncResponse = await fetch('/api/users/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  fullName: newUser.fullName,
                  role: newUser.role,
                  className: newUser.class
                })
              });
              if (syncResponse.ok) {
                const syncData = await syncResponse.json();
                setCurrentUser({ ...newUser, id: syncData.id });
              } else {
                setCurrentUser(newUser);
              }
            } catch (e) {
              console.error('SQL Sync failed:', e);
              setCurrentUser(newUser);
            }
          }
          setIsLoading(false);
        }, (error) => {
          console.error('User doc listener error:', error);
          setIsLoading(false);
        });
      } else {
        // Device offline or no active firebase state. Check local cache before wiping.
        const cachedUserStr = localStorage.getItem('library_core_current_user');
        if (cachedUserStr && !navigator.onLine) {
          console.log('[Auth] Keeping local offline session active while offline...');
        } else {
          setCurrentUser(null);
        }
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (userUnsubscribe) userUnsubscribe();
    };
  }, []);

  // Real-time Resources Listener
  useEffect(() => {
    if (!currentUser) {
      setResources([]);
      return;
    }

    // First fetch from SQLite API for pre-existing or non-realtime books
    const fetchSqliteResources = async () => {
      try {
        const res = await fetch('/api/resources');
        if (res.ok) {
          const sqliteResources = await res.json();
          console.log('[DEBUG] SQLite Resources Loaded:', sqliteResources.length);
          setResources(prev => {
            // Merge SQLite resources if they don't exist in Firestore list
            const existingIds = new Set(prev.map(r => r.id));
            const newResources = sqliteResources
              .filter((r: any) => !existingIds.has(String(r.id)))
              .map((r: any) => ({
                ...r,
                id: String(r.id),
                type: r.type || 'book', // Default type
                fileUrl: r.file_url,
                coverUrl: r.cover_url
              }));
            return [...prev, ...newResources];
          });
        }
      } catch (err) {
        console.error('Failed to fetch fallback SQLite resources:', err);
      }
    };

    fetchSqliteResources();

    const q = query(collection(db, 'resources'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreResources: Resource[] = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id
      } as Resource));
      
      setResources(prev => {
        // We prioritize Firestore resources for real-time updates
        const firestoreUrls = new Set(firestoreResources.map(r => r.fileUrl).filter(Boolean));
        const firestoreIds = new Set(firestoreResources.map(r => r.id));
        
        // Keep SQLite resources that are NOT in Firestore (by ID or URL)
        const sqliteOnly = prev.filter(r => {
          const isSqlite = !isNaN(Number(r.id));
          if (!isSqlite) return false;
          
          const existsInFirestore = firestoreIds.has(r.id) || (r.fileUrl && firestoreUrls.has(r.fileUrl));
          return !existsInFirestore;
        });
        
        return [...firestoreResources, ...sqliteOnly];
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'resources');
    });

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    // Load theme from localStorage
    const savedTheme = localStorage.getItem('library-theme') as 'light' | 'dark';
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('library-theme', theme);
  }, [theme]);

  const handleDelete = async (id: string) => {
    try {
      console.log(`[Library] Attempting to delete resource with ID: ${id}`);
      
      const resourceToDelete = resources.find(r => String(r.id) === String(id));
      if (!resourceToDelete) throw new Error('Resource not found in local state');

      // 1. Determine targets
      const isSqliteId = !isNaN(Number(id)) && String(Number(id)) === String(id);
      let sqliteIdToDelete = isSqliteId ? id : null;
      let firestoreIdToDelete = !isSqliteId ? id : null;

      // 2. Cross-check for duplicates (if we are deleting one, find the other by URL)
      if (resourceToDelete.fileUrl) {
        if (isSqliteId) {
          // Deleting SQLite record, find if a Firestore doc matches
          const matchingFirestore = resources.find(r => isNaN(Number(r.id)) && r.fileUrl === resourceToDelete.fileUrl);
          if (matchingFirestore) firestoreIdToDelete = matchingFirestore.id;
        } else {
          // Deleting Firestore record, find if a SQLite doc matches
          const matchingSqlite = resources.find(r => !isNaN(Number(r.id)) && r.fileUrl === resourceToDelete.fileUrl);
          if (matchingSqlite) sqliteIdToDelete = matchingSqlite.id;
        }
      }

      // 3. Perform Deletions (Optimistic UI update)
      setResources(prev => prev.filter(r => String(r.id) !== String(id)));

      if (sqliteIdToDelete) {
        console.log(`[Library] Deleting SQLite record ${sqliteIdToDelete}`);
        const res = await fetch(`/api/resources/${sqliteIdToDelete}`, { method: 'DELETE' });
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({ error: 'Unknown server error' }));
          console.warn('SQLite delete failed:', errorData.error);
          // Re-add resource if delete fails
          setResources(prev => [...prev, resourceToDelete]);
          throw new Error(errorData.error || 'Failed to delete from database');
        }
      }

      if (firestoreIdToDelete) {
        console.log(`[Library] Deleting Firestore document ${firestoreIdToDelete}`);
        try {
          await deleteDoc(doc(db, 'resources', firestoreIdToDelete));
        } catch (fErr) {
          console.error('Firestore delete failed:', fErr);
          // Re-add resource if delete fails
          setResources(prev => [...prev, resourceToDelete]);
          throw fErr;
        }
      }

      createNotification(
        'Resource Deleted',
        'The item was successfully removed from all storage locations.',
        'success'
      );
    } catch (error: any) {
      console.error('[Library] Delete operation failed:', error);
      let errorMessage = 'Failed to delete resource. Please try again.';
      if (error.message?.includes('permissions')) errorMessage = 'You do not have permission to delete this file.';
      
      createNotification('Delete Failed', errorMessage, 'error');
      
      // If Firestore error, log details for system debugging
      if (error.code?.includes('permission') || (error.message && error.message.includes('permission'))) {
        try {
          handleFirestoreError(error, OperationType.DELETE, `resources/${id}`);
        } catch (e) {}
      }
    }
  };

  const handleLogout = useCallback(async () => {
    try {
      localStorage.removeItem('library_core_current_user');
      sessionStorage.removeItem('admin_override_active');
      await signOut(auth);
      setCurrentUser(null);
    } catch (err) {
      console.error('Logout error:', err);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);

  const onVoiceSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setActiveTab('library');
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-6">
        <div className="w-32 h-32 flex items-center justify-center animate-pulse">
          <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" />
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
          </div>
          <p className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Syncing LibraryCore...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginForm onLogin={setCurrentUser} serverStatus={serverStatus} />;
  }

  if (!currentUser.favoriteSubjects && currentUser.role !== 'admin') {
    return (
      <SubjectSelection 
        userId={currentUser.uid} 
        onComplete={(subjects) => setCurrentUser({ ...currentUser, favoriteSubjects: subjects })} 
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-text-main flex relative selection:bg-primary/10 selection:text-primary">
      {/* Background Glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px]" />
      </div>

      {/* Sidebar */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={handleLogout}
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        user={currentUser}
        hasNewMessage={notifications.some(n => !n.read)}
        onToggleNotifications={() => setIsNotificationCenterOpen(!isNotificationCenterOpen)}
        onOpenTutorial={() => setIsTutorialOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-grow lg:ml-72 min-h-screen flex flex-col relative z-10">
        <TopBar 
          user={currentUser} 
          onMenuClick={() => setIsSidebarOpen(true)} 
          searchQuery={searchQuery}
          setSearchQuery={(query) => {
            setSearchQuery(query);
            if (activeTab !== 'library' && query.trim() !== '') {
              setActiveTab('library');
            }
          }}
          setActiveTab={setActiveTab}
          unreadNotificationsCount={notifications.filter(n => !n.read).length}
          onToggleNotifications={() => setIsNotificationCenterOpen(!isNotificationCenterOpen)}
          isNotificationCenterOpen={isNotificationCenterOpen}
        />

        <main className="p-4 sm:p-8 lg:p-10 max-w-none mx-auto w-full">
          <div className="w-full">
            <div style={{ display: activeTab === 'dashboard' ? 'block' : 'none' }}>
              <StudyDashboard 
                user={currentUser} 
                resources={resources} 
                onOpenResource={setReadingResource} 
                onOpenCourse={async (course) => {
                  // Fetch full course data
                  try {
                    const res = await fetch(`/api/courses/${course.id}`);
                    if (res.ok) {
                      const fullCourse = await res.json();
                      setSelectedDashboardCourse(fullCourse);
                    }
                  } catch (e) {
                    console.error(e);
                  }
                }}
              />
            </div>

            <div style={{ display: activeTab === 'library' ? 'block' : 'none' }}>
              <LibraryView 
                resources={resources} 
                user={currentUser}
                onRead={setReadingResource} 
                onDelete={handleDelete}
                externalSearchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                createNotification={createNotification}
              />
            </div>

            <div style={{ display: activeTab === 'ai-assistant' ? 'block' : 'none' }}>
              <AIAssistantView user={currentUser} />
            </div>

            <div style={{ display: activeTab === 'notifications' ? 'block' : 'none' }}>
              <NotificationsView 
                notifications={notifications}
                onMarkRead={handleMarkRead}
                onMarkAllRead={handleMarkAllRead}
                onClearAll={handleClearAll}
                onDelete={handleDeleteNotification}
              />
            </div>

            <div style={{ display: activeTab === 'upload' ? 'block' : 'none' }}>
              <div className="max-w-4xl mx-auto py-8">
                <UploadSection 
                  user={currentUser} 
                  onUploadComplete={() => {
                    setActiveTab('library');
                  }} 
                />
              </div>
            </div>

            <div style={{ display: activeTab === 'history' ? 'block' : 'none' }}>
              <HistoryView />
            </div>

            <div style={{ display: activeTab === 'admin-panel' ? 'block' : 'none' }}>
              {currentUser && (
                <LMSAdmin 
                  user={currentUser}
                  onAddClick={() => setActiveTab('upload')} 
                  resources={resources}
                  onDeleteResource={handleDelete}
                />
              )}
            </div>

            <div style={{ display: activeTab === 'classrooms' ? 'block' : 'none' }}>
              <ClassroomList user={currentUser} />
            </div>
            
            <div style={{ display: activeTab === 'courses' ? 'block' : 'none' }}>
              <CoursesView user={currentUser} />
            </div>

            <div style={{ display: activeTab === 'quizzes' ? 'block' : 'none' }}>
              <QuizzesView user={currentUser} />
            </div>

            <div style={{ display: activeTab === 'messages' ? 'block' : 'none' }}>
              <ExpertChatView user={currentUser} />
            </div>

            <div style={{ display: activeTab === 'settings' ? 'block' : 'none' }}>
              <SettingsView 
                user={currentUser} 
                theme={theme}
                onThemeChange={toggleTheme}
                onUserUpdate={(updatedUser) => setCurrentUser(updatedUser)}
              />
            </div>

            <div style={{ display: activeTab === 'user-manual' ? 'block' : 'none' }}>
              <UserManualView />
            </div>

            {/* Placeholder for other tabs */}
            <div style={{ display: ['shelf', 'notes', 'papers', 'progress', 'profile', 'assignments', 'analytics', 'search'].includes(activeTab) ? 'block' : 'none' }}>
              <div className="flex flex-col items-center justify-center py-32 text-center">
                <div className="w-24 h-24 bg-black/5 dark:bg-white/5 rounded-[2.5rem] flex items-center justify-center text-slate-500 mb-6 border border-slate-200 dark:border-white/10">
                  <Library className="w-12 h-12" />
                </div>
                <h2 className="text-3xl font-display font-bold text-text-main mb-2 capitalize">{activeTab.replace('-', ' ')}</h2>
                <p className="text-slate-500 max-w-md font-medium">This section is currently under development. Stay tuned for exciting new features!</p>
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className="mt-8 btn-primary px-8 py-3"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Modals */}
      <CommandPalette 
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
        userRole={currentUser?.role || 'student'}
      />

      {readingResource && currentUser && (
        <AdvancedReader 
          resource={readingResource}
          user={currentUser}
          onClose={() => setReadingResource(null)}
          onDelete={handleDelete}
        />
      )}

      {selectedDashboardCourse && currentUser && (
        <div className="fixed inset-0 z-[500] bg-white">
          <CoursePlayer 
            course={selectedDashboardCourse} 
            user={currentUser} 
            onBack={() => setSelectedDashboardCourse(null)} 
          />
        </div>
      )}

      <VoiceControl 
        onNavigate={setActiveTab}
        onLogout={handleLogout}
        onToggleTheme={toggleTheme}
        onSearch={onVoiceSearch}
        onReadResource={setReadingResource}
        resources={resources}
      />

      {/* Global Notifications */}
      <AnimatePresence>
        {activeNotification && (
          <motion.div
            key="global-notification"
            initial={{ opacity: 0, y: 50, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 20, x: '-50%' }}
            className="fixed bottom-24 left-1/2 z-[200] w-full max-w-sm"
          >
            <div className={`mx-4 glass-panel border-primary/30 p-4 flex items-center gap-4 shadow-glow bg-slate-900/95 text-white rounded-3xl`}>
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                activeNotification.type === 'success' ? 'bg-emerald-500' :
                activeNotification.type === 'error' ? 'bg-rose-500' :
                activeNotification.type === 'warning' ? 'bg-amber-500' : 'bg-primary'
              }`}>
                <Bell className="w-6 h-6" />
              </div>
              <div className="flex-grow min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">{activeNotification.title}</p>
                <p className="text-sm font-medium line-clamp-1 italic">{activeNotification.message}</p>
              </div>
              <button onClick={() => setActiveNotification(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <NotificationCenter
        notifications={notifications}
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        onMarkRead={handleMarkRead}
        onMarkAllRead={handleMarkAllRead}
        onClearAll={handleClearAll}
      />

      <AnimatePresence>
        {isTutorialOpen && currentUser && (
          <OnboardingTutorial 
            onClose={() => setIsTutorialOpen(false)}
            onComplete={() => {
              setIsTutorialOpen(false);
              localStorage.setItem(`tutorial-completed-${currentUser.uid}`, 'true');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
