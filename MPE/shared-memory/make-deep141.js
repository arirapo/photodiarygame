
'use strict';

// MPE 1.3.1 — Deep Memory Topography
// Builds a separate experiment from the working 1.3 files.
// Does not overwrite existing files or memories.

const fs = require('node:fs');
const path = require('node:path');
const dir = __dirname;

function make(input, output, transforms) {
  const dst = path.join(dir, output);

  if (fs.existsSync(dst)) {
    throw Error(output + ' exists: refusing to overwrite');
  }

  let s = fs.readFileSync(path.join(dir, input), 'utf8');

  for (const [oldText, newText] of transforms) {
    if (!s.includes(oldText)) {
      throw Error(
        'Source mismatch in ' + input + ': ' +
        oldText.slice(0, 60)
      );
    }

    s = s.replace(oldText, newText);
  }

  fs.writeFileSync(dst, s);
  console.log('Created ' + output);
}

// Preserve the spatial differences of the old memory.
// An already completely flattened field cannot be
// reconstructed into its original historical geography.

const migration = `
  result.deepFossil =
    Array.isArray(m.deepFossil) &&
    m.deepFossil.length === DEEP_SIZE
      ? m.deepFossil.map(v => clamp(Number(v) || 0))
      : result.deep.map(v =>
          clamp(Math.max(0, v - 0.085) * 2)
        );
`;

// New topographic evolution.
// No global additive brightening.
// Local variations diffuse slowly.
// A second historical layer preserves uneven structure.

const evolve = `function evolveDeepField(dt) {
  const old = memory.deep;
  const next = old.slice();
  const rock = memory.deepFossil;

  const diffusion =
    0.012 + memory.field[1] * 0.022;

  const erosion =
    0.00065 +
    (1 - memory.field[7]) * 0.00065;

  const fossilErosion = 0.000018;
  const mix = 0.0038;

  for (let y = 0; y < DEEP_H; y++) {
    for (let x = 0; x < DEEP_W; x++) {
      const i = deepIndex(x, y);
      const self = old[i];

      const left = old[
        deepIndex(Math.max(0, x - 1), y)
      ];

      const right = old[
        deepIndex(Math.min(DEEP_W - 1, x + 1), y)
      ];

      const up = old[
        deepIndex(x, Math.max(0, y - 1))
      ];

      const down = old[
        deepIndex(x, Math.min(DEEP_H - 1, y + 1))
      ];

      const laplacian =
        (left + right + up + down) / 4 - self;

      const ageVariation =
        0.7 + 0.3 * Math.sin(
          x * 0.37 +
          y * 0.63 +
          memory.history[0] * 6
        );

      const spatialDiffusion =
        diffusion * ageVariation;

      const localHistory = rock[i];

      const residual =
        memory.residue[
          Math.min(7, Math.floor(x * 8 / DEEP_W))
        ];

      const localCoupling =
        residual * localHistory * 0.0004;

      next[i] = clamp(
        self + dt * (
          spatialDiffusion * laplacian
          - erosion * self
          + mix * (localHistory - self)
          + localCoupling
        )
      );

      rock[i] *= Math.exp(
        -dt * fossilErosion
      );
    }
  }

  memory.deep = next;
}
`;

// ------------------------------------------
// SERVER 1.3.1
// ------------------------------------------

