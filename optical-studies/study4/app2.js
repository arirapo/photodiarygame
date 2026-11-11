/*
  OPTICAL STUDY 4.2
  CHROMATIC VANITAS
  --------------------------------
  Generative color autostereogram
  No external libraries
*/

const canvas = document.getElementById("stereogram");
const ctx = canvas.getContext("2d", {
  willReadFrequently: true
});

const statusElement = document.getElementById("status");

const W = canvas.width;
const H = canvas.height;

const SETTINGS = {
  patternWidth: 120,
  maxShift: 24,
  noiseSeed: 731,
  skullDepth: 0.92,

  // color controls
  hueBase: 210,
  hueRange: 120,
  saturationMin: 35,
  saturationMax: 80,
  lightnessMin: 35,
  lightnessMax: 78
};

// ----------------------------
// Utilities
// ----------------------------

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function ellipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy;
}

function hash(x, y, seed) {
  let h = Math.imul(x + seed, 374761393)
        ^ Math.imul(y + seed, 668265263);

  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  s /= 100;
  l /= 100;

  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));

  let r1 = 0, g1 = 0, b1 = 0;

  if (hp >= 0 && hp < 1) {
    r1 = c; g1 = x; b1 = 0;
  } else if (hp >= 1 && hp < 2) {
    r1 = x; g1 = c; b1 = 0;
  } else if (hp >= 2 && hp < 3) {
    r1 = 0; g1 = c; b1 = x;
  } else if (hp >= 3 && hp < 4) {
    r1 = 0; g1 = x; b1 = c;
  } else if (hp >= 4 && hp < 5) {
    r1 = x; g1 = 0; b1 = c;
  } else {
    r1 = c; g1 = 0; b1 = x;
  }

  const m = l - c / 2;

  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255)
  };
}

// ----------------------------
// Skull depth map
// ----------------------------

function skullDepth(x, y) {
  const nx = (x - W / 2) / (H * 0.47);
  const ny = (y - H / 2) / (H * 0.47);

  let depth = 0;

  // Cranium
  const head = ellipse(nx, ny, 0, -0.24, 0.60, 0.68);
  if (head < 1) {
    depth = Math.max(
      depth,
      Math.sqrt(Math.max(0, 1 - head)) * 0.92
    );
  }

  // Cheekbones
  const leftCheek = ellipse(nx, ny, -0.38, 0.23, 0.24, 0.19);
  const rightCheek = ellipse(nx, ny, 0.38, 0.23, 0.24, 0.19);

  if (leftCheek < 1) {
    depth = Math.max(depth, 0.55 * Math.sqrt(1 - leftCheek));
  }

  if (rightCheek < 1) {
    depth = Math.max(depth, 0.55 * Math.sqrt(1 - rightCheek));
  }

  // Jaw
  const jaw = ellipse(nx, ny, 0, 0.46, 0.42, 0.38);
  if (jaw < 1) {
    depth = Math.max(depth, 0.62 * Math.sqrt(1 - jaw));
  }

  // Eye sockets
  const leftEye = ellipse(nx, ny, -0.25, -0.12, 0.19, 0.21);
  const rightEye = ellipse(nx, ny, 0.25, -0.12, 0.19, 0.21);

  if (leftEye < 1) {
    depth *= smoothstep(0.12, 0.9, leftEye) * 0.45;
  }

  if (rightEye < 1) {
    depth *= smoothstep(0.12, 0.9, rightEye) * 0.45;
  }

  // Nose cavity
  const nose = ellipse(nx, ny, 0, 0.19, 0.105, 0.19);
  if (nose < 1) {
    depth *= smoothstep(0.05, 0.9, nose) * 0.35;
  }

  // Teeth
  if (
    Math.abs(nx) < 0.32 &&
    ny > 0.43 &&
    ny < 0.65
  ) {
    const toothPattern = Math.abs(Math.sin(nx * 35));
    const groove = 1 - smoothstep(0.78, 0.96, toothPattern);
    depth *= 1 - groove * 0.38;
  }

  return clamp(depth * SETTINGS.skullDepth);
}

// ----------------------------
// Row pattern generation
// ----------------------------

function createColorPatternRow(y, width) {
  const row = new Uint8ClampedArray(width * 3);

  // subtle vertical hue drift
  const rowHueOffset = Math.sin(y * 0.018) * 25;

  for (let x = 0; x < width; x++) {
    const n1 = hash(x, y, SETTINGS.noiseSeed);
    const n2 = hash(x * 3, y * 5, SETTINGS.noiseSeed + 91);
    const n3 = hash(x * 7, y * 2, SETTINGS.noiseSeed + 211);

    const hue = SETTINGS.hueBase
      + rowHueOffset
      + lerp(-SETTINGS.hueRange / 2, SETTINGS.hueRange / 2, n2);

    const sat = lerp(
      SETTINGS.saturationMin,
      SETTINGS.saturationMax,
      n3
    );

    // keep luminance varied enough for stereogram readability
    const light = lerp(
      SETTINGS.lightnessMin,
      SETTINGS.lightnessMax,
      n1
    );

    const rgb = hslToRgb(hue, sat, light);
    const i = x * 3;

    row[i] = rgb.r;
    row[i + 1] = rgb.g;
    row[i + 2] = rgb.b;
  }

  return row;
}

// ----------------------------
// Autostereogram generator
// ----------------------------

function generateStereogram() {
  statusElement.textContent =
    "Generating the chromatic hidden skull...";

  const image = ctx.createImageData(W, H);
  const pixels = image.data;

  const patternWidth = SETTINGS.patternWidth;

  for (let y = 0; y < H; y++) {
    const row = new Uint8ClampedArray(W * 3);

    // initial repeating color texture
    const seedPattern = createColorPatternRow(y, patternWidth);

    for (let i = 0; i < seedPattern.length; i++) {
      row[i] = seedPattern[i];
    }

    // extend row using depth displacement
    for (let x = patternWidth; x < W; x++) {
      const depth = skullDepth(x, y);
      const shift = Math.round(depth * SETTINGS.maxShift);

      const sourceX = Math.max(0, x - patternWidth + shift);
      const src = sourceX * 3;
      const dst = x * 3;

      row[dst] = row[src];
      row[dst + 1] = row[src + 1];
      row[dst + 2] = row[src + 2];
    }

    // write to canvas
    for (let x = 0; x < W; x++) {
      const src = x * 3;
      const dst = (y * W + x) * 4;

      pixels[dst] = row[src];
      pixels[dst + 1] = row[src + 1];
      pixels[dst + 2] = row[src + 2];
      pixels[dst + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  statusElement.textContent =
    "A colored skull is hidden in the pattern. Relax your gaze.";
}

// click to regenerate a new color field
canvas.addEventListener("click", () => {
  SETTINGS.noiseSeed += 137;
  SETTINGS.hueBase = (SETTINGS.hueBase + 37) % 360;
  generateStereogram();
});

generateStereogram();
