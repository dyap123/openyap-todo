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
function exportPdf(paper,excluded=[],desc=true){const pdf=dom.window.__oym.buildRoadmap({pid:'p',paper,time:false,schedule:false,map:true,desc,excluded});const file=path.join(dir,paper+(desc?'':'-no-desc')+'.pdf');fs.writeFileSync(file,Buffer.from(pdf.output('arraybuffer')));return {pdf,file}}
(async()=>{await new Promise(r=>setTimeout(r,100));try{
  const M=dom.window.__oym;assert(M,'map app initialized');
  assert.deepEqual(Object.keys(M.maps.p.nodes).length,9,'the synthetic project map loaded before exporting');
  const nodes=M.maps.p.nodes;
  // A 6 × 5 × 5 map resembles the dense projects that previously expanded to dozens of sheets.
  for(let b=0;b<6;b++){const bid=`denseB${b}`;nodes[bid]={kind:'branch',parent:'root',title:`Dense branch ${String(b+1).padStart(2,'0')}`,order:b+3};
    for(let t=0;t<5;t++){const tid=`${bid}T${t}`;nodes[tid]={kind:'topic',parent:bid,title:`Dense topic ${String(b+1).padStart(2,'0')}-${String(t+1).padStart(2,'0')}`,order:t};
      for(let i=0;i<5;i++){const iid=`${tid}I${i}`;nodes[iid]={kind:'item',parent:tid,title:`Dense item ${String(b+1).padStart(2,'0')}-${String(t+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`,order:i,...(b===0&&t===0&&i===0?{completed:true,completedAt:'2026-09-18T12:00:00Z'}:{})}}}}
  const excluded=['b3','t3','i3'],chosen=M.roadmapNodes('p',{excluded});
  assert.equal(Object.keys(chosen).length,192,'all visible dense and fixture nodes remain selected');
  const tabloid=exportPdf('tabloid',excluded),letter=exportPdf('letter',excluded),tabloidNoDesc=exportPdf('tabloid',excluded,false);
  const info=run('pdfinfo',[tabloid.file]);assert.match(info,/Pages:\s+1\s/);
  const tabloidPortrait=/Page size:\s+792 x 1224 pts/.test(info);assert(tabloidPortrait||/Page size:\s+1224 x 792 pts/.test(info),'11×17 page uses whichever orientation gives the map more scale');
  assert.equal(tabloid.pdf.getNumberOfPages(),1,'all selected dense-map nodes fit on one 11×17 page');
  assert.equal(letter.pdf.getNumberOfPages(),1,'all selected nodes fit on one Letter page too');
  assert.equal(tabloidNoDesc.pdf.getNumberOfPages(),1,'the no-description map also stays on one 11×17 sheet');
  const letterInfo=run('pdfinfo',[letter.file]);assert.match(letterInfo,/Pages:\s+1\s/);assert(/Page size:\s+(792 x 612|612 x 792) pts/.test(letterInfo));
  const pdfSource=fs.readFileSync(tabloid.file,'latin1');assert(pdfSource.includes('/OpenAction')&&/\/Fit\b/.test(pdfSource),'the PDF opens at fit-page zoom, ready for vector zooming');
  const text=run('pdftotext',[tabloid.file,'-']).replace(/\s+/g,' ');
  assert(!/Generated\s+\w/.test(text),'map-only Roadmap output omits the generated-date stamp');
  for(const label of ['Readable career branch','Selected topic with a useful longer label','Selected deliverable with a longer label','Second continuation branch','Second selected topic','Second topic deliverable','Dense branch 06','Dense topic 06-05','Dense item 06-05-05','Done 2026-09-18','DONE 2026-09-20','Due Oct 2','selected description','Task detail remains legible'])assert(text.includes(label),`PDF text includes ${label}: ${text.slice(0,2500)}`);
  for(let b=0;b<6;b++){assert(text.includes(`Dense branch ${String(b+1).padStart(2,'0')}`));for(let t=0;t<5;t++){assert(text.includes(`Dense topic ${String(b+1).padStart(2,'0')}-${String(t+1).padStart(2,'0')}`));for(let i=0;i<5;i++)assert(text.includes(`Dense item ${String(b+1).padStart(2,'0')}-${String(t+1).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`))}}
  assert(!text.includes('Do Not Export'),'excluded branches do not leak into print pages');
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
  let palettePixels=0;for(let i=0;i<raster.pixels.length;i+=raster.bpp)if(raster.pixels[i]===252&&raster.pixels[i+1]===222&&raster.pixels[i+2]===204)palettePixels++;
  assert(palettePixels>0,'selected Sunset palette is painted into the zoomable map sheet');
  console.log(`roadmap print map: 192 nodes on one ${pageW}×${pageH}pt vector page; glyph median ${medianGlyphHeight.toFixed(2)}pt (min ${minGlyphHeight.toFixed(2)}pt), palette/date/completion/description/filter checks passed`);
}finally{dom.window.close();fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exit(1)});
