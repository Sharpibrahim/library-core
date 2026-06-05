import React, { useState, useEffect, useRef } from 'react';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, PhoneOff, 
  Users, Settings, ShieldAlert, Sparkles, MessageSquare, 
  Volume2, Signal, MoreHorizontal, Maximize2, Camera, LogIn,
  Check, Bell, Sparkle, RefreshCw, X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User } from '../types';
import { db } from '../firebase';
import { 
  collection, query, orderBy, onSnapshot, addDoc, 
  serverTimestamp, doc, setDoc, deleteDoc 
} from 'firebase/firestore';

interface ClassroomConferenceProps {
  classId: string;
  className?: string;
  user: User;
  onLeave: () => void;
}

interface Participant {
  id: string;
  name: string;
  role: 'teacher' | 'student';
  avatar: string;
  isMuted: boolean;
  isCamOff: boolean;
  isSpeaking: boolean;
  joinedAt?: string;
}

interface ClassroomToast {
  id: string;
  message: string;
  avatar?: string;
}

// Algorithmic Audio Feedback Engine: Generates Google Meet chimes inside sandboxed browser
function playMeetSound(type: 'join' | 'leave' | 'chat') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    const now = ctx.currentTime;
    if (type === 'join') {
      // Signature Google Meet upward connection tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); 
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); 
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'leave') {
      // Downward disconnection chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); 
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.18); 
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === 'chat') {
      // Soft high-frequency notification notification tone
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); 
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.start(now);
      osc.stop(now + 0.12);
    }
  } catch (err) {
    console.warn("Could not generate algorithmic sound trigger:", err);
  }
}

