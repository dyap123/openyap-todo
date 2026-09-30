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
  let n = 0;
  const fire = () => listeners.forEach(l => { const v = get(l.p); l.cb({ val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) }); });
  const ref = (p = '') => ({
    on: (ev, cb) => { if (p === '.info/connected') { cb({ val: () => true }); return; } listeners.push({ p, cb }); const v = get(p); cb({ val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))) }); },
    off: () => { for (let i = listeners.length - 1; i >= 0; i--) if (listeners[i].p === p) listeners.splice(i, 1); },
    push: () => ({ key: '-k' + String(++n).padStart(4, '0') }),
    update: o => { updates.push(o); for (const [k, v] of Object.entries(o)) set((p ? p + '/' : '') + k, v); fire(); return Promise.resolve(); },
    set: v => { set(p, v); fire(); return Promise.resolve(); },
  });
  return { data, updates, get, ref };
}

async function boot(seed) {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
    .replace(/<script src="https:\/\/www\.gstatic[^>]*><\/script>/g, '')
    .replace(/<script src="https:\/\/cdn\.jsdelivr[^>]*><\/script>/g, '')
    .replace(/<link[^>]*fonts\.g[^>]*>/g, '');
  const db = makeDB(seed);
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://dyap123.github.io/openyap-todo/',
    beforeParse(w) {
      w.matchMedia = () => ({ matches: true, addListener() {}, removeListener() {}, addEventListener() {} }); // reduced motion
      w.jspdf = require('jspdf');
      const user = { email: 'dyap123@gmail.com', emailVerified: true };
      w.firebase = {
        apps: [], initializeApp() { this.apps.push({}); },
        database: () => ({ ref: db.ref }),
        auth: Object.assign(() => ({ onAuthStateChanged: cb => setTimeout(() => cb(user), 0), getRedirectResult: () => Promise.resolve(), signOut() {}, signInWithPopup() {} }), { GoogleAuthProvider: function () { this.setCustomParameters = () => {}; } }),
      };
      w.HTMLElement.prototype.scrollIntoView = () => {};
      w.scrollTo = () => {};
    },
  });
  await new Promise(r => setTimeout(r, 60));
  return { w: dom.window, d: dom.window.document, db };
}

