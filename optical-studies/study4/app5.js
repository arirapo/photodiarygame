/*
  OPTICAL STUDY 4.5
  HIDDEN QR MORPH
  --------------------------------
  QR-based autostereogram with editable content
*/

const canvas = document.getElementById("stereogram");
const ctx = canvas.getContext("2d");

const statusElement = document.getElementById("status");
const qrTextInput = document.getElementById("qrText");
const morphSlider = document.getElementById("morphAmount");
const morphValue = document.getElementById("morphValue");

const updateQRButton = document.getElementById("updateQR");
const togglePreviewButton = document.getElementById("togglePreview");
const regenerateButton = document.getElementById("regenerate");
const playMorphButton = document.getElementById("playMorph");

const W = canvas.width;
const H = canvas.height;

const SETTINGS = {
  patternWidth: 120,
  maxShift: 20,
  noiseSeed: 2027,
  depthStrength: 0.95,
  qrDepth: 0.92,
  abstractDepth: 0.42,
  quietZoneModules: 4,
  qrScale: 13
};

let qrMatrix = null;
let qrSize = 0;
let depthMap = new Float32Array(W * H);
let previewMode = false;
let animationFrame = null;

const depthCanvas = document.createElement("canvas");
depthCanvas.width = W;
depthCanvas.height = H;
const depthCtx = depthCanvas.getContext("2d");

// --------------------------------
// Utilities
// --------------------------------

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(a, b, x) {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function hash(x, y, seed) {
  let h = Math.imul(x + seed, 374761393)
        ^ Math.imul(y + seed, 668265263);

  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function stopAnimation() {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
}

// --------------------------------
// QR generation
// --------------------------------

function buildQRMatrix(text) {
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();

  const count = qr.getModuleCount();
  const matrix = [];

  for (let y = 0; y < count; y++) {
    const row = [];
    for (let x = 0; x < count; x++) {
      row.push(qr.isDark(y, x));
    }
    matrix.push(row);
  }

  qrMatrix = matrix;
  qrSize = count;
}

function moduleType(x, y) {
  // Finder patterns in 3 corners
  const tl = (x < 7 && y < 7);
  const tr = (x >= qrSize - 7 && y < 7);
  const bl = (x < 7 && y >= qrSize - 7);

  if (tl || tr || bl) return "finder";

  // Timing patterns
  if (x === 6 || y === 6) return "timing";

  return "data";
}

// --------------------------------
// Depth-map construction
// --------------------------------

function buildDepthMap() {
  depthMap = new Float32Array(W * H);

  const morph = parseFloat(morphSlider.value);
  morphValue.textContent = morph.toFixed(2);

  const fullModules = qrSize + SETTINGS.quietZoneModules * 2;
  const qrPixelSize = fullModules * SETTINGS.qrScale;

  const startX = Math.floor((W - qrPixelSize) / 2);
  const startY = Math.floor((H - qrPixelSize) / 2);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const index = y * W + x;

      let depth = 0;

      const localX = x - startX;
      const localY = y - startY;

      if (
        localX >= 0 &&
        localY >= 0 &&
        localX < qrPixelSize &&
        localY < qrPixelSize
      ) {
        const moduleX = Math.floor(localX / SETTINGS.qrScale) - SETTINGS.quietZoneModules;
        const moduleY = Math.floor(localY / SETTINGS.qrScale) - SETTINGS.quietZoneModules;

        const insideQR =
          moduleX >= 0 &&
          moduleY >= 0 &&
          moduleX < qrSize &&
          moduleY < qrSize;

        if (insideQR) {
          const dark = qrMatrix[moduleY][moduleX];
          const kind = moduleType(moduleX, moduleY);

          // Abstract pre-form: soft field and proto-structure
          const cellX = (localX % SETTINGS.qrScale) / SETTINGS.qrScale;
          const cellY = (localY % SETTINGS.qrScale) / SETTINGS.qrScale;

          const abstractCell =
            1 -
            Math.abs(cellX - 0.5) * 1.6 -
            Math.abs(cellY - 0.5) * 1.6;

          const abstractNoise =
            hash(moduleX * 17, moduleY * 23, 991) * 0.25;

          let abstractDepth = 0;

          if (kind === "finder") {
            abstractDepth = 0.34 + abstractNoise;
          } else if (kind === "timing") {
            abstractDepth = 0.18 + abstractNoise * 0.6;
          } else {
            abstractDepth = SETTINGS.abstractDepth * clamp(abstractCell, 0, 1) + abstractNoise;
          }

          // Final QR structure
          let qrDepth = 0;

          if (dark) {
            if (kind === "finder") {
              qrDepth = SETTINGS.qrDepth;
            } else if (kind === "timing") {
              qrDepth = SETTINGS.qrDepth * 0.72;
            } else {
              qrDepth = SETTINGS.qrDepth * 0.82;
            }

            // Slightly strengthen module centers
            const centerBoost =
              1 - smoothstep(0.42, 0.76, Math.abs(cellX - 0.5) + Math.abs(cellY - 0.5));

            qrDepth += centerBoost * 0.08;
          }

          depth = lerp(abstractDepth, qrDepth, morph);
        }
      }

      depthMap[index] = clamp(depth * SETTINGS.depthStrength);
    }
  }

  renderDepthPreview();
}

