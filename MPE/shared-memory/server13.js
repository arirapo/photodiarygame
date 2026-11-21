
'use strict';
// MPE 1.2 — Regenerative Memory / isolated research server.
// Node.js 20+. Port 3003; isolated state memory13.json.
// Local trusted network only. Never publish the admin key.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const DIR = __dirname;
const PORT = Number(process.env.PORT || 3003);
const DATA = path.join(DIR, 'memory13.json');
const SOURCE = path.join(DIR, 'memory12.json');
const KEY = process.env.MPE_ADMIN_KEY || '';
if (KEY.length < 24) throw Error('Set MPE_ADMIN_KEY (at least 24 characters)');
const clamp = (v,a=0,b=1) => Math.max(a,Math.min(b,v));
const random = () => crypto.randomInt(0,0x100000000)/0x100000000;
const base = [.31,.44,.39,.60,.40,.50,.35,.65];
const names = ['Stillness','Bloom','Turbulence','Dissolve','Dream'];
const photos = ['IMG_6484.jpeg','R0011164.jpeg','R0011165.jpeg','R0012243.jpeg','R0012371.jpeg','R0015191.jpeg','R0015290.jpeg'];
const now = () => Date.now();
const rnd = (a,b) => a+random()*(b-a);
const emptyPool = () => Array.from({length:8},()=>({mass:0,hue:0}));
function initial() {
  return {version:13,last:now(),days:0,offers:0,forgotten:0,expired:0,capacity:0,merged:0,
    weather:0,epoch:1,weatherAge:0,field:base.slice(),residue:Array(8).fill(0),
    history:[.24,.68,.39],layers:[],pools:emptyPool(),regenerations:0,
    dreamActivity:1,regenerationPaused:false,nodes:[
      {x:.18,y:.34,s:1,p:1,h:32,anchor:true,ready:0},
      {x:.70,y:.27,s:1,p:1,h:183,anchor:true,ready:0},
      {x:.50,y:.75,s:1,p:1,h:275,anchor:true,ready:0}
    ]};
}
function migrate(m) {
  if (![11,12,13].includes(m.version) || !Array.isArray(m.nodes)) throw Error('Incompatible source memory');
  const result={...initial(), ...m, version:13, last:now()};
  result.nodes=m.nodes.map(n=>({...n,echo:!!n.echo}));
  result.pools=Array.isArray(m.pools)&&m.pools.length===8?m.pools:emptyPool();
  result.regenerations=m.regenerations||0;
  result.dreamActivity=Number.isFinite(m.dreamActivity)?clamp(m.dreamActivity,.1,3):1;
  result.regenerationPaused=!!m.regenerationPaused;
  result.residue=Array.isArray(m.residue)&&m.residue.length===8?m.residue:base.map(()=>0);
  result.history=Array.isArray(m.history)&&m.history.length===3?m.history:[.24,.68,.39];
  result.layers=Array.isArray(m.layers)?m.layers:[];
  result.expired=m.expired||0;
  result.capacity=m.capacity||0;
  result.merged=m.merged||0;
  return result;
}
let memory;
if (fs.existsSync(DATA)) {
  memory=migrate(JSON.parse(fs.readFileSync(DATA,'utf8')));
} else if (fs.existsSync(SOURCE)) {
  memory=migrate(JSON.parse(fs.readFileSync(SOURCE,'utf8')));
  console.log('Imported an independent copy of memory12.json');
} else {
  memory=initial();
  console.log('No memory12.json found; starting an independent empty memory');
}
let dirty=true;
function persist(){
  if(!dirty)return;
  const temp=DATA+'.tmp';
  fs.writeFileSync(temp,JSON.stringify(memory));
  fs.renameSync(temp,DATA);
  dirty=false;
}
// Accumulate into eight shared pools. No reversible per-input identity is kept.
function absorb(n,amount=1){
  const k=Math.floor((((n.h||0)%360)+360)%360/45)%8;
  const mass=clamp((n.s||.1)*amount,0,1);
  const pool=memory.pools[k];
  pool.mass=clamp(pool.mass+mass*.08,0,5);
  pool.hue=k*45;
  memory.residue[k]=clamp(memory.residue[k]+mass*.012);
  memory.history[k%3]=clamp(memory.history[k%3]*.998+(n.p||.3)*.002);
}
function compact(){
  if(memory.nodes.length<=490)return;
  const anchors=memory.nodes.filter(n=>n.anchor);
  const others=memory.nodes.filter(n=>!n.anchor).sort((a,b)=>(b.s+b.p*.25)-(a.s+a.p*.25));
  const gone=others.splice(Math.max(0,470));
  gone.forEach(n=>absorb(n));
  memory.capacity+=gone.length;
  memory.forgotten+=gone.length;
  memory.nodes=anchors.concat(others);
}
function regenerate(force=false){
  if(memory.regenerationPaused && !force)return false;
  const total=memory.pools.reduce((s,p)=>s+p.mass,0);
  if(total<.005 || memory.nodes.length>475)return false;
  let chosen=random()*total, index=0;
  for(;index<7;index++){chosen-=memory.pools[index].mass;if(chosen<=0)break;}
  const p=memory.pools[index];
  if(p.mass<.005)return false;
  const anchors=memory.nodes.filter(n=>n.anchor);
  const a=anchors[Math.floor(random()*anchors.length)]||{x:.5,y:.5};
  memory.nodes.push({x:clamp(a.x+rnd(-.28,.28),.025,.975),
    y:clamp(a.y+rnd(-.28,.28),.025,.975),s:clamp(.13+p.mass*.065,.12,.4),
    p:.18+rnd(0,.18),h:(p.hue+rnd(-22,22)+360)%360,
    ready:memory.days,anchor:false,echo:true});
  p.mass=Math.max(0,p.mass-.045);
  memory.regenerations++;
  dirty=true;
  return true;
}
function evolveStep(dt){
  memory.days+=dt;
  memory.weatherAge+=dt;
  const old=memory.field.slice();
  const layer=memory.layers.at(-1)?.field||base;
  const cycle=Math.sin(memory.days*.011+memory.history[0]*6)+.65*Math.sin(memory.days*.005+memory.history[1]*4);
  const activity=.43*old[0]+.31*old[6]+.14*cycle+.12*layer[2];
  const wanted=activity>.72?2:activity>.56?1:old[7]>.71?0:cycle<-.55?3:4;
  if(memory.weatherAge>12 && (wanted!==memory.weather||memory.weatherAge>85)){
    memory.weather=wanted;memory.weatherAge=0;memory.epoch++;
    memory.layers.push({day:+memory.days.toFixed(2),weather:wanted,field:old.map(v=>+v.toFixed(3))});
    if(memory.layers.length>18){
      const removed=memory.layers.shift();
      memory.history=memory.history.map((v,i)=>clamp(v*.997+removed.field[i]*.003));
    }
  }
  for(let i=0;i<8;i++){
    const phase=memory.days*(.004+i*.00071)+memory.history[i%3]*7+layer[i]*3;
    const target=.49+.17*Math.sin(phase)+.1*Math.sin(phase*.41+2*i)+.08*(layer[i]-.5);
    const coupling=.0025*(old[(i+1)%8]-old[(i+4)%8]);
    const push=[0,.01,-.012,-.006,.007][memory.weather]*(i%2?1:-1);
    const poolPush=(memory.pools[i].mass-.5)*.0004;
    memory.field[i]=clamp(old[i]+dt*(.037*(target-old[i])+coupling+push+poolPush),.08,.92);
  }
  const keep=[];
  const decay=[.7,.85,1.2,1.5,.9][memory.weather];
  for(const n of memory.nodes){
    if(n.anchor || n.ready>memory.days){keep.push(n);continue;}
    n.s*=Math.exp(-dt*.0035*decay*(1-.67*n.p)*(n.echo?1.8:1));
    n.x=clamp(n.x+Math.sin(memory.days*.016+n.h)*dt*.000065,.02,.98);
    n.y=clamp(n.y+Math.cos(memory.days*.013+n.h)*dt*.000065,.02,.98);
    if(n.s<.035){
      if(!n.echo){memory.expired++;memory.forgotten++;absorb(n);}
      // Echoes fade without replenishing the same pool forever.
    } else keep.push(n);
  }
  memory.nodes=keep;
  const available=memory.nodes.filter(n=>!n.anchor&&!n.echo&&n.ready<=memory.days);
  for(let i=0;i<Math.min(18,Math.floor(available.length/5));i++){
    const a=available[Math.floor(random()*available.length)];
    const b=available[Math.floor(random()*available.length)];
    if(!a||!b||a===b||!memory.nodes.includes(a)||!memory.nodes.includes(b))continue;
    const distance=Math.hypot(a.x-b.x,a.y-b.y);
    if(distance<.16){a.s=clamp(a.s+.002*dt*(1-distance/.16));b.s=clamp(b.s+.002*dt*(1-distance/.16));}
    if(distance<.048&&random()<Math.min(.4,.07*dt)){
      const sum=a.s+b.s;
      const child={x:(a.x*a.s+b.x*b.s)/sum,y:(a.y*a.s+b.y*b.s)/sum,
        s:clamp(sum*.78),p:clamp((a.p+b.p)/2+.07),h:(a.h*a.s+b.h*b.s)/sum,
        anchor:false,echo:false,ready:memory.days};
      memory.nodes.splice(memory.nodes.indexOf(a),1);
      memory.nodes.splice(memory.nodes.indexOf(b),1);
      memory.nodes.push(child);memory.merged++;
      absorb({h:child.h,s:.05,p:child.p},.4);
    }
  }
  for(const p of memory.pools)p.mass*=Math.exp(-dt*.000035);
  memory.residue=memory.residue.map(v=>v*Math.exp(-dt*.00009));
  const chance=Math.min(.5,dt*.017*memory.dreamActivity*memory.pools.reduce((s,p)=>s+p.mass,0));
  if(random()<chance)regenerate();
  compact();dirty=true;
}
function advance(days){
  let left=Math.max(0,days);
  while(left>1e-7){const dt=Math.min(2,left);evolveStep(dt);left-=dt;}
}
function evolve(){
  const t=now();const elapsed=Math.min(3650,Math.max(0,t-memory.last)/60000);
  memory.last=t;
  if(elapsed>.0001)advance(elapsed);
}
function submit(features){
  if(!Array.isArray(features)||features.length!==8||features.some(v=>typeof v!=='number'||!Number.isFinite(v)||v<0||v>1))return false;
  evolve();
  const anchors=memory.nodes.filter(n=>n.anchor);
  const a=anchors[Math.floor(random()*anchors.length)]||{x:.5,y:.5};
  const roam=random()<.52;
  const n={x:roam?rnd(.05,.95):clamp(a.x+rnd(-.16,.16),.03,.97),
    y:roam?rnd(.05,.95):clamp(a.y+rnd(-.16,.16),.03,.97),
    s:rnd(.48,.88),p:rnd(.13,.63),h:(features[0]*170+random()*190)%360,
    anchor:false,echo:false,ready:memory.days+rnd(.2,3.2)};
  memory.nodes.push(n);memory.offers++;
  memory.field=memory.field.map((v,i)=>clamp(v+(features[i]-.5)*.009,.08,.92));
  for(const other of memory.nodes){
    if(other===n)continue;
    const d=Math.hypot(n.x-other.x,n.y-other.y);
    if(d<.17){other.s=clamp(other.s+.009*(1-d/.17));n.p=clamp(n.p+.007);}
  }
  compact();dirty=true;return true;
}
function snapshot(){
  evolve();
  return {version:13,days:+memory.days.toFixed(3),offers:memory.offers,
    forgotten:memory.forgotten,merged:memory.merged,waiting:memory.nodes.filter(n=>!n.anchor&&n.ready>memory.days).length,
    field:memory.field.map(v=>+v.toFixed(4)),residue:memory.residue.map(v=>+v.toFixed(4)),
    weather:names[memory.weather],epoch:memory.epoch,regenerations:memory.regenerations,
    echoes:memory.nodes.filter(n=>n.echo&&n.ready<=memory.days).length,
    nodes:memory.nodes.filter(n=>n.anchor||n.ready<=memory.days).map(n=>({x:+n.x.toFixed(4),y:+n.y.toFixed(4),
      s:+n.s.toFixed(4),h:+n.h.toFixed(2),anchor:!!n.anchor,echo:!!n.echo}))};
}
function diagnostic(){
  const state=snapshot();
  return {...state,expired:memory.expired,capacity:memory.capacity,layers:memory.layers.length,
    anchors:memory.nodes.filter(n=>n.anchor).length,visible:state.nodes.length,
    pools:memory.pools.map(x=>+x.mass.toFixed(4)),
    dreamActivity:memory.dreamActivity,regenerationPaused:memory.regenerationPaused};
}
function authorized(req){
  const supplied=req.headers['x-mpe-admin-key'];
  if(typeof supplied!=='string')return false;
  const a=Buffer.from(supplied),b=Buffer.from(KEY);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function sameOrigin(req){
  if(!req.headers.origin)return true;
  try{return new URL(req.headers.origin).host===req.headers.host;}catch{return false;}
}
function respond(res,status,obj){
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
  res.end(JSON.stringify(obj));
}
function readJSON(req,limit,cb){
  let input='',large=false;
  req.on('data',chunk=>{input+=chunk;if(input.length>limit)large=true;});
  req.on('end',()=>{if(large)return cb(Error('too_large'));try{cb(null,JSON.parse(input));}catch{cb(Error('invalid_json'));}});
  req.on('error',()=>cb(Error('request_error')));
}
const rates=new Map();
function allowed(ip){
  const t=now();const q=(rates.get(ip)||[]).filter(v=>t-v<60000);
  if(q.length>=12){rates.set(ip,q);return false;}
  q.push(t);rates.set(ip,q);return true;
}
const pages=new Set(['/','/test11.html','/research13.html','/test10.html']);
const server=http.createServer((req,res)=>{
  const p=new URL(req.url,'http://localhost').pathname;
  if(req.method==='GET'&&p==='/api/state')return respond(res,200,snapshot());
  if(p.startsWith('/api/research/')){
    if(!authorized(req))return respond(res,401,{error:'admin_key_required'});
    if(req.method==='GET'&&p==='/api/research/diagnostics')return respond(res,200,diagnostic());
    if(req.method!=='POST'||p!=='/api/research/experiment')return respond(res,405,{error:'method_not_allowed'});
    if(!sameOrigin(req))return respond(res,403,{error:'origin'});
    return readJSON(req,1024,(err,v)=>{
      if(err)return respond(res,400,{error:err.message});
      evolve();
      if(v.action==='simulate'&&Number.isInteger(v.count)&&v.count>=1&&v.count<=200){
        for(let i=0;i<v.count;i++)submit(Array.from({length:8},random));
      } else if(v.action==='advance'&&Number.isInteger(v.days)&&v.days>=1&&v.days<=365){
        advance(v.days);memory.last=now();
      } else if(v.action==='regenerate'){
        for(let i=0;i<Math.min(10,v.count||1);i++)regenerate(true);
      } else if(v.action==='activity'&&typeof v.level==='number'&&v.level>=.1&&v.level<=3){
        memory.dreamActivity=v.level;
      } else if(v.action==='pause'&&typeof v.paused==='boolean'){
        memory.regenerationPaused=v.paused;
      } else return respond(res,400,{error:'invalid_action'});
      dirty=true;persist();respond(res,200,{ok:true,metrics:diagnostic()});
    });
  }
  if(req.method==='POST'&&p==='/api/trace'){
    if(!sameOrigin(req))return respond(res,403,{error:'origin'});
    if(!allowed(req.socket.remoteAddress||'?'))return respond(res,429,{error:'rate_limit'});
    return readJSON(req,4096,(err,v)=>{
      if(err)return respond(res,400,{error:err.message});
      if(!submit(v.features))return respond(res,400,{error:'invalid_features'});
      persist();respond(res,202,{accepted:true});
    });
  }
  if(req.method==='GET'&&pages.has(p)){
    const file=path.join(DIR,p==='/'?'test11.html':p.slice(1));
    if(!fs.existsSync(file))return respond(res,404,{error:'missing_page'});
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store',
      'Content-Security-Policy':"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'"});
    return res.end(fs.readFileSync(file));
  }
  if(req.method==='GET'&&photos.includes(p.slice(1))){
    const file=path.join(DIR,p.slice(1));
    if(!fs.existsSync(file))return respond(res,404,{error:'missing_photo'});
    res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'public, max-age=3600'});
    return res.end(fs.readFileSync(file));
  }
  respond(res,404,{error:'not_found'});
});
const timer=setInterval(()=>{evolve();persist();const t=now();for(const [ip,q] of rates)if(q.every(v=>t-v>60000))rates.delete(ip);},15000);
function stop(){clearInterval(timer);evolve();persist();server.close(()=>process.exit(0));}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
persist();
server.listen(PORT,'0.0.0.0',()=>console.log(`MPE 1.2 Regenerative Memory — http://localhost:${PORT} (memory13.json)`));
