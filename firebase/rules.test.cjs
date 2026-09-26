// Lockdown rules for the legacy RTDB (gen-lang-client-0119642855), run in the emulator:
//   cd firebase && NODE_PATH=~/openyap-infra/node_modules firebase emulators:exec --only database "node rules.test.cjs"
// Only todo/ is open, and only to the owner's verified Google account. Everything else is closed
// to everyone (the data stays; ~/openyap-backups/legacy-rtdb-full-2026-09-25.json has a copy).
const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
let pass = 0, fail = 0;
async function t(name, p) { try { await p; pass++; } catch (e) { fail++; console.log('FAIL', name, e.message); } }
(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'gen-lang-client-0119642855',
    database: { host: '127.0.0.1', port: 9311, rules: fs.readFileSync(__dirname + '/database.rules.json', 'utf8') },
  });
  await env.withSecurityRulesDisabled(async c => {
    await c.database().ref().set({ todo: { tasks: { a: { title: 'x' } } }, 'tool-tracker': { fmAudit: { sessions: { s: 1 } } },
      config: { minimax_key: 'k' }, 'bid-room': { x: 1 }, trucks: { t: 1 } });
  });
  const anon = env.unauthenticatedContext().database();
  const owner = env.authenticatedContext('u1', { email: 'dyap123@gmail.com', email_verified: true }).database();
  const unverified = env.authenticatedContext('u2', { email: 'dyap123@gmail.com', email_verified: false }).database();
  const other = env.authenticatedContext('u3', { email: 'someone@gmail.com', email_verified: true }).database();

  for (const p of ['/', 'todo', 'todo/tasks', 'tool-tracker/fmAudit/sessions', 'config/minimax_key', 'bid-room', 'trucks'])
    await t('anon cannot read ' + p, assertFails(anon.ref(p).once('value')));
  for (const p of ['todo/tasks/b', 'tool-tracker/fmAudit/sessions/z', 'config/minimax_key', 'newthing'])
    await t('anon cannot write ' + p, assertFails(anon.ref(p).set('v')));
  await t('owner reads todo', assertSucceeds(owner.ref('todo').once('value')));
  await t('owner writes a task', assertSucceeds(owner.ref('todo/tasks/b').set({ title: 'y' })));
  await t('owner multi-path update under todo', assertSucceeds(owner.ref().update({ 'todo/tasks/c': { title: 'z' }, 'todo/history/h': { at: 1 } })));
  await t('owner multi-path update leaving todo fails', assertFails(owner.ref().update({ 'todo/tasks/d': 1, 'trucks/t': 2 })));
  for (const p of ['/', 'tool-tracker', 'config', 'bid-room'])
    await t('owner cannot read ' + p, assertFails(owner.ref(p).once('value')));
  await t('owner cannot write outside todo', assertFails(owner.ref('config/minimax_key').set('x')));
  await t('unverified owner email denied', assertFails(unverified.ref('todo').once('value')));
  await t('other account denied read', assertFails(other.ref('todo').once('value')));
  await t('other account denied write', assertFails(other.ref('todo/tasks/e').set(1)));
  await env.cleanup();
  console.log(`legacy lockdown rules: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
