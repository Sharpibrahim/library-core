import Database from 'better-sqlite3';
try {
  const db = new Database(':memory:');
  const row = db.prepare('SELECT 1 + 1 AS result').get();
  console.log('SQL Check:', row.result === 2 ? 'OK' : 'FAIL');
  db.close();
} catch (e) {
  console.error('SQL Error:', e);
  process.exit(1);
}
