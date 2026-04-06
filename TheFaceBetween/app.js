import { db, storage } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";
import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-storage.js";

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

const demoTraces = [
  { region: "upper_field", x: 50, y: 21, w: 84, h: 62, r: -2, o: 0.34, img: 0 },
  { region: "left_eye_zone", x: 40, y: 36, w: 70, h: 58, r: 1.2, o: 0.42, img: 1 },
  { region: "right_eye_zone", x: 61, y: 36, w: 72, h: 56, r: -1.5, o: 0.40, img: 2 },
  { region: "center_bridge", x: 50, y: 47, w: 64, h: 86, r: 0.4, o: 0.44, img: 3 },
  { region: "left_cheek_zone", x: 36, y: 54, w: 92, h: 78, r: -2.4, o: 0.38, img: 4 },
  { region: "right_cheek_zone", x: 64, y: 54, w: 96, h: 78, r: 2.1, o: 0.38, img: 5 },
  { region: "mouth_zone", x: 50, y: 67, w: 120, h: 52, r: -0.6, o: 0.46, img: 2 },
  { region: "lower_field", x: 50, y: 82, w: 110, h: 78, r: 0.7, o: 0.32, img: 0 },
  { region: "outer_shadow_left", x: 26, y: 71, w: 82, h: 96, r: -1.2, o: 0.26, img: 1 },
  { region: "outer_shadow_right", x: 74, y: 71, w: 82, h: 96, r: 1.5, o: 0.26, img: 4 },
  { region: "upper_field", x: 54, y: 28, w: 62, h: 50, r: -1.1, o: 0.28, img: 3 },
  { region: "left_cheek_zone", x: 43, y: 60, w: 58, h: 52, r: 0.4, o: 0.24, img: 5 }
];

const REGION_LAYOUT = {
  upper_field: {
    centerX: 50,
    centerY: 22,
    spreadX: 10,
    spreadY: 6,
    baseW: 78,
    baseH: 56,
    opacity: 0.30,
    rotation: 2
  },
  left_eye_zone: {
    centerX: 40,
    centerY: 36,
    spreadX: 6,
    spreadY: 4,
    baseW: 66,
    baseH: 52,
    opacity: 0.42,
    rotation: 2
  },
  right_eye_zone: {
    centerX: 60,
    centerY: 36,
    spreadX: 6,
    spreadY: 4,
    baseW: 66,
    baseH: 52,
    opacity: 0.42,
    rotation: 2
  },
  center_bridge: {
    centerX: 50,
    centerY: 48,
    spreadX: 4,
    spreadY: 8,
    baseW: 62,
    baseH: 82,
    opacity: 0.40,
    rotation: 1.2
  },
  left_cheek_zone: {
    centerX: 37,
    centerY: 56,
    spreadX: 8,
    spreadY: 7,
    baseW: 88,
    baseH: 70,
    opacity: 0.36,
    rotation: 2.5
  },
  right_cheek_zone: {
    centerX: 63,
    centerY: 56,
    spreadX: 8,
    spreadY: 7,
    baseW: 88,
    baseH: 70,
    opacity: 0.36,
    rotation: 2.5
  },
  mouth_zone: {
    centerX: 50,
    centerY: 67,
    spreadX: 7,
    spreadY: 4,
    baseW: 112,
    baseH: 48,
    opacity: 0.44,
    rotation: 1.5
  },
  lower_field: {
    centerX: 50,
    centerY: 82,
    spreadX: 9,
    spreadY: 6,
    baseW: 106,
    baseH: 72,
    opacity: 0.28,
    rotation: 2
  },
  outer_shadow_left: {
    centerX: 26,
    centerY: 71,
    spreadX: 6,
    spreadY: 8,
    baseW: 78,
    baseH: 90,
    opacity: 0.22,
    rotation: 2
  },
  outer_shadow_right: {
    centerX: 74,
    centerY: 71,
    spreadX: 6,
    spreadY: 8,
    baseW: 78,
    baseH: 90,
    opacity: 0.22,
    rotation: 2
  }
};

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

const mosaicLayer = document.getElementById("mosaic-layer");
const ghostLayer = document.getElementById("ghost-base-layer");
const promptText = document.getElementById("prompt-text");
const statusText = document.getElementById("status-text");
const traceCount = document.getElementById("trace-count");
const ghostOpacityReadout = document.getElementById("ghost-opacity-readout");
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

function computeGhostOpacityFromState(liveCount, usedRegionsCount) {
  const start = 0.28;
  const min = 0.04;

  const countFade = liveCount * 0.008;
  const regionFade = usedRegionsCount * 0.018;

  return Math.max(min, start - countFade - regionFade);
}

