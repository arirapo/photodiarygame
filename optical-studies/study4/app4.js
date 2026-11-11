
/*
  OPTICAL STUDY 4.4
  HIDDEN SKULL DEPTH
  ------------------------------
  Photo-assisted autostereogram

  Original photograph: IMG_0274.jpeg

  Features:
  - Controlled 3D skull geometry
  - Photographic surface details
  - Depth map preview
  - Regenerating random-dot pattern
  - No external libraries
*/

const canvas = document.getElementById("stereogram");
const ctx = canvas.getContext("2d");

const statusElement = document.getElementById("status");
const previewButton = document.getElementById("togglePreview");
const regenerateButton = document.getElementById("regenerate");

const W = canvas.width;
const H = canvas.height;

const SETTINGS = {
  imagePath: "IMG_0274.jpeg",

  patternWidth: 120,
  maxShift: 22,
  noiseSeed: 2026,

  depthStrength: 0.95,
  photoInfluence: 0.16,

  invertDepth: false,

  // Photograph crop
  cropX: 0.055,
  cropY: 0.055,
  cropWidth: 0.89,
  cropHeight: 0.91
};

let depthMap = new Float32Array(W * H);
let previewMode = false;

const photoCanvas = document.createElement("canvas");
photoCanvas.width = W;
photoCanvas.height = H;

const photoCtx = photoCanvas.getContext("2d", {
  willReadFrequently: true
});

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

function smoothstep(a, b, value) {
  const t = clamp((value - a) / (b - a));
  return t * t * (3 - 2 * t);
}

function ellipse(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy;
}

function roundedVolume(value, strength = 1) {
  if (value >= 1) return 0;

  return Math.sqrt(
    Math.max(0, 1 - value)
  ) * strength;
}

function hash(x, y, seed) {
  let h = Math.imul(x + seed, 374761393)
        ^ Math.imul(y + seed, 668265263);

  h = Math.imul(h ^ (h >>> 13), 1274126177);

  return (
    (h ^ (h >>> 16)) >>> 0
  ) / 4294967295;
}

// --------------------------------
// Image loading
// --------------------------------

function loadImage(path) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => resolve(image);

    image.onerror = () => {
      reject(new Error("Image not found: " + path));
    };

    image.src = path;
  });
}

function preparePhotograph(image) {
  photoCtx.clearRect(0, 0, W, H);

  // Crop outer background of original photograph.
  const sx = image.width * SETTINGS.cropX;
  const sy = image.height * SETTINGS.cropY;
  const sw = image.width * SETTINGS.cropWidth;
  const sh = image.height * SETTINGS.cropHeight;

  // Position the skull within the stereogram.
  const targetW = 470;
  const targetH = 590;

  const dx = (W - targetW) / 2;
  const dy = (H - targetH) / 2;

  photoCtx.drawImage(
    image,
    sx, sy, sw, sh,
    dx, dy, targetW, targetH
  );

  return photoCtx.getImageData(0, 0, W, H);
}

// --------------------------------
// Skull geometry
// --------------------------------

function skullGeometry(x, y) {
  const scale = H * 0.47;

  const nx = (x - W / 2) / scale;
  const ny = (y - H / 2) / scale;

  let depth = 0;

  // Cranium
  const cranium = ellipse(
    nx, ny,
    0, -0.25,
    0.68, 0.72
  );

  depth = Math.max(
    depth,
    roundedVolume(cranium, 0.92)
  );

  // Temporal regions
  const leftTemple = ellipse(
    nx, ny,
    -0.48, -0.05,
    0.19, 0.39
  );

  const rightTemple = ellipse(
    nx, ny,
    0.48, -0.05,
    0.19, 0.39
  );

  depth = Math.max(
    depth,
    roundedVolume(leftTemple, 0.56),
    roundedVolume(rightTemple, 0.56)
  );

  // Cheekbones
  const leftCheek = ellipse(
    nx, ny,
    -0.39, 0.28,
    0.25, 0.19
  );

  const rightCheek = ellipse(
    nx, ny,
    0.39, 0.28,
    0.25, 0.19
  );

  depth = Math.max(
    depth,
    roundedVolume(leftCheek, 0.7),
    roundedVolume(rightCheek, 0.7)
  );

  // Upper jaw
  const upperJaw = ellipse(
    nx, ny,
    0, 0.48,
    0.46, 0.27
  );

  depth = Math.max(
    depth,
    roundedVolume(upperJaw, 0.65)
  );

  // Lower jaw
  const lowerJaw = ellipse(
    nx, ny,
    0, 0.66,
    0.39, 0.31
  );

  depth = Math.max(
    depth,
    roundedVolume(lowerJaw, 0.57)
  );

  // Eye sockets
  const leftEye = ellipse(
    nx, ny,
    -0.27, -0.12,
    0.22, 0.22
  );

  const rightEye = ellipse(
    nx, ny,
    0.27, -0.12,
    0.22, 0.22
  );

  // Carve sockets inward
  const eyeCavity = Math.max(
    roundedVolume(leftEye),
    roundedVolume(rightEye)
  );

  depth = Math.max(
    0,
    depth - eyeCavity * 0.82
  );

  // Nose cavity
  const nose = ellipse(
    nx, ny,
    0, 0.27,
    0.135, 0.22
  );

  depth = Math.max(
    0,
    depth - roundedVolume(nose) * 0.72
  );

  // Nasal ridge
  const ridge = ellipse(
    nx, ny,
    0, 0.02,
    0.09, 0.22
  );

  depth = Math.max(
    depth,
    roundedVolume(ridge, 0.54)
  );

  // Teeth
  if (
    Math.abs(nx) < 0.36 &&
    ny > 0.52 &&
    ny < 0.78
  ) {
    const verticalGrooves =
      Math.abs(Math.sin(nx * 28));

    const grooveStrength =
      1 - smoothstep(
        0.72, 0.96, verticalGrooves
      );

    depth *= 1 - grooveStrength * 0.25;

    // Horizontal separation
    const mouthLine = Math.exp(
      -Math.pow((ny - 0.65) * 55, 2)
    );

    depth *= 1 - mouthLine * 0.42;
  }

  return clamp(depth);
}

