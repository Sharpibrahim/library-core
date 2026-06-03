import React, { useState, useRef } from 'react';
import { Upload, FileText, CheckCircle2, X, Loader2, Plus, FolderPlus, Archive } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { db, storage } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { getSubjectCover } from '../constants/subjectImages';
import { SyncService } from '../lib/syncService';

interface UploadSectionProps {
  user: User;
  onUploadComplete: () => void;
}

export function UploadSection({ user, onUploadComplete }: UploadSectionProps) {
  const isAdmin = user.role === 'admin';
  const isTeacher = user.role === 'teacher';

  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [uploadType, setUploadType] = useState<'file' | 'youtube'>('file');
  const [formData, setFormData] = useState({
    title: '',
    className: user.class || 'S1',
    category: 'pastpaper',
    subject: 'Mathematics',
    author: user.fullName || user.username,
    description: ''
  });

  const CLASSES = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
  const SUBJECTS = [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 
    'History', 'Geography', 'Economics', 'Literature', 
    'Entrepreneurship', 'Religious Education', 'Kiswahili', 
    'Fine Art', 'Computer Studies', 'General Paper'
  ];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getYoutubeThumbnail = (url: string) => {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2].length === 11) {
      return `https://img.youtube.com/vi/${match[2]}/maxresdefault.jpg`;
    }
    return `https://picsum.photos/seed/${formData.title}/200/300`;
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setFile(e.dataTransfer.files[0]);
      if (!formData.title) {
        setFormData(prev => ({ ...prev, title: e.dataTransfer.files[0].name.split('.')[0] }));
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      if (!formData.title) {
        setFormData(prev => ({ ...prev, title: e.target.files[0].name.split('.')[0] }));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadType === 'file' && !file) return;
    if (uploadType === 'youtube' && !youtubeUrl) return;

    setIsUploading(true);
    setProgress(0);

    const isOnline = navigator.onLine;

    try {
      let fileUrl = youtubeUrl;
      let type = 'video';
      let fileSize = 0;
      let coverUrl = getSubjectCover(formData.subject);

      if (uploadType === 'file' && file) {
        const isPDF = file.type.includes('pdf') || file.name.toLowerCase().endsWith('.pdf');
        type = isPDF ? 'pdf' : 'epub';
        fileSize = file.size;

        if (isOnline) {
          console.log('[UPLOAD] Uploading file directly to Express backend server with progress tracking...');
          
          const result = await new Promise<any>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const localFormData = new FormData();
            localFormData.append('file', file);
            localFormData.append('title', formData.title);
            localFormData.append('author', formData.author);
            localFormData.append('type', type);
            localFormData.append('description', formData.description || '');
            localFormData.append('cover_url', coverUrl);
            localFormData.append('genre', formData.category);

            // Track upload stream progress accurately
            xhr.upload.addEventListener('progress', (event) => {
              if (event.lengthComputable) {
                const percent = Math.round((event.loaded / event.total) * 100);
                // Clamp progression at 95% until server-side Firebase upload and SQLite insertion respond
                setProgress(Math.min(95, percent));
              }
            });

            xhr.addEventListener('load', () => {
              if (xhr.status >= 200 && xhr.status < 300) {
                try {
                  const data = JSON.parse(xhr.responseText);
                  resolve(data);
                } catch (err) {
                  reject(new Error('Invalid JSON response from upload server.'));
                }
              } else {
                reject(new Error(`Server upload failed with status ${xhr.status}: ${xhr.responseText}`));
              }
            });

            xhr.addEventListener('error', () => {
              reject(new Error('Network error during file transmission.'));
            });

            xhr.open('POST', '/api/resources');
            xhr.send(localFormData);
          });

          fileUrl = result.file_url;
          console.log(`[UPLOAD] Server-side permanent upload successful. URL: ${fileUrl}`);

          // Sync into Firestore for immediate client-side and collaborative stream updates
          await addDoc(collection(db, 'resources'), {
            title: formData.title,
            author: formData.author,
            type: type,
            description: formData.description,
            fileUrl: fileUrl,
            fileSize: fileSize,
            coverUrl: coverUrl,
            createdAt: new Date().toISOString(),
            timestamp: serverTimestamp(),
            status: 'available',
            genre: formData.category,
            className: formData.className,
            subject: formData.subject,
            uploadedBy: user.uid
          });
          
          setProgress(100);
        } else {
          // OFFLINE: Queue using our high-fidelity SyncService
          console.log('[UPLOAD] Device offline. Enqueuing file upload to background queue...');
          setProgress(50);
          
          const resourcePayload = {
            title: formData.title,
            author: formData.author,
            type: type,
            description: formData.description,
            fileSize: fileSize,
            coverUrl: coverUrl,
            status: 'available',
            genre: formData.category,
            className: formData.className,
            subject: formData.subject,
            uploadedBy: user.uid
          };

          await SyncService.queueResourceUpload(resourcePayload, file);
          setProgress(100);
          
          alert('Device is currently offline. Your file upload is securely cached and will sync automatically in the background as soon as internet connectivity returns!');
        }
      } else if (uploadType === 'youtube') {
        coverUrl = getYoutubeThumbnail(youtubeUrl);
        const videoPayload = {
          title: formData.title,
          author: formData.author,
          type: 'video',
          description: formData.description,
          fileUrl: youtubeUrl,
          fileSize: 0,
          coverUrl: coverUrl,
          createdAt: new Date().toISOString(),
          timestamp: serverTimestamp(),
          status: 'available',
          genre: 'video',
          className: formData.className,
          subject: formData.subject,
          uploadedBy: user.uid
        };

        if (isOnline) {
          await addDoc(collection(db, 'resources'), videoPayload);
          
          // Sync with Express backend SQLite database for full uniform state
          const syncFormData = new FormData();
          syncFormData.append('title', formData.title);
          syncFormData.append('author', formData.author);
          syncFormData.append('type', 'video');
          syncFormData.append('description', formData.description || '');
          syncFormData.append('cover_url', coverUrl);
          syncFormData.append('genre', 'video');
          syncFormData.append('body_file_url', youtubeUrl);

          try {
            await fetch('/api/resources', {
              method: 'POST',
              body: syncFormData
            });
          } catch (err) {
            console.error('[YOUTUBE-SYNC] Failed syncing with backend:', err);
          }
        } else {
          setProgress(50);
          await SyncService.queueResourceUpload(videoPayload);
          setProgress(100);
          alert('Device is offline. Your YouTube reference was queued locally and will sync when reconnecting!');
        }
      }

      setProgress(100);
      setTimeout(() => {
        setIsUploading(false);
        setFile(null);
        setYoutubeUrl('');
        setFormData({
          title: '',
          className: user.class || 'S1',
          category: 'pastpaper',
          subject: 'Mathematics',
          author: user.fullName || user.username,
          description: ''
        });
        onUploadComplete();
      }, 1000);
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`Upload error: ${error.message || 'An unexpected error occurred'}`);
      setIsUploading(false);
    }
  };

  return (
    <div className="glass-card p-8 border border-white/10 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full -mr-16 -mt-16" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h3 className="text-2xl font-display font-bold text-white">Upload Content</h3>
            <p className="text-sm text-slate-500 font-medium">Add new books, notes, or resources to the library</p>
          </div>
          <div className="flex bg-white/5 p-1 rounded-xl border border-white/10">
            <button 
              type="button"
              onClick={() => setUploadType('file')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${uploadType === 'file' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
            >
              File
            </button>
            <button 
              type="button"
              onClick={() => setUploadType('youtube')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${uploadType === 'youtube' ? 'bg-primary text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}
            >
              YouTube
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid lg:grid-cols-2 gap-8">
          {/* Left Side: Form Fields */}
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">File Name / Title</label>
              <input 
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Enter document title"
                className="glass-input w-full px-5 py-4"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Class / Level</label>
                <select 
                  value={formData.className}
                  onChange={(e) => setFormData(prev => ({ ...prev, className: e.target.value }))}
                  className="glass-input w-full px-5 py-4 appearance-none cursor-pointer bg-white text-slate-950 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {CLASSES.map(c => (
                    <option key={c} value={c} className="bg-white text-slate-950">{c}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Subject</label>
                <select 
                  value={formData.subject}
                  onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
                  className="glass-input w-full px-5 py-4 appearance-none cursor-pointer bg-white text-slate-950 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  {SUBJECTS.map(s => (
                    <option key={s} value={s} className="bg-white text-slate-950">{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Category</label>
              <select 
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="glass-input w-full px-5 py-4 appearance-none cursor-pointer bg-white text-slate-950 border border-slate-200 rounded-xl font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="book" className="bg-white text-slate-950">Core Textbook / Book</option>
                <option value="pastpaper" className="bg-white text-slate-950">Past Paper / Exam</option>
                <option value="note" className="bg-white text-slate-950">Expert Study Note</option>
                <option value="syllabus" className="bg-white text-slate-950">Syllabus / Curriculum</option>
                <option value="revision" className="bg-white text-slate-950">Revision Material</option>
                <option value="video" className="bg-white text-slate-950">Expert Video Lesson</option>
                <option value="subject" className="bg-white text-slate-950">Subject Overview</option>
                <option value="Assignment" className="bg-white text-slate-950">Assignment</option>
                <option value="interactive" className="bg-white text-slate-950">Simulation / Interactive Content</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Author / Uploaded By</label>
              <input 
                type="text"
                required
                value={formData.author}
                onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                className="glass-input w-full px-5 py-4 opacity-70"
                readOnly
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 ml-1">Description</label>
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the content"
                className="glass-input w-full px-5 py-4 min-h-[100px] resize-none"
              />
            </div>
          </div>

          {/* Right Side: File Dropzone or YouTube Link */}
          <div className="space-y-6">
            {uploadType === 'file' ? (
              <div 
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  relative h-full min-h-[250px] rounded-[2rem] border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center p-8 cursor-pointer group
                  ${dragActive ? 'border-accent bg-accent/5' : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-primary/50'}
                `}
              >
                <input 
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf,.epub,.docx,.txt"
                />

                <AnimatePresence mode="wait">
                  {file ? (
                    <motion.div 
                      key="file-selected"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="space-y-4"
                    >
                      <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center text-accent mx-auto shadow-glow">
                        <FileText className="w-10 h-10" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white truncate max-w-[200px]">{file.name}</p>
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{(file.size / (1024 * 1024)).toFixed(2)} MB</p>
                      </div>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFile(null);
                        }}
                        className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1 mx-auto"
                      >
                        <X className="w-3 h-3" /> Remove File
                      </button>
                    </motion.div>
                  ) : (
                    <motion.div 
                      key="no-file"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-4"
                    >
                      <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center text-slate-500 mx-auto group-hover:scale-110 group-hover:text-primary transition-all duration-500">
                        <Upload className="w-10 h-10" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">Drag & Drop or Click</p>
                        <p className="text-sm text-slate-500 font-medium">Support for PDF, EPUB, DOCX (Max 50MB)</p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <div className="glass-card p-8 border border-white/10 h-full min-h-[250px] flex flex-col justify-center">
                <div className="space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center text-red-500 mx-auto">
                    <Plus className="w-8 h-8" />
                  </div>
                  <div className="space-y-4 text-center">
                    <h4 className="font-bold text-white">YouTube Video Link</h4>
                    <p className="text-xs text-slate-500">Paste the full YouTube URL below to embed the video</p>
                    <input 
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=..."
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      className="glass-input w-full px-5 py-4 text-sm"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bottom: Progress & Submit */}
          <div className="lg:col-span-2 pt-4">
            <AnimatePresence>
              {isUploading && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mb-6 space-y-3"
                >
                  <div className="flex justify-between items-end">
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-4 h-4 text-accent animate-spin" />
                      <span className="text-sm font-bold text-white">Uploading to LibraryCore...</span>
                    </div>
                    <span className="text-sm font-mono font-bold text-accent">{progress}%</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-primary to-accent"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit"
              disabled={isUploading || (uploadType === 'file' ? !file : !youtubeUrl)}
              className="btn-primary w-full py-5 rounded-2xl flex items-center justify-center gap-3 group disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing Metadata...</span>
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                  <span className="text-lg">Add to Library</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
