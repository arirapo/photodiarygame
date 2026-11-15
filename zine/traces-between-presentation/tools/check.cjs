// Headless engine checks with a small DOM harness. Not a browser or iPad test.
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const root=path.resolve(__dirname,'..');
class Element{
 constructor(tag='div'){this.tagName=tag.toUpperCase();this.children=[];this.hidden=false;this.dataset={};this.attributes={};this.value='';this.textContent='';this.contentWindow={messages:[],postMessage(message){this.messages.push(message);}};}
 set id(v){this._id=v;elements[v]=this;}get id(){return this._id;}
 set src(v){this.attributes.src=v;}get src(){return this.attributes.src;}
 set srcdoc(v){this.attributes.srcdoc=v;}
 append(...nodes){for(const n of nodes){if(n.parent)n.remove();n.parent=this;this.children.push(n);}}
 prepend(...nodes){for(const n of nodes.reverse()){n.parent=this;this.children.unshift(n);}}
 remove(){if(this.parent){this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 get lastElementChild(){return this.children[this.children.length-1];}
 setAttribute(k,v){this.attributes[k]=v;}getAttribute(k){return this.attributes[k]??null;}hasAttribute(k){return k in this.attributes;}
 addEventListener(){}
 matches(selector){if(selector==='video[data-timelapse]')return this.tagName==='VIDEO'&&this.dataset.timelapse;if(selector==='iframe[data-project200]')return this.tagName==='IFRAME'&&this.dataset.project200;return selector.startsWith('.')?(this.className||'').split(' ').includes(selector.slice(1)):this.tagName===selector.toUpperCase();}
 querySelectorAll(selector){return this.children.flatMap(n=>[...(n.matches(selector)?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 play(){this.playing=true;return Promise.resolve();}pause(){this.playing=false;}
 scrollIntoView(){}closest(selector){if(this.matches(selector))return this;return this.parent?.closest(selector)||null;}
}
const elements={};['profile','pages','mode','extras','position','prev','next','contents','print','fullscreen','menu','status','offline'].forEach(id=>elements[id]=new Element());
const pages=JSON.parse(fs.readFileSync(path.join(root,'content/edition.json')));pages.pages.forEach(p=>elements[p.id]=new Element('section'));
const document={createElement:tag=>new Element(tag),getElementById:id=>elements[id],body:new Element('body'),querySelectorAll:selector=>elements.pages.querySelectorAll(selector),querySelector:selector=>elements.pages.querySelector(selector),addEventListener(){},documentElement:new Element()};
const context={document,window:{EDITION:pages,addEventListener(){},print(){}},location:{hash:'#jalki',origin:'http://localhost:8767'},history:{replaceState(_,__,hash){context.location.hash=hash;}},console,setTimeout,clearTimeout,navigator:{},MessageChannel};vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'app.js'),'utf8'),context);
assert.equal(document.body.className,'present');assert.equal(elements.jalki.hidden,false);assert.equal(elements.position.textContent,'2 / 6 · jälki');
elements.next.onclick();assert.equal(elements.toisto.hidden,false);assert(!elements.next.disabled);
elements.extras.onclick();assert.equal(elements.contents.children.length,9);
elements.mode.onclick();assert.equal(document.body.className,'zine');assert(pages.pages.every(p=>!elements[p.id].hidden));
elements.mode.onclick();elements.profile.onchange({target:{value:'education'}});assert.equal(elements.position.textContent,'1 / 6 · Traces Between');
const rendered=elements.pages.children;
assert.equal(rendered.length,9);
assert(rendered.find(p=>p.id==='jalki').children.some(n=>n.className==='trace-question'));
const rep=rendered.find(p=>p.id==='toisto').children.find(n=>n.className==='image-sequence');assert.equal(rep.children.length,3);assert.equal(new Set(rep.children.map(f=>f.children[0].src)).size,3);assert(rep.children.every(f=>f.children[0].alt));
const frame=elements.valissa.querySelector('iframe');assert(frame);assert(!frame.hasAttribute('src'));
vm.runInContext("profile='presentation';show('valissa')",context);assert.equal(frame.src,'assets/project-200/animation.html');assert.equal(frame.dataset.playing,'true');
vm.runInContext("show('muisti')",context);assert.equal(frame.dataset.playing,'false');assert.equal(frame.contentWindow.messages.at(-1).playing,false);
const video=elements.aika.querySelector('video');assert(video);vm.runInContext("show('aika')",context);assert(video.playing);vm.runInContext("show('muisti')",context);assert(!video.playing);
// Validate standalone JavaScript syntax and embedded images without network.
const html=fs.readFileSync(path.join(root,'traces-between-offline.html'),'utf8');for(const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new vm.Script(match[1]);assert(html.includes('print-sheet'));assert(!html.includes('src="print-pages.js"'));assert((html.match(/data:image\/jpeg;base64,/g)||[]).length>=214);
console.log('PASS: deep links, forward navigation, boundaries, complete 5+3 path, all nine layouts, animation and video start/stop, mode switching, profiles, standalone syntax.');
(async()=>{
 const handlers={},stored=new Map();let claimed=false;
 let networkAvailable=true;const cache={async put(key,response){stored.set(new URL(key,'http://localhost:8765/').href,response.clone());},async match(req){const key=typeof req==='string'?req:(req.url||req.href);const r=stored.get(key);return r&&r.clone();}};
 const scope={self:{location:{origin:'http://localhost:8765'},registration:{scope:'http://localhost:8765/'},addEventListener:(k,v)=>handlers[k]=v,skipWaiting:async()=>{},clients:{claim:async()=>{claimed=true;}}},caches:{open:async()=>cache,keys:async()=>[],delete:async()=>{}},URL,Response,Request:class extends Request{constructor(input,options){super(new URL(typeof input==='string'?input:input.url,'http://localhost:8765/'),options);}},fetch:async request=>{if(!networkAvailable)throw Error('NETWORK DISABLED');return new Response(fs.readFileSync(path.join(root,new URL(request.url).pathname)));},console};vm.createContext(scope);vm.runInContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),scope);
 let pending;handlers.install({waitUntil:p=>pending=p});await pending;handlers.activate({waitUntil:p=>pending=p});await pending;assert(claimed);networkAvailable=false;
 let report;handlers.message({data:{type:'VERIFY'},ports:[{postMessage:r=>report=r}],waitUntil:p=>pending=p});await pending;assert(report.ok);assert.equal(report.count,237);
 for(const url of ['http://localhost:8765/','http://localhost:8765/assets/images/page-2.jpg']){let result;handlers.fetch({request:{method:'GET',url,mode:url.endsWith('/')?'navigate':'cors',headers:new Headers()},respondWith:p=>result=p});assert.equal((await result).status,200);}
 let ranged;handlers.fetch({request:new Request('http://localhost:8765/assets/images/page-2.jpg',{headers:{Range:'bytes=0-99'}}),respondWith:p=>ranged=p});const r=await ranged;assert.equal(r.status,206);assert.equal((await r.arrayBuffer()).byteLength,100);
 stored.delete('http://localhost:8765/assets/images/page-2.jpg');handlers.message({data:{type:'VERIFY'},ports:[{postMessage:r=>report=r}],waitUntil:p=>pending=p});await pending;assert.equal(report.ok,false);
 console.log('PASS: worker installation, cache inventory, network-disabled cached fetch, partial range response, missing-file detection.');
})().catch(e=>{console.error(e);process.exitCode=1});
