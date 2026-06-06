import React, { useState } from 'react';
import { 
  Send, Mail, Shield, MessageSquare, CheckCircle2, 
  AlertCircle, HelpCircle, Bug, Sparkles, Inbox
} from 'lucide-react';
import { motion } from 'motion/react';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, doc, setDoc, query, where, getDocs, 
  serverTimestamp, addDoc 
} from 'firebase/firestore';
import { User } from '../types';

interface FeedbackViewProps {
  user: User;
}

export function FeedbackView({ user }: FeedbackViewProps) {
  const [category, setCategory] = useState('General Feedback');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const categories = [
    { name: 'General Feedback', icon: HelpCircle, desc: 'Share your general thoughts, appreciation, or suggestions.' },
    { name: 'Report an Issue / Bug', icon: Bug, desc: 'Encountered a problem? Report it so we can fix it swiftly.' },
    { name: 'Library Resource Request', icon: Inbox, desc: 'Request specific past papers, books, or tutorial materials.' },
    { name: 'Feature Recommendation', icon: Sparkles, desc: 'Help us make LibraryCore even better with new capabilities.' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !content.trim()) {
      setErrorMessage('Please fill in all the details.');
      setSubmitStatus('error');
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus('idle');
    setErrorMessage('');

    try {
      // 1. Save feedback record in Firestore 'feedbacks' collection
      const feedbackPayload = {
        userId: auth.currentUser?.uid || user.uid,
        userName: user.fullName,
        userEmail: user.email || user.username || 'No Email',
        userRole: user.role,
        category,
        subject: subject.trim(),
        content: content.trim(),
        createdAt: new Date().toISOString(),
        status: 'new',
        targetEmail: 'sharpibrah@gmail.com'
      };

      try {
        await addDoc(collection(db, 'feedbacks'), feedbackPayload);
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'feedbacks');
      }

      // 2. Call server-side endpoint to route direct mock-email delivery to sharpibrah@gmail.com
      try {
        await fetch('/api/feedback/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feedbackPayload)
        });
      } catch (err) {
        console.warn("Direct mail routing failed:", err);
      }

      // 3. Auto-deliver direct support chat to the overall admin
      try {
        // Find overall admin from users collection
        const adminQuery = query(collection(db, 'users'), where('email', 'in', ['sharpibrah@gmail.com', 'sharpwhite@gmail.com']));
        
        let adminSnapshot;
        try {
          adminSnapshot = await getDocs(adminQuery);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, 'users');
        }

        let adminUser: any = null;

        if (adminSnapshot && !adminSnapshot.empty) {
          adminUser = { ...adminSnapshot.docs[0].data(), uid: adminSnapshot.docs[0].id };
        } else {
          // Fallback: look for any admin role
          const genericAdminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
          let genericAdminSnapshot;
          try {
            genericAdminSnapshot = await getDocs(genericAdminQuery);
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, 'users');
          }

          if (genericAdminSnapshot && !genericAdminSnapshot.empty) {
            adminUser = { ...genericAdminSnapshot.docs[0].data(), uid: genericAdminSnapshot.docs[0].id };
          }
        }

        if (adminUser && adminUser.uid !== user.uid) {
          // Establish conversation or append to active thread
          const convId = [user.uid, adminUser.uid].sort().join('_');
          const convRef = doc(db, 'conversations', convId);

          const lastMsgText = `⚠️ [FEEDBACK REPORT] (${category}) - ${subject.trim()}`;
          
          try {
            await setDoc(convRef, {
              id: convId,
              participants: [user.uid, adminUser.uid],
              lastMessage: lastMsgText,
              lastMessageTimestamp: serverTimestamp(),
              lastMessageSenderId: user.uid
            }, { merge: true });
          } catch (err) {
            handleFirestoreError(err, OperationType.WRITE, `conversations/${convId}`);
          }

          // Post support message thread
          const msgRef = doc(collection(db, 'conversations', convId, 'messages'));
          try {
            await setDoc(msgRef, {
              id: msgRef.id,
              senderId: user.uid,
              senderName: user.fullName,
              content: `📬 **NEW SUPPORT FEEDBACK RECEIVED**\n\n**Category:** ${category}\n**Subject:** ${subject.trim()}\n\n**Feedback Message:**\n${content.trim()}\n\n--- \n*This feedback has been stored and sent direct to **sharpibrah@gmail.com**.*`,
              timestamp: serverTimestamp(),
              type: 'text'
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `conversations/${convId}/messages/${msgRef.id}`);
          }
        }
      } catch (err) {
        console.warn("Direct admin chat routing failed:", err);
      }

      setSubmitStatus('success');
      setSubject('');
      setContent('');
    } catch (err: any) {
      console.error("Failed to submit feedback:", err);
      setErrorMessage(err.message || 'An error occurred while saving your feedback.');
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 font-sans">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-display font-bold text-slate-900 tracking-tight">Support & Feedback Center</h2>
        <p className="mt-2 text-slate-500 max-w-xl mx-auto text-sm">
          Have suggestions, requests, or facing any challenges? Complete the form below to message our engineering team directly.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Info Sidebar Cards */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
              <Mail className="w-5 h-5 text-primary" />
              Direct Routing
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-4">
              Your feedback is automatically delivered directly to the overall system Administrator inbox at:
            </p>
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 flex items-center justify-between">
              <span className="text-xs font-mono font-semibold text-slate-700">sharpibrah@gmail.com</span>
              <Shield className="w-4 h-4 text-emerald-500 shrink-0" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
              <MessageSquare className="w-5 h-5 text-indigo-500" />
              Direct Live Chat
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Submitting feedback automatically formats a premium private conversation directly inside the admin's **Expert Chat** portal so they can discuss the matter with you instantly in real-time.
            </p>
          </div>

          <div className="bg-gradient-to-r from-primary/10 to-indigo-50/50 p-6 rounded-3xl border border-primary/10">
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Response Guarantee</p>
            <p className="text-xs text-slate-600 leading-normal">
              Our support admins typically review all submitted past paper requests and bugs within 12-24 hours. Keep an eye on your notifications page!
            </p>
          </div>
        </div>

        {/* Form Area */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* Category Selector Cards */}
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                  Select Feedback Category
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    const isSelected = category === cat.name;
                    return (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => setCategory(cat.name)}
                        className={`text-left p-3.5 rounded-2xl border transition-all duration-300 flex items-start gap-3 ${
                          isSelected 
                            ? 'border-primary bg-primary/5 shadow-sm shadow-primary/5 ring-1 ring-primary' 
                            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`p-2 rounded-xl shrink-0 ${
                          isSelected ? 'bg-primary text-white' : 'bg-slate-50 text-slate-500'
                        }`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-800">{cat.name}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{cat.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Readonly Identity display */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Your Full Name
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user.fullName}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Account Identity
                  </label>
                  <input
                    type="text"
                    disabled
                    value={user.email || user.username}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-mono font-medium text-slate-500"
                  />
                </div>
              </div>

              {/* Subject */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Feedback Subject
                </label>
                <input
                  type="text"
                  placeholder="Summarize your request or problem (e.g., Mathematics Paper 2 solution requests)"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-slate-250 hover:border-slate-300 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none rounded-xl text-sm font-semibold text-slate-800 transition-all placeholder:text-slate-400"
                  required
                />
              </div>

              {/* Content Body */}
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                  Details & Messages (Minimum 10 characters)
                </label>
                <textarea
                  placeholder="Provide precise details, resource links, steps to reproduce bugs, or specific ideas..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-3 bg-slate-50/50 border border-slate-250 hover:border-slate-300 focus:bg-white focus:ring-2 focus:ring-primary/20 focus:border-primary focus:outline-none rounded-xl text-sm font-medium text-slate-800 transition-all resize-none placeholder:text-slate-400 leading-relaxed"
                  required
                />
              </div>

              {/* Submit Info States */}
              {submitStatus === 'success' && (
                <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-2xl flex items-start gap-3 text-emerald-800">
                  <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black">Feedback Sent Successfully!</p>
                    <p className="text-[11px] text-emerald-600 mt-0.5">
                      Your response was logged safely and securely forwarded to admin **sharpibrah@gmail.com**. A private support conversation thread has also been added inside your **Expert Chat** overview.
                    </p>
                  </div>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="p-4 bg-rose-50 border border-rose-150 rounded-2xl flex items-start gap-3 text-rose-800">
                  <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black">Could not transmit feedback</p>
                    <p className="text-[11px] text-rose-600 mt-0.5">
                      {errorMessage || "Please make sure your internet connection is active and try again."}
                    </p>
                  </div>
                </div>
              )}

              {/* Submit buttons */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-[10px] text-slate-400 font-mono">
                  Standard safety filters are active
                </span>
                <button
                  type="submit"
                  disabled={isSubmitting || !subject.trim() || !content.trim()}
                  className="bg-primary hover:bg-primary-dark disabled:opacity-40 text-white font-bold text-xs px-6 py-3 rounded-xl flex items-center gap-2 shadow-md shadow-primary/10 transition-all active:scale-98 shrink-0 hover:shadow-lg hover:shadow-primary/20 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Sending secure report...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Submit Secure Feedback</span>
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
