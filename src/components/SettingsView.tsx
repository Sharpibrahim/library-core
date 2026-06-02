import React, { useState, useRef, useEffect } from 'react';
import { 
  User, 
  Palette, 
  Bell, 
  Lock, 
  BookOpen, 
  Bot, 
  BarChart3, 
  Cloud, 
  Users, 
  GraduationCap, 
  Settings as SettingsIcon, 
  Zap,
  Search,
  ChevronRight,
  Camera,
  Key,
  Mail,
  Phone,
  Globe,
  Monitor,
  Moon,
  Sun,
  Type,
  Layout,
  Volume2,
  Shield,
  Eye,
  EyeOff,
  History,
  Smartphone,
  Download,
  Trash2,
  RefreshCw,
  MessageSquare,
  Clock,
  Calendar,
  CheckCircle2,
  Sparkles,
  BrainCircuit,
  Lightbulb,
  Languages,
  Keyboard,
  Command,
  HelpCircle,
  AlertCircle,
  Loader2,
  Save as SaveIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User as UserType } from '../types';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface SettingsViewProps {
  user: UserType;
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
  onUserUpdate: (user: UserType) => void;
}

type SettingModule = 
  | 'profile' 
  | 'appearance' 
  | 'notifications' 
  | 'reading' 
  | 'ai' 
  | 'security' 
  | 'data';

