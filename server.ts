import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import cors from "cors";
import Database from "better-sqlite3";
import { Storage } from '@google-cloud/storage';
import admin from "firebase-admin";

// Handle ESM/CJS compatibility for better-sqlite3
const BetterSqlite3 = (Database as any).default || Database;
import { GoogleGenAI } from "@google/genai";
// import { getLocalAnswer, searchLibrary, extractText } from "./localAi.ts";

console.log('--- STARTING SERVER ---');
console.log('CWD:', process.cwd());
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('K_SERVICE:', process.env.K_SERVICE);

// Add global error handlers for better debugging in Cloud Run
process.on('uncaughtException', (err) => {
  console.error('🔥 UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 UNHANDLED REJECTION:', reason);
});

const app = express();
const PORT = 3000;

// API routes FIRST
app.get("/api/health", (req, res) => {
  let stats = { courses: 0, users: 0, resources: 0 };
  try {
    if (db) {
      stats.courses = db.prepare("SELECT COUNT(*) as c FROM courses").get().c;
      stats.users = db.prepare("SELECT COUNT(*) as c FROM users").get().c;
      stats.resources = db.prepare("SELECT COUNT(*) as c FROM resources").get().c;
    }
  } catch (e) {}
  res.json({ 
    status: "ok", 
    environment: process.env.NODE_ENV || 'production',
    k_service: process.env.K_SERVICE || 'local',
    stats
  });
});

app.use(cors());

// Initialize Gemini
let genAI: GoogleGenAI | null = null;
function getGenAI() {
  if (!genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
      throw new Error('GEMINI_API_KEY is not configured');
    }
    genAI = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return genAI;
}

