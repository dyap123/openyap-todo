import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { configuration, createService } from './service.mjs';

export function firestoreStore(db) {
  const ref = (collection, id) => db.collection(`finance_${collection}`).doc(createHash('sha256').update(id).digest('hex'));
  return {
    async get(collection, id) { return (await ref(collection, id).get()).data() || null; },
    async mutate(collection, id, update) {
      return db.runTransaction(async tx => {
        const doc = ref(collection, id);
        const current = (await tx.get(doc)).data() || null;
        const next = update(current);
        if (next === null) tx.delete(doc);
        else if (next !== current) tx.set(doc, next);
      });
    }
  };
}

const config = configuration();
// Firebase credentials are required even when Schwab is not configured: status is private.
initializeApp({ credential: applicationDefault(), projectId: config.projectId || 'openyap-todo' });
const handler = createService({ config, store: firestoreStore(getFirestore(process.env.FIRESTORE_DATABASE_ID || 'finance')), verifyIdToken: token => getAuth().verifyIdToken(token, true) });
const server = createServer({ maxHeaderSize: 16384 }, handler);
server.requestTimeout = 20000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => {
  console.log(`Finance API listening; Schwab ${config.configured ? 'configured' : 'not configured'}`);
});
