import React, { useState, useEffect } from 'react';
import { 
  GraduationCap, 
  Users, 
  ClipboardList, 
  Plus, 
  Search, 
  BookOpen, 
  UserPlus, 
  ShieldCheck,
  Trash2,
  Edit,
  CheckCircle2,
  XCircle,
  HardDrive,
  Database,
  Archive,
  Video,
  Image as ImageIcon,
  Layers,
  Layout,
  ArrowRight,
  Save,
  Monitor,
  Check,
  Zap,
  Activity,
  ShieldX,
  UserMinus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Course, Quiz, User } from '../types';
import { db } from '../firebase';
import { collection, onSnapshot, query, deleteDoc, doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { CourseBuilder } from './CourseBuilder';

interface LMSAdminProps {
  user: User;
  onAddClick: () => void;
  resources: any[];
  onDeleteResource: (id: string) => void;
}

export function LMSAdmin({ user: currentUser, onAddClick, resources, onDeleteResource }: LMSAdminProps) {
  const isSuperAdmin = currentUser.email === 'sharpibrah@gmail.com';
  const [activeSubTab, setActiveSubTab] = useState<'courses' | 'quizzes' | 'teachers' | 'students' | 'users' | 'library' | 'usage'>('courses');
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    show: boolean;
    userId: string;
    newRole: string;
    username: string;
  }>({ show: false, userId: '', newRole: '', username: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean;
    collectionName: string;
    id: string;
    title: string;
  } | null>(null);
  const [newUser, setNewUser] = useState({
    username: '',
    fullName: '',
    role: 'student' as 'admin' | 'teacher' | 'student',
    class: ''
  });

  const [isEditingCourse, setIsEditingCourse] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);

  useEffect(() => {
    setIsLoading(true);
    
    // Fetch courses from API instead of Firestore to stay in sync with CourseBuilder
    const fetchCourses = async () => {
      try {
        const res = await fetch('/api/courses');
        if (res.ok) {
          const data = await res.json();
          setCourses(data);
        }
      } catch (e) {
        console.error('Failed to fetch courses:', e);
      }
    };
    fetchCourses();

    // Quizzes listener
    const unsubQuizzes = onSnapshot(collection(db, 'quizzes'), (snapshot) => {
      setQuizzes(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id })) as Quiz[]);
    });

    // Users listener
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, uid: doc.id })) as User[]);
      setIsLoading(false);
    });

    return () => {
      unsubQuizzes();
      unsubUsers();
    };
  }, []);

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (!isSuperAdmin && newRole === 'admin') {
      alert('Only the super admin can promote users to admin role.');
      return;
    }

    const userToUpdate = users.find(u => u.uid === userId);
    if (userToUpdate?.email === 'sharpibrah@gmail.com' && newRole !== 'admin') {
      alert('The super administrator account cannot be demoted.');
      return;
    }

    setConfirmModal({
      show: true,
      userId,
      newRole,
      username: userToUpdate?.fullName || 'this user'
    });
  };

  const executeUpdateRole = async () => {
    const { userId, newRole } = confirmModal;
    setConfirmModal(prev => ({ ...prev, show: false }));
    
    try {
      console.log(`Attempting to update user ${userId} role to ${newRole}`);
      await updateDoc(doc(db, 'users', userId), { 
        role: newRole,
        updatedAt: serverTimestamp() 
      });
      console.log('Role updated successfully');
    } catch (error: any) {
      console.error('Error updating user role:', error);
      let errorMsg = 'Failed to update role.';
      if (error.code === 'permission-denied') {
        errorMsg += ' You do not have permission to change roles.';
      } else {
        errorMsg += ` ${error.message}`;
      }
      alert(errorMsg);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // For real apps, we'd use Firebase Auth Admin SDK on backend, 
      // or a cloud function. Since we're frontend-focused, we'll just populate Firestore.
      // NOTE: This doesn't create a real Auth user, but shows the profile in LMS.
      const userId = `user_${Date.now()}`;
      await setDoc(doc(db, 'users', userId), {
        uid: userId,
        username: newUser.username,
        fullName: newUser.fullName,
        role: newUser.role,
        class: newUser.class,
        favoriteSubjects: []
      });
      
      setShowCreateUser(false);
      setNewUser({ username: '', fullName: '', role: 'student', class: '' });
    } catch (error) {
      console.error('Error creating user profile:', error);
      alert('Failed to create user profile');
    }
  };

  const handleDelete = async (collectionName: string, id: string) => {
    if (collectionName === 'users') {
      const userToDelete = users.find(u => u.uid === id);
      if (userToDelete?.email === 'sharpibrah@gmail.com') {
        alert('The super administrator account cannot be deleted.');
        return;
      }
    }

    try {
      // If it's a course, delete from SQLite via API
      if (collectionName === 'courses') {
        const res = await fetch(`/api/courses/${id}`, { method: 'DELETE' });
        if (res.ok) {
          setCourses(prev => prev.filter(c => c.id !== id));
        } else {
          throw new Error('Failed to delete course from server');
        }
      } else if (collectionName === 'resources') {
        // Delegate to the unified handler
        onDeleteResource(id);
      } else {
        // If it's a user or quiz, from Firestore
        await deleteDoc(doc(db, collectionName, id));
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Delete failed. You might not have permission.');
    }
  };

  const teachers = users.filter(u => u.role === 'teacher');
  const students = users.filter(u => u.role === 'student');

  if (isEditingCourse) {
    return (
      <div className="p-8">
        <CourseBuilder 
          user={currentUser} 
          onBack={() => setIsEditingCourse(false)} 
          existingCourse={selectedCourse || undefined} 
        />
      </div>
    );
  }

  const filteredData = () => {
    const query = searchQuery?.toLowerCase() || '';
    switch (activeSubTab) {
      case 'courses':
        return courses.filter(c => c.title?.toLowerCase().includes(query) || c.subject?.toLowerCase().includes(query));
      case 'quizzes':
        return quizzes.filter(q => q.title?.toLowerCase().includes(query));
      case 'teachers':
        return teachers.filter(t => t.fullName?.toLowerCase().includes(query) || t.username?.toLowerCase().includes(query));
      case 'students':
        return students.filter(s => s.fullName?.toLowerCase().includes(query) || s.class?.toLowerCase().includes(query));
      case 'users':
        return users.filter(u => u.fullName?.toLowerCase().includes(query) || u.username?.toLowerCase().includes(query) || u.role?.toLowerCase().includes(query));
      case 'library':
        return resources.filter(r => r.title?.toLowerCase().includes(query) || r.author?.toLowerCase().includes(query));
      case 'usage':
        return [];
      default:
        return [];
    }
  };

  const getIcon = (role?: string) => {
    if (activeSubTab === 'courses') return <GraduationCap className="w-6 h-6" />;
    if (activeSubTab === 'quizzes') return <ClipboardList className="w-6 h-6" />;
    if (activeSubTab === 'library') return <Archive className="w-6 h-6" />;
    if (activeSubTab === 'usage') return <Archive className="w-6 h-6" />;
    
    const r = role || (activeSubTab === 'teachers' ? 'teacher' : activeSubTab === 'students' ? 'student' : '');
    switch (r) {
      case 'admin': return <ShieldCheck className="w-6 h-6 text-primary" />;
      case 'teacher': return <Users className="w-6 h-6 text-amber-500" />;
      case 'student': return <BookOpen className="w-6 h-6 text-blue-500" />;
      default: return <Users className="w-6 h-6" />;
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10">
        <h2 className="text-4xl font-serif font-bold text-white mb-2">LMS & SMS <span className="gradient-text">Management</span></h2>
        <p className="text-slate-400">Manage courses, quizzes, faculty, and the student body.</p>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap gap-4 mb-8">
        {[
          { id: 'courses', label: 'Courses', icon: GraduationCap },
          { id: 'quizzes', label: 'Quizzes', icon: ClipboardList },
          { id: 'teachers', label: 'Teachers', icon: Users },
          { id: 'students', label: 'Students', icon: BookOpen },
          { id: 'users', label: 'All Users', icon: ShieldCheck },
          { id: 'library', label: 'Library', icon: Archive },
          { id: 'usage', label: 'Usage Monitor', icon: Activity },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold transition-all ${
                isActive 
                  ? 'bg-primary text-white shadow-lg shadow-primary/20' 
                  : 'bg-white/5 text-slate-400 border border-white/10 hover:border-primary/30 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Search and Actions */}
      {activeSubTab !== 'usage' && (
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-grow">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="text" 
              placeholder={`Search ${activeSubTab}...`}
              className="glass-input w-full pl-12 pr-4 py-4"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => {
              if (activeSubTab === 'users' || activeSubTab === 'teachers' || activeSubTab === 'students') {
                setShowCreateUser(true);
              } else if (activeSubTab === 'courses') {
                setSelectedCourse(null);
                setIsEditingCourse(true);
              } else {
                onAddClick();
              }
            }}
            className="bg-primary hover:brightness-110 text-white px-8 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all shadow-xl shadow-primary/20"
          >
            <Plus className="w-5 h-5" />
            Add New {activeSubTab.slice(0, -1)}
          </button>
        </div>
      )}

      {activeSubTab === 'usage' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
          {/* Firestore Progress */}
          <div className="glass-card p-8 border border-white/10 group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl rounded-full" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-primary/10 rounded-2xl text-primary">
                  <Database className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white">Data Storage</h4>
                  <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">Firestore Table Metrics</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-medium text-slate-400">Total Data (1GB Free Tier)</span>
                  <span className="text-xs font-mono font-bold text-primary">
                    {((users.length + courses.length + quizzes.length + resources.length) * 0.000001).toFixed(4)} MB / 1024 MB
                  </span>
                </div>
                <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '0.1%' }} // Estimate based on record counts
                    className="h-full bg-primary"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                  <div className="text-center p-4 bg-white/5 rounded-2xl">
                    <p className="text-2xl font-bold text-white">{users.length}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">User Records</p>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-2xl">
                    <p className="text-2xl font-bold text-white">{courses.length + resources.length}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Academic Assets</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Storage Progress */}
          <div className="glass-card p-8 border border-white/10 group overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl rounded-full" />
            <div className="relative z-10">
              <div className="flex items-center gap-4 mb-6">
                <div className="p-4 bg-accent/10 rounded-2xl text-accent">
                  <HardDrive className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-white">File Library</h4>
                  <p className="text-xs text-slate-500 font-bold tracking-widest uppercase">Cloud Storage Bucket</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-end">
                  <span className="text-sm font-medium text-slate-400">Total Files (5GB Free Tier)</span>
                  <span className="text-xs font-mono font-bold text-accent text-right">
                    {(resources.reduce((acc, curr) => acc + (curr.fileSize || 0), 0) / (1024 * 1024)).toFixed(2)} MB / 5120 MB
                  </span>
                </div>
                <div className="h-3 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ 
                      width: `${Math.min(100, (resources.reduce((acc, curr) => acc + (curr.fileSize || 0), 0) / (5120 * 1024 * 1024)) * 100)}%` 
                    }}
                    className="h-full bg-accent shadow-[0_0_15px_rgba(245,158,11,0.5)]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                  <div className="text-center p-4 bg-white/5 rounded-2xl">
                    <p className="text-2xl font-bold text-white">{resources.filter(r => r.type === 'pdf').length}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">PDF Documents</p>
                  </div>
                  <div className="text-center p-4 bg-white/5 rounded-2xl">
                    <p className="text-2xl font-bold text-white">
                      {(resources.reduce((acc, curr) => acc + (curr.fileSize || 0), 0) / (1024 * 1024)).toFixed(1)} MB
                    </p>
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Storage Used</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-white">Create New Account</h3>
              <button onClick={() => setShowCreateUser(false)} className="p-2 hover:bg-white/5 rounded-full">
                <XCircle className="w-6 h-6 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  placeholder="John Doe"
                  className="glass-input w-full px-5 py-3"
                  value={newUser.fullName}
                  onChange={(e) => setNewUser({...newUser, fullName: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Username</label>
                <input 
                  type="text" 
                  required
                  placeholder="johndoe"
                  className="glass-input w-full px-5 py-3"
                  value={newUser.username}
                  onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Role</label>
                  <select 
                    className="glass-input w-full px-5 py-3"
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value as any})}
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    {isSuperAdmin && <option value="admin">Admin</option>}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Class (Optional)</label>
                  <select 
                    className="glass-input w-full px-5 py-3"
                    value={newUser.class}
                    onChange={(e) => setNewUser({...newUser, class: e.target.value})}
                  >
                    <option value="">N/A</option>
                    <option value="S1">S1</option>
                    <option value="S2">S2</option>
                    <option value="S3">S3</option>
                    <option value="S4">S4</option>
                    <option value="S5">S5</option>
                    <option value="S6">S6</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full py-4 mt-4 rounded-2xl">
                Create Account
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Role Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.show && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-6"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Change User Role</h3>
                <p className="text-slate-400 text-sm">
                  Are you sure you want to change <span className="text-white font-bold">{confirmModal.username}</span>'s role to <span className="text-primary font-bold uppercase tracking-widest">{confirmModal.newRole}</span>?
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(prev => ({ ...prev, show: false }))}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={executeUpdateRole}
                  className="flex-1 px-4 py-3 rounded-xl bg-primary text-white font-bold hover:shadow-glow transition-all"
                >
                  Confirm Change
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && deleteConfirm.show && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-sm w-full space-y-6"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Delete Permanently</h3>
                <p className="text-slate-400 text-sm">
                  Are you sure you want to permanently delete <span className="text-white font-bold">"{deleteConfirm.title}"</span>? This action is irreversible.
                </p>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-3 rounded-xl bg-white/5 text-slate-400 font-bold hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={async () => {
                    const { collectionName, id } = deleteConfirm;
                    setDeleteConfirm(null);
                    await handleDelete(collectionName, id);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 hover:shadow-red-500/20 shadow-lg active:scale-[0.98] transition-all"
                >
                  Confirm Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredData().map((item: any, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card p-6 rounded-[2rem] border border-white/10 shadow-sm hover:shadow-md transition-all group"
            >
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-white/5 rounded-xl group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  {getIcon(item.role)}
                </div>
                <div className="flex gap-2 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity flex-wrap justify-end">
                  {isSuperAdmin && (activeSubTab === 'users' || activeSubTab === 'teachers' || activeSubTab === 'students') && (
                    <>
                      {/* Admin Controls */}
                      {item.role !== 'admin' ? (
                        <button 
                          onClick={() => handleUpdateRole(item.id, 'admin')}
                          title="Promote to Admin"
                          className="p-2 hover:bg-amber-500/20 rounded-lg text-slate-500 hover:text-amber-500 transition-colors"
                        >
                          <ShieldCheck className="w-4 h-4" />
                        </button>
                      ) : (
                        item.email !== 'sharpibrah@gmail.com' && (
                          <button 
                            onClick={() => handleUpdateRole(item.id, 'teacher')}
                            title="Demote to Teacher"
                            className="p-2 hover:bg-neutral-500/20 rounded-lg text-slate-500 hover:text-neutral-500 transition-colors"
                          >
                            <ShieldX className="w-4 h-4" />
                          </button>
                        )
                      )}
                      
                      {/* Teacher/Student Controls */}
                      {item.role === 'student' && (
                        <button 
                          onClick={() => handleUpdateRole(item.id, 'teacher')}
                          title="Promote to Teacher"
                          className="p-2 hover:bg-blue-500/20 rounded-lg text-slate-500 hover:text-blue-500 transition-colors"
                        >
                          <GraduationCap className="w-4 h-4" />
                        </button>
                      )}
                      {item.role === 'teacher' && (
                        <button 
                          onClick={() => handleUpdateRole(item.id, 'student')}
                          title="Demote to Student"
                          className="p-2 hover:bg-slate-500/20 rounded-lg text-slate-500 hover:text-slate-500 transition-colors"
                        >
                          <BookOpen className="w-4 h-4" />
                        </button>
                      )}
                    </>
                  )}
                  <button 
                    onClick={async () => {
                      if (activeSubTab === 'courses') {
                        try {
                          const res = await fetch(`/api/courses/${item.id}`);
                          if (res.ok) {
                            const fullCourse = await res.json();
                            setSelectedCourse(fullCourse);
                            setIsEditingCourse(true);
                          }
                        } catch (e) {
                          console.error('Failed to fetch full course:', e);
                          setSelectedCourse(item);
                          setIsEditingCourse(true);
                        }
                      }
                    }}
                    className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-primary transition-colors"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      const collectionName = activeSubTab === 'courses' ? 'courses' : activeSubTab === 'quizzes' ? 'quizzes' : activeSubTab === 'library' ? 'resources' : 'users';
                      const itemTitle = activeSubTab === 'courses' || activeSubTab === 'quizzes' || activeSubTab === 'library' ? item.title : item.fullName;
                      setDeleteConfirm({
                        show: true,
                        collectionName,
                        id: item.id,
                        title: itemTitle || 'this item'
                      });
                    }}
                    className="p-2 hover:bg-red-500/20 rounded-lg text-slate-500 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <h3 className="text-lg font-bold text-white mb-1">
                {activeSubTab === 'courses' || activeSubTab === 'quizzes' || activeSubTab === 'library' ? item.title : item.fullName}
              </h3>
              
              <p className="text-sm text-slate-400 mb-4">
                {activeSubTab === 'courses' && `Subject: ${item.subject}`}
                {activeSubTab === 'quizzes' && `Course ID: ${item.courseId}`}
                {activeSubTab === 'library' && `Author: ${item.author} | Type: ${item.type}`}
                {activeSubTab === 'teachers' && `Username: @${item.username}`}
                {activeSubTab === 'students' && `Class: ${item.class || 'N/A'}`}
                {activeSubTab === 'users' && `Role: ${item.role} | @${item.username}`}
              </p>

              <div className="pt-4 border-t border-white/5 flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  {activeSubTab === 'courses' ? `By ${item.teacherName || 'Unknown'}` : activeSubTab === 'library' ? `Uploaded: ${new Date(item.createdAt).toLocaleDateString()}` : `ID: #${item.id}`}
                </span>
                <button className="text-accent font-bold text-xs hover:underline">
                  View Details
                </button>
              </div>
            </motion.div>
          ))}

          {filteredData().length === 0 && (
            <div className="col-span-full text-center py-20 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
              <p className="text-slate-400 font-medium">No {activeSubTab} found matching your search.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
