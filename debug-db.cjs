const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(process.cwd(), 'library.db');
console.log('Database path:', dbPath);
console.log('Database exists:', fs.existsSync(dbPath));

try {
  const db = new Database(dbPath);
  
  console.log('\n--- TABLES ---');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
  console.log(tables);

  console.log('\n--- CLASSES ---');
  const classes = db.prepare("SELECT * FROM classes").all();
  console.log(classes);

  console.log('\n--- USERS ---');
  const users = db.prepare("SELECT * FROM users").all();
  console.log(users);

  console.log('\n--- CLASS_STUDENTS ---');
  const students = db.prepare("SELECT * FROM class_students").all();
  console.log(students);

  console.log('\n--- SCHEMAS ---');
  for (const table of ['classes', 'class_students', 'users']) {
    try {
      const schema = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name=?`).get(table.name || table);
      console.log(`${table}:`, schema ? schema.sql : 'NOT FOUND');
    } catch (e) {
      console.error(e);
    }
  }

} catch (err) {
  console.error('Error:', err);
}
