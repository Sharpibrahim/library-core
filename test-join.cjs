const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.cwd(), 'library.db');
const db = new Database(dbPath);

console.log('Testing join with class_code 1RP63U...');

try {
  const class_code = '1RP63U';
  const student_id = 'GHdSP4E35uOydbWrpdC0bYLN2Di1';
  const student_name = 'test';

  const clean_code = (class_code || '').trim().toUpperCase();
  const cls = db.prepare('SELECT id FROM classes WHERE UPPER(class_code) = ?').get(clean_code);
  console.log('Class found:', cls);

  if (!cls) {
    console.error('Class not found!');
    process.exit(1);
  }

  // Check columns of class_students
  try {
    db.exec('ALTER TABLE class_students ADD COLUMN student_uid TEXT');
  } catch (e) {
    console.log('student_uid column already exists or error:', e.message);
  }
  try {
    db.exec('ALTER TABLE class_students ADD COLUMN student_name TEXT');
  } catch (e) {
    console.log('student_name column already exists or error:', e.message);
  }

  let local_student_id = 0;
  const userRow = db.prepare('SELECT id FROM users WHERE uid = ?').get(student_id);
  if (userRow) {
    local_student_id = userRow.id;
  }
  console.log('Local student id mapped:', local_student_id);

  let exists = false;
  const isFirebaseUid = student_id && typeof student_id === 'string' && !student_id.match(/^\d+$/);
  console.log('isFirebaseUid:', isFirebaseUid);

  if (isFirebaseUid) {
    const row = db.prepare('SELECT 1 FROM class_students WHERE class_id = ? AND student_uid = ?').get(cls.id, student_id);
    if (row) exists = true;
  }

  console.log('Exists check result:', exists);

  if (!exists) {
    const runResult = db.prepare('INSERT INTO class_students (class_id, student_id, student_uid, student_name) VALUES (?, ?, ?, ?)').run(cls.id, local_student_id, student_id, student_name || 'Student');
    console.log('Insert complete! Run result:', runResult);
  } else {
    console.log('Already joined, skipping insert.');
  }

  const students = db.prepare("SELECT * FROM class_students").all();
  console.log('Students in class now:', students);

} catch (err) {
  console.error('Error during join test:', err);
}
