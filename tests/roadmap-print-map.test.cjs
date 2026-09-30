// Exercise the generated PDF itself: physical page dimensions, palette paint, selected content,
// context on continuation pages, and the larger type available on 11 × 17 paper.
const assert=require('assert/strict'),fs=require('fs'),os=require('os'),path=require('path'),cp=require('child_process'),zlib=require('zlib');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8')
  .replace(/<script src="https:\/\/www\.gstatic[^>]*><\/script>/g,'')
  .replace(/<script src="https:\/\/cdn\.jsdelivr[^>]*><\/script>/g,'')
  .replace(/<link[^>]*fonts\.g[^>]*>/g,'');
const seed={todo:{projects:{p:{name:'Print clarity proof'}},maps:{p:{palette:'sunset',nodes:{
  b:{kind:'branch',parent:'root',title:'Readable career branch',completed:true,completedAt:'2026-09-20T12:00:00Z'},
  t:{kind:'topic',parent:'b',title:'Selected topic with a useful longer label',desc:'A short selected description that should print beneath its heading.',order:0},
  i:{kind:'item',parent:'t',title:'Selected deliverable with a longer label that wraps within the bubble',due:'2026-10-02',desc:'Task detail remains legible in the print export.'},
  b2:{kind:'branch',parent:'root',title:'Second continuation branch',order:1},
  t2:{kind:'topic',parent:'b2',title:'Second selected topic',order:0},
  i2:{kind:'item',parent:'t2',title:'Second topic deliverable',order:0},
  b3:{kind:'branch',parent:'root',title:'Excluded branch',order:2},
  t3:{kind:'topic',parent:'b3',title:'Excluded topic',order:0},
  i3:{kind:'item',parent:'t3',title:'Do Not Export this private roadmap item',order:0}
}}},tasks:{},history:{}}};
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://todo.test/',beforeParse(w){
  w.matchMedia=()=>({matches:true,addListener(){},removeListener(){},addEventListener(){}});w.jspdf=require('jspdf');
  const listeners=[],data=JSON.parse(JSON.stringify(seed));const get=p=>p.split('/').filter(Boolean).reduce((a,k)=>a?.[k],data);
  w.firebase={apps:[],initializeApp(){this.apps.push({})},database:()=>({ref(p=''){return {on(ev,cb){listeners.push([p,cb]);const val=get(p);cb({val:()=>val??null})},off(){},update(o){for(const [key,value] of Object.entries(o)){let at=data;const parts=(p?p+'/':'').concat(key).split('/');for(const k of parts.slice(0,-1))at=at[k]??=( {});if(value===null)delete at[parts.at(-1)];else at[parts.at(-1)]=value}for(const [q,cb] of listeners){const v=get(q);cb({val:()=>v??null})}return Promise.resolve()},set(){return Promise.resolve()},push(){return {key:'x'}}}}}),auth:Object.assign(()=>({onAuthStateChanged(cb){setTimeout(()=>cb({uid:'u',email:'dyap123@gmail.com',emailVerified:true}),0)},getRedirectResult:()=>Promise.resolve()}),{GoogleAuthProvider:function(){this.setCustomParameters=()=>{}}})};
}});
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'oy-print-map-'));
const run=(bin,args)=>{const r=cp.spawnSync(bin,args,{encoding:'utf8'});if(r.status!==0)throw new Error(`${bin} ${args.join(' ')} failed: ${r.stderr}`);return r.stdout};
function pngPixels(file){const b=fs.readFileSync(file);assert.equal(b.toString('hex',0,8),'89504e470d0a1a0a');let at=8,w=0,h=0,depth=0,type=0,parts=[];while(at<b.length){const size=b.readUInt32BE(at),name=b.toString('ascii',at+4,at+8),data=b.subarray(at+8,at+8+size);if(name==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);depth=data[8];type=data[9]}if(name==='IDAT')parts.push(data);at+=size+12;if(name==='IEND')break}assert.equal(depth,8);assert([2,6].includes(type));const bpp=type===6?4:3,stride=w*bpp,raw=zlib.inflateSync(Buffer.concat(parts)),pixels=Buffer.alloc(h*stride);for(let y=0;y<h;y++){const src=y*(stride+1)+1,dst=y*stride,f=raw[y*(stride+1)],paeth=(a,c,d)=>{const p=a+c-d,pa=Math.abs(p-a),pc=Math.abs(p-c),pd=Math.abs(p-d);return pa<=pc&&pa<=pd?a:pc<=pd?c:d};for(let x=0;x<stride;x++){const val=raw[src+x],left=x>=bpp?pixels[dst+x-bpp]:0,up=y?pixels[dst-stride+x]:0,ul=y&&x>=bpp?pixels[dst-stride+x-bpp]:0;pixels[dst+x]=(val+(f===1?left:f===2?up:f===3?Math.floor((left+up)/2):f===4?paeth(left,up,ul):0))&255}}return {w,h,bpp,pixels}}
function routeSegments(d){const t=d.match(/[MHV]|-?[\d.]+/g)||[];let x=0,y=0,out=[];for(let i=0;i<t.length;){const op=t[i++];if(op==='M'){x=+t[i++];y=+t[i++]}else if(op==='H'){const nx=+t[i++];out.push([x,y,nx,y]);x=nx}else if(op==='V'){const ny=+t[i++];out.push([x,y,x,ny]);y=ny}}return out}
function crossesInterior(a,b){const [ax,ay,ax2,ay2]=a,[bx,by,bx2,by2]=b;if(ax===ax2&&by===by2)return ax>Math.min(bx,bx2)+1e-6&&ax<Math.max(bx,bx2)-1e-6&&by>Math.min(ay,ay2)+1e-6&&by<Math.max(ay,ay2)-1e-6;if(ay===ay2&&bx===bx2)return bx>Math.min(ax,ax2)+1e-6&&bx<Math.max(ax,ax2)-1e-6&&ay>Math.min(by,by2)+1e-6&&ay<Math.max(by,by2)-1e-6;return false}
function overlapsCollinear(a,b){const [ax,ay,ax2,ay2]=a,[bx,by,bx2,by2]=b;if(ay===ay2&&by===by2&&Math.abs(ay-by)<1e-6)return Math.min(Math.max(ax,ax2),Math.max(bx,bx2))-Math.max(Math.min(ax,ax2),Math.min(bx,bx2))>1e-6;if(ax===ax2&&bx===bx2&&Math.abs(ax-bx)<1e-6)return Math.min(Math.max(ay,ay2),Math.max(by,by2))-Math.max(Math.min(ay,ay2),Math.min(by,by2))>1e-6;return false}
function segmentHitsCard([x1,y1,x2,y2],r){if(y1===y2)return y1>r.y&&y1<r.y+r.h&&Math.max(Math.min(x1,x2),r.x)<Math.min(Math.max(x1,x2),r.x+r.w);if(x1===x2)return x1>r.x&&x1<r.x+r.w&&Math.max(Math.min(y1,y2),r.y)<Math.min(Math.max(y1,y2),r.y+r.h);return false}
function exportPdf(paper,excluded=[],desc=true,theme='light',orientation='auto'){const pdf=dom.window.__oym.buildRoadmap({pid:'p',paper,time:false,schedule:false,map:true,desc,theme,excluded,orientation});const file=path.join(dir,paper+(desc?'':'-no-desc')+'-'+theme+'-'+orientation+'.pdf');fs.writeFileSync(file,Buffer.from(pdf.output('arraybuffer')));return {pdf,file}}
(async()=>{await new Promise(r=>setTimeout(r,100));try{
  const M=dom.window.__oym;assert(M,'map app initialized');
  assert.deepEqual(Object.keys(M.maps.p.nodes).length,9,'the synthetic project map loaded before exporting');
  const nodes=M.maps.p.nodes;
  // A 6 × 5 × 5 map resembles the dense projects that previously expanded to dozens of sheets.
  for(let b=0;b<6;b++){const bid=`denseB${b}`;nodes[bid]={kind:'branch',parent:'root',title:`Dense branch ${String(b+1).padStart(2,'0')}`,order:b+3};
    for(let t=0;t<5;t++){const tid=`${bid}T${t}`;nodes[tid]={kind:'topic',parent:bid,title:`Dense topic ${String(b+1).padStart(2,'0')}-${String(t+1).padStart(2,'0')}`,order:t};
      for(let i=0;i<5;i++){const iid=`${tid}I${i}`;nodes[iid]={kind:'item',parent:tid,title:`Dense item ${String(b+1).padStart(2,'0')}-${String(t+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`,order:i,...(b===0&&t===0&&i===0?{completed:true,completedAt:'2026-09-18T12:00:00Z'}:{}),...(b===0&&t===0&&i===1?{due:'2020-01-01'}:{})}}}}
  const excluded=['b3','t3','i3'],chosen=M.roadmapNodes('p',{excluded});
  assert.equal(Object.keys(chosen).length,192,'all visible dense and fixture nodes remain selected');
  const tabloid=exportPdf('tabloid',excluded),letter=exportPdf('letter',excluded),tabloidNoDesc=exportPdf('tabloid',excluded,false),dark=exportPdf('tabloid',excluded,true,'dark'),tabloidHorizontal=exportPdf('tabloid',excluded,true,'light','landscape'),tabloidVertical=exportPdf('tabloid',excluded,true,'light','portrait');
  const layout=M.mapLayout(chosen,true);
  for(const [id,c] of Object.entries(layout.C).filter(([,c])=>c.kind==='branch'&&c.slot==='bottom')){
    const kids=Object.entries(layout.C).filter(([kid,c])=>chosen[kid]?.kind==='topic'&&chosen[kid].parent===id).sort((a,b)=>(a[1].x+a[1].w/2)-(b[1].x+b[1].w/2));
    if(kids.length<2)continue;
    const busY=kids[0][1].y-26,centers=kids.map(([,k])=>k.x+k.w/2),parentPaths=layout.L.filter(l=>l.to===id),path=parentPaths.find(l=>l.role==='bus')?.d,parent=parentPaths.find(l=>l.role==='parent');
    assert.equal(parentPaths.length,2,`${id} retains separate root-parent and sibling-bus connections`);assert(parent,`${id} has a root-parent connector`);assert.equal((path.match(/H/g)||[]).length,2,`${id} has one continuous shared sibling bus`);
    const segments=routeSegments(path);assert.equal(segments.length,3,`${id} route uses one centered trunk and one continuous sibling bus`);assert.equal(segments[0][0],c.x+c.w/2,`${id} trunk descends from the branch center`);assert.deepEqual([segments[1][1],segments[2][1]],[busY,busY]);assert.deepEqual([segments[1][2],segments[2][2]].sort((a,b)=>a-b),centers.slice().sort((a,b)=>a===b?0:a-b).filter((_,i)=>i===0||i===centers.length-1),`${id} bus reaches first and last child centers`);
    const owned=new Set([id,...kids.map(([kid])=>kid)]),cards=Object.entries(layout.C).filter(([other])=>other!=='root'&&!owned.has(other)),ours=[...segments,...routeSegments(parent.d),...kids.flatMap(([kid])=>layout.L.filter(l=>l.to===kid).flatMap(l=>routeSegments(l.d)))];for(const s of ours)for(const [other,card] of cards)assert(!segmentHitsCard(s,card),`${id} source/escape/parent/child route avoids unrelated map card ${other}`);
    assert(segments[0][0]===segments[0][2]&&segments[0][1]===c.y+c.h&&segments[0][3]===busY,`${id} long route leg stays in the measured whitespace beneath the branch`);
    assert(busY-c.y-c.h>100,`${id} dense layout exposes the long trunk separately from its short child drops`);
    for(const [kid,k] of kids){const drops=layout.L.filter(l=>l.to===kid);assert.equal(drops.length,1,`${kid} has one connected drop from the bus`);assert.equal(drops[0].d,`M${k.x+k.w/2} ${busY}V${k.y}`,`${kid} drop lands at its card center`);assert.equal(k.y-busY,26,`${kid} has a fixed short, isolated drop from the sibling bus`)}
  }
  assert(layout.L.some(l=>l.to==='denseB3'),'dense bottom branch fixture exercises sibling bus routing');
  // The export theme is its own accessible preference and must not alter app appearance.
  const appTheme=dom.window.document.documentElement.dataset.theme||'';dom.window.document.querySelector('#exportBtn').click();
  dom.window.document.querySelector('[data-extab="roadmap"]').click();
  const orientationControl=dom.window.document.querySelector('#roadmapPdfOrientation');assert(orientationControl);assert.equal(orientationControl.getAttribute('aria-label'),'Roadmap PDF orientation');assert.equal(orientationControl.value,'auto','Automatic best-fit orientation is the default');assert(['auto',null].includes(dom.window.localStorage.getItem('oym_exrorientation')),'default orientation is not forced');
  const chooseOrientation=value=>{const control=dom.window.document.querySelector('#roadmapPdfOrientation');control.value=value;control.dispatchEvent(new dom.window.Event('change',{bubbles:true}))};
  chooseOrientation('landscape');assert.equal(M.EX.rorientation,'landscape');assert.equal(dom.window.localStorage.getItem('oym_exrorientation'),'landscape','Horizontal choice persists');assert.equal(dom.window.document.querySelector('#roadmapPdfOrientation').value,'landscape');
  chooseOrientation('portrait');assert.equal(M.EX.rorientation,'portrait');assert.equal(dom.window.localStorage.getItem('oym_exrorientation'),'portrait','Vertical choice persists');
  chooseOrientation('auto');assert.equal(dom.window.localStorage.getItem('oym_exrorientation'),'auto','Automatic can be restored after forcing an orientation');
  const themeControl=dom.window.document.querySelector('#roadmapMapTheme');assert(themeControl);assert.equal(themeControl.getAttribute('aria-label'),'Roadmap PDF theme');assert.match(themeControl.parentElement.textContent,/every selected Roadmap page/);assert.equal(themeControl.value,'light');
  themeControl.value='dark';themeControl.dispatchEvent(new dom.window.Event('change',{bubbles:true}));
  assert.equal(M.EX.rtheme,'dark');assert.equal(dom.window.localStorage.getItem('oym_exrtheme'),'dark');assert.equal(dom.window.document.documentElement.dataset.theme||'',appTheme,'PDF theme is independent from app theme');
  const info=run('pdfinfo',[tabloid.file]);assert.match(info,/Pages:\s+1\s/);
  const tabloidPortrait=/Page size:\s+792 x 1224 pts/.test(info);assert(tabloidPortrait||/Page size:\s+1224 x 792 pts/.test(info),'11×17 page uses whichever orientation gives the map more scale');
  assert.equal(tabloidPortrait,M.mapPrintOrientation(chosen,'tabloid',true)==='portrait','11×17 orientation is selected using routing-aware map bounds');
  const forcedHorizontalInfo=run('pdfinfo',['-f','1','-l','1',tabloidHorizontal.file]),forcedVerticalInfo=run('pdfinfo',['-f','1','-l','1',tabloidVertical.file]);assert.match(forcedHorizontalInfo,/Page\s+1 size:\s+1224 x 792 pts/,'forced Horizontal map-only PDF is 11×17 landscape');assert.match(forcedVerticalInfo,/Page\s+1 size:\s+792 x 1224 pts/,'forced Vertical map-only PDF is 11×17 portrait');
  assert.equal(tabloid.pdf.getNumberOfPages(),1,'all selected dense-map nodes fit on one 11×17 page');
  assert.equal(letter.pdf.getNumberOfPages(),1,'all selected nodes fit on one Letter page too');
  assert.equal(tabloidNoDesc.pdf.getNumberOfPages(),1,'the no-description map also stays on one 11×17 sheet');
  assert.equal(dark.pdf.getNumberOfPages(),1,'dark map uses the same one-page sheet');
  const letterInfo=run('pdfinfo',[letter.file]);assert.match(letterInfo,/Pages:\s+1\s/);assert(/Page size:\s+(792 x 612|612 x 792) pts/.test(letterInfo));
  const pdfSource=fs.readFileSync(tabloid.file,'latin1');assert(pdfSource.includes('/OpenAction')&&/\/Fit\b/.test(pdfSource),'the PDF opens at fit-page zoom, ready for vector zooming');
  const text=run('pdftotext',[tabloid.file,'-']).replace(/\s+/g,' ');
  assert(!/Generated\s+\w/.test(text),'map-only Roadmap output omits the generated-date stamp');
  for(const label of ['Readable career branch','Selected topic with a useful longer label','Selected deliverable with a longer label','Second continuation branch','Second selected topic','Second topic deliverable','Dense branch 06','Dense topic 06-05','Dense item 06-05-05','Done 2026-09-18','DONE 2026-09-20','Due Oct 2','selected description','Task detail remains legible'])assert(text.includes(label),`PDF text includes ${label}: ${text.slice(0,2500)}`);
  for(let b=0;b<6;b++){assert(text.includes(`Dense branch ${String(b+1).padStart(2,'0')}`));for(let t=0;t<5;t++){assert(text.includes(`Dense topic ${String(b+1).padStart(2,'0')}-${String(t+1).padStart(2,'0')}`));for(let i=0;i<5;i++)assert(text.includes(`Dense item ${String(b+1).padStart(2,'0')}-${String(t+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`))}}
  assert(!text.includes('Do Not Export'),'excluded branches do not leak into print pages');
  const darkText=run('pdftotext',[dark.file,'-']).replace(/\s+/g,' ');assert(darkText.includes('Dense branch 06')&&darkText.includes('Selected topic with a useful longer label'),'dark map retains vector content');
  const compactText=run('pdftotext',[tabloidNoDesc.file,'-']).replace(/\s+/g,' ');assert(!/Generated\s+\w/.test(compactText),'no-description map also omits the generated stamp');assert(compactText.includes('Readable career branch')&&compactText.includes('Due Oct 2'),'title and due date remain in the no-description row layout');
  const fonts=run('pdffonts',[tabloid.file]);assert.match(fonts,/Helvetica/i,'map labels remain real vector fonts');
  assert.doesNotMatch(run('pdfimages',['-list',tabloid.file]),/\n\s*1\s+\d+\s+image\s/,'the map is not flattened into page images');
  const boxes=run('pdftotext',['-f','1','-l','1','-bbox',tabloid.file,'-']);
  const bounds=[...boxes.matchAll(/<word xMin="([^"]+)" yMin="([^"]+)" xMax="([^"]+)" yMax="([^"]+)"/g)].map(m=>m.slice(1).map(Number));
  const pageSize=/Page size:\s+(\d+) x (\d+) pts/.exec(info);assert(pageSize);const pageW=Number(pageSize[1]),pageH=Number(pageSize[2]);
  assert(bounds.length>300,'all dense-map vector labels have PDF text bounds');assert(bounds.every(([x0,y0,x1,y1])=>x0>=0&&y0>=0&&x1<=pageW&&y1<=pageH),'all vector text stays inside the sheet bounds');
  const glyphHeights=bounds.map(([,y0,,y1])=>y1-y0).sort((a,b)=>a-b),minGlyphHeight=glyphHeights[0],medianGlyphHeight=glyphHeights[Math.floor(glyphHeights.length/2)],p90GlyphHeight=glyphHeights[Math.floor(glyphHeights.length*.9)];
  assert(medianGlyphHeight>=2.8,`median map glyph is at least 2.8pt high (got ${medianGlyphHeight.toFixed(3)}pt)`);assert(p90GlyphHeight>=3.1,`large-map labels reach at least 3.1pt glyph height (got ${p90GlyphHeight.toFixed(3)}pt)`);
  const png=path.join(dir,'tabloid');run('pdftoppm',['-f','1','-l','1','-r','72','-singlefile','-png',tabloid.file,png]);
  fs.copyFileSync(png+'.png','/private/tmp/oy-todo-print-map-preview.png');
  const raster=pngPixels(png+'.png');assert.deepEqual([raster.w,raster.h],[pageW,pageH],'rasterized 11×17 page renders at print dimensions');
  const routePng=path.join(dir,'tabloid-no-desc');run('pdftoppm',['-f','1','-l','1','-r','72','-singlefile','-png',tabloidNoDesc.file,routePng]);const routeRaster=pngPixels(routePng+'.png');
  const scale=Math.min((pageW-68)/layout.box.w,(pageH-90)/layout.box.h),ox=34+((pageW-68)-layout.box.w*scale)/2-layout.box.x*scale,oy=56+((pageH-90)-layout.box.h*scale)/2-layout.box.y*scale;
  const darkAt=(px,py)=>{for(let y=Math.max(0,Math.floor(py)-2);y<=Math.min(routeRaster.h-1,Math.ceil(py)+2);y++)for(let x=Math.max(0,Math.floor(px)-2);x<=Math.min(routeRaster.w-1,Math.ceil(px)+2);x++){const i=(y*routeRaster.w+x)*routeRaster.bpp;if(routeRaster.pixels[i]<245||routeRaster.pixels[i+1]<245||routeRaster.pixels[i+2]<245)return true}return false};
  const bottomBranches=Object.entries(layout.C).filter(([,c])=>c.kind==='branch'&&c.slot==='bottom');assert.equal(bottomBranches.length,1,'root layout has only one bottom branch bus, so sibling buses cannot overlap each other');
  for(const [bid,branch] of bottomBranches){const kids=Object.entries(layout.C).filter(([id,c])=>chosen[id]?.kind==='topic'&&chosen[id].parent===bid).sort((a,b)=>a[1].x-b[1].x),busY=kids[0][1].y-26;
    for(let i=0;i<kids.length;i++){const [kid,c]=kids[i],cx=ox+(c.x+c.w/2)*scale,cy=oy+(busY+13)*scale;assert(darkAt(cx,cy),`raster contains the distinct short drop for ${kid}`);if(i<kids.length-1){const nextCenter=ox+(kids[i+1][1].x+kids[i+1][1].w/2)*scale;assert(darkAt((cx+nextCenter)/2,oy+busY*scale),`raster contains the sibling bus between ${kid} and ${kids[i+1][0]}`)}}
    const owned=new Set([bid,...kids.map(([id])=>id)]),ours=layout.L.filter(l=>owned.has(l.to)).flatMap(l=>routeSegments(l.d)),others=layout.L.filter(l=>!owned.has(l.to)).flatMap(l=>routeSegments(l.d));
    for(const a of ours)for(const b of others){assert(!crossesInterior(a,b),`bottom sibling bus/drop has no interior crossing with another branch route (${a.join(',')} × ${b.join(',')})`);assert(!overlapsCollinear(a,b),`bottom sibling bus/drop has no collinear overlap with another branch route (${a.join(',')} × ${b.join(',')})`)}
  }
  let palettePixels=0;for(let i=0;i<raster.pixels.length;i+=raster.bpp)if(raster.pixels[i]===252&&raster.pixels[i+1]===222&&raster.pixels[i+2]===204)palettePixels++;
  assert(palettePixels>0,'selected Sunset palette is painted into the zoomable map sheet');
  const darkPng=path.join(dir,'dark');run('pdftoppm',['-f','1','-l','1','-r','72','-singlefile','-png',dark.file,darkPng]);
  const darkRaster=pngPixels(darkPng+'.png');let bgPixels=0,lightTextPixels=0,darkPalettePixels=0;
  for(let i=0;i<darkRaster.pixels.length;i+=darkRaster.bpp){const r=darkRaster.pixels[i],g=darkRaster.pixels[i+1],b=darkRaster.pixels[i+2];if(r<45&&g<50&&b<65)bgPixels++;if(r>205&&g>205&&b>205)lightTextPixels++;if(r>90&&r<255&&g<170&&b<180)darkPalettePixels++}
  assert(bgPixels>1000,'dark map paints the page with its dark theme background');assert(lightTextPixels>100,'dark map retains high-contrast light vector text');assert(darkPalettePixels>100,'dark map keeps recognizable contrast-safe palette fills');
  const combo= M.buildRoadmap({pid:'p',paper:'tabloid',time:true,schedule:true,map:true,desc:true,theme:'dark'}),comboFile=path.join(dir,'combined-dark.pdf');fs.writeFileSync(comboFile,Buffer.from(combo.output('arraybuffer')));assert(combo.getNumberOfPages()>=3,'combined fixture has Timeline, Schedule and map pages');
  for(const [orientation,expected] of [['landscape','1224 x 792'],['portrait','792 x 1224']]){const forced=M.buildRoadmap({pid:'p',paper:'tabloid',time:true,schedule:true,map:true,desc:true,theme:'light',orientation}),forcedFile=path.join(dir,`combined-${orientation}.pdf`);fs.writeFileSync(forcedFile,Buffer.from(forced.output('arraybuffer')));assert(forced.getNumberOfPages()>=3,`combined ${orientation} fixture includes Timeline, Schedule and map pages`);const pages=run('pdfinfo',['-f','1','-l',String(forced.getNumberOfPages()),forcedFile]);assert.equal([...pages.matchAll(/Page\s+\d+ size:\s+(\d+ x \d+) pts/g)].length,forced.getNumberOfPages(),`every forced ${orientation} Roadmap page reports a page size`);assert([...pages.matchAll(/Page\s+\d+ size:\s+(\d+ x \d+) pts/g)].every(m=>m[1]===expected),`every combined ${orientation} export page uses ${expected}pt dimensions`)}
  const comboPages=combo.internal.pages.slice(1).map(p=>p.join('\n'));assert(comboPages.some(p=>p.includes('Overdue')),'combined fixture includes an overdue Schedule row');assert(comboPages.some(p=>p.includes('Overdue')&&p.includes('0.855 0.6 0.573 rg')),'overdue Schedule text uses the contrast-adjusted light red in Dark mode');
  for(let page=1;page<=combo.getNumberOfPages();page++){const base=path.join(dir,`combined-${page}`);run('pdftoppm',['-f',String(page),'-l',String(page),'-r','72','-singlefile','-png',comboFile,base]);const pageRaster=pngPixels(base+'.png');let bg=0,light=0;for(let i=0;i<pageRaster.pixels.length;i+=pageRaster.bpp){const r=pageRaster.pixels[i],g=pageRaster.pixels[i+1],b=pageRaster.pixels[i+2];if(r<45&&g<50&&b<65)bg++;if(r>205&&g>205&&b>205)light++}assert(bg>1000,`combined dark page ${page} has a dark raster background`);assert(light>100,`combined dark page ${page} has contrasting light raster text`)}
  console.log(`roadmap print map: 192 nodes on one ${pageW}×${pageH}pt vector page; glyph median ${medianGlyphHeight.toFixed(2)}pt (min ${minGlyphHeight.toFixed(2)}pt), palette/date/completion/description/filter checks passed`);
}finally{dom.window.close();fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exit(1)});
