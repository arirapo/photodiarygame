import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-FTHW5Mg8o7_JNXNalKIw_sdxtC-A-G0",
  authDomain: "photodiarygame.firebaseapp.com",
  projectId: "photodiarygame",
  storageBucket: "photodiarygame.firebasestorage.app",
  messagingSenderId: "745003978989",
  appId: "1:745003978989:web:727489ba72b34d77af3ce4",
  measurementId: "G-1T7CBFRP55"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const state = {
  mode: "text",
  imageFile: null,
  imagePreviewUrl: null,
  bank: null
};

const tabs = document.querySelectorAll(".mode-tab");
const panels = {
  text: document.querySelector("#panel-text"),
  url: document.querySelector("#panel-url"),
  image: document.querySelector("#panel-image")
};

const textInput = document.querySelector("#textInput");
const urlInput = document.querySelector("#urlInput");
const imageInput = document.querySelector("#imageInput");
const imagePreviewWrap = document.querySelector("#imagePreviewWrap");
const imagePreview = document.querySelector("#imagePreview");

const createBtn = document.querySelector("#createBtn");
const qrCanvas = document.querySelector("#qrCanvas");
const resultMeta = document.querySelector("#resultMeta");
const statusEl = document.querySelector("#status");
const downloadBtn = document.querySelector("#downloadBtn");
const poemOutput = document.querySelector("#poemOutput");

function uid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now()) + Math.random().toString(16).slice(2);
}

function esc(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function setStatus(message, kind = "") {
  statusEl.textContent = message;
  statusEl.className = kind ? `status ${kind}` : "status";
}

function renderMeta(html) {
  resultMeta.innerHTML = html;
}

function setMode(mode) {
  state.mode = mode;
  tabs.forEach(tab => tab.classList.toggle("active", tab.dataset.mode === mode));
  Object.entries(panels).forEach(([key, panel]) => {
    panel.classList.toggle("hidden", key !== mode);
  });
}

function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error("Canvas export failed."))),
      "image/png"
    );
  });
}

async function drawQr(data) {
  await QRCode.toCanvas(qrCanvas, data, {
    width: 320,
    margin: 1,
    errorCorrectionLevel: "M"
  });
}

async function uploadSourceImage(docId, file) {
  const ext = file.name.includes(".")
    ? file.name.split(".").pop().toLowerCase()
    : "jpg";

  const imageRef = ref(
    storage,
    `qr-poems/${docId}/source.${ext && ext.length < 8 ? ext : "jpg"}`
  );

  await uploadBytes(imageRef, file, {
    contentType: file.type || "image/jpeg"
  });

  return await getDownloadURL(imageRef);
}

async function uploadQrImage(docId) {
  const blob = await canvasToBlob(qrCanvas);
  const qrRef = ref(storage, `qr-poems/${docId}/qr.png`);

  await uploadBytes(qrRef, blob, {
    contentType: "image/png"
  });

  return await getDownloadURL(qrRef);
}

function choose(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);

  let h, s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }

    h /= 6;
  }

  return {
    h: h * 360,
    l: l * 100
  };
}

function hueName(h) {
  if (h < 15 || h >= 345) return "red";
  if (h < 45) return "amber";
  if (h < 70) return "yellow";
  if (h < 160) return "green";
  if (h < 210) return "cyan";
  if (h < 260) return "blue";
  if (h < 300) return "violet";
  return "magenta";
}

function brightnessName(l) {
  if (l < 18) return "dark";
  if (l < 38) return "dim";
  if (l < 68) return "soft";
  return "bright";
}

async function analyzeImageColors(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;

  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const max = 180;
  const scale = Math.min(max / img.width, max / img.height, 1);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });

  canvas.width = w;
  canvas.height = h;
  ctx.drawImage(img, 0, 0, w, h);

  const data = ctx.getImageData(0, 0, w, h).data;
  let r = 0, g = 0, b = 0, p = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 20) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    p++;
  }

  URL.revokeObjectURL(url);

  if (!p) {
    return {
      hueLabel: "unknown",
      brightnessLabel: "soft"
    };
  }

  const avg = {
    r: Math.round(r / p),
    g: Math.round(g / p),
    b: Math.round(b / p)
  };

  const hsl = rgbToHsl(avg.r, avg.g, avg.b);

  return {
    hueLabel: hueName(hsl.h),
    brightnessLabel: brightnessName(hsl.l)
  };
}

async function loadBank() {
  const response = await fetch("miksang-poetry-bank.json", {
    cache: "no-cache"
  });

  if (!response.ok) {
    throw new Error("Poetry bank could not be loaded.");
  }

  return await response.json();
}

function uniq(lines) {
  return [...new Set(lines.filter(Boolean))].join("\n");
}