export function SettingsView({ user, theme, onThemeChange, onUserUpdate }: SettingsViewProps) {
  const [activeModule, setActiveModule] = useState<SettingModule>('profile');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Local state for profile edits
  const [editedUser, setEditedUser] = useState<UserType>({ ...user });

  useEffect(() => {
    setEditedUser({ ...user });
  }, [user]);
  
  // UI Preferences (Local)
  const [uiSize, setUiSize] = useState('medium');
  const [fontSize, setFontSize] = useState(16);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 3 * 1024 * 1024) {
        alert('File is too large. Please select an image under 3MB.');
        return;
      }
      
      setIsSaving(true);
      setSaveStatus('idle');

      try {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error('Avatar upload to server failed');
        }

        const data = await response.json();
        const fileUrl = data.url; // /uploads/filename

        // Update Firestore
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          avatarUrl: fileUrl
        });

        const newUserData = { ...user, ...editedUser, avatarUrl: fileUrl };
        setEditedUser(newUserData);
        onUserUpdate(newUserData);

        setSaveStatus('success');
        setTimeout(() => setSaveStatus('idle'), 3000);
      } catch (err: any) {
        console.warn("Express avatar upload failed. Attempting offline Base64 fallback...", err);
        
        // Fallback to local Base64 reading if offline or server fails
        const reader = new FileReader();
        reader.onload = async (event) => {
          const base64Data = event.target?.result as string;
          setEditedUser(prev => ({ ...prev, avatarUrl: base64Data }));
          try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              avatarUrl: base64Data
            });
            const newUserData = { ...user, ...editedUser, avatarUrl: base64Data };
            onUserUpdate(newUserData);
            setSaveStatus('success');
            setTimeout(() => setSaveStatus('idle'), 3000);
          } catch (docErr) {
            console.error("Offline base64 update fallback failed:", docErr);
            setSaveStatus('error');
          }
        };
        reader.readAsDataURL(file);
      } finally {
        setIsSaving(false);
      }
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        fullName: editedUser.fullName,
        email: editedUser.email || '',
        avatarUrl: editedUser.avatarUrl || (window as any).firebaseUser?.photoURL || ''
      });
      onUserUpdate(editedUser);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Error updating profile:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const modules = [
    { id: 'profile', label: 'Profile', icon: User, color: 'text-violet-600' },
    { id: 'appearance', label: 'Appearance', icon: Palette, color: 'text-sky-500' },
    { id: 'notifications', label: 'Notifications', icon: Bell, color: 'text-violet-600' },
    { id: 'reading', label: 'Reading Preferences', icon: BookOpen, color: 'text-sky-500' },
    { id: 'ai', label: 'AI Settings', icon: Bot, color: 'text-violet-600' },
    { id: 'security', label: 'Privacy & Security', icon: Shield, color: 'text-sky-500' },
    { id: 'data', label: 'Data & Storage', icon: Layout, color: 'text-violet-600' },
  ];

  const renderModuleContent = () => {
    switch (activeModule) {
      case 'profile':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-6 rounded-2xl border border-violet-100/50 shadow-xl shadow-gray-200/40 space-y-6 relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 to-sky-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex flex-col items-center gap-4 pb-6 border-b border-gray-50">
                <div className="relative group/avatar">
                  <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-violet-600 to-sky-400 shadow-lg shadow-violet-500/20">
                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-white">
                      <img 
                        src={editedUser.avatarUrl || (window as any).firebaseUser?.photoURL || `https://api.dicebear.com/7.x/initials/svg?seed=${editedUser.fullName}`} 
                        alt="Profile" 
                        className="w-full h-full object-cover group-hover/avatar:scale-110 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                    </div>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleAvatarUpload} 
                    accept="image/*" 
                    className="hidden" 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-0 right-0 p-2 bg-white border border-gray-200 rounded-full shadow-lg hover:bg-gray-50 transition-all hover:scale-110 active:scale-95"
                    title="Upload Profile Picture"
                  >
                    <Camera className="w-4 h-4 text-violet-600" />
                  </button>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Full Name</label>
                  <input 
                    type="text" 
                    value={editedUser.fullName}
                    onChange={e => setEditedUser({ ...editedUser, fullName: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600 focus:outline-none font-medium transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Email Address</label>
                  <input 
                    type="email" 
                    value={editedUser.email || ''}
                    onChange={e => setEditedUser({ ...editedUser, email: e.target.value })}
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600 focus:outline-none font-medium transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">New Password</label>
                  <div className="relative">
                    <input 
                      type="password" 
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-gray-50/50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-violet-600/20 focus:border-violet-600 focus:outline-none font-medium transition-all"
                    />
                    <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
              
              <div className="pt-6 flex justify-end">
                <button 
                  onClick={handleSave} 
                  disabled={isSaving}
                  className="px-8 py-3 bg-violet-600 text-white font-bold text-xs uppercase tracking-[0.2em] rounded-xl hover:bg-violet-700 transition-all shadow-xl shadow-violet-600/40 flex items-center gap-3 active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Update Identity
                </button>
              </div>
            </div>
          </div>
        );

      case 'appearance':
        return (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-8 rounded-2xl border border-violet-100/50 shadow-xl shadow-gray-200/40 space-y-10">
              <section className="space-y-4">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Visual Environment</h4>
                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => onThemeChange('light')}
                    className={`group relative p-6 rounded-2xl border-2 transition-all duration-500 overflow-hidden ${theme === 'light' ? 'border-violet-600 bg-violet-50/30' : 'border-gray-100 bg-gray-50/50 grayscale hover:grayscale-0'}`}
                  >
                    <div className="relative z-10 flex flex-col items-center gap-4 text-center">
                      <div className={`p-4 rounded-xl ${theme === 'light' ? 'bg-white shadow-lg text-violet-600' : 'bg-white text-gray-400 group-hover:text-violet-400 shadow-sm'}`}>
                        <Sun className="w-6 h-6" />
                      </div>
                      <span className={`font-bold text-sm tracking-tight ${theme === 'light' ? 'text-violet-900' : 'text-gray-500'}`}>Studio Light</span>
                    </div>
                  </button>
                  <button 
                    onClick={() => onThemeChange('dark')}
                    className={`group relative p-6 rounded-2xl border-2 transition-all duration-500 overflow-hidden ${theme === 'dark' ? 'border-violet-600 bg-violet-50/30' : 'border-gray-100 bg-gray-50/50 grayscale hover:grayscale-0'}`}
                  >
                    <div className="relative z-10 flex flex-col items-center gap-4 text-center">
                      <div className={`p-4 rounded-xl ${theme === 'dark' ? 'bg-white shadow-lg text-violet-600' : 'bg-white text-gray-400 group-hover:text-violet-400 shadow-sm'}`}>
                        <Moon className="w-6 h-6" />
                      </div>
                      <span className={`font-bold text-sm tracking-tight ${theme === 'dark' ? 'text-violet-900' : 'text-gray-500'}`}>Library Dark</span>
                    </div>
                  </button>
                </div>
              </section>

              <div className="grid md:grid-cols-2 gap-8">
                <section className="space-y-4">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Interface Scale</h4>
                  <div className="flex bg-gray-50/50 p-1.5 rounded-2xl border border-gray-100">
                    {['Small', 'Medium', 'Large'].map(size => (
                      <button 
                        key={size}
                        onClick={() => setUiSize(size.toLowerCase())}
                        className={`flex-1 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all ${uiSize === size.toLowerCase() ? 'bg-white shadow-md text-violet-600 border border-violet-100' : 'text-gray-400 hover:text-gray-600'}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Typography Size</h4>
                    <span className="font-mono text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded">{fontSize}px</span>
                  </div>
                  <div className="pt-2">
                    <input 
                      type="range" 
                      min="12" 
                      max="24" 
                      value={fontSize}
                      onChange={e => setFontSize(parseInt(e.target.value))}
                      className="w-full h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-violet-600" 
                    />
                    <div className="flex justify-between mt-2 font-mono text-[9px] text-gray-400">
                      <span>12PX</span>
                      <span>24PX</span>
                    </div>
                  </div>
                </section>
              </div>
            </div>
          </div>
        );

      case 'notifications':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-4 rounded-2xl border border-violet-100/50 shadow-xl shadow-gray-200/40 space-y-2">
              {[
                { id: 'master', label: 'Push Notifications', sub: 'Enable master system-level alerts', icon: Bell, active: true },
                { id: 'assign', label: 'Assignment Alerts', sub: 'Deadline reminders and grading info', icon: Clock, active: true },
                { id: 'reading', label: 'Reading Reminders', sub: 'Daily streaks and motivational prompts', icon: BookOpen, active: false },
                { id: 'announc', label: 'Class Announcements', sub: 'Latest news from enrolled classrooms', icon: Sparkles, active: true },
              ].map((item) => (
                <div key={item.id} className="flex items-center justify-between p-5 rounded-2xl hover:bg-gray-50/80 transition-all border border-transparent hover:border-violet-50 group">
                  <div className="flex items-center gap-5">
                    <div className={`p-3 rounded-2xl transition-all ${item.active ? 'bg-violet-50 text-violet-600 shadow-sm' : 'bg-gray-50 text-gray-400 group-hover:bg-white border border-gray-100'}`}>
                      <item.icon className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-bold text-sm text-gray-900 tracking-tight">{item.label}</p>
                      <p className="text-[11px] text-gray-400 font-medium">{item.sub}</p>
                    </div>
                  </div>
                  <button className={`w-12 h-6 rounded-full p-1.5 flex transition-all duration-500 ${item.active ? 'bg-violet-600 justify-end' : 'bg-gray-200 justify-start'}`}>
                    <motion.div layout transition={{ type: 'spring', damping: 20, stiffness: 300 }} className="w-3 h-3 bg-white rounded-full shadow-lg" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      case 'reading':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-4 rounded-2xl border border-violet-100/50 shadow-xl shadow-gray-200/40 grid md:grid-cols-2 gap-2">
              {[
                { label: 'Auto-resume', sub: 'Instant start logic', enabled: true, icon: RefreshCw },
                { label: 'Focus Mode', sub: 'Total immersion', enabled: false, icon: EyeOff },
                { label: 'Cloud Sync', sub: 'Cross-device library', enabled: true, icon: Cloud },
                { label: 'Notes UI', sub: 'Margin annotations', enabled: true, icon: MessageSquare },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-6 rounded-2xl border border-gray-50 hover:border-sky-100 hover:bg-sky-50/20 transition-all">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <item.icon className={`w-3 h-3 ${item.enabled ? 'text-sky-500' : 'text-gray-300'}`} />
                      <p className="font-bold text-xs text-gray-900 uppercase tracking-wider">{item.label}</p>
                    </div>
                    <p className="text-[10px] text-gray-400 font-medium">{item.sub}</p>
                  </div>
                  <button className={`w-10 h-5 rounded-full p-1 flex transition-all duration-300 ${item.enabled ? 'bg-sky-500 justify-end' : 'bg-gray-200 justify-start'}`}>
                    <div className="w-3 h-3 bg-white rounded-full shadow-md" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        );

      case 'ai':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-8 rounded-2xl border border-violet-100/50 shadow-xl shadow-gray-200/40 space-y-8">
              <div className="flex flex-col items-center text-center space-y-4 p-8 bg-gradient-to-br from-violet-50 to-sky-50 rounded-3xl border border-white shadow-inner">
                 <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-xl shadow-violet-200 border border-violet-50">
                   <Bot className="w-8 h-8 text-violet-600" />
                 </div>
                 <div>
                   <h3 className="text-lg font-bold text-gray-900">Sharp Intelligence</h3>
                   <p className="text-xs text-gray-500 font-medium">Next-gen educational companion</p>
                 </div>
                 <button className="px-6 py-2 bg-violet-600 text-white font-black text-[10px] uppercase tracking-widest rounded-full shadow-lg shadow-violet-600/30">
                   Active Engine
                 </button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="p-5 bg-gray-50/50 rounded-2xl border border-gray-100 space-y-3">
                  <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Pedagogy Level</label>
                  <select className="w-full px-4 py-3 border border-gray-100 rounded-xl bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-violet-600 transition-all">
                    <option>Simple (Beginner)</option>
                    <option>Detailed (Advanced)</option>
                  </select>
                </div>
                <div className="p-5 bg-gray-50/50 rounded-2xl border border-gray-100 flex items-center justify-between">
                   <div>
                     <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Context Tracking</p>
                     <p className="text-[11px] font-bold text-gray-900">Enhanced Memory</p>
                   </div>
                   <button className="w-10 h-5 bg-violet-600 rounded-full p-1 flex justify-end">
                      <div className="w-3 h-3 bg-white rounded-full" />
                   </button>
                </div>
              </div>

              <div className="space-y-3">
                 {[
                   { label: 'Auto Summaries', icon: Sparkles, color: 'text-violet-600' },
                   { label: 'Dynamic Quizzes', icon: Lightbulb, color: 'text-sky-500' }
                 ].map((tool, i) => (
                   <div key={i} className="flex items-center justify-between p-5 bg-white border border-gray-100 rounded-2xl hover:border-violet-200 transition-all shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg bg-gray-50 ${tool.color}`}>
                          <tool.icon className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-gray-800">{tool.label}</span>
                      </div>
                      <div className="w-10 h-5 bg-violet-600 rounded-full p-1 flex justify-end">
                        <div className="w-3 h-3 bg-white rounded-full" />
                      </div>
                   </div>
                 ))}
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-8 rounded-2xl border border-violet-100/50 shadow-xl shadow-gray-200/40 space-y-10">
              <section className="space-y-4">
                 <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Auth Protocols</h4>
                 <div className="grid md:grid-cols-2 gap-4">
                    <button className="group p-6 rounded-2xl border border-gray-100 bg-gray-50/30 hover:bg-white hover:border-violet-600 hover:shadow-xl hover:shadow-violet-100 transition-all text-left space-y-3">
                       <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-violet-600 transition-colors">
                         <Key className="w-5 h-5" />
                       </div>
                       <div>
                         <p className="font-bold text-sm text-gray-900">Credential Refresh</p>
                         <p className="text-[10px] text-gray-400 font-medium">Update current password</p>
                       </div>
                    </button>
                    <button className="group p-6 rounded-2xl border border-gray-100 bg-gray-50/30 hover:bg-white hover:border-sky-500 hover:shadow-xl hover:shadow-sky-100 transition-all text-left space-y-3">
                       <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-gray-400 group-hover:text-sky-500 transition-colors">
                         <Shield className="w-5 h-5" />
                       </div>
                       <div>
                         <div className="flex items-center justify-between">
                            <p className="font-bold text-sm text-gray-900">Matrix Protection</p>
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 group-hover:bg-sky-50 group-hover:text-sky-500">2FA</span>
                         </div>
                         <p className="text-[10px] text-gray-400 font-medium">Multi-factor security</p>
                       </div>
                    </button>
                 </div>
              </section>

              <section className="pt-8 border-t border-gray-100 space-y-4">
                <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Visibility Control</h4>
                <div className="flex items-center justify-between p-6 rounded-3xl bg-gray-50/50 border border-gray-100">
                   <div className="flex items-center gap-5">
                      <div className="p-3 bg-white rounded-2xl shadow-sm text-gray-400">
                        <Eye className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-bold text-sm text-gray-900">Public Profile Sync</p>
                        <p className="text-[11px] text-gray-400 font-medium">Visible to other students</p>
                      </div>
                   </div>
                   <button className="w-12 h-6 bg-violet-600 rounded-full p-1.5 flex justify-end">
                      <div className="w-3 h-3 bg-white rounded-full shadow-lg" />
                   </button>
                </div>
              </section>

              <button className="w-full py-4 rounded-2xl bg-red-50 text-red-500 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-red-500 hover:text-white transition-all duration-500 shadow-lg shadow-red-200">
                 Purge Session & Sign Out
              </button>
            </div>
          </div>
        );

      case 'data':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-8 rounded-2xl border border-violet-100/50 shadow-xl shadow-gray-200/40 space-y-8">
              <section className="space-y-5">
                 <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Environment Volume</h4>
                    <span className="font-mono text-xs font-bold text-gray-600">2.4<span className="text-[10px] text-gray-400 mx-1">GB</span> / 10<span className="text-[10px] text-gray-400 mx-1">GB</span></span>
                 </div>
                 <div className="relative w-full h-4 bg-gray-100 rounded-full overflow-hidden p-1">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '24%' }}
                      transition={{ duration: 1.5, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-violet-600 via-violet-500 to-sky-400 rounded-full shadow-[0_0_10px_rgba(124,58,237,0.3)]" 
                    />
                 </div>
                 <div className="flex gap-6 text-[9px] font-black uppercase tracking-[0.2em]">
                    <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-violet-600 shadow-sm" /> Digital Library</span>
                    <span className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-sm bg-sky-400 shadow-sm" /> System Cache</span>
                 </div>
              </section>

              <div className="grid grid-cols-2 gap-4">
                 <button className="p-6 rounded-2xl bg-gray-50/50 border border-gray-100 hover:bg-white hover:border-violet-600 hover:shadow-xl transition-all space-y-3 group text-left">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-gray-400 group-hover:text-violet-600 transition-colors shadow-sm">
                      <RefreshCw className="w-5 h-5" />
                    </div>
                    <p className="font-black text-[9px] uppercase tracking-widest text-gray-600">Sync Wipe</p>
                    <p className="text-[10px] text-gray-400 font-medium">Reset local cache</p>
                 </button>
                 <button className="p-6 rounded-2xl bg-gray-50/50 border border-gray-100 hover:bg-white hover:border-sky-500 hover:shadow-xl transition-all space-y-3 group text-left">
                    <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-gray-400 group-hover:text-sky-500 transition-colors shadow-sm">
                      <Download className="w-5 h-5" />
                    </div>
                    <p className="font-black text-[9px] uppercase tracking-widest text-gray-600">Export Ledger</p>
                    <p className="text-[10px] text-gray-400 font-medium">Download all data</p>
                 </button>
              </div>

              <div className="p-6 bg-gradient-to-r from-sky-50 to-white rounded-3xl border border-sky-100 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center text-sky-500 border border-sky-50">
                      <Cloud className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-sky-600 uppercase tracking-widest">Real-time Matrix</p>
                      <p className="text-sm font-bold text-gray-900">Background Data Syncing</p>
                    </div>
                 </div>
                 <button className="w-12 h-6 bg-sky-500 rounded-full p-1.5 flex justify-end shadow-lg shadow-sky-200">
                    <div className="w-3 h-3 bg-white rounded-full shadow-md" />
                 </button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-top-4 duration-1000 font-sans pb-10">
      <div className="relative">
        <h1 className="text-5xl font-black text-slate-900 tracking-tight mb-4 flex items-center gap-4">
           Settings
           <div className="h-2 w-2 rounded-full bg-violet-600" />
        </h1>
        <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.4em] ml-1">Universal Command Center</p>
      </div>

      <div className="grid lg:grid-cols-4 gap-12 items-start">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1 space-y-2 sticky top-24">
          <div className="p-2 bg-gray-50/50 rounded-3xl border border-gray-100 backdrop-blur-xl">
            {modules.map((mod) => (
              <button
                key={mod.id}
                onClick={() => setActiveModule(mod.id as SettingModule)}
                className={`
                  relative w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-500 group
                  ${activeModule === mod.id 
                    ? 'text-violet-600' 
                    : 'text-slate-400 hover:text-slate-900 hover:bg-white'}
                `}
              >
                {activeModule === mod.id && (
                  <motion.div 
                    layoutId="sidebar-active"
                    className="absolute inset-0 bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.04)] border border-gray-100"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className={`relative z-10 transition-transform duration-500 ${activeModule === mod.id ? 'scale-110' : 'group-hover:scale-105'}`}>
                  <mod.icon className="w-4 h-4" />
                </div>
                <span className="relative z-10 font-bold text-xs uppercase tracking-widest leading-none">{mod.label}</span>
                {activeModule === mod.id && (
                  <motion.div 
                    layoutId="active-indicator"
                    className="relative z-10 ml-auto w-1 h-3 bg-violet-600 rounded-full"
                    transition={{ type: "spring", bounce: 0.5, duration: 0.8 }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Panel */}
        <div className="lg:col-span-3">
          <div className="min-h-[700px] space-y-8">
            <div className="flex items-center justify-between border-b border-gray-100 pb-6 uppercase">
               <h2 className="text-xl font-black text-slate-900 tracking-[0.2em] flex items-center gap-4">
                  {activeModule.replace('-', ' ')}
                  <div className="w-12 h-[2px] bg-gradient-to-r from-violet-600 to-transparent" />
               </h2>
            </div>
            
            <AnimatePresence mode="wait">
              <motion.div
                key={activeModule}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.3 }}
              >
                {renderModuleContent()}
              </motion.div>
            </AnimatePresence>

            {saveStatus === 'success' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }} 
                animate={{ opacity: 1, y: 0 }} 
                className="p-5 rounded-2xl bg-slate-900 text-white shadow-2xl shadow-indigo-200 border border-white/10 flex items-center justify-center gap-3 font-bold text-xs uppercase tracking-[0.3em]"
              >
                <div className="p-1 bg-violet-600 rounded-full"><CheckCircle2 className="w-3 h-3 text-white" /></div>
                System Profiles Updated
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
