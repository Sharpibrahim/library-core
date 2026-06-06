import React, { useState, useEffect } from 'react';
import { 
  Heart, 
  FolderPlus, 
  Folder, 
  BookOpen, 
  Trash2, 
  ExternalLink, 
  FileText, 
  Video, 
  Layers, 
  Plus, 
  Search, 
  X, 
  ChevronRight, 
  Edit3, 
  Save, 
  Filter,
  ArrowRight,
  BookMarked,
  Sparkles,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Resource, User, ShelfItem } from '../types';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  doc, 
  deleteDoc, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';

interface ShelfViewProps {
  user: User;
  resources: Resource[];
  onOpenResource: (resource: Resource) => void;
  createNotification?: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
}

export function ShelfView({ user, resources, onOpenResource, createNotification }: ShelfViewProps) {
  const [shelfItems, setShelfItems] = useState<ShelfItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedSubject, setSelectedSubject] = useState('All');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  
  // Custom categories defined by the user
  const [customCategories, setCustomCategories] = useState<string[]>(['Favorites', 'Exam Prep', 'Unorganized']);
  
  // Item editing state
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingCategory, setEditingCategory] = useState('');
  const [firebaseUser, setFirebaseUser] = useState(auth.currentUser);
  const [showFiltersOnMobile, setShowFiltersOnMobile] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setFirebaseUser(u);
    });
    return () => unsubscribe();
  }, []);

  // Fetch user's personal shelf items from Firestore
  useEffect(() => {
    if (!user?.uid || !firebaseUser || firebaseUser.uid !== user.uid) return;

    const shelfRef = collection(db, 'users', user.uid, 'shelf');
    const q = query(shelfRef, orderBy('likedAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: ShelfItem[] = [];
      snapshot.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...docSnap.data() } as ShelfItem);
      });
      setShelfItems(items);

      // Extract unique categories defined on shelf items to sync state
      const existingCategories = new Set<string>(['Favorites', 'Exam Prep', 'Unorganized']);
      items.forEach(item => {
        if (item.category) existingCategories.add(item.category);
      });
      setCustomCategories(Array.from(existingCategories));
    }, (error) => {
      console.error('Error fetching shelf items:', error);
      handleFirestoreError(error, OperationType.LIST, shelfRef.path);
    });

    return () => unsubscribe();
  }, [user?.uid, firebaseUser]);

  // Handle removing straight from shelf (unlike)
  const handleRemoveFromShelf = async (itemId: string, resourceTitle: string) => {
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'shelf', itemId));
      if (createNotification) {
        createNotification('Removed from Shelf', `"${resourceTitle}" was successfully removed.`, 'info');
      }
    } catch (error: any) {
      console.error('Error removing from shelf:', error);
      if (createNotification) {
        createNotification('Removal Failed', 'Please try again later.', 'error');
      }
    }
  };

  // Modify categorization of a saved item
  const handleUpdateItemCategory = async (itemId: string, newCategory: string) => {
    try {
      await updateDoc(doc(db, 'users', user.uid, 'shelf', itemId), {
        category: newCategory
      });
      setEditingItemId(null);
      if (createNotification) {
        createNotification('Shelf Updated', 'Category updated successfully.', 'success');
      }
    } catch (error: any) {
      console.error('Error updating category:', error);
      if (createNotification) {
        createNotification('Update Failed', 'Failed to update category.', 'error');
      }
    }
  };

  // Create a new customized category shelf folder
  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      alert('Please enter a valid shelf folder name.');
      return;
    }
    if (customCategories.includes(trimmed)) {
      alert('This shelf folder category already exists.');
      return;
    }
    setCustomCategories(prev => [...prev, trimmed]);
    setNewCategoryName('');
    setIsAddingCategory(false);
    setSelectedCategory(trimmed);
    if (createNotification) {
      createNotification('Shelf Category Added', `New folder "${trimmed}" created!`, 'success');
    }
  };

  // Find the live Resource from local list if available, or build reference
  const getResourceDetails = (item: ShelfItem): Resource | null => {
    return resources.find(r => r.id === item.resourceId) || null;
  };

  // Filtering Logic
  const filteredItems = shelfItems.filter(item => {
    // Search keyword
    const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (item.author && item.author.toLowerCase().includes(searchQuery.toLowerCase()));
    
    // Category criteria
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;

    // Subject/Subject-area criteria with robust fallback to live resource details
    const liveResource = getResourceDetails(item);
    const itemSubject = liveResource?.subject || item.subject || 'General';
    const matchesSubject = selectedSubject === 'All' || itemSubject === selectedSubject;

    return matchesSearch && matchesCategory && matchesSubject;
  });

  // Extract unique subjects for filtering with robust fallback
  const uniqueSubjects = Array.from(new Set(shelfItems.map(item => {
    const liveResource = getResourceDetails(item);
    return liveResource?.subject || item.subject || 'General';
  }).filter(Boolean)));

  return (
    <div className="max-w-[1300px] mx-auto w-full font-sans pb-24 animate-in fade-in duration-300">
      
      {/* Premium Header Accent banner */}
      <div className="relative rounded-3xl sm:rounded-[2.5rem] overflow-hidden bg-gradient-to-r from-purple-900 to-indigo-800 text-white p-6 sm:p-10 mb-6 sm:mb-8 shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent)]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-3">
            <div className="px-3 py-1.5 rounded-full bg-white/10 w-max text-xs font-black uppercase tracking-widest flex items-center gap-1.5 border border-white/5 animate-pulse">
              <BookMarked className="w-3.5 h-3.5" />
              Academic Bookshelf
            </div>
            <h1 className="text-4xl font-display font-extrabold tracking-tight">
              My Organized <span className="text-purple-305 text-accent-content font-serif italic text-indigo-250">Shelf</span>
            </h1>
            <p className="text-white/80 max-w-xl text-sm font-medium leading-relaxed">
              Organize liked textbooks, document tutorials, and lecture videos into custom sub-shelves. Filter by subject or custom tags instantly.
            </p>
          </div>
          <div className="flex items-center gap-4 bg-white/5 backdrop-blur-md rounded-3xl p-6 border border-white/5 shrink-0 self-start md:self-auto">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-yellow-300">
               <Award className="w-6 h-6" />
            </div>
            <div>
               <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest ">Saved Resources</p>
               <p className="text-2xl font-black data-mono">{shelfItems.length} Liked</p>
            </div>
          </div>
        </div>
      </div>

      {/* Control Bar: Search & Action Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-8 items-start">
        
        {/* Left Side: Sidebar filters & Category Manager */}
        <div className={`lg:col-span-3 space-y-6 ${showFiltersOnMobile ? 'block' : 'hidden lg:block'}`}>
          
          {/* Sub-shelves Category List */}
          <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-3">
              <h3 className="font-bold text-text-main text-sm uppercase tracking-wider flex items-center gap-2">
                <Folder className="w-4 h-4 text-purple-600" />
                My Sub-Shelves
              </h3>
              <button 
                onClick={() => setIsAddingCategory(!isAddingCategory)}
                className="p-1.5 bg-purple-50 text-purple-640 hover:bg-purple-100 rounded-lg transition-colors"
                title="Create sub-shelf folder"
              >
                <Plus className="w-4 h-4 text-purple-600" />
              </button>
            </div>

            {/* Custom Category Adding drawer */}
            {isAddingCategory && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="mb-4 bg-purple-50/50 p-3 rounded-xl border border-purple-100 space-y-2 overflow-hidden"
              >
                <p className="text-[10px] uppercase font-bold text-slate-500">New Shelf Name</p>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="e.g., Exam Prep" 
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    className="flex-grow bg-white border border-slate-200 text-xs px-2.5 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-purple-600"
                  />
                  <button 
                    onClick={handleAddCategory}
                    className="px-2.5 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700"
                  >
                    Add
                  </button>
                </div>
              </motion.div>
            )}

            {/* Sub-shelves categories tabs */}
            <div className="space-y-1.5">
              <button
                onClick={() => setSelectedCategory('All')}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs transition-all ${
                  selectedCategory === 'All' 
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/10' 
                    : 'text-gray-600 hover:bg-slate-55 hover:bg-slate-100'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4" />
                  All Liked Items
                </span>
                <span className={`px-2 py-0.5 rounded-lg text-[10px] ${selectedCategory === 'All' ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {shelfItems.length}
                </span>
              </button>

              {customCategories.map(cat => {
                const count = shelfItems.filter(item => item.category === cat).length;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-bold text-xs transition-all ${
                      selectedCategory === cat 
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/10' 
                        : 'text-gray-600 hover:bg-slate-100'
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate pr-2">
                      <Folder className="w-4 h-4 shrink-0" />
                      {cat}
                    </span>
                    <span className={`px-2 py-0.5 rounded-lg text-[10px] ${selectedCategory === cat ? 'bg-purple-700 text-white' : 'bg-slate-150 bg-slate-100 text-slate-600'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subject Filtering list */}
          {uniqueSubjects.length > 0 && (
            <div className="bg-white rounded-3xl border border-gray-150 p-6 shadow-sm">
              <h3 className="font-bold text-text-main text-xs uppercase tracking-wider mb-4 border-b border-gray-100 pb-2">
                Filter by Subject
              </h3>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedSubject('All')}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    selectedSubject === 'All'
                      ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                      : 'bg-slate-50 text-slate-600 border border-transparent hover:bg-slate-100'
                  }`}
                >
                  All Subjects
                </button>
                {uniqueSubjects.map(sub => (
                  <button
                    key={sub}
                    onClick={() => setSelectedSubject(sub)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                      selectedSubject === sub
                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                        : 'bg-slate-50 text-slate-600 border border-transparent hover:bg-slate-100'
                    }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Shelf Grid with search and custom cards */}
        <div className="lg:col-span-9 space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
            <div className="w-full flex gap-3">
              <div className="relative flex-grow">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  placeholder="Search resources, books, or authors on your shelf..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-2xl pl-12 pr-4 py-3 placeholder:text-slate-400 font-sans text-sm focus:outline-none focus:ring-2 focus:ring-purple-600"
                />
                {searchQuery && (
                  <button 
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setShowFiltersOnMobile(!showFiltersOnMobile)}
                className="lg:hidden flex items-center gap-2 px-4 py-3 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-xs rounded-2xl border border-purple-100 transition-all shrink-0"
                title="Toggle Folders & Filters"
              >
                <Filter className="w-4 h-4 text-purple-600" />
                <span>{showFiltersOnMobile ? 'Hide Folders' : 'Folders & Filters'}</span>
              </button>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div className="bg-white border rounded-[2.5rem] py-20 px-8 text-center border-dashed border-gray-200 flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-purple-50 rounded-[2rem] flex items-center justify-center text-purple-600 mb-6 border border-purple-50">
                <Heart className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold font-display text-text-main mb-2">No shelf items found</h3>
              <p className="text-slate-500 max-w-sm text-sm font-medium">
                {shelfItems.length === 0 
                  ? "You haven't liked any resource documents or learning videos yet." 
                  : "Try adjusting filters or search tag queries to find your books."}
              </p>
              {shelfItems.length === 0 && (
                <p className="text-xs text-purple-600 font-bold bg-purple-50 border border-purple-100 rounded-full px-4 py-1.5 mt-4">
                  💡 Hint: Like or save documents inside the primary Library!
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredItems.map(item => {
                  const liveResource = getResourceDetails(item);
                  const coverImage = (item.coverUrl && !item.coverUrl.includes('picsum.photos')) 
                    ? item.coverUrl 
                    : 'https://images.unsplash.com/photo-1543002588-bfa74002ed7e?w=400';
                  const isVideo = item.type?.toLowerCase() === 'video';

                  return (
                    <motion.div
                      layout
                      key={item.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="bg-white border border-gray-150 rounded-3xl overflow-hidden hover:shadow-md transition-shadow group flex flex-col h-full relative"
                    >
                      {/* Top Cover Cover */}
                      <div className="relative aspect-[16/10] overflow-hidden bg-slate-900 border-b border-gray-100 shrink-0">
                        <img 
                          src={coverImage} 
                          alt={item.title} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                        
                        {/* Upper Badges */}
                        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 max-w-[70%]">
                          <span className="px-2 py-0.5 rounded-full bg-white/90 backdrop-blur-md text-[8px] font-black tracking-widest text-text-main uppercase shadow-sm">
                            {item.category || 'Unorganized'}
                          </span>
                          {item.subject && (
                            <span className="px-2 py-0.5 rounded-full bg-indigo-600 text-white text-[8px] font-black tracking-widest uppercase shadow-sm">
                              {item.subject}
                            </span>
                          )}
                        </div>

                        {/* Heart Button directly inside upper overlay wrapper */}
                        <button
                          onClick={() => handleRemoveFromShelf(item.id, item.title)}
                          className="absolute top-3 right-3 p-2 rounded-full bg-white/90 backdrop-blur-md text-red-500 hover:text-red-700 hover:scale-110 active:scale-90 transition-all shadow-sm z-10"
                          title="Unlike and remove from shelf"
                        >
                          <Heart className="w-4 h-4 fill-current text-red-500" />
                        </button>

                        <div className="absolute bottom-3 right-3">
                          {isVideo ? (
                            <span className="bg-red-600 text-white text-[8px] font-black uppercase px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                              <Video className="w-3 h-3" /> VIDEO
                            </span>
                          ) : (
                            <span className="bg-indigo-600 text-white text-[8px] font-black uppercase px-2 py-1 rounded-md flex items-center gap-1 shadow-sm">
                              <FileText className="w-3 h-3" /> DOC
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Info & Organization controls body */}
                      <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                        <div>
                          <h4 className="text-text-main font-bold font-display text-base tracking-tight leading-snug group-hover:text-purple-600 transition-colors line-clamp-2" title={item.title}>
                            {item.title}
                          </h4>
                          {item.author && (
                            <p className="text-xs text-slate-500 italic mt-1 leading-normal">by {item.author}</p>
                          )}
                          <p className="text-[10px] text-slate-400 font-medium font-mono uppercase tracking-wider mt-1">
                            Saved on {new Date(item.likedAt).toLocaleDateString()}
                          </p>
                        </div>

                        {/* Shelf item reorganization panel */}
                        <div className="bg-slate-50/50 border border-slate-100 p-3 rounded-2xl relative">
                          {editingItemId === item.id ? (
                            <div className="space-y-2">
                              <p className="text-[9px] uppercase font-bold text-slate-500">Pick Folder Shelf</p>
                              <div className="flex gap-1.5">
                                <select
                                  value={editingCategory}
                                  onChange={e => setEditingCategory(e.target.value)}
                                  className="flex-grow bg-white border border-slate-200 text-xs rounded-lg p-1 font-semibold text-slate-700 focus:outline-none"
                                >
                                  {customCategories.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => handleUpdateItemCategory(item.id, editingCategory)}
                                  className="p-1 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-lg flex items-center gap-1 transition-colors"
                                >
                                  <Save className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingItemId(null)}
                                  className="p-1 text-slate-500 hover:bg-slate-100 rounded-lg text-xs font-bold"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                                <Folder className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span className="font-bold text-[11px]">Folder: {item.category || 'Unorganized'}</span>
                              </div>
                              <button
                                onClick={() => {
                                  setEditingItemId(item.id);
                                  setEditingCategory(item.category || 'Unorganized');
                                }}
                                className="text-[10px] font-black text-purple-600 hover:underline flex items-center gap-0.5 uppercase tracking-wide"
                              >
                                <Edit3 className="w-3 h-3 text-purple-600" /> Organize
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-end">
                          <button
                            onClick={() => {
                              if (liveResource) {
                                onOpenResource(liveResource);
                              } else {
                                // Fallback manual load
                                onOpenResource({
                                  id: item.resourceId,
                                  title: item.title,
                                  author: item.author || 'Unknown',
                                  type: item.type || 'pdf',
                                  coverUrl: item.coverUrl || null,
                                  fileUrl: liveResource?.fileUrl || null,
                                  description: 'Saved on personal shelf.',
                                  createdAt: item.likedAt,
                                  status: 'available',
                                  borrowedBy: null,
                                  genre: item.category,
                                  isbn: null,
                                  publicationDate: null,
                                  uniqueIdentifier: null,
                                  subject: item.subject
                                });
                              }
                            }}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-colors shadow-sm shadow-purple-600/10"
                          >
                            <span>Open Resource</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
