import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  ArrowRight, 
  HelpCircle, 
  Timer, 
  Trophy, 
  ShieldCheck,
  BrainCircuit,
  Zap,
  Sparkles,
  History,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Quiz, User, QuizAttempt, Resource } from '../types';
import { SmartQuizGenerator } from './SmartQuizGenerator';

interface QuizzesViewProps {
  user: User;
}

export function QuizzesView({ user }: QuizzesViewProps) {
  const [activeTab, setActiveTab] = useState<'available' | 'history' | 'create'>('available');
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const resResponse = await fetch('/api/resources');
      const resourcesData = await resResponse.json();
      setResources(resourcesData);

      const attemptsRes = await fetch(`/api/users/${user.uid}/quiz-attempts`);
      const attemptsData = await attemptsRes.json();
      setAttempts(attemptsData);

      const quizzesRes = await fetch('/api/quizzes');
      const quizzesData = await quizzesRes.json();
      setQuizzes(quizzesData);
    } catch (error) {
      console.error('Failed to fetch quizzes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user.id]);

  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Record<string, number>>({});
  const [showResults, setShowResults] = useState(false);

  const handleStartQuiz = (quiz: Quiz) => {
    setSelectedQuiz(quiz);
    setCurrentQuestionIdx(0);
    setUserAnswers({});
    setShowResults(false);
  };

  const handleAnswer = (questionId: string, optionIndex: number) => {
    if (showResults) return;
    setUserAnswers(prev => ({ ...prev, [questionId]: optionIndex }));
  };

  const score = selectedQuiz ? selectedQuiz.questions.reduce((acc, q) => {
    return acc + (userAnswers[q.id] === q.correctAnswer ? 1 : 0);
  }, 0) : 0;

  const submitQuiz = async () => {
    if (!selectedQuiz) return;
    setShowResults(true);

    const answers = selectedQuiz.questions.map(q => userAnswers[q.id]);

    try {
      await fetch(`/api/quizzes/${selectedQuiz.id}/attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          score,
          total: selectedQuiz.questions.length,
          answers
        })
      });
      fetchData(); // Refresh history
    } catch (err) {
      console.error('Failed to save quiz attempt:', err);
    }
  };

  if (selectedQuiz) {
    const questions = selectedQuiz.questions || [];
    const question = questions[currentQuestionIdx];

    return (
      <div className="max-w-4xl mx-auto py-10 animate-in fade-in duration-500">
        <div className="bg-white rounded-[4rem] border border-slate-100 shadow-2xl p-10 sm:p-20 relative overflow-hidden">
           {!showResults && (
             <div className="absolute top-0 left-0 w-full h-2 bg-slate-100">
               <motion.div 
                 initial={{ width: 0 }}
                 animate={{ width: `${((currentQuestionIdx + 1) / questions.length) * 100}%` }}
                 className="h-full bg-primary"
               />
             </div>
           )}

           <div className="flex items-center justify-between mb-16">
             <div className="flex items-center gap-3">
               <button onClick={() => setSelectedQuiz(null)} className="text-text-muted hover:text-primary transition-colors">
                  <ArrowRight className="w-5 h-5 rotate-180" />
               </button>
               <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Assessing</p>
                  <p className="text-xl font-display font-bold text-text-main">{selectedQuiz.title}</p>
               </div>
             </div>
             {!showResults && (
               <div className="text-right">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Progress</p>
                  <p className="text-xl font-display font-bold text-text-main">Question {currentQuestionIdx + 1} <span className="text-slate-200">/ {questions.length}</span></p>
               </div>
             )}
           </div>

           {!showResults ? (
             <div className="space-y-12">
               <h2 className="text-3xl font-display font-bold text-text-main leading-tight italic-serif">
                 {question?.question}
               </h2>

               <div className="grid grid-cols-1 gap-4">
                 {question?.options.map((option, i) => (
                   <button 
                    key={i}
                    onClick={() => handleAnswer(question.id, i)}
                    className={`w-full p-6 border rounded-3xl flex items-center gap-6 transition-all text-left group ${
                      userAnswers[question.id] === i 
                        ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' 
                        : 'bg-slate-50 border-slate-100 hover:bg-primary/5 hover:border-primary/20 text-text-secondary'
                    }`}
                   >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black transition-all ${
                        userAnswers[question.id] === i 
                          ? 'bg-white/20 text-white' 
                          : 'bg-white border border-slate-200 text-slate-400 group-hover:bg-primary group-hover:text-white group-hover:border-primary'
                      }`}>
                        {String.fromCharCode(65 + i)}
                      </div>
                      <span className="text-sm font-bold">{option}</span>
                   </button>
                 ))}
               </div>

               <div className="flex items-center justify-between pt-12 border-t border-slate-50">
                 <button 
                  onClick={() => setCurrentQuestionIdx(Math.max(0, currentQuestionIdx - 1))}
                  disabled={currentQuestionIdx === 0}
                  className="px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-slate-400 hover:text-primary disabled:opacity-30 flex items-center gap-2"
                 >
                   <ArrowRight className="w-4 h-4 rotate-180" /> Previous
                 </button>

                 {currentQuestionIdx < questions.length - 1 ? (
                   <button 
                    onClick={() => setCurrentQuestionIdx(currentQuestionIdx + 1)}
                    disabled={userAnswers[question.id] === undefined}
                    className="px-10 py-5 bg-slate-900 text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest hover:bg-primary transition-all shadow-xl shadow-slate-200 flex items-center gap-2 disabled:opacity-50"
                   >
                     Next Question <ArrowRight className="w-4 h-4" />
                   </button>
                 ) : (
                   <button 
                    onClick={submitQuiz}
                    disabled={userAnswers[question.id] === undefined}
                    className="px-10 py-5 bg-emerald-500 text-white rounded-[1.8rem] font-black text-[10px] uppercase tracking-widest hover:brightness-110 transition-all shadow-xl shadow-emerald-200 flex items-center gap-2 disabled:opacity-50"
                   >
                     Finish Assessment <Zap className="w-4 h-4" />
                   </button>
                 )}
               </div>
             </div>
           ) : (
             <div className="text-center space-y-10 py-10">
                <div className="w-24 h-24 bg-emerald-500 rounded-[2.5rem] flex items-center justify-center text-white mx-auto shadow-2xl shadow-emerald-200">
                  <Trophy className="w-12 h-12" />
                </div>
                
                <div>
                  <h2 className="text-4xl font-display font-bold text-text-main italic-serif">Evaluation Complete</h2>
                  <p className="text-slate-500 font-medium mt-4">You have successfully completed the assessment.</p>
                </div>

                <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
                   <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Score</p>
                     <p className="text-4xl font-display font-black text-emerald-500">{score}/{questions.length}</p>
                   </div>
                   <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Percentage</p>
                     <p className="text-4xl font-display font-black text-primary">{Math.round((score/questions.length) * 100)}%</p>
                   </div>
                </div>

                <div className="space-y-4 pt-4">
                  <button 
                    onClick={() => { setSelectedQuiz(null); setActiveTab('history'); }}
                    className="w-full py-5 bg-slate-900 text-white rounded-[1.8rem] font-black text-xs uppercase tracking-widest hover:bg-primary transition-all shadow-xl shadow-slate-200"
                  >
                    View History
                  </button>
                  <button 
                    onClick={() => setSelectedQuiz(null)}
                    className="text-xs font-bold text-primary hover:underline"
                  >
                    Return to Library
                  </button>
                </div>
             </div>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1400px] mx-auto w-full space-y-12 pb-20">
      {/* Academy Quiz Hero */}
      <section className="relative h-[250px] rounded-[3rem] overflow-hidden group">
        <div className="absolute inset-0 bg-slate-900">
          <img 
            src="https://images.unsplash.com/photo-1434030216411-0b793f4b4173?q=80&w=2070&auto=format&fit=crop" 
            className="w-full h-full object-cover opacity-40"
            alt="Quizzes Hero"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent" />
        </div>
        
        <div className="relative h-full flex flex-col justify-center px-10 sm:px-20 space-y-4">
          <div className="flex items-center gap-4">
             <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center shadow-2xl shadow-secondary/40"
            >
              <BrainCircuit className="w-6 h-6 text-white" />
            </motion.div>
            <div className="px-4 py-1 bg-white/10 backdrop-blur-md rounded-full text-[10px] font-black text-white uppercase tracking-widest border border-white/20">
              AI-Powered Assessment
            </div>
          </div>
          
          <h1 className="text-4xl sm:text-5xl font-display font-bold text-white italic-serif">Assessments & <span className="text-accent underline decoration-accent/30 underline-offset-8">Insight</span></h1>
          <p className="text-slate-400 max-w-xl text-sm leading-relaxed">
            Measure your comprehension across all library resources. Use AI to generate custom quizzes from your study material.
          </p>
        </div>
      </section>

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-white p-2 rounded-[2rem] border border-slate-100 w-fit mx-auto shadow-sm">
        <button 
          onClick={() => setActiveTab('available')}
          className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'available' ? 'bg-primary text-white shadow-lg' : 'bg-transparent text-slate-400 hover:text-text-main'}`}
        >
          <Zap className="w-4 h-4" /> Available
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'history' ? 'bg-primary text-white shadow-lg' : 'bg-transparent text-slate-400 hover:text-text-main'}`}
        >
          <History className="w-4 h-4" /> My History
        </button>
        <button 
          onClick={() => setActiveTab('create')}
          className={`px-8 py-3 rounded-full text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'create' ? 'bg-primary text-white shadow-lg' : 'bg-transparent text-slate-400 hover:text-text-main'}`}
        >
          <Sparkles className="w-4 h-4" /> AI Generator
        </button>
      </div>

      <div className="space-y-8 animate-in fade-in duration-500">
        {activeTab === 'available' && (
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              <h2 className="text-2xl font-display font-bold text-text-main italic-serif">Library Assessments</h2>
            </div>
            
            {quizzes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <AnimatePresence>
                  {quizzes.map((quiz, index) => (
                    <motion.div
                      key={quiz.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      whileHover={{ y: -5 }}
                      className="bg-white p-10 rounded-[4rem] border border-slate-100 shadow-sm hover:shadow-2xl transition-all group flex flex-col relative overflow-hidden"
                    >
                      {/* Decorative Background Icon */}
                      <div className="absolute top-[-10%] right-[-10%] w-32 h-32 bg-slate-50 rounded-full flex items-center justify-center -z-0 opacity-40 group-hover:scale-125 transition-transform duration-700">
                        <ClipboardList className="w-16 h-16 text-slate-100" />
                      </div>

                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-center justify-between mb-8">
                           <div className="p-4 bg-slate-900 text-white rounded-[1.8rem] shadow-xl shadow-slate-900/10 group-hover:bg-primary transition-colors duration-500">
                             <Zap className="w-6 h-6" />
                           </div>
                           <div className="text-right">
                              <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</span>
                              <span className="text-[10px] font-bold text-emerald-500 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-tighter">Ready</span>
                           </div>
                        </div>

                        <h3 className="text-2xl font-display font-bold text-text-main mb-4 group-hover:text-primary transition-colors line-clamp-2">
                           {quiz.title}
                        </h3>
                        
                        <p className="text-slate-500 text-xs font-medium leading-relaxed mb-8 line-clamp-2 italic">
                           Personalized AI-generated assessment based on library resources.
                        </p>
                        
                        <div className="flex flex-wrap items-center gap-4 mb-10 pt-6 border-t border-slate-50">
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl">
                            <HelpCircle className="w-3 h-3 text-slate-400" />
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{quiz.questions?.length || 0} Items</span>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-xl">
                            <ShieldCheck className="w-3 h-3 text-emerald-500" />
                            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Validated</span>
                          </div>
                        </div>

                        <button 
                          onClick={() => handleStartQuiz(quiz)}
                          className="mt-auto w-full py-5 bg-slate-50 group-hover:bg-slate-900 text-slate-900 group-hover:text-white rounded-[2rem] font-black text-xs uppercase tracking-widest transition-all shadow-sm group-hover:shadow-2xl group-hover:shadow-slate-900/30 flex items-center justify-center gap-3"
                        >
                          Begin Assessment
                          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="text-center py-24 bg-white rounded-[4rem] border border-slate-100 shadow-sm">
                 <FileText className="w-16 h-16 text-slate-100 mx-auto mb-4" />
                 <h3 className="text-xl font-display font-bold text-text-main">No static quizzes yet.</h3>
                 <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">Use the <b>AI Generator</b> to create a personalized quiz for any of your library books!</p>
                 <button 
                  onClick={() => setActiveTab('create')}
                  className="mt-8 px-10 py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all"
                 >
                   Go to AI Generator
                 </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'create' && (
          <SmartQuizGenerator 
            user={user}
            resources={resources} 
            onBack={() => setActiveTab('available')} 
          />
        )}

        {activeTab === 'history' && (
          <div className="space-y-8">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-emerald-500 rounded-full" />
              <h2 className="text-2xl font-display font-bold text-text-main italic-serif">Academic Performance</h2>
            </div>

            {attempts.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {attempts.map((attempt) => (
                   <motion.div 
                    key={attempt.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col gap-6"
                   >
                      <div className="flex justify-between items-start">
                         <div className="p-3 bg-emerald-50 text-emerald-500 rounded-2xl">
                           <CheckCircle2 className="w-5 h-5" />
                         </div>
                         <div className="text-right">
                            <span className="block text-[8px] font-black text-slate-400 uppercase tracking-widest">Score</span>
                            <span className="text-xl font-display font-black text-emerald-500">{attempt.score} / {attempt.total}</span>
                         </div>
                      </div>

                      <div>
                         <h4 className="font-bold text-text-main line-clamp-1">{attempt.quiz_title}</h4>
                         <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-1">{attempt.resource_title}</p>
                      </div>

                      <div className="pt-4 border-t border-slate-50 flex items-center justify-between text-[10px] font-black text-slate-300 uppercase tracking-widest">
                         <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(attempt.completed_at).toLocaleDateString()}
                         </div>
                         <div className="text-primary">
                            {Math.round((attempt.score / attempt.total) * 100)}% Success
                         </div>
                      </div>
                   </motion.div>
                 ))}
              </div>
            ) : (
              <div className="text-center py-20 bg-white rounded-[4rem] border border-slate-100 shadow-sm italic text-slate-400">
                You haven't completed any quizzes yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
