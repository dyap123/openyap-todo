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
function exportPdf(paper,excluded=[]){const pdf=dom.window.__oym.buildRoadmap({pid:'p',paper,time:false,schedule:false,map:true,desc:true,excluded});const file=path.join(dir,paper+'.pdf');fs.writeFileSync(file,Buffer.from(pdf.output('arraybuffer')));return {pdf,file}}
(async()=>{await new Promise(r=>setTimeout(r,100));try{
  const M=dom.window.__oym;assert(M,'map app initialized');
  assert.deepEqual(Object.keys(M.maps.p.nodes).length,9,'the synthetic project map loaded before exporting');
  const nodes=M.maps.p.nodes;nodes.branchItem={kind:'item',parent:'b',title:'Direct branch task',due:'2026-10-03'};
  for(let n=0;n<9;n++)nodes['dense'+n]={kind:'item',parent:'t',title:`Dense deliverable ${String(n+1).padStart(2,'0')} with enough words to test readable printed rows`,order:n+1,...(n===0?{completed:true,completedAt:'2026-09-18T12:00:00Z'}:{})};
  nodes.nested={kind:'topic',parent:'t',title:'Nested continuation topic',order:1};nodes.nestedItem={kind:'item',parent:'nested',title:'Nested topic deliverable'};
  const excluded=['b3','t3','i3'],chosen=M.roadmapNodes('p',{excluded}),parts=M.mapPrintFragments(chosen,true);
  const itemIds=parts.flatMap(p=>p.ids.filter(id=>M.mapKindOf(chosen,id)==='item'));
  assert.deepEqual([...itemIds].sort(),Object.keys(chosen).filter(id=>M.mapKindOf(chosen,id)==='item').sort(),'fragments preserve each selected item exactly once');
  assert(parts.some(p=>p.ids.includes('nested')&&p.ids.includes('t')),'nested topic keeps ancestor context on its own page');
  const tabloid=exportPdf('tabloid',excluded),letter=exportPdf('letter',excluded);
  const info=run('pdfinfo',[tabloid.file]);assert.match(info,/Page size:\s+1224 x 792 pts/);
  assert.equal(tabloid.pdf.getNumberOfPages(),parts.length,'dense nodes continue across pages at readable size');
  assert.equal(letter.pdf.getNumberOfPages(),parts.length,'letter pages preserve the same map continuation structure');
  const text=run('pdftotext',['-layout',tabloid.file,'-']);
  for(const label of ['Readable career branch','Selected topic with a useful longer label','Selected deliverable with a longer label','Direct branch task','Nested continuation topic','Nested topic deliverable','Second continuation branch','Second selected topic','Second topic deliverable','Dense deliverable 01','Dense deliverable 09','Done 2026-09-18','SUB-TOPIC','DONE 2026-09-20','Due Oct 2','selected description','Task detail remains legible'])assert(text.includes(label),`PDF text includes ${label}`);
  assert(!text.includes('Do Not Export'),'excluded branches do not leak into print pages');
  const boxes=run('pdftotext',['-f','1','-l','1','-bbox',tabloid.file,'-']);
  const titleHeight=markup=>{const matches=[...markup.matchAll(/<word xMin="[^"]+" yMin="([^"]+)" xMax="[^"]+" yMax="([^"]+)">Readable<\/word>/g)];assert(matches.length,'branch title word has a measurable PDF bounding box');return Math.max(...matches.map(m=>+m[2]- +m[1]))};
  const tabHeight=titleHeight(boxes),letterHeight=titleHeight(run('pdftotext',['-f','1','-l','1','-bbox',letter.file,'-']));
  assert(tabHeight>=letterHeight*1.15,`11×17 branch label grows materially (${tabHeight.toFixed(1)}pt vs ${letterHeight.toFixed(1)}pt)`);
  const png=path.join(dir,'tabloid');run('pdftoppm',['-f','1','-l','1','-r','72','-singlefile','-png',tabloid.file,png]);
  fs.copyFileSync(png+'.png','/private/tmp/oy-todo-print-map-preview.png');
  const raster=pngPixels(png+'.png');assert.deepEqual([raster.w,raster.h],[1224,792],'rasterized 11×17 page renders at print dimensions');
  let palettePixels=0;for(let i=0;i<raster.pixels.length;i+=raster.bpp)if(raster.pixels[i]===252&&raster.pixels[i+1]===222&&raster.pixels[i+2]===204)palettePixels++;
  assert(palettePixels>1000,'selected Sunset palette is visibly painted into roadmap map tiles');
  const contentPng=path.join(dir,'tabloid-content');run('pdftoppm',['-f','2','-l','2','-r','72','-singlefile','-png',tabloid.file,contentPng]);fs.copyFileSync(contentPng+'.png','/private/tmp/oy-todo-print-map-content-preview.png');
  console.log(`roadmap print map: ${tabloid.pdf.getNumberOfPages()} readable 11×17 continuation pages; dense/selected content, completion/date/description retained; exclusions honored; palette rasterized; branch text ${tabHeight.toFixed(1)}pt vs ${letterHeight.toFixed(1)}pt on Letter`);
}finally{dom.window.close();fs.rmSync(dir,{recursive:true,force:true})}})().catch(e=>{console.error(e);process.exit(1)});