// --------------------------------
// Build photographic depth map
// --------------------------------

function buildDepthMap(photoData) {
  const pixels = photoData.data;

  // First pass: geometric volume and photo detail.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {

      const i = y * W + x;
      const p = i * 4;

      const r = pixels[p] / 255;
      const g = pixels[p + 1] / 255;
      const b = pixels[p + 2] / 255;

      const luminance =
        0.2126 * r +
        0.7152 * g +
        0.0722 * b;

      const geometry = skullGeometry(x, y);

      // The photograph adds fine surface variation.
      // Geometry defines the main silhouette.
      const photoDetail =
        (luminance - 0.5) *
        SETTINGS.photoInfluence;

      let depth = geometry;

      if (geometry > 0.02) {
        depth = geometry + photoDetail * geometry;
      }

      depth = clamp(
        depth * SETTINGS.depthStrength
      );

      if (SETTINGS.invertDepth) {
        depth = 1 - depth;
      }

      depthMap[i] = depth;
    }
  }

  createDepthPreview();
}

// --------------------------------
// Depth map preview
// --------------------------------

function createDepthPreview() {
  const image = depthCtx.createImageData(W, H);

  for (let i = 0; i < W * H; i++) {
    const value = Math.round(
      depthMap[i] * 255
    );

    const p = i * 4;

    image.data[p] = value;
    image.data[p + 1] = value;
    image.data[p + 2] = value;
    image.data[p + 3] = 255;
  }

  depthCtx.putImageData(image, 0, 0);
}

function showDepthPreview() {
  ctx.drawImage(depthCanvas, 0, 0);

  statusElement.textContent =
    "Depth map: brighter areas are closer.";

  previewButton.textContent =
    "Show stereogram";
}

// --------------------------------
// Autostereogram generation
// --------------------------------

function generateStereogram() {
  const image = ctx.createImageData(W, H);
  const pixels = image.data;

  const period = SETTINGS.patternWidth;

  for (let y = 0; y < H; y++) {
    const row = new Uint8ClampedArray(W);

    // Seed pattern
    for (let x = 0; x < period; x++) {
      const n = hash(
        x, y, SETTINGS.noiseSeed
      );

      row[x] = Math.round(65 + n * 170);
    }

    // Depth-dependent pattern repetition
    for (let x = period; x < W; x++) {
      const depth = depthMap[y * W + x];

      const shift = Math.round(
        depth * SETTINGS.maxShift
      );

      const sourceX = Math.max(
        0,
        x - period + shift
      );

      row[x] = row[sourceX];
    }

    // Transfer to canvas
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
    "The skull is hidden. Look beyond the surface.";

  previewButton.textContent =
    "Show depth map";
}

// --------------------------------
// Interface
// --------------------------------

previewButton.addEventListener("click", () => {
  previewMode = !previewMode;

  if (previewMode) {
    showDepthPreview();
  } else {
    generateStereogram();
  }
});

regenerateButton.addEventListener("click", () => {
  SETTINGS.noiseSeed += 137;

  previewMode = false;

  generateStereogram();
});

// --------------------------------
// Initialize
// --------------------------------

async function init() {
  try {
    statusElement.textContent =
      "Loading photographic source...";

    const photo = await loadImage(
      SETTINGS.imagePath
    );

    const photoData = preparePhotograph(photo);

    statusElement.textContent =
      "Building the skull depth structure...";

    buildDepthMap(photoData);

    generateStereogram();

  } catch (error) {
    console.error(error);

    statusElement.textContent =
      "Could not load IMG_0274.jpeg";
  }
}

init();
