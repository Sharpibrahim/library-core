import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  BookOpen, 
  MoreVertical, 
  Star, 
  Download, 
  Trash2, 
  Edit3,
  Eye,
  ArrowRight,
  Book,
  Video,
  Image as ImageIcon,
  CheckCircle2
} from 'lucide-react';
import { Resource, User } from '../types';
import { motion } from 'motion/react';
import { getSubjectCover } from '../constants/subjectImages';

interface ResourceCardProps {
  resource: Resource;
  currentUser: User;
  onRead: (resource: Resource) => void;
  onEdit?: (resource: Resource) => void;
  onDelete?: (id: string) => void;
  onBorrow?: (id: number) => void;
  onReturn?: (id: number) => void;
}

export function ResourceCard({ resource, currentUser, onRead, onEdit, onDelete, onBorrow, onReturn }: ResourceCardProps) {
  const [isOffline, setIsOffline] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const isPDF = resource.type?.toLowerCase() === 'pdf' || resource.fileUrl?.toLowerCase().split('?')[0].endsWith('.pdf');
  const isVideo = resource.type?.toLowerCase() === 'video' || resource.fileUrl?.includes('youtube.com') || resource.fileUrl?.includes('youtu.be') || resource.fileUrl?.toLowerCase().split('?')[0].endsWith('.mp4');
  const isAdmin = currentUser.role === 'admin' || currentUser.email === 'sharpibrah@gmail.com';
  const isTeacher = currentUser.role === 'teacher';
  const isOwner = resource.uploadedBy === currentUser.uid;
  const coverImage = (resource.coverUrl && !resource.coverUrl.includes('picsum.photos')) 
    ? resource.coverUrl 
    : getSubjectCover(resource.subject);

  useEffect(() => {
    const checkOffline = async () => {
      if (resource.fileUrl && 'caches' in window) {
        try {
          const cache = await caches.open('library-files-cache');
          const response = await cache.match(resource.fileUrl);
          setIsOffline(!!response);
        } catch (e) {
          // Cache API might fail in some contexts
        }
      }
    };
    checkOffline();
  }, [resource.fileUrl]);

  const getTypeIcon = (type: string, genre: string = '') => {
    const combined = `${type} ${genre}`.toLowerCase();
    if (combined.includes('video')) return <Video className="w-4 h-4" />;
    if (combined.includes('past paper')) return <FileText className="w-4 h-4 text-orange-500" />;
    if (combined.includes('note')) return <BookOpen className="w-4 h-4 text-emerald-500" />;
    if (combined.includes('subject')) return <CheckCircle2 className="w-4 h-4 text-blue-500" />;
    
    switch (type?.toLowerCase()) {
      case 'book': return <Book className="w-4 h-4" />;
      case 'article': return <FileText className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      default: return <ImageIcon className="w-4 h-4" />;
    }
  };

  return (
    <motion.div 
      layout
      whileHover={{ y: -8 }}
      className="bg-white border-t-4 border-primary rounded-[2rem] transition-all duration-300 shadow-sm hover:shadow-hover group relative overflow-hidden h-full flex flex-col"
    >
      <div className="p-6 relative z-10 flex flex-col h-full">
        {/* Top: Cover & Badge */}
        <div className="relative aspect-[3/4] rounded-2xl overflow-hidden mb-5 shadow-lg bg-section">
          <img 
            src={coverImage} 
            alt={resource.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-text-main/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          <div className="absolute top-3 left-3 flex flex-wrap gap-2">
            <div className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-md border border-border text-[10px] font-bold text-text-main uppercase tracking-widest flex items-center gap-2 shadow-sm">
              {getTypeIcon(resource.type, resource.genre || '')}
              {resource.genre || resource.type || 'General'}
            </div>
            {resource.className && (
              <div className="px-3 py-1.5 rounded-full bg-primary/20 backdrop-blur-md border border-primary/20 text-[10px] font-black text-primary uppercase tracking-widest shadow-sm">
                {resource.className}
              </div>
            )}
            {resource.subject && (
              <div className="px-3 py-1.5 rounded-full bg-accent/20 backdrop-blur-md border border-accent/20 text-[10px] font-black text-accent uppercase tracking-widest shadow-sm">
                {resource.subject}
              </div>
            )}
            {isPDF && (
              <div className="px-3 py-1.5 rounded-full bg-error text-[10px] font-bold text-white uppercase tracking-widest shadow-sm">
                PDF
              </div>
            )}
            {isOffline && (
              <div className="px-3 py-1.5 rounded-full bg-success text-[10px] font-bold text-white uppercase tracking-widest shadow-sm flex items-center gap-1.5">
                <CheckCircle2 className="w-3 h-3" />
                Offline
              </div>
            )}
          </div>

          <div className="absolute bottom-4 left-4 right-4 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
            <button 
              onClick={() => onRead(resource)}
              className="w-full bg-white text-primary py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 text-sm shadow-xl hover:bg-primary hover:text-white transition-all"
            >
              {isVideo ? <Video className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
              {isVideo ? 'Watch Now' : 'Read Now'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-grow">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-display font-bold text-text-main text-lg line-clamp-1 group-hover:text-primary transition-colors">
              {resource.title}
            </h3>
            <div className="flex items-center gap-1 text-warning bg-warning/10 px-2 py-0.5 rounded-lg">
              <Star className="w-3 h-3 fill-current" />
              <span className="text-[10px] font-bold data-mono tracking-tighter">4.8</span>
            </div>
          </div>
          <p className="text-sm text-text-secondary font-medium mb-4 italic-serif">{resource.author}</p>
        </div>

        {/* Footer: Stats & Actions */}
        <div className="flex items-center justify-between pt-5 border-t border-border">
          <div className="flex items-center gap-3">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-7 h-7 rounded-full border-2 border-white bg-section overflow-hidden shadow-sm">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + resource.id}`} alt="" />
                </div>
              ))}
            </div>
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] data-mono">+12 active</span>
          </div>

          <div className="flex items-center gap-1">
            {(isAdmin || isTeacher || isOwner) && (
              <>
                <button 
                  onClick={() => onEdit?.(resource)}
                  className="p-2 text-text-muted hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                  title="Edit"
                >
                  <Edit3 className="w-4 h-4" />
                </button>
                {(isAdmin || isOwner) && (
                  <button 
                    onClick={() => setShowConfirm(true)}
                    className="p-2 text-text-muted hover:text-error hover:bg-error/10 rounded-lg transition-all"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </>
            )}
            <button className="p-2 text-text-muted hover:text-text-main hover:bg-hover rounded-lg transition-all">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Embedded Sandbox-Friendly Delete Confirmation Overlay */}
      {showConfirm && (
        <div className="absolute inset-0 bg-white/95 z-[50] rounded-[2rem] p-6 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in duration-200">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-full flex items-center justify-center">
            <Trash2 className="w-7 h-7" />
          </div>
          <div>
            <h4 className="font-bold text-slate-800 text-base">Delete this resource?</h4>
            <p className="text-xs text-slate-500 mt-1">
              Are you sure you want to permanently delete <span className="text-slate-900 font-semibold">"{resource.title}"</span>? This cannot be undone.
            </p>
          </div>
          <div className="flex gap-2 w-full pt-2">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-600 font-bold text-xs hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                setShowConfirm(false);
                onDelete?.(resource.id);
              }}
              className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold text-xs hover:bg-red-700 transition-colors shadow-md"
            >
              Yes, Delete
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
}
