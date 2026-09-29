'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {migrate, SOURCE, DEST} = require('../tools/migrate_todo.cjs');
(async () => {
 const dir = fs.mkdtempSync(path.join(os.tmpdir(),'todo-migration-'));
 try {
  const backup=path.join(dir,'backup.json'), source={tasks:{one:{title:'Synthetic'}}}; let dest=null, puts=0;
  const req=async (url,method,body,headers) => {
   assert.ok([SOURCE,DEST].includes(url));
   if(method==='PUT'){ assert.equal(url,DEST);assert.equal(headers['if-match'],'null_etag'); puts++;dest=body;return body; }
   return url===SOURCE?source:dest;
  };
  await migrate('--prepare',backup,req);assert.equal(puts,0);assert.equal(fs.statSync(backup).mode & 0o777,0o600);
  await migrate('--apply',backup,req);assert.equal(puts,1);assert.deepEqual(dest,source);
  await assert.rejects(migrate('--apply',backup,req),/already exists/);assert.equal(puts,1);
  dest=null;source.tasks.one.title='Updated';
  await assert.rejects(migrate('--apply',backup,req),/Source changed/);assert.equal(puts,1);
  await assert.rejects(migrate('--prepare',backup,req),/EEXIST/);
  console.log('Migration tests passed: backup, copy, conditional write, refusal to overwrite, stale source and backup protection');
 } finally {fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
