import { db, storage } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

const GRID_SIZE = 12;
const GRID_CELL_COUNT = GRID_SIZE * GRID_SIZE;
const LIVE_FETCH_LIMIT = 144;

const demoImagePool = [
  "assets/demo/demo-1.jpg",
  "assets/demo/IMG_6694.jpeg",
  "assets/demo/IMG_6947.jpeg",
  "assets/demo/IMG_7413.jpeg",
  "assets/demo/IMG_7516.jpeg",
  "assets/demo/IMG_7806.jpeg"
];

const prompts = [
  "Photograph a surface that feels like a memory.",
  "Find something that could belong to a silent eye.",
  "Offer a trace that feels fragile but present.",
  "Bring a shadow that seems to remember.",
  "Photograph something that could become a mouth, without being one."
];

const REGION_ORDER = [
  "upper_field",
  "left_eye_zone",
  "right_eye_zone",
  "center_bridge",
  "left_cheek_zone",
  "right_cheek_zone",
  "mouth_zone",
  "lower_field",
  "outer_shadow_left",
  "outer_shadow_right"
];

const REGION_ZONES = {
  upper_field: { cols: [3, 8], rows: [0, 1] },
  left_eye_zone: { cols: [3, 4], rows: [2, 3] },
  right_eye_zone: { cols: [7, 8], rows: [2, 3] },
  center_bridge: { cols: [5, 6], rows: [3, 5] },
  left_cheek_zone: { cols: [2, 4], rows: [4, 7] },
  right_cheek_zone: { cols: [7, 9], rows: [4, 7] },
  mouth_zone: { cols: [4, 7], rows: [7, 8] },
  lower_field: { cols: [4, 7], rows: [9, 11] },
  outer_shadow_left: { cols: [0, 2], rows: [6, 10] },
  outer_shadow_right: { cols: [9, 11], rows: [6, 10] }
};

const gridField = document.getElementById("grid-field");
const ghostLayer = document.getElementById("ghost-base-layer");
const promptText = document.getElementById("prompt-text");
const statusText = document.getElementById("status-text");
const traceCount = document.getElementById("trace-count");
const ghostOpacityReadout = document.getElementById("ghost-opacity-readout");
const gridCellsReadout = document.getElementById("grid-cells-readout");
const uploadForm = document.getElementById("upload-form");
const imageInput = document.getElementById("image-input");
const wordInput = document.getElementById("word-input");

let currentPrompt = prompts[0];

function choosePrompt() {
  currentPrompt = prompts[Math.floor(Math.random() * prompts.length)];
  promptText.textContent = currentPrompt;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function handleFileSelection() {
  const file = imageInput.files && imageInput.files[0];
  if (!file) {
    statusText.textContent = "No image selected.";
    return;
  }

  const sizeText = formatFileSize(file.size);
  statusText.textContent = `Selected: ${file.name}${sizeText ? " (" + sizeText + ")" : ""}`;
}

function pickRegionForImage(file) {
  if (!file || !file.type) {
    return REGION_ORDER[Math.floor(Math.random() * REGION_ORDER.length)];
  }

  const isPortraitLikeName = /portrait|self|face/i.test(file.name);
  if (isPortraitLikeName) {
    return Math.random() > 0.5 ? "left_cheek_zone" : "right_cheek_zone";
  }

  return REGION_ORDER[Math.floor(Math.random() * REGION_ORDER.length)];
}

function getOrientation(width, height) {
  if (!width || !height) return "unknown";
  if (width > height) return "landscape";
  if (height > width) return "portrait";
  return "square";
}

async function readImageDimensions(file) {
  return new Promise((resolve) => {
    if (!file || !file.type || !file.type.startsWith("image/")) {
      resolve({ width: null, height: null, orientation: "unknown" });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      const width = img.naturalWidth || null;
      const height = img.naturalHeight || null;
      URL.revokeObjectURL(objectUrl);
      resolve({
        width,
        height,
        orientation: getOrientation(width, height)
      });
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ width: null, height: null, orientation: "unknown" });
    };

    img.src = objectUrl;
  });
}

function computeGhostOpacity(totalActiveCount, usedRegionsCount) {
  const start = 0.78;
  const min = 0.24;
  const countFade = totalActiveCount * 0.0014;
  const regionFade = usedRegionsCount * 0.012;
  return Math.max(min, start - countFade - regionFade);
}

function updateGhost(totalActiveCount, usedRegionsCount = 0) {
  const opacity = computeGhostOpacity(totalActiveCount, usedRegionsCount);
  ghostLayer.style.opacity = opacity.toFixed(3);
  ghostOpacityReadout.textContent = opacity.toFixed(2);
  traceCount.textContent = String(totalActiveCount);
}

function getAgeFade(index, total) {
  if (total <= 1) return 1;
  const normalized = index / (total - 1);
  return 1 - normalized * 0.45;
}