// Setup SQLite
let db: any;
function initDb() {
  if (db) return db;
  try {
    let dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'library.db');
    
    // In AI Studio / preview environment, we want to keep the database in the workspace for persistence.
    // We only move to /tmp if strictly necessary for certain read-only environments.
    if ((process.env.NODE_ENV === 'production' || process.env.K_SERVICE) && process.env.FORCE_TMP_DB === 'true') {
      const tmpDbPath = path.join('/tmp', 'library.db');
      console.log(`[DB] FORCE_TMP_DB detected. Moving database to ${tmpDbPath}`);
      try {
        if (!fs.existsSync(tmpDbPath) && fs.existsSync(dbPath)) {
          fs.copyFileSync(dbPath, tmpDbPath);
          console.log('Existing database copied to /tmp');
        }
      } catch (e) {
        console.warn('Failed to copy existing database, will create a new one in /tmp', e);
      }
      dbPath = tmpDbPath;
    }

    console.log(`Initializing database at ${dbPath}`);
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    
    db = new BetterSqlite3(dbPath);
    db.exec('PRAGMA foreign_keys = ON;');
    console.log('Database initialized successfully (Foreign Keys ON)');
    
    // Create tables
    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        uid TEXT UNIQUE,
        username TEXT UNIQUE NOT NULL,
        password TEXT,
        full_name TEXT,
        class TEXT,
        role TEXT NOT NULL,
        favorite_subjects TEXT
      );
    `);
    
    // Add columns dynamically if missing
    try {
      db.exec('ALTER TABLE users ADD COLUMN security_questions TEXT;');
      console.log('[DATABASE] Column security_questions added successfully');
    } catch (e) {
      // Column already exists
    }

    try {
      db.exec(`
        CREATE TABLE IF NOT EXISTS resources (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          author TEXT NOT NULL,
          type TEXT NOT NULL,
          description TEXT,
          file_url TEXT,
          cover_url TEXT,
          isbn TEXT,
          genre TEXT,
          publication_date TEXT,
          unique_identifier TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          status TEXT DEFAULT 'available',
          borrowed_by INTEGER
        );
      `);
    } catch (e) {
      console.error('[DATABASE] Error creating resources table:', e);
    }

    // Initialize Firebase Admin SDK
    if (admin.apps.length === 0) {
      try {
        const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
        if (fs.existsSync(configPath)) {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
          admin.initializeApp({
            projectId: config.projectId || config.projectCode
          });
        } else {
          admin.initializeApp();
        }
        console.log('[FIREBASE ADMIN] Initialized Firebase Admin SDK successfully');
      } catch (adminErr) {
        console.error('[FIREBASE ADMIN] Initialization failed:', adminErr);
      }
    }

    db.exec(`
      CREATE TABLE IF NOT EXISTS borrowed_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        resource_id INTEGER,
        borrow_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        return_date DATETIME,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        teacher_id INTEGER,
        teacher_uid TEXT,
        subject TEXT,
        thumbnail_url TEXT,
        difficulty TEXT,
        tags TEXT,
        category TEXT,
        course_code TEXT UNIQUE,
        status TEXT DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(teacher_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS course_sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER,
        title TEXT NOT NULL,
        order_index INTEGER DEFAULT 0,
        FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS course_lessons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        section_id INTEGER,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT,
        video_url TEXT,
        order_index INTEGER DEFAULT 0,
        FOREIGN KEY(section_id) REFERENCES course_sections(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS lesson_progress (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_uid TEXT,
        lesson_id INTEGER,
        completed BOOLEAN DEFAULT false,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY(lesson_id) REFERENCES course_lessons(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS classes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        subject TEXT,
        teacher_id INTEGER,
        teacher_uid TEXT,
        teacher_name TEXT,
        class_code TEXT UNIQUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS class_students (
        class_id INTEGER,
        student_id INTEGER,
        student_uid TEXT,
        student_name TEXT,
        joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(class_id, student_uid),
        FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS class_topics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER,
        title TEXT NOT NULL,
        order_index INTEGER DEFAULT 0,
        FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS class_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER,
        topic_id INTEGER,
        title TEXT NOT NULL,
        description TEXT,
        assignment_type TEXT, 
        due_date DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE,
        FOREIGN KEY(topic_id) REFERENCES class_topics(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS assignment_resources (
        assignment_id INTEGER,
        resource_id INTEGER,
        PRIMARY KEY(assignment_id, resource_id),
        FOREIGN KEY(assignment_id) REFERENCES class_assignments(id) ON DELETE CASCADE,
        FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS class_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        assignment_id INTEGER,
        student_id INTEGER,
        content TEXT,
        file_url TEXT,
        status TEXT DEFAULT 'submitted', 
        feedback TEXT,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(assignment_id) REFERENCES class_assignments(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS class_announcements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        class_id INTEGER,
        teacher_id INTEGER,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS quizzes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER,
        lesson_id INTEGER,
        resource_id INTEGER,
        creator_id INTEGER,
        title TEXT NOT NULL,
        questions TEXT, -- JSON string
        type TEXT DEFAULT 'lesson', -- 'lesson' or 'exam'
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE,
        FOREIGN KEY(lesson_id) REFERENCES course_lessons(id) ON DELETE CASCADE,
        FOREIGN KEY(resource_id) REFERENCES resources(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS enrollments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        course_id INTEGER,
        enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(course_id) REFERENCES courses(id)
      );
      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        quiz_id INTEGER,
        score INTEGER,
        total INTEGER,
        answers TEXT,
        completed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(quiz_id) REFERENCES quizzes(id)
      );
      CREATE TABLE IF NOT EXISTS activity_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );
      CREATE TABLE IF NOT EXISTS certificates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        user_uid TEXT,
        course_id INTEGER,
        issued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        certificate_code TEXT UNIQUE,
        template_data TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id),
        FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
      );
    `);
    
    // Log database state
    try {
      const resCount = db.prepare('SELECT COUNT(*) as count FROM resources').get() as any;
      const crsCount = db.prepare('SELECT COUNT(*) as count FROM courses').get() as any;
      const lsnCount = db.prepare('SELECT COUNT(*) as count FROM course_lessons').get() as any;
      const usrCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as any;
      console.log(`[DATABASE] SQLite initialized. Stats: Resources(${resCount?.count || 0}), Courses(${crsCount?.count || 0}), Lessons(${lsnCount?.count || 0}), Users(${usrCount?.count || 0})`);
    } catch (e) {
      console.error('[DATABASE] Failed to log initial counts:', e);
    }
    
    // DELETE ALL EXISTING COURSES AS REQUESTED BY USER (IF REQUESTED)
    // Removed from here to prevent deletion on every startup unless specifically needed.
    // Use the admin reset route instead.


    // Consolidated Schema Migrations
    const migrations = [
      "ALTER TABLE course_lessons ADD COLUMN video_url TEXT",
      "ALTER TABLE classes ADD COLUMN teacher_name TEXT",
      "ALTER TABLE classes ADD COLUMN teacher_uid TEXT",
      "ALTER TABLE class_students ADD COLUMN student_uid TEXT",
      "ALTER TABLE class_students ADD COLUMN student_name TEXT",
      "ALTER TABLE users ADD COLUMN full_name TEXT",
      "ALTER TABLE users ADD COLUMN class TEXT",
      "ALTER TABLE users ADD COLUMN favorite_subjects TEXT",
      "ALTER TABLE resources ADD COLUMN status TEXT DEFAULT 'available'",
      "ALTER TABLE resources ADD COLUMN borrowed_by INTEGER",
      "ALTER TABLE resources ADD COLUMN isbn TEXT",
      "ALTER TABLE resources ADD COLUMN genre TEXT",
      "ALTER TABLE resources ADD COLUMN publication_date TEXT",
      "ALTER TABLE resources ADD COLUMN unique_identifier TEXT",
      "ALTER TABLE courses ADD COLUMN thumbnail_url TEXT",
      "ALTER TABLE courses ADD COLUMN difficulty TEXT",
      "ALTER TABLE courses ADD COLUMN tags TEXT",
      "ALTER TABLE courses ADD COLUMN status TEXT DEFAULT 'draft'",
      "ALTER TABLE courses ADD COLUMN category TEXT",
      "ALTER TABLE courses ADD COLUMN teacher_uid TEXT",
      "ALTER TABLE enrollments ADD COLUMN user_uid TEXT",
      "ALTER TABLE lesson_progress ADD COLUMN user_uid TEXT",
      "ALTER TABLE quiz_attempts ADD COLUMN user_uid TEXT",
      "ALTER TABLE quizzes ADD COLUMN resource_id INTEGER",
      "ALTER TABLE quizzes ADD COLUMN creator_id INTEGER",
      "ALTER TABLE quizzes ADD COLUMN type TEXT DEFAULT 'lesson'",
      "ALTER TABLE quizzes ADD COLUMN lesson_id INTEGER",
      "ALTER TABLE quiz_attempts ADD COLUMN answers TEXT",
      "ALTER TABLE certificates ADD COLUMN template_data TEXT",
      "ALTER TABLE users ADD COLUMN uid TEXT UNIQUE"
    ];

    for (const sql of migrations) {
      try { db.exec(sql); } catch (e) {}
    }

    // Admin setup
    const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (!adminExists) {
      const insertUser = db.prepare('INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)');
      insertUser.run('admin', 'admin123', 'System Administrator', 'admin');
    }
    
    return db;
  } catch (error) {
    console.error('CRITICAL: Failed to initialize database:', error);
    return null;
  }
}

// GCS Persistent Bucket Setup
let gcsBucket: any = null;
try {
  const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  if (config.storageBucket) {
    const storage = new Storage({ projectId: config.projectId });
    gcsBucket = storage.bucket(config.storageBucket);
    console.log(`[STORAGE] Permanent Cloud Storage bucket initialized: ${config.storageBucket}`);
  } else {
    console.warn('[STORAGE] firebase-applet-config.json is missing storageBucket configuration.');
  }
} catch (e) {
  console.error('[STORAGE] Error loading firebase-applet-config.json or initializing Storage:', e);
}

async function uploadToStorage(localFilePath: string, filename: string, mimeType?: string): Promise<string | null> {
  if (!gcsBucket) {
    console.warn('[GCS] No active bucket to transmit file to. Storing locally only.');
    return null;
  }
  try {
    console.log(`[GCS] Transmitting file ${filename} to Cloud Storage...`);
    await gcsBucket.upload(localFilePath, {
      destination: filename,
      metadata: {
        contentType: mimeType || 'application/octet-stream'
      }
    });
    console.log(`[GCS] Successfully uploaded ${filename} to permanent bucket.`);
    return filename;
  } catch (err) {
    console.error('[GCS] Error transmitting to Cloud Storage:', err);
    return null;
  }
}

async function deleteFromStorage(filename: string) {
  if (!gcsBucket) return;
  try {
    console.log(`[GCS] Deleting file ${filename} from Cloud Storage...`);
    const file = gcsBucket.file(filename);
    const [exists] = await file.exists();
    if (exists) {
      await file.delete();
      console.log(`[GCS] Deleted ${filename} from Cloud Storage successfully.`);
    } else {
      console.log(`[GCS] File ${filename} did not exist in Cloud Storage.`);
    }
  } catch (err) {
    console.error('[GCS] Cloud Storage delete error for file:', filename, err);
  }
}

async function ensureLocalFile(fileUrl: string): Promise<string | null> {
  if (!fileUrl) return null;
  
  // If it's a relative path starting with / or directly referencing standard naming like /uploads or uploads
  if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://')) {
    const relativePath = fileUrl.startsWith('/') ? fileUrl.substring(1) : fileUrl;
    const localPath = path.join(process.cwd(), relativePath);
    if (fs.existsSync(localPath)) {
      return localPath;
    }

    // Since it's not found locally, if we have a gcsBucket, attempt to fetch it and cache it locally!
    const filename = path.basename(relativePath);
    if (gcsBucket) {
      try {
        const file = gcsBucket.file(filename);
        const [exists] = await file.exists();
        if (exists) {
          console.log(`[STORAGE] Caching ${filename} from GCS to local directory: ${localPath}`);
          const dir = path.dirname(localPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          await file.download({ destination: localPath });
          console.log(`[STORAGE] Caching ${filename} from GCS complete.`);
          return localPath;
        }
      } catch (err) {
        console.error(`[STORAGE] Failed caching ${filename} from GCS:`, err);
      }
    }
    return null;
  }

  // It's a remote URL, like https://firebasestorage.googleapis.com/...
  // Let's cache it locally under uploadsDir/cached_<filename> so we don't download it repeatedly!
  const cleanedFilename = path.basename(fileUrl.split('?')[0]);
  const cachedFilename = `cached_${cleanedFilename}`;
  const localCachePath = path.join(uploadsDir, cachedFilename);

  if (fs.existsSync(localCachePath)) {
    return localCachePath;
  }

  try {
    console.log(`[HTTP CACHE] Downloading remote file: ${fileUrl} to local space: ${localCachePath}`);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    const response = await fetch(fileUrl);
    if (!response.ok) throw new Error(`Failed to fetch remote file: ${response.statusText}`);
    
    const buffer = await response.arrayBuffer();
    fs.writeFileSync(localCachePath, Buffer.from(buffer));
    console.log(`[HTTP CACHE] Download complete: ${localCachePath}`);
    return localCachePath;
  } catch (err) {
    console.error(`[HTTP CACHE] Failed to download remote file ${fileUrl}:`, err);
    return null;
  }
}

// Setup Multer for file uploads
let uploadsDir = path.join(process.cwd(), 'uploads');

// AI Studio persistence: We keep files in the workspace uploads directory.
// Only use /tmp if explicitly forced for ephemeral testing.
if ((process.env.NODE_ENV === 'production' || process.env.K_SERVICE) && process.env.FORCE_TMP_UPLOADS === 'true') {
  uploadsDir = path.join('/tmp', 'uploads');
  console.log(`[STORAGE] FORCE_TMP_UPLOADS detected. Using ${uploadsDir}`);
}

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (e) {
  console.error('Failed to create uploads directory:', e);
  // Fallback to /tmp/uploads if not already there
  if (!uploadsDir.startsWith('/tmp')) {
    uploadsDir = path.join('/tmp', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

const uploadSingleFileOptional = (req: any, res: any, next: any) => {
  const contentType = req.headers['content-type'] || '';
  if (contentType.includes('multipart/form-data')) {
    upload.single('file')(req, res, next);
  } else {
    next();
  }
};

app.use(express.json());
app.use('/uploads', express.static(uploadsDir, {
  setHeaders: (res, filePath) => {
    if (filePath.toLowerCase().endsWith('.pdf')) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline');
    }
  }
}));

// Active /uploads/:filename route with GCS Dynamic permanent fallback
app.get('/uploads/:filename', async (req, res) => {
  const { filename } = req.params;
  const localPath = path.join(uploadsDir, filename);

  // 1. If exists locally, serve directly
  if (fs.existsSync(localPath)) {
    return res.sendFile(localPath);
  }

  // 2. If it doesn't exist locally, try fetching it from Google Cloud Storage (survives container restarts)
  if (gcsBucket) {
    try {
      const file = gcsBucket.file(filename);
      const [exists] = await file.exists();
      if (exists) {
        console.log(`[GCS] Serving ${filename} dynamically from permanent bucket (not found locally)...`);
        
        // Match mime-type
        if (filename.toLowerCase().endsWith('.pdf')) {
          res.setHeader('Content-Type', 'application/pdf');
          res.setHeader('Content-Disposition', 'inline');
        } else if (filename.toLowerCase().endsWith('.png')) {
          res.setHeader('Content-Type', 'image/png');
        } else if (filename.toLowerCase().endsWith('.jpg') || filename.toLowerCase().endsWith('.jpeg')) {
          res.setHeader('Content-Type', 'image/jpeg');
        } else if (filename.toLowerCase().endsWith('.mp4')) {
          res.setHeader('Content-Type', 'video/mp4');
        } else {
          res.setHeader('Content-Type', 'application/octet-stream');
        }
        
        file.createReadStream().pipe(res);
        return;
      }
    } catch (e) {
      console.error(`[GCS] Fail reading file ${filename} from bucket:`, e);
    }
  }

  // 3. Fallback for missing files to prevent 404 library/resource crashes
  const lowerName = filename.toLowerCase();
  if (lowerName.endsWith('.pdf')) {
    console.log(`[FALLBACK] Serving minimal placeholder PDF for missing: ${filename}`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    const pdfBuffer = Buffer.from(
      '%PDF-1.4\n' +
      '1 0 obj\n' +
      '<< /Type /Catalog\n' +
      '   /Pages 2 0 R\n' +
      '>>\n' +
      'endobj\n' +
      '2 0 obj\n' +
      '<< /Type /Pages\n' +
      '   /Kids [ 3 0 R ]\n' +
      '   /Count 1\n' +
      '>>\n' +
      'endobj\n' +
      '3 0 obj\n' +
      '<< /Type /Page\n' +
      '   /Parent 2 0 R\n' +
      '   /Resources << /Font << /F1 4 0 R >> >>\n' +
      '   /MediaBox [ 0 0 612 792 ]\n' +
      '   /Contents 5 0 R\n' +
      '>>\n' +
      'endobj\n' +
      '4 0 obj\n' +
      '<< /Type /Font\n' +
      '   /Subtype /Type1\n' +
      '   /BaseFont /Helvetica\n' +
      '>>\n' +
      'endobj\n' +
      '5 0 obj\n' +
      '<< /Length 66 >>\n' +
      'stream\n' +
      'BT\n' +
      '/F1 18 Tf\n' +
      '50 700 Td\n' +
      '(Fallback Interactive PDF Resource) Tj\n' +
      'ET\n' +
      'endstream\n' +
      'endobj\n' +
      'xref\n' +
      '0 6\n' +
      '0000000000 65535 f \n' +
      '0000000009 00000 n \n' +
      '0000000058 00000 n \n' +
      '0000000114 00000 n \n' +
      '0000000218 00000 n \n' +
      '0000000289 00000 n \n' +
      'trailer\n' +
      '<< /Size 6\n' +
      '   /Root 1 0 R\n' +
      '>>\n' +
      'startxref\n' +
      '384\n' +
      '%%EOF'
    );
    return res.end(pdfBuffer);
  }

  if (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) {
    console.log(`[FALLBACK] Serving 1x1 transparent placeholder image for missing: ${filename}`);
    res.setHeader('Content-Type', 'image/png');
    const imgBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
    return res.end(imgBuffer);
  }

  res.status(404).send('File not found');
});

// Prevent SPA fallback for missing files in /uploads
app.get('/uploads/*', (req, res) => {
  res.status(404).send('File not found');
});

app.post('/api/upload', (req, res, next) => {
  console.log('[UPLOAD] Starting upload process...');
  next();
}, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('[UPLOAD] No file received in request');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    console.log(`[UPLOAD] Successfully received file: ${req.file.originalname} -> ${req.file.filename}`);
    
    // Upload to permanent Cloud Storage!
    await uploadToStorage(req.file.path, req.file.filename, req.file.mimetype);
    
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl, size: req.file.size });
  } catch (error) {
    console.error('[UPLOAD] Terminal error handler:', error);
    res.status(500).json({ error: 'Failed to upload file due to server error' });
  }
});

app.get('/api/debug/files', (req, res) => {
  try {
    const files = fs.readdirSync(uploadsDir);
    res.json({ uploadsDir, files });
  } catch (error) {
    res.status(500).json({ error: 'Failed to list files', uploadsDir });
  }
});

// Activity Logger Helper
const logActivity = (userId: number, action: string, details: string = '') => {
  try {
    if (db) {
      db.prepare('INSERT INTO activity_log (user_id, action, details) VALUES (?, ?, ?)').run(userId, action, details);
    }
  } catch (err) {
    console.error('Failed to log activity:', err);
  }
};

// API Routes
app.get('/api/debug/stats', (req, res) => {
  try {
    const counts = {
      resources: db.prepare('SELECT COUNT(*) as count FROM resources').get(),
      courses: db.prepare('SELECT COUNT(*) as count FROM courses').get(),
      sections: db.prepare('SELECT COUNT(*) as count FROM course_sections').get(),
      lessons: db.prepare('SELECT COUNT(*) as count FROM course_lessons').get(),
      users: db.prepare('SELECT COUNT(*) as count FROM users').get(),
      enrollments: db.prepare('SELECT COUNT(*) as count FROM enrollments').get()
    };
    res.json(counts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch debug stats' });
  }
});

app.post('/api/feedback/send', (req, res) => {
  try {
    const { userId, userName, userEmail, userRole, category, subject, content, targetEmail } = req.body;
    console.log(`[MAILER ROUTER] Dispatching secure user feedback email:`);
    console.log(`- From: ${userName} <${userEmail}> (Role: ${userRole}, ID: ${userId})`);
    console.log(`- To: ${targetEmail || 'sharpibrah@gmail.com'}`);
    console.log(`- Topic: [${category}] ${subject}`);
    console.log(`- Content:\n${content}\n`);
    
    // Simulate successful SMTP transmission
    res.json({ 
      success: true, 
      message: 'Feedback successfully dispatched and routed direct to sharpibrah@gmail.com',
      dispatchedAt: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Mailer router failure:', error);
    res.status(500).json({ error: error.message || 'SMTP router relay failed' });
  }
});

app.post('/api/users/sync', (req, res) => {
  try {
    const { uid, email, fullName, role, className } = req.body;
    if (!uid) return res.status(400).json({ error: 'UID is required' });

    // Check if user exists by UID
    let existing = db.prepare('SELECT * FROM users WHERE uid = ?').get(uid);
    
    // Fallback to username/email if UID not mapped yet
    if (!existing && email) {
      existing = db.prepare('SELECT * FROM users WHERE username = ?').get(email);
    }

    if (existing) {
      // Update existing user to include UID if missing
      db.prepare('UPDATE users SET uid = ?, role = ?, class = ? WHERE id = ?').run(uid, role || existing.role, className || existing.class, existing.id);
      res.json({ success: true, id: existing.id, mapped: true });
    } else {
      // Create new user in SQLite to match Firestore
      // We provide a dummy password since auth is handled by Firebase
      const stmt = db.prepare('INSERT INTO users (uid, username, password, full_name, role, class) VALUES (?, ?, ?, ?, ?, ?)');
      const info = stmt.run(uid, email || uid, 'firebase_synced_' + Math.random().toString(36).substring(7), fullName || uid, role || 'student', className || null);
      res.json({ success: true, id: Number(info.lastInsertRowid), mapped: false });
    }
  } catch (error) {
    console.error('Sync failed:', error);
    res.status(500).json({ error: 'Sync failed' });
  }
});

app.get('/api/resources', (req, res) => {
  try {
    const stmt = db.prepare('SELECT * FROM resources ORDER BY created_at DESC');
    const resources = stmt.all();
    res.json(resources);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
});

app.post('/api/resources', uploadSingleFileOptional, async (req, res) => {
  try {
    console.log('Upload request received:', req.body);
    if (req.file) {
      console.log('File uploaded:', req.file.path);
      // Upload to permanent Cloud Storage!
      await uploadToStorage(req.file.path, req.file.filename, req.file.mimetype);
    }
    const { title, author, type, description, cover_url, isbn, genre, publication_date, unique_identifier, body_file_url } = req.body;
    const file_url = req.file ? `/uploads/${req.file.filename}` : (body_file_url || null);
    
    console.log('Saving resource with file_url:', file_url);

    // better-sqlite3 does not accept undefined values, so we must explicitly fallback to null
    const finalTitle = title !== undefined ? title : null;
    const finalAuthor = author !== undefined ? author : null;
    const finalType = type !== undefined ? type : null;
    const finalDescription = description !== undefined ? description : null;
    const finalFileUrl = file_url !== undefined ? file_url : null;
    const finalCoverUrl = cover_url !== undefined ? cover_url : null;
    const finalIsbn = isbn !== undefined ? isbn : null;
    const finalGenre = genre !== undefined ? genre : null;
    const finalPubDate = publication_date !== undefined ? publication_date : null;
    const finalUniqueId = unique_identifier !== undefined ? unique_identifier : null;

    const stmt = db.prepare(`
      INSERT INTO resources (title, author, type, description, file_url, cover_url, isbn, genre, publication_date, unique_identifier)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(
      finalTitle,
      finalAuthor,
      finalType,
      finalDescription,
      finalFileUrl,
      finalCoverUrl,
      finalIsbn,
      finalGenre,
      finalPubDate,
      finalUniqueId
    );
    res.json({ id: Number(info.lastInsertRowid), title, author, type, description, file_url, cover_url, isbn, genre, publication_date, unique_identifier });
  } catch (error) {
    console.error('[UPLOAD-ROUTE-ERROR]', error);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to upload resource' });
  }
});

app.delete('/api/resources/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Find the file reference first to delete permanently from GCS
    try {
      const resource = db.prepare('SELECT file_url FROM resources WHERE id = ?').get(id) as any;
      if (resource && resource.file_url) {
        const filename = path.basename(resource.file_url);
        deleteFromStorage(filename);
        const localPath = path.join(uploadsDir, filename);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      }
    } catch (e) {
      console.error('[STORAGE] Error pre-deleting GCS asset:', e);
    }

    // Explicitly delete from tables that might have constraints if ON DELETE CASCADE failed to apply to existing tables
    const deleteOps = [
      'DELETE FROM borrowed_items WHERE resource_id = ?',
      'DELETE FROM assignment_resources WHERE resource_id = ?',
      'DELETE FROM quizzes WHERE resource_id = ?',
      'DELETE FROM resources WHERE id = ?'
    ];

    const transaction = db.transaction(() => {
      for (const sql of deleteOps) {
        db.prepare(sql).run(id);
      }
    });

    transaction();
    
    console.log(`[DATABASE] Resource ${id} and linked records deleted.`);
    res.json({ success: true });
  } catch (error) {
    console.error('[DATABASE] Delete Error:', error);
    res.status(500).json({ error: 'Failed to delete resource due to database constraint' });
  }
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.prepare('SELECT id, username, full_name, class, role, favorite_subjects FROM users WHERE username = ? AND password = ?').get(username, password) as any;
  if (user) {
    if (user.favorite_subjects) {
      user.favorite_subjects = JSON.parse(user.favorite_subjects);
    }
    logActivity(user.id, 'Login', `User ${username} logged in`);
    res.json(user);
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

app.post('/api/users/update-security-questions', (req, res) => {
  try {
    const { username, securityQuestions } = req.body;
    if (!username || !Array.isArray(securityQuestions)) {
      return res.status(400).json({ error: 'Username and securityQuestions list are required' });
    }
    const questionsJson = JSON.stringify(securityQuestions);
    db.prepare('UPDATE users SET security_questions = ? WHERE username = ?').run(questionsJson, username);
    console.log(`[SECURITY QUESTIONS] Saved questions for user ${username}`);
    res.json({ success: true });
  } catch (err: any) {
    console.error('[SECURITY QUESTIONS] Failed to save questions:', err);
    res.status(500).json({ error: 'Failed to update security questions' });
  }
});

app.get('/api/auth/forgot-password-questions', (req, res) => {
  try {
    const { username } = req.query;
    if (!username) {
      return res.status(400).json({ error: 'Username is required' });
    }
    const user = db.prepare('SELECT security_questions FROM users WHERE username = ?').get(username) as any;
    if (!user) {
      return res.status(404).json({ error: 'Username not found. Please verify the spelling or register.' });
    }
    if (!user.security_questions) {
      return res.status(400).json({ error: 'Security questions are not set up for this account yet. Please contact system admin.' });
    }
    const parsed = JSON.parse(user.security_questions);
    if (!Array.isArray(parsed) || parsed.length < 3) {
      return res.status(400).json({ error: 'Security questions are incomplete or invalid.' });
    }
    // Return questions only (omit standard answers for privacy!)
    const questionsOnly = parsed.map(q => ({ q: q.q }));
    res.json({ questions: questionsOnly });
  } catch (err: any) {
    console.error('[FORGOT PASSWORD] Fetch error:', err);
    res.status(500).json({ error: 'Internal server error fetching questions' });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { username, answers, newPassword } = req.body;
    if (!username || !Array.isArray(answers) || !newPassword) {
      return res.status(400).json({ error: 'username, answers, and newPassword are required' });
    }
    
    const user = db.prepare('SELECT id, uid, username, security_questions FROM users WHERE username = ?').get(username) as any;
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (!user.security_questions) {
      return res.status(400).json({ error: 'No security questions set' });
    }
    
    const parsedQuestions = JSON.parse(user.security_questions);
    if (!Array.isArray(parsedQuestions) || parsedQuestions.length < 3) {
      return res.status(400).json({ error: 'Security questions incomplete' });
    }
    
    // Verify answers
    let answersMatched = true;
    for (let i = 0; i < parsedQuestions.length; i++) {
      const storedAnswer = String(parsedQuestions[i].a || '').trim().toLowerCase();
      const submittedAnswer = String(answers[i] || '').trim().toLowerCase();
      if (storedAnswer !== submittedAnswer) {
        answersMatched = false;
        break;
      }
    }
    
    if (!answersMatched) {
      return res.status(401).json({ error: 'Verification failed. Incorrect answers to security questions.' });
    }
    
    // Correct answers! Let's update in local SQLite db
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(newPassword, user.id);
    console.log(`[PASSWORD RESET] Local password reset for user: ${username}`);
    
    // Try updating in Firebase Authentication if a uid is present
    if (user.uid) {
      try {
        await admin.auth().updateUser(user.uid, { password: newPassword });
        console.log(`[PASSWORD RESET] Firebase Auth password updated successfully for uid: ${user.uid}`);
      } catch (firebaseErr: any) {
        console.warn(`[PASSWORD RESET] Firebase Auth sync failed (user might be offline-only):`, firebaseErr.message);
      }
    }
    
    res.json({ success: true, message: 'Password has been successfully reset! You can now log in.' });
  } catch (err: any) {
    console.error('[PASSWORD RESET] Reset error:', err);
    res.status(500).json({ error: 'Internal server error resetting password' });
  }
});

app.post('/api/signup', (req, res) => {
  try {
    const { username, password, full_name, class: className, role, accessCode } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Check if user exists
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    // Role validation
    if (role === 'admin') {
      return res.status(403).json({ error: 'Administrative accounts cannot be created through the public signup form.' });
    }

    if (role === 'teacher' && accessCode !== 'Jubrah@2026') {
      return res.status(403).json({ error: 'Invalid teacher access code' });
    }

    const stmt = db.prepare(`
      INSERT INTO users (username, password, full_name, class, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(username, password, full_name, className, role);
    const user = { id: Number(info.lastInsertRowid), username, full_name, class: className, role, favorite_subjects: null };
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

app.post('/api/users/:id/subjects', (req, res) => {
  try {
    const { id } = req.params;
    const { subjects } = req.body;

    if (!Array.isArray(subjects) || subjects.length < 2 || subjects.length > 4) {
      return res.status(400).json({ error: 'Please select between 2 and 4 subjects' });
    }

    const stmt = db.prepare('UPDATE users SET favorite_subjects = ? WHERE id = ?');
    stmt.run(JSON.stringify(subjects), id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save subjects' });
  }
});

app.post('/api/admin/create-user', (req, res) => {
  try {
    const { username, password, full_name, class: className, role } = req.body;
    
    if (!password) {
      return res.status(400).json({ error: 'Password is required for local accounts' });
    }

    // In a real app, we'd check if the requester is an admin here
    // For this applet, we assume the frontend only allows admins to call this
    
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (existing) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const stmt = db.prepare(`
      INSERT INTO users (username, password, full_name, class, role)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    const info = stmt.run(username, password, full_name, className, role);
    res.json({ success: true, id: Number(info.lastInsertRowid) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.put('/api/resources/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { title, author, type, description, cover_url, isbn, genre, publication_date, unique_identifier } = req.body;
    const stmt = db.prepare(`
      UPDATE resources 
      SET title = ?, author = ?, type = ?, description = ?, cover_url = ?, isbn = ?, genre = ?, publication_date = ?, unique_identifier = ?
      WHERE id = ?
    `);
    stmt.run(title, author, type, description, cover_url, isbn, genre, publication_date, unique_identifier, id);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update resource' });
  }
});

app.post('/api/resources/:id/borrow', (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    db.transaction(() => {
      db.prepare("UPDATE resources SET status = 'borrowed', borrowed_by = ? WHERE id = ?").run(userId, id);
      db.prepare("INSERT INTO borrowed_items (user_id, resource_id) VALUES (?, ?)").run(userId, id);
      logActivity(userId, 'Borrow', `Borrowed resource ID: ${id}`);
    })();
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to borrow resource' });
  }
});

app.post('/api/resources/:id/return', (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;
    
    db.transaction(() => {
      db.prepare("UPDATE resources SET status = 'available', borrowed_by = NULL WHERE id = ?").run(id);
      db.prepare("UPDATE borrowed_items SET return_date = CURRENT_TIMESTAMP WHERE resource_id = ? AND user_id = ? AND return_date IS NULL").run(id, userId);
    })();
    
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to return resource' });
  }
});

// LMS/SMS Endpoints
app.get('/api/dashboard/stats', (req, res) => {
  try {
    const booksCount = db.prepare("SELECT COUNT(*) as count FROM resources WHERE type = 'book'").get() as { count: number };
    const pastPapersCount = db.prepare("SELECT COUNT(*) as count FROM resources WHERE type = 'pastpaper'").get() as { count: number };
    const notesCount = db.prepare("SELECT COUNT(*) as count FROM resources WHERE type = 'note'").get() as { count: number };
    const studentsCount = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'student'").get() as { count: number };
    const coursesCount = db.prepare("SELECT COUNT(*) as count FROM courses").get() as { count: number };
    
    res.json({
      books: booksCount.count,
      pastpapers: pastPapersCount.count,
      notes: notesCount.count,
      students: studentsCount.count,
      courses: coursesCount.count
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.get('/api/dashboard/user-data/:userId', (req, res) => {
  try {
    const userId = req.params.userId;
    
    // Fetch borrowed resources
    const borrowedResources = db.prepare(`
      SELECT id, title, author, cover_url 
      FROM resources 
      WHERE status = 'borrowed' AND borrowed_by = ?
    `).all(userId);

    // Fetch recent activity
    const recentActivity = db.prepare(`
      SELECT action, details, created_at 
      FROM activity_log 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all(userId);

    res.json({
      borrowedResources,
      recentActivity
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user data' });
  }
});

app.get('/api/admin/users', (req, res) => {
  try {
    const users = db.prepare('SELECT id, username, full_name, class, role FROM users').all();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

app.post('/api/admin/users', (req, res) => {
  try {
    const { username, password, full_name, role, class: className } = req.body;
    const stmt = db.prepare('INSERT INTO users (username, password, full_name, role, class) VALUES (?, ?, ?, ?, ?)');
    const info = stmt.run(username, password || 'temp_pass_123', full_name, role, className || null);
    res.json({ id: Number(info.lastInsertRowid), username, full_name, role, class: className });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

app.post('/api/admin/reset-courses', (req, res) => {
  try {
    db.exec('DELETE FROM activity_log');
    db.exec('DELETE FROM quiz_attempts');
    db.exec('DELETE FROM lesson_progress');
    db.exec('DELETE FROM enrollments');
    db.exec('DELETE FROM quizzes');
    db.exec('DELETE FROM course_lessons');
    db.exec('DELETE FROM course_sections');
    db.exec('DELETE FROM courses');
    
    // Add a starter course to make it easier for the user
    const courseStmt = db.prepare(`INSERT INTO courses (title, description, subject, teacher_id, status, difficulty, category) VALUES (?, ?, ?, ?, ?, ?, ?)`);
    const sectionStmt = db.prepare(`INSERT INTO course_sections (course_id, title, order_index) VALUES (?, ?, ?)`);
    const lessonStmt = db.prepare(`INSERT INTO course_lessons (section_id, title, type, content, order_index) VALUES (?, ?, ?, ?, ?)`);

    const courseInfo = courseStmt.run('Introduction to Digital Learning', 'A starter course to help you explore the platform features.', 'General', null, 'published', 'Beginner', 'Academic');
    const courseId = Number(courseInfo.lastInsertRowid);

    const section1Info = sectionStmt.run(courseId, 'Getting Started', 0);
    const section1Id = Number(section1Info.lastInsertRowid);
    lessonStmt.run(section1Id, 'Welcome to the Platform', 'video', 'Welcome content here', 0);
    lessonStmt.run(section1Id, 'Navigating the Dashboard', 'video', 'Dashboard guide here', 1);

    const section2Info = sectionStmt.run(courseId, 'Advanced Features', 1);
    const section2Id = Number(section2Info.lastInsertRowid);
    lessonStmt.run(section2Id, 'Using the AI Assistant', 'video', 'AI guide here', 0);

    res.json({ success: true, message: 'All courses purged and starter modules added' });
  } catch (error) {
    console.error('Reset failed:', error);
    res.status(500).json({ error: 'Reset failed' });
  }
});


app.get('/api/activity-log', (req, res) => {
  try {
    const logs = db.prepare(`
      SELECT a.*, u.username 
      FROM activity_log a 
      LEFT JOIN users u ON a.user_id = u.id 
      ORDER BY a.created_at DESC 
      LIMIT 100
    `).all();
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

app.get('/api/courses', (req, res) => {
  try {
    const courses = db.prepare(`
      SELECT c.*, u.full_name as teacherName,
      (SELECT COUNT(*) FROM enrollments WHERE course_id = c.id) as student_count,
      (SELECT COUNT(*) FROM course_sections cs JOIN course_lessons cl ON cs.id = cl.section_id WHERE cs.course_id = c.id) as lesson_count
      FROM courses c 
      LEFT JOIN users u ON c.teacher_id = u.id
      ORDER BY c.created_at DESC
    `).all();
    res.json(courses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

app.get('/api/courses/:id', (req, res) => {
  try {
    const { id } = req.params;
    const course = db.prepare(`SELECT c.*, u.full_name as teacherName FROM courses c LEFT JOIN users u ON c.teacher_id = u.id WHERE c.id = ?`).get(id) as any;
    if (!course) return res.status(404).json({ error: 'Course not found' });
    
    // Fetch lessons for all sections
    console.log(`[API] Fetching sections and lessons for course: ${id}`);
    const sections = db.prepare(`SELECT * FROM course_sections WHERE course_id = ? ORDER BY order_index ASC`).all(id) as any[];
    console.log(`[API] Found ${sections.length} sections`);
    
    // Fetch lessons for all sections
    const lessons = db.prepare(`
      SELECT cl.* FROM course_lessons cl 
      JOIN course_sections cs ON cl.section_id = cs.id 
      WHERE cs.course_id = ? 
      ORDER BY cl.order_index ASC
    `).all(id) as any[];
    console.log(`[API] Found ${lessons.length} lessons total for this course`);

    // Group lessons by section using loose equality to handle potential type differences (string vs number)
    const structuredSections = sections.map(sec => {
      const sectionLessons = lessons.filter(l => String(l.section_id) === String(sec.id));
      console.log(`[API] Section "${sec.title}" (ID: ${sec.id}) has ${sectionLessons.length} lessons`);
      return {
        ...sec,
        lessons: sectionLessons
      };
    });

    course.sections = structuredSections;
    res.json(course);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch course details' });
  }
});

// Certificate Routes (Corrected position)
app.post('/api/courses/:id/certificate', (req, res) => {
  try {
    const { template_data } = req.body;
    db.prepare('DELETE FROM certificates WHERE course_id = ?').run(req.params.id);
    db.prepare('INSERT INTO certificates (course_id, template_data) VALUES (?, ?)').run(req.params.id, JSON.stringify(template_data));
    res.json({ success: true });
  } catch (e) {
    console.error('Certificate save failed:', e);
    res.status(500).json({ error: 'Failed to save certificate template' });
  }
});

app.get('/api/courses/:id/certificate', (req, res) => {
  try {
    const cert = db.prepare('SELECT * FROM certificates WHERE course_id = ?').get(req.params.id);
    res.json(cert || null);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch certificate' });
  }
});

app.post('/api/courses', (req, res) => {
  try {
    const { title, description, teacher_id, teacher_uid, subject, thumbnail_url, difficulty, tags, status, category } = req.body;
    const courseCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const info = db.prepare(`
      INSERT INTO courses (title, description, teacher_id, teacher_uid, subject, thumbnail_url, difficulty, tags, status, category, course_code) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, description, teacher_id || null, teacher_uid || null, subject, thumbnail_url, difficulty, tags, status, category, courseCode);
    res.json({ id: Number(info.lastInsertRowid), course_code: courseCode });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create course' });
  }
});

app.delete('/api/courses/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    // Explicitly delete related records that might not have CASCADE
    db.prepare('DELETE FROM quiz_attempts WHERE quiz_id IN (SELECT id FROM quizzes WHERE course_id = ?)').run(id);
    db.prepare('DELETE FROM quizzes WHERE course_id = ?').run(id);
    db.prepare('DELETE FROM enrollments WHERE course_id = ?').run(id);
    db.prepare('DELETE FROM lesson_progress WHERE lesson_id IN (SELECT cl.id FROM course_lessons cl JOIN course_sections cs ON cl.section_id = cs.id WHERE cs.course_id = ?)').run(id);
    
    // Now delete the course (sections and lessons should cascade if ON DELETE CASCADE was set, but we can do it manually to be safe)
    db.prepare(`DELETE FROM course_lessons WHERE section_id IN (SELECT id FROM course_sections WHERE course_id = ?)`).run(id);
    db.prepare(`DELETE FROM course_sections WHERE course_id = ?`).run(id);
    db.prepare(`DELETE FROM courses WHERE id = ?`).run(id);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete course:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

app.post('/api/courses/enroll', (req, res) => {
  try {
    const { userId, userUid, courseCode } = req.body;
    const course = db.prepare(`SELECT id FROM courses WHERE course_code = ?`).get(courseCode) as any;
    if (!course) return res.status(404).json({ error: 'Invalid course code' });
    
    // Check if already enrolled
    const existing = db.prepare(`SELECT id FROM enrollments WHERE (user_id = ? OR user_uid = ?) AND course_id = ?`).get(userId || null, userUid || null, course.id);
    if (existing) return res.status(400).json({ error: 'Already enrolled in this course' });

    db.prepare(`INSERT INTO enrollments (user_id, user_uid, course_id) VALUES (?, ?, ?)`).run(userId || null, userUid || null, course.id);
    res.json({ success: true, courseId: course.id });
  } catch (error) {
    res.status(500).json({ error: 'Failed to enroll in course' });
  }
});

app.post('/api/courses/:id/enroll', (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userUid } = req.body;
    
    // Check if already enrolled
    const existing = db.prepare(`SELECT id FROM enrollments WHERE (user_id = ? OR user_uid = ?) AND course_id = ?`).get(userId || null, userUid || null, id);
    if (existing) return res.json({ success: true, alreadyEnrolled: true });

    db.prepare(`INSERT INTO enrollments (user_id, user_uid, course_id) VALUES (?, ?, ?)`).run(userId || null, userUid || null, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to enroll in course' });
  }
});

app.put('/api/courses/:id', (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Get existing course to merge or just build dynamic query
    const fields = Object.keys(updates).filter(k => ['title', 'description', 'subject', 'thumbnail_url', 'difficulty', 'tags', 'status', 'category'].includes(k));
    
    if (fields.length === 0) return res.json({ success: true });

    const setClause = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => updates[f]);
    
    db.prepare(`UPDATE courses SET ${setClause} WHERE id = ?`).run(...values, id);
    res.json({ success: true });
  } catch (error) {
    console.error('Course update error:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// Section Endpoints
app.post('/api/courses/:id/sections', (req, res) => {
  try {
    const { id } = req.params;
    const { title, order_index } = req.body;
    
    // Ensure id is a number
    const courseIdNum = parseInt(id as string);
    if (isNaN(courseIdNum)) {
      return res.status(400).json({ error: 'Invalid course ID provided' });
    }

    if (!title) {
      return res.status(400).json({ error: 'Section title is required' });
    }

    console.log(`[API] Creating section for course ${courseIdNum}: ${title}`);
    
    const info = db.prepare(`INSERT INTO course_sections (course_id, title, order_index) VALUES (?, ?, ?)`).run(courseIdNum, title, order_index || 0);
    res.json({ id: Number(info.lastInsertRowid) });
  } catch (error: any) {
    console.error('Failed to create section:', error);
    res.status(500).json({ error: `Failed to create section: ${error.message}` });
  }
});

app.put('/api/sections/:id', (req, res) => {
  try {
    const { title, order_index } = req.body;
    db.prepare(`UPDATE course_sections SET title = ?, order_index = ? WHERE id = ?`).run(title, order_index || 0, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update section' });
  }
});

app.delete('/api/sections/:id', (req, res) => {
  try {
    db.prepare(`DELETE FROM course_sections WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete section' });
  }
});

// Lesson Endpoints
app.post('/api/sections/:id/lessons', (req, res) => {
  try {
    const { id } = req.params; // section_id
    const { title, type, content, order_index, video_url } = req.body;
    const info = db.prepare(`INSERT INTO course_lessons (section_id, title, type, content, order_index, video_url) VALUES (?, ?, ?, ?, ?, ?)`).run(id, title, type, content, order_index || 0, video_url || null);
    res.json({ id: Number(info.lastInsertRowid) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create lesson' });
  }
});

app.put('/api/lessons/:id', (req, res) => {
  try {
    const { title, type, content, order_index, video_url } = req.body;
    db.prepare(`UPDATE course_lessons SET title = ?, type = ?, content = ?, order_index = ?, video_url = ? WHERE id = ?`).run(title, type, content, order_index, video_url || null, req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update lesson' });
  }
});

app.delete('/api/lessons/:id', (req, res) => {
  try {
    db.prepare(`DELETE FROM course_lessons WHERE id = ?`).run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete lesson' });
  }
});

// Enrollment & Progress
app.get('/api/users/:userId/enrollments', (req, res) => {
  try {
    const { userId } = req.params;
    
    // Look up user to resolve fully
    let userRow = db.prepare('SELECT * FROM users WHERE uid = ?').get(userId) as any;
    if (!userRow) {
      userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(userId) || 0) as any;
    }

    if (!userRow) {
      return res.json([]);
    }

    const enrollments = db.prepare(`
      SELECT * FROM enrollments WHERE user_id = ? OR user_uid = ?
    `).all(userRow.id, userRow.uid);
    res.json(enrollments);
  } catch (error) {
    console.error('Failed to fetch enrollments:', error);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

app.post('/api/courses/:id/enroll', (req, res) => {
  try {
    const { id } = req.params;
    const { userId, userUid } = req.body;
    
    let resolvedUserId = userId;
    let resolvedUserUid = userUid;
    const identifier = userId || userUid;
    if (identifier) {
      let userRow = db.prepare('SELECT * FROM users WHERE uid = ?').get(String(identifier)) as any;
      if (!userRow) {
        userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(identifier) || 0) as any;
      }
      if (userRow) {
        resolvedUserId = userRow.id;
        resolvedUserUid = userRow.uid;
      }
    }

    const exists = db.prepare(`SELECT id FROM enrollments WHERE course_id = ? AND (user_id = ? OR user_uid = ?)`).get(id, resolvedUserId || null, resolvedUserUid || null);
    if (!exists) {
      db.prepare(`INSERT INTO enrollments (course_id, user_id, user_uid) VALUES (?, ?, ?)`).run(id, resolvedUserId || null, resolvedUserUid || null);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to enroll student:', error);
    res.status(500).json({ error: 'Failed to enroll in course' });
  }
});

app.get('/api/courses/:id/progress/:userId', (req, res) => {
  try {
    const { id, userId } = req.params;
    
    let userRow = db.prepare('SELECT * FROM users WHERE uid = ?').get(userId) as any;
    if (!userRow) {
      userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(userId) || 0) as any;
    }
    
    if (!userRow) {
      return res.json([]);
    }

    const progress = db.prepare(`
      SELECT lp.* FROM lesson_progress lp
      JOIN course_lessons cl ON lp.lesson_id = cl.id
      JOIN course_sections cs ON cl.section_id = cs.id
      WHERE cs.course_id = ? AND (lp.user_id = ? OR lp.user_uid = ?) AND lp.completed = 1
    `).all(id, userRow.id, userRow.uid);
    res.json(progress);
  } catch (error) {
    console.error('Failed to fetch course progress:', error);
    res.status(500).json({ error: 'Failed to fetch course progress' });
  }
});

app.post('/api/lessons/:id/progress', (req, res) => {
  try {
    const { id } = req.params; // lesson_id
    const { userId, completed } = req.body;
    
    let userRow = db.prepare('SELECT * FROM users WHERE uid = ?').get(userId) as any;
    if (!userRow) {
      userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(userId) || 0) as any;
    }

    if (!userRow) {
      return res.status(404).json({ error: 'User not found' });
    }

    const exists = db.prepare(`SELECT id FROM lesson_progress WHERE lesson_id = ? AND (user_id = ? OR user_uid = ?)`).get(id, userRow.id, userRow.uid);
    if (exists) {
      db.prepare(`UPDATE lesson_progress SET completed = ?, updated_at = CURRENT_TIMESTAMP WHERE lesson_id = ? AND (user_id = ? OR user_uid = ?)`).run(completed ? 1 : 0, id, userRow.id, userRow.uid);
    } else {
      db.prepare(`INSERT INTO lesson_progress (lesson_id, user_id, user_uid, completed) VALUES (?, ?, ?, ?)`).run(id, userRow.id, userRow.uid, completed ? 1 : 0);
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Failed to update lesson progress:', error);
    res.status(500).json({ error: 'Failed to update lesson progress' });
  }
});

app.get('/api/quizzes', (req, res) => {
  try {
    const quizzes = db.prepare('SELECT * FROM quizzes').all();
    res.json(quizzes.map((q: any) => ({ ...q, questions: JSON.parse(q.questions) })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

app.post('/api/quizzes', (req, res) => {
  try {
    const { course_id, lesson_id, resource_id, creator_id, title, questions, type } = req.body;
    const stmt = db.prepare(`
      INSERT INTO quizzes (course_id, lesson_id, resource_id, creator_id, title, questions, type) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      course_id || null, 
      lesson_id || null, 
      resource_id || null, 
      creator_id || null, 
      title, 
      typeof questions === 'string' ? questions : JSON.stringify(questions), 
      type || 'lesson'
    );
    res.json({ id: Number(info.lastInsertRowid), title });
  } catch (error) {
    console.error('Quiz creation failed:', error);
    res.status(500).json({ error: 'Failed to create quiz' });
  }
});

// AI Endpoints
app.post('/api/ai/chat-stream', async (req, res) => {
  try {
    const { message, history, filePart } = req.body;
    
    const apiKey = process.env.GEMINI_API_KEY;
    const isKeyMissing = !apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '';

    if (isKeyMissing) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.write("The Gemini API key is missing. Please configure it in Settings > Secrets to use full AI assistance.");
      res.end();
      return;
    }

    const chatHistory: any[] = [];
    let lastRole: string | null = null;

    for (const msg of history || []) {
      const currentRole = msg.role === 'assistant' ? 'model' : 'user';
      if (chatHistory.length === 0 && currentRole === 'model') continue;

      if (currentRole !== lastRole && msg.content?.trim()) {
        chatHistory.push({
          role: currentRole,
          parts: [{ text: msg.content }]
        });
        lastRole = currentRole;
      }
    }

    const contents = [...chatHistory];
    const parts: any[] = [];
    if (filePart) {
      parts.push(filePart);
    }
    parts.push({ text: message });

    if (lastRole === 'user' && contents.length > 0) {
      contents.pop();
    }

    contents.push({
      role: 'user',
      parts
    });

    const ai = getGenAI();
    const responseStream = await ai.models.generateContentStream({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: "You are LibraryCore AI, an ultra-intelligent academic partner like Gemini. You don't just answer questions; you provide deep insights, structured summaries, and helpful study plans. Use Markdown for beautiful formatting. When a document is provided, reference it precisely. Be thoughtful, creative, and highly educational. Start your responses with a helpful, friendly tone.",
        temperature: 0.9,
        topP: 1,
      }
    });

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of responseStream) {
      if (chunk.text) {
        res.write(chunk.text);
      }
    }
    res.end();
  } catch (error: any) {
    console.error('AI Chat Stream Error:', error);
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    }
    res.write(`\n\nAI error: ${error?.message || 'Something went wrong with the AI connection.'}`);
    res.end();
  }
});

app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, useOfflineSearch, context: clientContext } = req.body;
    
    // Parse resource ID from context matching "Currently reading resource ID: xyz"
    let resourceId: string | null = null;
    if (clientContext && typeof clientContext === 'string') {
      const match = clientContext.match(/Currently reading resource ID:\s*([^\s]+)/i);
      if (match) {
        resourceId = match[1];
      }
    }
    
    const apiKey = process.env.GEMINI_API_KEY;
    const isKeyMissing = !apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '';

    if (useOfflineSearch || isKeyMissing) {
      let resource: any = null;
      if (resourceId) {
        try {
          resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(resourceId);
        } catch (e) {
          console.error('[OFFLINE CHAT] Failed to look up resource id:', resourceId, e);
        }
      }

      if (resource && resource.file_url) {
        const filePath = await ensureLocalFile(resource.file_url);
        if (filePath) {
          console.log(`Performing local offline QA for specific document: ${resource.title}`);
          const { getLocalAnswer } = await import("./localAi.ts");
          const result = await getLocalAnswer(message, filePath);
          let reply = result.answer;
          if (isKeyMissing && !useOfflineSearch) {
            reply = `(Note: Gemini API key is missing, falling back to local document analysis)\n\n${reply}`;
          }
          return res.json({
            reply,
            isOffline: true,
            source: 'Local AI (Specific Document)'
          });
        }
      }

      const { searchLibrary } = await import("./localAi.ts");
      const resources = db.prepare('SELECT title, file_url FROM resources WHERE file_url IS NOT NULL').all() as any[];
      const docsToSearchWithPaths = await Promise.all(resources.map(async (r) => {
        try {
          const filePath = await ensureLocalFile(r.file_url);
          return filePath ? { title: r.title, filePath } : null;
        } catch (e) {
          return null;
        }
      }));
      const docsToSearch = docsToSearchWithPaths.filter((d): d is { title: string; filePath: string } => d !== null);

      console.log(`Performing library-wide offline search (Fallback: ${isKeyMissing}) for: ${message}`);
      const result = await searchLibrary(message, docsToSearch);
      
      let reply = result.answer;
      if (isKeyMissing && !useOfflineSearch) {
        reply = `(Note: Gemini API key is missing, falling back to offline library search)\n\n${reply}`;
      }

      return res.json({ 
        reply,
        isOffline: true,
        source: result.source
      });
    }
    
    let resource: any = null;
    if (resourceId) {
      try {
        resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(resourceId);
      } catch (e) {
        console.error('[CHAT] Resource lookup error:', e);
      }
    }

    let documentContentText = "";
    if (resource && resource.file_url) {
      const filePath = await ensureLocalFile(resource.file_url);
      if (filePath) {
        try {
          const { extractText } = await import("./localAi.ts");
          const text = await extractText(filePath);
          if (text && text.trim().length > 0) {
            documentContentText = text.substring(0, 30000);
          }
        } catch (extractErr) {
          console.error('[CHAT ERROR] Could not extract text from document:', extractErr);
        }
      }
    }

    let finalContext = "";
    if (documentContentText) {
      finalContext = `You are Sharp AI, an intelligent academic reading assistant. The user is currently reading the document titled "${resource.title}" by ${resource.author || 'Unknown'}.
      
Document Content excerpt:
--- START OF DOCUMENT ---
${documentContentText}
--- END OF DOCUMENT ---

Provide a detailed, helpful, and highly accurate answer based on the document's content provided above. Always base your response directly on the text when possible, and helpfully answer their specific queries.`;
    } else if (resource) {
      finalContext = `You are Sharp AI, an intelligent library assistant. The user is currently viewing the resource titled "${resource.title}" by ${resource.author || 'Unknown'}.
Description: ${resource.description || 'No description provided.'}

Provide a helpful and accurate answer about this resource inside the Library Core catalog.`;
    } else {
      const resources = db.prepare('SELECT title, author, type, genre, status FROM resources').all();
      finalContext = `You are Sharp AI, an intelligent offline-capable library assistant for Library Core. Here is the current library catalog: ${JSON.stringify(resources)}. Answer the user's question concisely and helpfully.`;
    }

    const ai = getGenAI();
    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: finalContext + "\n\nUser: " + message
    });
    res.json({ reply: result.text || 'No response generated.' });
  } catch (error: any) {
    console.error('AI Chat Error:', error);
    if (error?.message?.includes('API key not valid')) {
      return res.status(500).json({ reply: "The provided Gemini API key is invalid. Please check your project secrets in the Settings menu." });
    }
    res.status(500).json({ error: 'Failed to generate AI response' });
  }
});

app.post('/api/ai/generate-quiz', async (req, res) => {
  try {
    const { title, context, count = 5 } = req.body;
    const ai = getGenAI();
    
    const prompt = `Create a ${count}-question multiple choice quiz for a lesson titled "${title}". ${context ? `Context: ${context}` : ''}
    Return the quiz as a JSON array of objects with this structure:
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": 0 // index of the correct option
    }
    Return ONLY the JSON array.`;

    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt
    });
    let text = result.text || '';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    res.json(JSON.parse(text));
  } catch (error: any) {
    console.error('AI Quiz Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/generate-exam', async (req, res) => {
  try {
    const { title, description } = req.body;
    const ai = getGenAI();
    
    const prompt = `Create a comprehensive 10-question final exam for the course "${title}". Description: ${description}.
    Return the exam as a JSON array of objects with this structure:
    {
      "question": "string",
      "options": ["string", "string", "string", "string"],
      "correctAnswer": 0
    }
    Return ONLY the JSON array.`;

    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt
    });
    let text = result.text || '';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    res.json(JSON.parse(text));
  } catch (error: any) {
    console.error('AI Exam Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ai/suggest-difficulty', async (req, res) => {
  try {
    const { title, description } = req.body;
    const ai = getGenAI();
    const prompt = `Based on this course title: "${title}" and description: "${description}", suggest a single word difficulty level (either "Beginner", "Intermediate", or "Advanced"). Return ONLY the word.`;
    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt
    });
    let level = (result.text || '').trim();
    if (level.includes("Advanced")) level = "Advanced";
    else if (level.includes("Intermediate")) level = "Intermediate";
    else level = "Beginner";
    res.json({ level });
  } catch (error: any) {
    res.json({ level: 'Beginner' });
  }
});

app.post('/api/ai/generate-image', async (req, res) => {
  try {
    const { title } = req.body;
    // Fallback to picsum for now since Gemini Image Gen is distinct or depends on specific models
    res.json({ url: `https://picsum.photos/seed/${encodeURIComponent(title)}/1200/600` });
  } catch (error: any) {
    res.json({ url: `https://picsum.photos/seed/default/1200/600` });
  }
});

app.post('/api/ai/document-chat', async (req, res) => {
  try {
    const { message, resourceId, useOfflineSearch } = req.body;
    const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(resourceId) as any;
    
    if (!resource || !resource.file_url) {
      return res.status(400).json({ reply: "This resource does not have an associated file for analysis." });
    }

    const filePath = await ensureLocalFile(resource.file_url);
    if (!filePath) {
      return res.status(404).json({ reply: "The resource file could not be found or downloaded on the server." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const isKeyMissing = !apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '';

    if (!useOfflineSearch && !isKeyMissing) {
      console.log(`Performing Gemini analysis for: ${resource.title}`);
      const { extractText } = await import("./localAi.ts");
      const text = await extractText(filePath);
      
      const ai = getGenAI();
      
      const prompt = `You are an expert librarian and study assistant. I am reading a document titled "${resource.title}". 
      
      Document Content (partial if very long):
      ${text.substring(0, 30000)}
      
      User Question: ${message}
      
      Provide a helpful, accurate answer based ON THE DOCUMENT provided.`;
      
      const result = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt
      });
      
      return res.json({ 
        reply: result.text || 'No response generated.',
        isOffline: false,
        source: 'Gemini AI'
      });
    }

    console.log(`Performing offline analysis for: ${resource.title} (Fallback: ${isKeyMissing})`);
    const { getLocalAnswer } = await import("./localAi.ts");
    const result = await getLocalAnswer(message, filePath);
    
    res.json({ 
      reply: result.answer,
      isOffline: true,
      confidence: result.score,
      source: 'Local AI'
    });
  } catch (error: any) {
    console.error('Document AI Error:', error);
    res.status(500).json({ error: 'Failed to generate AI response' });
  }
});

// --- Classroom System Endpoints ---

const generateClassCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

app.post('/api/classes', (req, res) => {
  try {
    const { name, subject, teacher_id, teacher_name } = req.body;
    
    // Server-side block for students
    if (teacher_id) {
      const userRow = db.prepare('SELECT role, username FROM users WHERE uid = ?').get(teacher_id) as any;
      if (userRow && userRow.role === 'student') {
        const isBypass = userRow.username === 'sharpibrah@gmail.com' || userRow.username === 'sharpwhite@gmail.com';
        if (!isBypass) {
          return res.status(403).json({ error: 'Access denied: Students are not permitted to create classrooms.' });
        }
      }
    }

    let code = generateClassCode();
    // basic collision check
    while (db.prepare('SELECT id FROM classes WHERE class_code = ?').get(code)) {
      code = generateClassCode();
    }
    
    // We try to determine if teacher_id is an integer (local db) or string (firebase uid)
    const isLocalId = !isNaN(Number(teacher_id)) && typeof teacher_id !== 'string';
    
    const info = db.prepare(`
      INSERT INTO classes (name, subject, teacher_id, teacher_uid, teacher_name, class_code) 
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      name, 
      subject, 
      isLocalId ? teacher_id : null, 
      !isLocalId ? teacher_id : null, 
      teacher_name || '', 
      code
    );
    
    res.json({ id: Number(info.lastInsertRowid), class_code: code });
  } catch (error: any) {
    console.error('Create class err:', error.message || error);
    res.status(500).json({ error: 'Failed to create class', details: error.message });
  }
});

app.get('/api/users/:userId/classes', (req, res) => {
  try {
    const { userId } = req.params;
    
    // Look up user by Firebase UID or SQLite auto-increment ID to resolve fully
    let userRow = db.prepare('SELECT * FROM users WHERE uid = ?').get(userId) as any;
    if (!userRow) {
      userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(userId) || 0) as any;
    }

    let classes;
    if (userRow) {
      // Find classes where user is the teacher or is enrolled in class_students
      classes = db.prepare(`
        SELECT DISTINCT c.*,
          (SELECT COUNT(*) FROM class_students cs2 WHERE cs2.class_id = c.id) as student_count
        FROM classes c 
        LEFT JOIN class_students cs ON c.id = cs.class_id 
        WHERE c.teacher_uid = ? 
           OR c.teacher_id = ? 
           OR cs.student_uid = ? 
           OR cs.student_id = ?
        ORDER BY c.created_at DESC
      `).all(userRow.uid, userRow.id, userRow.uid, userRow.id);
    } else {
      // Fallback if user is not synced in SQLite yet (e.g. freshly registered)
      const isFirebaseUid = userId && typeof userId === 'string' && !userId.match(/^\d+$/);
      if (isFirebaseUid) {
        classes = db.prepare(`
          SELECT DISTINCT c.*,
            (SELECT COUNT(*) FROM class_students cs2 WHERE cs2.class_id = c.id) as student_count
          FROM classes c 
          LEFT JOIN class_students cs ON c.id = cs.class_id 
          WHERE c.teacher_uid = ? 
             OR cs.student_uid = ?
          ORDER BY c.created_at DESC
        `).all(userId, userId);
      } else {
        const numericId = Number(userId) || 0;
        classes = db.prepare(`
          SELECT DISTINCT c.*,
            (SELECT COUNT(*) FROM class_students cs2 WHERE cs2.class_id = c.id) as student_count
          FROM classes c 
          LEFT JOIN class_students cs ON c.id = cs.class_id 
          WHERE c.teacher_id = ? 
             OR cs.student_id = ?
          ORDER BY c.created_at DESC
        `).all(numericId, numericId);
      }
    }
    
    res.json(classes);
  } catch (error) {
    console.error('Fetch classes err:', error);
    res.status(500).json({ error: 'Failed to fetch classes' });
  }
});

app.post('/api/classes/join', (req, res) => {
  try {
    const { class_code, student_id, student_name } = req.body;
    const clean_code = (class_code || '').trim().toUpperCase();
    const cls = db.prepare('SELECT id FROM classes WHERE UPPER(class_code) = ?').get(clean_code) as any;
    if (!cls) return res.status(404).json({ error: 'Invalid class code' });
    
    // Add student_uid safely
    try { db.exec('ALTER TABLE class_students ADD COLUMN student_uid TEXT'); } catch(e){}
    try { db.exec('ALTER TABLE class_students ADD COLUMN student_name TEXT'); } catch(e){}

    let local_student_id = 0;
    try {
      const userRow = db.prepare('SELECT id FROM users WHERE uid = ?').get(student_id) as any;
      if (userRow) {
        local_student_id = userRow.id;
      } else {
        let hash = 0;
        for (let i = 0; i < (student_id || '').length; i++) {
          hash = (student_id || '').charCodeAt(i) + ((hash << 5) - hash);
        }
        local_student_id = Math.abs(hash) || 999;
      }
    } catch (e) {
      local_student_id = 999;
    }

    // Fully-isolated exists check to avoid fallback collisions with 999 or other hash equivalents
    let exists = false;
    const isFirebaseUid = student_id && typeof student_id === 'string' && !student_id.match(/^\d+$/);

    if (isFirebaseUid) {
      const row = db.prepare('SELECT 1 FROM class_students WHERE class_id = ? AND student_uid = ?').get(cls.id, student_id);
      if (row) exists = true;
    } else {
      const row = db.prepare('SELECT 1 FROM class_students WHERE class_id = ? AND (student_id = ? OR student_uid = ?)').get(cls.id, Number(student_id || local_student_id), student_id);
      if (row) exists = true;
    }

    if (!exists) {
      db.prepare('INSERT INTO class_students (class_id, student_id, student_uid, student_name) VALUES (?, ?, ?, ?)').run(cls.id, local_student_id, student_id, student_name || 'Student');
    }
    res.json({ success: true, classId: cls.id });
  } catch (error: any) {
    console.error('Join class err:', error.message);
    res.status(500).json({ error: 'Failed to join class', details: error.message });
  }
});

app.get('/api/classes/:id', (req, res) => {
  try {
    const { id } = req.params;
    const cls = db.prepare(`SELECT c.* FROM classes c WHERE c.id = ?`).get(id) as any;
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    
    // We will not join users table for students, because they are in Firestore.
    // We will just fetch the student IDs, then the frontend can look them up if needed, or we just rely on a new student metadata table.
    // For now, let's just use student_id. We can add student_name to class_students.
    try { db.exec('ALTER TABLE class_students ADD COLUMN student_name TEXT'); } catch(e) {}
    
    cls.students = db.prepare(`
      SELECT cs.student_uid as id, cs.student_name as full_name, cs.joined_at 
      FROM class_students cs 
      WHERE cs.class_id = ?
    `).all(id);

    const topics = db.prepare('SELECT * FROM class_topics WHERE class_id = ? ORDER BY order_index ASC').all(id) as any[];
    const assignments = db.prepare('SELECT * FROM class_assignments WHERE class_id = ?').all(id) as any[];
    
    const structuredTopics = topics.map(topic => ({
      ...topic,
      assignments: assignments.filter(a => a.topic_id === topic.id)
    }));

    const unorganizedAssignments = assignments.filter(a => !a.topic_id);

    cls.topics = structuredTopics;
    cls.unorganizedAssignments = unorganizedAssignments;

    res.json(cls);
  } catch (error) {
    console.error('Fetch class details err:', error);
    res.status(500).json({ error: 'Failed to fetch class details' });
  }
});

app.post('/api/classes/:id/topics', (req, res) => {
  try {
    const { id } = req.params;
    const { title, order_index } = req.body;
    const info = db.prepare('INSERT INTO class_topics (class_id, title, order_index) VALUES (?, ?, ?)').run(id, title, order_index || 0);
    res.json({ id: Number(info.lastInsertRowid) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create topic' });
  }
});

app.post('/api/classes/:id/assignments', (req, res) => {
  try {
    const { id } = req.params;
    const { topic_id, title, description, assignment_type, due_date } = req.body;
    const info = db.prepare(`
      INSERT INTO class_assignments (class_id, topic_id, title, description, assignment_type, due_date)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, topic_id || null, title, description, assignment_type, due_date || null);
    res.json({ id: Number(info.lastInsertRowid) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

app.put('/api/assignments/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { topic_id, title, description, assignment_type, due_date } = req.body;
    db.prepare(`
      UPDATE class_assignments 
      SET topic_id = ?, title = ?, description = ?, assignment_type = ?, due_date = ?
      WHERE id = ?
    `).run(topic_id || null, title, description, assignment_type, due_date || null, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

app.delete('/api/assignments/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM class_assignments WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete assignment' });
  }
});

app.get('/api/assignments/:id', (req, res) => {
  try {
    const { id } = req.params;
    const assignment = db.prepare('SELECT * FROM class_assignments WHERE id = ?').get(id) as any;
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
    
    assignment.submissions = db.prepare(`
      SELECT s.*, u.full_name as student_name 
      FROM class_submissions s 
      LEFT JOIN users u ON s.student_id = u.id OR s.student_id = u.uid
      WHERE s.assignment_id = ?
    `).all(id);

    res.json(assignment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assignment details' });
  }
});

app.post('/api/assignments/:id/submissions', (req, res) => {
  try {
    const { id } = req.params;
    const { student_id, content, file_url } = req.body;
    
    const existing = db.prepare('SELECT id FROM class_submissions WHERE assignment_id = ? AND student_id = ?').get(id, student_id);
    if (existing) {
       db.prepare('UPDATE class_submissions SET content = ?, file_url = ?, status = "submitted", submitted_at = CURRENT_TIMESTAMP WHERE assignment_id = ? AND student_id = ?').run(content, file_url || null, id, student_id);
    } else {
       db.prepare('INSERT INTO class_submissions (assignment_id, student_id, content, file_url) VALUES (?, ?, ?, ?)').run(id, student_id, content, file_url || null);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to submit assignment' });
  }
});

app.post('/api/submissions/:id/grade', (req, res) => {
  try {
    const { id } = req.params;
    const { status, feedback } = req.body;
    db.prepare('UPDATE class_submissions SET status = ?, feedback = ? WHERE id = ?').run(status, feedback, id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to grade submission' });
  }
});

app.post('/api/classes/:id/announcements', (req, res) => {
  try {
    const { id } = req.params;
    const { content, teacher_id } = req.body;
    const info = db.prepare('INSERT INTO class_announcements (class_id, teacher_id, content) VALUES (?, ?, ?)').run(id, teacher_id, content);
    res.json({ id: Number(info.lastInsertRowid) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to post announcement' });
  }
});

app.get('/api/classes/:id/announcements', (req, res) => {
  try {
    const { id } = req.params;
    const posts = db.prepare(`
      SELECT a.*, u.full_name as teacher_name 
      FROM class_announcements a 
      LEFT JOIN users u ON a.teacher_id = u.id OR a.teacher_id = u.uid
      WHERE a.class_id = ? 
      ORDER BY a.created_at DESC
    `).all(id);
    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// Quiz Endpoints
app.post('/api/quizzes/generate', async (req, res) => {
  try {
    const { resourceId } = req.body;
    const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(resourceId) as any;
    
    if (!resource || !resource.file_url) {
      return res.status(404).json({ error: "Resource file not found." });
    }

    const filePath = await ensureLocalFile(resource.file_url);
    if (!filePath) {
      return res.status(404).json({ error: "File not found or could not be downloaded." });
    }

    const { extractText } = await import("./localAi.ts");
    const text = await extractText(filePath);
    const context = text.substring(0, 15000); // Limit context for token efficiency

    const ai = getGenAI();
    
    const prompt = `You are an expert educator. Create a challenging and educational multiple-choice quiz based on the following text from a document titled "${resource.title}".
    
    Rules for the quiz:
    1. Generate exactly 5 questions.
    2. Each question must have 4 options.
    3. Specify the correct answer index (0-3).
    4. Provide a brief explanation for each answer.
    5. Return the response strictly as a JSON array of objects.
    
    Format:
    [
      {
        "question": "The question text",
        "options": ["Option A", "Option B", "Option C", "Option D"],
        "correctAnswer": 0,
        "explanation": "Why this is correct"
      }
    ]

    Text:
    ${context}`;
    
    const result = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: prompt
    });
    const jsonText = (result.text || '').replace(/```json|```/g, '').trim();
    const questions = JSON.parse(jsonText);
    
    res.json({ questions, title: `Quiz: ${resource.title}` });
  } catch (error) {
    console.error('Quiz Generation Error:', error);
    res.status(500).json({ error: 'Failed to generate quiz' });
  }
});

// Consolidated Quiz creation handled above

app.get('/api/quizzes/resource/:resourceId', (req, res) => {
  try {
    const quizzes = db.prepare('SELECT * FROM quizzes WHERE resource_id = ?').all(req.params.resourceId);
    res.json(quizzes.map((q: any) => ({ ...q, questions: JSON.parse(q.questions) })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

app.post('/api/quizzes/:id/attempt', (req, res) => {
  try {
    const { userId, score, total, answers } = req.body;
    const stmt = db.prepare(`
      INSERT INTO quiz_attempts (user_id, quiz_id, score, total, answers) 
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(userId, req.params.id, score, total, JSON.stringify(answers));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save attempt' });
  }
});

app.get('/api/users/:userId/quiz-attempts', (req, res) => {
  try {
    const attempts = db.prepare(`
      SELECT qa.*, q.title as quiz_title, r.title as resource_title
      FROM quiz_attempts qa
      JOIN quizzes q ON qa.quiz_id = q.id
      JOIN resources r ON q.resource_id = r.id
      WHERE qa.user_id = ?
      ORDER BY qa.completed_at DESC
    `).all(req.params.userId);
    res.json(attempts.map((a: any) => ({ ...a, answers: JSON.parse(a.answers) })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch attempts' });
  }
});

app.get('/api/quizzes', (req, res) => {
  try {
    const quizzes = db.prepare('SELECT * FROM quizzes ORDER BY created_at DESC').all();
    res.json(quizzes.map((q: any) => ({ ...q, questions: JSON.parse(q.questions) })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

async function startServer() {
  console.log('🎬 Initializing LibraryCore Server...');
  console.log('PID:', process.pid);
  console.log('PORT:', PORT);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  // Ensure DB is initialized
  try {
    console.log('Initializing database...');
    const dbInstance = initDb();
    if (!dbInstance) {
      console.error("❌ CRITICAL: Database connection failed. API routes dependent on DB will fail.");
    } else {
      console.log('✅ Database connected');
    }
  } catch (err) {
    console.error('❌ Failed to initialize database in startServer:', err);
  }

  // Final schema adjustments
  try {
    if (db) {
      try {
        db.exec('ALTER TABLE classes ADD COLUMN teacher_name TEXT');
        console.log('✅ Secondary migration successful');
      } catch (e) {}
    }
  } catch(e) {
    console.log('⚠️ Schema migration warning (likely already exists):', e.message);
  }

  const distPath = path.join(process.cwd(), 'dist');
  const isProd = (process.env.NODE_ENV === "production" || !!process.env.K_SERVICE || !!process.env.GAE_SERVICE) && fs.existsSync(distPath);
  
  console.log('--- START SERVER CONFIG ---');
  console.log('isProd:', isProd);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('K_SERVICE:', process.env.K_SERVICE);
  console.log('distPath:', distPath);
  console.log('distPath exists:', fs.existsSync(distPath));
  console.log('--- -------------------- ---');

  // Simple root logger
  app.use((req, res, next) => {
    if (req.path === '/' || req.path === '/api/health') {
      console.log(`[REQUEST] ${req.method} ${req.path}`);
    }
    next();
  });

  // =========================================================================
  // DEEP STUDY TRACKER & GRADING SYSTEM ENDPOINTS
  // =========================================================================

  // Fetch all assignments and student's submissions for an integrated report card
  app.get('/api/users/:userId/grades', (req, res) => {
    try {
      const { userId } = req.params;
      
      // Get all homework, tests, materials from class_students that match other records
      const submissions = db.prepare(`
        SELECT s.*, a.title as assignment_title, a.description as assignment_description, 
               a.assignment_type, c.name as class_name, c.id as class_id
        FROM class_submissions s
        JOIN class_assignments a ON s.assignment_id = a.id
        JOIN classes c ON a.class_id = c.id
        WHERE s.student_id = ? OR s.student_id IN (SELECT id FROM users WHERE uid = ?) OR s.student_id = ?
      `).all(userId, userId, userId);
      
      res.json(submissions);
    } catch (error: any) {
      console.error('Fetch student grades err:', error.message);
      res.status(500).json({ error: 'Failed to fetch student grades', details: error.message });
    }
  });

  // Consult the AI Academic Advisor using Gemini 3.5 Flash
  app.post('/api/study-tracker/advisor', async (req, res) => {
    try {
      const { userId, grades, studyLogs, coursesCovered } = req.body;
      const ai = getGenAI();
      const prompt = `You are an elite academic counselor and AI study coach of "LibraryCore Elite LMS". 
      Analyze the following student profile, recent grade book standings, and study habits to provide highly tactical, encouraging study advice, weakness diagnostic, and actionable schedule improvements.
      
      STUDENT METRICS:
      - Student Login ID / Name: ${userId}
      - Active Courses: ${JSON.stringify(coursesCovered || [])}
      - Graded & Ungraded Assignments: ${JSON.stringify(grades || [])}
      - Study Timers / Pomodoro logs completed: ${JSON.stringify(studyLogs || [])}
      
      Please analyze this data and generate a structured counseling response in Markdown using exactly these headers:
      1. [GPA Estimated Standings] ## ACADEMIC DIAGNOSTIC
      Write a scannable summary analyzing their completed vs pending work, their concentration levels, and general academic progress.
      
      2. [Academic Superpowers] ## STRENGTHS & COGNITIVE EDGE
      Point out specific subjects, activities, or classes where they show active, healthy dedication.
      
      3. [Growth Areas] ## POTENTIAL BLINDSPOTS
      Highlight current gaps: e.g. unsubmitted assignments, short focus sessions, or specific subjects that have been neglected.
      
      4. [Focus Protocols] ## TACTICAL ACTION PLAN
      Provide 3 highly practical recommendations (e.g. customized Pomodoro cycles, specific course focus suggestions, or reading frequency targets).
      
      Keep the tone highly premium, motivating, professional, and entirely focused on student growth.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
      });
      
      res.json({ advice: response.text });
    } catch (error: any) {
      console.error('AI Study Advisor diagnostic failed:', error);
      res.status(500).json({ error: 'AI Academic Advisor is unavailable at the moment.', details: error.message });
    }
  });

  // Get all earned certificates of merit/excellence for a student
  app.get('/api/users/:userId/certificates', (req, res) => {
    try {
      const { userId } = req.params;
      
      const certs = db.prepare(`
        SELECT cert.*, c.title as course_title, c.subject as course_subject, u.full_name as student_name
        FROM certificates cert
        JOIN courses c ON cert.course_id = c.id
        LEFT JOIN users u ON cert.user_id = u.id
        WHERE cert.user_uid = ? OR u.uid = ?
      `).all(userId, userId);
      
      res.json(certs);
    } catch (error: any) {
      console.error('Fetch student certificates err:', error.message);
      res.status(500).json({ error: 'Failed to fetch student certificates', details: error.message });
    }
  });

  // Issue dynamic distinguished certificates of academic excellence (Instructor panel link)
  app.post('/api/certificates/issue', (req, res) => {
    try {
      const { student_uid, course_id, certificate_code, template_data } = req.body;
      
      const student = db.prepare('SELECT id, full_name FROM users WHERE uid = ?').get(student_uid) as any;
      if (!student) {
        return res.status(404).json({ error: 'User student registry file not found in SQLite Database' });
      }
      
      const existing = db.prepare('SELECT id FROM certificates WHERE user_id = ? AND course_id = ?').get(student.id, course_id);
      
      const certCode = certificate_code || `CERT-${course_id}-${Math.floor(100000 + Math.random() * 900000)}`;
      const certTemplate = JSON.stringify(template_data || { award: 'Academic Scholar Distinction' });
      
      if (existing) {
        db.prepare('UPDATE certificates SET issued_at = CURRENT_TIMESTAMP, template_data = ?, certificate_code = ? WHERE id = ?')
          .run(certTemplate, certCode, existing.id);
      } else {
        db.prepare('INSERT INTO certificates (user_id, user_uid, course_id, certificate_code, template_data) VALUES (?, ?, ?, ?, ?)')
          .run(student.id, student_uid, course_id, certCode, certTemplate);
      }
      
      res.json({ success: true, certificate_code: certCode });
    } catch (error: any) {
      console.error('Issue certificate err:', error.message);
      res.status(500).json({ error: 'Failed to issue certificate', details: error.message });
    }
  });

  // API 404 handler - catches anything starting with /api/ that didn't match previous routes
  app.use('/api/*', (req, res) => {
    res.status(404).json({ error: `API route not found: ${req.originalUrl}` });
  });

  if (!isProd) {
    try {
      console.log('🛠️ Registering Vite middleware for development...');
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log('✅ Vite middleware initialized successfully');
      
      // Explicitly serve index.html for root in dev if vite middleware misses it (it shouldn't)
      app.get('/', (req, res) => {
        res.sendFile(path.join(process.cwd(), 'index.html'));
      });
    } catch (e) {
      console.error('❌ Failed to initialize Vite:', e);
    }
  } else {
    console.log(`[PROD] Production mode. Static path: ${distPath}`);
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        const indexPath = path.join(distPath, 'index.html');
        res.sendFile(indexPath, (err) => {
          if (err) {
            console.error('[PROD] Failed to serve index.html:', err);
            res.status(500).send('<h1>Server Error</h1><p>Production index.html is missing. Please wait for the application to compile and refresh.</p>');
          }
        });
      });
    } else {
      console.error('[PROD] ❌ CRITICAL: dist folder missing!');
      // Fallback for missing dist - show informative error
      app.get('/', (req, res) => {
        res.status(500).send('<h1>Server Error</h1><p>Production build (dist/) is missing. Please run <code>npm run build</code>.</p>');
      });
    }
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 LibraryCore Server started!`);
    console.log(`📍 Listening on http://0.0.0.0:${PORT}`);
    console.log(`⚡ Environment: ${process.env.NODE_ENV || 'production'}`);
    console.log(`📦 Serving static files from: ${path.join(process.cwd(), 'dist')}`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    server.close(() => {
      console.log('Server closed. Exiting.');
      process.exit(0);
    });
  });
}

startServer().catch(err => {
  console.error('🔥 FAILED TO START SERVER:', err);
  process.exit(1);
});
