import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { configuration, createService } from './service.mjs';
import { sqliteStore } from './sqlite-store.mjs';

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
const mode = process.env.FINANCE_STORE || 'sqlite';
if (!['sqlite', 'firestore'].includes(mode)) throw new Error('Unknown FINANCE_STORE');
const store = mode === 'sqlite' ? sqliteStore(process.env.SQLITE_PATH || '/data/finance.sqlite', config.key) : firestoreStore(getFirestore(process.env.FIRESTORE_DATABASE_ID || 'finance'));
const handler = createService({ config, store, verifyIdToken: token => getAuth().verifyIdToken(token, true) });
const server = createServer({ maxHeaderSize: 16384 }, (req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    let ready = false;
    try { ready = store.ready ? store.ready() : true; } catch {}
    res.writeHead(ready ? 200 : 503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ready, configured: config.configured }));
    return;
  }
  handler(req, res);
});
server.requestTimeout = 20000;
server.headersTimeout = 10000;
server.keepAliveTimeout = 5000;
server.listen(Number(process.env.PORT || 8080), '0.0.0.0', () => {
  console.log(`Finance API listening on port ${server.address().port}; Schwab ${config.configured ? 'configured' : 'not configured'}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) process.once(signal, () => {
  server.close(() => { store.close?.(); process.exit(0); });
  setTimeout(() => process.exit(1), 15000).unref();
});
