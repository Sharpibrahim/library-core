import React, { useState, useEffect } from 'react';
import { User as UserIcon, Lock, Loader2, ShieldCheck, Key, BookOpen, Bot, Globe, AlertCircle } from 'lucide-react';
import { Role, User } from '../types';
import { auth, db } from '../firebase';
const logoUrl = '/logo.png';
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

  // Google-related integrations removed per overall admin instructions

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

  // Google Authorization workflows removed per overall admin instructions

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      let email = username.trim();
      let lowercaseInput = email.toLowerCase();
      let isAdminMatch = false;

      // Special check for overall admin credentials
      if (lowercaseInput === 'sharpwhite' || lowercaseInput === 'sharpibrah@gmail.com') {
        if (password === 'SunnyDay@2026') {
          email = 'sharpibrah@gmail.com';
          isAdminMatch = true;
        }
      }

      if (!email.includes('@')) {
        email = `${email}@librarycore.com`;
      }

      if (serverStatus !== 'down') {
        // Online login: attempt Firebase Auth first
        let userCredential;
        try {
          userCredential = await signInWithEmailAndPassword(auth, email, password);
        } catch (signInErr: any) {
          // If the admin user doesn't exist yet, automatically create it
          if (isAdminMatch && (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/wrong-password' || signInErr.code === 'auth/invalid-credential')) {
            try {
              userCredential = await createUserWithEmailAndPassword(auth, email, password);
            } catch (signUpErr: any) {
              if (signUpErr.code === 'auth/email-already-in-use') {
                throw new Error('Admin credentials mismatch with the existing account in Cloud Authentication.');
              }
              throw signUpErr;
            }
          } else {
            throw signInErr;
          }
        }

        const userDocRef = doc(db, 'users', userCredential.user.uid);
        let appUser: User;

        if (isAdminMatch) {
          // Force overwrite/configure the exact admin details including role, fullName, username and email
          appUser = {
            uid: userCredential.user.uid,
            username: 'SharpWhite',
            fullName: 'Sharp White',
            class: 'System Admin',
            role: 'admin' as Role,
            favoriteSubjects: null,
            email: 'sharpibrah@gmail.com',
            contactCode: '10001'
          };
          await setDoc(userDocRef, appUser, { merge: true });
        } else {
          const userDoc = await getDoc(userDocRef);
          if (userDoc.exists()) {
            appUser = userDoc.data() as User;
          } else {
            throw new Error('User Firestore profile not found.');
          }
        }

        // Sync database locally to IndexedDB
        await localDB.saveOfflineUser({
          uid: appUser.uid,
          username: appUser.username,
          fullName: appUser.fullName,
          class: appUser.class,
          role: appUser.role,
          email: appUser.email,
          isGoogle: false,
          contactCode: appUser.contactCode || '10001'
        }, password);

        onLogin(appUser);
      } else {
        // Offline login: check Local Encrypted IndexedDB
        if (isAdminMatch) {
          const offlineAdmin: User = {
            uid: 'admin_uid_fallback_offline',
            username: 'SharpWhite',
            fullName: 'Sharp White',
            class: 'System Admin',
            role: 'admin' as Role,
            favoriteSubjects: null,
            email: 'sharpibrah@gmail.com',
            contactCode: '10001'
          };
          await localDB.saveOfflineUser({
            uid: offlineAdmin.uid,
            username: offlineAdmin.username,
            fullName: offlineAdmin.fullName,
            class: offlineAdmin.class,
            role: offlineAdmin.role,
            email: offlineAdmin.email,
            isGoogle: false,
            contactCode: offlineAdmin.contactCode
          }, password);
          onLogin(offlineAdmin);
          setIsLoading(false);
          return;
        }

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
      
      let email = username.trim();
      let lowercaseInput = email.toLowerCase();
      let isAdminMatch = false;

      if (lowercaseInput === 'sharpwhite' || lowercaseInput === 'sharpibrah@gmail.com') {
        if (password === 'SunnyDay@2026') {
          email = 'sharpibrah@gmail.com';
          isAdminMatch = true;
        }
      }

      if (!email.includes('@')) {
        email = `${email}@librarycore.com`;
      }

      if (isAdminMatch) {
        const offlineAdmin: User = {
          uid: 'admin_uid_fallback_offline',
          username: 'SharpWhite',
          fullName: 'Sharp White',
          class: 'System Admin',
          role: 'admin' as Role,
          favoriteSubjects: null,
          email: 'sharpibrah@gmail.com',
          contactCode: '10001'
        };
        await localDB.saveOfflineUser({
          uid: offlineAdmin.uid,
          username: offlineAdmin.username,
          fullName: offlineAdmin.fullName,
          class: offlineAdmin.class,
          role: offlineAdmin.role,
          email: offlineAdmin.email,
          isGoogle: false,
          contactCode: offlineAdmin.contactCode
        }, password);
        onLogin(offlineAdmin);
        setIsLoading(false);
        return;
      }

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
        setError(err.message || 'Login failed: Invalid credentials or network error.');
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
            {/* STANDARD EMAIL/PASSWORD LOGIN LAYER */}
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
