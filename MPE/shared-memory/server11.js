
'use strict';
// MPE 1.1 — isolated experimental collective memory server.
// node server11.js — listening on port 3001, state in memory11.json.
// Never reads/writes memory.json. Imports memory_backup_v09.json only once.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const DIR=__dirname, PORT=Number(process.env.PORT||3001);
const DATA=path.join(DIR,'memory11.json');
const SOURCE=path.join(DIR,'memory_backup_v09.json');
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const baseline=[.31,.44,.39,.6,.4,.5,.35,.65];
const weatherNames=['Stillness','Bloom','Turbulence','Dissolve','Dream'];
const rand=()=>crypto.randomInt(0,0x100000000)/0x100000000;
const number=(v,fallback=0)=>Number.isFinite(v)?v:fallback;
const slot=n=>Math.floor((n.h%360+360)%360/45)%8;
function original(){return {version:9,last:Date.now(),days:0,offers:0,merged:0,forgotten:0,field:baseline.slice(),residue:Array(8).fill(0),nodes:[{x:.18,y:.34,s:1,p:1,h:32,anchor:true,ready:0},{x:.70,y:.27,s:1,p:1,h:183,anchor:true,ready:0},{x:.50,y:.75,s:1,p:1,h:275,anchor:true,ready:0}]};}
function migrate(old){
  if(old.version!==9||!Array.isArray(old.nodes)||!Array.isArray(old.field))throw Error('Invalid v0.9 memory');
  return {version:11,last:Date.now(),days:number(old.days),offers:number(old.offers),merged:number(old.merged),forgotten:number(old.forgotten),expired:0,capacity:0,field:old.field.map(v=>clamp(number(v,.5))),residue:(old.residue||baseline.map(()=>0)).map(v=>clamp(number(v))),nodes:old.nodes.map(n=>({...n})),weather:0,weatherAge:0,epoch:1,layers:[],history:[.24,.68,.39]};
}
let memory;
if(fs.existsSync(DATA)){
  memory=JSON.parse(fs.readFileSync(DATA,'utf8'));
  if(memory.version!==11)throw Error('Unsupported memory11.json version: stop and inspect');
}else{
  memory=migrate(fs.existsSync(SOURCE)?JSON.parse(fs.readFileSync(SOURCE,'utf8')):original());
  console.log(fs.existsSync(SOURCE)?'Imported the backup into a separate MPE 1.1 state.':'Started a new separate MPE 1.1 state.');
}
let dirty=true;
function persist(){if(!dirty)return;const tmp=DATA+'.tmp';fs.writeFileSync(tmp,JSON.stringify(memory));fs.renameSync(tmp,DATA);dirty=false;}
function deposit(n){const k=slot(n);memory.residue[k]=clamp(memory.residue[k]+n.s*.011);memory.history[k%3]=clamp(memory.history[k%3]*.997+n.p*.003);}
function compact(){if(memory.nodes.length<=490)return;const anchors=memory.nodes.filter(n=>n.anchor),rest=memory.nodes.filter(n=>!n.anchor).sort((a,b)=>(b.s+b.p*.3)-(a.s+a.p*.3));const gone=rest.splice(470);gone.forEach(deposit);memory.capacity+=gone.length;memory.forgotten+=gone.length;memory.nodes=anchors.concat(rest);}
function evolveStep(dt){
  memory.days+=dt;memory.weatherAge+=dt;
  const prev=memory.field.slice(),last=memory.layers.at(-1)?.field||baseline;
  const cycle=Math.sin(memory.days*.011+memory.history[0]*6)+.65*Math.sin(memory.days*.005+memory.history[1]*4);
  const activity=prev[0]*.43+prev[6]*.31+cycle*.14+last[2]*.12;
  const next=activity>.72?2:activity>.56?1:prev[7]>.71?0:cycle<-.55?3:4;
  if(memory.weatherAge>12&&(memory.weather!==next||memory.weatherAge>85)){
    memory.weather=next;memory.weatherAge=0;memory.epoch++;
    memory.layers.push({day:+memory.days.toFixed(2),weather:next,field:prev.map(v=>+v.toFixed(3))});
    if(memory.layers.length>18){const discarded=memory.layers.shift();memory.history=memory.history.map((v,i)=>clamp(.997*v+.003*discarded.field[i]));}
  }
  for(let i=0;i<8;i++){
    const p=memory.days*(.004+i*.00071)+memory.history[i%3]*7+last[i]*3;
    const target=.49+.17*Math.sin(p)+.1*Math.sin(p*.41+2*i)+.08*(last[i]-.5);
    const coupling=.0025*(prev[(i+1)%8]-prev[(i+4)%8]);
    const push=[0,.01,-.012,-.006,.007][memory.weather]*(i%2?1:-1);
    memory.field[i]=clamp(prev[i]+dt*(.037*(target-prev[i])+coupling+push),.08,.92);
  }
  const retained=[];const decay=[.7,.85,1.2,1.5,.9][memory.weather];
  for(const n of memory.nodes){
    if(n.anchor){retained.push(n);continue;}
    if(n.ready>memory.days){retained.push(n);continue;}
    n.s*=Math.exp(-dt*.0035*decay*(1-.67*n.p));
    n.x=clamp(n.x+Math.sin(memory.days*.016+n.h)*dt*.000065,.02,.98);
    n.y=clamp(n.y+Math.cos(memory.days*.013+n.h)*dt*.000065,.02,.98);
    if(n.s<.035){memory.expired++;memory.forgotten++;deposit(n);}else retained.push(n);
  }
  memory.nodes=retained;
  // Resonance and assimilation are shared events, never computed in viewers.
  const available=memory.nodes.filter(n=>!n.anchor&&n.ready<=memory.days);
  for(let k=0;k<Math.min(18,Math.floor(available.length/5));k++){
    const a=available[Math.floor(rand()*available.length)];const b=available[Math.floor(rand()*available.length)];
    if(!a||!b||a===b||!memory.nodes.includes(a)||!memory.nodes.includes(b))continue;
    const dist=Math.hypot(a.x-b.x,a.y-b.y);
    if(dist<.16){a.s=clamp(a.s+.002*dt*(1-dist/.16));b.s=clamp(b.s+.002*dt*(1-dist/.16));}
    if(dist<.048&&rand()<Math.min(.4,.07*dt)){
      const total=a.s+b.s;
      const child={x:(a.x*a.s+b.x*b.s)/total,y:(a.y*a.s+b.y*b.s)/total,s:clamp(total*.78),p:clamp((a.p+b.p)/2+.07),h:(a.h*a.s+b.h*b.s)/total,anchor:false,ready:memory.days};
      memory.nodes.splice(memory.nodes.indexOf(a),1);memory.nodes.splice(memory.nodes.indexOf(b),1);memory.nodes.push(child);memory.merged++;deposit({h:child.h,s:.05,p:child.p});
    }
  }
  memory.residue=memory.residue.map(v=>v*Math.exp(-dt*.00009));
  compact();dirty=true;
}
function evolve(){const now=Date.now();const days=Math.min(3650,Math.max(0,now-memory.last)/60000);memory.last=now;if(days<.0001)return;for(let remain=days;remain>0;){const d=Math.min(5,remain);evolveStep(d);remain-=d;}dirty=true;}
function submit(v){
  if(!Array.isArray(v)||v.length!==8||v.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<0||x>1))return false;
  evolve();const a=memory.nodes.filter(n=>n.anchor);const origin=a[Math.floor(rand()*a.length)]||{x:.5,y:.5};
  const roam=rand()<.52;
  const n={x:roam?.05+.9*rand():clamp(origin.x+(rand()-.5)*.32,.03,.97),y:roam?.05+.9*rand():clamp(origin.y+(rand()-.5)*.32,.03,.97),s:.48+.4*rand(),p:.13+.5*rand(),h:(v[0]*170+rand()*190)%360,anchor:false,ready:memory.days+.2+3*rand()};
  memory.nodes.push(n);memory.offers++;
  memory.field=memory.field.map((x,i)=>clamp(x+(v[i]-.5)*.009,.08,.92));
  for(const other of memory.nodes){if(other===n)continue;const d=Math.hypot(other.x-n.x,other.y-n.y);if(d<.17){other.s=clamp(other.s+.009*(1-d/.17));n.p=clamp(n.p+.007);}}
  compact();dirty=true;return true;
}
function snapshot(){evolve();return {version:11,days:+memory.days.toFixed(4),offers:memory.offers,merged:memory.merged,forgotten:memory.forgotten,expired:memory.expired,capacity:memory.capacity,weather:weatherNames[memory.weather],epoch:memory.epoch,layers:memory.layers.length,waiting:memory.nodes.filter(n=>!n.anchor&&n.ready>memory.days).length,field:memory.field.map(v=>+v.toFixed(4)),residue:memory.residue.map(v=>+v.toFixed(4)),nodes:memory.nodes.filter(n=>n.anchor||n.ready<=memory.days).map(n=>({x:+n.x.toFixed(4),y:+n.y.toFixed(4),s:+n.s.toFixed(4),h:+n.h.toFixed(2),anchor:!!n.anchor}))};}
const rates=new Map();
function allowed(ip){const t=Date.now(),q=(rates.get(ip)||[]).filter(v=>t-v<60000);if(q.length>=12){rates.set(ip,q);return false;}q.push(t);rates.set(ip,q);return true;}
function respond(res,code,obj){res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(obj));}
const photos=['IMG_6484.jpeg','R0011164.jpeg','R0011165.jpeg','R0012243.jpeg','R0012371.jpeg','R0015191.jpeg','R0015290.jpeg'];
const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');const p=url.pathname;
  if(req.method==='GET'&&p==='/api/state')return respond(res,200,snapshot());
  if(req.method==='POST'&&p==='/api/trace'){
    if(req.headers.origin){let host;try{host=new URL(req.headers.origin).host;}catch{return respond(res,403,{error:'origin'});}if(host!==req.headers.host)return respond(res,403,{error:'origin'});}
    if(!allowed(req.socket.remoteAddress||'?'))return respond(res,429,{error:'rate_limit'});
    let body='',oversized=false;
    req.on('data',chunk=>{body+=chunk;if(body.length>4096)oversized=true;});
    req.on('end',()=>{if(oversized)return respond(res,413,{error:'too_large'});let obj;try{obj=JSON.parse(body);}catch{return respond(res,400,{error:'json'});}if(!submit(obj.features))return respond(res,400,{error:'features'});persist();respond(res,202,{accepted:true});});return;
  }
  const pages=['/','/test9.html','/test10.html'];
  if(req.method==='GET'&&pages.includes(p)){
    const file=path.join(DIR,p==='/'?'test10.html':p.slice(1));
    try{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(fs.readFileSync(file));}catch{return respond(res,404,{error:'missing_page'});}return;
  }
  if(req.method==='GET'&&photos.includes(p.slice(1))){
    const file=path.join(DIR,p.slice(1));if(!fs.existsSync(file))return respond(res,404,{error:'missing_photo'});
    res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=3600'});res.end(fs.readFileSync(file));return;
  }
  respond(res,404,{error:'not_found'});
});
const timer=setInterval(()=>{evolve();persist();const t=Date.now();for(const [ip,q] of rates)if(q.every(x=>t-x>60000))rates.delete(ip);},15000);
process.on('SIGINT',()=>{clearInterval(timer);evolve();persist();server.close(()=>process.exit(0));});
process.on('SIGTERM',()=>{clearInterval(timer);evolve();persist();server.close(()=>process.exit(0));});
persist();server.listen(PORT,'0.0.0.0',()=>console.log(`MPE 1.1 experimental server: http://localhost:${PORT} (memory11.json)`));
