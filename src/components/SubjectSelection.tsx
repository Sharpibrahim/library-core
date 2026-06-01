import React, { useState } from 'react';
import { Check, Loader2, Sparkles, BookOpen, GraduationCap, Microscope, Globe, Music, Palette, Calculator, Languages } from 'lucide-react';
import { motion } from 'motion/react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

const SUBJECTS = [
  { id: 'math', name: 'Mathematics', icon: Calculator },
  { id: 'science', name: 'Science', icon: Microscope },
  { id: 'history', name: 'History', icon: Globe },
  { id: 'literature', name: 'Literature', icon: BookOpen },
  { id: 'arts', name: 'Arts', icon: Palette },
  { id: 'music', name: 'Music', icon: Music },
  { id: 'languages', name: 'Languages', icon: Languages },
  { id: 'philosophy', name: 'Philosophy', icon: GraduationCap },
];

interface SubjectSelectionProps {
  userId: string;
  onComplete: (subjects: string[]) => void;
}

export function SubjectSelection({ userId, onComplete }: SubjectSelectionProps) {
  const [selected, setSelected] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSubject = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(s => s !== id));
    } else if (selected.length < 4) {
      setSelected([...selected, id]);
    }
  };

  const handleSave = async () => {
    if (selected.length < 2) {
      setError('Please select at least 2 subjects');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        favoriteSubjects: selected
      });

      onComplete(selected);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 sm:p-6 lg:p-8 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 rounded-full blur-[120px]" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-8 sm:p-12 border border-slate-100 relative z-10"
      >
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-6">
            <Sparkles className="w-8 h-8" />
          </div>
          <h2 className="text-4xl font-serif font-bold text-slate-900 mb-4 leading-tight">
            Personalize Your <br />
            <span className="gradient-text italic">Learning Journey</span>
          </h2>
          <p className="text-slate-500 text-lg max-w-md mx-auto">
            Select 2 to 4 subjects you're most interested in. We'll use this to recommend resources for you.
          </p>
        </div>

        {error && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-8 p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-medium border border-red-100 flex items-center gap-3"
          >
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            {error}
          </motion.div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {SUBJECTS.map((subject) => {
            const isSelected = selected.includes(subject.id);
            const Icon = subject.icon;
            
            return (
              <button
                key={subject.id}
                onClick={() => toggleSubject(subject.id)}
                className={`group relative flex flex-col items-center p-6 rounded-3xl transition-all duration-300 ${
                  isSelected 
                    ? 'bg-primary text-white shadow-xl shadow-primary/30 scale-105' 
                    : 'bg-slate-50 text-slate-600 hover:bg-white hover:shadow-lg hover:shadow-slate-200/50 border border-transparent hover:border-slate-200'
                }`}
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 ${
                  isSelected ? 'bg-white/20' : 'bg-white shadow-sm border border-slate-100'
                }`}>
                  <Icon className={`w-6 h-6 ${isSelected ? 'text-white' : 'text-slate-600'}`} />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest">{subject.name}</span>
                
                {isSelected && (
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-lg"
                  >
                    <Check className="w-4 h-4 text-primary font-bold" />
                  </motion.div>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col items-center gap-4">
          <button
            onClick={handleSave}
            disabled={isSaving || selected.length < 2}
            className="btn-primary w-full max-w-xs py-4 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all"
          >
            {isSaving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Start Exploring
                <Check className="w-5 h-5" />
              </>
            )}
          </button>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {selected.length} of 4 subjects selected
          </p>
        </div>
      </motion.div>
    </div>
  );
}
