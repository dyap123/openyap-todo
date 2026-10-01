// Budget in real Chrome: chips stay inside their cards and rows, click-to-click entry is not
// swallowed by a repaint, Enter walks the amounts, and the Gantt cash-flow row holds its place.
// Synthetic writable Firebase only; all external requests blocked.
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{chromium}=require('playwright');const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});try{
const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('**/*',r=>{const u=new URL(r.request().url()),f=path.join(root,u.pathname==='/'?'index.html':u.pathname);if(u.hostname==='todo.test'&&fs.existsSync(f))return r.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':'text/html'});return r.abort()});
await p.addInitScript(()=>{
  const item=(parent,title,order,more)=>({kind:'item',parent,title,order,...more});
  const data={todo:{projects:{p:{name:'Shop fit-out',status:'active'}},sides:{p:{side:'career',private:false}},history:{},
    tasks:{tk1:{title:'Order structural steel for the mezzanine',projectId:'p',side:'career',startDate:'2026-10-05',dueDate:'2026-10-16',budget:38500},u1:{title:'Permit fee',projectId:'p',side:'career',budget:1250},loose:{title:'Loose task',side:'career',budget:120}},
    maps:{p:{budget:150000,nodes:{
      b1:{kind:'branch',parent:'root',title:'Structure and mezzanine framing',order:1,budget:60000,completed:true,completedAt:'2026-09-20T20:00:00Z'},
      t1:{kind:'topic',parent:'b1',title:'Steel frame — fabrication and erection',order:1,due:'2026-10-30',completed:true,completedAt:'2026-09-20T20:00:00Z'},
      i1:item('t1','Order structural steel for the mezzanine',1,{taskId:'tk1'}),i2:item('t1','Field welding and inspection sign-off',2,{start:'2026-10-19',due:'2026-10-30',budget:14200}),i3:item('t1','Crane and rigging',3,{due:'2026-10-21',budget:9800}),
      b2:{kind:'branch',parent:'root',title:'Finishes',order:2,budget:45000},
      t2:{kind:'topic',parent:'b2',title:'Paint and flooring',order:1},
      i4:item('t2','Primer and two coats',1,{start:'2026-11-02',due:'2026-11-13',budget:12000}),i5:item('t2','Polished concrete floor',2,{start:'2026-11-16',due:'2026-12-04',budget:36500}),
      b3:{kind:'branch',parent:'root',title:'Services',order:3},
      i6:item('b3','Electrical rough-in',1,{due:'2026-11-06',budget:8400}),i7:item('b3','Fire alarm tie-in',2,{}),
      b4:{kind:'branch',parent:'root',title:'Closeout',order:4,budget:6000},
      t4:{kind:'topic',parent:'b4',title:'Punch list',order:1,start:'2026-12-07',due:'2026-12-18'}}}}}},listeners=[],get=x=>x.split('/').filter(Boolean).reduce((v,k)=>v?.[k],data);
  window.fixture=data;window.fixtureUpdates=[];
  const ref=(x='')=>({on:(e,f)=>{if(x==='.info/connected'){f({val:()=>true});return}listeners.push([x,f]);f({val:()=>get(x)||null})},off(){},push:()=>({key:'fixture'+Math.random().toString(36).slice(2)}),
    update:async patch=>{window.fixtureUpdates.push(patch);for(const [key,value]of Object.entries(patch)){const keys=key.split('/');let o=data;for(const k of keys.slice(0,-1))o=o[k]||(o[k]={});if(value===null)delete o[keys.at(-1)];else o[keys.at(-1)]=value}for(const [x,f]of listeners)f({val:()=>get(x)||null})}});
  window.firebase={apps:[],initializeApp(){this.apps.push({})},auth:Object.assign(()=>({onAuthStateChanged:f=>setTimeout(()=>f({uid:'owner',email:'dyap123@gmail.com',emailVerified:true}),0),getRedirectResult:async()=>{}}),{GoogleAuthProvider:function(){this.setCustomParameters=()=>{}}}),database:()=>({ref})}});
await p.goto('http://todo.test/');await p.locator('#gate').waitFor({state:'hidden'});
const node=id=>p.evaluate(id=>window.fixture.todo.maps.p.nodes[id],id);

// ── Map
await p.locator('[data-view="map"]').click();await p.locator('#mapHost [data-budget-toggle]').click();await p.waitForTimeout(150);
const contained=async scope=>{const bad=await p.evaluate(scope=>{const out=[],inside=(a,b,pad=1)=>a.left>=b.left-pad&&a.right<=b.right+pad&&a.top>=b.top-pad&&a.bottom<=b.bottom+pad,hit=(a,b)=>a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1;
  for(const chip of document.querySelectorAll(scope+' .bud')){const r=chip.getBoundingClientRect(),box=chip.closest('.mp-item,.mp-th,.mp-bh,.mp-root,.gt-name');if(!box){out.push('no box '+chip.dataset.budget);continue}
    if(!inside(r,box.getBoundingClientRect()))out.push('outside '+chip.dataset.budget);
    for(const other of box.querySelectorAll('.map-label-line,.d,.mp-td,.node-completed,.mp-k,.gt-meta,.mp-note')){const o=other.getBoundingClientRect();if(o.width&&o.height&&hit(r,o))out.push(chip.dataset.budget+' overlaps '+other.className+' "'+other.textContent.slice(0,24)+'"')}}
  return out},scope);assert.deepEqual(bad,[])};
await contained('#mapWorld');
assert.equal(await p.locator('#mapWorld [data-budget="b1"]').textContent(),'$60kover $2.5k');
assert.match(await p.locator('#mapHost .budget-bar').textContent(),/Allocated \$126,650[\s\S]*Left to allocate \$23,350[\s\S]*Scheduled \$148,750[\s\S]*No dates yet \$1,250/);
await p.screenshot({path:'/private/tmp/oy-todo-budget-map.png'});
// Click an amount, type, then click straight onto another one: the first saves, the second opens.
await p.locator('#mapWorld [data-budget="i3"]').click();await p.keyboard.type('11.5k');
await p.locator('#mapWorld [data-budget="i2"]').click();await p.waitForTimeout(120);
assert.equal((await node('i3')).budget,11500);
assert.equal(await p.evaluate(()=>document.activeElement.className+'|'+document.activeElement.dataset.budget),'bud-inl|i2');
assert.equal(await p.locator('#mapWorld [data-budget="i3"]').textContent(),'$11.5k');
assert.equal(await p.locator('#mapWorld .bud-inl').count(),1);
// Enter saves and walks on; the totals above follow at once.
await p.keyboard.press('ControlOrMeta+A');await p.keyboard.type('15000');await p.keyboard.press('Enter');
assert.equal((await node('i2')).budget,15000);
assert.equal(await p.evaluate(()=>document.activeElement.dataset.budget),'i3');
assert.match(await p.locator('#mapWorld [data-budget="b1"]').textContent(),/over \$5k/);
await p.keyboard.press('Escape');assert.equal(await p.locator('#mapWorld .bud-inl').count(),0);
// Clicking away onto the canvas saves and repaints without leaving a stale box behind.
await p.locator('#mapWorld [data-budget="i7"]').click();await p.keyboard.type('2k');await p.mouse.click(700,960);await p.waitForTimeout(150);
assert.equal((await node('i7')).budget,2000);assert.equal(await p.locator('.bud-inl').count(),0);assert.equal(await p.locator('#mapWorld [data-budget="i7"]').textContent(),'$2k');
// Selecting a card still works with amounts showing, and its panel edits the same number.
await p.locator('#mapWorld [data-nid="b2"] .mp-t').click();await p.locator('.mp-panel [data-mf="budget"]').fill('50k');await p.keyboard.press('Enter');await p.waitForTimeout(120);
assert.equal((await node('b2')).budget,50000);assert.match(await p.locator('#mapWorld [data-budget="b2"]').textContent(),/^\$50k/);
await p.keyboard.press('Escape');
// Chronology keeps the amounts on the same cards.
await p.getByRole('button',{name:'Chronology',exact:true}).click();await p.waitForTimeout(900);assert.ok(await p.locator('#mapWorld .bud').count()>=10);
await p.getByRole('button',{name:'Back to map',exact:true}).click();await p.waitForTimeout(900);await contained('#mapWorld');

// ── Gantt
await p.locator('[data-view="timeline"]').click();await p.waitForTimeout(200);await contained('#gtScroll');
const cash=await p.evaluate(()=>{const s=document.querySelector('#gtScroll').getBoundingClientRect(),c=document.querySelector('.gt-cash').getBoundingClientRect(),cells=[...document.querySelectorAll('.gt-cf')];
  return {stuck:Math.abs(c.bottom-s.bottom)<3,cells:cells.length,clipped:cells.filter(el=>{const a=el.querySelector('span').getBoundingClientRect(),b=el.getBoundingClientRect();return a.width>b.width+1}).length,text:document.querySelector('.gt-cash .gt-sub').textContent}});
assert.ok(cash.stuck,'cash-flow row sits at the bottom of the chart');assert.ok(cash.cells>=6);assert.equal(cash.clipped,0);assert.match(cash.text,/scheduled, by week/);
await p.locator('#gtScroll [data-budget="i6"]').click();await p.keyboard.press('ControlOrMeta+A');await p.keyboard.type('9k');await p.locator('#gtScroll [data-budget="i4"]').click();await p.waitForTimeout(120);
assert.equal((await node('i6')).budget,9000);assert.equal(await p.evaluate(()=>document.activeElement.dataset.budget),'i4');await p.keyboard.press('Escape');
await p.locator('.gt-cf').first().hover();assert.match(await p.locator('.tip').textContent(),/\$[\d,.]+ week of .* to date/);
await p.screenshot({path:'/private/tmp/oy-todo-budget-gantt.png'});
await p.locator('[data-gscale="month"]').click();await p.waitForTimeout(200);
assert.equal(await p.evaluate(()=>[...document.querySelectorAll('.gt-cf')].filter(el=>el.querySelector('span').getBoundingClientRect().width>el.getBoundingClientRect().width+1).length),0);

// ── Phone
await p.setViewportSize({width:390,height:844});await p.waitForTimeout(200);await contained('#gtScroll');
assert.equal(await p.evaluate(()=>document.body.scrollWidth),390);
await p.locator('[data-view="map"]').click();await p.waitForTimeout(200);assert.equal(await p.evaluate(()=>document.body.scrollWidth),390);
await p.locator('[data-view="tasks"]').click();await p.waitForTimeout(200);
assert.match(await p.locator('[data-project-group="p"] .project-count').textContent(),/\$\d[\d,]* budget/);
await p.screenshot({path:'/private/tmp/oy-todo-budget-mobile.png'});
assert.deepEqual(errors,[]);
console.log('budget browser: chips contained on Map/Chronology/Gantt/phone, click-to-click and Enter entry, canvas click-away, panel edit, sticky cash-flow row with tips passed');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
