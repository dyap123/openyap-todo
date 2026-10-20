import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, statSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { sqliteStore } from '../sqlite-store.mjs';

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), 'finance-sqlite-')), path = join(directory, 'private', 'state.sqlite'), key = randomBytes(32);
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return { directory, path, key };
}
test('durable encrypted records survive restart with private files; wrong keys fail', async t => {
  const { path, key } = fixture(t);
  let store = sqliteStore(path, key);
  await store.mutate('connections', 'secret-uid', () => ({ tokens: 'sensitive-token', generation: 'g' }));
  assert.equal(store.ready(), true);
  for (const file of readdirSync(join(path, '..'))) {
    const full = join(path, '..', file);
    assert.equal(statSync(full).mode & 0o777, 0o600);
    assert.ok(!readFileSync(full).includes(Buffer.from('sensitive-token')));
    assert.ok(!readFileSync(full).includes(Buffer.from('secret-uid')));
  }
  assert.equal(statSync(join(path, '..')).mode & 0o777, 0o700);
  store.close(); store = sqliteStore(path, key);
  assert.equal((await store.get('connections', 'secret-uid')).tokens, 'sensitive-token');
  assert.equal(await store.get('connections', 'other-uid'), null);
  store.close(); store = sqliteStore(path, randomBytes(32));
  await assert.rejects(store.get('connections', 'secret-uid'));
  store.close();
});
test('failed mutations roll back and generation tombstones persist across restart', async t => {
  const { path, key } = fixture(t); let store = sqliteStore(path, key);
  await store.mutate('connections', 'uid', () => ({ generation: 'a', tokens: 'encrypted-inner' }));
  await assert.rejects(store.mutate('connections', 'uid', current => { current.tokens = 'changed'; throw Error('abort'); }));
  assert.equal((await store.get('connections', 'uid')).tokens, 'encrypted-inner');
  await assert.rejects(store.mutate('connections', 'uid', async current => current), /synchronous/);
  await store.mutate('connections', 'uid', () => ({ generation: 'disconnected' }));
  store.close(); store = sqliteStore(path, key);
  await assert.rejects(store.mutate('connections', 'uid', current => { if (current.generation !== 'a') throw Error('connection_changed'); return { tokens: 'revived' }; }), /connection_changed/);
  assert.deepEqual(await store.get('connections', 'uid'), { generation: 'disconnected' });
  await store.mutate('oauth', 'state', () => ({ phase: 'start' }));
  await store.mutate('oauth', 'state', () => null);
  assert.equal(await store.get('oauth', 'state'), null); store.close();
});
test('independent processes serialize increments and only one refresh lease wins', async t => {
  const { path, key } = fixture(t); const store = sqliteStore(path, key);
  await store.mutate('connections', 'shared', () => ({ count: 0 }));
  const script = `import {sqliteStore} from ${JSON.stringify(new URL('../sqlite-store.mjs', import.meta.url).href)};const s=sqliteStore(process.argv[1],Buffer.from(process.argv[2],'base64'));for(let i=0;i<60;i++)await s.mutate('connections','shared',d=>({...d,count:d.count+1}));let won=false;await s.mutate('connections','lease',d=>{if(d)return d;won=true;return{lock:'held'}});console.log(won);s.close();`;
  const children = Array.from({ length: 3 }, () => spawn(process.execPath, ['--input-type=module', '-e', script, path, key.toString('base64')], { stdio: ['ignore', 'pipe', 'pipe'] }));
  const results = await Promise.all(children.map(async child => { let output=''; child.stdout.on('data', x=>output+=x); const [code] = await once(child, 'close'); assert.equal(code, 0); return output; }));
  assert.equal((await store.get('connections', 'shared')).count, 180);
  assert.equal(results.filter(x=>x.trim()==='true').length, 1); store.close();
});
test('symlink file paths and missing keys are refused', t => {
  const { directory, path, key } = fixture(t);
  assert.throws(() => sqliteStore(path, Buffer.alloc(0)), /32-byte/);
  symlinkSync(join(directory, 'missing'), join(directory, 'link'));
  assert.throws(() => sqliteStore(join(directory, 'link'), key), /regular file|unable to open/);
});
test('production entrypoint serves unconfigured readiness using SQLite and restarts cleanly', async t => {
  const { path, key } = fixture(t);
  // Port zero asks the kernel for a free private listener, without a fixed-port collision.
  async function boot() {
    const child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('../', import.meta.url), env: { PATH: process.env.PATH, PORT: '0', FIREBASE_PROJECT_ID: 'openyap-todo', FINANCE_STORE: 'sqlite', SQLITE_PATH: path, TOKEN_ENCRYPTION_KEY: key.toString('base64') }, stdio: ['ignore','pipe','pipe'] });
    let output = '', resolveStarted, rejectStarted;
    const started = new Promise((resolve, reject) => { resolveStarted=resolve; rejectStarted=reject; });
    child.stdout.on('data', data => { output+=data; const match=output.match(/port (\d+)/); if(match)resolveStarted(match[1]); });
    child.once('exit', code => rejectStarted(new Error(`startup exited ${code}`)));
    const timer = setTimeout(()=>{child.kill();rejectStarted(Error('startup timeout'));},10000);
    const port = await started; clearTimeout(timer);
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.deepEqual(await response.json(), { ready: true, configured: false });
    child.kill('SIGTERM'); const [code] = await once(child,'exit'); assert.equal(code,0);
  }
  await boot(); await boot();
});
