import React, { useState, useEffect } from 'react';
import { Classroom, User } from '../types';
import { Plus, Users, BookOpen, Clock, ArrowRight, UserPlus, FileText, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { ClassroomDetail } from './ClassroomDetail';

interface ClassroomListProps {
  user: User;
}

export function ClassroomList({ user }: ClassroomListProps) {
  const [classes, setClasses] = useState<Classroom[]>(() => {
    const cached = localStorage.getItem(`classes_${user.uid}`);
    return cached ? JSON.parse(cached) : [];
  });
  const [isLoading, setIsLoading] = useState(!classes.length);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  
  const [newClassName, setNewClassName] = useState('');
  const [newClassSubject, setNewClassSubject] = useState('');

  const [activeClassId, setActiveClassId] = useState<string | null>(null);

  const fetchClasses = async () => {
    try {
      const res = await fetch(`/api/users/${user.uid}/classes?role=${user.role}`);
      if (res.ok) {
        const data = await res.json();
        setClasses(data);
        localStorage.setItem(`classes_${user.uid}`, JSON.stringify(data));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();

    const handleToggleCreate = (e: any) => {
       if (e.detail) setIsCreateModalOpen(true);
    };
    window.addEventListener('toggleCreateClass', handleToggleCreate);
    return () => {
      window.removeEventListener('toggleCreateClass', handleToggleCreate);
    };
  }, [user.uid, user.role]);

  const handleJoinClass = async () => {
    if (!joinCode) return;
    try {
      const res = await fetch('/api/classes/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          class_code: joinCode.trim().toUpperCase(), 
          student_id: user.uid,
          student_name: user.fullName || user.username
        })
      });
      if (res.ok) {
        setIsJoinModalOpen(false);
        setJoinCode('');
        fetchClasses();
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to join class');
      }
    } catch (e) {
       console.error(e);
    }
  };

  const handleCreateClass = async () => {
    if (!newClassName || !newClassSubject) return;
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          name: newClassName, 
          subject: newClassSubject, 
          teacher_id: user.uid,
          teacher_name: user.fullName || user.username
        })
      });
      if (res.ok) {
        setIsCreateModalOpen(false);
        setNewClassName('');
        setNewClassSubject('');
        fetchClasses();
      } else {
        const errorData = await res.json();
        alert(`Failed to create class: ${errorData.details || errorData.error}`);
        console.error("Create class error response:", errorData);
      }
    } catch (e) {
      console.error(e);
      alert("Network error: " + String(e));
    }
  };

  if (activeClassId) {
     return <ClassroomDetail classId={activeClassId} user={user} onBack={() => setActiveClassId(null)} />;
  }

  const isTeacher = user.role === 'teacher' || user.role === 'admin';

  return (
    <div className="max-w-[1200px] mx-auto w-full space-y-8 animate-in fade-in duration-500 pb-20 font-sans">
       <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Classrooms</h1>
            <p className="text-gray-500">Manage your classes, assignments, and students.</p>
          </div>
          <div className="flex items-center gap-4">
             <button 
               onClick={() => setIsJoinModalOpen(true)}
               className="flex items-center gap-2 px-6 py-3 bg-purple-50 text-purple-600 rounded-xl font-bold hover:bg-purple-100 transition-colors"
             >
               <UserPlus className="w-5 h-5" /> Join Class
             </button>
             <button 
               onClick={() => setIsCreateModalOpen(true)}
               className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-600/20"
             >
               <Plus className="w-5 h-5" /> Create Class
             </button>
          </div>
       </div>

       {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
             {[1,2,3].map(i => <div key={i} className="h-64 bg-gray-100 animate-pulse rounded-2xl border border-gray-200" />)}
          </div>
       ) : classes.length === 0 ? (
          <div className="text-center py-32 bg-white rounded-3xl border border-gray-100 shadow-sm">
             <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-6" />
             <h3 className="text-2xl font-bold text-gray-900 mb-2">No classrooms found</h3>
             <p className="text-gray-500 mb-8 max-w-sm mx-auto">
               You haven't created or joined any classes yet. Get started by creating your first class study group or entering a class code from your teacher.
             </p>
          </div>
       ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
             {classes.map(cls => (
                <motion.div 
                  key={cls.id}
                  whileHover={{ y: -4 }}
                  onClick={() => setActiveClassId(cls.id)}
                  className="bg-white rounded-3xl border border-gray-200 overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all group relative"
                >
                   <div className="h-32 bg-purple-600 relative p-6 flex flex-col justify-end overflow-hidden">
                      <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
                      <h3 className="text-2xl font-bold text-white truncate relative z-10">{cls.name}</h3>
                      <p className="text-purple-100 font-medium relative z-10">{cls.subject}</p>
                      <button className="absolute top-4 right-4 p-2 bg-white/20 hover:bg-white/30 rounded-xl backdrop-blur-sm text-white transition-colors">
                         <ArrowRight className="w-5 h-5" />
                      </button>
                   </div>
                   <div className="p-6 relative">
                      <div className="absolute -top-6 right-6 w-12 h-12 bg-white rounded-full p-1 shadow-sm">
                         <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${cls.teacher_name || 'T'}`} className="w-full h-full bg-blue-50 rounded-full" alt="Teacher" />
                      </div>
                      <div className="mt-2 space-y-4">
                         <p className="text-sm font-bold text-gray-700">{cls.teacher_name}</p>
                         <div className="flex items-center gap-6">
                            <div className="flex items-center gap-2 text-gray-500">
                               <Users className="w-4 h-4 text-blue-500" />
                               <span className="text-sm font-medium">{cls.student_count || 0} Students</span>
                            </div>
                            <div className="flex items-center gap-2 text-gray-500">
                               <FileText className="w-4 h-4 text-emerald-500" />
                               <span className="text-sm font-medium">View Classwork</span>
                            </div>
                         </div>
                      </div>
                   </div>
                </motion.div>
             ))}
          </div>
       )}

       {/* Modals */}
       {isJoinModalOpen && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
             <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Join Class</h3>
                <p className="text-gray-500 mb-6 font-medium">Ask your teacher for the class code, then enter it here.</p>
                <input 
                  type="text" 
                  placeholder="Class code" 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none mb-6 text-lg font-mono text-center tracking-widest uppercase"
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value.toUpperCase())}
                />
                <div className="flex justify-end gap-3">
                   <button onClick={() => setIsJoinModalOpen(false)} className="px-5 py-2.5 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">Cancel</button>
                   <button onClick={handleJoinClass} disabled={!joinCode} className="px-5 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors">Join</button>
                </div>
             </div>
          </div>
       )}

       {isCreateModalOpen && (
          <div className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
             <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Create Class</h3>
                <div className="space-y-4 mb-8">
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Class Name (required)</label>
                      <input 
                        type="text" 
                        placeholder="e.g. S4 Physics" 
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none font-medium"
                        value={newClassName}
                        onChange={e => setNewClassName(e.target.value)}
                      />
                   </div>
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Subject</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Advanced Mechanics" 
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none font-medium"
                        value={newClassSubject}
                        onChange={e => setNewClassSubject(e.target.value)}
                      />
                   </div>
                </div>
                <div className="flex justify-end gap-3">
                   <button onClick={() => setIsCreateModalOpen(false)} className="px-5 py-2.5 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">Cancel</button>
                   <button onClick={handleCreateClass} disabled={!newClassName} className="px-5 py-2.5 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors">Create</button>
                </div>
             </div>
          </div>
       )}
    </div>
  );
}
