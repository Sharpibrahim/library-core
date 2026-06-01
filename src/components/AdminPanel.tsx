import React, { useState } from 'react';
import { Upload, X, Loader2, Users, ShieldCheck, UserPlus, Lock, User as UserIcon, BookOpen } from 'lucide-react';
import { Role } from '../types';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, setDoc } from 'firebase/firestore';

interface AdminPanelProps {
  onClose: () => void;
  onUploadSuccess: () => void;
}

export function AdminPanel({ onClose, onUploadSuccess }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'users' | 'system'>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // User creation state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newClass, setNewClass] = useState('');
  const [newRole, setNewRole] = useState<Role>('student');

  const handleUploadSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData(e.currentTarget);

    try {
      const response = await fetch('/api/resources', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload resource');
      }

      const serverResource = await response.json();

      // Sync to Firestore
      await addDoc(collection(db, 'resources'), {
        title: formData.get('title') as string,
        author: formData.get('author') as string,
        type: formData.get('type') as string,
        description: formData.get('description') as string,
        fileUrl: serverResource.file_url,
        coverUrl: serverResource.cover_url || `https://picsum.photos/seed/${formData.get('title')}/200/300`,
        createdAt: new Date().toISOString(),
        timestamp: serverTimestamp(),
        status: 'available',
        isbn: formData.get('isbn') as string,
        genre: formData.get('genre') as string,
      });

      setSuccess('Resource uploaded successfully!');
      setTimeout(() => onUploadSuccess(), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsUploading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          fullName: newFullName,
          class: newClass,
          role: newRole
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create user');
      }

      const data = await response.json();
      const uid = data.id.toString(); // Use server ID or generate one

      // Sync to Firestore
      await setDoc(doc(db, 'users', uid), {
        uid: uid,
        username: newUsername,
        fullName: newFullName,
        class: newClass || null,
        role: newRole,
        email: `${newUsername}@librarycore.com`
      });

      setSuccess(`User ${newUsername} created successfully!`);
      setNewUsername('');
      setNewPassword('');
      setNewFullName('');
      setNewClass('');
      setNewRole('student');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setIsCreatingUser(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-border">
        <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-section">
          <div className="flex items-center gap-6">
            <h2 className="text-2xl font-display font-bold text-text-main">
              Admin Panel
            </h2>
            <div className="flex bg-white p-1 rounded-xl border border-border shadow-sm">
              <button
                onClick={() => setActiveTab('upload')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'upload' 
                    ? 'bg-primary text-white shadow-lg' 
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                Upload
              </button>
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'users' 
                    ? 'bg-primary text-white shadow-lg' 
                    : 'text-text-muted hover:text-text-main'
                }`}
              >
                Users
              </button>
              <button
                onClick={() => setActiveTab('system')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'system' 
                    ? 'bg-red-600 text-white shadow-lg' 
                    : 'text-red-400 hover:text-red-600 font-black'
                }`}
              >
                System
              </button>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-main hover:bg-white rounded-full transition-colors shadow-sm"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="mb-6 p-4 bg-error/10 text-error rounded-2xl text-sm border border-error/20 font-bold flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
              {error}
            </div>
          )}
          {success && (
            <div className="mb-6 p-4 bg-success/10 text-success rounded-2xl text-sm border border-success/20 font-bold flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              {success}
            </div>
          )}

          {activeTab === 'upload' ? (
            <form id="upload-form" onSubmit={handleUploadSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="title" className="block text-xs font-bold uppercase tracking-widest text-text-muted ml-1">Title *</label>
                  <input 
                    type="text" 
                    id="title" 
                    name="title" 
                    required 
                    className="w-full px-4 py-3 bg-section border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all"
                    placeholder="e.g., The Great Gatsby"
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="author" className="block text-xs font-bold uppercase tracking-widest text-text-muted ml-1">Author *</label>
                  <input 
                    type="text" 
                    id="author" 
                    name="author" 
                    required 
                    className="w-full px-4 py-3 bg-section border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all"
                    placeholder="e.g., F. Scott Fitzgerald"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="isbn" className="block text-xs font-bold uppercase tracking-widest text-text-muted ml-1">ISBN</label>
                  <input 
                    type="text" 
                    id="isbn" 
                    name="isbn" 
                    className="w-full px-4 py-3 bg-section border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all"
                    placeholder="e.g., 978-3-16-148410-0"
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="genre" className="block text-xs font-bold uppercase tracking-widest text-text-muted ml-1">Genre</label>
                  <input 
                    type="text" 
                    id="genre" 
                    name="genre" 
                    className="w-full px-4 py-3 bg-section border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all"
                    placeholder="e.g., Fiction, Science"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="type" className="block text-xs font-bold uppercase tracking-widest text-text-muted ml-1">Resource Type *</label>
                  <select 
                    id="type" 
                    name="type" 
                    required
                    className="w-full px-4 py-3 bg-section border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="book">Book</option>
                    <option value="article">Article</option>
                    <option value="video">Video</option>
                    <option value="journal">Journal</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="coverUrl" className="block text-xs font-bold uppercase tracking-widest text-text-muted ml-1">Cover Image URL</label>
                  <input 
                    type="url" 
                    id="coverUrl" 
                    name="coverUrl" 
                    className="w-full px-4 py-3 bg-section border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all"
                    placeholder="https://example.com/cover.jpg"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="block text-xs font-bold uppercase tracking-widest text-text-muted ml-1">Description</label>
                <textarea 
                  id="description" 
                  name="description" 
                  rows={3}
                  className="w-full px-4 py-3 bg-section border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all resize-none"
                  placeholder="Brief summary of the resource..."
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="file" className="block text-xs font-bold uppercase tracking-widest text-text-muted ml-1">Resource File</label>
                <div className="mt-1 flex justify-center px-6 pt-8 pb-8 border-2 border-border border-dashed rounded-2xl hover:border-primary/50 transition-colors bg-section">
                  <div className="space-y-2 text-center">
                    <Upload className="mx-auto h-12 w-12 text-text-muted opacity-30" />
                    <div className="flex text-sm text-text-secondary justify-center">
                      <label
                        htmlFor="file"
                        className="relative cursor-pointer bg-white rounded-lg font-bold text-primary hover:text-primary/80 px-2 py-0.5 border border-border shadow-sm"
                      >
                        <span>Upload a file</span>
                        <input id="file" name="file" type="file" className="sr-only" />
                      </label>
                      <p className="pl-2 pt-0.5">or drag and drop</p>
                    </div>
                    <p className="text-[10px] text-text-muted font-bold uppercase tracking-widest">
                      PDF, EPUB, MP4 up to 50MB
                    </p>
                  </div>
                </div>
              </div>
            </form>
          ) : activeTab === 'users' ? (
            <form onSubmit={handleCreateUser} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-text-muted ml-1">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input 
                      type="text" 
                      required 
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-section border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all"
                      placeholder="Full Name"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-text-muted ml-1">Class</label>
                  <div className="relative">
                    <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input 
                      type="text" 
                      required 
                      value={newClass}
                      onChange={(e) => setNewClass(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-section border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all"
                      placeholder="Class"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-text-muted ml-1">Username</label>
                  <div className="relative">
                    <UserPlus className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input 
                      type="text" 
                      required 
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-section border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all"
                      placeholder="Username"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-widest text-text-muted ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                    <input 
                      type="password" 
                      required 
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-section border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all"
                      placeholder="Password"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-widest text-text-muted ml-1">Role</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <select 
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as Role)}
                    className="w-full pl-11 pr-4 py-3 bg-section border border-border rounded-xl focus:ring-4 focus:ring-primary/5 focus:border-primary outline-none transition-all appearance-none cursor-pointer"
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                disabled={isCreatingUser}
                className="w-full bg-gradient-to-r from-primary to-secondary text-white py-4 rounded-2xl font-bold transition-all shadow-xl shadow-primary/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isCreatingUser ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Create User Account'}
              </button>
            </form>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-bottom-4">
              <div className="bg-red-50 border-2 border-red-100 rounded-[2rem] p-8 space-y-6">
                <div className="flex items-center gap-4 text-red-600">
                  <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center animate-pulse">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black">Danger Zone</h3>
                    <p className="text-sm font-bold opacity-70 uppercase tracking-widest">Global Administrative Reset</p>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div className="p-6 bg-white rounded-2xl border border-red-100 shadow-sm">
                    <h4 className="font-black text-gray-900 mb-1">Delete All Courses</h4>
                    <p className="text-xs font-bold text-gray-500 leading-relaxed mb-4">
                      This will permanently remove every course, curriculum module, and enrollment from the system. This action is irreversible.
                    </p>
                    <button 
                      onClick={async () => {
                        if (confirm('CRITICAL: Are you absolutely sure you want to delete EVERY course and all associated data?')) {
                           try {
                             await fetch('/api/admin/reset-courses', { method: 'POST' });
                             setSuccess('Global reset complete. All courses purged.');
                             onUploadSuccess();
                           } catch (e) {
                             setError('Reset failed');
                           }
                        }
                      }}
                      className="px-6 py-3 bg-red-600 text-white rounded-xl font-black text-sm hover:bg-red-700 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-red-600/20"
                    >
                      Purge Data Database
                    </button>
                  </div>
                </div>
              </div>

              <div className="p-8 text-center space-y-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-loose">
                  System Version: 4.8.2-PRO<br/>
                  Registry: SharpLMS Core Environment
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="px-8 py-6 border-t border-border bg-section flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2.5 text-sm font-bold text-text-secondary bg-white border border-border rounded-xl hover:bg-hover transition-all shadow-sm"
          >
            Close
          </button>
          {activeTab === 'upload' && (
            <button
              type="submit"
              form="upload-form"
              disabled={isUploading}
              className="inline-flex items-center justify-center gap-2 px-8 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-primary to-secondary hover:brightness-110 border border-transparent rounded-xl transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Upload Resource'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
