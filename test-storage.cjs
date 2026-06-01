const { Storage } = require('@google-cloud/storage');
const fs = require('fs');
const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json'));
const storage = new Storage({});
const bucketName = config.storageBucket;
const bucket = storage.bucket(bucketName);

async function test() {
  try {
    const [files] = await bucket.getFiles();
    console.log('Success! Files:', files.length);
  } catch(e) {
    console.error('Failed:', e);
  }
}
test();
