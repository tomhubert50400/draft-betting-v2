/**
 * Inspecte les collections Firestore et affiche un échantillon de chaque
 * pour comprendre la structure exacte avant migration.
 */
const admin = require('firebase-admin');
const path = require('path');
const serviceAccount = require(path.join(__dirname, 'firebase-credentials.json'));

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function inspect() {
  const collections = ['users', 'matches', 'bets'];
  for (const coll of collections) {
    const snap = await db.collection(coll).limit(2).get();
    const total = (await db.collection(coll).count().get()).data().count;
    console.log(`\n=== ${coll} (${total} docs total) ===`);
    snap.forEach((doc) => {
      console.log('  id:', doc.id);
      console.log('  data:', JSON.stringify(doc.data(), null, 2).slice(0, 800));
    });
  }

  // settings/general
  const settingsDoc = await db.collection('settings').doc('general').get();
  console.log('\n=== settings/general ===');
  console.log(JSON.stringify(settingsDoc.data(), null, 2));

  process.exit(0);
}

inspect().catch((err) => { console.error(err); process.exit(1); });
