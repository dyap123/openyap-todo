// Real Chrome, synthetic read-only Firebase, all external requests blocked.
// NODE_PATH=<playwright modules> node tests/orbit-browser.cjs
const fs=require('fs'),path=require('path'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_BIN||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>{const u=new URL(route.request().url());if(u.hostname==='todo.test'){const f=path.join(root,u.pathname==='/'?'index.html':u.pathname);if(fs.existsSync(f))return route.fulfill({body:fs.readFileSync(f),contentType:f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream'})}return route.abort()});
 await page.addInitScript(()=>{
  const nodes={b:{kind:'branch',parent:'root',title:'Prepare launch',desc:'Organize design, delivery and launch',order:1}},tasks={};
  for(let i=0;i<12;i++){tasks['t'+i]={title:['Sketch the vision','Build prototype','Test with users','Prepare release'][i%4]+' '+(i+1),notes:'A clear task description with details about what done looks like.',projectId:'p',dueDate:'2026-10-'+String(i+1).padStart(2,'0')};nodes['n'+i]={parent:'b',kind:'item',taskId:'t'+i,order:i}}
  const seed={tasks,maps:{p:{nodes}},projects:{p:{name:'Bring the vision to life',description:'A project with a purpose and a practical plan.',status:'active'}},history:{}};
  const user={uid:'owner',email:'dyap123@gmail.com',emailVerified:true};let cb;const auth={onAuthStateChanged:f=>{cb=f;setTimeout(()=>f(user),0)},getRedirectResult:async()=>{},signOut:async()=>cb(null)};
  window.firebase={apps:[],initializeApp(){this.apps.push({})},auth:Object.assign(()=>auth,{GoogleAuthProvider:function(){this.setCustomParameters=()=>{}}}),database:()=>({ref:(p='')=>({on:(event,f)=>f({val:()=>p==='.info/connected'?true:p.split('/').slice(1).reduce((v,k)=>v?.[k],seed)||null}),off(){},push:()=>({key:'synthetic'}),update:()=>Promise.reject(new Error('Read-only browser fixture'))})})};
 });
 await page.goto('http://todo.test/');await page.locator('#gate').waitFor({state:'hidden'});await page.locator('[data-view="map"]').click();await page.getByRole('button',{name:'Show descriptions',exact:true}).click();
 await page.screenshot({path:'/private/tmp/oy-todo-map-descriptions.png',fullPage:true});
 await page.getByRole('button',{name:'Chronology',exact:true}).click();assert.equal(await page.locator('.orbit-tile').count(),8);
 const before=await page.locator('.orbit-slot').first().getAttribute('style');await page.getByRole('button',{name:'Play timeline',exact:true}).click();await page.waitForTimeout(600);assert.notEqual(await page.locator('.orbit-slot').first().getAttribute('style'),before);assert.equal(await page.locator('.orbit-tile').first().evaluate(el=>getComputedStyle(el).rotate),'none');await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.screenshot({path:'/private/tmp/oy-todo-orbit-desktop.png',fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(50);
 assert.equal(await page.evaluate(()=>document.body.scrollWidth),390);
 assert(await page.locator('.orbit-center').evaluate(el=>{const r=el.getBoundingClientRect(),v=el.closest('.orbit-viewport').getBoundingClientRect();return r.left>=v.left&&r.right<=v.right}));
 await page.screenshot({path:'/private/tmp/oy-todo-orbit-mobile.png',fullPage:true});
 await page.locator('.clock-list [data-chrono-open]').first().click();assert(await page.locator('[data-completion-time]').isVisible());await page.screenshot({path:'/private/tmp/oy-todo-completion-mobile.png',fullPage:true});
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.emulateMedia({reducedMotion:'reduce'});const stationary=await page.locator('.orbit-slot').first().getAttribute('style');await page.getByRole('button',{name:'Play timeline',exact:true}).click();await page.waitForTimeout(150);const staticNow=await page.locator('.orbit-slot').first().getAttribute('style');await page.waitForTimeout(150);assert.equal(await page.locator('.orbit-slot').first().getAttribute('style'),staticNow);
 await page.getByRole('button',{name:'Gantt timeline',exact:true}).click();assert(await page.locator('.gt-playhead').isVisible());assert.deepEqual(errors,[]);
 console.log('orbit browser: animation, upright text, descriptions, mobile containment/centering, completion panel, reduced motion and shared Gantt passed');
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
