/*
  OPTICAL STUDY 4.3
  HIDDEN SKULL IMAGE
  --------------------------------
  Uses a real skull photo as the depth source
*/

const canvas = document.getElementById("stereogram");
const ctx = canvas.getContext("2d", {
  willReadFrequently: true
});

const statusElement = document.getElementById("status");

const W = canvas.width;
const H = canvas.height;

const SETTINGS = {
  imagePath: "IMG_0274.jpeg",

  patternWidth: 120,
  maxShift: 24,
  noiseSeed: 913,

  // depth-map controls
  invertDepth: false,
  contrast: 1.65,
  brightness: -0.02,
  gamma: 0.95,

  // how strongly the image affects depth
  depthStrength: 0.95,

  // crop behavior
  fitMode: "contain" // "contain" or "cover"
};

// Offscreen canvases
const sourceCanvas = document.createElement("canvas");
const sourceCtx = sourceCanvas.getContext("2d", {
  willReadFrequently: true
});

let depthMap = null;

// ----------------------------
// Utilities
// ----------------------------

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function hash(x, y, seed) {
  let h = Math.imul(x + seed, 374761393)
        ^ Math.imul(y + seed, 668265263);

  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
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
// Image loading
// ----------------------------

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawFittedImage(ctx, img, targetW, targetH, fitMode = "contain") {
  const imgRatio = img.width / img.height;
  const targetRatio = targetW / targetH;

  let drawW, drawH, offsetX, offsetY;

  if (fitMode === "cover") {
    if (imgRatio > targetRatio) {
      drawH = targetH;
      drawW = drawH * imgRatio;
    } else {
      drawW = targetW;
      drawH = drawW / imgRatio;
    }
  } else {
    // contain
    if (imgRatio > targetRatio) {
      drawW = targetW;
      drawH = drawW / imgRatio;
    } else {
      drawH = targetH;
      drawW = drawH * imgRatio;
    }
  }

  offsetX = (targetW - drawW) / 2;
  offsetY = (targetH - drawH) / 2;

  ctx.clearRect(0, 0, targetW, targetH);
  ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
}

// ----------------------------
// Depth map generation
// ----------------------------

function buildDepthMapFromImage() {
  const imageData = sourceCtx.getImageData(0, 0, W, H);
  const data = imageData.data;
  const map = new Float32Array(W * H);

  for (let i = 0; i < W * H; i++) {
    const p = i * 4;
    const r = data[p] / 255;
    const g = data[p + 1] / 255;
    const b = data[p + 2] / 255;

    // luminance
    let luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    // gamma
    luma = Math.pow(luma, SETTINGS.gamma);

    // contrast + brightness
    luma = (luma - 0.5) * SETTINGS.contrast + 0.5 + SETTINGS.brightness;
    luma = clamp(luma);

    // optional inversion
    if (SETTINGS.invertDepth) {
      luma = 1 - luma;
    }

    map[i] = luma * SETTINGS.depthStrength;
  }

  return map;
}

function getDepth(x, y) {
  if (!depthMap) return 0;
  return depthMap[y * W + x];
}

// ----------------------------
// Pattern generation
// ----------------------------

function createPatternRow(y, width) {
  const row = new Uint8ClampedArray(width * 3);

  // A restrained cool-toned color texture
  const rowHueOffset = Math.sin(y * 0.02) * 18;

  for (let x = 0; x < width; x++) {
    const n1 = hash(x, y, SETTINGS.noiseSeed);
    const n2 = hash(x * 3, y * 5, SETTINGS.noiseSeed + 51);
    const n3 = hash(x * 7, y * 2, SETTINGS.noiseSeed + 117);

    const hue = 210 + rowHueOffset + lerp(-35, 35, n2);
    const sat = lerp(18, 48, n3);
    const light = lerp(34, 80, n1);

    const rgb = hslToRgb(hue, sat, light);
    const i = x * 3;

    row[i] = rgb.r;
    row[i + 1] = rgb.g;
    row[i + 2] = rgb.b;
  }

  return row;
}

// ----------------------------
// Stereogram generator
// ----------------------------

function generateStereogram() {
  statusElement.textContent =
    "Generating stereogram from your skull photograph...";

  const image = ctx.createImageData(W, H);
  const pixels = image.data;

  const patternWidth = SETTINGS.patternWidth;

  for (let y = 0; y < H; y++) {
    const row = new Uint8ClampedArray(W * 3);

    const seedPattern = createPatternRow(y, patternWidth);

    for (let i = 0; i < seedPattern.length; i++) {
      row[i] = seedPattern[i];
    }

    for (let x = patternWidth; x < W; x++) {
      const depth = getDepth(x, y);
      const shift = Math.round(depth * SETTINGS.maxShift);

      const sourceX = Math.max(0, x - patternWidth + shift);
      const src = sourceX * 3;
      const dst = x * 3;

      row[dst] = row[src];
      row[dst + 1] = row[src + 1];
      row[dst + 2] = row[src + 2];
    }

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
    "Your skull photograph is now hidden as depth.";
}

// ----------------------------
// Init
// ----------------------------

async function init() {
  try {
    statusElement.textContent = "Loading skull photograph...";

    const img = await loadImage(SETTINGS.imagePath);

    sourceCanvas.width = W;
    sourceCanvas.height = H;

    drawFittedImage(sourceCtx, img, W, H, SETTINGS.fitMode);

    depthMap = buildDepthMapFromImage();
    generateStereogram();

  } catch (error) {
    console.error(error);
    statusElement.textContent =
      "Could not load skull-photo.jpg";
  }
}

// click = new pattern
canvas.addEventListener("click", () => {
  SETTINGS.noiseSeed += 133;
  generateStereogram();
});

init();
