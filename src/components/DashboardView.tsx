import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  Video, 
  FileText, 
  Layers, 
  Clock,
  Settings,
  BarChart3,
  Users
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  AreaChart, 
  Area 
} from 'recharts';
import { Resource, User, ActivityLog } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

interface DashboardViewProps {
  user: User;
  resources: Resource[];
  onRead: (resource: Resource) => void;
  onUploadClick: () => void;
  onSettingsClick: () => void;
}

const ANALYTICS_DATA = [
  { day: 'Mon', study: 2.1, papers: 1 },
  { day: 'Tue', study: 3.5, papers: 2 },
  { day: 'Wed', study: 2.5, papers: 1 },
  { day: 'Thu', study: 5.2, papers: 3 },
  { day: 'Fri', study: 3.8, papers: 2 },
  { day: 'Sat', study: 6.1, papers: 4 },
  { day: 'Sun', study: 4.5, papers: 2 },
];

export function DashboardView({ user, resources, onRead, onUploadClick, onSettingsClick }: DashboardViewProps) {
  const [stats, setStats] = useState({
    pastPapers: resources.filter(r => r.type === 'document' && (r.title.toLowerCase().includes('past') || r.title.toLowerCase().includes('exam'))).length,
    videos: resources.filter(r => r.type === 'video').length,
    books: resources.filter(r => r.type === 'book' || r.type === 'pdf').length
  });
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [newCourses, setNewCourses] = useState<any[]>([]);

  useEffect(() => {
    const fetchNewCourses = async () => {
      try {
        const res = await fetch('/api/courses');
        if (res.ok) {
          const data = await res.json();
          setNewCourses(data.slice(0, 4));
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchNewCourses();
  }, []);

  useEffect(() => {
    setStats({
      pastPapers: resources.filter(r => r.type === 'document' && (r.title.toLowerCase().includes('past') || r.title.toLowerCase().includes('exam'))).length,
      videos: resources.filter(r => r.type === 'video').length,
      books: resources.filter(r => r.type === 'book' || r.type === 'pdf').length
    });
  }, [resources]);

  useEffect(() => {
    const q = query(collection(db, 'activityLog'), orderBy('createdAt', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ActivityLog[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'activityLog');
    });
    return () => unsubscribe();
  }, []);

  const recentResources = resources.slice(0, 5);
  
  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-12 font-sans">
      
      {/* 1. HEADER SECTION */}
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome back, {user.fullName || user.username} 👋</h1>
          <p className="text-gray-500 mt-2 text-base">Continue your learning journey</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:block text-right">
            <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">Total Resources</p>
            <p className="text-3xl font-bold text-purple-600">{resources.length}</p>
          </div>
          <button 
            onClick={onSettingsClick}
            className="p-3 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:bg-gray-50 transition-all text-gray-500 hover:text-purple-600"
            title="Settings"
          >
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* 2. QUICK STATS CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {[
          { label: 'Past Papers', value: stats.pastPapers, icon: FileText, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Videos', value: stats.videos, icon: Video, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Books Read', value: stats.books, icon: BookOpen, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Total Resources', value: resources.length, icon: Layers, color: 'text-blue-600', bg: 'bg-blue-50' }
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 hover:-translate-y-1 transition-transform duration-300">
            <div className={`${stat.bg} ${stat.color} w-12 h-12 rounded-xl flex items-center justify-center mb-4`}>
              <stat.icon className="w-6 h-6" />
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</p>
            <p className="text-sm font-medium text-gray-500">{stat.label}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8 pt-4">
        <div className="lg:col-span-2 space-y-10">
          
          {/* 3. CONTINUE READING */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Continue Reading</h2>
            {recentResources.length > 0 ? (
              <div className="bg-white rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row gap-8 items-center shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-shadow">
                <div className="w-32 h-44 sm:w-40 sm:h-56 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 shadow-sm border border-gray-100">
                  <img 
                    src={recentResources[0].coverUrl || `https://picsum.photos/seed/${recentResources[0].id}/300/400`} 
                    alt={recentResources[0].title}
                    className="w-full h-full object-cover" 
                  />
                </div>
                <div className="flex-grow w-full flex flex-col justify-center">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2 leading-tight">{recentResources[0].title}</h3>
                  <p className="text-gray-500 mb-8">{recentResources[0].author}</p>
                  
                  <div className="space-y-2 mb-8 mt-auto">
                    <div className="flex justify-between text-sm font-semibold">
                      <span className="text-gray-500">Progress</span>
                      <span className="text-purple-600">65%</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-600 rounded-full w-[65%]" />
                    </div>
                  </div>

                  <button onClick={() => onRead(recentResources[0])} className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-semibold transition-colors w-full sm:w-max focus:outline-none focus:ring-4 focus:ring-purple-600/20">
                    Resume
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center text-gray-500 border border-gray-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
                No resources available to read.
              </div>
            )}
          </section>

          {newCourses.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">New Available Courses</h2>
                <button className="text-sm font-bold text-purple-600 hover:underline">View All</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {newCourses.map((course) => (
                  <div key={course.id} className="bg-white rounded-2xl p-4 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 flex gap-4 hover:shadow-md transition-shadow group cursor-pointer">
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                      <img 
                        src={course.thumbnail_url || `https://picsum.photos/seed/${course.id}/300/300`} 
                        alt={course.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                      />
                    </div>
                    <div className="flex flex-col justify-center overflow-hidden">
                      <p className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-1">{course.category || course.subject}</p>
                      <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-purple-600 transition-colors">{course.title}</h3>
                      <div className="flex items-center gap-3 mt-2 text-gray-500 text-xs">
                        <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" /> {course.lesson_count || 0}</span>
                        <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {course.student_count || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 4. RECOMMENDED CONTENT */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Recommended Next</h2>
            </div>
            <div className="flex overflow-x-auto gap-6 pb-6 pt-2 -mx-4 px-4 sm:mx-0 sm:px-0 custom-scrollbar">
              {recentResources.slice(1, 5).map((res, idx) => (
                <div 
                  key={res.id || idx} 
                  onClick={() => onRead(res)} 
                  className="min-w-[200px] w-[200px] flex-shrink-0 bg-white rounded-2xl p-4 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 cursor-pointer hover:-translate-y-1 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all group"
                >
                  <div className="w-full h-40 rounded-xl overflow-hidden bg-gray-100 mb-4 relative">
                    <img 
                      src={res.coverUrl || `https://picsum.photos/seed/${res.id}/300/400`} 
                      alt={res.title}
                      className="w-full h-full object-cover" 
                    />
                    <div className="absolute top-2 left-2 bg-white/95 px-2 py-1 rounded text-[10px] font-bold text-gray-700 uppercase tracking-widest shadow-sm">
                      {res.type === 'video' ? 'Video' : res.type === 'document' ? 'Paper' : 'Book'}
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 line-clamp-1 group-hover:text-purple-600 transition-colors">{res.title}</h3>
                  <p className="text-sm text-gray-500 line-clamp-1 mt-1">{res.author}</p>
                </div>
              ))}
              {recentResources.length <= 1 && (
                <div className="bg-white rounded-2xl p-8 text-center text-gray-500 border border-gray-100 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] w-full">
                  No recommendations available yet.
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-10">
          {/* 5. RECENT ACTIVITY */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-6">Recent Activity</h2>
            <div className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-gray-100 space-y-6">
              {activities.length > 0 ? activities.map(act => (
                <div key={act.id} className="flex gap-4 items-start">
                  <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl flex-shrink-0 mt-0.5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-gray-900 font-medium text-sm leading-snug">
                      <span className="font-bold text-gray-700">{act.username}</span> {act.details || act.action}
                    </p>
                    <p className="text-gray-500 text-xs mt-1.5">{getTimeAgo(act.createdAt)}</p>
                  </div>
                </div>
              )) : (
                <div className="flex gap-4 items-start">
                  <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl flex-shrink-0 mt-0.5">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-gray-900 font-medium text-sm leading-snug">
                      <span className="font-bold text-gray-700">System</span> Ready
                    </p>
                    <p className="text-gray-500 text-xs mt-1.5">Just now</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 6. ADVANCED ANALYTICS */}
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Learning Intelligence
            </h2>
            <div className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <p className="text-[10px] font-black text-text-muted uppercase tracking-[0.2em] mb-1">Weekly Intensity</p>
                  <p className="text-2xl font-bold text-text-main">27.7 <span className="text-sm font-medium text-text-secondary">Study Hours</span></p>
                </div>
                <div className="flex gap-4">
                   <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-xs font-bold text-text-secondary">Hours</span>
                   </div>
                   <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-sky-400" />
                      <span className="text-xs font-bold text-text-secondary">Papers</span>
                   </div>
                </div>
              </div>
              
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={ANALYTICS_DATA} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorStudy" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorPapers" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#38BDF8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F4F6" />
                    <XAxis 
                      dataKey="day" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#9CA3AF', fontWeight: 600 }} 
                      dy={15} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 11, fill: '#9CA3AF', fontWeight: 600 }}
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                      itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                      labelStyle={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9CA3AF', marginBottom: '4px', fontWeight: 'bold' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="study" 
                      name="Study Hours"
                      stroke="#8B5CF6" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorStudy)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="papers" 
                      name="Papers Resolved"
                      stroke="#38BDF8" 
                      strokeWidth={3} 
                      fillOpacity={1} 
                      fill="url(#colorPapers)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
