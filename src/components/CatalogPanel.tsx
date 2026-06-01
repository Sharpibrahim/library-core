import React, { useState } from 'react';
import { Edit, X, Loader2, BookOpen, User, Hash, Tag, Calendar, Image as ImageIcon, FileText } from 'lucide-react';
import { Resource } from '../types';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface CatalogPanelProps {
  resource: Resource;
  onClose: () => void;
  onUpdateSuccess: () => void;
}

export function CatalogPanel({ resource, onClose, onUpdateSuccess }: CatalogPanelProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsUpdating(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = Object.fromEntries(formData.entries());

    try {
      // Logic for updating in Firestore
      const resourceRef = doc(db, 'resources', resource.id);
      await updateDoc(resourceRef, {
        title: data.title,
        author: data.author,
        isbn: data.isbn,
        genre: data.genre,
        publicationDate: data.publicationDate,
        uniqueIdentifier: data.uniqueIdentifier,
        type: data.type,
        coverUrl: data.coverUrl,
        description: data.description,
      });

      onUpdateSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] border border-slate-200">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h2 className="text-2xl font-serif font-bold text-slate-900 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Edit className="w-5 h-5" />
            </div>
            Catalog Resource
          </h2>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-8 overflow-y-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-2xl text-sm font-medium border border-red-100 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              {error}
            </div>
          )}

          <form id="catalog-form" onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="title" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Title *</label>
                <div className="relative">
                  <BookOpen className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    id="title" 
                    name="title" 
                    defaultValue={resource.title}
                    required 
                    className="glass-input block w-full pl-11 pr-4 py-3 text-slate-900 sm:text-sm"
                    placeholder="Resource Title"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="author" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Author *</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    id="author" 
                    name="author" 
                    defaultValue={resource.author}
                    required 
                    className="glass-input block w-full pl-11 pr-4 py-3 text-slate-900 sm:text-sm"
                    placeholder="Author Name"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="isbn" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">ISBN</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    id="isbn" 
                    name="isbn" 
                    defaultValue={resource.isbn || ''}
                    className="glass-input block w-full pl-11 pr-4 py-3 text-slate-900 sm:text-sm"
                    placeholder="ISBN Number"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="genre" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Genre</label>
                <div className="relative">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    id="genre" 
                    name="genre" 
                    defaultValue={resource.genre || ''}
                    className="glass-input block w-full pl-11 pr-4 py-3 text-slate-900 sm:text-sm"
                    placeholder="e.g. Fiction, Science"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="publicationDate" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Publication Date</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="date" 
                    id="publicationDate" 
                    name="publicationDate" 
                    defaultValue={resource.publicationDate || ''}
                    className="glass-input block w-full pl-11 pr-4 py-3 text-slate-900 sm:text-sm"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="uniqueIdentifier" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Unique Identifier</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="text" 
                    id="uniqueIdentifier" 
                    name="uniqueIdentifier" 
                    defaultValue={resource.uniqueIdentifier || ''}
                    className="glass-input block w-full pl-11 pr-4 py-3 text-slate-900 sm:text-sm"
                    placeholder="e.g. LIB-2026-001"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label htmlFor="type" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Resource Type *</label>
                <div className="relative">
                  <FileText className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <select 
                    id="type" 
                    name="type" 
                    defaultValue={resource.type}
                    required
                    className="glass-input block w-full pl-11 pr-4 py-3 text-slate-900 sm:text-sm appearance-none"
                  >
                    <option value="book">Book</option>
                    <option value="article">Article</option>
                    <option value="video">Video</option>
                    <option value="journal">Journal</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-2">
                <label htmlFor="coverUrl" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Cover Image URL</label>
                <div className="relative">
                  <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input 
                    type="url" 
                    id="coverUrl" 
                    name="coverUrl" 
                    defaultValue={resource.coverUrl || ''}
                    className="glass-input block w-full pl-11 pr-4 py-3 text-slate-900 sm:text-sm"
                    placeholder="https://example.com/cover.jpg"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 ml-1">Description</label>
              <textarea 
                id="description" 
                name="description" 
                rows={3}
                defaultValue={resource.description || ''}
                className="glass-input block w-full px-4 py-3 text-slate-900 sm:text-sm resize-none"
                placeholder="Brief summary of the resource..."
              />
            </div>
          </form>
        </div>

        <div className="px-8 py-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isUpdating}
            className="px-6 py-2.5 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="catalog-form"
            disabled={isUpdating}
            className="btn-primary px-8 py-2.5 text-sm font-bold flex items-center justify-center gap-2 min-w-[140px]"
          >
            {isUpdating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
