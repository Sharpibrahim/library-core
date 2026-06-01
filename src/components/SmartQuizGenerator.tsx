import React, { useState } from 'react';
import { 
  Brain, 
  Sparkles, 
  ChevronRight, 
  CheckCircle2, 
  HelpCircle, 
  RotateCw, 
  Loader2,
  BookOpen,
  Trophy,
  ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Resource, Quiz, QuizQuestion, User } from '../types';
import { getGeminiResponse } from '../services/gemini';

interface SmartQuizGeneratorProps {
  user: User;
  resources: Resource[];
  onBack?: () => void;
}

export function SmartQuizGenerator({ user, resources, onBack }: SmartQuizGeneratorProps) {
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);

  const generateQuiz = async () => {
    if (!selectedResource) return;
    setIsGenerating(true);
    setQuiz(null);
    setUserAnswers({});
    setShowResults(false);

    try {
      // 1. Generate quiz via server (which uses document text)
      const genResponse = await fetch('/api/quizzes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: selectedResource.id })
      });
      
      const genData = await genResponse.json();
      if (genData.error) throw new Error(genData.error);

      // Add IDs to questions for the UI if missing
      const questionsWithIds = genData.questions.map((q: any, idx: number) => ({
        ...q,
        id: q.id || `q-${idx}`
      }));

      // 2. Save the quiz to the database
      const saveResponse = await fetch('/api/quizzes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: genData.title,
          resourceId: selectedResource.id,
          questions: questionsWithIds,
          creatorId: user.uid
        })
      });

      const savedQuizData = await saveResponse.json();
      
      setQuiz({
        id: savedQuizData.id.toString(),
        title: genData.title,
        resourceId: selectedResource.id,
        questions: questionsWithIds,
        createdAt: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('Quiz Gen Error:', error);
      alert(error.message || 'Failed to generate quiz. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = (questionId: string, optionIndex: number) => {
    if (showResults) return;
    setUserAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const score = quiz ? quiz.questions.reduce((acc, q) => {
    return acc + (userAnswers[q.id] === q.correctAnswer ? 1 : 0);
  }, 0) : 0;

  const submitQuiz = async () => {
    if (!quiz) return;
    setShowResults(true);

    const answers = quiz.questions.map(q => userAnswers[q.id]);

    try {
      await fetch(`/api/quizzes/${quiz.id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          score,
          total: quiz.questions.length,
          answers
        })
      });
    } catch (err) {
      console.error('Failed to save quiz attempt:', err);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex items-center gap-6">
        {onBack && (
          <button onClick={onBack} className="p-3 rounded-2xl bg-white border border-border text-text-muted hover:text-primary transition-all">
             <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="space-y-1">
          <h1 className="text-4xl font-display font-black text-text-main tracking-tight">AI Quiz Master</h1>
          <p className="text-text-secondary font-medium">Select a resource to generate a customized assessment.</p>
        </div>
      </div>

      {!quiz ? (
        <div className="grid lg:grid-cols-3 gap-10">
          {/* Resource Selection */}
          <div className="lg:col-span-1 space-y-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-text-muted flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> 1. Select Study Material
            </h3>
            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {resources.map((res) => (
                <button
                  key={res.id}
                  onClick={() => setSelectedResource(res)}
                  className={`w-full p-4 rounded-2xl border transition-all text-left group flex items-start gap-4 ${
                    selectedResource?.id === res.id 
                      ? 'bg-primary/5 border-primary shadow-sm' 
                      : 'bg-white border-border hover:border-primary/50'
                  }`}
                >
                  <div className="w-12 h-16 rounded-lg overflow-hidden bg-section flex-shrink-0">
                    <img src={res.coverUrl || ''} className="w-full h-full object-cover" alt="" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-text-main group-hover:text-primary transition-colors line-clamp-1">{res.title}</h4>
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{res.subject || res.type}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Generator Action */}
          <div className="lg:col-span-2">
            <div className="bg-white border-2 border-dashed border-border rounded-[3rem] p-12 flex flex-col items-center justify-center text-center gap-8 min-h-[450px]">
              {selectedResource ? (
                 <>
                   <div className="w-24 h-24 rounded-[2.5rem] bg-primary/10 text-primary flex items-center justify-center">
                      <Brain className="w-12 h-12" />
                   </div>
                   <div className="space-y-4">
                     <h3 className="text-3xl font-display font-bold text-text-main">Ready to test your knowledge?</h3>
                     <p className="text-text-secondary max-w-md mx-auto">
                        I will analyze <span className="text-primary font-bold">"{selectedResource.title}"</span> and create a specialized quiz to challenge your understanding.
                     </p>
                   </div>
                   <button 
                    onClick={generateQuiz}
                    disabled={isGenerating}
                    className="px-12 py-5 bg-primary text-white rounded-[1.8rem] font-black shadow-2xl shadow-primary/30 hover:scale-105 transition-all text-sm uppercase tracking-widest flex items-center gap-4 disabled:opacity-50"
                   >
                     {isGenerating ? (
                       <Loader2 className="w-6 h-6 animate-spin" />
                     ) : (
                       <Sparkles className="w-6 h-6" />
                     )}
                     {isGenerating ? 'Analyzing Material...' : 'Generate Smart Quiz'}
                   </button>
                 </>
              ) : (
                <>
                  <div className="w-20 h-20 rounded-[2rem] bg-section text-text-muted flex items-center justify-center">
                    <HelpCircle className="w-10 h-10" />
                  </div>
                  <p className="text-text-secondary font-medium italic">Please select a resource from the list to begin.</p>
                </>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* Quiz Active View */
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-4xl mx-auto space-y-8"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-display font-black text-text-main">{quiz.title}</h2>
            <div className="px-4 py-2 bg-section rounded-xl text-xs font-black text-text-muted uppercase tracking-widest">
              {quiz.questions.length} Questions
            </div>
          </div>

          <div className="space-y-6">
            {quiz.questions.map((q, idx) => (
              <div key={q.id} className="bg-white p-8 rounded-[2.5rem] border border-border shadow-soft relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-primary/20" />
                <h3 className="text-lg font-bold text-text-main mb-6 flex items-start gap-4">
                  <span className="w-8 h-8 rounded-full bg-section flex items-center justify-center text-xs text-text-muted shrink-0">{idx + 1}</span>
                  {q.question}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {q.options.map((option, oIdx) => {
                    const isSelected = userAnswers[q.id] === oIdx;
                    const isCorrect = q.correctAnswer === oIdx;
                    const showCorrect = showResults && isCorrect;
                    const showWrong = showResults && isSelected && !isCorrect;

                    return (
                      <button
                        key={oIdx}
                        onClick={() => handleAnswer(q.id, oIdx)}
                        disabled={showResults}
                        className={`p-4 rounded-xl border-2 transition-all text-left font-medium relative ${
                          showCorrect ? 'bg-success/10 border-success text-success' :
                          showWrong ? 'bg-error/10 border-error text-error' :
                          isSelected ? 'bg-primary border-primary text-white shadow-lg' :
                          'bg-section border-transparent hover:border-border text-text-secondary'
                        }`}
                      >
                        {option}
                        {showCorrect && <CheckCircle2 className="w-4 h-4 absolute top-2 right-2" />}
                      </button>
                    );
                  })}
                </div>
                {showResults && q.explanation && (
                  <div className="mt-4 p-4 bg-primary/5 rounded-xl text-sm border border-primary/10">
                    <span className="font-bold text-primary">Explanation:</span> {q.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>

          {!showResults ? (
            <div className="pt-8 flex justify-center">
              <button 
                onClick={submitQuiz}
                disabled={Object.keys(userAnswers).length < quiz.questions.length}
                className="px-16 py-6 bg-primary text-white rounded-[2rem] font-black shadow-2xl shadow-primary/40 hover:scale-[1.05] transition-all uppercase tracking-[0.2em] text-xs disabled:opacity-50"
              >
                Submit Answers
              </button>
            </div>
          ) : (
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-slate-900 rounded-[3rem] p-12 text-center text-white space-y-6 shadow-2xl shadow-primary/20 border-4 border-primary/20"
            >
               <div className="w-24 h-24 rounded-full bg-primary flex items-center justify-center mx-auto mb-4 border-8 border-white/10 shadow-glow">
                  <Trophy className="w-10 h-10" />
               </div>
               <div className="space-y-2">
                 <h3 className="text-4xl font-display font-black tracking-tighter italic">Evaluation Complete</h3>
                 <p className="text-white/60 text-lg uppercase tracking-widest font-black">Score: {score} / {quiz.questions.length}</p>
               </div>
               <p className="text-white/40 max-w-sm mx-auto text-sm italic">
                  {score === quiz.questions.length ? "Incredible performance! You've mastered this material." : 
                   score >= 3 ? "Good effort! A little more study and you'll hit a perfect score." :
                   "A challenging result. Re-read the material and try again to improve."}
               </p>
               <div className="pt-6 flex gap-4 justify-center">
                 <button 
                    onClick={() => {
                        setQuiz(null);
                        setUserAnswers({});
                        setShowResults(false);
                    }}
                    className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all"
                 >
                   Try Another
                 </button>
                 <button 
                    onClick={generateQuiz}
                    className="px-8 py-4 bg-primary rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg"
                 >
                   Retake Quiz
                 </button>
               </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