function buildTextPoem(bank) {
  return uniq([
    choose(bank.opening || []),
    choose(bank.signal || bank.attention || []),
    choose(bank.trace || bank.surface || []),
    choose(bank.ending || [])
  ]);
}

function buildUrlPoem(bank) {
  return uniq([
    choose(bank.opening || []),
    choose(bank.portal || bank.space || []),
    choose(bank.link || bank.signal || []),
    choose(bank.ending || [])
  ]);
}

function buildImagePoem(color, bank) {
  const colorLines =
    (bank.color && bank.color[color?.hueLabel || "unknown"]) ||
    (bank.color && bank.color.unknown) ||
    [];

  const lightLines =
    (bank.light && bank.light[color?.brightnessLabel || "soft"]) ||
    (bank.light && bank.light.soft) ||
    [];

  return uniq([
    choose(bank.opening || []),
    choose(colorLines),
    choose(lightLines),
    choose(bank.portal || bank.trace || []),
    choose(bank.ending || [])
  ]);
}

function getInputData() {
  if (state.mode === "text") {
    const value = textInput.value.trim();
    if (!value) throw new Error("Please enter some text.");
    return { type: "text", rawValue: value };
  }

  if (state.mode === "url") {
    const value = urlInput.value.trim();
    if (!value) throw new Error("Please enter a URL.");
    try {
      return { type: "url", rawValue: new URL(value).toString() };
    } catch {
      throw new Error("URL is not valid.");
    }
  }

  if (state.mode === "image") {
    if (!state.imageFile) throw new Error("Please choose an image.");
    return { type: "image", rawValue: state.imageFile };
  }

  throw new Error("Unknown mode.");
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

imageInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (state.imagePreviewUrl) {
    URL.revokeObjectURL(state.imagePreviewUrl);
  }

  state.imageFile = file;
  state.imagePreviewUrl = URL.createObjectURL(file);
  imagePreview.src = state.imagePreviewUrl;
  imagePreviewWrap.classList.remove("hidden");
});

downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.href = qrCanvas.toDataURL("image/png");
  link.download = `qr-poem-${Date.now()}.png`;
  link.click();
});

createBtn.addEventListener("click", async () => {
  createBtn.disabled = true;
  downloadBtn.classList.add("hidden");
  setStatus("Creating QR code…");

  try {
    if (!state.bank) {
      throw new Error("Poetry bank is not loaded.");
    }

    const input = getInputData();
    const storageId = uid();

    let qrData = "";
    let sourceImageUrl = "";
    let poem = "";
    let colorData = null;

    if (input.type === "image") {
      setStatus("Uploading source image…");
      sourceImageUrl = await uploadSourceImage(storageId, input.rawValue);
      qrData = sourceImageUrl;
      colorData = await analyzeImageColors(input.rawValue);
      poem = buildImagePoem(colorData, state.bank);
    } else if (input.type === "text") {
      qrData = input.rawValue;
      poem = buildTextPoem(state.bank);
    } else if (input.type === "url") {
      qrData = input.rawValue;
      poem = buildUrlPoem(state.bank);
    }

    setStatus("Rendering QR code…");
    await drawQr(qrData);
    poemOutput.textContent = poem || "No poem generated.";

    setStatus("Uploading QR image…");
    const qrImageUrl = await uploadQrImage(storageId);

    setStatus("Saving record to Firebase…");
    const payload = {
      createdAt: serverTimestamp(),
      type: input.type,
      qrData,
      qrImageUrl,
      poem,
      sourceImageUrl: sourceImageUrl || null,
      color: colorData || null
    };

    if (input.type === "text") payload.textValue = input.rawValue;
    if (input.type === "url") payload.urlValue = input.rawValue;
    if (input.type === "image") payload.imageName = input.rawValue.name || null;

    const docRef = await addDoc(collection(db, "qr_poems"), payload);

    renderMeta(`
      <div><strong>Type:</strong> ${esc(input.type)}</div>
      <div><strong>Document id:</strong> <code>${esc(docRef.id)}</code></div>
      <div><strong>QR data:</strong> <code>${esc(qrData)}</code></div>
      <div><strong>Poem gallery:</strong> <a href="qr-poem-gallery.html">Open QR Poem Gallery</a></div>
    `);

    setStatus("Saved to Firebase.", "ok");
    downloadBtn.classList.remove("hidden");
  } catch (err) {
    console.error(err);
    setStatus(err.message || "QR poem creation failed.", "warn");
  } finally {
    createBtn.disabled = false;
  }
});

async function init() {
  try {
    state.bank = await loadBank();
  } catch (err) {
    console.error(err);
    setStatus("Poetry bank failed to load.", "warn");
  }

  poemOutput.textContent = "No poem yet.";
  renderMeta('<div class="small">No QR code yet.</div>');
  setMode("text");
}

init();