function renderDepthPreview() {
  const image = depthCtx.createImageData(W, H);

  for (let i = 0; i < W * H; i++) {
    const value = Math.round(depthMap[i] * 255);
    const p = i * 4;

    image.data[p] = value;
    image.data[p + 1] = value;
    image.data[p + 2] = value;
    image.data[p + 3] = 255;
  }

  depthCtx.putImageData(image, 0, 0);
}

// --------------------------------
// Stereogram generation
// --------------------------------

function generateStereogram() {
  const image = ctx.createImageData(W, H);
  const pixels = image.data;
  const period = SETTINGS.patternWidth;

  for (let y = 0; y < H; y++) {
    const row = new Uint8ClampedArray(W);

    for (let x = 0; x < period; x++) {
      const n = hash(x, y, SETTINGS.noiseSeed);
      row[x] = Math.round(60 + n * 175);
    }

    for (let x = period; x < W; x++) {
      const depth = depthMap[y * W + x];
      const shift = Math.round(depth * SETTINGS.maxShift);
      const sourceX = Math.max(0, x - period + shift);
      row[x] = row[sourceX];
    }

    for (let x = 0; x < W; x++) {
      const value = row[x];
      const p = (y * W + x) * 4;

      pixels[p] = value;
      pixels[p + 1] = value;
      pixels[p + 2] = value;
      pixels[p + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  statusElement.textContent =
    "QR hidden in depth. Relax your gaze beyond the surface.";
  togglePreviewButton.textContent = "Show depth map";
}

function showPreview() {
  ctx.drawImage(depthCanvas, 0, 0);
  statusElement.textContent =
    "Depth map preview: brighter areas are closer.";
  togglePreviewButton.textContent = "Show stereogram";
}

// --------------------------------
// Update cycle
// --------------------------------

function rebuildAndRender() {
  buildDepthMap();

  if (previewMode) {
    showPreview();
  } else {
    generateStereogram();
  }
}

function updateQR() {
  stopAnimation();

  const text = qrTextInput.value.trim() || "https://photodiarygame.com/";
  buildQRMatrix(text);
  rebuildAndRender();
}

// --------------------------------
// Morph animation
// --------------------------------

function playMorph() {
  stopAnimation();
  previewMode = false;

  const start = performance.now();
  const duration = 2800;

  function frame(now) {
    const t = clamp((now - start) / duration);
    const eased = t < 0.5
      ? 2 * t * t
      : 1 - Math.pow(-2 * t + 2, 2) / 2;

    morphSlider.value = eased.toFixed(2);
    rebuildAndRender();

    if (t < 1) {
      animationFrame = requestAnimationFrame(frame);
    } else {
      animationFrame = null;
    }
  }

  animationFrame = requestAnimationFrame(frame);
}

// --------------------------------
// Events
// --------------------------------

updateQRButton.addEventListener("click", updateQR);

qrTextInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    updateQR();
  }
});

morphSlider.addEventListener("input", () => {
  stopAnimation();
  rebuildAndRender();
});

togglePreviewButton.addEventListener("click", () => {
  previewMode = !previewMode;

  if (previewMode) {
    showPreview();
  } else {
    generateStereogram();
  }
});

regenerateButton.addEventListener("click", () => {
  stopAnimation();
  SETTINGS.noiseSeed += 137;
  if (previewMode) {
    previewMode = false;
  }
  generateStereogram();
});

playMorphButton.addEventListener("click", () => {
  morphSlider.value = "0";
  playMorph();
});

// --------------------------------
// Init
// --------------------------------

function init() {
  buildQRMatrix(qrTextInput.value.trim());
  rebuildAndRender();
}

init();