function updateGhost(liveCount, usedRegionsCount = 0) {
  const opacity = computeGhostOpacityFromState(liveCount, usedRegionsCount);
  ghostLayer.style.opacity = opacity.toFixed(3);
  ghostOpacityReadout.textContent = opacity.toFixed(2);
  traceCount.textContent = String(liveCount);
}

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
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

function createFragmentElement(item, index) {
  const fragment = document.createElement("div");
  fragment.className = "fragment";
  fragment.style.left = `${item.x}%`;
  fragment.style.top = `${item.y}%`;
  fragment.style.width = `${item.w}px`;
  fragment.style.height = `${item.h}px`;
  fragment.style.marginLeft = `${item.w / -2}px`;
  fragment.style.marginTop = `${item.h / -2}px`;
  fragment.style.opacity = item.o;
  fragment.style.transform = `rotate(${item.r}deg)`;
  fragment.style.animationDelay = `${index * 70}ms`;
  fragment.style.zIndex = `${10 + index}`;

  const img = document.createElement("img");
  img.src = item.src;
  img.alt = "";
  img.loading = "lazy";

  fragment.appendChild(img);
  return fragment;
}

function createOrganicTraceFromLive(item, index) {
  const regionName = item.region && REGION_LAYOUT[item.region]
    ? item.region
    : REGION_ORDER[index % REGION_ORDER.length];

  const region = REGION_LAYOUT[regionName];
  const orientation = item.orientation || "unknown";

  let widthScale = 1;
  let heightScale = 1;

  if (orientation === "landscape") {
    widthScale = 1.16;
    heightScale = 0.88;
  } else if (orientation === "portrait") {
    widthScale = 0.88;
    heightScale = 1.16;
  } else if (orientation === "square") {
    widthScale = 0.94;
    heightScale = 0.94;
  }

  const jitterX = randomBetween(-region.spreadX, region.spreadX);
  const jitterY = randomBetween(-region.spreadY, region.spreadY);

  const w = Math.round(region.baseW * widthScale * randomBetween(0.88, 1.16));
  const h = Math.round(region.baseH * heightScale * randomBetween(0.88, 1.16));
  const r = randomBetween(-region.rotation, region.rotation);
  const o = clamp(region.opacity + randomBetween(-0.05, 0.12), 0.18, 0.62);

  return {
    region: regionName,
    x: clamp(region.centerX + jitterX, 10, 90),
    y: clamp(region.centerY + jitterY, 8, 92),
    w,
    h,
    r,
    o,
    src: item.imageUrl,
    isLive: true
  };
}

function createFallbackDemoTrace(slot) {
  return {
    ...slot,
    src: demoImagePool[slot.img % demoImagePool.length],
    isLive: false
  };
}

function buildHybridTraces(liveImages) {
  const liveFragments = liveImages.map((item, index) => createOrganicTraceFromLive(item, index));

  const fallbackCount = Math.max(0, demoTraces.length - liveFragments.length);
  const fallbackFragments = demoTraces
    .slice(0, fallbackCount)
    .map((slot) => createFallbackDemoTrace(slot));

  return [...fallbackFragments, ...liveFragments];
}

function renderFragments(items) {
  mosaicLayer.innerHTML = "";

  items.forEach((item, index) => {
    const fragment = createFragmentElement(item, index);
    mosaicLayer.appendChild(fragment);
  });
}

async function loadLiveTraces() {
  try {
    const tracesRef = collection(db, "thefacebetween_traces");
    const q = query(
      tracesRef,
      orderBy("createdAt", "desc"),
      limit(24)
    );

    const snapshot = await getDocs(q);

    const liveImages = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => item.status === "active" && item.imageUrl);

    const usedRegions = new Set(
      liveImages
        .map((item) => item.region)
        .filter((region) => region && REGION_LAYOUT[region])
    );

    const hybrid = buildHybridTraces(liveImages);
    renderFragments(hybrid);
    updateGhost(liveImages.length, usedRegions.size);

    if (liveImages.length > 0) {
      statusText.textContent = `${liveImages.length} live trace${liveImages.length === 1 ? "" : "s"} in the field.`;
    } else {
      statusText.textContent = "No live traces yet. Demo field still visible.";
    }
  } catch (error) {
    console.error(error);

    const fallback = demoTraces.map((slot) => createFallbackDemoTrace(slot));
    renderFragments(fallback);
    updateGhost(0, 0);
    statusText.textContent = "Could not load Firestore traces. Showing demo field.";
  }
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

    await loadLiveTraces();
  } catch (error) {
    console.error(error);
    statusText.textContent = "Upload or Firestore write failed. Check rules.";
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  choosePrompt();
  await loadLiveTraces();
});

imageInput.addEventListener("change", handleFileSelection);
uploadForm.addEventListener("submit", handleSubmit);
