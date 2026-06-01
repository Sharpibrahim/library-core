import React from 'react';
import { Book, Star, ArrowRight, Calculator, Atom, FlaskConical, Dna, Languages, Landmark, Globe, Code, TrendingUp, Feather } from 'lucide-react';
import { motion } from 'motion/react';
import { User } from '../types';

interface SubjectsViewProps {
  user: User;
  onSelectSubject: (subject: string) => void;
}

const SUBJECT_DETAILS: Record<string, { icon: any, gradient: string, desc: string }> = {
  'Mathematics': { icon: Calculator, gradient: 'from-blue-500 to-cyan-500', desc: 'Algebra, Calculus, Geometry & Statistics' },
  'Physics': { icon: Atom, gradient: 'from-purple-500 to-fuchsia-500', desc: 'Mechanics, Thermodynamics & Quantum' },
  'Chemistry': { icon: FlaskConical, gradient: 'from-emerald-500 to-teal-500', desc: 'Organic, Inorganic & Physical Chemistry' },
  'Biology': { icon: Dna, gradient: 'from-green-500 to-emerald-500', desc: 'Genetics, Ecology & Human Anatomy' },
  'English': { icon: Languages, gradient: 'from-rose-500 to-pink-500', desc: 'Grammar, Composition & Comprehension' },
  'History': { icon: Landmark, gradient: 'from-amber-500 to-orange-500', desc: 'World History, Civilizations & Eras' },
  'Geography': { icon: Globe, gradient: 'from-sky-500 to-blue-500', desc: 'Physical & Human Geography' },
  'Computer Science': { icon: Code, gradient: 'from-indigo-500 to-violet-500', desc: 'Programming, Algorithms & Systems' },
  'Economics': { icon: TrendingUp, gradient: 'from-yellow-500 to-amber-500', desc: 'Micro, Macro & Global Markets' },
  'Literature': { icon: Feather, gradient: 'from-red-500 to-rose-500', desc: 'Classic & Modern Literary Works' }
};

const ALL_SUBJECTS = Object.keys(SUBJECT_DETAILS);

export function SubjectsView({ user, onSelectSubject }: SubjectsViewProps) {
  const favorites = user.favoriteSubjects || [];
  
  // Sort subjects: favorites first, then others alphabetically
  const sortedSubjects = [...ALL_SUBJECTS].sort((a, b) => {
    const aIsFav = favorites.includes(a);
    const bIsFav = favorites.includes(b);
    
    if (aIsFav && !bIsFav) return -1;
    if (!aIsFav && bIsFav) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10">
        <h2 className="text-4xl font-serif font-bold text-slate-900 mb-2">Explore <span className="gradient-text">Subjects</span></h2>
        <p className="text-slate-500">Dive into specific fields of study. Your favorites are listed first.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {sortedSubjects.map((subject, index) => {
          const isFav = favorites.includes(subject);
          const details = SUBJECT_DETAILS[subject] || { icon: Book, gradient: 'from-slate-500 to-slate-600', desc: 'Explore resources for this subject.' };
          const Icon = details.icon;
          
          return (
            <motion.button
              key={subject}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelectSubject(subject)}
              className="group relative bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-500 text-left overflow-hidden hover:-translate-y-1"
            >
              {/* Background Accent */}
              <div className={`absolute -right-10 -top-10 w-40 h-40 bg-gradient-to-br ${details.gradient} opacity-[0.03] group-hover:opacity-10 rounded-full blur-3xl transition-opacity duration-500`} />
              
              <div className="flex items-start justify-between mb-8 relative z-10">
                <div className={`p-4 rounded-2xl bg-gradient-to-br ${details.gradient} text-white shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-transform duration-500`}>
                  <Icon className="w-7 h-7" />
                </div>
                {isFav && (
                  <div className="flex items-center gap-1.5 bg-amber-50 text-amber-600 px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-amber-100 shadow-sm">
                    <Star className="w-3.5 h-3.5 fill-amber-600" />
                    Favorite
                  </div>
                )}
              </div>

              <div className="relative z-10">
                <h3 className="text-2xl font-bold text-slate-900 mb-3 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-slate-900 group-hover:to-slate-600 transition-all">{subject}</h3>
                <p className="text-sm text-slate-500 mb-8 leading-relaxed">{details.desc}</p>
                
                <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-400 group-hover:text-slate-900 transition-colors">
                  <span>Explore Module</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform duration-300" />
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