export function ClassroomConference({ classId, className, user, onLeave }: ClassroomConferenceProps) {
  // Navigation & Joined status
  const [isJoined, setIsJoined] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  // Audio / Video states
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isCamOff, setIsCamOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  // Real presence & simulated peers
  const [realPeers, setRealPeers] = useState<Participant[]>([]);
  const [simulatedPeers, setSimulatedPeers] = useState<Participant[]>([]);
  const [enableSandboxMockPeers, setEnableSandboxMockPeers] = useState(false);
  const [toasts, setToasts] = useState<ClassroomToast[]>([]);
  
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const [connectionTime, setConnectionTime] = useState(0);
  const [activeSidebar, setActiveSidebar] = useState<'users' | 'chat' | null>(null);
  const [chatMessages, setChatMessages] = useState<{ sender: string, text: string, time: string }[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Floating reactions & media configurations
  const [layoutMode, setLayoutMode] = useState<'grid' | 'theater'>('grid');
  const [videoFilter, setVideoFilter] = useState<'none' | 'blur' | 'grayscale' | 'sepia' | 'cool' | 'warm'>('none');
  const [emojiReactions, setEmojiReactions] = useState<{ id: number; symbol: string; left: number }[]>([]);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const lobbyVideoRef = useRef<HTMLVideoElement>(null);
  const presentationVideoRef = useRef<HTMLVideoElement>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [volumeLevel, setVolumeLevel] = useState<number>(0);

  const presentationSlides = [
    {
      title: "Introduction to LibraryCore Academic Ecosystem",
      subtitle: "Chapter 1: Dynamic Learning & Collaboration Infrastructure",
      bullets: [
        "Hybrid Client-Server syncing with intelligent SQLite backend database",
        "Fully offline-first document indexing and local storage backup caches",
        "Dual synchronization to Firestore collections for immediate real-time collaboration"
      ],
      diagram: "🏢 [LibraryCore Client] ──(API Proxy)──> [SQLite DB Server] ──(Sync Link)──> [Cloud Firestore]"
    },
    {
      title: "Real-time Communication & WebRTC Topologies",
      subtitle: "Chapter 2: Interactive Multimedia Signaling",
      bullets: [
        "Under sandboxed iframe browsers, mic + camera require explicit frame authorizations",
        "Active WebRTC captures your direct hardware inputs (microphone frequency wave analyzer)",
        "Virtual fallback options ensure fully operational interfaces on restricted devices"
      ],
      diagram: "📡 [User Stream] ──(Secure Audio/Video Tunnel)──> [P2P Media Channel] <── [Classroom Peers]"
    },
    {
      title: "Advancing Academic Study using Deep Learning Agents",
      subtitle: "Chapter 3: Cognitive Enhancements & Expert Systems",
      bullets: [
        "Gemini API integrations handle parsing complex high-volume PDF texts on backend custom routes",
        "Server-side prompt layouts coordinate precise contextual outputs without exposing private keys",
        "Interactive audio-to-text parsers parse action keywords using responsive web speech modules"
      ],
      diagram: "🧠 [PDF Content File] ──(Context Window)──> [Gemini AI Engine] ──> [Intuitive Interactive Aids]"
    }
  ];

  // Helper to trigger a visual in-component notification toast
  const addToast = (message: string, avatar?: string) => {
    const id = Math.random().toString();
    setToasts(prev => [...prev, { id, message, avatar }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Setup Real-time live classroom messaging stream
  useEffect(() => {
    if (!classId) return;
    const chatCollectionRef = collection(db, 'classrooms', `${classId}_chat`, 'messages');
    const q = query(chatCollectionRef, orderBy('createdAt', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: any[] = [];
      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data();
        let formattedTime = data.time;
        if (data.createdAt && data.createdAt.toDate) {
          formattedTime = data.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }
        
        // Listen to cross-peer reaction broadcasts to show local floating emojis!
        if (data.sender === 'System_Reaction' && data.text && data.text.includes('sent a reaction')) {
          const emojiMatch = data.text.match(/sent a reaction ([\s\S])/);
          if (emojiMatch && emojiMatch[1]) {
            // Local reaction trigger
            const randId = Date.now() + Math.random();
            const randLeft = Math.floor(Math.random() * 80) + 10;
            setEmojiReactions(prev => {
              if (prev.length < 15) { // clamp max concurrent reactions to avoid lag
                return [...prev, { id: randId, symbol: emojiMatch[1], left: randLeft }];
              }
              return prev;
            });
            setTimeout(() => {
              setEmojiReactions(prev => prev.filter(e => e.id !== randId));
            }, 4000);
          }
          return; // skip typing systemic messages in general chat stream
        }

        msgs.push({
          sender: data.sender,
          text: data.text,
          time: formattedTime || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });
      });

      // Play audio chime when message arrives from any classmate/professor
      if (msgs.length > 0) {
        const lastMsg = msgs[msgs.length - 1];
        const selfSender = user.fullName || user.username || 'Me';
        if (lastMsg.sender !== selfSender) {
          playMeetSound('chat');
        }
      }

      setChatMessages(msgs);
    }, (error) => {
      console.error('[FIRESTORE] Real-time classroom live messages error:', error);
    });
    return () => unsubscribe();
  }, [classId]);

  // Sync real participants from Firestore Database Presence to make it a REAL Google Meet
  useEffect(() => {
    if (!classId) return;
    const presenceColRef = collection(db, 'classrooms', `${classId}_presence`, 'participants');
    const q = query(presenceColRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activePeers: Participant[] = [];
      const now = new Date();
      snapshot.docs.forEach(docSnap => {
        if (docSnap.id !== user.uid) {
          const data = docSnap.data();
          let isStale = false;
          if (data.joinedAt) {
            const joinedTime = new Date(data.joinedAt);
            const diffInMinutes = (now.getTime() - joinedTime.getTime()) / (1000 * 60);
            if (diffInMinutes > 60) {
              isStale = true;
              deleteDoc(docSnap.ref).catch(() => {});
            }
          }
          if (!isStale) {
            activePeers.push(data as Participant);
          }
        }
      });
      setRealPeers(activePeers);
    }, (err) => {
      console.error('[FIRESTORE PRESENCE] Failed to sync session users:', err);
    });

    return () => unsubscribe();
  }, [classId, user.uid]);

  // Connection timer increment
  useEffect(() => {
    if (!isJoined) return;
    const timer = setInterval(() => {
      setConnectionTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isJoined]);

  // Handle active speaker evaluation periodically
  useEffect(() => {
    if (!isJoined) return;
    const interval = setInterval(() => {
      if (volumeLevel > 20 && !isMuted) {
        setActiveSpeaker('you');
      } else {
        // Randomly assign speaker between the joined simulated peers to look fully dynamic
        const currentlyJoinedSimulated = simulatedPeers.filter(p => !p.isMuted);
        if (currentlyJoinedSimulated.length > 0 && Math.random() > 0.4) {
          const randomIndex = Math.floor(Math.random() * currentlyJoinedSimulated.length);
          setActiveSpeaker(currentlyJoinedSimulated[randomIndex].id);
          
          setSimulatedPeers(prev => prev.map(p => {
            const speaking = p.id === currentlyJoinedSimulated[randomIndex].id && Math.random() > 0.2;
            return { ...p, isSpeaking: speaking };
          }));
        } else {
          setActiveSpeaker('teacher_host');
          setSimulatedPeers(prev => prev.map(p => ({ ...p, isSpeaking: false })));
        }
      }
    }, 4500);

    return () => clearInterval(interval);
  }, [isJoined, volumeLevel, isMuted, simulatedPeers]);

  // WebRTC native stream capture with intelligent cascade fallbacks
  useEffect(() => {
    let capturedStream: MediaStream | null = null;
    
    async function startMedia() {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn("[WebRTC] navigator.mediaDevices.getUserMedia is unsupported or blocked by frame sandbox limitations.");
        setPermissionError("Multimedia media streams restricted inside sandboxed environment. Virtualized stream mode active.");
        return;
      }

      try {
        console.log("[WebRTC] Prompting for dual hardware access (camera + mic)...");
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: "user" },
          audio: true
        });
        capturedStream = stream;
        setLocalStream(stream);
        
        if (lobbyVideoRef.current) {
          lobbyVideoRef.current.srcObject = stream;
        }
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setupAudioAnalyser(stream);
      } catch (err) {
        console.warn("[WebRTC] Dual stream request denied. Triggering camera-only retry:", err);
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: false
          });
          capturedStream = stream;
          setLocalStream(stream);
          if (lobbyVideoRef.current) {
            lobbyVideoRef.current.srcObject = stream;
          }
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = stream;
          }
          setPermissionError("Connected webcam successfully. Audio input access is denied or unavailable.");
        } catch (videoErr) {
          console.warn("[WebRTC] Video capture failed, triggering microphone-only retry:", videoErr);
          try {
            const stream = await navigator.mediaDevices.getUserMedia({
              video: false,
              audio: true
            });
            capturedStream = stream;
            setLocalStream(stream);
            setupAudioAnalyser(stream);
            setIsCamOff(true);
            setPermissionError("Connected audio successfully. Camera preview is restricted or unavailable.");
          } catch (audioErr) {
            console.warn("[WebRTC] Complete media capture blocked or failed.", audioErr);
            setPermissionError("Hardware access restrictions detected. Using virtual simulation canvas.");
          }
        }
      }
    }

    function setupAudioAnalyser(stream: MediaStream) {
      if (!stream || stream.getAudioTracks().length === 0) return;
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioContext = new AudioContextClass();
          const analyser = audioContext.createAnalyser();
          analyser.fftSize = 64;
          const source = audioContext.createMediaStreamSource(stream);
          source.connect(analyser);
          
          audioContextRef.current = audioContext;
          analyserRef.current = analyser;

          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const checkVolume = () => {
            if (analyserRef.current) {
              analyserRef.current.getByteFrequencyData(dataArray);
              let sum = 0;
              for (let i = 0; i < dataArray.length; i++) {
                sum += dataArray[i];
              }
              const avg = sum / dataArray.length;
              setVolumeLevel(avg); 
            }
            animationFrameRef.current = requestAnimationFrame(checkVolume);
          };
          checkVolume();
        }
      } catch (audioErr) {
        console.warn("Audio Context setup skipped: ", audioErr);
      }
    }

    startMedia();

    return () => {
      if (capturedStream) {
        capturedStream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Sync screen sharing stream onto video ref whenever it activates
  useEffect(() => {
    if (screenShareStream && presentationVideoRef.current) {
      presentationVideoRef.current.srcObject = screenShareStream;
    }
  }, [screenShareStream]);

  // Ensure local video ref picks up localStream if we transition from lobby into joined screen toggled
  useEffect(() => {
    if (isJoined && localStream && localVideoRef.current && !isCamOff) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [isJoined, localStream, isCamOff]);

  // Clean presence on tab exit
  useEffect(() => {
    const handleUnload = () => {
      if (isJoined) {
        const presenceDocRef = doc(db, 'classrooms', `${classId}_presence`, 'participants', user.uid);
        deleteDoc(presenceDocRef).catch(() => {});
      }
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      handleUnload();
    };
  }, [isJoined, classId, user.uid]);

  // Handle Cam Toggle
  const toggleCam = async () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = isCamOff;
      });
    }
    const nextCamOff = !isCamOff;
    setIsCamOff(nextCamOff);
    
    // Update presence document in Firestore
    if (isJoined) {
      try {
        const presenceDocRef = doc(db, 'classrooms', `${classId}_presence`, 'participants', user.uid);
        await setDoc(presenceDocRef, { isCamOff: nextCamOff }, { merge: true });
      } catch (err) {
        console.warn("Could not sync camera status to database: ", err);
      }
    }
  };

  // Handle Mic Toggle
  const toggleMic = async () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
    }
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    
    // Update presence document in Firestore
    if (isJoined) {
      try {
        const presenceDocRef = doc(db, 'classrooms', `${classId}_presence`, 'participants', user.uid);
        await setDoc(presenceDocRef, { isMuted: nextMuted }, { merge: true });
      } catch (err) {
        console.warn("Could not sync mute status to database: ", err);
      }
    }
  };

  // Join Lesson Trigger (Activates Firestore presence + simulated timelines)
  const handleJoinLesson = async () => {
    setIsJoining(true);
    
    try {
      // 1. Create presence registry on Firestore so other active users on the site actually witness you in Google Meet!
      const presenceDocRef = doc(db, 'classrooms', `${classId}_presence`, 'participants', user.uid);
      await setDoc(presenceDocRef, {
        id: user.uid,
        name: user.fullName || user.username || 'Student',
        role: user.role || 'student',
        avatar: user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user.fullName || user.username || 'Student'}`,
        isMuted: isMuted,
        isCamOff: isCamOff,
        isSpeaking: false,
        joinedAt: new Date().toISOString()
      });

      console.log('[PRESENCE] Registered user inside active classroom presence list!');
      setIsJoined(true);
      addToast("You have successfully connected to the lesson stream.", user.avatarUrl);
      playMeetSound('join');

      // 2. Trigger realistic timeline joining events from mock peers to make it look absolutely genuine
      // Simulating teacher and classmates joining right AFTER you, instead of already being static in the call
      if (enableSandboxMockPeers) {
        // t = 1.8s: Teacher joins the call
        setTimeout(() => {
          const teacher: Participant = {
            id: 'teacher_host',
            name: 'Dr. Evelyn Carter',
            role: 'teacher',
            avatar: 'https://api.dicebear.com/7.x/initials/svg?seed=Evelyn%20Carter',
            isMuted: false,
            isCamOff: false,
            isSpeaking: true
          };
          setSimulatedPeers(prev => [...prev, teacher]);
          addToast("Dr. Evelyn Carter (Instructor) joined the call.", teacher.avatar);
          playMeetSound('join');
        }, 1800);

        // t = 4.2s: Alex Johnson joins
        setTimeout(() => {
          const peer1: Participant = {
            id: 'peer_1',
            name: 'Alex Johnson',
            role: 'student',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
            isMuted: true,
            isCamOff: false,
            isSpeaking: false
          };
          setSimulatedPeers(prev => [...prev, peer1]);
          addToast("Alex Johnson joined the video lesson.", peer1.avatar);
          playMeetSound('join');
        }, 4200);

        // t = 7.5s: Sophia Smith joins
        setTimeout(() => {
          const peer2: Participant = {
            id: 'peer_2',
            name: 'Sophia Smith',
            role: 'student',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia',
            isMuted: false,
            isCamOff: true,
            isSpeaking: false
          };
          setSimulatedPeers(prev => [...prev, peer2]);
          addToast("Sophia Smith (Student) joined the video lesson.", peer2.avatar);
          playMeetSound('join');
        }, 7500);

        // t = 13s: Dr. Carter types welcome message
        setTimeout(() => {
          setChatMessages(prev => [
            ...prev, 
            {
              sender: "Dr. Evelyn Carter",
              text: "Welcome back to today's core module lecture, everyone! Today we are discussing offline client database indexing and live synchronization topologies. Feel free to use the React panel up top or drop questions inside the Chat sidebar.",
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          addToast("Dr. Evelyn Carter commented in the chat.", 'https://api.dicebear.com/7.x/initials/svg?seed=Evelyn%20Carter');
          playMeetSound('chat');
        }, 13000);

        // t = 22s: Sophia unmutes and says hello
        setTimeout(() => {
          setSimulatedPeers(prev => prev.map(p => p.id === 'peer_2' ? { ...p, isMuted: false, isSpeaking: true } : p));
          setChatMessages(prev => [
            ...prev, 
            {
              sender: "Sophia Smith",
              text: "Excited for this chapter! The offline database sync patterns helped me immensely with my homework architecture outline.",
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }
          ]);
          addToast("Sophia Smith unmuted to comment.", 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sophia');
          playMeetSound('chat');
        }, 22050);

        // t = 32s: Alex react trigger on screen
        setTimeout(() => {
          const randId = Date.now() + Math.random();
          setEmojiReactions(prev => [...prev, { id: randId, symbol: '💡', left: 45 }]);
          setTimeout(() => {
            setEmojiReactions(prev => prev.filter(e => e.id !== randId));
          }, 4000);
        }, 32000);
      }

    } catch (e) {
      console.error('[PRESENCE ERROR] Failed to set up real presence on Firestore: ', e);
      // Fallback join if offline/Firestore restricted
      setIsJoined(true);
    } finally {
      setIsJoining(false);
    }
  };

  // Leave Lesson Trigger
  const handleLeaveLesson = async () => {
    try {
      playMeetSound('leave');
      const presenceDocRef = doc(db, 'classrooms', `${classId}_presence`, 'participants', user.uid);
      await deleteDoc(presenceDocRef);
    } catch (e) {
      console.warn("Presence teardown skipped: ", e);
    }
    setIsJoined(false);
    onLeave();
  };

  // Screen Share API
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(t => t.stop());
        screenStreamRef.current = null;
      }
      setIsScreenSharing(false);
      setScreenShareStream(null);
    } else {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia) {
          const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          screenStreamRef.current = stream;
          setIsScreenSharing(true);
          setScreenShareStream(stream);
          setLayoutMode('theater');
          
          stream.getVideoTracks()[0].onended = () => {
            setIsScreenSharing(false);
            setScreenShareStream(null);
          };
        } else {
          console.warn("[Screen Share] Display sharing interface restricted in this iframe. Starting high-fidelity interactive virtual presentation.");
          setIsScreenSharing(true);
          setLayoutMode('theater');
        }
      } catch (err) {
        console.warn("[Screen Share] Display share failed, starting interactive virtual slide deck.", err);
        setIsScreenSharing(true);
        setLayoutMode('theater');
      }
    }
  };

  const triggerEmoji = (emoji: string) => {
    const id = Date.now() + Math.random();
    const left = Math.floor(Math.random() * 80) + 10;
    setEmojiReactions(prev => [...prev, { id, symbol: emoji, left }]);
    
    // Broadcast emoji in real-time Firestore database so other viewers witness it dynamically!
    try {
      const chatCollectionRef = collection(db, 'classrooms', `${classId}_chat`, 'messages');
      addDoc(chatCollectionRef, {
        sender: 'System_Reaction',
        text: `sent a reaction ${emoji}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.warn("Skipped storing reaction in Firestore: ", err);
    }
    setTimeout(() => {
      setEmojiReactions(prev => prev.filter(e => e.id !== id));
    }, 4000);
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    const textToSend = chatInput.trim();
    setChatInput('');
    try {
      const chatCollectionRef = collection(db, 'classrooms', `${classId}_chat`, 'messages');
      await addDoc(chatCollectionRef, {
        sender: user.fullName || user.username || 'Me',
        text: textToSend,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error('[FIRESTORE] Failed to post live comment:', err);
      // Local fallback
      setChatMessages(prev => [...prev, {
        sender: user.fullName || user.username || 'Me',
        text: textToSend,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const filterClassMap = {
    none: '',
    blur: 'blur-xs scale-102 saturate-105',
    grayscale: 'grayscale contrast-125 brightness-95',
    sepia: 'sepia saturate-110 brightness-95',
    cool: 'hue-rotate-180 saturate-150 contrast-105 brightness-90 border-t-purple-500',
    warm: 'sepia-[0.35] saturate-135 contrast-115 brightness-95'
  };

  // Combine real joined classmates (Firestore presence) + simulated timeline classmates
  const totalClassmates = [...realPeers, ...simulatedPeers];

  // ==========================================
  // RENDER LOBBY PREVIEW IF NOT JOINED YET
  // ==========================================
  if (!isJoined) {
    return (
      <div className={`flex flex-col md:flex-row bg-slate-950 text-white rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl min-h-[62vh] relative ${className || ''}`}>
        
        {/* LOBBY LEFT PANEL: CAM & SOUND PREVIEW */}
        <div className="flex-1 p-8 sm:p-12 flex flex-col justify-between border-b md:border-b-0 md:border-r border-slate-900 bg-gradient-to-tr from-slate-950 to-slate-900/40">
          <div>
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center text-purple-400">
                <Video className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-display font-semibold text-slate-100 tracking-tight">Meet Device Checkroom</h3>
                <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest mt-0.5">Configure feeds before entering</p>
              </div>
            </div>

            {/* Simulated Lobby Webcam Mirror */}
            <div className="relative rounded-2xl bg-slate-950 border border-slate-800 p-1 overflow-hidden aspect-video max-w-lg mx-auto flex items-center justify-center group shadow-2xl">
              {isCamOff ? (
                <div className="text-center p-6">
                  <div className="w-18 h-18 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-lg font-bold border border-slate-700">
                    <span>{user.fullName?.substring(0, 2) || user.username?.substring(0, 2)}</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-3 font-semibold">Your camera is turned off</p>
                </div>
              ) : (
                <video 
                  ref={lobbyVideoRef} 
                  autoPlay 
                  playsInline 
                  muted={true}
                  className={`w-full h-full object-cover rounded-xl transform scale-x-[-1] transition-all duration-300 ${filterClassMap[videoFilter]}`}
                />
              )}

              {/* Lobby preview overlay status bar */}
              <div className="absolute top-4 left-4 bg-slate-900/90 backdrop-blur-sm border border-slate-800 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Device Stream Active</span>
              </div>

              {/* Video control pills overlaid directly onto lobby preview box (Google Meet style) */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center gap-2 bg-slate-950/70 border border-slate-800 p-2 rounded-2xl backdrop-blur-md opacity-90 hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={toggleMic}
                  className={`p-2.5 rounded-xl transition-all ${isMuted ? 'bg-red-500 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
                  title={isMuted ? 'Unmute' : 'Mute'}
                >
                  {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <button
                  onClick={toggleCam}
                  className={`p-2.5 rounded-xl transition-all ${isCamOff ? 'bg-red-500 text-white' : 'hover:bg-slate-800 text-slate-300'}`}
                  title={isCamOff ? 'Start Video' : 'Stop Video'}
                >
                  {isCamOff ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Video Filter selector under local monitor box */}
          <div className="max-w-lg mx-auto w-full mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-slate-900 pt-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-400" />
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest text-[9px]">Lobby Video Filter:</span>
              </div>
              <select
                value={videoFilter}
                onChange={(e) => setVideoFilter(e.target.value as any)}
                className="bg-slate-950 border border-slate-800 text-slate-300 text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-purple-600 transition-colors w-full sm:w-auto"
              >
                <option value="none">Standard Mirror Feed</option>
                <option value="blur">Soft Ambient Blur</option>
                <option value="grayscale">Retro Noir Grayscale</option>
                <option value="sepia">Cozy Warm Sepia</option>
                <option value="cool">Cyberpunk Neon Blue</option>
                <option value="warm">Golden Sunset Warmth</option>
              </select>
            </div>

            {/* Lobby sound visual frequency micro-bar */}
            <div className="flex items-center gap-2 select-none border-t border-slate-900 pt-4">
              <Volume2 className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Device mic sensing:</span>
              <div className="flex items-center gap-0.5 ml-2 flex-grow">
                {[1, 2, 3, 4, 5, 6, 7].map(b => (
                  <span 
                    key={b} 
                    className={`h-2.5 flex-1 rounded transition-all duration-75 ${volumeLevel > (b * 12) && !isMuted ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-800'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* LOBBY RIGHT PANEL: CTA JOIN & REAL PEOPLE DETAILS */}
        <div className="w-full md:w-96 p-8 sm:p-12 flex flex-col justify-between bg-slate-950 relative overflow-hidden">
          {/* Subtle design accents in lobby background */}
          <div className="absolute top-0 right-0 w-44 h-44 bg-purple-500/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          
          <div className="space-y-6">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-purple-400 bg-purple-500/10 border border-purple-500/20 px-3 py-1 rounded-full">Interactive Room</span>
              <h2 className="text-2xl font-display font-black text-slate-100 tracking-tight mt-3">Ready to Join?</h2>
              <p className="text-xs text-slate-400 leading-relaxed mt-1">Configure your sound levels and join the dynamic virtual classroom workspace below.</p>
            </div>

            {/* Room Info Grid */}
            <div className="space-y-3 bg-slate-900/60 border border-slate-850 p-5 rounded-2xl">
              <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 font-sans">Active Class Conference Details</p>
              
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                  <span className="text-slate-400 font-medium">Class ID:</span>
                  <span className="font-mono text-purple-400 font-semibold">{classId}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Stream Quality:</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <Signal className="w-3 h-3" /> Secure 720p HD
                  </span>
                </div>
              </div>
            </div>

            {/* REAL-TIME PREVIEW: ENUMERATING ACTIVE PEOPLE ALREADY IN CALL */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase font-black tracking-widest text-slate-400">Connected Peers right now</span>
                <span className="text-[9px] px-2 py-0.5 bg-slate-900 border border-slate-800 text-slate-300 rounded font-mono font-bold">{realPeers.length + (realPeers.length > 0 ? 0 : 0)} active</span>
              </div>

              {realPeers.length === 0 ? (
                <div className="p-4 bg-slate-900/40 border border-slate-850/50 rounded-2xl flex items-center gap-3 text-xs text-slate-400">
                  <div className="w-8 h-8 rounded-full bg-slate-950 flex items-center justify-center text-slate-500 border border-slate-800">
                    <Users className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="font-semibold text-slate-300 block">No one else is currently in the call</span>
                    <span className="text-[10px] text-slate-500">You will be the first participant!</span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                  {realPeers.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-2 bg-slate-900/50 hover:bg-slate-900 border border-slate-850/40 rounded-xl">
                      <img src={p.avatar} className="w-7 h-7 rounded-full border border-slate-800 shrink-0" alt="Joined user avatar" referrerPolicy="no-referrer" />
                      <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-slate-200 block truncate">{p.name}</span>
                        <span className="text-[9px] text-purple-400 font-semibold uppercase tracking-wider">{p.role}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 text-slate-500">
                        {p.isMuted && <MicOff className="w-3.5 h-3.5 text-red-500" />}
                        {p.isCamOff && <VideoOff className="w-3.5 h-3.5 text-red-500" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Practice Sandbox simulation option */}
          <div className="bg-slate-900/40 border border-slate-850 p-4 rounded-xl flex items-center justify-between gap-3 text-xs">
            <div className="flex flex-col">
              <span className="font-bold text-slate-300">Sandbox Mock Peers</span>
              <span className="text-[10px] text-slate-500">Simulate mock classmates for offline practice</span>
            </div>
            <button 
              onClick={() => setEnableSandboxMockPeers(prev => !prev)}
              className={`w-10 h-5 rounded-full p-0.5 flex transition-all duration-300 cursor-pointer ${enableSandboxMockPeers ? 'bg-purple-600 justify-end' : 'bg-slate-700 justify-start'}`}
            >
              <div className="w-4 h-4 bg-white rounded-full shadow" />
            </button>
          </div>

          {/* Join button block with nice status feedback */}
          <div className="pt-6 border-t border-slate-905 mt-6 md:mt-0">
            <button
              onClick={handleJoinLesson}
              disabled={isJoining}
              className="w-full h-14 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 active:scale-98 text-white rounded-2xl font-bold flex items-center justify-center gap-2.5 shadow-xl shadow-purple-950/20 transition-all cursor-pointer"
            >
              {isJoining ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Connecting Securely...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  <span>Join now</span>
                </>
              )}
            </button>
            
            <button 
              onClick={onLeave}
              className="w-full text-center text-xs text-slate-500 hover:text-slate-300 hover:underline transition-colors mt-3 font-semibold cursor-pointer"
            >
              Cancel and Return
            </button>
          </div>

        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER MAIN ACTIVE MEETING (JOINED)
  // ==========================================
  return (
    <div className={`flex flex-col bg-slate-950 text-white rounded-[2.5rem] overflow-hidden border border-slate-800 shadow-2xl h-[72vh] relative ${className || ''}`}>
      
      {/* Top Session Ribbon */}
      <div className="flex flex-col sm:flex-row items-center justify-between px-8 py-4 bg-slate-900/90 backdrop-blur-sm border-b border-slate-850 shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/30 rounded-full">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest text-red-400">Classroom Live</span>
          </div>
          <span className="text-slate-400 text-xs font-mono bg-slate-950 px-2.5 py-1 rounded-md border border-slate-850">{formatTime(connectionTime)}</span>
          <span className="text-slate-500 text-xs hidden md:inline ml-1 font-sans">| ID: <span className="font-mono text-[11px] text-purple-400">{classId}</span></span>
        </div>
        
        {/* Real-time Emoji Reactions Quick Panel */}
        <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-950/60 border border-slate-800 rounded-full">
          <span className="text-[9px] text-slate-500 uppercase tracking-widest font-bold pr-1">React:</span>
          {['👍', '❤️', '👏', '🎉', '💡'].map(sym => (
            <button
              key={sym}
              onClick={() => triggerEmoji(sym)}
              className="text-base hover:scale-130 active:scale-95 transition-transform duration-100 p-1 cursor-pointer"
              title={`Send reaction ${sym}`}
            >
              {sym}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Layout switches */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-850">
            <button
              onClick={() => setLayoutMode('grid')}
              className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${layoutMode === 'grid' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Grid View Layout"
            >
              Grid
            </button>
            <button
              onClick={() => setLayoutMode('theater')}
              className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all ${layoutMode === 'theater' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
              title="Theater / Slides view"
            >
              Theater
            </button>
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 rounded-full text-xs text-slate-300">
            <Signal className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-[10px] font-bold">Encrypted P2P Media</span>
          </div>
          <button 
            onClick={() => setActiveSidebar(activeSidebar === 'users' ? null : 'users')}
            className={`p-2 rounded-xl transition-colors ${activeSidebar === 'users' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-850 hover:text-white'}`}
            title="Class Participants"
          >
            <Users className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setActiveSidebar(activeSidebar === 'chat' ? null : 'chat')}
            className={`p-2 rounded-xl transition-colors ${activeSidebar === 'chat' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:bg-slate-850 hover:text-white'}`}
            title="Live Stream Chat"
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Floating live notifications toast layer inside active video call (Google Meet style) */}
        <div className="absolute top-4 right-4 z-40 max-w-sm space-y-2 pointer-events-none">
          <AnimatePresence>
            {toasts.map(t => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: -20, x: 20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.2 } }}
                className="bg-slate-900/95 border border-slate-800 backdrop-blur-md px-4 py-3 rounded-2xl flex items-center gap-3 shadow-2xl pointer-events-auto"
              >
                <img 
                  src={t.avatar || 'https://api.dicebear.com/7.x/initials/svg?seed=Notification'} 
                  className="w-7 h-7 rounded-full bg-slate-800 border border-slate-705 shrink-0" 
                  alt="Toast user visual indicator"
                  referrerPolicy="no-referrer"
                />
                <span className="text-xs text-slate-100 font-sans font-medium leading-tight">{t.message}</span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Permission warning banner */}
        {permissionError && !toastMatches(toasts, "Connected audio") && (
          <div className="absolute top-4 left-4 right-4 z-40 bg-purple-950/90 border border-purple-800/40 backdrop-blur-md p-4 rounded-2xl flex items-start gap-3 shadow-xl max-w-lg">
            <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5 animate-bounce" />
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-purple-300">Intelligent WebRTC Feed Initialized</p>
              <p className="text-[11px] text-purple-200 mt-1 leading-relaxed">{permissionError}</p>
            </div>
            <button onClick={() => setPermissionError(null)} className="ml-auto text-purple-400 hover:text-white cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Floating emoji reactions canvas overlay */}
        <div className="absolute inset-x-0 bottom-4 pointer-events-none z-30 h-44 overflow-hidden">
          <AnimatePresence>
            {emojiReactions.map(emoji => (
              <motion.div
                key={emoji.id}
                initial={{ y: 160, x: 0, opacity: 0, scale: 0.5 }}
                animate={{ 
                  y: -50, 
                  x: Math.sin(emoji.id) * 35, // ambient side-sway
                  opacity: [0, 1, 1, 0],
                  scale: [0.5, 1.3, 1, 0.8]
                }}
                transition={{ duration: 3.5, ease: "easeOut" }}
                exit={{ opacity: 0 }}
                style={{ left: `${emoji.left}%` }}
                className="absolute text-5xl select-none filter drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
              >
                {emoji.symbol}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Dynamic Display Layout */}
        <div className="flex-1 flex overflow-hidden min-h-0 bg-slate-950">
          
          {layoutMode === 'theater' ? (
            /* THEATER MODE: Large Center Screen Share or Slides Deck with Lateral Strip */
            <div className="flex-1 flex flex-col lg:flex-row p-6 gap-6 overflow-hidden max-w-full">
              {/* Main Theater Board */}
              <div className="flex-1 min-h-0 relative bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden flex flex-col justify-between p-6">
                
                {isScreenSharing ? (
                  /* Screen Share Render Container */
                  <div className="absolute inset-0 bg-black flex items-center justify-center p-2">
                    {screenShareStream ? (
                      <video
                        ref={presentationVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-contain rounded-2xl"
                      />
                    ) : (
                      /* High-fidelity Virtual presentation fallback slide deck if display Capture restricted */
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950 via-slate-950 to-purple-950 p-8 flex flex-col justify-between overflow-y-auto">
                        <div className="space-y-4">
                          <div className="flex items-center justify-between border-b border-indigo-900 pb-3">
                            <div>
                              <span className="text-[10px] bg-purple-600/20 border border-purple-500/30 px-2 py-0.5 rounded text-purple-400 font-black uppercase tracking-widest animate-pulse">Active Screen Presenter</span>
                              <h3 className="text-xl font-bold tracking-tight text-white mt-1.5">{presentationSlides[currentSlideIndex].title}</h3>
                              <p className="text-xs text-indigo-300 font-mono mt-0.5">{presentationSlides[currentSlideIndex].subtitle}</p>
                            </div>
                            <span className="text-xs text-slate-500 bg-slate-900 border border-slate-800 px-3 py-1 rounded-full font-mono font-bold">Slide {currentSlideIndex + 1} of {presentationSlides.length}</span>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            <div className="space-y-3">
                              <p className="text-[10px] uppercase font-black tracking-wider text-slate-400">Core Lecture Highlights</p>
                              <ul className="space-y-2.5">
                                {presentationSlides[currentSlideIndex].bullets.map((b, i) => (
                                  <li key={i} className="text-xs text-indigo-100 flex items-start gap-2 leading-relaxed">
                                    <span className="text-purple-400 font-bold shrink-0 mt-0.5">✦</span>
                                    <span>{b}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl flex flex-col justify-center font-mono text-[10px] text-emerald-400 select-none overflow-x-auto whitespace-pre leading-relaxed shadow-inner">
                              <p className="text-slate-500 font-sans text-[8px] uppercase font-black tracking-widest pb-2">Logical Data Architecture Map</p>
                              {presentationSlides[currentSlideIndex].diagram}
                            </div>
                          </div>
                        </div>

                        {/* Interactive slide controllers */}
                        <div className="flex items-center justify-between pt-6 border-t border-indigo-950 mt-4 shrink-0">
                          <p className="text-[9px] text-slate-500 italic font-sans flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Real-time peer interactions active.
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setCurrentSlideIndex(prev => Math.max(0, prev - 1))}
                              disabled={currentSlideIndex === 0}
                              className="px-3 py-1.5 text-xs bg-slate-900 border border-slate-805 text-white hover:bg-slate-800 disabled:opacity-40 rounded-lg transition-colors font-bold cursor-pointer"
                            >
                              Previous
                            </button>
                            <button
                              onClick={() => setCurrentSlideIndex(prev => Math.min(presentationSlides.length - 1, prev + 1))}
                              disabled={currentSlideIndex === presentationSlides.length - 1}
                              className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg transition-colors font-bold cursor-pointer"
                            >
                              Next Page
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Standard Lecture focus if not presenting */
                  <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 to-slate-900 flex flex-col items-center justify-center p-8 text-center">
                    <img src="https://api.dicebear.com/7.x/initials/svg?seed=Evelyn%20Carter" className="w-24 h-24 rounded-full border-4 border-slate-800 shadow-2xl bg-purple-900" alt="Dr Carter" />
                    <p className="text-base font-bold text-slate-200 mt-4">Dr. Evelyn Carter</p>
                    <p className="text-xs text-purple-400 mt-1 uppercase font-bold tracking-widest">Instructor / Host</p>
                    <div className="flex items-center gap-2 mt-3 px-4 py-1.5 rounded-full bg-purple-950 border border-purple-900/50">
                      <Volume2 className="w-4 h-4 text-purple-400 animate-bounce" />
                      <span className="text-[10px] text-purple-300 uppercase tracking-widest font-black">Explaining Research Assignment</span>
                    </div>
                  </div>
                )}

                {/* Speaker indicator element */}
                <div className="absolute bottom-4 left-4 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2 z-10">
                  <span className="font-bold">{isScreenSharing ? `${user.fullName} (Screen)` : 'Dr. Evelyn Carter'}</span>
                  <span className="text-[9px] font-black uppercase text-purple-400 tracking-wider bg-purple-950 px-1.5 py-0.5 rounded">Speaking</span>
                </div>
              </div>

              {/* Lateral strip for classroom student files */}
              <div className="w-full lg:w-64 overflow-y-auto shrink-0 flex flex-row lg:flex-col gap-4 min-h-0 pr-1">
                {/* Active Local user */}
                <div className="relative w-40 lg:w-full h-32 lg:h-36 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                  {isCamOff ? (
                    <div className="text-center">
                      <img src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user.fullName}`} className="w-12 h-12 rounded-full border border-slate-800 mx-auto" alt="User" referrerPolicy="no-referrer" />
                      <p className="text-[10px] text-slate-400 font-bold mt-1.5">{user.fullName || 'You'} (You)</p>
                    </div>
                  ) : (
                    <video 
                      ref={localVideoRef} 
                      autoPlay 
                      playsInline 
                      muted={true}
                      className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-all duration-300 ${filterClassMap[videoFilter]}`}
                    />
                  )}
                  <div className="absolute bottom-2 left-2 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-2 py-0.5 rounded text-[10px] truncate max-w-full z-10">
                    <span>You</span>
                  </div>
                </div>

                {/* Peers Lateral list */}
                {totalClassmates.map(p => (
                  <div key={p.id} className="relative w-40 lg:w-full h-32 lg:h-36 rounded-2xl bg-slate-900 border border-slate-800 overflow-hidden flex items-center justify-center shrink-0">
                    <div className="text-center">
                      <img src={p.avatar} className="w-12 h-12 rounded-full bg-blue-950/50 border border-slate-800 mx-auto" alt="Peer avatar" referrerPolicy="no-referrer" />
                      <p className="text-[10px] text-slate-300 font-bold mt-1.5">{p.name}</p>
                    </div>
                    <div className="absolute bottom-2 left-2 bg-slate-950/80 border border-slate-800 px-2 py-0.5 rounded text-[10px] flex items-center gap-1">
                      {p.isMuted ? <MicOff className="w-3 h-3 text-red-500" /> : <Mic className="w-3 h-3 text-emerald-400 animate-pulse" />}
                      <span>{p.name.split(' ')[0]}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* EQUAL GRID VIEW MODE (Splits based on total active participants) */
            <div className={`flex-1 p-6 overflow-y-auto grid gap-6 items-stretch min-h-0 bg-slate-950 ${
              totalClassmates.length === 0 ? 'grid-cols-1 md:grid-cols-2' :
              totalClassmates.length === 1 ? 'grid-cols-1 md:grid-cols-2' :
              'grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3'
            }`}>
              
              {/* Active Local User webcam box */}
              <div className="relative rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden group flex flex-col items-center justify-center min-h-[200px]">
                {/* Cam screen */}
                {isCamOff ? (
                  <div className="w-20 h-20 rounded-full bg-slate-850 flex items-center justify-center text-lg font-bold shadow-2xl relative border-2 border-slate-700">
                    <img src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user.fullName}`} className="w-full h-full rounded-full shrink-0" alt="user avatar" referrerPolicy="no-referrer" />
                    <VideoOff className="absolute -bottom-1 -right-1 w-5 h-5 text-red-500 bg-slate-950 p-1 rounded-full border border-slate-800" />
                  </div>
                ) : (
                  <video 
                    ref={localVideoRef} 
                    autoPlay 
                    playsInline 
                    muted={true}
                    className={`absolute inset-0 w-full h-full object-cover transform scale-x-[-1] transition-all duration-300 ${filterClassMap[videoFilter]}`}
                  />
                )}
                
                {/* Simulated webcam fallback logo if no hardware permissions loaded */}
                {!isCamOff && !localStream && (
                  <div className="absolute inset-0 bg-gradient-to-tr from-purple-950 to-indigo-950 flex flex-col items-center justify-center p-6 text-center">
                    <div className="relative">
                      <img src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user.fullName}`} className={`w-18 h-18 rounded-full border-4 border-purple-500/20 shadow-2xl bg-indigo-900 transition-all duration-300 ${filterClassMap[videoFilter]}`} alt="User profile" referrerPolicy="no-referrer" />
                      {volumeLevel > 20 && !isMuted && (
                        <span className="absolute -inset-2 rounded-full border-4 border-purple-400/30 animate-ping" />
                      )}
                    </div>
                    <p className="text-xs font-bold text-indigo-200 mt-2.5">{user.fullName || 'You'} (You)</p>
                    <span className="text-[9px] text-indigo-400 uppercase tracking-widest font-black mt-0.5">Capturing live feed</span>
                  </div>
                )}

                {/* Speaker indicator aura */}
                {!isMuted && volumeLevel > 15 && (
                  <div 
                    className="absolute inset-0 border-[5px] border-emerald-500/30 rounded-3xl pointer-events-none transition-all duration-75"
                    style={{ opacity: Math.min(1, volumeLevel / 100) }}
                  />
                )}

                {/* Floating identity badge */}
                <div className="absolute bottom-4 left-4 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2">
                  <span className="font-bold">{user.fullName || 'You'}</span>
                  <span className="text-[9px] font-black uppercase text-slate-400 tracking-wider bg-slate-800 px-1.5 py-0.5 rounded">Student</span>
                  {isMuted && <MicOff className="w-3 h-3 text-red-500 ml-1" />}
                </div>

                {isScreenSharing && (
                  <div className="absolute top-4 right-4 bg-purple-600 border border-purple-500 text-white px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-lg font-sans">
                    <Monitor className="w-3.5 h-3.5" /> Screen Presenting
                  </div>
                )}
              </div>

              {/* Sonar Radar Card when alone */}
              {totalClassmates.length === 0 && (
                <div className="relative rounded-3xl bg-slate-900/50 border border-slate-800/80 p-8 flex flex-col items-center justify-center text-center overflow-hidden min-h-[200px] group border-dashed select-none">
                  {/* Glowing radar pulses */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
                    <span className="absolute w-44 h-44 rounded-full border border-purple-500/40 animate-ping" />
                    <span className="absolute w-64 h-64 rounded-full border border-purple-500/20 animate-ping [animation-delay:1.5s]" />
                  </div>
                  
                  <div className="relative z-10 space-y-4 max-w-sm">
                    <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-full flex items-center justify-center mx-auto shadow-inner animate-pulse">
                      <Signal className="w-7 h-7" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-100 font-display">Waiting for other students...</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1 font-sans">
                        This lesson operates with real-time sync. Open another private tab or window to join and study together instantly!
                      </p>
                    </div>
                    <div className="inline-block px-3 py-1.5 bg-slate-950 font-mono text-purple-400 font-semibold border border-purple-950 rounded-xl text-xs select-all cursor-pointer font-sans">
                      Room ID: {classId}
                    </div>
                  </div>
                </div>
              )}

              {/* Joined Peer Cards */}
              {totalClassmates.map(p => {
                const isSpeaking = activeSpeaker === p.id || p.isSpeaking;
                return (
                  <div key={p.id} className="relative rounded-3xl bg-slate-900 border border-slate-800 overflow-hidden group flex flex-col items-center justify-center min-h-[200px] w-full">
                    {/* Live Video stream background simulation if camera is ON */}
                    {!p.isCamOff ? (
                      <div className="absolute inset-0 bg-gradient-to-tr from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-6 text-center select-none overflow-hidden w-full h-full">
                        {/* CRT / Scanlines overlay filter */}
                        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_40%,rgba(15,23,42,0.6)_100%)] z-1" />
                        <div className="absolute top-0 left-0 w-full h-full bg-cover opacity-10 pointer-events-none animate-scanline" />
                        
                        {/* Shifting background ambient light gradient */}
                        <div className={`absolute -inset-10 bg-radial-gradient from-purple-500/10 via-transparent to-transparent opacity-40 blur-2xl transition-all duration-1000 ${isSpeaking ? 'scale-125 opacity-60' : 'scale-100'}`} />

                        <div className="relative z-10 shrink-0">
                          <img src={p.avatar} className="w-18 h-18 rounded-full border-4 border-slate-800 shadow-2xl bg-purple-900 mx-auto" alt="Joined student avatar" referrerPolicy="no-referrer" />
                          {isSpeaking && (
                            <span className="absolute -inset-1.5 rounded-full border-4 border-purple-500/40 animate-ping" />
                          )}
                        </div>
                        
                        <p className="text-xs font-bold text-slate-200 mt-2.5 relative z-10">{p.name}</p>
                        
                        {/* Dynamic Live Audio wave lines inside video card */}
                        <div className="flex items-center gap-0.5 justify-center mt-3 h-4 relative z-10">
                          {[1, 2, 3, 4, 5].map(line => (
                            <span 
                              key={line} 
                              className={`w-[2.5px] roundedbg bg-purple-500 transition-all duration-300 ${
                                isSpeaking 
                                  ? 'h-3 animate-audio-pulse [animation-delay:' + (line * 0.1) + 's]' 
                                  : 'h-1 bg-slate-700'
                              }`} 
                            />
                          ))}
                        </div>

                        {/* Top corner live HD banner */}
                        <div className="absolute top-3.5 right-3.5 flex items-center gap-1.5 bg-slate-950/80 border border-slate-800/80 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-[8px] z-10 font-sans">
                          <span className={`w-1.5 h-1.5 rounded-full ${isSpeaking ? 'bg-emerald-400' : 'bg-semibold bg-amber-400'} animate-pulse`} />
                          <span className="text-slate-300 font-semibold">{isSpeaking ? "Speaking" : "Live HD"}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center p-6 text-center select-none w-full h-full">
                        <div className="relative shrink-0">
                          <img src={p.avatar} className="w-18 h-18 rounded-full border-4 border-slate-900 shadow-2xl bg-slate-950" alt="Joined student avatar" referrerPolicy="no-referrer" />
                          <VideoOff className="absolute -bottom-1 -right-1 w-5 h-5 text-red-500 bg-slate-950 p-1 rounded-full border border-slate-800" />
                        </div>
                        <p className="text-xs font-bold text-slate-400 mt-2.5">{p.name}</p>
                        <span className="text-[9px] text-slate-600 mt-1.5 uppercase tracking-widest font-black">Camera turned off</span>
                      </div>
                    )}

                    {isSpeaking && (
                      <div className="absolute inset-0 border-[5px] border-purple-500/20 rounded-3xl pointer-events-none" />
                    )}

                    <div className="absolute bottom-4 left-4 bg-slate-950/80 backdrop-blur-md border border-slate-800 px-3 py-1.5 rounded-xl text-xs flex items-center gap-2">
                      <span className="font-bold">{p.name}</span>
                      <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${p.role === 'teacher' ? 'bg-purple-950 text-purple-400' : 'bg-slate-800 text-slate-400'}`}>
                        {p.role}
                      </span>
                      {p.isMuted && <MicOff className="w-3.5 h-3.5 text-red-500 ml-1" />}
                    </div>
                  </div>
                );
              })}

            </div>
          )}

        </div>

        {/* SIDEBARS PANEL */}
        <AnimatePresence>
          {activeSidebar && (
            <motion.div 
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              className="border-l border-slate-800 bg-slate-900 flex flex-col h-full overflow-hidden shrink-0 z-10 shadow-2xl relative"
            >
              {activeSidebar === 'users' ? (
                <div className="p-6 flex flex-col h-full min-h-0 select-none">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6 font-sans">
                    <h4 className="font-bold text-sm tracking-tight">Class Members</h4>
                    <span className="text-xs text-slate-400 bg-slate-950 border border-slate-850 px-3 py-0.5 rounded-full font-mono font-bold">{totalClassmates.length + 1} Connected</span>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                    {/* Local profile */}
                    <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-2xl border border-slate-800/50">
                      <div className="flex items-center gap-3">
                        <img src={user.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${user.fullName}`} className="w-8 h-8 rounded-full bg-purple-950" alt="Self avatar" referrerPolicy="no-referrer" />
                        <div>
                          <p className="text-xs font-bold text-slate-200">{user.fullName || 'You'} (You)</p>
                          <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mt-0.5">Presenter Device</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        {isMuted ? <MicOff className="w-4 h-4 text-red-500" /> : <Mic className="w-4 h-4 text-emerald-500 animate-pulse" />}
                        {isCamOff ? <VideoOff className="w-4 h-4 text-red-500" /> : <Video className="w-4 h-4 text-slate-300" />}
                      </div>
                    </div>

                    {/* Classmates */}
                    {totalClassmates.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 hover:bg-slate-800/40 rounded-2xl transition-colors">
                        <div className="flex items-center gap-3">
                          <img src={p.avatar} className="w-8 h-8 rounded-full" alt="peer thumbnail" referrerPolicy="no-referrer" />
                          <div>
                            <p className="text-xs font-bold text-slate-200">{p.name}</p>
                            <span className={`text-[8px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded ${p.role === 'teacher' ? 'bg-purple-950 text-purple-400' : 'bg-slate-800 text-slate-400'}`}>
                              {p.role}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {p.isMuted ? <MicOff className="w-4 h-4 text-slate-600" /> : <Mic className="w-4 h-4 text-emerald-550" />}
                          {p.isCamOff ? <VideoOff className="w-4 h-4 text-slate-600" /> : <Video className="w-4 h-4 text-slate-350" />}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-6 flex flex-col h-full min-h-0 animate-fadeIn">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4 font-sans">
                    <h4 className="font-bold text-sm tracking-tight">Live Session Chat</h4>
                    <span className="text-[9px] px-2.5 py-0.5 text-slate-400 bg-slate-950 border border-slate-850 rounded-md font-bold">Permanent Sync</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0 pb-4">
                    <p className="text-[10px] text-slate-500 text-center py-2 italic font-sans border-b border-slate-850/50">Comment updates save permanently using Cloud Firestore synchronization.</p>
                    {chatMessages.map((m, i) => (
                      <div key={i} className="space-y-1.5 text-xs">
                        <div className="flex items-center justify-between group">
                          <span className="font-bold text-slate-300">{m.sender}</span>
                          <span className="text-[9px] text-slate-500">{m.time}</span>
                        </div>
                        <div className="px-3.5 py-2.5 bg-slate-850 border border-slate-805 rounded-2xl text-slate-200 break-words font-sans">
                          {m.text}
                        </div>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleSendChat} className="mt-auto pt-4 border-t border-slate-800 flex gap-2 shrink-0">
                    <input 
                      type="text" 
                      placeholder="Comment into live classroom..."
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      className="flex-grow px-3 py-2.5 bg-slate-850 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-purple-600 focus:bg-slate-900 transition-colors placeholder:text-slate-500"
                    />
                    <button type="submit" disabled={!chatInput.trim()} className="px-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-xl transition-colors text-xs font-bold cursor-pointer">Post</button>
                  </form>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Control Actions bottom bar */}
      <div className="px-6 sm:px-10 py-5 bg-slate-900 border-t border-slate-850 flex flex-col md:flex-row gap-4 items-center justify-between shrink-0 font-sans z-10">
        
        {/* Cam Video Filters choices to change appearance live */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-black tracking-wider text-slate-500">Video filter:</span>
          <select
            value={videoFilter}
            onChange={(e) => setVideoFilter(e.target.value as any)}
            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs px-2.5 py-1.5 rounded-xl focus:outline-none focus:border-purple-600"
          >
            <option value="none">Standard Feed</option>
            <option value="blur">Soft Ambient Blur</option>
            <option value="grayscale">Retro Grayscale</option>
            <option value="sepia">Warm Sepia</option>
            <option value="cool">Cyberpunk Blue</option>
            <option value="warm">Sunset Warmth</option>
          </select>
        </div>

        {/* Audio frequency lights */}
        <div className="flex items-center gap-1.5">
          <Volume2 className="w-4 h-4 text-slate-400" />
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Audio level:</span>
          <div className="flex items-center gap-0.5 ml-2">
            {[1, 2, 3, 4, 5, 6, 7].map(b => (
              <span 
                key={b} 
                className={`w-1 h-3 rounded transition-all duration-75 ${volumeLevel > (b * 12) && !isMuted ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-slate-800'}`}
              />
            ))}
          </div>
        </div>

        {/* Core conference action buttons */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          {/* Mute button */}
          <button 
            onClick={toggleMic}
            className={`w-10 sm:w-12 h-10 sm:h-12 rounded-xl flex items-center justify-center transition-colors border cursor-pointer ${
              isMuted 
                ? 'bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25' 
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white-all shadow-sm'
            }`}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff className="w-4 sm:w-5 h-4 sm:h-5" /> : <Mic className="w-4 sm:w-5 h-4 sm:h-5" />}
          </button>

          {/* Camera toggle button */}
          <button 
            onClick={toggleCam}
            className={`w-10 sm:w-12 h-10 sm:h-12 rounded-xl flex items-center justify-center transition-colors border cursor-pointer ${
              isCamOff 
                ? 'bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25' 
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white-all shadow-sm'
            }`}
            title={isCamOff ? 'Start Camera' : 'Stop Camera'}
          >
            {isCamOff ? <VideoOff className="w-4 sm:w-5 h-4 sm:h-5" /> : <Video className="w-4 sm:w-5 h-4 sm:h-5" />}
          </button>

          {/* Screen Share button */}
          <button 
            onClick={toggleScreenShare}
            className={`w-10 sm:w-12 h-10 sm:h-12 rounded-xl flex items-center justify-center transition-colors border cursor-pointer ${
              isScreenSharing 
                ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_15px_rgba(147,51,234,0.3)]' 
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white-all shadow-sm'
            }`}
            title={isScreenSharing ? 'Stop Presenting Screen' : 'Present Entire Screen'}
          >
            <Monitor className="w-4 sm:w-5 h-4 sm:h-5" />
          </button>

          {/* Disconnect/Leave button */}
          <button 
            onClick={handleLeaveLesson}
            className="px-4 px-6 h-10 sm:h-12 bg-red-650 hover:bg-red-750 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-red-950/45 transition-colors cursor-pointer"
          >
            <PhoneOff className="w-3.5 h-3.5" /> <span className="hidden sm:inline font-sans">End Session</span>
          </button>
        </div>

        <button className="p-2 text-slate-500 hover:text-white transition-colors cursor-pointer">
          <Settings className="w-5 h-5 animate-spin-slow" />
        </button>
      </div>

      <style>{`
        .animate-spin-slow {
          animation: spin-slow 12s linear infinite;
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Visual helper checking if message matches already sent notification trigger
function toastMatches(toasts: ClassroomToast[], subText: string): boolean {
  return toasts.some(t => t.message.toLowerCase().includes(subText.toLowerCase()));
}
