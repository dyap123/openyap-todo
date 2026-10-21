'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const {PROJECT, DATABASE_URL, OWNER, validatePayload, readPrivatePayload, fieldNames, missingOnly, seedWithRequest, AUTH_LOOKUP, FITNESS_URL, parseArgs, operatorAccount} = require('../tools/seed_fitness.cjs');
// Synthetic fixtures intentionally differ from personal baselines.
const payload = () => ({projectId: PROJECT, ownerUid: 'synthetic-owner-482', profile: {heightCm: 181, age: 34, sex: 'female', activity: 'light', trainingDays: 3, checkpoint: '2028-05-14', pullupMax: 8, benchBaseline: {load: 47, unit: 'kg', kind: 'unspecified'}, mileBaselineMinutes: 9, restrictionContext: 'none'}, checkin: {date: '2024-02-13', weightKg: 73, waistCm: 84, notes: 'synthetic confidential note'}});
(async () => {
  const p = payload(), seed = validatePayload(p);
  assert.equal(seed.profile.heightCm, 181);
  assert.equal(seed.checkins['2024-02-13'].weightKg, 73);
  assert(!own(seed.profile, 'weightKg'));
  for (const mutate of [p => p.projectId = 'other-project', p => p.ownerUid = '../owner', p => p.profile.weightKg = 73, p => p.goals = {calories: 1901}, p => p.profile.benchBaseline.kind = '1rm', p => p.profile.age = 16, p => p.profile.heightCm = NaN, p => p.profile.activity = 'invented', p => p.profile.restrictionContext = 'freeform private', p => p.checkin.date = '2024-02-31', p => p.checkin.date = '2999-01-01', p => p.checkin.workouts = {}]) {
    const bad = payload(); mutate(bad);
    assert.throws(() => validatePayload(bad));
  }
  assert.throws(() => validatePayload(JSON.parse('{"projectId":"openyap-todo","ownerUid":"fixture","profile":{"__proto__":{"polluted":true}}}')));
  const existing = {profile: {heightCm: 178, pullupMax: 0, restrictionContext: '', benchBaseline: {load: 44, unit: 'lb', kind: 'maximum'}, arbitrary: {a: true}}, checkins: {'2024-02-13': {weightKg: 70, notes: 'saved'}, '2024-02-12': {weightKg: 71}}, goals: {calories: 2187}, foods: {a: true}, diary: {a: true}, workouts: {done: {complete: true}}};
  const before = structuredClone(existing), merged = missingOnly(existing, seed);
  assert.deepEqual(existing, before, 'merge must not mutate the read snapshot');
  assert.equal(merged.value.profile.heightCm, 178); assert.equal(merged.value.profile.pullupMax, 0); assert.equal(merged.value.profile.restrictionContext, '');
  assert.deepEqual(merged.value.profile.benchBaseline, existing.profile.benchBaseline);
  assert.equal(merged.value.checkins['2024-02-13'].weightKg, 70); assert.equal(merged.value.checkins['2024-02-13'].notes, 'saved'); assert.equal(merged.value.checkins['2024-02-13'].waistCm, 84);
  for (const k of ['goals', 'foods', 'diary', 'workouts']) assert.deepEqual(merged.value[k], existing[k]);
  assert.equal(missingOnly(merged.value, seed).changed, false, 'retries are idempotent');
  assert.equal(missingOnly({profile: 'legacy-value'}, seed).value.profile, 'legacy-value', 'nonobject conflicts are preserved');
  assert.throws(() => missingOnly('invalid-root', seed));
  assert.deepEqual(missingOnly({profile: {benchBaseline: {load: 42}}}, seed).value.profile.benchBaseline, {load: 42}, 'never infer missing units or kind for an existing baseline');
  const output = JSON.stringify(fieldNames(seed));
  for (const secret of ['181', '73', 'synthetic confidential', p.ownerUid, p.checkin.date, OWNER]) assert(!output.includes(secret), 'field output must not contain private values');
  assert(output.includes('checkins/{date}/weightKg')); assert(output.includes('profile/benchBaseline/load'));
  const tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'fitness-seed-'));
  try {
    const privateFile = path.join(tmp, 'private.json'); fs.writeFileSync(privateFile, JSON.stringify(p), {mode: 0o600}); assert.deepEqual(readPrivatePayload(privateFile), p);
    fs.chmodSync(privateFile, 0o644); assert.throws(() => readPrivatePayload(privateFile)); fs.chmodSync(privateFile, 0o600);
    const hardlink = path.join(tmp, 'hardlink.json'); fs.linkSync(privateFile, hardlink); assert.throws(() => readPrivatePayload(privateFile)); fs.unlinkSync(hardlink);
    const link = path.join(tmp, 'link.json'); fs.symlinkSync(privateFile, link); assert.throws(() => readPrivatePayload(link));
    assert.throws(() => readPrivatePayload('relative.json')); assert.throws(() => readPrivatePayload(privateFile, tmp));
    const repo = path.join(tmp, 'checkout'); fs.mkdirSync(repo); fs.mkdirSync(path.join(repo, '.git')); const tracked = path.join(repo, 'payload.json'); fs.writeFileSync(tracked, JSON.stringify(p), {mode: 0o600}); assert.throws(() => readPrivatePayload(tracked));
    fs.writeFileSync(privateFile, '{private invalid value', {mode: 0o600});
    const cli = spawnSync(process.execPath, [path.join(__dirname, '../tools/seed_fitness.cjs'), '--payload-file', privateFile, '--owner-file', privateFile], {encoding: 'utf8'}); assert.equal(cli.status, 1); assert.equal(cli.stdout, ''); assert(!cli.stderr.includes(privateFile)); assert(!cli.stderr.includes('private invalid value'));
  } finally { fs.rmSync(tmp, {recursive: true, force: true}); }
  assert.equal(parseArgs(['--payload-file', '/private/input.json', '--owner-file', '/private/owner.json']).apply, false); assert.equal(parseArgs(['--payload-file', '/private/input.json', '--owner-file', '/private/owner.json', '--apply']).apply, true);
  for (const args of [[], ['--apply'], ['--payload-file', '/private/input.json', '--dry-run'], ['--payload-file', '/private/input.json', '--apply', '--uid', 'secret']]) assert.throws(() => parseArgs(args));
  const operator = {user: {email: 'infrastructure-operator@example.test'}};
  assert.notEqual(operator.user.email, OWNER);
  assert.equal(operatorAccount(operator), operator, 'authorized project operator need not be the app owner');
  for (const invalid of [null, {}, {user: {}}, {user: {email: 'invalid'}}, {user: {email: ' spaced@example.test'}}]) assert.throws(() => operatorAccount(invalid));
  const owner = {uid: p.ownerUid, email: OWNER, emailVerified: true, workspace: 'todo', project: PROJECT};
  let requests = [], stored = null, concurrent = false;
  const request = async (url, method, body, headers) => {
    requests.push({url, method, headers});
    if (url === AUTH_LOOKUP) { assert.equal(method, 'POST'); assert.deepEqual(body, {localId: [p.ownerUid]}); return {status: 200, body: {users: [{localId: p.ownerUid, email: OWNER, emailVerified: true}]}}; }
    assert.equal(url, FITNESS_URL);
    if (method === 'GET') return {status: 200, etag: '"synthetic-etag"', body: structuredClone(stored)};
    assert.equal(method, 'PUT'); assert.equal(headers['if-match'], '"synthetic-etag"');
    if (!concurrent) {concurrent = true; stored = {profile: {heightCm: 179}, goals: {calories: 2073}}; return {status: 412};}
    stored = body; return {status: 200, body};
  };
  const restDry = await seedWithRequest(p, {owner, projectId: PROJECT, request}); assert.equal(restDry.mode, 'dry-run'); assert.deepEqual(restDry.plannedFields, fieldNames(seed)); for (const secret of ['181', '73', 'synthetic confidential', p.ownerUid, p.checkin.date, OWNER]) assert(!JSON.stringify(restDry).includes(secret)); assert.equal(stored, null); assert.equal(requests.length, 2);
  const restApply = await seedWithRequest(p, {owner, projectId: PROJECT, request, apply: true}); assert.equal(restApply.committed, true); assert(!restApply.plannedFields.includes('profile/heightCm')); assert(restApply.plannedFields.includes('checkins/{date}/weightKg')); assert.equal(stored.profile.heightCm, 179); assert.equal(stored.goals.calories, 2073);
  const requestCount = requests.length;
  for (const badOwner of [{...owner, uid: 'wrong'}, {...owner, emailVerified: false}, {...owner, email: 'someone@example.test'}, {...owner, workspace: 'users/fixture/todo'}, {...owner, project: 'wrong'}]) await assert.rejects(seedWithRequest(p, {owner: badOwner, projectId: PROJECT, request, apply: true}));
  await assert.rejects(seedWithRequest(p, {owner, projectId: 'wrong', request, apply: true})); assert.equal(requests.length, requestCount);
  for (const authUsers of [[], [{localId: 'wrong', email: OWNER, emailVerified: true}], [{localId: p.ownerUid, email: operator.user.email, emailVerified: true}], [{localId: p.ownerUid, email: OWNER, emailVerified: false}], [{localId: p.ownerUid, email: OWNER, emailVerified: true, disabled: true}]]) {
    let count = 0; await assert.rejects(seedWithRequest(p, {owner, projectId: PROJECT, apply: true, request: async url => {count++; assert.equal(url, AUTH_LOOKUP); return {status: 200, body: {users: authUsers}};}})); assert.equal(count, 1);
  }
  const restSecond = await seedWithRequest(p, {owner, projectId: PROJECT, request, apply: true}); assert.equal(restSecond.committed, false);
  const invalidRootRequest = async (url, method) => url === AUTH_LOOKUP ? {status: 200, body: {users: [{localId: p.ownerUid, email: OWNER, emailVerified: true}]}} : {status: 200, etag: '"test"', body: 'invalid'};
  await assert.rejects(seedWithRequest(p, {owner, projectId: PROJECT, request: invalidRootRequest, apply: true}));
  let conflictWrites = 0; await assert.rejects(seedWithRequest(p, {owner, projectId: PROJECT, apply: true, request: async (url, method) => url === AUTH_LOOKUP ? {status: 200, body: {users: [{localId: p.ownerUid, email: OWNER, emailVerified: true}]}} : method === 'GET' ? {status: 200, etag: '"retry"', body: null} : (conflictWrites++, {status: conflictWrites % 2 ? 409 : 412})})); assert.equal(conflictWrites, 4, 'bounded ETag retries');
  console.log('Fitness seed: validation, owner/project guards, private file and output safety, dry-run, conflict-preserving ETag writes and idempotency pass');
})().catch(err => {console.error(err); process.exitCode = 1;});
function own(o, k) {return Object.prototype.hasOwnProperty.call(o, k);}
