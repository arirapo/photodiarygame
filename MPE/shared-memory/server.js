
'use strict';

// MPE 0.9 — Shared Memory
// Run with Node.js 20+: node server.js

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const DIR = __dirname;
const DATA = path.join(DIR, 'memory.json');

const clamp = (v,a=0,b=1) =>
  Math.max(a,Math.min(b,v));

const base = [.31,.44,.39,.6,.4,.5,.35,.65];
const now = () => Date.now();
const between = (a,b) => a+Math.random()*(b-a);

function born() {
  return {
    version:9,
    last:now(),
    days:0,
    offers:0,
    merged:0,
    forgotten:0,
    anchors:3,
    field:base.slice(),
    residue:Array(8).fill(0),
    nodes:[
      {x:.18,y:.34,s:1,p:1,h:32,anchor:true,ready:0},
      {x:.70,y:.27,s:1,p:1,h:183,anchor:true,ready:0},
      {x:.50,y:.75,s:1,p:1,h:275,anchor:true,ready:0}
    ]
  };
}

let memory;

try {
  memory=JSON.parse(fs.readFileSync(DATA,'utf8'));

  if(memory.version!==9 || !Array.isArray(memory.nodes)) {
    throw Error('Incompatible memory');
  }
} catch {
  memory=born();
}

let dirty=false;

function persist() {
  if(!dirty) return;

  const temp=DATA+'.tmp';

  fs.writeFileSync(temp,JSON.stringify(memory));
  fs.renameSync(temp,DATA);

  dirty=false;
}

// One real minute = one simulated day.

function evolve() {
  const t=now();

  const elapsed=Math.max(
    0,
    Math.min(3650,(t-memory.last)/60000)
  );

  memory.last=t;

  if(elapsed<.0001) return;

  memory.days+=elapsed;

  const nodes=[];

  for(const n of memory.nodes) {
    if(n.anchor) {
      nodes.push(n);
      continue;
    }

    if(n.ready>memory.days) {
      nodes.push(n);
      continue;
    }

    n.s*=Math.exp(
      -elapsed*.004*(1-.65*n.p)
    );

    n.x=clamp(
      n.x+
      Math.sin(memory.days*.016+n.h)*
      elapsed*.00005,
      .02,.98
    );

    n.y=clamp(
      n.y+
      Math.cos(memory.days*.013+n.h)*
      elapsed*.00005,
      .02,.98
    );

    if(n.s<.035) {
      memory.forgotten++;

      const k=Math.floor(n.h/45)%8;

      memory.residue[k]=clamp(
        memory.residue[k]+.006
      );
    } else {
      nodes.push(n);
    }
  }

  memory.nodes=nodes;

  memory.field=memory.field.map((v,i)=>
    clamp(
      v+
      Math.sin(
        memory.days*(.003+i*.0006)+i
      )*elapsed*.00035,
      .08,.92
    )
  );

  memory.residue=memory.residue.map(
    v=>v*Math.exp(-elapsed*.0001)
  );

  dirty=true;
}

function submit(features) {
  evolve();

  if(
    !Array.isArray(features) ||
    features.length!==8 ||
    features.some(v=>
      typeof v!=='number' ||
      !Number.isFinite(v) ||
      v<0 || v>1
    )
  ) {
    return false;
  }

  const anchors=memory.nodes.filter(n=>n.anchor);
  const origin=anchors[
    Math.floor(Math.random()*anchors.length)
  ];

  const roam=Math.random()<.5;

  const n={
    x:roam
      ?between(.04,.96)
      :clamp(origin.x+between(-.16,.16),.03,.97),

    y:roam
      ?between(.04,.96)
      :clamp(origin.y+between(-.16,.16),.03,.97),

    s:between(.45,.9),
    p:between(.15,.65),

    h:Math.floor(
      (features[0]*170+Math.random()*190)%360
    ),

    anchor:false,

    ready:memory.days+between(.2,3.2)
  };

  memory.nodes.push(n);
  memory.offers++;

  memory.field=memory.field.map((v,i)=>
    clamp(v+(features[i]-.5)*.009,.08,.92)
  );

  if(memory.nodes.length>480) {
    const keep=memory.nodes.filter(n=>n.anchor);

    const others=memory.nodes
      .filter(n=>!n.anchor)
      .sort((x,y)=>
        (y.s+y.p*.2)-(x.s+x.p*.2)
      );

    const gone=others.splice(470);

    for(const n of gone) {
      const k=Math.floor(n.h/45)%8;
      memory.residue[k]=clamp(
        memory.residue[k]+.006
      );
    }

    memory.forgotten+=gone.length;
    memory.nodes=keep.concat(others);
  }

  dirty=true;
  return true;
}

