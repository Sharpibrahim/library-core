import React, { useState, useEffect } from 'react';
import { Course, CourseSection, CourseLesson, User } from '../types';
import { 
  ArrowLeft, Save, Plus, GripVertical, Trash2, Edit2, PlayCircle, 
  FileText, Bookmark, PenTool, CheckCircle2, ChevronDown, ChevronRight, Upload,
  Brain, Image as ImageIcon, Sparkles, Wand2, Award, ChevronRightSquare, Layers,
  Eye, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { generateCourseLevel, generateCourseImage, generateQuizQuestions, generateFinalExam } from '../services/gemini';
import { CoursePlayer } from './CoursePlayer';

interface CourseBuilderProps {
  user: User;
  onBack: () => void;
  existingCourse?: Course;
}

type BuilderStep = 'info' | 'curriculum' | 'exam' | 'certificate';

export function CourseBuilder({ user, onBack, existingCourse }: CourseBuilderProps) {
  const [step, setStep] = useState<BuilderStep>(existingCourse?.id ? 'curriculum' : 'info');
  const [title, setTitle] = useState(existingCourse?.title || '');
  const [description, setDescription] = useState(existingCourse?.description || '');
  const [subject, setSubject] = useState(existingCourse?.subject || 'Mathematics');
  const [difficulty, setDifficulty] = useState(existingCourse?.difficulty || 'Beginner');
  const [category, setCategory] = useState(existingCourse?.category || 'Science');
  const [tags, setTags] = useState(existingCourse?.tags || '');
  const [thumbnailUrl, setThumbnailUrl] = useState(existingCourse?.thumbnail_url || '');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [sections, setSections] = useState<CourseSection[]>([]);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(existingCourse?.id || null);
  const [finalExam, setFinalExam] = useState<any>(null);
  const [addingLessonToSection, setAddingLessonToSection] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState('');
  const [newLessonVideo, setNewLessonVideo] = useState('');
  const [addingWithQuiz, setAddingWithQuiz] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [newSectionTitle, setNewSectionTitle] = useState('');
  
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editLessonTitle, setEditLessonTitle] = useState('');
  const [editLessonVideo, setEditLessonVideo] = useState('');
  
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  useEffect(() => {
    if (activeCourseId) {
      loadCourseDetails();
    }
  }, [activeCourseId]);

  const loadCourseDetails = async () => {
    try {
      const res = await fetch(`/api/courses/${activeCourseId}`);
      if (res.ok) {
        const data = await res.json();
        setSections(data.sections || []);
        // Load final exam if exists
        const quizRes = await fetch(`/api/courses/${activeCourseId}/quizzes?type=exam`);
        if (quizRes.ok) {
          const quizzes = await quizRes.json();
          if (quizzes.length > 0) setFinalExam(quizzes[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const notify = async (title: string, message: string, type: 'info' | 'success' | 'alert') => {
    try {
      await addDoc(collection(db, 'notifications'), {
        userId: user.uid,
        title,
        message,
        type,
        read: false,
        timestamp: serverTimestamp()
      });
    } catch (e) {
      console.error("Failed to send notification", e);
    }
  };

  const handleAddSection = async () => {
    if (!newSectionTitle.trim()) {
      notify('System Error', 'Please enter a section name', 'alert');
      return;
    }
    
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/courses/${activeCourseId}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newSectionTitle.trim(), order_index: sections.length })
      });
      
      if (res.ok) {
        setAddingSection(false);
        setNewSectionTitle('');
        await loadCourseDetails();
        notify('Curriculum Updated', `Module "${newSectionTitle}" successfully initialized`, 'success');
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add section');
      }
    } catch (e: any) {
      console.error(e);
      notify('System Failure', e.message || 'Failed to add section', 'alert');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleInitialSave = async () => {
    if (!title || !description) {
      notify('Form Incomplete', 'Title and description are mandatory for asset generation', 'alert');
      return;
    }

    setIsGenerating(true);
    try {
      notify('AI Orchestration', 'Generating course metadata and visual assets...', 'info');
      // ... rest of handleInitialSave ...
      const [aiLevel, aiImage] = await Promise.all([
        generateCourseLevel(title, description),
        generateCourseImage(title, description)
      ]);

      setDifficulty(aiLevel);
      if (aiImage) setThumbnailUrl(aiImage);

      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, subject, difficulty: aiLevel, category, tags, 
          status: 'draft',
          teacher_id: user.id || null,
          teacher_uid: user.uid,
          thumbnail_url: aiImage
        })
      });
      
      if (!res.ok) throw new Error('Failed to create course in database');
      
      const data = await res.json();
      if (!data.id) throw new Error('No ID returned from course creation');
      
      setActiveCourseId(data.id);
      setStep('curriculum');
      notify('Academy Initialized', `Project "${title}" is ready for curriculum mapping`, 'success');
    } catch (e: any) {
      console.error('Course Generation/Creation Error:', e);
      notify('Orchestration Failed', e.message || 'Unknown error during initialization', 'alert');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddLesson = async (sectionId: string, withQuiz: boolean = false) => {
    if (!newLessonTitle.trim()) {
      alert('Please enter a lesson title');
      return;
    }
    
    if (withQuiz) {
      setIsGenerating(true);
    }
    
    try {
      // 1. Add Lesson
      const lessonBody = { 
        title: newLessonTitle.trim(), 
        type: 'video', 
        content: '', 
        order_index: sections.find(s => String(s.id) === String(sectionId))?.lessons?.length || 0, 
        video_url: newLessonVideo.trim()
      };
      
      console.log('Sending lesson data:', lessonBody);

      const lessonRes = await fetch(`/api/sections/${sectionId}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(lessonBody)
      });
      
      if (!lessonRes.ok) {
        const errorData = await lessonRes.json();
        throw new Error(errorData.error || 'Failed to create lesson');
      }
      
      const lessonData = await lessonRes.json();
      console.log('Lesson created:', lessonData);

      // Reset form immediately for better UX
      setAddingLessonToSection(null);
      setNewLessonTitle('');
      setNewLessonVideo('');

      // UI update immediately after adding lesson
      await loadCourseDetails();

      // 2. Auto-generate Quiz if requested
      if (withQuiz) {
        try {
          const questions = await generateQuizQuestions(newLessonTitle);
          if (questions && questions.length > 0) {
            await fetch(`/api/quizzes`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                course_id: activeCourseId,
                lesson_id: lessonData.id,
                title: `${newLessonTitle} Quiz`,
                questions: JSON.stringify(questions),
                type: 'lesson'
              })
            });
          }
        } catch (quizError) {
          console.error('Quiz generation failed:', quizError);
          // Don't alert here as the lesson was successfully added
        }
      }
    } catch (e) {
      console.error('Lesson add error:', e);
      alert(`Failed to add lesson: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      if (withQuiz) {
        setIsGenerating(false);
      }
    }
  };

  const handleDeleteSection = async (sectionId: string) => {
    if (!window.confirm('Delete this entire section and all its lessons?')) return;
    try {
      const res = await fetch(`/api/sections/${sectionId}`, { method: 'DELETE' });
      if (res.ok) loadCourseDetails();
    } catch (e) { console.error(e); }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!window.confirm('Delete this lesson?')) return;
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, { method: 'DELETE' });
      if (res.ok) loadCourseDetails();
    } catch (e) { console.error(e); }
  };

  const handleUpdateLesson = async (lessonId: string) => {
    if (!editLessonTitle.trim()) {
      alert('Please enter a lesson title');
      return;
    }
    
    setIsGenerating(true);
    try {
      const res = await fetch(`/api/lessons/${lessonId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editLessonTitle.trim(),
          video_url: editLessonVideo.trim(),
          type: 'video',
          content: '',
          order_index: 0 // Keep current order if possible, or handle on server
        })
      });
      
      if (res.ok) {
        setEditingLessonId(null);
        await loadCourseDetails();
      } else {
        throw new Error('Failed to update lesson');
      }
    } catch (e) {
      console.error(e);
      alert('Failed to update lesson');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateSection = async (sectionId: string) => {
    if (!newSectionTitle.trim()) {
      alert('Please enter a section title');
      return;
    }
    
    setIsGenerating(true);
    try {
      // We need a /api/sections/:id endpoint in server.ts
      const res = await fetch(`/api/sections/${sectionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newSectionTitle.trim() })
      });
      
      if (res.ok) {
        setEditingSectionId(null);
        setNewSectionTitle('');
        await loadCourseDetails();
      }
    } catch (e) {
      console.error(e);
      alert('Failed to update section');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveAsDraft = async () => {
    if (!activeCourseId) return;
    try {
      await fetch(`/api/courses/${activeCourseId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title, description, subject, difficulty, category, tags,
          thumbnail_url: thumbnailUrl,
          status: 'draft'
        })
      });
      alert('Progress saved as draft!');
    } catch (e) {
      console.error(e);
      alert('Failed to save draft');
    }
  };

  const handleGenerateFinalExam = async () => {
    setIsGenerating(true);
    try {
      const questions = await generateFinalExam(title, description);
      const res = await fetch(`/api/quizzes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: activeCourseId,
          title: `${title} Final Exam`,
          questions: JSON.stringify(questions),
          type: 'exam'
        })
      });
      const data = await res.json();
      setFinalExam(data);
      setStep('certificate');
    } catch (e) {
      console.error(e);
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!activeCourseId) return;
    
    // Save Certificate Template first
    await fetch(`/api/courses/${activeCourseId}/certificate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_data: { title, instructor: user.fullName, date: new Date().toISOString() } })
    });

    await fetch(`/api/courses/${activeCourseId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'published' })
    });
    alert('Course published successfully!');
    onBack();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 bg-[#FBFBFF]/80 backdrop-blur-md z-30 py-4 border-b border-gray-100 mb-6">
        <button onClick={onBack} className="flex items-center gap-2 text-sm font-bold text-gray-500 hover:text-purple-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>
        
        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto">
          <StepBadge active={step === 'info'} done={step !== 'info'} label="1. Info" onClick={() => setStep('info')} />
          <div className="w-4 h-px bg-gray-200" />
          <StepBadge active={step === 'curriculum'} done={step === 'exam' || step === 'certificate'} label="2. Curriculum" onClick={() => activeCourseId && setStep('curriculum')} />
          <div className="w-4 h-px bg-gray-200" />
          <StepBadge active={step === 'exam'} done={step === 'certificate'} label="3. Exam" onClick={() => activeCourseId && setStep('exam')} />
          <div className="w-4 h-px bg-gray-200" />
          <StepBadge active={step === 'certificate'} done={false} label="4. Certificate" onClick={() => activeCourseId && setStep('certificate')} />
        </div>

        {activeCourseId && (
          <div className="flex items-center gap-2">
            <button 
              onClick={handleSaveAsDraft}
              className="px-4 py-2 text-xs font-black text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
            >
              SAVE DRAFT
            </button>
            <button 
              onClick={handlePublish}
              className="px-4 py-2 bg-purple-600 text-white text-xs font-black rounded-xl hover:bg-purple-700 transition-all shadow-lg shadow-purple-600/20"
            >
              PUBLISH
            </button>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {isPreviewMode ? (
          <div className="fixed inset-0 z-[100] bg-white overflow-hidden p-4 sm:p-8">
             <CoursePlayer 
               course={{
                 id: activeCourseId || '',
                 title,
                 description,
                 subject,
                 difficulty,
                 category,
                 thumbnail_url: thumbnailUrl,
                 sections: sections
               } as any}
               user={user}
               onBack={() => setIsPreviewMode(false)}
               isPreview={true}
             />
          </div>
        ) : (
          <>
            {step === 'info' && (
          <motion.div 
            key="info"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xl space-y-8"
          >
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-black text-gray-900">Create a New Course</h2>
              <p className="text-gray-500">Provide the basic details, and our AI will handle the rest.</p>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Course Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={e => setTitle(e.target.value)} 
                  className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-purple-500 focus:outline-none text-xl font-bold" 
                  placeholder="e.g. Master the Art of Quantum Physics" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Course Description</label>
                <textarea 
                  value={description} 
                  onChange={e => setDescription(e.target.value)} 
                  rows={4} 
                  className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-purple-500 focus:outline-none leading-relaxed" 
                  placeholder="What will your students achieve after completing this course?"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Subject</label>
                  <select value={subject} onChange={e => setSubject(e.target.value)} className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-purple-500 focus:outline-none font-bold">
                    <option>Mathematics</option>
                    <option>Physics</option>
                    <option>Computer Science</option>
                    <option>Business</option>
                    <option>Arts & Design</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full px-6 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-purple-500 focus:outline-none font-bold">
                    <option>Professional</option>
                    <option>Academic</option>
                    <option>Leisure</option>
                    <option>Technical</option>
                  </select>
                </div>
              </div>
            </div>

            <button 
              onClick={handleInitialSave}
              disabled={isGenerating}
              className="w-full py-5 bg-black text-white rounded-2xl font-black text-lg hover:bg-gray-900 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <Wand2 className="w-6 h-6 animate-pulse" />
                  AI is crafting your course assets...
                </>
              ) : (
                <>
                  Generate Course Assets <Plus className="w-6 h-6" />
                </>
              )}
            </button>
          </motion.div>
        )}

        {step === 'curriculum' && (
          <motion.div 
            key="curriculum"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xl flex items-center gap-6">
              <div className="w-32 aspect-video rounded-xl overflow-hidden bg-gray-100 shadow-inner">
                {thumbnailUrl ? <img src={thumbnailUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon className="text-gray-300" /></div>}
              </div>
              <div className="flex-grow">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-600 text-[10px] font-black uppercase rounded-full">{difficulty}</span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-black uppercase rounded-full">{subject}</span>
                </div>
                <h2 className="text-2xl font-black text-gray-900 leading-tight">{title}</h2>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPreviewMode(true)}
                  className="px-4 py-3 bg-purple-100 text-purple-600 rounded-2xl font-black hover:bg-purple-200 transition-colors flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" /> Preview
                </button>
                <button 
                  onClick={() => setStep('exam')}
                  className="px-6 py-3 bg-green-500 text-white rounded-2xl font-black hover:bg-green-600 transition-colors flex items-center gap-2"
                >
                  Proceed to Exam <ChevronRightSquare className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-black text-gray-900">Course Curriculum</h3>
                {!addingSection ? (
                  <button 
                    onClick={() => setAddingSection(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-600 font-bold rounded-xl hover:bg-purple-100 transition-colors"
                  >
                    <Plus className="w-4 h-4" /> Add Section
                  </button>
                ) : (
                  <div className="flex items-center gap-2 animate-in slide-in-from-right-2">
                    <input 
                      type="text" 
                      placeholder="Section Name" 
                      className="px-4 py-2 rounded-xl border border-purple-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      value={newSectionTitle}
                      onChange={(e) => setNewSectionTitle(e.target.value)}
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSection()}
                    />
                    <button 
                      onClick={handleAddSection}
                      disabled={isGenerating}
                      className="px-4 py-2 bg-purple-600 text-white rounded-xl text-xs font-bold disabled:opacity-50"
                    >
                      {isGenerating ? 'Saving...' : 'Save'}
                    </button>
                    <button 
                      onClick={() => setAddingSection(false)}
                      className="text-xs font-bold text-gray-400 hover:text-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {sections.length === 0 ? (
                  <div className="py-20 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-100 flex flex-col items-center justify-center text-center px-10">
                    <Layers className="w-12 h-12 text-gray-300 mb-4" />
                    <h4 className="text-gray-900 font-bold">No Sections Yet</h4>
                    <p className="text-gray-500 text-sm max-w-xs mt-1">Add your first module section using the button above to start adding lessons.</p>
                  </div>
                ) : (
                  sections.map((section, idx) => (
                    <div key={section.id} className="border-2 border-gray-50 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      {editingSectionId === section.id ? (
                         <div className="flex items-center gap-2 flex-grow mr-4">
                            <input 
                              type="text" 
                              value={newSectionTitle}
                              onChange={(e) => setNewSectionTitle(e.target.value)}
                              className="px-3 py-1.5 rounded-lg border border-purple-200 text-sm focus:outline-none w-full"
                              autoFocus
                            />
                            <button onClick={() => handleUpdateSection(section.id)} className="p-2 bg-purple-600 text-white rounded-lg"><CheckCircle2 className="w-4 h-4" /></button>
                            <button onClick={() => setEditingSectionId(null)} className="p-2 bg-gray-100 text-gray-500 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                         </div>
                      ) : (
                        <h4 className="font-black text-gray-900">Module {idx + 1}: {section.title}</h4>
                      )}
                      
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => {
                            setEditingSectionId(section.id);
                            setNewSectionTitle(section.title);
                          }}
                          className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="Edit Section"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteSection(section.id)}
                          className="p-2 text-red-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete Section"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => {
                            setAddingLessonToSection(section.id);
                            setAddingWithQuiz(false);
                          }} 
                          className="text-xs font-bold bg-white text-gray-900 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                        >
                          Add Lesson
                        </button>
                        <button 
                          onClick={() => {
                            setAddingLessonToSection(section.id);
                            setAddingWithQuiz(true);
                          }} 
                          className="text-xs font-bold bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-black flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" /> AI Quiz
                        </button>
                      </div>
                    </div>

                    {addingLessonToSection === section.id && (
                      <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 space-y-3 animate-in slide-in-from-top-2">
                        <div className="grid grid-cols-2 gap-3">
                          <input 
                            type="text" 
                            placeholder="Lesson Title" 
                            className="px-4 py-2 rounded-lg border border-purple-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            value={newLessonTitle}
                            onChange={(e) => setNewLessonTitle(e.target.value)}
                            autoFocus
                          />
                          <input 
                            type="text" 
                            placeholder="YouTube URL (optional)" 
                            className="px-4 py-2 rounded-lg border border-purple-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                            value={newLessonVideo}
                            onChange={(e) => setNewLessonVideo(e.target.value)}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <button 
                             onClick={() => setAddingLessonToSection(null)}
                             className="text-xs font-bold text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                          <button 
                             onClick={() => handleAddLesson(section.id, addingWithQuiz)}
                             disabled={isGenerating}
                             className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold shadow-lg shadow-purple-600/20 disabled:opacity-50"
                          >
                            {isGenerating ? 'Adding...' : (addingWithQuiz ? 'Add with AI Quiz' : 'Add Lesson')}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="grid gap-3">
                      {section.lessons?.map(lesson => (
                        <div key={lesson.id} className="group relative">
                        <div className={`flex flex-col gap-3 bg-gray-50 p-4 rounded-xl border ${editingLessonId === lesson.id ? 'border-purple-300 ring-2 ring-purple-100' : 'border-gray-100'}`}>
                           {editingLessonId === lesson.id ? (
                             <div className="space-y-3">
                               <div className="grid grid-cols-2 gap-3">
                                  <input 
                                    type="text" 
                                    value={editLessonTitle}
                                    onChange={(e) => setEditLessonTitle(e.target.value)}
                                    className="px-4 py-2 rounded-lg border border-purple-200 text-sm focus:outline-none"
                                    placeholder="Lesson Title"
                                  />
                                  <input 
                                    type="text" 
                                    value={editLessonVideo}
                                    onChange={(e) => setEditLessonVideo(e.target.value)}
                                    className="px-4 py-2 rounded-lg border border-purple-200 text-sm focus:outline-none"
                                    placeholder="YouTube Video URL"
                                  />
                               </div>
                               <div className="flex justify-end gap-2">
                                  <button onClick={() => setEditingLessonId(null)} className="text-xs font-bold text-gray-500">Cancel</button>
                                  <button onClick={() => handleUpdateLesson(lesson.id)} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold">Update Lesson</button>
                               </div>
                             </div>
                           ) : (
                             <div className="flex items-center gap-3">
                               <PlayCircle className="w-5 h-5 text-purple-600" />
                               <div className="flex-grow">
                                 <div className="font-bold text-gray-800">{lesson.title}</div>
                                 <div className="text-[10px] text-gray-400 font-mono truncate max-w-sm">{lesson.video_url}</div>
                               </div>
                               <div className="px-3 py-1 bg-white rounded-lg border border-gray-100 flex items-center gap-1.5 shadow-sm">
                                 <Sparkles className="w-3 h-3 text-amber-500" />
                                 <span className="text-[10px] font-black text-gray-500 uppercase">Quiz</span>
                               </div>
                               <div className="flex items-center gap-1">
                                 <button 
                                   onClick={() => {
                                     setEditingLessonId(lesson.id);
                                     setEditLessonTitle(lesson.title);
                                     setEditLessonVideo(lesson.video_url || '');
                                   }}
                                   className="p-2 text-gray-400 hover:text-purple-600 hover:bg-white rounded-lg transition-all"
                                   title="Edit Lesson"
                                 >
                                   <Edit2 className="w-4 h-4" />
                                 </button>
                                 <button 
                                   onClick={() => handleDeleteLesson(lesson.id)}
                                   className="p-2 text-gray-300 hover:text-red-500 hover:bg-white rounded-lg transition-all"
                                   title="Delete Lesson"
                                 >
                                   <Trash2 className="w-4 h-4" />
                                 </button>
                               </div>
                             </div>
                           )}
                        </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )))}
              </div>
            </div>
          </motion.div>
        )}

        {step === 'exam' && (
          <motion.div 
            key="exam"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-3xl border border-gray-100 p-12 shadow-2xl text-center space-y-8"
          >
            <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto scale-110">
              <Brain className="w-12 h-12" />
            </div>
            <div className="space-y-2">
              <h2 className="text-4xl font-black text-gray-900">Ready for the Final Exam?</h2>
              <p className="text-gray-500 max-w-md mx-auto">AI will now synthesize all course modules into a challenging 10-question final examination.</p>
            </div>
            
            <button 
              onClick={handleGenerateFinalExam}
              disabled={isGenerating}
              className="px-12 py-5 bg-black text-white rounded-2xl font-black text-xl hover:scale-105 transition-all shadow-xl disabled:opacity-50 flex items-center gap-3 mx-auto"
            >
              {isGenerating ? <><Wand2 className="animate-spin" /> Generating Exam...</> : <><Sparkles /> Synthesize Final Exam</>}
            </button>
          </motion.div>
        )}

        {step === 'certificate' && (
          <motion.div 
            key="certificate"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <div className="bg-white rounded-3xl border border-gray-100 p-8 shadow-xl text-center space-y-6">
              <div className="w-20 h-20 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mx-auto">
                <Award className="w-10 h-10" />
              </div>
              <h2 className="text-3xl font-black text-gray-900">Certificate Designer</h2>
              
              {/* Certificate Preview */}
              <div className="aspect-[1.414/1] w-full max-w-2xl mx-auto bg-[#FAFAFA] border-[12px] border-double border-gray-200 p-12 flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
                <div className="mb-8 font-serif text-gray-400 uppercase tracking-[0.4em] text-xs font-bold">Certificate of Achievement</div>
                <div className="text-sm text-gray-500 font-medium mb-2">This is to certify that</div>
                <div className="text-4xl font-serif italic text-gray-900 mb-8 border-b-2 border-gray-100 w-full px-8 pb-4 text-center">Student Name</div>
                <div className="text-sm text-gray-500 font-medium mb-2">has successfully completed</div>
                <div className="text-2xl font-black text-gray-900 mb-12 uppercase tracking-wide px-8 text-center">{title}</div>
                
                <div className="flex justify-between w-full px-12 mt-auto">
                  <div className="text-center">
                    <div className="w-32 border-b border-gray-300 mb-2"></div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{user.fullName || 'INSTRUCTOR'}</div>
                  </div>
                  <div className="w-16 h-16 border-2 border-gray-100 rounded-full flex items-center justify-center -rotate-12">
                    <div className="text-[10px] font-black text-gray-300">SEAL</div>
                  </div>
                  <div className="text-center">
                    <div className="w-32 border-b border-gray-300 mb-2"></div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{new Date().toLocaleDateString()}</div>
                  </div>
                </div>
              </div>

              <div className="pt-8">
                <button 
                  onClick={handlePublish}
                  className="px-12 py-4 bg-purple-600 text-white rounded-2xl font-black text-lg hover:bg-purple-700 transition-all flex items-center justify-center gap-3 mx-auto"
                >
                  <CheckCircle2 className="w-6 h-6" /> Finish & Publish Course
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </>
    )}
  </AnimatePresence>
    </div>
  );
}

function StepBadge({ active, done, label, onClick }: { active: boolean; done: boolean; label: string; onClick?: () => void }) {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-2 cursor-pointer ${active ? 'text-purple-600 font-black' : done ? 'text-green-600' : 'text-gray-300 font-bold'} text-xs uppercase tracking-widest transition-colors`}
    >
      <div className={`w-6 h-6 rounded-lg flex items-center justify-center border-2 ${active ? 'border-purple-600 bg-purple-50' : done ? 'border-green-600 bg-green-50' : 'border-gray-100'} transition-all`}>
        {done ? <CheckCircle2 className="w-4 h-4" /> : <div className="text-[10px]">{label.split('.')[0]}</div>}
      </div>
      <span className="hidden sm:inline">{label.split('. ')[1]}</span>
    </div>
  );
}
