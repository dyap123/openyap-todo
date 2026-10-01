// Budget: amounts on tasks, map bubbles and the project; roll-up, the schedule spread, in-place
// entry on the Map and the Gantt, and the task editor. Synthetic data, in-memory Firebase.
//   NODE_PATH=<jsdom+jspdf>/node_modules node tests/budget.test.cjs
const { boot } = require('./app-harness.cjs');
let pass = 0, fail = 0;
const ok = (name, cond, extra) => { if (cond) pass++; else { fail++; console.log('FAIL', name, extra === undefined ? '' : extra); } };
const eq = (name, got, want) => ok(name, JSON.stringify(got) === JSON.stringify(want), 'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));
const tick = (ms = 40) => new Promise(r => setTimeout(r, ms));

const seed = () => ({ todo: {
  projects: { p: { name: 'Shop fit-out', status: 'active', order: 1 } },
  sides: { p: { side: 'career', private: false } },
  history: {},
  tasks: {
    tk1: { title: 'Order steel', projectId: 'p', side: 'career', startDate: '2026-10-05', dueDate: '2026-10-11', budget: 3000, completed: false, order: 1 },
    u1: { title: 'Permit fee', projectId: 'p', side: 'career', budget: 500, completed: false, order: 2 },
    free: { title: 'Loose task', side: 'career', budget: 120, completed: false, order: 3 },
  },
  maps: { p: { budget: 20000, nodes: {
    b1: { parent: 'root', kind: 'branch', title: 'Structure', order: 1, budget: 10000 },
    t1: { parent: 'b1', kind: 'topic', title: 'Frame', order: 1 },
    i1: { parent: 't1', kind: 'item', title: 'Order steel', order: 1, taskId: 'tk1', budget: 1 },
    i2: { parent: 't1', kind: 'item', title: 'Weld', order: 2, due: '2026-10-12', budget: 2000 },
    i3: { parent: 'b1', kind: 'item', title: 'Crane', order: 2, budget: 6000 },
    b2: { parent: 'root', kind: 'branch', title: 'Finishes', order: 2, budget: 5000 },
    t2: { parent: 'b2', kind: 'topic', title: 'Paint', order: 1, start: '2026-10-19', due: '2026-10-25' },
    i4: { parent: 't2', kind: 'item', title: 'Primer', order: 1, due: '2026-10-20', budget: 1000 },
  } } },
} });

(async () => {
  const { w, d, db } = await boot(seed());
  const M = w.__oym, $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  const key = (el, k, o = {}) => el.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...o }));
  const chip = (scope, id) => $$(scope + ' [data-budget]').find(el => el.dataset.budget === id);

  // ── amounts
  eq('plain number', M.parseMoney('1500'), 1500);
  eq('dollars, commas and cents', M.parseMoney(' $1,500.50 '), 1500.5);
  eq('k suffix', M.parseMoney('1.5k'), 1500);
  eq('m suffix', M.parseMoney('2M'), 2000000);
  eq('empty clears', M.parseMoney(''), null);
  eq('zero clears', M.parseMoney('0'), null);
  ok('words are not an amount', M.parseMoney('abc') === undefined);
  ok('negative is not an amount', M.parseMoney('-5') === undefined);
  ok('exponent is not an amount', M.parseMoney('1e9') === undefined);
  eq('full format', [M.fmtMoney(12500), M.fmtMoney(1500.5)], ['$12,500', '$1,500.50']);
  eq('short format', [950, 1500, 12500, 125400, 999950, 2500000].map(M.fmtMoneyShort), ['$950', '$1.5k', '$12.5k', '$125k', '$1M', '$2.5M']);

  // ── roll-up
  const B = M.budgetData('p');
  eq('a linked item reads its task', B.i1.own, 3000);
  eq('a topic adds up what is inside', [B.t1.own, B.t1.alloc, B.t1.total], [0, 5000, 5000]);
  eq('an over-allocated sub-topic', [B.b1.own, B.b1.alloc, B.b1.over, B.b1.free, B.b1.total], [10000, 11000, 1000, 0, 11000]);
  eq('an under-allocated sub-topic', [B.b2.own, B.b2.alloc, B.b2.free, B.b2.over, B.b2.total], [5000, 1000, 4000, 0, 5000]);
  eq('the project counts tasks off the map', [B.root.own, B.root.unplaced, B.root.alloc, B.root.free, B.root.total], [20000, 500, 16500, 3500, 20000]);
  ok('a task in no project is not counted', B.root.alloc === 16500);

  // ── the schedule spread
  const F = M.budgetFlow('p');
  eq('scheduled and unscheduled add up to the project', [F.scheduled, F.unscheduled, F.scheduled + F.unscheduled], [13500, 6500, 20000]);
  const day = k => Math.round((F.days.get(k) || 0) * 100) / 100, rootDay = 3500 / 21;
  eq('an item is spread from start to due', day('2026-10-07'), Math.round((3000 / 7 + rootDay) * 100) / 100);
  eq('a due-only item lands on its day', day('2026-10-12'), Math.round((2000 + rootDay) * 100) / 100);
  eq('what a sub-topic has left is spread over its dates', day('2026-10-22'), Math.round((4000 / 7 + rootDay) * 100) / 100);
  eq('nothing outside the dated range', [day('2026-10-04'), day('2026-10-26')], [0, 0]);
  eq('the days sum to the scheduled amount', Math.round([...F.days.values()].reduce((a, b) => a + b, 0)), 13500);

  // ── the Map: off by default, a toggle that remembers
  $('[data-view="map"]').click(); await tick();
  ok('budget is off by default', !M.budgetOn && !$('#mapWorld .bud') && !$('.budget-bar'));
  ok('the toggle shows the project total', /\$20k/.test($('#mapHost [data-budget-toggle]').textContent));
  ok('the panel always has a Budget field', (() => { M.setMapSel('b1'); const h = M.mapPanelHTML('p', M.maps.p.nodes); M.setMapSel(''); return /data-mf="budget"[^>]*value="\$10,000"/.test(h) && /over by \$1,000/.test(h); })());
  $('#mapHost [data-budget-toggle]').click(); await tick();
  ok('the toggle turns amounts on and is remembered', M.budgetOn && w.localStorage.getItem('oym_budget') === '1');
  eq('item chips', ['i1', 'i2', 'i3', 'i4'].map(id => chip('#mapWorld', id).textContent), ['$3k', '$2k', '$6k', '$1k']);
  ok('an over-allocated sub-topic is flagged', chip('#mapWorld', 'b1').classList.contains('over') && /\$10k.*over \$1k/.test(chip('#mapWorld', 'b1').textContent));
  ok('a sub-topic shows what is left', /\$5k.*\$4k left/.test(chip('#mapWorld', 'b2').textContent));
  ok('a topic without its own amount shows the sum', chip('#mapWorld', 't1').classList.contains('sum') && chip('#mapWorld', 't1').textContent === '$5k');
  ok('the main topic carries the project amount', /\$20k/.test(chip('#mapWorld', 'root').textContent));
  const bar = $('#mapHost .budget-bar').textContent.replace(/\s+/g, ' ');
  ok('the summary bar', /Allocated \$16,500/.test(bar) && /Left to allocate \$3,500/.test(bar) && /Scheduled \$13,500/.test(bar) && /No dates yet \$6,500/.test(bar), bar);
  ok('the date still shows beside the amount', /Oct 12/.test($('#mapWorld [data-nid="i2"] .d').textContent));

  // ── typing in place
  chip('#mapWorld', 'i2').click();
  let inp = $('#mapWorld .bud-inl');
  ok('clicking an amount opens it for typing', !!inp && d.activeElement === inp && inp.value === '2000');
  inp.value = 'lots'; key(inp, 'Enter');
  ok('text that is not an amount is not saved', db.get('todo/maps/p/nodes/i2/budget') === 2000 && $('#mapWorld .bud-inl') === inp);
  ok('and says how to write one', /1\.5k/.test($('#toast').textContent));
  inp.value = '2.5k'; key(inp, 'Enter');
  eq('Enter saves', db.get('todo/maps/p/nodes/i2/budget'), 2500);
  inp = $('#mapWorld .bud-inl');
  ok('and moves to the next amount', !!inp && inp.dataset.budget !== 'i2' && d.activeElement === inp, inp && inp.dataset.budget);
  ok('with the totals already repainted', chip('#mapWorld', 't1').textContent === '$5.5k');
  const nextId = inp.dataset.budget;
  key(inp, 'Escape');
  ok('Escape leaves the amount as it was', !$('#mapWorld .bud-inl') && !!chip('#mapWorld', nextId));
  chip('#mapWorld', 'i1').click(); inp = $('#mapWorld .bud-inl'); inp.value = '$4,000'; key(inp, 'Tab', { shiftKey: true });
  eq('a linked item saves to its task and its bubble', [db.get('todo/tasks/tk1/budget'), db.get('todo/maps/p/nodes/i1/budget')], [4000, 4000]);
  ok('Shift+Tab goes back', $('#mapWorld .bud-inl') && $('#mapWorld .bud-inl').dataset.budget !== 'i1');
  key($('#mapWorld .bud-inl'), 'Escape');
  chip('#mapWorld', 'i3').click(); inp = $('#mapWorld .bud-inl'); inp.value = ''; inp.blur(); await tick();
  ok('clicking away saves; an empty amount clears it', db.get('todo/maps/p/nodes/i3/budget') === undefined && !$('#mapWorld .bud-inl') && chip('#mapWorld', 'i3').classList.contains('none'));
  chip('#mapHost .budget-bar', 'root').click(); inp = $('.budget-bar .bud-inl'); inp.value = '25k'; key(inp, 'Enter');
  eq('the project amount is set from the bar', db.get('todo/maps/p/budget'), 25000);
  ok('and focus returns to it', d.activeElement === chip('#mapHost .budget-bar', 'root'));

  // ── the panel
  $('#mapWorld [data-nid="b1"]').click(); await tick();
  const field = $('.mp-panel [data-mf="budget"]');
  ok('the panel lists what is inside', /Frame/.test($('.mp-budget ul').textContent) && /\$6,500/.test($('.mp-budget ul').textContent), $('.mp-budget') && $('.mp-budget').textContent);
  field.value = '12k'; field.dispatchEvent(new w.Event('change', { bubbles: true })); await tick();
  eq('the panel field saves', db.get('todo/maps/p/nodes/b1/budget'), 12000);
  ok('nothing else on the bubble changed', db.get('todo/maps/p/nodes/b1/title') === 'Structure' && db.get('todo/maps/p/nodes/b1/order') === 1);

  // ── bubbles and tasks keep each other's amount
  M.mapToList('i2');
  const made = Object.entries(db.get('todo/tasks')).find(([, t]) => t.title === 'Weld');
  eq('a task made from a bubble keeps its amount', made && made[1].budget, 2500);
  M.saveField('tk1', 'budget', '4.2k');
  eq('the task editor amount reaches the bubble', [db.get('todo/tasks/tk1/budget'), db.get('todo/maps/p/nodes/i1/budget')], [4200, 4200]);
  const before = db.updates.length; M.saveField('tk1', 'budget', '$4,200');
  eq('an unchanged amount writes nothing', db.updates.length, before);
  M.saveField('tk1', 'budget', 'cheap');
  eq('the editor rejects text', db.get('todo/tasks/tk1/budget'), 4200);

  // ── the Gantt
  $('[data-view="timeline"]').click(); await tick();
  ok('rows carry amounts', chip('#gtScroll', 'i1') && chip('#gtScroll', 'i1').textContent === '$4.2k' && !!chip('#gtScroll', 'b1'));
  const F2 = M.budgetFlow('p'), cash = $('#gtScroll .gt-cash');
  ok('the cash-flow row states what is scheduled', !!cash && cash.textContent.includes(M.fmtMoney(F2.scheduled) + ' scheduled'), cash && cash.textContent);
  const tips = $$('#gtScroll .gt-cf').map(el => el.dataset.tip);
  ok('each period has its amount and running total', tips.length >= 3 && tips.every(t => /^\$[\d,.]+\|week of .* to date$/.test(t)), tips);
  const sum = tips.reduce((a, t) => a + parseFloat(t.split('|')[0].replace(/[$,]/g, '')), 0);
  ok('the periods add up to the scheduled amount', Math.abs(sum - F2.scheduled) < 0.05, sum + ' vs ' + F2.scheduled);
  ok('the last running total is the scheduled amount', tips[tips.length - 1].includes(M.fmtMoney(F2.scheduled) + ' to date'), tips[tips.length - 1]);
  $('[data-gscale="month"]').click(); await tick();
  const mt = $$('#gtScroll .gt-cf').map(el => el.dataset.tip);
  ok('months add up too', Math.abs(mt.reduce((a, t) => a + parseFloat(t.split('|')[0].replace(/[$,]/g, '')), 0) - F2.scheduled) < 0.05 && mt.every(t => /\|[A-Z][a-z]+ \d{4} · /.test(t)), mt);
  chip('#gtScroll', 'i4').click(); inp = $('#gtScroll .bud-inl'); inp.value = '1.8k'; key(inp, 'Enter');
  eq('an amount typed on a Gantt row saves', db.get('todo/maps/p/nodes/i4/budget'), 1800);
  ok('and the row repaints', chip('#gtScroll', 'i4') ? chip('#gtScroll', 'i4').textContent === '$1.8k' : $('#gtScroll .bud-inl').dataset.budget !== 'i4');
  if ($('#gtScroll .bud-inl')) key($('#gtScroll .bud-inl'), 'Escape');
  $('#tlHost [data-budget-toggle]').click(); await tick();
  ok('turning budget off restores the plain Gantt', !$('#gtScroll .bud') && !$('#gtScroll .gt-cash') && !$('#tlHost .budget-bar') && w.localStorage.getItem('oym_budget') === '0');

  // ── Tasks and Markdown
  $('[data-view="tasks"]').click(); await tick();
  const head = $('[data-project-group="p"] .project-count').textContent;
  ok('the project heading shows its budget', /\$25,000 budget/.test(head), head);
  ok('unassigned tasks add up under No project', /\$120 budget/.test($('[data-project-group=""] .project-count').textContent));
  ok('a task row shows its amount', /\$120/.test($('.task[data-id="free"] .t-meta').textContent));
  $('.task[data-id="free"] [data-act="edit"]').click(); await tick();
  const ef = $('.editor[data-id="free"] [data-f="budget"]');
  ok('the editor has a Budget field', !!ef && ef.value === '$120');
  ef.value = '300'; ef.dispatchEvent(new w.Event('change', { bubbles: true }));
  eq('and saves it', db.get('todo/tasks/free/budget'), 300);
  const md = M.mapMarkdown('p');
  ok('Markdown carries the amounts', /- Project budget: \$25,000/.test(md) && /- Budget: \$4,200/.test(md) && /- Budget: \$12,000/.test(md) && /Allocated inside: \$\d/.test(md), md);

  console.log(`\nbudget: ${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
