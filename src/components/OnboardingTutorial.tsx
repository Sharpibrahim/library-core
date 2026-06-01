import React, { useState } from 'react';
import { 
  X, 
  ChevronRight, 
  ChevronLeft, 
  BookOpen, 
  Search, 
  Trophy, 
  Bot, 
  Sparkles,
  CheckCircle2,
  GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface TutorialStep {
  title: string;
  description: string;
  icon: any;
  color: string;
  image?: string;
}

const STEPS: TutorialStep[] = [
  {
    title: "Welcome to Academic Library Elite",
    description: "Welcome, Scholar! You've just entered a premier AI-powered learning environment. Let's show you how to master your studies.",
    icon: GraduationCap,
    color: "bg-primary"
  },
  {
    title: "Your Study Hub",
    description: "This is your personal command center. Track your study streaks, view your academic stats, and quickly resume reading where you left off.",
    icon: BookOpen,
    color: "bg-emerald-500"
  },
  {
    title: "Smart Library Search",
    description: "Looking for something specific? Use our Smart Search. Ask AI for concepts like 'Photosynthesis' or 'Newtonian Laws' to find resources across all subjects.",
    icon: Search,
    color: "bg-orange-500"
  },
  {
    title: "Genius AI Assistant",
    description: "While reading, use the 'Test Me' tool to generate custom quizzes or the 'Summarize' tool to break down complex pages instantly.",
    icon: Bot,
    color: "bg-purple-500"
  },
  {
    title: "Ready to Start?",
    description: "That's it! You're ready to explore. Start by selecting your favorite subjects and opening your first book.",
    icon: Sparkles,
    color: "bg-warning"
  }
];

interface OnboardingTutorialProps {
  onComplete: () => void;
  onClose: () => void;
}

export function OnboardingTutorial({ onComplete, onClose }: OnboardingTutorialProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const next = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
    }
  };

  const prev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const step = STEPS[currentStep];
  const Icon = step.icon;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
        onClick={onClose}
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="relative w-full max-w-xl bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-white/20"
      >
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 w-full h-1.5 flex gap-1 px-8 pt-8">
          {STEPS.map((_, i) => (
            <div 
              key={i} 
              className={`h-full flex-grow rounded-full transition-all duration-500 ${
                i <= currentStep ? 'bg-primary' : 'bg-slate-100'
              }`}
            />
          ))}
        </div>

        <div className="p-10 pt-16 flex flex-col items-center text-center">
          <AnimatePresence mode="wait">
            <motion.div 
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center w-full"
            >
              <div className={`w-24 h-24 rounded-[2.5rem] ${step.color} text-white flex items-center justify-center mb-8 shadow-xl shadow-inner`}>
                <Icon className="w-10 h-10" />
              </div>

              <h2 className="text-3xl font-display font-black text-text-main mb-4 tracking-tight">
                {step.title}
              </h2>
              
              <p className="text-slate-500 text-lg leading-relaxed mb-10 max-w-sm font-medium">
                {step.description}
              </p>
            </motion.div>
          </AnimatePresence>

          <div className="flex items-center justify-between w-full mt-auto">
            <button 
              onClick={prev}
              disabled={currentStep === 0}
              className={`flex items-center gap-2 text-sm font-bold transition-all ${
                currentStep === 0 ? 'opacity-0' : 'text-slate-400 hover:text-text-main'
              }`}
            >
              <ChevronLeft className="w-5 h-5" /> Previous
            </button>

            <button 
              onClick={next}
              className="px-10 py-5 bg-primary text-white rounded-[1.8rem] font-black shadow-2xl shadow-primary/30 hover:scale-105 transition-all text-sm uppercase tracking-widest flex items-center gap-3"
            >
              {currentStep === STEPS.length - 1 ? 'Finish Tutorial' : 'Continue'} 
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </motion.div>
    </div>
  );
}
