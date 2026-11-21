
'use strict';

// MPE Research Mode 0.1
// Builds an isolated research server from server11.js.

const fs = require('node:fs');
const path = require('node:path');

const DIR = __dirname;
const source = path.join(DIR, 'server11.js');
const output = path.join(DIR, 'server12.js');

if (!fs.existsSync(source)) {
  throw Error('server11.js missing');
}

if (fs.existsSync(output)) {
  throw Error('server12.js exists — not overwriting');
}

let code = fs.readFileSync(source, 'utf8');

function change(before, after) {
  if (!code.includes(before)) {
    throw Error(
      'Unexpected server11.js structure: ' +
      before.slice(0, 70)
    );
  }
  code = code.replace(before, after);
}

// Separate port and memory file.
change(
  'Number(process.env.PORT||3001)',
  'Number(process.env.PORT||3002)'
);

change(
  "path.join(DIR,'memory11.json')",
  "path.join(DIR,'memory12.json')"
);

change(
  'let memory;',
  `if (!fs.existsSync(DATA)) {
    throw Error('Create memory12.json first');
  }
  let memory;`
);

// Add the research interface.
change(
  "const pages=['/','/test9.html','/test10.html'];",
  "const pages=['/','/test9.html','/test10.html','/research12.html'];"
);

// Add administrator API.
const research = String.raw`

// ===============================================
// RESEARCH MODE — isolated memory12.json
// ===============================================

const adminSecret = process.env.MPE_ADMIN_KEY || '';

if (adminSecret.length < 24) {
  throw Error('Set MPE_ADMIN_KEY (24+ characters)');
}

function authorized(req) {
  const key = req.headers['x-mpe-admin-key'];

  if (typeof key !== 'string') return false;

  const a = Buffer.from(key);
  const b = Buffer.from(adminSecret);

  return a.length === b.length &&
    crypto.timingSafeEqual(a, b);
}

function researchMetrics() {
  const active = memory.nodes.filter(
    n => n.anchor || n.ready <= memory.days
  );

  return {
    version: memory.version,
    days: +memory.days.toFixed(2),
    offers: memory.offers,
    visible: active.length,
    waiting: memory.nodes.length - active.length,
    anchors: memory.nodes.filter(n => n.anchor).length,
    assimilations: memory.merged,
    forgotten: memory.forgotten,
    expired: memory.expired,
    capacity: memory.capacity,
    weather: weatherNames[memory.weather],
    epoch: memory.epoch,
    layers: memory.layers.length,
    field: memory.field.map(v => +v.toFixed(3)),
    aftereffects: +memory.residue
      .reduce((a,b) => a+b, 0).toFixed(3)
  };
}

function researchHandler(req, res, p) {
  if (!p.startsWith('/api/research/')) {
    return false;
  }

  if (!authorized(req)) {
    respond(res, 401, {
      error: 'admin_key_required'
    });
    return true;
  }

  if (
    req.method === 'GET' &&
    p === '/api/research/diagnostics'
  ) {
    evolve();
    persist();

    respond(res, 200, researchMetrics());
    return true;
  }

  if (
    req.method === 'POST' &&
    p === '/api/research/experiment'
  ) {
    // Check same-origin browser requests.
    if (req.headers.origin) {
      let host;

      try {
        host = new URL(req.headers.origin).host;
      } catch {
        respond(res, 403, {error:'origin'});
        return true;
      }

      if (host !== req.headers.host) {
        respond(res, 403, {error:'origin'});
        return true;
      }
    }

    let body = '';
    let tooLarge = false;

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 1024) tooLarge = true;
    });

    req.on('end', () => {
      if (tooLarge) {
        respond(res, 413, {error:'too_large'});
        return;
      }

      let payload;

      try {
        payload = JSON.parse(body);
      } catch {
        respond(res, 400, {error:'invalid_json'});
        return;
      }

      if (
        payload.action === 'simulate' &&
        Number.isInteger(payload.count) &&
        payload.count >= 1 &&
        payload.count <= 200
      ) {
        for (let i=0; i<payload.count; i++) {
          submit(Array.from({length:8}, rand));
        }

      } else if (
        payload.action === 'advance' &&
        Number.isInteger(payload.days) &&
        payload.days >= 1 &&
        payload.days <= 365
      ) {
        evolve();

        for (
          let remaining=payload.days;
          remaining>0;
        ) {
          const dt = Math.min(5, remaining);
          evolveStep(dt);
          remaining -= dt;
        }

        memory.last = Date.now();
        dirty = true;

      } else {
        respond(res, 400, {
          error:'invalid_action_or_limits'
        });
        return;
      }

      persist();

      respond(res, 200, {
        ok:true,
        metrics:researchMetrics()
      });
    });

    return true;
  }

  respond(res, 405, {error:'method_not_allowed'});
  return true;
}

`;

change(
  'const server=http.createServer((req,res)=>{',
  research + '\nconst server=http.createServer((req,res)=>{'
);

change(
  'const p=url.pathname;',
  'const p=url.pathname;\n' +
  '  if(researchHandler(req,res,p)) return;'
);

fs.writeFileSync(output, code);

console.log(
  'Created server12.js from server11.js'
);
