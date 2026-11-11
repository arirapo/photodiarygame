
/*
  OPTICAL STUDY 4.6
  THRESHOLD OF LEGIBILITY
  ------------------------------------
  QR readability experiment

  - Editable QR content
  - Error correction levels
  - Deterministic module corruption
  - Optional structural protection
  - Manual scan results
  - CSV export

  No framework required.
*/

const $ = id => document.getElementById(id);

const modifiedCanvas = $("modifiedQR");
const originalCanvas = $("originalQR");

const modifiedCtx = modifiedCanvas.getContext("2d");
const originalCtx = originalCanvas.getContext("2d");

const qrText = $("qrText");
const errorLevel = $("errorLevel");
const morphSlider = $("morphAmount");
const protectStructure = $("protectStructure");

const morphValue = $("morphValue");
const morphMetric = $("morphMetric");
const changedPercent = $("changedPercent");
const moduleCount = $("moduleCount");
const seedField = $("seed");
const testStatus = $("testStatus");
const resultsBody = $("resultsBody");

const SETTINGS = {
  seed: 2026,
  maxCorruption: 0.65,
  quietZone: 4
};

let originalMatrix = [];
let modifiedMatrix = [];

let qrSize = 0;
let changedModules = 0;
let eligibleModules = 0;

let experimentText = "";
let experimentLevel = "M";

const results = [];

// ------------------------------------
// Utilities
// ------------------------------------

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function hash(x, y, seed) {
  let h = Math.imul(x + seed, 374761393)
        ^ Math.imul(y + seed, 668265263);

  h = Math.imul(h ^ (h >>> 13), 1274126177);

  return (
    (h ^ (h >>> 16)) >>> 0
  ) / 4294967295;
}

// ------------------------------------
// QR generation
// ------------------------------------

function generateQR() {
  const text = qrText.value || "HEI";
  const level = errorLevel.value;

  try {
    const qr = qrcode(0, level);

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

    originalMatrix = matrix;
    qrSize = count;

    experimentText = text;
    experimentLevel = level;

    moduleCount.textContent =
      `${count} × ${count}`;

    drawQR(
      originalCtx,
      originalMatrix
    );

    applyMorph();

    testStatus.textContent =
      "QR updated. Ready for testing.";

  } catch (error) {
    console.error(error);

    testStatus.textContent =
      "Could not generate QR. Try shorter content.";
  }
}

// ------------------------------------
// Protected QR structures
// ------------------------------------

function isProtected(x, y) {
  if (!protectStructure.checked) {
    return false;
  }

  // Finder patterns and immediate
  // separator / format-code areas.
  const topLeft =
    x < 9 && y < 9;

  const topRight =
    x >= qrSize - 8 && y < 9;

  const bottomLeft =
    x < 9 && y >= qrSize - 8;

  // Timing and format areas.
  const timing =
    x === 6 || y === 6;

  const formatAreas =
    x === 8 || y === 8;

  return (
    topLeft ||
    topRight ||
    bottomLeft ||
    timing ||
    formatAreas
  );
}

// ------------------------------------
// Apply controlled corruption
// ------------------------------------

function applyMorph() {
  if (!qrSize) return;

  const morph = Number(morphSlider.value);

  morphValue.textContent = morph.toFixed(2);
  morphMetric.textContent = morph.toFixed(2);

  // At 1.0 there is no corruption.
  // At 0.0 a maximum of approximately
  // 65% of eligible modules are flipped.
  const probability =
    (1 - morph) * SETTINGS.maxCorruption;

  modifiedMatrix = [];

  changedModules = 0;
  eligibleModules = 0;

  for (let y = 0; y < qrSize; y++) {
    const row = [];

    for (let x = 0; x < qrSize; x++) {

      let value = originalMatrix[y][x];

      if (!isProtected(x, y)) {
        eligibleModules++;

        const randomValue = hash(
          x,
          y,
          SETTINGS.seed
        );

        if (randomValue < probability) {
          value = !value;
          changedModules++;
        }
      }

      row.push(value);
    }

    modifiedMatrix.push(row);
  }

  const totalModules = qrSize * qrSize;

  const percentage =
    100 * changedModules / totalModules;

  changedPercent.textContent =
    percentage.toFixed(1) + "%";

  drawQR(
    modifiedCtx,
    modifiedMatrix
  );
}

// ------------------------------------
// QR drawing
// ------------------------------------

