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

const MOSAIC_TARGET_COUNT = 100;
const LIVE_FETCH_LIMIT = 100;

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

const REGION_LAYOUT = {
  upper_field: { centerX: 50, centerY: 22, spreadX: 10, spreadY: 6, baseW: 78, baseH: 56, opacity: 0.30, rotation: 2 },
  left_eye_zone: { centerX: 40, centerY: 36, spreadX: 6, spreadY: 4, baseW: 66, baseH: 52, opacity: 0.42, rotation: 2 },
  right_eye_zone: { centerX: 60, centerY: 36, spreadX: 6, spreadY: 4, baseW: 66, baseH: 52, opacity: 0.42, rotation: 2 },
  center_bridge: { centerX: 50, centerY: 48, spreadX: 4, spreadY: 8, baseW: 62, baseH: 82, opacity: 0.40, rotation: 1.2 },
  left_cheek_zone: { centerX: 37, centerY: 56, spreadX: 8, spreadY: 7, baseW: 88, baseH: 70, opacity: 0.36, rotation: 2.5 },
  right_cheek_zone: { centerX: 63, centerY: 56, spreadX: 8, spreadY: 7, baseW: 88, baseH: 70, opacity: 0.36, rotation: 2.5 },
  mouth_zone: { centerX: 50, centerY: 67, spreadX: 7, spreadY: 4, baseW: 112, baseH: 48, opacity: 0.44, rotation: 1.5 },
  lower_field: { centerX: 50, centerY: 82, spreadX: 9, spreadY: 6, baseW: 106, baseH: 72, opacity: 0.28, rotation: 2 },
  outer_shadow_left: { centerX: 26, centerY: 71, spreadX: 6, spreadY: 8, baseW: 78, baseH: 90, opacity: 0.22, rotation: 2 },
  outer_shadow_right: { centerX: 74, centerY: 71, spreadX: 6, spreadY: 8, baseW: 78, baseH: 90, opacity: 0.22, rotation: 2 }
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

function computeGhostOpacityFromState(totalActiveCount, usedRegionsCount) {
  const start = 0.28;
  const min = 0.04;
  const countFade = totalActiveCount * 0.0025;
  const regionFade = usedRegionsCount * 0.018;
  return Math.max(min, start - countFade - regionFade);
}

function updateGhost(totalActiveCount, usedRegionsCount = 0) {
  const opacity = computeGhostOpacityFromState(totalActiveCount, usedRegionsCount);
  ghostLayer.style.opacity = opacity.toFixed(3);
  ghostOpacityReadout.textContent = opacity.toFixed(2);
  traceCount.textContent = String(totalActiveCount);
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
  fragment.style.animationDelay = `${index * 18}ms`;
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

  return {
    region: regionName,
    x: clamp(region.centerX + jitterX, 8, 92),
    y: clamp(region.centerY + jitterY, 8, 92),
    w: Math.round(region.baseW * widthScale * randomBetween(0.84, 1.18)),
    h: Math.round(region.baseH * heightScale * randomBetween(0.84, 1.18)),
    r: randomBetween(-region.rotation, region.rotation),
    o: clamp(region.opacity + randomBetween(-0.06, 0.10), 0.14, 0.62),
    src: item.imageUrl,
    isLive: true
  };
}

function createFallbackDemoTrace(index) {
  const regionName = REGION_ORDER[index % REGION_ORDER.length];
  const region = REGION_LAYOUT[regionName];
  const demoSrc = demoImagePool[index % demoImagePool.length];

  return {
    region: regionName,
    x: clamp(region.centerX + randomBetween(-region.spreadX, region.spreadX), 8, 92),
    y: clamp(region.centerY + randomBetween(-region.spreadY, region.spreadY), 8, 92),
    w: Math.round(region.baseW * randomBetween(0.86, 1.12)),
    h: Math.round(region.baseH * randomBetween(0.86, 1.12)),
    r: randomBetween(-region.rotation, region.rotation),
    o: clamp(region.opacity - 0.08 + randomBetween(-0.03, 0.05), 0.12, 0.32),
    src: demoSrc,
    isLive: false
  };
}

function buildMosaicTraces(liveImages) {
  const fragments = [];

  if (liveImages.length === 0) {
    for (let i = 0; i < MOSAIC_TARGET_COUNT; i += 1) {
      fragments.push(createFallbackDemoTrace(i));
    }
    return fragments;
  }

  for (let i = 0; i < MOSAIC_TARGET_COUNT; i += 1) {
    const source = liveImages[i % liveImages.length];
    fragments.push(createOrganicTraceFromLive(source, i));
  }

  return fragments;
}

function renderFragments(items) {
  mosaicLayer.innerHTML = "";
  items.forEach((item, index) => {
    mosaicLayer.appendChild(createFragmentElement(item, index));
  });
}

async function loadLiveTraces() {
  try {
    const tracesRef = collection(db, "thefacebetween_traces");
    const q = query(
      tracesRef,
      orderBy("createdAt", "desc")
    );

    const snapshot = await getDocs(q);

    const allActive = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => item.status === "active" && item.imageUrl);

    const visibleLive = allActive.slice(0, LIVE_FETCH_LIMIT);

    const usedRegions = new Set(
      allActive
        .map((item) => item.region)
        .filter((region) => region && REGION_LAYOUT[region])
    );

    const mosaic = buildMosaicTraces(visibleLive);
    renderFragments(mosaic);
    updateGhost(allActive.length, usedRegions.size);

    if (allActive.length > 0) {
      statusText.textContent = `${allActive.length} live trace${allActive.length === 1 ? "" : "s"} in the field.`;
    } else {
      statusText.textContent = "No live traces yet. Demo field still visible.";
    }
  } catch (error) {
    console.error(error);
    const fallback = [];
    for (let i = 0; i < MOSAIC_TARGET_COUNT; i += 1) {
      fallback.push(createFallbackDemoTrace(i));
    }
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
