import React, { useState, useEffect } from 'react';
import { Classroom, User, ClassAssignment, ClassSubmission } from '../types';
import { ArrowLeft, Users, FileText, CheckCircle2, MessageSquare, Plus, Clock, Copy, MoreVertical, Edit2, Upload, Video } from 'lucide-react';
import { motion } from 'motion/react';
import { ClassroomConference } from './ClassroomConference';

interface ClassroomDetailProps {
  classId: string;
  user: User;
  onBack: () => void;
}

export function ClassroomDetail({ classId, user, onBack }: ClassroomDetailProps) {
  const [cls, setCls] = useState<Classroom | null>(null);
  const [activeTab, setActiveTab] = useState<'stream' | 'classwork' | 'people' | 'live'>('stream');
  const [announcementText, setAnnouncementText] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const isTeacher = user.role === 'teacher' || user.role === 'admin' || (cls && ((cls as any).teacher_uid === user.uid || String(cls.teacher_id) === String(user.uid)));

  const [isAddWorkModalOpen, setIsAddWorkModalOpen] = useState(false);
  const [newWorkTitle, setNewWorkTitle] = useState('');
  const [newWorkDesc, setNewWorkDesc] = useState('');
  const [newWorkType, setNewWorkType] = useState('homework');
  const [newWorkTopic, setNewWorkTopic] = useState('');

  const [isAddTopicModalOpen, setIsAddTopicModalOpen] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [assignmentDetails, setAssignmentDetails] = useState<any | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [gradingSubmissionId, setGradingSubmissionId] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [gradingStatus, setGradingStatus] = useState<'completed' | 'needs_improvement'>('completed');

  useEffect(() => {
    if (!activeAssignmentId) {
      setAssignmentDetails(null);
      setSubmissionText('');
      setUploadedFileUrl(null);
      setUploadedFileName(null);
      return;
    }
    const fetchAssignment = async () => {
      try {
        const res = await fetch(`/api/assignments/${activeAssignmentId}`);
        if (res.ok) {
          const data = await res.json();
          setAssignmentDetails(data);
        }
      } catch (err) {
        console.error("Failed to fetch assignment details:", err);
      }
    };
    fetchAssignment();
  }, [activeAssignmentId]);

  const fetchData = async () => {
     try {
        const res = await fetch(`/api/classes/${classId}`);
        if (res.ok) setCls(await res.json());

        const pRes = await fetch(`/api/classes/${classId}/announcements`);
        if (pRes.ok) setPosts(await pRes.json());
     } catch (e) {
        console.error(e);
     }
  };

  useEffect(() => {
     fetchData();
  }, [classId]);

  const handleCreateTopic = async () => {
     if (!newTopicTitle.trim()) return;
     try {
        await fetch(`/api/classes/${classId}/topics`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ title: newTopicTitle.trim() })
        });
        setIsAddTopicModalOpen(false);
        setNewTopicTitle('');
        fetchData();
     } catch(e) {
        console.error(e);
     }
  };

  const handlePostAnnouncement = async () => {
     if(!announcementText.trim()) return;
     try {
        await fetch(`/api/classes/${classId}/announcements`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ content: announcementText, teacher_id: user.uid })
        });
        setAnnouncementText('');
        fetchData();
     } catch (e) {
        console.error(e);
     }
  };

  const handleCreateWork = async () => {
     if (!newWorkTitle.trim()) return;
     let topicId = newWorkTopic || null;

     try {
        await fetch(`/api/classes/${classId}/assignments`, {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
              topic_id: topicId,
              title: newWorkTitle,
              description: newWorkDesc,
              assignment_type: newWorkType
           })
        });

        setIsAddWorkModalOpen(false);
        setNewWorkTitle('');
        setNewWorkDesc('');
        setNewWorkTopic('');
        fetchData();
     } catch(e) {
        console.error(e);
     }
  };

  if (!cls) return <div className="p-8 text-center text-gray-500 font-medium">Loading classroom...</div>;

   if (activeAssignmentId) {
      const localAssignment = cls.unorganizedAssignments?.find((a: any) => String(a.id) === String(activeAssignmentId)) ||
         cls.topics?.flatMap((t: any) => t.assignments || []).find((a: any) => String(a.id) === String(activeAssignmentId));
      
      const displayTitle = assignmentDetails?.title || localAssignment?.title || 'Assignment Details';
      const displayDesc = assignmentDetails?.description || localAssignment?.description || '';
      const displayType = assignmentDetails?.assignment_type || localAssignment?.assignment_type || 'homework';

      const mySubmission = assignmentDetails?.submissions?.find((s: any) => String(s.student_id) === String(user.uid));

      const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
         const file = e.target.files?.[0];
         if (!file) return;
         
         setIsUploading(true);
         const formData = new FormData();
         formData.append('file', file);
         
         try {
            const res = await fetch('/api/upload', {
               method: 'POST',
               body: formData,
            });
            if (res.ok) {
               const data = await res.json();
               setUploadedFileUrl(data.url);
               setUploadedFileName(file.name);
            } else {
               alert("Failed to upload document file.");
            }
         } catch (err) {
            console.error(err);
            alert("Error uploading file.");
         } finally {
            setIsUploading(false);
         }
      };

      const handleTurnIn = async () => {
         setIsSubmitting(true);
         try {
            const res = await fetch(`/api/assignments/${activeAssignmentId}/submissions`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                  student_id: user.uid,
                  content: submissionText,
                  file_url: uploadedFileUrl
               })
            });
            if (res.ok) {
               alert("Assignment submitted successfully!");
               // Reload assignment details to fetch updated submissions list
               const detailRes = await fetch(`/api/assignments/${activeAssignmentId}`);
               if (detailRes.ok) {
                  setAssignmentDetails(await detailRes.json());
               }
               setSubmissionText('');
               setUploadedFileUrl(null);
               setUploadedFileName(null);
            } else {
               alert("Failed to turn in assignment.");
            }
         } catch (err) {
            console.error(err);
            alert("Error turning in assignment.");
         } finally {
            setIsSubmitting(false);
         }
      };

      const handleGradeSubmission = async (submissionId: string) => {
         try {
            const res = await fetch(`/api/submissions/${submissionId}/grade`, {
               method: 'POST',
               headers: { 'Content-Type': 'application/json' },
               body: JSON.stringify({
                  status: gradingStatus,
                  feedback: feedbackText
               })
            });
            if (res.ok) {
               alert("Submission graded successfully!");
               setGradingSubmissionId(null);
               setFeedbackText('');
               // Reload assignment details to fetch updated list
               const detailRes = await fetch(`/api/assignments/${activeAssignmentId}`);
               if (detailRes.ok) {
                  setAssignmentDetails(await detailRes.json());
               }
            } else {
               alert("Failed to grade submission.");
            }
         } catch (err) {
            console.error(err);
            alert("Error grading submission.");
         }
      };

      return (
         <div className="max-w-[1000px] mx-auto w-full font-sans pb-24 animate-in fade-in">
            <button onClick={() => setActiveAssignmentId(null)} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-bold mb-6 transition-colors rounded-xl px-2 py-1 -ml-2 hover:bg-gray-100">
               <ArrowLeft className="w-5 h-5" /> Back to Classwork
            </button>
            
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-8 space-y-8">
               {/* Header */}
               <div className="flex items-start gap-4 border-b border-gray-100 pb-8">
                  <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center shrink-0">
                     <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                     <div className="flex items-center gap-2 mb-1">
                        <span className="uppercase text-[10px] font-black tracking-widest text-purple-600 bg-purple-50 px-2.5 py-1 rounded-md">{displayType}</span>
                        {localAssignment?.due_date && (
                           <span className="text-xs text-slate-500 flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> Due {new Date(localAssignment.due_date).toLocaleDateString()}
                           </span>
                        )}
                     </div>
                     <h2 className="text-3xl font-bold text-gray-900">{displayTitle}</h2>
                  </div>
               </div>
               
               {/* Description */}
               <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-3">Instructions</h3>
                  <div className="prose max-w-none text-gray-700 bg-slate-50 border border-slate-100 p-6 rounded-2xl whitespace-pre-wrap">
                     {displayDesc || "No instructions provided for this assignment."}
                  </div>
               </div>

               {!isTeacher ? (
                  <div className="border-t border-gray-100 pt-8">
                     <h3 className="text-xl font-bold text-gray-900 mb-4">Your Work</h3>
                     
                     {mySubmission && (
                       <div className="bg-purple-50/50 border border-purple-100 rounded-2xl p-6 mb-6">
                          <div className="flex items-center justify-between mb-4">
                             <span className="text-sm font-semibold text-slate-500">Already Submitted On {new Date(mySubmission.submitted_at).toLocaleString()}</span>
                             <span className={`px-3 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${
                                mySubmission.status === 'completed' 
                                  ? 'bg-green-100 text-green-700' 
                                  : mySubmission.status === 'needs_improvement' 
                                  ? 'bg-amber-100 text-amber-700' 
                                  : 'bg-blue-100 text-blue-700'
                             }`}>
                                {mySubmission.status}
                             </span>
                          </div>
                          
                          <div className="bg-white border border-purple-100 rounded-xl p-4 mb-4 whitespace-pre-wrap text-sm text-slate-700">
                             {mySubmission.content || <span className="italic text-slate-400">No text answer provided.</span>}
                          </div>

                          {mySubmission.file_url ? (
                             <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-4 mb-4">
                                <div className="flex items-center gap-2">
                                   <FileText className="w-5 h-5 text-purple-600" />
                                   <span className="text-sm font-semibold text-slate-700">Attached File Attachment</span>
                                </div>
                                <a 
                                   href={mySubmission.file_url} 
                                   target="_blank" 
                                   rel="noreferrer" 
                                   className="px-4 py-1.5 bg-purple-605 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors inline-block"
                                >
                                   View File Content
                                </a>
                             </div>
                          ) : (
                             <p className="text-xs text-slate-500 mb-4 italic">No document file attached.</p>
                          )}

                          {mySubmission.feedback && (
                             <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 mt-2">
                                <p className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-1">Teacher Feedback</p>
                                <p className="text-sm text-amber-900">{mySubmission.feedback}</p>
                             </div>
                          )}
                       </div>
                     )}

                     <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                       <textarea 
                          placeholder="Type your answer, observations, or response detail here..." 
                          value={submissionText}
                          onChange={e => setSubmissionText(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl p-4 min-h-[150px] resize-none focus:outline-none focus:ring-2 focus:ring-purple-600 mb-4 font-sans text-sm text-slate-805 text-slate-800"
                       />
                       
                       {/* Selected file notification badge */}
                       {uploadedFileUrl && (
                          <div className="flex items-center justify-between bg-white border border-emerald-100 rounded-xl p-4 mb-4">
                             <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-emerald-600 animate-pulse" />
                                <div>
                                   <span className="text-sm font-bold text-slate-700 block">{uploadedFileName || 'Document PDF ready'}</span>
                                   <span className="text-xs text-emerald-600 font-medium">Successfully uploaded & attached!</span>
                                </div>
                             </div>
                             <button 
                                onClick={() => {
                                   setUploadedFileUrl(null);
                                   setUploadedFileName(null);
                                }}
                                className="text-xs text-red-500 hover:underline font-bold"
                             >
                                Remove
                             </button>
                          </div>
                       )}

                       <div className="flex justify-between items-center">
                          <input 
                             type="file" 
                             id="assignment-file-input" 
                             accept=".pdf,.doc,.docx" 
                             className="hidden" 
                             onChange={handleAttachFile} 
                          />
                          
                          <button 
                             type="button"
                             onClick={() => document.getElementById('assignment-file-input')?.click()}
                             disabled={isUploading}
                             className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-lg hover:border-purple-500 transition-colors shadow-sm disabled:opacity-50 cursor-pointer text-xs"
                          >
                             {isUploading ? (
                                <span className="flex items-center gap-1 text-purple-600 animate-pulse">
                                   Uploading Document...
                                </span>
                             ) : (
                                <>
                                   <Upload className="w-4 h-4 text-purple-600" /> Attach PDF / Document
                                </>
                             )}
                          </button>

                          <button 
                             onClick={handleTurnIn}
                             disabled={isSubmitting || isUploading || (!submissionText.trim() && !uploadedFileUrl)}
                             className="px-8 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 shadow-lg shadow-purple-600/20 transition-colors disabled:opacity-50 cursor-pointer"
                          >
                             {isSubmitting ? 'Turning In...' : mySubmission ? 'Resubmit Assignment' : 'Turn In'}
                          </button>
                       </div>
                     </div>
                  </div>
               ) : (
                  <div className="border-t border-gray-100 pt-8 mt-8">
                     <h3 className="text-xl font-bold text-gray-900 mb-6">Student Submissions ({assignmentDetails?.submissions?.length || 0})</h3>
                     
                     {(!assignmentDetails?.submissions || assignmentDetails.submissions.length === 0) ? (
                        <div className="text-center py-12 text-gray-400 font-medium bg-gray-50 rounded-2xl border border-gray-200">
                           No submissions yet for this classroom assignment.
                        </div>
                     ) : (
                        <div className="space-y-4">
                           {assignmentDetails.submissions.map((sub: any) => (
                              <div key={sub.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-6">
                                 <div className="flex items-start justify-between mb-4">
                                    <div>
                                       <h4 className="font-bold text-gray-900 text-base">{sub.student_name || 'Class Student'}</h4>
                                       <p className="text-xs text-slate-500">Submitted at {new Date(sub.submitted_at).toLocaleString()}</p>
                                    </div>
                                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full uppercase tracking-wider ${
                                       sub.status === 'completed' 
                                         ? 'bg-green-100 text-green-700' 
                                         : sub.status === 'needs_improvement' 
                                         ? 'bg-amber-100 text-amber-700' 
                                         : 'bg-blue-100 text-blue-700'
                                    }`}>
                                       {sub.status}
                                    </span>
                                 </div>

                                 <div className="bg-white border border-slate-150 rounded-xl p-4 mb-4 text-sm text-slate-800 whitespace-pre-wrap">
                                    {sub.content || <span className="italic text-slate-400">No text answer.</span>}
                                 </div>

                                 {sub.file_url && (
                                    <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-3 mb-4 mt-2">
                                       <div className="flex items-center gap-2">
                                          <FileText className="w-5 h-5 text-purple-605" />
                                          <span className="text-xs font-semibold text-slate-700">Attached Student Document (PDF)</span>
                                       </div>
                                       <a 
                                          href={sub.file_url} 
                                          target="_blank" 
                                          rel="noreferrer" 
                                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-lg transition-colors inline-block text-center"
                                       >
                                          View Submitted PDF
                                       </a>
                                    </div>
                                 )}

                                 {sub.feedback && (
                                    <div className="bg-amber-50 rounded-xl p-4 border border-amber-100 mb-4 mt-2">
                                       <p className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-1">Teacher Feedback</p>
                                       <p className="text-sm text-amber-900">{sub.feedback}</p>
                                    </div>
                                 )}

                                 {gradingSubmissionId === sub.id ? (
                                    <div className="bg-white border border-purple-100 p-4 rounded-xl mt-4 space-y-3">
                                       <p className="text-xs font-bold text-purple-800 uppercase tracking-widest">Grade and Provide Feedback</p>
                                       <textarea 
                                          placeholder="Provide personalized, constructive comments..." 
                                          value={feedbackText}
                                          onChange={e => setFeedbackText(e.target.value)}
                                          className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-1 focus:ring-purple-600 min-h-[80px]"
                                       />
                                       <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-3">
                                             <label className="text-xs font-bold text-slate-500">Status:</label>
                                             <select 
                                                value={gradingStatus} 
                                                onChange={e => setGradingStatus(e.target.value as any)}
                                                className="bg-slate-50 border border-slate-200 text-xs rounded-lg p-1.5 font-semibold text-slate-700"
                                             >
                                                <option value="completed">Completed / Approved</option>
                                                <option value="needs_improvement">Needs Improvement</option>
                                             </select>
                                          </div>
                                          <div className="flex gap-2">
                                             <button 
                                                onClick={() => setGradingSubmissionId(null)}
                                                className="px-3 py-1.5 text-xs text-slate-500 font-bold hover:bg-slate-50 rounded-lg transition-colors"
                                             >
                                                Cancel
                                             </button>
                                             <button 
                                                onClick={() => handleGradeSubmission(sub.id)}
                                                className="px-4 py-1.5 bg-purple-600 text-white text-xs font-bold rounded-lg hover:bg-purple-700 transition-colors"
                                             >
                                                Submit Grade
                                             </button>
                                          </div>
                                       </div>
                                    </div>
                                 ) : (
                                    <button 
                                       onClick={() => {
                                          setGradingSubmissionId(sub.id);
                                          setFeedbackText(sub.feedback || '');
                                          setGradingStatus(sub.status === 'needs_improvement' ? 'needs_improvement' : 'completed');
                                       }}
                                       className="text-xs bg-white border border-slate-200 hover:border-purple-600 text-purple-600 hover:bg-purple-50/25 px-4 py-2 rounded-lg font-bold transition-all cursor-pointer mt-2"
                                    >
                                       {sub.feedback ? 'Update Grade/Feedback' : 'Grade Assignment'}
                                    </button>
                                 )}
                              </div>
                           ))}
                        </div>
                     )}
                  </div>
               )}
            </div>
         </div>
      );
   }

  return (
    <div className="max-w-[1200px] mx-auto w-full font-sans pb-24 animate-in fade-in">
       {/* Header */}
       <button onClick={onBack} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 font-bold mb-6 transition-colors rounded-xl px-2 py-1 -ml-2 hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" /> Back to Classes
       </button>

       <div className="bg-purple-600 rounded-3xl p-8 h-64 flex flex-col justify-end relative overflow-hidden shadow-sm mb-8">
          <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          <h1 className="text-4xl font-bold text-white relative z-10">{cls.name}</h1>
          <p className="text-purple-100 text-xl font-medium mt-1 relative z-10">{cls.subject}</p>
          
          {isTeacher && (
             <div className="absolute top-6 right-6">
                <div className="bg-white/20 backdrop-blur-md rounded-xl p-4 border border-white/20 text-white font-mono flex items-center gap-4">
                   <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold opacity-80">Class Code</p>
                      <p className="text-xl font-black">{cls.class_code}</p>
                   </div>
                   <button onClick={() => navigator.clipboard.writeText(cls.class_code)} className="p-2 hover:bg-white/20 rounded-lg transition-colors">
                      <Copy className="w-5 h-5" />
                   </button>
                </div>
             </div>
          )}
       </div>

       {/* Navigation */}
       <div className="flex border-b border-gray-200 mb-8 px-4 justify-between items-center pr-2 flex-wrap gap-4">
          <div className="flex">
             <button onClick={() => setActiveTab('stream')} className={`pb-4 px-6 font-bold flex items-center gap-2 ${activeTab === 'stream' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-800'}`}>
                <MessageSquare className="w-4 h-4" /> Stream
             </button>
             <button onClick={() => setActiveTab('classwork')} className={`pb-4 px-6 font-bold flex items-center gap-2 ${activeTab === 'classwork' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-800'}`}>
                <FileText className="w-4 h-4" /> Classwork
             </button>
             <button onClick={() => setActiveTab('people')} className={`pb-4 px-6 font-bold flex items-center gap-2 ${activeTab === 'people' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500 hover:text-gray-800'}`}>
                <Users className="w-4 h-4" /> People
             </button>
          </div>
          
          <button 
             onClick={() => setActiveTab('live')} 
             className={`pb-4 px-6 font-bold flex items-center gap-2 transition-all relative ${
                activeTab === 'live' 
                  ? 'text-red-500 border-b-2 border-red-500' 
                  : 'text-slate-500 hover:text-red-500'
             }`}
          >
             <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <Video className="w-4 h-4" /> 
              <span>Live Class Conference</span>
          </button>
       </div>

       {/* Content View */}
       <div className="flex flex-col md:flex-row gap-8">
          
          {activeTab === 'stream' && (
             <>
               <div className="hidden md:block w-48 shrink-0">
                  <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
                     <h3 className="font-bold text-gray-900 mb-2">Upcoming</h3>
                     <p className="text-sm text-gray-500">No work due soon</p>
                     <button className="text-sm font-bold text-purple-600 hover:underline mt-4">View All</button>
                  </div>
               </div>
               <div className="flex-1 space-y-6">
                  {isTeacher && (
                     <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-start gap-4">
                        <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.fullName}`} className="w-10 h-10 rounded-full bg-purple-50" />
                        <div className="flex-1">
                           <textarea 
                             placeholder="Announce something to your class..." 
                             className="w-full bg-gray-50 border border-gray-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-purple-600 min-h-[100px] resize-none"
                             value={announcementText}
                             onChange={e => setAnnouncementText(e.target.value)}
                           />
                           <div className="flex justify-end mt-3">
                              <button onClick={handlePostAnnouncement} disabled={!announcementText.trim()} className="px-6 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors">Post</button>
                           </div>
                        </div>
                     </div>
                  )}

                  {posts.map(post => (
                     <div key={post.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4">
                           <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${post.teacher_name}`} className="w-10 h-10 rounded-full bg-purple-50" />
                           <div>
                              <p className="font-bold text-gray-900">{post.teacher_name}</p>
                              <p className="text-xs text-gray-500">{new Date(post.created_at).toLocaleDateString()}</p>
                           </div>
                        </div>
                        <p className="text-gray-800 whitespace-pre-wrap">{post.content}</p>
                     </div>
                  ))}
               </div>
             </>
          )}

          {activeTab === 'classwork' && (
             <div className="flex-1">
                {isTeacher && (
                   <div className="flex items-center gap-4 mb-8">
                     <button 
                       onClick={() => setIsAddWorkModalOpen(true)}
                       className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-colors shadow-lg shadow-purple-600/20"
                     >
                        <Plus className="w-5 h-5" /> Create Work
                     </button>
                     <button 
                       onClick={() => setIsAddTopicModalOpen(true)}
                       className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:border-purple-600 hover:text-purple-600 transition-colors"
                     >
                        <Plus className="w-5 h-5" /> Create Topic
                     </button>
                   </div>
                )}

                <div className="space-y-12">
                   {/* Unorganized Assignments */}
                   {cls.unorganizedAssignments && cls.unorganizedAssignments.length > 0 && (
                      <div className="space-y-4 mb-12">
                         {cls.unorganizedAssignments.map(acc => (
                            <div key={acc.id} onClick={() => setActiveAssignmentId(acc.id)} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer group hover:border-purple-200">
                               <div className="flex items-center gap-4">
                                  <div className={`p-3 rounded-full ${acc.assignment_type === 'material' ? 'bg-gray-100 text-gray-600' : 'bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors'}`}>
                                     <FileText className="w-6 h-6" />
                                  </div>
                                  <div>
                                     <h3 className="font-bold text-gray-900 text-lg">{acc.title}</h3>
                                     <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                                        <span className="uppercase text-[10px] font-black tracking-widest text-purple-600">{acc.assignment_type}</span>
                                        {acc.due_date && <>• <span>Due {new Date(acc.due_date).toLocaleDateString()}</span></>}
                                     </p>
                                  </div>
                               </div>
                            </div>
                         ))}
                      </div>
                   )}

                   {cls.topics?.map(topic => (
                      <div key={topic.id}>
                         <div className="border-b border-purple-600 pb-2 mb-4">
                            <h2 className="text-2xl font-bold text-gray-900">{topic.title}</h2>
                         </div>
                         <div className="space-y-4">
                            {topic.assignments?.map(acc => (
                               <div key={acc.id} onClick={() => setActiveAssignmentId(acc.id)} className="bg-white border border-gray-200 rounded-2xl p-4 flex items-center justify-between hover:shadow-md transition-shadow cursor-pointer group hover:border-purple-200">
                                  <div className="flex items-center gap-4">
                                     <div className={`p-3 rounded-full ${acc.assignment_type === 'material' ? 'bg-gray-100 text-gray-600' : 'bg-purple-100 text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors'}`}>
                                        <FileText className="w-6 h-6" />
                                     </div>
                                     <div>
                                        <h3 className="font-bold text-gray-900 text-lg">{acc.title}</h3>
                                        <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                                           <span className="uppercase text-[10px] font-black tracking-widest text-purple-600">{acc.assignment_type}</span>
                                           {acc.due_date && <>• <span>Due {new Date(acc.due_date).toLocaleDateString()}</span></>}
                                        </p>
                                     </div>
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                   ))}
                </div>
             </div>
          )}

          {activeTab === 'people' && (
             <div className="flex-1 max-w-3xl mx-auto w-full">
                <div className="mb-12">
                   <h2 className="text-3xl font-bold text-purple-600 border-b border-purple-600 pb-4 mb-6">Teachers</h2>
                   <div className="flex items-center gap-4 p-2">
                      <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${cls.teacher_name}`} className="w-10 h-10 rounded-full bg-purple-50" />
                      <span className="font-bold text-gray-900 text-lg">{cls.teacher_name}</span>
                   </div>
                </div>

                <div>
                   <h2 className="text-3xl font-bold text-purple-600 border-b border-purple-600 pb-4 mb-6 flex justify-between items-center">
                      <span>Students</span>
                      <span className="text-sm font-bold text-gray-500 bg-gray-100 px-3 py-1 rounded-full">{cls.students?.length || 0} students</span>
                   </h2>
                   <div className="space-y-1">
                      {cls.students?.map(s => (
                         <div key={s.id} className="flex items-center gap-4 p-4 border-b border-gray-100 last:border-0 hover:bg-gray-50 rounded-xl transition-colors">
                            <img src={`https://api.dicebear.com/7.x/initials/svg?seed=${s.full_name}`} className="w-10 h-10 rounded-full bg-blue-50" />
                            <span className="font-bold text-gray-900 text-lg">{s.full_name}</span>
                         </div>
                      ))}
                      {cls.students?.length === 0 && (
                         <div className="text-center py-12 text-gray-400 font-medium border-2 border-dashed border-gray-200 rounded-2xl">
                            No students have joined this class yet.
                         </div>
                      )}
                   </div>
                </div>
             </div>
          )}

          {activeTab === 'live' && (
             <div className="flex-grow w-full">
                <ClassroomConference classId={classId} user={user} onLeave={() => setActiveTab('stream')} className="w-full" />
             </div>
          )}
       </div>

       {/* Modals */}
       {isAddWorkModalOpen && (
          <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
             <div className="bg-white rounded-3xl p-8 max-w-2xl w-full shadow-2xl h-[80vh] flex flex-col">
                <h3 className="text-2xl font-bold text-gray-900 mb-6">Create Assignment</h3>
                <div className="flex-1 overflow-y-auto pr-2 space-y-6 custom-scrollbar">
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Title</label>
                      <input 
                        type="text" 
                        placeholder="Assignment title" 
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none font-medium"
                        value={newWorkTitle}
                        onChange={e => setNewWorkTitle(e.target.value)}
                      />
                   </div>
                   
                   <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Description / Instructions</label>
                      <textarea 
                        placeholder="Add instructions for students..." 
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none min-h-[120px] resize-none"
                        value={newWorkDesc}
                        onChange={e => setNewWorkDesc(e.target.value)}
                      />
                   </div>

                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Type</label>
                         <select 
                           className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
                           value={newWorkType}
                           onChange={e => setNewWorkType(e.target.value)}
                         >
                            <option value="homework">Homework</option>
                            <option value="revision">Revision</option>
                            <option value="test">Test</option>
                            <option value="material">Material (No Submission)</option>
                         </select>
                      </div>
                      <div>
                         <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Topic</label>
                         <select 
                           className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none"
                           value={newWorkTopic}
                           onChange={e => setNewWorkTopic(e.target.value)}
                         >
                            <option value="">No Topic</option>
                            {cls.topics?.map(t => (
                               <option key={t.id} value={t.id}>{t.title}</option>
                            ))}
                         </select>
                      </div>
                   </div>

                   <div className="pt-4 border-t border-gray-100">
                      <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 font-bold rounded-lg hover:bg-gray-200 transition-colors">
                         <Upload className="w-4 h-4" /> Attach Resource
                      </button>
                      <p className="text-xs text-gray-500 mt-2">You can link PDFs, Videos, or Past Papers from the library.</p>
                   </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-100">
                   <button onClick={() => setIsAddWorkModalOpen(false)} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">Cancel</button>
                   <button onClick={handleCreateWork} disabled={!newWorkTitle} className="px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-lg shadow-purple-600/20">Assign</button>
                </div>
             </div>
          </div>
       )}
        {isAddTopicModalOpen && (
           <div className="fixed inset-0 bg-gray-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-3xl p-8 max-w-lg w-full shadow-2xl flex flex-col">
                 <h3 className="text-2xl font-bold text-gray-900 mb-6">Create Topic</h3>
                 <div className="mb-6">
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">Topic Name</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Chapter 1: Foundations" 
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:outline-none font-medium"
                      value={newTopicTitle}
                      onChange={e => setNewTopicTitle(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleCreateTopic(); }}
                    />
                 </div>
                 
                 <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                    <button onClick={() => setIsAddTopicModalOpen(false)} className="px-6 py-3 text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors">Cancel</button>
                    <button onClick={handleCreateTopic} disabled={!newTopicTitle.trim()} className="px-6 py-3 bg-purple-600 text-white font-bold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition-colors shadow-lg shadow-purple-600/20">Add Topic</button>
                 </div>
              </div>
           </div>
        )}
    </div>
  );
}
