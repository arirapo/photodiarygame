
/*
  OPTICAL STUDY 4.1
  VANITAS STEREOGRAM
  ----------------------------
  Generative skull autostereogram
  No external libraries
*/

const canvas = document.getElementById("stereogram");
const ctx = canvas.getContext("2d", {
  willReadFrequently: true
});

const statusElement = document.getElementById("status");

const W = canvas.width;
const H = canvas.height;

// Stereogram parameters
const SETTINGS = {
  patternWidth: 110,
  maxShift: 23,
  noiseSeed: 417,
  backgroundDepth: 0,
  skullDepth: 0.9
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

// ----------------------------
// Skull depth map
// ----------------------------

function skullDepth(x, y) {
  // Normalized coordinates
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
  const leftCheek = ellipse(
    nx, ny, -0.38, 0.23, 0.24, 0.19
  );

  const rightCheek = ellipse(
    nx, ny, 0.38, 0.23, 0.24, 0.19
  );

  if (leftCheek < 1) {
    depth = Math.max(
      depth,
      0.55 * Math.sqrt(1 - leftCheek)
    );
  }

  if (rightCheek < 1) {
    depth = Math.max(
      depth,
      0.55 * Math.sqrt(1 - rightCheek)
    );
  }

  // Jaw
  const jaw = ellipse(
    nx, ny, 0, 0.46, 0.42, 0.38
  );

  if (jaw < 1) {
    depth = Math.max(
      depth,
      0.62 * Math.sqrt(1 - jaw)
    );
  }

  // Eye sockets
  const leftEye = ellipse(
    nx, ny, -0.25, -0.12, 0.19, 0.21
  );

  const rightEye = ellipse(
    nx, ny, 0.25, -0.12, 0.19, 0.21
  );

  if (leftEye < 1) {
    depth *= smoothstep(0.12, 0.9, leftEye) * 0.45;
  }

  if (rightEye < 1) {
    depth *= smoothstep(0.12, 0.9, rightEye) * 0.45;
  }

  // Nose cavity
  const nose = ellipse(
    nx, ny, 0, 0.19, 0.105, 0.19
  );

  if (nose < 1) {
    depth *= smoothstep(0.05, 0.9, nose) * 0.35;
  }

  // Teeth / mouth grooves
  if (
    Math.abs(nx) < 0.32 &&
    ny > 0.43 &&
    ny < 0.65
  ) {
    const toothPattern = Math.abs(
      Math.sin(nx * 35)
    );

    const groove = 1 - smoothstep(
      0.78, 0.96, toothPattern
    );

    depth *= 1 - groove * 0.38;
  }

  return clamp(depth * SETTINGS.skullDepth);
}

// ----------------------------
// Autostereogram generator
// ----------------------------

function generateStereogram() {
  statusElement.textContent =
    "Generating the hidden skull...";

  const image = ctx.createImageData(W, H);
  const pixels = image.data;

  const patternWidth = SETTINGS.patternWidth;

  for (let y = 0; y < H; y++) {

    // Each row gets its own repeating texture.
    const row = new Uint8ClampedArray(W * 3);

    // Generate initial random pattern
    for (let x = 0; x < patternWidth; x++) {
      const noise = hash(
        x, y, SETTINGS.noiseSeed
      );

      const value = Math.floor(
        70 + noise * 165
      );

      const i = x * 3;

      row[i] = value;
      row[i + 1] = value;
      row[i + 2] = value;
    }

    // Repeat pattern with depth-dependent displacement
    for (let x = patternWidth; x < W; x++) {

      const depth = skullDepth(x, y);

      const shift = Math.round(
        depth * SETTINGS.maxShift
      );

      const sourceX = Math.max(
        0,
        x - patternWidth + shift
      );

      const src = sourceX * 3;
      const dst = x * 3;

      row[dst] = row[src];
      row[dst + 1] = row[src + 1];
      row[dst + 2] = row[src + 2];
    }

    // Copy row to canvas image data
    for (let x = 0; x < W; x++) {
      const source = x * 3;
      const target = (y * W + x) * 4;

      pixels[target] = row[source];
      pixels[target + 1] = row[source + 1];
      pixels[target + 2] = row[source + 2];
      pixels[target + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);

  statusElement.textContent =
    "The skull is present. Can you see it?";
}

// ----------------------------
// Start
// ----------------------------

generateStereogram();
