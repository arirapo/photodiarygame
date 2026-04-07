import { db } from "./firebase-config.js";
import {
  collection,
  query,
  orderBy,
  getDocs
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const GRID_SIZE = 12;
const GRID_CELL_COUNT = GRID_SIZE * GRID_SIZE;
const LIVE_FETCH_LIMIT = 144;
const FILLED_CELL_RATIO = 1;

const demoImagePool = [
  "assets/demo/demo-1.jpg",
  "assets/demo/IMG_6694.jpeg",
  "assets/demo/IMG_6947.jpeg",
  "assets/demo/IMG_7413.jpeg",
  "assets/demo/IMG_7516.jpeg",
  "assets/demo/IMG_7806.jpeg"
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

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function computeGhostOpacity(totalActiveCount, usedRegionsCount) {
  const start = 1.0;
  const min = 0.72;
  const countFade = totalActiveCount * 0.00035;
  const regionFade = usedRegionsCount * 0.004;
  return Math.max(min, start - countFade - regionFade);
}

function updateGhost(totalActiveCount, usedRegionsCount = 0) {
  const opacity = computeGhostOpacity(totalActiveCount, usedRegionsCount);
  ghostLayer.style.opacity = opacity.toFixed(3);
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

  if (!item) {
    cell.className = "grid-cell";
    cell.style.opacity = "0";
    return cell;
  }

  const blurClass = item.isLive ? pickBlurClass(index, total) : "is-deep-soft";
  cell.className = `grid-cell ${item.isLive ? "is-live" : "is-demo"} ${blurClass}`;
  cell.style.opacity = "0";

  const img = document.createElement("img");
  img.src = item.src;
  img.alt = "";

  cell.appendChild(img);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      cell.style.opacity = String(item.opacity);
      cell.classList.add("is-ready");
    });
  });

  return cell;
}

function createFallbackDemoItem(index) {
  return {
    src: demoImagePool[index % demoImagePool.length],
    isLive: false,
    opacity: clamp(0.04 + randomBetween(-0.008, 0.01), 0.02, 0.06)
  };
}

function buildGridItems(liveImages) {
  const items = new Array(GRID_CELL_COUNT).fill(null);
  const targetFilled = Math.max(1, Math.round(GRID_CELL_COUNT * FILLED_CELL_RATIO));
  const filledIndexes = shuffle([...Array(GRID_CELL_COUNT).keys()]).slice(0, targetFilled);

  if (liveImages.length === 0) {
    filledIndexes.forEach((gridIndex, i) => {
      items[gridIndex] = createFallbackDemoItem(i);
    });
    return items;
  }

  filledIndexes.forEach((gridIndex, i) => {
    const source = liveImages[i % liveImages.length];
    const sourceAgeIndex = i % liveImages.length;
    const ageFade = getAgeFade(sourceAgeIndex, liveImages.length);

    items[gridIndex] = {
      src: source.imageUrl,
      isLive: true,
      opacity: clamp((0.26 + randomBetween(-0.04, 0.04)) * ageFade, 0.08, 0.24),
      region: source.region || null
    };
  });

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
}

async function loadInstallation() {
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
  } catch (error) {
    console.error(error);

    const fallback = buildGridItems([]);
    renderGrid(fallback);
    updateGhost(0, 0);
  }
}

window.addEventListener("DOMContentLoaded", async () => {
  await loadInstallation();
});
