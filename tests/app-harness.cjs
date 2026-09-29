// The Map view and the roadmap, driven through the real index.html in jsdom with an in-memory
// Firebase that behaves like the SDK's multi-path update and re-fires 'value' listeners.
//   npm i jsdom@24 jspdf@2.5.1   (anywhere; point NODE_PATH at it)
//   NODE_PATH=<that>/node_modules node tests/map.test.cjs
const fs = require('fs'), path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra === undefined ? '' : extra); } };
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), 'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));

// ── in-memory RTDB
function makeDB(seed) {
  const data = JSON.parse(JSON.stringify(seed)), listeners = [], updates = [];
  const get = p => p.split('/').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), data);
  const set = (p, v) => {
    const ks = p.split('/').filter(Boolean); let o = data;
    for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null || typeof o[ks[i]] !== 'object') o[ks[i]] = {}; o = o[ks[i]]; }
    if (v === null || v === undefined) delete o[ks[ks.length - 1]]; else o[ks[ks.length - 1]] = JSON.parse(JSON.stringify(v));
  };
  let n = 0, nextUpdate=null;
  const interceptNextUpdate=handler=>{nextUpdate=handler};
  const fire = () => listeners.forEach(l => { const v = get(l.p); l.cb({ val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) }); });
  const ref = (p = '') => ({
    on: (ev, cb) => { if (p === '.info/connected') { cb({ val: () => true }); return; } listeners.push({ p, cb }); const v = get(p); cb({ val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) }); },
    off: () => { for (let i = listeners.length - 1; i >= 0; i--) if (listeners[i].p === p) listeners.splice(i, 1); },
    push: () => ({ key: '-k' + String(++n).padStart(4, '0') }),
    update: o => { if(nextUpdate){const handler=nextUpdate;nextUpdate=null;return handler(o,()=>ref(p).update(o))} updates.push(o); for (const [k, v] of Object.entries(o)) set((p ? p + '/' : '') + k, v); fire(); return Promise.resolve(); },
    set: v => { set(p, v); fire(); return Promise.resolve(); },
  });
  return { data, updates, get, ref, listeners, interceptNextUpdate };
}

async function boot(seed, options={}) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .replace(/<script src="https:\/\/www\.gstatic[^>]*><\/script>/g, '')
    .replace(/<script src="https:\/\/cdn\.jsdelivr[^>]*><\/script>/g, '')
    .replace(/<link[^>]*fonts\.g[^>]*>/g, '');
  const db = makeDB(seed);
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://dyap123.github.io/openyap-todo/',
    beforeParse(w) {
      for(const [key,value] of Object.entries(options.storage||{}))w.localStorage.setItem(key,value);
      const NativeDate=w.Date;w.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2026-09-28T12:00:00-07:00']))}static now(){return +new NativeDate('2026-09-28T12:00:00-07:00')}};
      w.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {} }); // reduced motion
      w.jspdf = require('jspdf');
      const user = options.user===undefined?{uid:'owner',email:'dyap123@gmail.com',emailVerified:true}:options.user; let authCallback; w.__setUser=u=>authCallback(u); w.__authCalls=[]; w.OY_CONFIG={googleClientId:'test-client'}; w.fetch=options.fetch||(()=>Promise.reject(new Error('Unexpected fetch')));w.google=options.google;
      w.firebase = {
        apps: [], initializeApp() { this.apps.push({}); },
        database: () => ({ ref: db.ref }),
        auth: Object.assign(() => ({ onAuthStateChanged: cb => {authCallback=cb;setTimeout(()=>cb(user),0)}, getRedirectResult: () => Promise.resolve(), signOut() {authCallback(null);return Promise.resolve()}, signInWithPopup() {w.__authCalls.push(['google']);return Promise.resolve()},createUserWithEmailAndPassword(email,password){w.__authCalls.push(['create',email,password]);return Promise.resolve()},signInWithEmailAndPassword(email,password){w.__authCalls.push(['signin',email,password]);return Promise.resolve()},sendPasswordResetEmail(email){w.__authCalls.push(['reset',email]);return Promise.resolve()} }), { GoogleAuthProvider: function () { this.setCustomParameters = () => {};this.addScope = scope=>{w.__lastScope=scope}; } }),
      };
      w.HTMLElement.prototype.scrollIntoView = () => {};
      w.scrollTo = () => {};
    },
  });
  await new Promise(r => setTimeout(r, 60));
  return { w: dom.window, d: dom.window.document, db };
}


module.exports={boot};
