const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json'));
const db = new Firestore({
  projectId: config.projectId,
  databaseId: config.firestoreDatabaseId || '(default)'
});

async function test() {
  try {
    const docRef = db.collection('test').doc('ping');
    await docRef.set({ timestamp: new Date() });
    const snap = await docRef.get();
    console.log('Success! Data:', snap.data());
  } catch(e) {
    console.error('Failed:', e);
  }
}
test();