function drawQR(ctx, matrix) {
  const canvas = ctx.canvas;

  const W = canvas.width;
  const H = canvas.height;

  const quiet = SETTINGS.quietZone;
  const total = qrSize + quiet * 2;

  // Use integer pixel dimensions.
  const cell = Math.floor(
    Math.min(W, H) / total
  );

  const size = cell * total;

  const startX = Math.floor(
    (W - size) / 2
  );

  const startY = Math.floor(
    (H - size) / 2
  );

  // Entire canvas white.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#000000";

  for (let y = 0; y < qrSize; y++) {
    for (let x = 0; x < qrSize; x++) {

      if (!matrix[y][x]) continue;

      const px =
        startX + (x + quiet) * cell;

      const py =
        startY + (y + quiet) * cell;

      ctx.fillRect(
        px,
        py,
        cell,
        cell
      );
    }
  }
}

// ------------------------------------
// New distortion pattern
// ------------------------------------

function newPattern() {
  SETTINGS.seed += 137;

  seedField.value = SETTINGS.seed;

  applyMorph();

  testStatus.textContent =
    "New corruption pattern generated.";
}

// ------------------------------------
// Record scan result
// ------------------------------------

function recordResult(readable) {
  if (!qrSize) return;

  const morph = Number(morphSlider.value);

  const percentage =
    100 * changedModules /
    (qrSize * qrSize);

  const entry = {
    time: new Date().toISOString(),
    content: experimentText,
    morph: morph.toFixed(2),
    changed: percentage.toFixed(1),
    level: experimentLevel,
    seed: SETTINGS.seed,
    protected: protectStructure.checked,
    readable: readable
  };

  results.push(entry);

  const row = document.createElement("tr");

  const values = [
    new Date(entry.time).toLocaleTimeString(),
    entry.morph,
    entry.changed + "%",
    entry.level,
    String(entry.seed),
    readable ? "Readable" : "Unreadable"
  ];

  for (const value of values) {
    const cell = document.createElement("td");
    cell.textContent = value;
    row.appendChild(cell);
  }

  resultsBody.prepend(row);

  testStatus.textContent = readable
    ? "Readable result recorded."
    : "Unreadable result recorded.";
}

// ------------------------------------
// Export experiment log
// ------------------------------------

function csvEscape(value) {
  const text = String(value);

  return '"' +
    text.replace(/"/g, '""') +
    '"';
}

function exportCSV() {
  if (!results.length) {
    testStatus.textContent =
      "No results to export.";
    return;
  }

  const headers = [
    "time",
    "content",
    "morph",
    "changed_percent",
    "error_correction",
    "seed",
    "protected_structures",
    "readable"
  ];

  const lines = [
    headers.map(csvEscape).join(",")
  ];

  for (const entry of results) {
    const values = [
      entry.time,
      entry.content,
      entry.morph,
      entry.changed,
      entry.level,
      entry.seed,
      entry.protected,
      entry.readable
    ];

    lines.push(
      values.map(csvEscape).join(",")
    );
  }

  const csv =
    "\uFEFF" + lines.join("\r\n");

  const blob = new Blob(
    [csv],
    {
      type: "text/csv;charset=utf-8;"
    }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download =
    "threshold-of-legibility.csv";

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

// ------------------------------------
// Clear results
// ------------------------------------

function clearResults() {
  results.length = 0;
  resultsBody.replaceChildren();

  testStatus.textContent =
    "Experiment log cleared.";
}

// ------------------------------------
// Events
// ------------------------------------

$("updateQR").addEventListener(
  "click",
  generateQR
);

qrText.addEventListener(
  "keydown",
  event => {
    if (event.key === "Enter") {
      generateQR();
    }
  }
);

errorLevel.addEventListener(
  "change",
  generateQR
);

morphSlider.addEventListener(
  "input",
  applyMorph
);

protectStructure.addEventListener(
  "change",
  applyMorph
);

$("newPattern").addEventListener(
  "click",
  newPattern
);

$("resetMorph").addEventListener(
  "click",
  () => {
    morphSlider.value = 1;
    applyMorph();
  }
);

$("recordSuccess").addEventListener(
  "click",
  () => recordResult(true)
);

$("recordFailure").addEventListener(
  "click",
  () => recordResult(false)
);

$("exportCSV").addEventListener(
  "click",
  exportCSV
);

$("clearResults").addEventListener(
  "click",
  clearResults
);

// ------------------------------------
// Start
// ------------------------------------

seedField.value = SETTINGS.seed;

if (typeof qrcode === "function") {
  generateQR();
} else {
  testStatus.textContent =
    "QR library could not be loaded.";
}