make('server14.js', 'server141.js', [
  [
    "Number(process.env.PORT || 3004)",
    "Number(process.env.PORT || 3005)"
  ],
  [
    "path.join(DIR, 'memory14.json')",
    "path.join(DIR, 'memory141.json')"
  ],
  [
    "path.join(DIR, 'memory13.json')",
    "path.join(DIR, 'memory14.json')"
  ],
  [
    "if (![13, 14].includes(m.version)",
    "if (![13, 14, 141].includes(m.version)"
  ],
  [
    "version: 14,",
    "version: 141,"
  ],
  [
    "version: 14, last: now()",
    "version: 141, last: now()"
  ],
  [
    "    version: 14,\n    days:",
    "    version: 141,\n    days:"
  ],
  [
    "deep: emptyDeep(),",
    "deep: emptyDeep(),\n    deepFossil: emptyDeep(),"
  ],
  [
    "result.deepMoments = m.deepMoments || 0;",
    "result.deepMoments = m.deepMoments || 0;" +
    migration
  ],
  [
    "memory.deep[i] = clamp(memory.deep[i] + value * 0.22, 0, 1);",
    "memory.deep[i] = clamp(memory.deep[i] + value * 0.22, 0, 1);\n" +
    "      memory.deepFossil[i] = clamp(memory.deepFossil[i] + value * 0.17, 0, 1);"
  ],
  [
    "function evolveDeepField(dt) {",
    "function legacyEvolveDeepField(dt) {"
  ],
  [
    "function evolveStep(dt) {",
    evolve + "\nfunction evolveStep(dt) {"
  ],
  [
    `  return {
    mean: total / DEEP_SIZE,
    max,
    active
  };`,
    `  const mean = total / DEEP_SIZE;
  let sumSquares = 0;

  for (const v of memory.deep) {
    sumSquares += (v - mean) ** 2;
  }

  return {
    mean,
    max,
    active,
    variance: sumSquares / DEEP_SIZE,
    contrast: max - mean
  };`
  ],
  [
    "moments: memory.deepMoments },",
    "moments: memory.deepMoments, variance: +deep.variance.toFixed(6), contrast: +deep.contrast.toFixed(4) },"
  ],
  [
    "new Set(['/', '/test12.html', '/research14.html'])",
    "new Set(['/', '/test121.html', '/research141.html'])"
  ],
  [
    "p === '/' ? 'test12.html'",
    "p === '/' ? 'test121.html'"
  ],
  [
    "MPE 1.3 Deep Memory — http://localhost:",
    "MPE 1.3.1 Deep Memory Topography — http://localhost:"
  ],
  [
    "(memory14.json)`",
    "(memory141.json)`"
  ]
]);

// ------------------------------------------
// VISUAL RESEARCH VERSION
// ------------------------------------------

make('test12.html', 'test121.html', [
  [
    'MPE 1.3 — Deep Memory',
    'MPE 1.3.1 — Deep Memory Topography'
  ],
  [
    'MPE 1.3 · DEEP MEMORY',
    'MPE 1.3.1 · DEEP MEMORY TOPOGRAPHY'
  ],
  [
    'memory14.json deep-memory experiment',
    'memory141.json deep-memory experiment'
  ],
  [
    'const v=clamp(values[i]);const j=i*4;',
    'const mean=state.deepStats?.mean||0;const contrast=state.deepStats?.contrast||0.02;const v=clamp((values[i]-mean)*3.2 + values[i]*.22,0,1);const j=i*4;'
  ],
  [
    "ctx.globalAlpha=view==='constellation'?.28:.18;",
    "ctx.globalAlpha=view==='constellation'?.42:.29;"
  ],
  [
    'moments ${ds.moments}`;',
    'moments ${ds.moments} · variance ${(ds.variance||0).toFixed(5)} · contrast ${(ds.contrast||0).toFixed(3)}`;'
  ]
]);

// ------------------------------------------
// RESEARCH CONSOLE
// ------------------------------------------

make('research14.html', 'research141.html', [
  [
    'MPE 1.3 — Research Console',
    'MPE 1.3.1 — Research Console'
  ],
  [
    'Deep Memory Console',
    'Deep Memory Topography Console'
  ],
  [
    'Port 3004 · memory14.json',
    'Port 3005 · memory141.json'
  ],
  [
    'memory14.json',
    'memory141.json'
  ],
  [
    'test12.html',
    'test121.html'
  ],
  [
    "['Deep moments',ds.moments]",
    "['Deep moments',ds.moments],['Variance',(ds.variance||0).toFixed(5)],['Contrast',(ds.contrast||0).toFixed(3)]"
  ]
]);

console.log('MPE 1.3.1 build completed.');
