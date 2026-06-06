export type Role = 'admin' | 'teacher' | 'student';

export interface User {
  uid: string;
  id?: string;
  username: string;
  fullName: string;
  class: string | null;
  role: Role;
  favoriteSubjects: string[] | null;
  email?: string;
  contactCode?: string; // 5-digit contact code
  avatarUrl?: string;
  bio?: string;
  school?: string;
  
  // Custom user settings
  notificationSound?: 'classic' | 'crystal' | 'digital' | 'ambient' | 'minimal';
  masterNotifications?: boolean;
  assignmentAlerts?: boolean;
  readingReminders?: boolean;
  classAnnouncements?: boolean;
  pedagogyLevel?: string;
  contextTracking?: boolean;
  autoSummaries?: boolean;
  dynamicQuizzes?: boolean;
  autoResume?: boolean;
  focusMode?: boolean;
  cloudSync?: boolean;
  notesUi?: boolean;
}

export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: any;
  type: 'text' | 'file' | 'audio';
}

export interface Conversation {
  id: string;
  participants: string[]; // array of uids
  lastMessage?: string;
  lastMessageTimestamp?: any;
  unreadCount?: { [uid: string]: number };
}

export interface Resource {
  id: string;
  title: string;
  author: string;
  type: string;
  description: string | null;
  fileUrl: string | null;
  coverUrl: string | null;
  createdAt: string;
  status: 'available' | 'borrowed';
  borrowedBy: string | null;
  isbn: string | null;
  genre: string | null;
  publicationDate: string | null;
  uniqueIdentifier: string | null;
  className?: string;
  subject?: string;
  uploadedBy?: string;
}

export interface CourseLesson {
  id: string;
  section_id: string;
  title: string;
  type: string;
  content: string;
  video_url?: string;
  order_index: number;
}

export interface Course {
  id: string;
  title: string;
  description: string;
  teacher_id: string;
  teacher_uid?: string;
  teacherName?: string;
  subject: string;
  created_at: string;
  thumbnail_url?: string;
  difficulty?: string;
  tags?: string;
  status?: string;
  category?: string;
  course_code?: string;
  student_count?: number;
  lesson_count?: number;
  sections?: CourseSection[];
}

export interface CourseSection {
  id: string;
  course_id: string;
  title: string;
  order_index: number;
  lessons?: CourseLesson[];
}

export interface Classroom {
  id: string;
  name: string;
  subject: string;
  teacher_id: string;
  teacher_name?: string;
  class_code: string;
  created_at: string;
  student_count?: number;
  students?: any[];
  topics?: ClassTopic[];
  unorganizedAssignments?: ClassAssignment[];
}

export interface ClassTopic {
  id: string;
  class_id: string;
  title: string;
  order_index: number;
  assignments?: ClassAssignment[];
}

export interface ClassAssignment {
  id: string;
  class_id: string;
  topic_id: string | null;
  title: string;
  description: string;
  assignment_type: 'homework' | 'revision' | 'test' | 'material';
  due_date: string | null;
  created_at: string;
  submissions?: ClassSubmission[];
}

export interface ClassSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  student_name?: string;
  content: string;
  file_url: string | null;
  status: 'submitted' | 'completed' | 'needs_improvement';
  feedback: string | null;
  submitted_at: string;
}

export interface ClassAnnouncement {
  id: string;
  class_id: string;
  teacher_id: string;
  teacher_name?: string;
  content: string;
  created_at: string;
}

export interface Quiz {
  id: string;
  resourceId?: string; // If linked to a book/resource
  courseId?: string;
  title: string;
  questions: QuizQuestion[];
  createdAt: string;
}

export interface QuizQuestion {
  id: string;
  question: string; // The backend uses 'question' for text
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  user_id: string;
  score: number;
  total: number;
  answers: number[];
  completed_at: string;
  quiz_title?: string;
  resource_title?: string;
}

export interface ReadingProgress {
  id: string;
  userId: string;
  resourceId: string;
  lastPage: number;
  totalPages: number;
  updatedAt: string;
  title: string;
  coverUrl: string | null;
  author: string;
}

export interface StudySet {
  id: string;
  title: string;
  description: string;
  creatorId: string;
  creatorName: string;
  resourceIds: string[];
  createdAt: string;
  isPublic: boolean;
  subject: string;
  classLevel?: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  username?: string;
  action: string;
  details: string | null;
  createdAt: string;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  createdAt: any;
  read: boolean;
  link?: string;
}

export interface ShelfItem {
  id: string;
  resourceId: string;
  title: string;
  author?: string;
  type?: string;
  coverUrl?: string | null;
  subject?: string;
  category: string; // user-curated category, e.g. "Physics", "Exam Prep", "My Favorites"
  likedAt: string;
}