function pickBlurClass(index, total) {
  const normalized = total <= 1 ? 0 : index / (total - 1);
  if (normalized > 0.72) return "is-deep-soft";
  if (normalized > 0.38) return "is-soft";
  return "";
}

function createCellElement(item, index, total) {
  const cell = document.createElement("div");
  const blurClass = item.isLive ? pickBlurClass(index, total) : "is-deep-soft";
  cell.className = `grid-cell ${item.isLive ? "is-live" : "is-demo"} ${blurClass}`;
  cell.style.opacity = item.opacity;
  cell.style.animationDelay = `${index * 8}ms`;

  const img = document.createElement("img");
  img.src = item.src;
  img.alt = "";

  cell.appendChild(img);
  return cell;
}

function createFallbackDemoItem(index) {
  return {
    src: demoImagePool[index % demoImagePool.length],
    isLive: false,
    opacity: clamp(0.035 + randomBetween(-0.01, 0.02), 0.02, 0.08)
  };
}

function buildGridItems(liveImages) {
  const items = [];

  if (liveImages.length === 0) {
    for (let i = 0; i < GRID_CELL_COUNT; i += 1) {
      items.push(createFallbackDemoItem(i));
    }
    return items;
  }

  for (let i = 0; i < GRID_CELL_COUNT; i += 1) {
    const source = liveImages[i % liveImages.length];
    const sourceAgeIndex = i % liveImages.length;
    const ageFade = getAgeFade(sourceAgeIndex, liveImages.length);

    items.push({
      src: source.imageUrl,
      isLive: true,
      opacity: clamp((0.12 + randomBetween(-0.03, 0.03)) * ageFade, 0.035, 0.16),
      region: source.region || null
    });
  }

  return items;
}

function renderGrid(items) {
  gridField.innerHTML = "";

  const surface = document.createElement("div");
  surface.className = "grid-surface";
  surface.style.setProperty("--grid-size", String(GRID_SIZE));

  items.forEach((item, index) => {
    const cell = createCellElement(item, index, items.length);
    surface.appendChild(cell);
  });

  gridField.appendChild(surface);
  gridCellsReadout.textContent = String(items.length);
}

async function loadGridField() {
  try {
    const tracesRef = collection(db, "thefacebetween_traces");
    const q = query(tracesRef, orderBy("createdAt", "desc"));
    const snapshot = await getDocs(q);

    const allActive = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => item.status === "active" && item.imageUrl);

    const visibleLive = allActive.slice(0, LIVE_FETCH_LIMIT);

    const usedRegions = new Set(
      allActive
        .map((item) => item.region)
        .filter((region) => region && REGION_ZONES[region])
    );

    const items = buildGridItems(visibleLive);
    renderGrid(items);
    updateGhost(allActive.length, usedRegions.size);

    if (allActive.length > 0) {
      statusText.textContent = `${allActive.length} live trace${allActive.length === 1 ? "" : "s"} in the field.`;
    } else {
      statusText.textContent = "No live traces yet. Demo grid still visible.";
    }
  } catch (error) {
    console.error(error);

    const fallback = [];
    for (let i = 0; i < GRID_CELL_COUNT; i += 1) {
      fallback.push(createFallbackDemoItem(i));
    }

    renderGrid(fallback);
    updateGhost(0, 0);
    statusText.textContent = "Could not load Firestore traces. Showing demo grid.";
  }
}

async function handleSubmit(event) {
  event.preventDefault();

  const file = imageInput.files && imageInput.files[0];
  if (!file) {
    statusText.textContent = "Choose an image first.";
    return;
  }

  try {
    statusText.textContent = "Preparing trace...";

    const { width, height, orientation } = await readImageDimensions(file);
    const region = pickRegionForImage(file);

    statusText.textContent = "Uploading trace to Storage...";

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const fileId = `${Date.now()}-${safeName}`;
    const storagePath = `thefacebetween/uploads/${fileId}`;
    const storageRef = ref(storage, storagePath);

    await uploadBytes(storageRef, file, {
      contentType: file.type || "image/jpeg"
    });

    const downloadURL = await getDownloadURL(storageRef);

    statusText.textContent = "Writing trace to Firestore...";

    await addDoc(collection(db, "thefacebetween_traces"), {
      imageUrl: downloadURL,
      storagePath,
      originalName: file.name,
      word: wordInput.value.trim() || "",
      promptText: currentPrompt,
      createdAt: serverTimestamp(),
      status: "active",
      region,
      orientation,
      width,
      height
    });

    statusText.textContent = "Your trace has entered the field.";
    uploadForm.reset();
    choosePrompt();

    await loadGridField();
  } catch (error) {
    console.error(error);
    statusText.textContent = "Upload or Firestore write failed. Check rules.";
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  choosePrompt();
  await loadGridField();
});

imageInput.addEventListener("change", handleFileSelection);
uploadForm.addEventListener("submit", handleSubmit);
