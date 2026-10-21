#!/usr/bin/env node
'use strict';
// Operator-only: never place personal payloads or credentials in this repository.
const fs = require('node:fs');
const path = require('node:path');
const PROJECT = 'openyap-todo';
const DATABASE_URL = 'https://openyap-todo-default-rtdb.firebaseio.com';
const OWNER = 'dyap123@gmail.com';
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function assert(ok) { if (!ok) throw new Error('Seed validation failed'); }
function keys(v, allowed) { assert(object(v) && Object.keys(v).every(k => allowed.includes(k))); }
function number(v, min, max) { assert(typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max); }
function date(v) { assert(typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(v + 'T00:00:00Z').toISOString().slice(0, 10) === v); }
function validatePayload(p) {
  keys(p, ['projectId', 'ownerUid', 'profile', 'checkin']);
  assert(p.projectId === PROJECT && typeof p.ownerUid === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(p.ownerUid));
  assert(own(p, 'profile') || own(p, 'checkin'));
  const result = {};
  if (own(p, 'profile')) {
    keys(p.profile, ['heightCm', 'age', 'sex', 'activity', 'trainingDays', 'checkpoint', 'pullupMax', 'benchBaseline', 'mileBaselineMinutes', 'restrictionContext']);
    for (const [k, v] of Object.entries(p.profile)) {
      if (k === 'heightCm') number(v, 100, 250);
      if (k === 'age') { number(v, 18, 120); assert(Number.isInteger(v)); }
      if (k === 'sex') assert(['male', 'female'].includes(v));
      if (k === 'activity') assert(['sedentary', 'light', 'moderate', 'active'].includes(v));
      if (k === 'trainingDays') assert([3, 4, 5].includes(v));
      if (k === 'checkpoint') date(v);
      if (k === 'pullupMax') { number(v, 0, 200); assert(Number.isInteger(v)); }
      if (k === 'mileBaselineMinutes') number(v, 2, 120);
      if (k === 'restrictionContext') assert(['unspecified', 'none', 'medical', 'pregnancy'].includes(v));
      if (k === 'benchBaseline') {
        keys(v, ['load', 'unit', 'kind']);
        assert(Object.keys(v).length === 3 && ['kg', 'lb'].includes(v.unit) && v.kind === 'unspecified'); number(v.load, 0, 1000);
      }
    }
    result.profile = structuredClone(p.profile);
  }
  if (own(p, 'checkin')) {
    keys(p.checkin, ['date', 'weightKg', 'waistCm', 'notes']); date(p.checkin.date);
    const now = new Date(), today = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    assert(p.checkin.date <= today);
    assert(own(p.checkin, 'weightKg') || own(p.checkin, 'waistCm') || own(p.checkin, 'notes'));
    if (own(p.checkin, 'weightKg')) number(p.checkin.weightKg, 20, 400);
    if (own(p.checkin, 'waistCm')) number(p.checkin.waistCm, 20, 300);
    if (own(p.checkin, 'notes')) assert(typeof p.checkin.notes === 'string' && p.checkin.notes.length <= 2000);
    const {date: day, ...values} = p.checkin; result.checkins = {[day]: values};
  }
  assert(Object.values(result).some(v => Object.keys(v).length));
  return result;
}
function readPrivateJson(filename, repo = path.join(__dirname, '..')) {
  assert(typeof filename === 'string' && path.isAbsolute(filename));
  const resolved = fs.realpathSync(filename), root = fs.realpathSync(repo);
  assert(resolved === path.resolve(filename) && resolved !== root && !resolved.startsWith(root + path.sep));
  // A different checkout is still public-source storage. Check ancestors too.
  for (let dir = path.dirname(resolved); ; dir = path.dirname(dir)) {
    assert(!fs.existsSync(path.join(dir, '.git')));
    if (path.dirname(dir) === dir) break;
  }
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try {
    const stat = fs.fstatSync(fd), named = fs.lstatSync(filename);
    assert(fs.realpathSync(filename) === resolved && named.dev === stat.dev && named.ino === stat.ino);
    assert(stat.isFile() && (stat.mode & 0o7777) === 0o600 && stat.nlink === 1 && stat.size <= 32768 && (typeof process.getuid !== 'function' || stat.uid === process.getuid()));
    return JSON.parse(fs.readFileSync(fd, 'utf8'));
  } finally { fs.closeSync(fd); }
}
function readPrivatePayload(filename, repo) { const payload = readPrivateJson(filename, repo); validatePayload(payload); return payload; }
// Field paths deliberately omit the personal check-in date as well as values.
function fieldNames(seed) {
  const out = [];
  function visit(v, prefix) { for (const [k, value] of Object.entries(v)) { const next = prefix + '/' + k; if (object(value)) visit(value, next); else out.push(next); } }
  if (seed.profile) visit(seed.profile, 'profile');
  if (seed.checkins) visit(Object.values(seed.checkins)[0], 'checkins/{date}');
  return out.sort();
}
function missingOnly(current, seed) {
  assert(current === null || current === undefined || object(current));
  const next = current == null ? {} : structuredClone(current);
  let changed = false;
  const added = {};
  for (const [key, value] of Object.entries(seed)) {
    if (!own(next, key) || next[key] === null) { next[key] = structuredClone(value); added[key] = structuredClone(value); changed = true; }
    // A partially saved load must never acquire an inferred unit or rep context.
    else if (key !== 'benchBaseline' && object(value) && object(next[key])) { const nested = missingOnly(next[key], value); if (nested.changed) { next[key] = nested.value; added[key] = nested.added; changed = true; } }
  }
  return {value: next, changed, added};
}
// The root operator uses the existing Firebase CLI owner session, not the
// finance verifier service account (which intentionally has no RTDB write IAM).
const AUTH_LOOKUP = 'https://identitytoolkit.googleapis.com/v1/projects/' + PROJECT + '/accounts:lookup';
const FITNESS_URL = DATABASE_URL + '/todo/fitness.json';
async function seedWithRequest(payload, {owner, projectId, request, apply = false}) {
  const seed = validatePayload(payload);
  assert(projectId === PROJECT && object(owner) && owner.project === PROJECT && owner.workspace === 'todo' && owner.uid === payload.ownerUid && owner.emailVerified === true && typeof owner.email === 'string' && owner.email.toLowerCase() === OWNER);
  const auth = await request(AUTH_LOOKUP, 'POST', {localId: [payload.ownerUid]});
  assert(auth.status === 200 && Array.isArray(auth.body.users) && auth.body.users.length === 1);
  const user = auth.body.users[0];
  assert(user.localId === owner.uid && user.emailVerified === true && typeof user.email === 'string' && user.email.toLowerCase() === OWNER && !user.disabled);
  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await request(FITNESS_URL, 'GET', undefined, {'X-Firebase-ETag': 'true'});
    assert(current.status === 200 && typeof current.etag === 'string' && current.etag.length > 0);
    const plan = missingOnly(current.body, seed);
    if (!apply) return {mode: 'dry-run', fields: fieldNames(seed), plannedFields: fieldNames(plan.added)};
    if (!plan.changed) return {mode: 'apply', fields: fieldNames(seed), plannedFields: [], committed: false};
    const saved = await request(FITNESS_URL, 'PUT', plan.value, {'if-match': current.etag});
    if ([409, 412].includes(saved.status)) continue;
    assert(saved.status === 200);
    return {mode: 'apply', fields: fieldNames(seed), plannedFields: fieldNames(plan.added), committed: true};
  }
  throw new Error('Concurrent edits prevented seed');
}
function parseArgs(args) {
  assert(args.length === 4 || args.length === 5);
  assert(args[0] === '--payload-file' && args[2] === '--owner-file' && (args.length === 4 || args[4] === '--apply'));
  return {filename: args[1], ownerFilename: args[3], apply: args.length === 5};
}
function operatorAccount(account) {
  // IAM decides whether this signed-in infrastructure operator may access the
  // project. The separate fresh Auth lookup verifies the app workspace owner.
  assert(account && account.user && typeof account.user.email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.user.email));
  return account;
}
async function main() {
  const args = parseArgs(process.argv.slice(2)), payload = readPrivatePayload(args.filename), owner = readPrivateJson(args.ownerFilename);
  assert(!process.env.FIREBASE_AUTH_EMULATOR_HOST && !process.env.FIREBASE_DATABASE_EMULATOR_HOST);
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '../firebase/.firebaserc'), 'utf8'));
  assert(config.projects.default === PROJECT);
  // NODE_PATH may point to the trusted global npm installation, as in migrate_todo.
  const {getGlobalDefaultAccount} = require('firebase-tools/lib/auth');
  const {requireAuth} = require('firebase-tools/lib/requireAuth');
  const {getAccessToken} = require('firebase-tools/lib/apiv2');
  const account = operatorAccount(getGlobalDefaultAccount());
  await requireAuth({...account, project: PROJECT, nonInteractive: true});
  const token = await getAccessToken();
  const request = async (url, method, body, headers = {}) => {
    assert((url === AUTH_LOOKUP && method === 'POST') || (url === FITNESS_URL && (method === 'GET' || (method === 'PUT' && args.apply && typeof headers['if-match'] === 'string'))));
    const response = await fetch(url, {method, redirect: 'error', headers: {authorization: 'Bearer ' + token, 'content-type': 'application/json', ...headers}, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(30000)});
    return {status: response.status, etag: response.headers.get('etag'), body: response.status === 200 ? await response.json() : null};
  };
  console.log(JSON.stringify(await seedWithRequest(payload, {owner, projectId: config.projects.default, request, apply: args.apply})));
}
module.exports = {PROJECT, DATABASE_URL, OWNER, AUTH_LOOKUP, FITNESS_URL, validatePayload, readPrivateJson, readPrivatePayload, fieldNames, missingOnly, seedWithRequest, parseArgs, operatorAccount};
if (require.main === module) main().catch(() => { console.error('Fitness seed stopped. Check private file permissions, allowed fields, isolated project and verified owner identity.'); process.exitCode = 1; });
