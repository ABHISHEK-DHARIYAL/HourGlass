import { initializeApp } from 'firebase/app';
import { initializeFirestore, getDocFromServer, doc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';

async function run() {
  const firebaseConfigPath = path.join(process.cwd(), 'firebase-applet-config.json');
  const firebaseConfigJson = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf8'));

  const firebaseConfig = {
    apiKey: firebaseConfigJson.apiKey,
    authDomain: firebaseConfigJson.authDomain,
    projectId: firebaseConfigJson.projectId,
    storageBucket: firebaseConfigJson.storageBucket,
    messagingSenderId: firebaseConfigJson.messagingSenderId,
    appId: firebaseConfigJson.appId,
    measurementId: firebaseConfigJson.measurementId,
  };

  console.log('Testing client-side Firebase JS SDK config:');
  console.log(JSON.stringify(firebaseConfig, null, 2));

  const app = initializeApp(firebaseConfig);

  const testDbs = [
    undefined,
    '(default)',
    firebaseConfigJson.firestoreDatabaseId,
    'remixed-firestore-database-id'
  ];

  for (const dbId of testDbs) {
    try {
      console.log(`\nTesting client databaseId: "${dbId}"...`);
      const db = initializeFirestore(app, {}, dbId);
      const docRef = doc(db, 'test', 'connection');
      const snap = await getDocFromServer(docRef);
      console.log(`Success! Exists:`, snap.exists());
    } catch (err: any) {
      console.log(`Failed for "${dbId}":`, err.message || err);
    }
  }
}

run();
