import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync, lstatSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { seal, unseal } from './service.mjs';

export function sqliteStore(path, key) {
  if (!Buffer.isBuffer(key) || key.length !== 32) throw new Error('SQLite storage requires a stable 32-byte TOKEN_ENCRYPTION_KEY');
  const filename = resolve(path), directory = dirname(filename);
  const stat = value => { try { return lstatSync(value); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } };
  if (directory === '/') throw new Error('SQLite requires a private data directory');
  if (stat(directory)?.isSymbolicLink()) throw new Error('SQLite directory cannot be a symlink');
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  chmodSync(directory, 0o700);
  if (stat(filename) && (!stat(filename).isFile() || stat(filename).isSymbolicLink())) throw new Error('SQLite path must be a regular file');
  // SQLite creates WAL/SHM/journal files itself; the restrictive umask covers those too.
  process.umask(0o077);
  const db = new DatabaseSync(filename, { timeout: 10000 });
  chmodSync(filename, 0o600);
  db.exec('PRAGMA busy_timeout=10000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS records (collection TEXT NOT NULL, id TEXT NOT NULL, ciphertext TEXT NOT NULL, PRIMARY KEY(collection,id));');
  const read = db.prepare('SELECT ciphertext FROM records WHERE collection=? AND id=?');
  const write = db.prepare('INSERT INTO records(collection,id,ciphertext) VALUES(?,?,?) ON CONFLICT(collection,id) DO UPDATE SET ciphertext=excluded.ciphertext');
  const remove = db.prepare('DELETE FROM records WHERE collection=? AND id=?');
  const identity = (collection, id) => {
    if (!['connections', 'oauth'].includes(collection) || typeof id !== 'string') throw new Error('Invalid store identity');
    return createHash('sha256').update(id).digest('hex');
  };
  const get = (collection, id) => {
    const hashed = identity(collection, id), row = read.get(collection, hashed);
    return row ? unseal(row.ciphertext, key, `${collection}/${hashed}`) : null;
  };
  return {
    async get(collection, id) { return get(collection, id); },
    async mutate(collection, id, update) {
      const hashed = identity(collection, id);
      db.exec('BEGIN IMMEDIATE');
      try {
        const current = get(collection, id), next = update(current);
        if (next?.then) throw new Error('Store mutation callback must be synchronous');
        if (next === null) remove.run(collection, hashed);
        else if (next !== current) write.run(collection, hashed, seal(next, key, `${collection}/${hashed}`));
        db.exec('COMMIT');
      } catch (error) { db.exec('ROLLBACK'); throw error; }
    },
    ready() { return db.prepare('SELECT 1 AS ok').get().ok === 1; },
    close() { db.close(); }
  };
}
