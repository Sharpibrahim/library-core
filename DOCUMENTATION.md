# Academic Library Elite: Full Software Documentation

## 1. Project Overview
**Academic Library Elite** is a premier, AI-powered educational ecosystem designed for students, teachers, and school administrators. It transcends traditional digital libraries by integrating generative AI, interactive study tools, and a full Learning Management System (LMS) into a single, high-performance interface.

---

## 2. Core Modules & Features

### 2.1 The Study Hub (Personal Dashboard)
The "heart" of the user experience. The Study Hub provides a personalized command center for every student.
*   **Academic Stats**: Real-time tracking of books read, study streaks, and average quiz scores.
*   **Resume Reading**: A visual "Pick up where you left off" section with progress bars for recently accessed books.
*   **Scholar Ranking**: A gamified leaderboard that encourages consistent study habits.
*   **Study Sets**: Quick access to curated collections of resources organized by subject or exam prep.

### 2.2 The Universal Library
A high-performance catalog for searching and discovering academic assets.
*   **Smart Search (AI-Powered)**: Beyond keywords, use the "Brain" icon to perform semantic searches. You can ask AI things like "find me something about relativity" and it will find relevant resources across different subjects.
*   **Tiered Filtering**: 
    *   **Class Levels**: Filter specifically for S1 through S6 levels.
    *   **Main Categories**: Quick tabs for Past Papers, Videos, Notes, and Subjects.
    *   **Subject Filtering**: Dedicated sidebar for refining by Mathematics, Physics, Humanities, etc.
*   **Flexible View Modes**: Switch between a dense "List View" for research and an immersive "Grid View" for browsing.

### 2.3 Advanced Scholar Reader (The Viewing Engine)
A world-class document and video viewer designed for deep focus.
*   **Universal Compatibility**: Seamlessly handles high-resolution PDFs and integrated YouTube video analysis.
*   **Viewing Controls**:
    *   **90° Rotation**: Fix scanned documents or view landscape charts easily.
    *   **Scale & Zoom**: Range from 50% to 300% for perfect legibility.
    *   **Fullscreen Mode**: Removes browser distractions for focused study.
    *   **High-Quality Print**: Specialized CSS ensures documents print sharply with a single click.

### 2.4 Genius AI Assistant
A context-aware AI (Gemini 3.0) integrated directly into the reading experience.
*   **AI Smart Summarize**: Get a 1-click breakdown of any page.
*   **Academic Terms Expander**: Instantly explains complex jargon found on the current page.
*   **AI Quiz Generator ("Test Me")**: Generates interactive multiple-choice quizzes based on the specific page the user is currently viewing to test understanding.
*   **Sharp AI Chat**: A persistent sidebar chat that "remembers" the resource you are viewing for deep discussion.

### 2.5 Collaborative & Study Tools
Features designed to help students retain information.
*   **Study Notes**: Add personal insights directly to any page. Notes are saved with page contexts and timestamps.
*   **Study Marks (Highlights)**: Select text and "Mark" it. These are indexed in a dedicated sidebar for rapid navigation.
*   **Bookmarks**: Quickly tag pages you need to return to.
*   **Direct Messaging (Expert Chat)**: Connect with teachers or students directly within the platform.

### 2.6 Academic LMS Control
Comprehensive tools for managing a digital classroom.
*   **Classrooms**: Create and join physical or virtual classes with unique class codes.
*   **Assignment Management**: Post tasks, due dates, and track student submissions.
*   **Course Builder**: Teachers can create structured courses with sections and lessons.
*   **Progress Tracking**: Full analytics for teacher oversight on student performance.

---

## 3. Advanced Settings & Performance

### 3.1 Adaptive Interface
*   **Glassmorphism Design**: A modern, premium aesthetic using depth, blur, and 3D effects.
*   **Dark/Light Mode**: Full system-wide theme support to reduce eye strain during late-night study sessions.
*   **Mobile Scaling**: Fully responsive design that works on tablets and phones.

### 3.2 Accessibility
*   **Voice Control**: Navigate the entire platform (Library, Dashboard, Upload) using voice commands.
*   **Command Palette (Ctrl/Cmd + K)**: A global search and navigation bar for power users.

### 3.3 Offline & Availability
*   **Smart Caching**: Mark resources as "Available Offline." The software will store them in the browser's persistent cache so they can be read even without an internet connection.
*   **Auto-Sync**: Your notes, progress, and marks are automatically synced to the cloud whenever you are online.

---

## 4. Technical Architecture
*   **Frontend**: React 18, Vite, Tailwind CSS, Motion (Animations).
*   **Backend**: Node.js, Express (File uploads and server-side processing).
*   **Database**: Firebase Firestore (Real-time data) & Firebase Auth (Secure login).
*   **AI Engine**: Google Gemini Pro (via @google/genai SDK).
*   **PDF Engine**: PDF.js & React-PDF.

---

## 5. User Roles & Permissions

| Feature | Student | Teacher | Admin |
| :--- | :---: | :---: | :---: |
| Read Resources | ✓ | ✓ | ✓ |
| Add Notes/Marks | ✓ | ✓ | ✓ |
| Create Quiz | AI-Only | Manual + AI | ✓ |
| Upload Resources | (Optional) | ✓ | ✓ |
| Create Classrooms | ✗ | ✓ | ✓ |
| Manage All Users | ✗ | ✗ | ✓ |

---

*Academic Library Elite Version 2.0 - "The Scholar's Node"*