function snapshot() {
  evolve();

  return {
    version:9,
    days:+memory.days.toFixed(4),
    offers:memory.offers,
    forgotten:memory.forgotten,

    waiting:memory.nodes.filter(n=>
      !n.anchor && n.ready>memory.days
    ).length,

    field:memory.field.map(
      v=>+v.toFixed(4)
    ),

    residue:memory.residue.map(
      v=>+v.toFixed(4)
    ),

    nodes:memory.nodes
      .filter(n=>
        n.anchor || n.ready<=memory.days
      )
      .map(n=>({
        x:+n.x.toFixed(4),
        y:+n.y.toFixed(4),
        s:+n.s.toFixed(4),
        h:n.h,
        anchor:!!n.anchor
      }))
  };
}

// Simple rate limiter.

const limits=new Map();

function allowed(ip) {
  const t=now();
  const v=limits.get(ip)||[];

  const recent=v.filter(x=>t-x<60000);

  if(recent.length>=12) {
    limits.set(ip,recent);
    return false;
  }

  recent.push(t);
  limits.set(ip,recent);

  return true;
}

function headers(
  res,status,
  type='application/json; charset=utf-8'
) {
  res.writeHead(status,{
    'Content-Type':type,
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'Content-Security-Policy':
      "default-src 'none'; frame-ancestors 'none'"
  });
}

function reply(res,status,obj) {
  headers(res,status);
  res.end(JSON.stringify(obj));
}

const files={
  '/test9.html':'text/html; charset=utf-8',
  '/':'text/html; charset=utf-8'
};

const photos=[
  'IMG_6484.jpeg',
  'R0011164.jpeg',
  'R0011165.jpeg',
  'R0012243.jpeg',
  'R0012371.jpeg',
  'R0015191.jpeg',
  'R0015290.jpeg'
];

const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const p=url.pathname;

  if(req.method==='GET' && p==='/api/state') {
    return reply(res,200,snapshot());
  }

  if(req.method==='POST' && p==='/api/trace') {
    if(
      req.headers.origin &&
      new URL(req.headers.origin).host!==req.headers.host
    ) {
      return reply(res,403,{error:'origin'});
    }

    if(!allowed(req.socket.remoteAddress||'?')) {
      return reply(res,429,{error:'rate_limit'});
    }

    let data='';

    req.on('data',chunk=>{
      data+=chunk;

      if(data.length>4096) {
        req.destroy();
      }
    });

    req.on('end',()=>{
      let obj;

      try {
        obj=JSON.parse(data);
      } catch {
        return reply(res,400,{error:'invalid_json'});
      }

      if(!submit(obj.features)) {
        return reply(
          res,400,
          {error:'invalid_features'}
        );
      }

      persist();
      reply(res,202,{accepted:true});
    });

    return;
  }

  if(
    req.method==='GET' &&
    (p==='/' || p==='/test9.html')
  ) {
    try {
      headers(res,200,files[p]);

      res.end(
        fs.readFileSync(
          path.join(DIR,'test9.html')
        )
      );
    } catch {
      reply(res,404,{error:'file'});
    }

    return;
  }

  if(
    req.method==='GET' &&
    photos.includes(p.slice(1))
  ) {
    const file=path.join(DIR,p.slice(1));

    if(!fs.existsSync(file)) {
      return reply(
        res,404,
        {error:'image_missing'}
      );
    }

    headers(res,200,'image/jpeg');
    res.end(fs.readFileSync(file));

    return;
  }

  reply(res,404,{error:'not_found'});
});

setInterval(()=>{
  evolve();
  persist();

  const t=now();

  for(const [ip,arr] of limits) {
    if(arr.every(x=>t-x>60000)) {
      limits.delete(ip);
    }
  }
},15000);

process.on('SIGINT',()=>{
  evolve();
  persist();
  process.exit(0);
});

server.listen(PORT,()=>{
  console.log(
    `MPE 0.9 shared memory: http://localhost:${PORT}`
  );
});
