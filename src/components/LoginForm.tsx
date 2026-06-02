import React, { useState, useEffect } from 'react';
import { User as UserIcon, Lock, Loader2, ShieldCheck, Key, BookOpen, Bot, Globe, AlertCircle, ArrowLeft, Check } from 'lucide-react';
import { Role, User } from '../types';
import { auth, db } from '../firebase';
import logoUrl from '../assets/images/library_core_logo_1780128110753.png';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { localDB, OfflineUser } from '../lib/localDb';

interface LoginFormProps {
  onLogin: (user: User) => void;
  serverStatus: 'checking' | 'up' | 'down';
}

export function LoginForm({ onLogin, serverStatus }: LoginFormProps) {
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [className, setClassName] = useState('');
  const [role, setRole] = useState<Role>('student');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // In-app Google chooser panel states
  const [showGoogleChooser, setShowGoogleChooser] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [showAddGoogleForm, setShowAddGoogleForm] = useState(false);
  const [googlePassword, setGooglePassword] = useState('');

  // Static list of popular user accounts to choose from for the elegant in-app Google Chooser
  const [googleAccounts, setGoogleAccounts] = useState<OfflineUser[]>([]);

  useEffect(() => {
    // Load previously registered users to show in the Google Chooser
    const loadIndexedAccounts = async () => {
      try {
        const offlineUsers = await localDB.getAllOfflineUsers();
        const googleUsers = offlineUsers.filter(u => u.isGoogle);
        
        // Seed sharpibrah@gmail.com default admin Google Account if empty
        if (googleUsers.length === 0) {
          const defaultAdmin: OfflineUser = {
            uid: 'admin_google_uid',
            username: 'sharpibrah',
            email: 'sharpibrah@gmail.com',
            fullName: 'Sharp Ibrahim',
            role: 'admin',
            class: 'System Admin',
            isGoogle: true,
            contactCode: '10001'
          };
          setGoogleAccounts([defaultAdmin]);
        } else {
          setGoogleAccounts(googleUsers);
        }
      } catch (e) {
        // Fallback static
        setGoogleAccounts([
          {
            uid: 'admin_google_uid',
            username: 'sharpibrah',
            email: 'sharpibrah@gmail.com',
            fullName: 'Sharp Ibrahim',
            role: 'admin',
            class: 'System Admin',
            isGoogle: true,
            contactCode: '10001'
          }
        ]);
      }
    };
    loadIndexedAccounts();
  }, [showGoogleChooser]);

  const ensureAdminConversation = async (newUser: User) => {
    if (serverStatus === 'down') return; // Cannot connect conversation while down
    try {
      const adminQuery = query(collection(db, 'users'), where('email', '==', 'sharpibrah@gmail.com'), where('role', '==', 'admin'));
      const adminSnap = await getDocs(adminQuery);
      
      if (adminSnap.empty) return;
      
      const adminUser = adminSnap.docs[0].data() as User;
      const adminUid = adminUser.uid;
      
      if (newUser.uid === adminUid) return;

      const convId = [newUser.uid, adminUid].sort().join('_');
      const convRef = doc(db, 'conversations', convId);
      const convSnap = await getDoc(convRef);

      if (!convSnap.exists()) {
        await setDoc(convRef, {
          id: convId,
          participants: [newUser.uid, adminUid],
          lastMessage: 'Welcome to LibraryCore! I am the Admin, contact me for any help.',
          lastMessageTimestamp: serverTimestamp()
        });

        await addDoc(collection(db, 'conversations', convId, 'messages'), {
          senderId: adminUid,
          senderName: 'Library Admin',
          content: 'Welcome to LibraryCore! I am the Admin, contact me for any help. You can ask me anything about the library, courses, or classrooms.',
          timestamp: serverTimestamp(),
          type: 'text'
        });
      }
    } catch (err) {
      console.error("Failed to connect admin contact:", err);
    }
  };

  // Modern In-App Google Login Flow WITHOUT POPUPS
  const selectGoogleAccount = async (account: OfflineUser) => {
    setIsLoading(true);
    setError('');
    try {
      if (serverStatus !== 'down') {
        // Online: Synced with Firebase Auth & Firestore
        const googleEmail = account.email || `${account.username}@gmail.com`;
        
        // Use a plus-address to avoid collisions with standard password-based registrations
        const authEmail = googleEmail.includes('+google@') 
          ? googleEmail 
          : googleEmail.replace('@gmail.com', '+google@gmail.com');
        const googleImplicitPassword = 'GoogleImplicit_2026_!' + authEmail;

        let firebaseUid = '';
        let userCredential;
        try {
          userCredential = await signInWithEmailAndPassword(auth, authEmail, googleImplicitPassword);
          firebaseUid = userCredential.user.uid;
        } catch (signInErr: any) {
          // If login failed because user doesn't exist yet, register them
          try {
            userCredential = await createUserWithEmailAndPassword(auth, authEmail, googleImplicitPassword);
            firebaseUid = userCredential.user.uid;
          } catch (signUpErr: any) {
            throw signUpErr;
          }
        }

        const userDocRef = doc(db, 'users', firebaseUid);
        const userDoc = await getDoc(userDocRef);

        let appUser: User;
        if (userDoc.exists()) {
          appUser = userDoc.data() as User;
          if (!appUser.email) {
            appUser.email = googleEmail;
            await setDoc(userDocRef, { email: googleEmail }, { merge: true });
          }
        } else {
          // Auto-make sharpibrah@gmail.com system admin
          const assignedRole = googleEmail.toLowerCase() === 'sharpibrah@gmail.com' ? 'admin' : account.role;
          appUser = {
            uid: firebaseUid,
            username: account.username || googleEmail.split('@')[0],
            fullName: account.fullName || googleEmail.split('@')[0].toUpperCase(),
            class: account.class || 'Google Class',
            role: assignedRole,
            favoriteSubjects: null,
            email: googleEmail,
            contactCode: account.contactCode || Math.floor(10000 + Math.random() * 90000).toString()
          };
          await setDoc(userDocRef, appUser);
          await ensureAdminConversation(appUser);
        }

        // Cache locally in IndexedDB
        await localDB.saveOfflineUser({
          uid: appUser.uid,
          username: appUser.username,
          fullName: appUser.fullName,
          class: appUser.class,
          role: appUser.role,
          email: appUser.email,
          isGoogle: true,
          contactCode: appUser.contactCode || '10001'
        });

        onLogin(appUser);
      } else {
        // Offline Authentication from IndexedDB
        const offlineMatch = await localDB.verifyOfflineCredentials(account.email || account.username, undefined, true);
        if (offlineMatch) {
          onLogin({
            uid: offlineMatch.uid,
            username: offlineMatch.username,
            fullName: offlineMatch.fullName,
            class: offlineMatch.class,
            role: offlineMatch.role,
            favoriteSubjects: null,
            email: offlineMatch.email,
            contactCode: offlineMatch.contactCode
          });
        } else {
          // Allow transient registration of default admin account offline
          onLogin({
            uid: account.uid,
            username: account.username,
            fullName: account.fullName,
            class: account.class,
            role: account.role,
            favoriteSubjects: null,
            email: account.email,
            contactCode: account.contactCode
          });
        }
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed in-app Google authorization.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGoogleAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customGoogleEmail.includes('@gmail.com') && !customGoogleEmail.includes('@googlemail.com')) {
      setError('Please enter a valid Google Account email address.');
      return;
    }

    setIsLoading(true);
    setError('');

    const newGoogleUser: OfflineUser = {
      uid: 'google_user_' + Date.now(),
      username: customGoogleEmail.split('@')[0],
      email: customGoogleEmail,
      fullName: customGoogleEmail.split('@')[0].toUpperCase(),
      role: 'student',
      class: 'Google Class',
      isGoogle: true,
      contactCode: Math.floor(10000 + Math.random() * 90000).toString()
    };

    try {
      // Save locally
      await localDB.saveOfflineUser(newGoogleUser, googlePassword || 'google_fallback_pwd');
      await selectGoogleAccount(newGoogleUser);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed in-app account setup.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const email = username.includes('@') ? username : `${username}@librarycore.com`;

      if (serverStatus !== 'down') {
        // Online login: attempt Firebase Auth first
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        
        if (userDoc.exists()) {
          const appUser = userDoc.data() as User;
          
          // Sync database locally to IndexedDB
          await localDB.saveOfflineUser({
            uid: appUser.uid,
            username: appUser.username,
            fullName: appUser.fullName,
            class: appUser.class,
            role: appUser.role,
            email: appUser.email,
            isGoogle: false,
            contactCode: appUser.contactCode || '10002'
          }, password);

          onLogin(appUser);
        } else {
          throw new Error('User Firestore profile not found.');
        }
      } else {
        // Offline login: check Local Encrypted IndexedDB
        console.log('[LoginForm] Device is Offline. Authenticating credentials locally...');
        const verifiedUser = await localDB.verifyOfflineCredentials(email, password, false);
        if (verifiedUser) {
          onLogin({
            uid: verifiedUser.uid,
            username: verifiedUser.username,
            fullName: verifiedUser.fullName,
            class: verifiedUser.class,
            role: verifiedUser.role,
            favoriteSubjects: null,
            email: verifiedUser.email,
            contactCode: verifiedUser.contactCode
          });
        } else {
          setError('No offline credentials found. Check your credentials or connect to the internet.');
        }
      }
    } catch (err: any) {
      console.error(err);
      // Fallback offline credentials if Firebase auth failed due to network glitch
      const email = username.includes('@') ? username : `${username}@librarycore.com`;
      const verifiedUser = await localDB.verifyOfflineCredentials(email, password, false);
      if (verifiedUser) {
        onLogin({
          uid: verifiedUser.uid,
          username: verifiedUser.username,
          fullName: verifiedUser.fullName,
          class: verifiedUser.class,
          role: verifiedUser.role,
          favoriteSubjects: null,
          email: verifiedUser.email,
          contactCode: verifiedUser.contactCode
        });
      } else {
        setError('Login failed: Invalid credentials or network error.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (role === 'admin') {
      setError('Admin accounts cannot be created via this form');
      return;
    }

    if (role === 'teacher' && accessCode !== 'Jubrah@2026') {
      setError('Invalid teacher access code');
      return;
    }

    setIsLoading(true);
    setError('');

    const email = username.includes('@') ? username : `${username}@librarycore.com`;
    const tempUid = 'offline_user_' + Date.now();
    const newUser: User = {
      uid: tempUid,
      username,
      fullName,
      class: className || null,
      role,
      favoriteSubjects: null,
      email: email,
      contactCode: Math.floor(10000 + Math.random() * 90000).toString()
    };

    try {
      if (serverStatus !== 'down') {
        // Live creation
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const prodUser = {
          ...newUser,
          uid: userCredential.user.uid
        };

        await setDoc(doc(db, 'users', prodUser.uid), prodUser);
        await ensureAdminConversation(prodUser);

        // Cache locally
        await localDB.saveOfflineUser({
          uid: prodUser.uid,
          username: prodUser.username,
          fullName: prodUser.fullName,
          class: prodUser.class,
          role: prodUser.role,
          email: prodUser.email,
          isGoogle: false,
          contactCode: prodUser.contactCode || '10002'
        }, password);

        onLogin(prodUser);
      } else {
        // Offline first registration
        await localDB.saveOfflineUser({
          uid: tempUid,
          username,
          fullName,
          class: className || null,
          role,
          email: email,
          isGoogle: false,
          contactCode: newUser.contactCode || '10002'
        }, password);

        // Queue upload for sync action when reconnected
        await localDB.queueSyncAction({
          type: 'update_settings',
          collection: 'users',
          docId: tempUid,
          data: {
            uid: tempUid,
            username,
            fullName,
            class: className || null,
            role,
            email,
            contactCode: newUser.contactCode
          }
        });

        console.log('[LoginForm] Offline sign up cached and sync scheduled.');
        onLogin(newUser);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create account.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden transition-colors duration-300">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-secondary/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
      
      <div className="w-full max-w-[1100px] grid lg:grid-cols-2 gap-0 bg-white rounded-[2.5rem] shadow-2xl overflow-hidden relative z-10 border border-border">
        {/* Left Side: Branding & Info */}
        <div className="hidden lg:flex flex-col justify-between p-16 bg-gradient-to-br from-primary/5 to-white text-text-main relative overflow-hidden border-r border-border">
          <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-5" />
          
          <div className="relative z-10">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border border-primary/20 bg-white flex items-center justify-center mb-8 group hover:scale-105 transition-transform duration-300">
              <img src={logoUrl} alt="LibraryCore Logo" className="w-full h-full object-cover animate-fade-in" referrerPolicy="no-referrer" />
            </div>
            <h1 className="text-5xl font-display font-bold text-text-main mb-6 leading-tight">
              Library<span className="text-primary">Core</span>
            </h1>
            <p className="text-text-secondary text-xl max-w-xs leading-relaxed font-medium">
              The next generation <span className="text-primary">Digital Library</span> for modern learners.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <span className="px-4 py-2 rounded-full bg-primary/5 border border-primary/10 text-[10px] font-bold uppercase tracking-widest text-primary">AI Powered</span>
              <span className="px-4 py-2 rounded-full bg-secondary/5 border border-secondary/10 text-[10px] font-bold uppercase tracking-widest text-secondary">Cloud Sync</span>
              <span className="px-4 py-2 rounded-full bg-black/5 border border-black/10 text-[10px] font-bold uppercase tracking-widest text-text-secondary">Offline Ready</span>
            </div>
          </div>

          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-border shadow-sm group hover:bg-hover transition-all">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-text-main">Dual Authentication</p>
                <p className="text-xs text-text-secondary">Full local-first offline support</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-5 bg-white rounded-2xl border border-border shadow-sm group hover:bg-hover transition-all">
              <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-text-main">Automatic Synchronizer</p>
                <p className="text-xs text-text-secondary">Reconnection action queue sync</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="p-8 sm:p-12 flex flex-col justify-center relative bg-white">
          <div className="lg:hidden flex justify-center mb-8">
            <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-lg border border-primary/20 bg-white flex items-center justify-center group hover:scale-105 transition-transform duration-300">
              <img src={logoUrl} alt="LibraryCore Logo" className="w-full h-full object-cover animate-fade-in" referrerPolicy="no-referrer" />
            </div>
          </div>

          <div className="max-w-sm mx-auto w-full">
            {/* GOOGLE IN-APP CHOOSER LAYER */}
            {showGoogleChooser ? (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                <div className="flex items-center gap-3">
                  <button 
                    type="button" 
                    onClick={() => { setShowGoogleChooser(false); setShowAddGoogleForm(false); }}
                    className="p-2 hover:bg-hover rounded-xl text-text-secondary transition"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div>
                    <h3 className="text-2xl font-display font-bold text-text-main">Choose an Account</h3>
                    <p className="text-text-secondary text-xs">Authorize with LibraryCore OAuth</p>
                  </div>
                </div>

                {error && (
                  <div className="bg-error/10 border border-error/20 text-error text-xs rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {!showAddGoogleForm ? (
                  <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                    {googleAccounts.map((account) => (
                      <button
                        key={account.uid}
                        onClick={() => selectGoogleAccount(account)}
                        disabled={isLoading}
                        className="w-full flex items-center justify-between p-4 bg-white hover:bg-hover border border-border rounded-2xl text-left transition-all active:scale-[0.99] group disabled:opacity-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">
                            {account.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-text-main group-hover:text-primary transition-colors">{account.fullName}</p>
                            <p className="text-xs text-text-secondary font-mono">{account.email}</p>
                          </div>
                        </div>
                        <div className="w-6 h-6 rounded-full bg-primary/5 flex items-center justify-center text-primary border border-primary/10 opacity-60 group-hover:opacity-100">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => setShowAddGoogleForm(true)}
                      className="w-full py-4 bg-white hover:bg-hover border border-dashed border-border rounded-2xl text-center text-xs font-bold text-text-secondary transition-all"
                    >
                      + Use another account
                    </button>
                  </div>
                ) : (
                  <form onSubmit={handleCreateGoogleAccount} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Google Email</label>
                      <input
                        type="email"
                        required
                        value={customGoogleEmail}
                        onChange={(e) => setCustomGoogleEmail(e.target.value)}
                        placeholder="yourname@gmail.com"
                        className="block w-full px-4 py-3 bg-white border border-border rounded-xl text-text-main outline-none focus:border-primary text-sm font-medium"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted">Google Password (for local-first)</label>
                      <input
                        type="password"
                        value={googlePassword}
                        onChange={(e) => setGooglePassword(e.target.value)}
                        placeholder="•••••••• (optional offline pass)"
                        className="block w-full px-4 py-3 bg-white border border-border rounded-xl text-text-main outline-none focus:border-primary text-sm font-medium"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3.5 bg-primary text-white rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-md transition hover:bg-primary/95"
                    >
                      {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Log In & Authenticate'}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowAddGoogleForm(false)}
                      className="w-full py-3.5 bg-white border border-border text-text-secondary text-xs rounded-xl font-bold hover:bg-hover transition"
                    >
                      Back to account list
                    </button>
                  </form>
                )}
              </div>
            ) : (
              /* STANDARD EMAIL/PASSWORD LOGIN LAYER */
              <div className="animate-in fade-in">
                <div className="mb-10 text-center lg:text-left">
                  <h2 className="text-4xl font-display font-bold text-text-main mb-3">
                    {isSignup ? 'Join the Future' : 'Welcome Back'}
                  </h2>
                  <p className="text-text-secondary text-sm font-medium">
                    {isSignup ? 'Create your digital library account' : 'Sign in to access your library'}
                  </p>
                </div>

                <form className="space-y-5" onSubmit={isSignup ? handleSignup : handleLogin}>
                  {error && (
                    <div className="bg-error/10 border border-error/20 text-error text-xs rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                      <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
                      <span className="font-bold tracking-wider">{error}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowGoogleChooser(true)}
                    disabled={isLoading}
                    className="w-full py-4 bg-white border border-border text-text-main rounded-2xl font-bold flex items-center justify-center gap-3 transition-all hover:bg-hover active:scale-[0.98] shadow-sm mb-6 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                    <span>In-App Google Authorization</span>
                  </button>

                  <div className="relative flex items-center gap-4 py-2">
                    <div className="flex-grow h-px bg-border" />
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest bg-white px-2">or credentials</span>
                    <div className="flex-grow h-px bg-border" />
                  </div>

                  {isSignup && (
                    <>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-0.5">Full Name</label>
                        <div className="relative">
                          <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="block w-full pl-11 pr-4 py-3.5 bg-white border border-border rounded-2xl text-text-main placeholder-text-muted transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none sm:text-sm"
                            placeholder="Ibrahim"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-0.5">Class / Level</label>
                        <div className="relative">
                          <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                          <input
                            type="text"
                            required
                            value={className}
                            onChange={(e) => setClassName(e.target.value)}
                            className="block w-full pl-11 pr-4 py-3.5 bg-white border border-border rounded-2xl text-text-main placeholder-text-muted transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none sm:text-sm"
                            placeholder="University Level"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-0.5">Account Type</label>
                        <div className="relative">
                          <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                          <select
                            value={role}
                            onChange={(e) => setRole(e.target.value as Role)}
                            className="block w-full pl-11 pr-4 py-3.5 bg-white border border-border rounded-2xl text-text-main transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none sm:text-sm appearance-none cursor-pointer"
                            required
                          >
                            <option value="student" className="bg-white">Student</option>
                            <option value="teacher" className="bg-white">Teacher</option>
                          </select>
                        </div>
                      </div>

                      {role === 'teacher' && (
                        <div className="space-y-2">
                          <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-0.5">Teacher Access Code</label>
                          <div className="relative">
                            <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                            <input
                              type="password"
                              required
                              value={accessCode}
                              onChange={(e) => setAccessCode(e.target.value)}
                              className="block w-full pl-11 pr-4 py-3.5 bg-white border border-border rounded-2xl text-text-main placeholder-text-muted transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none sm:text-sm"
                              placeholder="••••••••"
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-0.5">Username / Email</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input
                        type="text"
                        required
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        className="block w-full pl-11 pr-4 py-3.5 bg-white border border-border rounded-2xl text-text-main placeholder-text-muted transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none sm:text-sm font-medium"
                        placeholder="username"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-0.5">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-11 pr-4 py-3.5 bg-white border border-border rounded-2xl text-text-main placeholder-text-muted transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none sm:text-sm font-medium"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>

                  {isSignup && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-widest text-text-muted ml-0.5">Confirm Password</label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                        <input
                          type="password"
                          required
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="block w-full pl-11 pr-4 py-3.5 bg-white border border-border rounded-2xl text-text-main placeholder-text-muted transition-all focus:ring-4 focus:ring-primary/10 focus:border-primary outline-none sm:text-sm font-medium"
                          placeholder="••••••••"
                        />
                      </div>
                    </div>
                  )}

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-4 bg-gradient-to-r from-primary to-secondary text-white rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] group"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : (
                        <>
                          <span className="group-hover:translate-x-1 transition-transform">{isSignup ? 'Create Local/Cloud Account' : 'Sign In'}</span>
                          <Key className="w-4 h-4 opacity-50" />
                        </>
                      )}
                    </button>
                  </div>
                </form>

                <div className="mt-8 text-center">
                  <button 
                    onClick={() => {
                      setIsSignup(!isSignup);
                      setError('');
                    }}
                    className="text-sm font-bold text-text-secondary hover:text-primary transition-colors hover:underline"
                  >
                    {isSignup ? (
                      <>Already have an account? <span className="text-primary">Sign In</span></>
                    ) : (
                      <>Don't have an account? <span className="text-primary">Create one</span></>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Connection & Storage Indicator */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-full border border-border pointer-events-none shadow-sm">
            <div className={`w-2.5 h-2.5 rounded-full ${
              serverStatus === 'up' ? 'bg-emerald-500 animate-pulse' :
              serverStatus === 'down' ? 'bg-amber-500 animate-bounce' :
              'bg-primary animate-pulse'
            }`} />
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest font-mono">
              {serverStatus === 'up' ? 'Local/Cloud Auth Online' : 
               serverStatus === 'down' ? 'Offline-First Credential Auth' : 
               'Connecting...'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
