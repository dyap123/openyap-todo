#!/usr/bin/env node
'use strict';
// One allowlisted node only. Never read a database root or write to the source.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const SOURCE = 'https://gen-lang-client-0119642855-default-rtdb.firebaseio.com/todo.json';
const DEST = 'https://openyap-todo-default-rtdb.firebaseio.com/todo.json';
const canonical = v => JSON.stringify(v === null || typeof v !== 'object' ? v : Array.isArray(v) ? v.map(x => JSON.parse(canonical(x))) : Object.fromEntries(Object.keys(v).sort().map(k => [k, JSON.parse(canonical(v[k]))])));
const hash = v => crypto.createHash('sha256').update(canonical(v)).digest('hex');
async function migrate(mode, backup, request) {
  if (!['--prepare', '--apply'].includes(mode)) throw new Error('Use --prepare or --apply and an absolute backup path outside this repository');
  const repo = fs.realpathSync(path.join(__dirname, '..'));
  const parent = fs.realpathSync(path.dirname(backup));
  if (!path.isAbsolute(backup) || parent === repo || parent.startsWith(repo + path.sep)) throw new Error('Backup must be outside the repository');
  const source = await request(SOURCE, 'GET');
  if (!source || typeof source !== 'object') throw new Error('Source todo is absent or invalid');
  if (await request(DEST, 'GET') !== null) throw new Error('Destination todo already exists; refusing to overwrite');
  const sourceHash = hash(source);
  if (mode === '--prepare') {
    fs.writeFileSync(backup, JSON.stringify({source: SOURCE, destination: DEST, hash: sourceHash, todo: source}), {flag:'wx', mode:0o600});
    console.log('Todo-only backup prepared (0600). No database writes. SHA-256: ' + sourceHash);
    return;
  }
  const stat = fs.lstatSync(backup);
  if (!stat.isFile() || (stat.mode & 0o077)) throw new Error('Backup must be a regular private 0600 file');
  const saved = JSON.parse(fs.readFileSync(backup, 'utf8'));
  if (saved.source !== SOURCE || saved.destination !== DEST || saved.hash !== sourceHash || hash(saved.todo) !== sourceHash) throw new Error('Source changed or backup invalid; prepare a fresh backup');
  // null_etag is the RTDB conditional create sentinel; a concurrent write returns 412.
  await request(DEST, 'PUT', saved.todo, {'if-match':'null_etag'});
  const copied = await request(DEST, 'GET');
  const unchanged = await request(SOURCE, 'GET');
  if (hash(copied) !== sourceHash || hash(unchanged) !== sourceHash) throw new Error('Post-copy verification failed; no deletion performed. Keep backup and investigate');
  console.log('Todo copied and verified; source unchanged. SHA-256: ' + sourceHash);
}
async function main() {
  // CLI credentials stay in memory; native fetch avoids Firebase debug body logging.
  const {getGlobalDefaultAccount} = require('firebase-tools/lib/auth');
  const {requireAuth} = require('firebase-tools/lib/requireAuth');
  const {getAccessToken} = require('firebase-tools/lib/apiv2');
  const account = getGlobalDefaultAccount();
  if (!account) throw new Error('Firebase CLI sign-in required');
  await requireAuth({...account, project:'openyap-todo', nonInteractive:true});
  const token = await getAccessToken();
  const request = async (url, method, body, headers = {}) => {
    if (![SOURCE, DEST].includes(url) || (method !== 'GET' && !(url === DEST && method === 'PUT' && headers['if-match'] === 'null_etag'))) throw new Error('Disallowed migration request');
    const response = await fetch(url, {method, redirect:'error', headers:{authorization:'Bearer '+token, 'content-type':'application/json', ...headers}, body:body === undefined ? undefined : JSON.stringify(body), signal:AbortSignal.timeout(60000)});
    if (!response.ok) throw new Error('Migration request failed: HTTP ' + response.status);
    return response.json();
  };
  await migrate(process.argv[2], process.argv[3] || '', request);
}
module.exports = {migrate, hash, SOURCE, DEST};
if (require.main === module) main().catch(() => {console.error('Migration stopped. No source deletion or write was attempted; inspect permissions, destination emptiness and backup freshness.'); process.exitCode=1;});
