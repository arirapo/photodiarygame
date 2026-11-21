
'use strict';

// MPE 1.3.2 — Deep Memory Inspector
// Visual research update only.
// Does not change the server or memory data.

const fs = require('node:fs');
const path = require('node:path');

const dir = __dirname;
const target = path.join(dir, 'test121.html');
const backup = path.join(
  dir, 'test121_before_inspector.html'
);

if (!fs.existsSync(target)) {
  throw Error('test121.html not found');
}

if (fs.existsSync(backup)) {
  throw Error(
    'Backup already exists. No changes made.'
  );
}

let html = fs.readFileSync(target, 'utf8');

function replaceOnce(before, after) {
  if (!html.includes(before)) {
    throw Error(
      'Unexpected file structure: ' +
      before.slice(0, 80)
    );
  }
  html = html.replace(before, after);
}

replaceOnce(
  '<button data-view="poem">Visual Haiku</button>',
  '<button data-view="poem">Visual Haiku</button>' +
  '<button data-view="deep">Deep Memory Only</button>'
);

replaceOnce(
  '<h3>Changing perception</h3>',
  `<h3>Changing perception</h3>
  <div class="muted" style="margin:8px 0">
    Deep memory visibility:
    <input id="deepStrength" type="range"
      min="0" max="2" step="0.1" value="1"
      style="vertical-align:middle;max-width:160px;width:40%">
    <span id="deepStrengthValue">1.0×</span>
  </div>`
);

replaceOnce(
  "let state=null,view='living',photo=null",
  "let deepIntensity=1,onlyCache=null,onlyKey='';" +
  "let state=null,view='living',photo=null"
);

replaceOnce(
  "ctx.globalAlpha=view==='constellation'?.42:.29;",
  "ctx.globalAlpha=(view==='constellation'?.42:.29)*deepIntensity;"
);

const inspector = `
function deepOnly(ctx,w,h) {
  if(
    !state?.deepField ||
    state.deepField.length!==2048
  ) return;

  const cells=state.deepField;

  const identity=
    state.days+'|'+
    (state.deepStats?.mean||0)+'|'+
    (state.deepStats?.max||0);

  if(!onlyCache || onlyKey!==identity) {
    onlyKey=identity;

    const cv=document.createElement('canvas');
    cv.width=64;
    cv.height=32;

    const cg=cv.getContext('2d');
    const pix=cg.createImageData(64,32);

    let lo=1,hi=0;

    for(const v of cells) {
      lo=Math.min(lo,v);
      hi=Math.max(hi,v);
    }

    const span=Math.max(.025,hi-lo);

    for(let i=0;i<cells.length;i++) {
      const n=clamp((cells[i]-lo)/span);
      const smooth=n*n*(3-2*n);
      const k=i*4;

      pix.data[k]=Math.round(9+107*smooth);
      pix.data[k+1]=Math.round(21+150*smooth);
      pix.data[k+2]=Math.round(32+142*smooth);
      pix.data[k+3]=255;
    }

    cg.putImageData(pix,0,0);
    onlyCache=cv;
  }

  ctx.save();
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(onlyCache,0,0,w,h);

  const scale=Math.min(w,h);
  const shade=ctx.createLinearGradient(0,0,0,h);

  shade.addColorStop(0,'rgba(5,12,20,.5)');
  shade.addColorStop(.25,'rgba(5,12,20,0)');
  shade.addColorStop(.75,'rgba(5,12,20,0)');
  shade.addColorStop(1,'rgba(5,12,20,.65)');

  ctx.fillStyle=shade;
  ctx.fillRect(0,0,w,h);

  ctx.fillStyle='rgba(220,232,229,.84)';
  ctx.font=Math.max(
    10,Math.round(scale*.025)
  )+'px monospace';

  ctx.fillText(
    'DEEP MEMORY / HISTORICAL FIELD',
    16,26
  );

  const d=state.deepStats||{};

  ctx.font=Math.max(
    10,Math.round(scale*.021)
  )+'px monospace';

  ctx.fillText(
    'mean '+Number(d.mean||0).toFixed(3)+
    '   variance '+Number(d.variance||0).toFixed(5)+
    '   contrast '+Number(d.contrast||0).toFixed(3),
    16,h-16
  );

  ctx.restore();
}
`;

replaceOnce(
  'function draw(){requestAnimationFrame(draw);',
  inspector +
  'function draw(){requestAnimationFrame(draw);'
);

replaceOnce(
  'g.fillRect(0,0,w,h);drawDeep(g,w,h);ghost(g,w,h);',
  `g.fillRect(0,0,w,h);
   if(view==='deep') {
     deepOnly(g,w,h);
     return;
   }
   drawDeep(g,w,h);
   ghost(g,w,h);`
);

replaceOnce(
  "$('changePhoto').onclick=changePhoto;",
  `$('deepStrength').oninput=()=>{
    deepIntensity=Number($('deepStrength').value);
    $('deepStrengthValue').textContent=
      deepIntensity.toFixed(1)+'×';
  };
  $('changePhoto').onclick=changePhoto;`
);

// Write only after every replacement succeeds.

fs.writeFileSync(
  backup,
  fs.readFileSync(target)
);

const temp=target+'.new';
fs.writeFileSync(temp,html);
fs.renameSync(temp,target);

console.log('Deep Memory Inspector installed.');
console.log('Backup: test121_before_inspector.html');
console.log('Reload test121.html on port 3005.');