(async () => {
  const seedBody = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase/seed-maps-2026-09.json'), 'utf8'));
  const todo = { projects: { '-P25PXSq33unJ506PF3n': { name: 'OpenYap', status: 'active', order: 1 } }, sides: {}, maps: {}, tasks: {
    tLoose: { title: 'Loose OpenYap task', projectId: '-P25PXSq33unJ506PF3n', completed: false, priority: 'medium', dueDate: '', order: 1 },
    tDone: { title: 'Finished one', projectId: '-P25PXSq33unJ506PF3n', completed: true, completedAt: '2026-09-01T00:00:00Z', order: 2 },
    tDB: { title: 'Measure the kitchen', projectId: '-map02-diamondbar', completed: false, priority: 'medium', dueDate: '2026-10-16', order: 3 },
  }, history: {} };
  for (const [k, v] of Object.entries(seedBody)) { const p = k.split('/'); todo[p[1]][p[2]] = v; }
  const { w, d, db } = await boot({ todo });
  const M = w.__oym, OY = '-P25PXSq33unJ506PF3n', AI = '-map00-aiinconstruction';

  console.log('seed');
  eq('five projects have maps', Object.keys(M.maps).length, 5);
  const nodes = M.maps[OY].nodes, kids = p => M.mapKids(nodes, p).map(([, n]) => n.title);
  eq('OpenYap branches in sheet order', kids('root'), ['Backend', 'Developers', 'Reusability', 'Front End']);
  eq('kinds follow depth', ['n001', 'n002', 'n003'].map(k => M.mapKindOf(nodes, k)), ['branch', 'topic', 'item']);

  console.log('layout');
  const lay = M.mapLayout(nodes), C = lay.C, br = M.mapKids(nodes, 'root').map(([k]) => C[k]);
  ok('top branch above the main topic', br[0].y + br[0].h <= C.root.y);
  ok('left branch left of it', br[1].x + br[1].w <= C.root.x);
  ok('right branch right of it', br[2].x >= C.root.x + C.root.w);
  ok('bottom branch below it', br[3].y >= C.root.y + C.root.h);
  const topicsOf = b => M.mapKids(nodes, b).map(([k]) => C[k]);
  const [bTop, bLeft, bRight, bBot] = M.mapKids(nodes, 'root').map(([k]) => k);
  ok('top topics in one row above their branch', topicsOf(bTop).every(r => r.y + r.h <= C[bTop].y) && new Set(topicsOf(bTop).map(r => r.y + r.h)).size === 1);
  ok('left topics in one column', new Set(topicsOf(bLeft).map(r => r.x)).size === 1 && topicsOf(bLeft).every(r => r.x + r.w <= C[bLeft].x));
  ok('right topics in one column', new Set(topicsOf(bRight).map(r => r.x)).size === 1 && topicsOf(bRight).every(r => r.x >= C[bRight].x + C[bRight].w));
  ok('bottom topics in a row below', topicsOf(bBot).every(r => r.y >= C[bBot].y + C[bBot].h));
  const overlaps = C => { const rs = Object.entries(C), out = [];
    for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const [a, A] = rs[i], [b, B] = rs[j];
      if (A.x < B.x + B.w && B.x < A.x + A.w && A.y < B.y + B.h && B.y < A.y + A.h) out.push(a + '/' + b); } return out; };
  for (const pid of Object.keys(M.maps)) eq('no overlaps: ' + pid, overlaps(M.mapLayout(M.maps[pid].nodes || {}).C), []);
  // Stress: 6 branches x 6 topics x 6 items, wide rows must clear the columns.
  const big = {}; let s = 0;
  for (let b = 0; b < 6; b++) { const bid = 'b' + b; big[bid] = { parent: 'root', title: 'B' + b, order: b };
    for (let t = 0; t < 6; t++) { const tid = bid + 't' + t; big[tid] = { parent: bid, title: 'T', order: t };
      for (let i = 0; i < 6; i++) big[tid + 'i' + i] = { parent: tid, title: 'I', order: i, _s: s++ }; } }
  eq('no overlaps: 6 x 6 x 6', overlaps(M.mapLayout(big).C), []);
  eq('one connector per branch and topic', M.mapLayout(big).L.length, 6 + 36);

  console.log('drop rules');
  const it = 'n003', topic = 'n002', branch = 'n001', topic2 = M.mapKids(nodes, 'n001')[1][0], item2 = M.mapKids(nodes, topic2)[0][0];
  eq('item onto a topic', M.mapDropRule(nodes, { kind: 'item', id: it }, topic2), { parent: topic2 });
  eq('item onto an item lands before it', M.mapDropRule(nodes, { kind: 'item', id: it }, item2), { parent: topic2, before: item2 });
  eq('item onto a sub-topic goes into it', M.mapDropRule(nodes, { kind: 'item', id: it }, branch), { parent: branch });
  eq('item onto the main topic is refused', M.mapDropRule(nodes, { kind: 'item', id: it }, 'root'), null);
  eq('onto itself is refused', M.mapDropRule(nodes, { kind: 'item', id: it }, it), null);
  eq('topic onto another branch', M.mapDropRule(nodes, { kind: 'topic', id: topic }, bLeft), { parent: bLeft });
  eq('topic onto its own branch is a no-op', M.mapDropRule(nodes, { kind: 'topic', id: topic }, branch), null);
  eq('topic onto an item is refused (no nesting under an item)', M.mapDropRule(nodes, { kind: 'topic', id: topic }, item2), null);
  eq('topic onto another topic nests inside it', M.mapDropRule(nodes, { kind: 'topic', id: topic }, topic2), { parent: topic2 });
  eq('branch onto a branch swaps', M.mapDropRule(nodes, { kind: 'branch', id: branch }, bBot), { swap: bBot });
  eq('branch onto a topic is refused', M.mapDropRule(nodes, { kind: 'branch', id: branch }, topic2), null);
  eq('an unplaced task onto a topic', M.mapDropRule(nodes, { kind: 'task', id: 'tLoose' }, topic), { parent: topic });

  console.log('nesting');
  // Topics inside topics, three deep on every side, plus items straight on sub-topics.
  const deep = {}; let o = 0;
  for (let b = 0; b < 4; b++) { const bid = 'B' + b; deep[bid] = { parent: 'root', kind: 'branch', title: 'B', order: o++ };
    deep[bid + 'i'] = { parent: bid, kind: 'item', title: 'branch item', order: o++ };
    for (let t = 0; t < 3; t++) { const t1 = bid + 'T' + t; deep[t1] = { parent: bid, kind: 'topic', title: 'T', order: o++ };
      deep[t1 + 'i'] = { parent: t1, kind: 'item', title: 'i', order: o++ };
      for (let u = 0; u < 2; u++) { const t2 = t1 + 'U' + u; deep[t2] = { parent: t1, kind: 'topic', title: 'U', order: o++ };
        deep[t2 + 'i'] = { parent: t2, kind: 'item', title: 'i', order: o++ };
        const t3 = t2 + 'V'; deep[t3] = { parent: t2, kind: 'topic', title: 'V', order: o++ }; } } }
  const dl = M.mapLayout(deep);
  eq('no overlaps with topics three deep on every side', overlaps(dl.C), []);
  eq('every sub-topic and topic gets a card', Object.keys(dl.C).length, 1 + 4 + 4 * 3 * (1 + 2 + 2));
  eq('and a connector', dl.L.length, 4 + 4 * 3 * (1 + 2 + 2));
  ok('a left topic\'s children sit further left', dl.C['B1T0U0'].x + dl.C['B1T0U0'].w <= dl.C['B1T0'].x);
  ok('a right topic\'s children sit further right', dl.C['B2T0U0'].x >= dl.C['B2T0'].x + dl.C['B2T0'].w);
  ok('a top topic\'s children sit higher', dl.C['B0T0U0'].y + dl.C['B0T0U0'].h <= dl.C['B0T0'].y);
  ok('a bottom topic\'s children sit lower', dl.C['B3T0U0'].y >= dl.C['B3T0'].y + dl.C['B3T0'].h);
  ok('a sub-topic with items is taller', dl.C['B0'].h > 64 + 30);
  eq('a topic cannot go inside its own nested topic', M.mapDropRule(deep, { kind: 'topic', id: 'B1T0' }, 'B1T0U0V'), null);
  eq('but can go inside a cousin', M.mapDropRule(deep, { kind: 'topic', id: 'B1T0' }, 'B1T1U0'), { parent: 'B1T1U0' });
  eq('items still stay rows: an item never takes children', M.mapDropRule(deep, { kind: 'topic', id: 'B1T0' }, 'B1T1i'), null);

  console.log('the view');
  d.querySelector('[data-view="map"]').click();
  await new Promise(r => setTimeout(r, 30));
  d.querySelector('.mp-cur').click();
  ok('the switcher lists every project, grouped by side', d.querySelectorAll('.mp-prow').length === 5 && [...d.querySelectorAll('.mp-pg')].map(g => g.textContent).join() === 'Career,OpenYap');
  d.querySelector(`.mp-prow[data-mpid="${OY}"]`).click();
  await new Promise(r => setTimeout(r, 400));
  ok('picking closes the list', !d.querySelector('.mp-pick'));
  ok('the map renders', !!d.querySelector('#mapWorld .mp-root'));
  eq('one card per branch and topic plus the main topic', d.querySelectorAll('#mapWorld .mp-card').length, 1 + 4 + 12);
  eq('items are numbered rows inside their topic', d.querySelectorAll('#mapWorld .mp-item').length, 58 - 16);
  ok('a connector per card', d.querySelectorAll('.map-links path').length === 16);
  ok('the switcher shows the current project', d.querySelector('.mp-cur .nm').textContent === 'OpenYap' && /58 bubbles/.test(d.querySelector('.mp-cur').textContent));
  eq('unplaced lists open project tasks not on the map', M.mapUnplaced(OY).map(([k]) => k), ['tLoose']);

  console.log('dating an item makes it a task, in one write');
  d.querySelector(`#mapWorld [data-nid="${it}"]`).click();
  ok('the panel opens for the item', !!d.querySelector('.mp-panel[data-mpanel="' + it + '"]'));
  const u0 = db.updates.length, due = d.querySelector('.mp-panel input[data-mf="due"]');
  due.value = '2026-10-15'; due.dispatchEvent(new w.Event('change', { bubbles: true }));
  const w1 = db.updates.slice(u0);
  eq('one update', w1.length, 1);
  const node = db.get(`todo/maps/${OY}/nodes/${it}`), task = db.get('todo/tasks/' + node.taskId);
  ok('the node is linked to a task', !!node.taskId && !!task);
  eq('the task carries the title, date, project and side', [task.title, task.dueDate, task.projectId, task.side], [node.title, '2026-10-15', OY, 'openyap']);
  const title = d.querySelector('.mp-panel input[data-mf="title"]');
  title.value = 'Hosts .json + the web app'; title.dispatchEvent(new w.Event('change', { bubbles: true }));
  eq('a rename reaches the task too', db.get('todo/tasks/' + node.taskId).title, 'Hosts .json + the web app');
  const due2 = d.querySelector('.mp-panel input[data-mf="due"]');
  due2.value = ''; due2.dispatchEvent(new w.Event('change', { bubbles: true }));
  ok('clearing the date keeps the task', !!db.get('todo/tasks/' + node.taskId) && db.get('todo/tasks/' + node.taskId).dueDate === '');
  M.setMapPid(OY);

  console.log('dragging re-assigns');
  M.mapApplyDrop({ kind: 'item', id: it }, { parent: topic2 });
  eq('the item moved to the other topic', db.get(`todo/maps/${OY}/nodes/${it}/parent`), topic2);
  M.mapApplyDrop({ kind: 'item', id: it }, { parent: topic2, before: item2 });
  const order = M.mapKids(M.maps[OY].nodes, topic2).map(([k]) => k);
  ok('and dropping on an item puts it before that item', order.indexOf(it) === order.indexOf(item2) - 1, order.join(','));
  M.mapApplyDrop({ kind: 'task', id: 'tLoose' }, { parent: topic });
  const placed = Object.entries(M.maps[OY].nodes).find(([, n]) => n.taskId === 'tLoose');
  ok('an unplaced task becomes a linked item', !!placed && placed[1].parent === topic);
  eq('and leaves the tray', M.mapUnplaced(OY).length, 0);
  const oA = db.get(`todo/maps/${OY}/nodes/${bTop}/order`), oB = db.get(`todo/maps/${OY}/nodes/${bBot}/order`);
  M.mapApplyDrop({ kind: 'branch', id: bTop }, { swap: bBot });
  eq('branches swap slots', [db.get(`todo/maps/${OY}/nodes/${bTop}/order`), db.get(`todo/maps/${OY}/nodes/${bBot}/order`)], [oB, oA]);

  console.log('delete');
  const inside = M.mapKids(M.maps[OY].nodes, topic2).length;
  M.mapDelete(topic2);
  ok('a topic goes with its items', !db.get(`todo/maps/${OY}/nodes/${topic2}`) && M.mapKids(M.maps[OY].nodes, topic2).length === 0 && inside > 0);
  ok('its linked task stays in the list', !!db.get('todo/tasks/' + node.taskId));
  d.querySelector('#toastAct').click();
  ok('Undo brings the topic back with its items', !!db.get(`todo/maps/${OY}/nodes/${topic2}`) && M.mapKids(M.maps[OY].nodes, topic2).length === inside);

  const tick = () => new Promise(r => setTimeout(r, 40));
  console.log('descriptions and colours');
  M.setMapPid(OY);
  d.querySelector('[data-view="map"]').click(); await new Promise(r => setTimeout(r, 30));
  d.querySelector(`#mapWorld [data-nid="${it}"]`).click();
  const ta = d.querySelector('.mp-panel textarea[data-mf="desc"]');
  ok('an item has a description field', !!ta);
  ta.value = 'Mirror hosting on dev first'; ta.dispatchEvent(new w.Event('change', { bubbles: true })); await tick();
  eq('the description is saved on the bubble', db.get(`todo/maps/${OY}/nodes/${it}/desc`), 'Mirror hosting on dev first');
  eq('and becomes the linked task\'s notes', db.get('todo/tasks/' + node.taskId + '/notes'), 'Mirror hosting on dev first');
  ok('the row shows a note mark', !!d.querySelector(`#mapWorld [data-nid="${it}"] .mp-note`));
  ok('a newline does not close the field', (() => { const t2 = d.querySelector('.mp-panel textarea[data-mf="desc"]'); t2.focus();
    const ev = new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }); t2.dispatchEvent(ev); t2.blur(); return !ev.defaultPrevented; })());
  await tick();
  // Colour a branch: its topics, items and connectors take it; a topic of its own overrides.
  d.querySelector(`#mapWorld [data-nid="${bLeft}"]`).click();
  d.querySelector('.mp-panel [data-mcolor="#46a758"]').click(); await tick();
  eq('the branch colour is saved', db.get(`todo/maps/${OY}/nodes/${bLeft}/color`), '#46a758');
  const t0 = M.mapKids(M.maps[OY].nodes, bLeft)[0][0];
  ok('its topics inherit it', d.querySelector(`#mapWorld [data-nid="${t0}"]`).getAttribute('style').includes('--mc:#46a758'));
  ok('and so does its connector', d.querySelector(`.map-links path[data-to="${t0}"]`).getAttribute('style') === 'stroke:#46a758');
  d.querySelector(`#mapWorld [data-nid="${t0}"] .mp-th`).click();
  ok('the topic panel says where its colour comes from', /Green from above/.test(d.querySelector('.mp-panel').textContent));
  d.querySelector('.mp-panel [data-mcolor="#e5484d"]').click(); await tick();
  ok('a topic of its own overrides the branch', d.querySelector(`#mapWorld [data-nid="${t0}"]`).getAttribute('style').includes('--mc:#e5484d'));
  d.querySelector('.mp-panel [data-mcolor=""]').click();
  eq('Same as above clears it', db.get(`todo/maps/${OY}/nodes/${t0}/color`), undefined);
  const mu0 = db.updates.length; M.mapSave && w.document.querySelector('.mp-panel');
  d.querySelector('.mp-panel [data-mcolor=""]').click();
  ok('only palette colours are accepted', (() => { const n0 = db.updates.length; w.__oym.mapSetColor && w.__oym.mapSetColor(t0, 'red; background:url(x)'); return db.updates.length === n0; })());
  d.querySelector('#mapWorld .mp-root').click();
  const rta = d.querySelector('.mp-panel textarea[data-mf="desc"]');
  rta.value = 'Field-first construction software'; rta.dispatchEvent(new w.Event('change', { bubbles: true }));
  eq('the main topic\'s description is the project description', db.get(`todo/projects/${OY}/description`), 'Field-first construction software');
  const R0 = M.roadmapData(OY, '2026-09-28'), lane = R0.lanes.find(l => l.id === bLeft);
  eq('the roadmap carries colours', [lane.color, lane.topics[0].color], ['#46a758', '#46a758']);
  ok('and descriptions', R0.lanes.some(l => l.topics.some(t => t.items.some(i => i.desc === 'Mirror hosting on dev first'))));
  const pdf2 = M.buildRoadmap({ pid: OY, paper: 'letter' });
  ok('a coloured, described roadmap still builds', Buffer.from(pdf2.output('arraybuffer')).slice(0, 5).toString() === '%PDF-');
  void mu0;

  console.log('typing in the bubble');
  M.setMapPid(OY); await tick();
  const nb0 = M.mapKids(M.maps[OY].nodes, 'root').length;
  d.querySelector('#mapWorld .mp-root .mp-plus').click(); await tick();
  const nb = M.mapKids(M.maps[OY].nodes, 'root').map(([k]) => k).find(k => !M.mapKids(M.maps[OY].nodes, 'root').slice(0, nb0).some(([x]) => x === k));
  const inl = d.querySelector(`#mapWorld [data-nid="${nb}"] .mp-inl`);
  ok('a new branch opens with its title ready to type', !!inl && d.activeElement === inl);
  ok('and no side panel', !d.querySelector('.mp-panel'));
  inl.value = 'Operations'; inl.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await tick();
  eq('Enter saves the title', db.get(`todo/maps/${OY}/nodes/${nb}/title`), 'Operations');
  ok('and the bubble shows it', d.querySelector(`#mapWorld [data-nid="${nb}"] .mp-t`).textContent === 'Operations');
  d.querySelector(`#mapWorld [data-nid="${nb}"] .mp-plus`).click(); await tick();
  const nt = M.mapKids(M.maps[OY].nodes, nb)[0][0], inl2 = d.querySelector(`#mapWorld [data-nid="${nt}"] .mp-inl`);
  ok('a new topic too', !!inl2);
  inl2.value = 'Should not stick'; inl2.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await tick();
  eq('Escape keeps the old title', db.get(`todo/maps/${OY}/nodes/${nt}/title`), 'New topic');
  d.querySelector(`#mapWorld [data-nid="${nb}"]`).click(); await tick();
  ok('one click opens the panel', !!d.querySelector(`.mp-panel[data-mpanel="${nb}"]`));
  d.querySelector(`#mapWorld [data-nid="${nb}"] .mp-t`).click(); await tick();
  ok('a click on the selected title edits it in place', !!d.querySelector(`#mapWorld [data-nid="${nb}"] .mp-inl`));
  d.querySelector(`#mapWorld [data-nid="${nb}"] .mp-inl`).blur(); await tick();
  ok('the panel sits inside what is visible', (() => { const pn = d.querySelector('.mp-panel'); return pn && pn.style.position === 'fixed' && parseFloat(pn.style.maxHeight) > 0; })());
  M.mapDelete(nb); await tick();

  console.log('moving bubbles, and Fit tidying them back');
  M.setMapPid(OY); await tick();
  const before = M.mapLayout(M.maps[OY].nodes), bL = bLeft, tL = M.mapKids(M.maps[OY].nodes, bL)[0][0];
  M.mapMoveBy(bL, -120, 40); await tick();
  const after = M.mapLayout(M.maps[OY].nodes);
  eq('a moved branch lands where it was dropped', [after.C[bL].x - before.C[bL].x, after.C[bL].y - before.C[bL].y], [-120, 40]);
  eq('and brings its topics along', [after.C[tL].x - before.C[tL].x, after.C[tL].y - before.C[tL].y], [-120, 40]);
  ok('its connector is redrawn to the new spot', after.L.find(l => l.to === bL).d !== before.L.find(l => l.to === bL).d);
  M.mapMoveBy(tL, 0, 60); await tick();
  eq('a topic can move on its own too', M.mapLayout(M.maps[OY].nodes).C[tL].y - before.C[tL].y, 100);
  eq('the card is painted at the new spot', d.querySelector(`#mapWorld [data-nid="${tL}"]`).style.top, M.mapLayout(M.maps[OY].nodes).C[tL].y + 'px');
  d.querySelector('[data-mact="fit"]').click(); await tick();
  ok('Fit puts everything back into the sheet layout', JSON.stringify(M.mapLayout(M.maps[OY].nodes).C) === JSON.stringify(before.C));
  ok('and says how many it tidied', /Tidied 2 moved bubbles/.test(d.querySelector('#toast').textContent));
  d.querySelector('#toastAct').click(); await tick();
  eq('Undo brings the arrangement back', M.mapLayout(M.maps[OY].nodes).C[tL].y - before.C[tL].y, 100);
  d.querySelector('[data-mact="fit"]').click(); await tick();
  const r1 = { x: 0, y: 0, w: 100, h: 40 }, up1 = M.mapLink(r1, { x: 0, y: -200, w: 100, h: 40 }), side1 = M.mapLink(r1, { x: 300, y: 0, w: 100, h: 40 });
  ok('a child above gets a vertical elbow, a child beside a horizontal one', /^M50 0V/.test(up1) && /^M100 20H/.test(side1));

  console.log('adding at any depth');
  M.setMapPid(OY); await tick();
  const tp = M.mapKids(M.maps[OY].nodes, bTop).map(([k]) => k).find(k => M.mapKindOf(M.maps[OY].nodes, k) === 'topic');
  d.querySelector(`#mapWorld [data-nid="${tp}"] .mp-plus`).click(); await tick();
  const sub = M.mapKids(M.maps[OY].nodes, tp).map(([k]) => k).find(k => M.mapKindOf(M.maps[OY].nodes, k) === 'topic');
  ok('+ on a topic adds a topic inside it', !!sub && !!d.querySelector(`#mapWorld .mp-topic[data-nid="${sub}"] .mp-inl`));
  d.querySelector(`#mapWorld [data-nid="${sub}"] .mp-inl`).blur(); await tick();
  d.querySelector(`#mapWorld [data-nid="${sub}"] .mp-add`).click(); await tick();
  ok('and that one takes items', M.mapKids(M.maps[OY].nodes, sub).some(([k]) => M.mapKindOf(M.maps[OY].nodes, k) === 'item'));
  d.activeElement && d.activeElement.blur && d.activeElement.blur(); await tick();
  d.querySelector(`#mapWorld .mp-branch[data-nid="${bTop}"] .mp-add`).click(); await tick();
  const bi = M.mapKids(M.maps[OY].nodes, bTop).map(([k]) => k).find(k => M.mapKindOf(M.maps[OY].nodes, k) === 'item');
  ok('a sub-topic takes items too, shown as rows in its card', !!bi && !!d.querySelector(`#mapWorld .mp-branch[data-nid="${bTop}"] .mp-item[data-nid="${bi}"]`));
  d.activeElement && d.activeElement.blur && d.activeElement.blur(); await tick();
  M.mapSave(bi,'due','2026-10-20');
  db.ref().update({ [`todo/maps/${OY}/nodes/${sub}/start`]: '2026-11-02', [`todo/maps/${OY}/nodes/${sub}/due`]: '2026-11-30' }); await tick();
  const RN = M.roadmapData(OY, '2026-09-28'), ln = RN.lanes.find(l => l.id === bTop);
  ok('the roadmap carries a sub-topic\'s own items', ln.items.some(i => i.id === bi && i.due === '2026-10-20'));
  const nested = ln.topics.find(t => t.id === sub), parent = ln.topics.find(t => t.id === tp);
  ok('and nested topics, one level deeper, with their path', nested && nested.depth === 1 && nested.path.length === 2);
  ok('a parent topic spans what is nested under it', parent.end >= '2026-11-30');
  ok('a nested roadmap still builds', Buffer.from(M.buildRoadmap({ pid: OY, paper: 'letter' }).output('arraybuffer')).slice(0, 5).toString() === '%PDF-');
  d.querySelector(`#mapWorld [data-nid="${sub}"] .mp-th`).click(); await tick();
  const sibs = () => M.mapKids(M.maps[OY].nodes, tp).filter(([k]) => M.mapKindOf(M.maps[OY].nodes, k) === 'topic').map(([k]) => k);
  M.mapDelete(sub); await tick();
  const t2list = () => M.mapTopicsOf ? null : M.mapKids(M.maps[OY].nodes, bTop).filter(([k]) => M.mapKindOf(M.maps[OY].nodes, k) === 'topic').map(([k]) => k);
  const before2 = t2list(); M.setMapPid(OY); M.mapNudge(before2[1], -1); await tick();
  const after2 = t2list();
  eq('↑ moves a topic one place earlier among its siblings', [after2[0], after2[1]], [before2[1], before2[0]]);

  console.log('projects: find, create, delete');
  d.querySelector('.mp-cur').click();
  const q = d.querySelector('#mapPickQ'); q.value = 'diam'; q.dispatchEvent(new w.Event('input', { bubbles: true }));
  eq('search filters the list', [...d.querySelectorAll('.mp-prow .nm')].map(e => e.textContent), ['Diamond Bar']);
  ok('OpenYap cannot be deleted', (() => { q.value = ''; q.dispatchEvent(new w.Event('input', { bubbles: true })); return d.querySelector(`[data-mdel="${OY}"]`).disabled; })());
  d.querySelector('[data-mdel="-map02-diamondbar"]').click();
  ok('delete asks first, with the task count', /1 task in your list/.test(d.querySelector('.mp-prow.ask').textContent));
  d.querySelector('[data-mdelno]').click();
  ok('Cancel backs out', !d.querySelector('.mp-prow.ask') && !!db.get('todo/projects/-map02-diamondbar'));
  d.querySelector('[data-mdel="-map02-diamondbar"]').click();
  d.querySelector('[data-mdelgo="keep"]').click(); await tick();
  ok('the project, its side and its map are gone', !db.get('todo/projects/-map02-diamondbar') && !db.get('todo/sides/-map02-diamondbar') && !db.get('todo/maps/-map02-diamondbar'));
  const kept = db.get('todo/tasks/tDB');
  eq('Keep tasks keeps them where they were: unassigned, same side, still private', [kept.projectId, kept.side, kept.private], ['', 'career', true]);
  d.querySelector('#toastAct').click(); await tick();
  ok('Undo restores the project, the map and the task', !!db.get('todo/projects/-map02-diamondbar') && Object.keys(db.get('todo/maps/-map02-diamondbar/nodes')).length === 20 && db.get('todo/tasks/tDB').projectId === '-map02-diamondbar');
  d.querySelector('.mp-cur').click();
  d.querySelector('[data-mdel="-map02-diamondbar"]').click();
  d.querySelector('[data-mdelgo="all"]').click(); await tick();
  ok('Delete tasks too removes them', !db.get('todo/tasks/tDB') && !db.get('todo/projects/-map02-diamondbar'));
  d.querySelector('#toastAct').click(); await tick();
  d.querySelector('.mp-cur').click();
  const q2 = d.querySelector('#mapPickQ'); q2.value = 'Garage build';
  q2.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); await tick();
  const gid = Object.entries(db.get('todo/projects')).find(([, p]) => p.name === 'Garage build');
  ok('Enter on a new name creates the project and opens it', !!gid && d.querySelector('.mp-cur .nm').textContent === 'Garage build');
  M.setMapPid(OY);

  console.log('roadmap');
  M.setMapPid(AI);
  const aiN = M.maps[AI].nodes, cyber = 'n002', cItems = M.mapKids(aiN, cyber).map(([k]) => k);
  const up = {};
  up[`todo/maps/${AI}/nodes/${cItems[0]}/start`] = '2026-09-01'; up[`todo/maps/${AI}/nodes/${cItems[0]}/due`] = '2026-09-20';
  up[`todo/maps/${AI}/nodes/${cItems[1]}/due`] = '2026-11-02';
  db.ref().update(up);
  const R = M.roadmapData(AI, '2026-09-28');
  eq('one lane per branch', R.lanes.map(l => l.title), ['Enterprise Policies', 'Existing Data', 'Field Use', 'Core Functions']);
  eq('range from the earliest to the latest date', [R.min, R.max], ['2026-09-01', '2026-11-02']);
  const cy = R.lanes[0].topics[0];
  eq('a topic spans its items', [cy.title, cy.start, cy.end], ['Cybersecurity', '2026-09-01', '2026-11-02']);
  eq('a past due date is overdue, a future one open', [cy.items[0].status, cy.items[1].status], ['overdue', 'open']);
  eq('dated and undated counts (49 items: 66 nodes less 4 branches and 13 topics)', [R.dated, R.undated.length], [2, 49 - 2]);
  const doc = M.buildRoadmap({ pid: AI, paper: 'letter' });
  const bytes = Buffer.from(doc.output('arraybuffer'));
  ok('the roadmap is a PDF', bytes.slice(0, 5).toString() === '%PDF-');
  ok('landscape', doc.internal.pageSize.getWidth() > doc.internal.pageSize.getHeight());
  ok('timeline page plus schedule pages', doc.getNumberOfPages() >= 2, doc.getNumberOfPages());
  const empty = M.buildRoadmap({ pid: '-map04-concrete', paper: 'a4' });
  ok('an empty map still exports', Buffer.from(empty.output('arraybuffer')).slice(0, 5).toString() === '%PDF-');

  console.log('timeline (Gantt of the map)');
  M.setMapPid(AI);
  d.querySelector('[data-view="timeline"]').click(); await tick();
  ok('the Timeline tab draws the map as a Gantt', !!d.querySelector('#tlHost .gt') && d.querySelector('#tlHost .mp-cur .nm').textContent === 'AI in Construction');
  const lanesShown = [...d.querySelectorAll('.gt-lane .gt-t')].map(e => e.textContent);
  ok('lanes are sub-topics with dates (undated hidden by default)', lanesShown.length >= 1 && lanesShown.every(t => ['Enterprise Policies', 'Existing Data', 'Field Use', 'Core Functions'].includes(t)));
  const bars = d.querySelectorAll('.gt-b').length, dias = d.querySelectorAll('.gt-m').length;
  eq('a dated item with start and due is a bar, due only a diamond', [bars, dias], [1, 1]);
  const R2 = M.roadmapData(AI);
  eq('rows skip undated items until asked', M.gtRows(R2, { undated: false }).filter(r => r.type === 'item').length, 2);
  ok('Undated shows every item', M.gtRows(R2, { undated: true }).filter(r => r.type === 'item').length === 49);
  eq('folding a lane hides its rows', M.gtRows(R2, { undated: true, fold: new Set([R2.lanes[0].id]) }).filter(r => r.lane === R2.lanes[0].id).length, 0);
  d.querySelector('[data-gact="und"]').click(); await tick();
  ok('the Undated switch shows the rest', d.querySelectorAll('.gt-set').length === 47);
  const cell = d.querySelector('.gt-set'), itemId = cell.dataset.gset;
  cell.dispatchEvent(new w.MouseEvent('click', { bubbles: true, clientX: 18 * 10 + 5 }));
  await tick();
  const setDue = db.get(`todo/maps/${AI}/nodes/${itemId}/due`);
  ok('clicking a day on an undated row gives it that due date', !!setDue && !!db.get(`todo/maps/${AI}/nodes/${itemId}/taskId`));
  // Drag the bar one week later.
  const bar = d.querySelector('.gt-b'), bid2 = bar.dataset.gbar, s0 = db.get(`todo/maps/${AI}/nodes/${bid2}/start`), e0 = db.get(`todo/maps/${AI}/nodes/${bid2}/due`);
  const pe = (type, x, target) => { const ev = new w.MouseEvent(type, { bubbles: true, clientX: x, button: 0 }); (target || d).dispatchEvent(ev); };
  pe('pointerdown', 100, bar); pe('pointermove', 100 + 18 * 7); pe('pointerup', 100 + 18 * 7); await tick();
  const addD = (ds, n) => { const x = new Date(ds + 'T00:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  eq('dragging a bar moves both dates', [db.get(`todo/maps/${AI}/nodes/${bid2}/start`), db.get(`todo/maps/${AI}/nodes/${bid2}/due`)], [addD(s0, 7), addD(e0, 7)]);
  const bar2 = d.querySelector(`.gt-b[data-gbar="${bid2}"]`);
  pe('pointerdown', 100, bar2.querySelector('.gt-h.r')); pe('pointermove', 100 + 18 * 3); pe('pointerup', 100 + 18 * 3); await tick();
  eq('dragging the end moves only the due date', [db.get(`todo/maps/${AI}/nodes/${bid2}/start`), db.get(`todo/maps/${AI}/nodes/${bid2}/due`)], [addD(s0, 7), addD(e0, 10)]);
  await new Promise(r => setTimeout(r, 400));  // a release right after a drag is not a click
  d.querySelector('[data-gscale="month"]').click(); await tick();
  ok('Months zooms out', d.querySelector('#gtScroll').getAttribute('style').includes('--px:5px'));
  d.querySelector(`[data-gopen="${bid2}"]`).click(); await tick();
  ok('a name opens that bubble in the map', !!d.querySelector('#v-map:not([hidden])') && !!d.querySelector(`.mp-panel[data-mpanel="${bid2}"]`));
  d.querySelector('[data-gscale]') ; w.localStorage.setItem('oym_gtund', '0');

  console.log('export sheet');
  d.querySelector('#exportBtn').click();
  d.querySelector('[data-extab="roadmap"]').click();
  ok('the Roadmap tab lists mapped projects', d.querySelectorAll('[data-exrpid]').length === 6);
  ok('and counts what will print', /items? included/.test(d.querySelector('#rmCount').textContent));

  console.log('brief: selected branches for a meeting');
  const AIn = M.maps[AI].nodes, [eb, ed] = M.mapKids(AIn, 'root').map(([k]) => k);   // Enterprise Policies, Existing Data
  const cyb = M.mapKids(AIn, eb)[0][0], cybItems = M.mapKids(AIn, cyb).map(([k]) => k);
  // Only two Cybersecurity items: the branch and topic come along as headings, nothing else.
  const exc = new Set(Object.keys(AIn)); exc.delete(cybItems[0]); exc.delete(cybItems[2]);
  const f = M.mapFilterNodes(AIn, exc);
  eq('picked items and their ancestors, nothing else', Object.keys(f).sort(), [eb, cyb, cybItems[0], cybItems[2]].sort());
  ok('an unpicked ancestor is a heading only', f[eb]._ctx === true && f[eb].desc === undefined);
  ok('moved positions are dropped for the drawing', f[eb].dx === undefined);
  const f2 = M.mapFilterNodes(AIn, new Set());
  eq('nothing excluded keeps the whole map', Object.keys(f2).length, Object.keys(AIn).length);
  w.localStorage.removeItem('oym_bexc_' + AI);
  M.briefToggle(AI, eb);
  ok('unticking a section leaves out everything in it', [eb, ...M.mapKids(AIn, eb).map(([k]) => k)].every(k => M.briefExcluded(AI).has(k)));
  M.briefToggle(AI, cybItems[1]);
  eq('ticking one item inside brings back just that item', Object.keys(M.mapFilterNodes(AIn, M.briefExcluded(AI))).filter(k => M.mapKids(AIn, 'root').some(([b]) => b === k) || true).filter(k => [eb, cyb, cybItems[1]].includes(k)).length, 3);
  M.briefToggle(AI, eb);
  ok('ticking a partly picked section picks all of it', ![eb, ...M.mapKids(AIn, eb).map(([k]) => k)].some(k => M.briefExcluded(AI).has(k)));

  // The export sheet.
  if (d.querySelector('#exBack').hidden) d.querySelector('#exportBtn').click();
  d.querySelector('[data-extab="brief"]').click(); await tick();
  d.querySelector(`[data-exrpid="${AI}"]`).click(); await tick();
  eq('the Brief tab lists every bubble as a checklist', d.querySelectorAll('#bTree input[data-bnode]').length, Object.keys(M.maps[AI].nodes).length);
  d.querySelector('[data-ex="bnone"]').click(); await tick();
  ok('Clear leaves nothing picked', /Nothing picked/.test(d.querySelector('#bCount').textContent));
  const cb = d.querySelector(`#bTree input[data-bnode="${cybItems[0]}"]`); cb.checked = true; cb.dispatchEvent(new w.Event('change', { bubbles: true })); await tick();
  ok('ticking an item counts it', /1 section, 1 item/.test(d.querySelector('#bCount').textContent));
  ok('its section shows as partly picked', d.querySelector(`#bTree input[data-bnode="${eb}"]`).indeterminate === true);
  const bt = d.querySelector('#exBTitle'); bt.value = 'AI Council kickoff'; bt.dispatchEvent(new w.Event('input', { bubbles: true }));
  const bdoc = M.buildBrief({ pid: AI, paper: 'letter', title: 'AI Council kickoff', name: 'Danzel', desc: true, map: true, time: true, notes: true });
  ok('the brief is a PDF', Buffer.from(bdoc.output('arraybuffer')).slice(0, 5).toString() === '%PDF-');
  const sizes = []; for (let i = 1; i <= bdoc.getNumberOfPages(); i++) { bdoc.setPage(i); sizes.push(bdoc.internal.pageSize.getWidth() > bdoc.internal.pageSize.getHeight() ? 'L' : 'P'); }
  eq('outline portrait, then the map page and the timeline in landscape', sizes, ['P', 'L', 'L']);
  const doc2 = M.buildBrief({ pid: AI, paper: 'a4', title: '', name: '', desc: false, map: false, time: false, notes: false });
  eq('with the extras off it is the outline alone', doc2.getNumberOfPages(), 1);
  d.querySelector('[data-ex="ball"]').click(); await tick();
  ok('Select all puts everything back', /4 sections, 49 items/.test(d.querySelector('#bCount').textContent));
  const wholeBrief = M.buildBrief({ pid: AI, paper: 'letter', title: 'All', name: '', desc: true, map: true, time: true, notes: true });
  ok('a whole-map brief paginates', wholeBrief.getNumberOfPages() >= 4);

  console.log(`\nmap: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
