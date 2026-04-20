import { db, storage, auth } from "./firebase-config.js";
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
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";

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

const adminAuthStatus = document.getElementById("admin-auth-status");
const adminEmailInput = document.getElementById("admin-email");
const adminPasswordInput = document.getElementById("admin-password");
const adminSignInBtn = document.getElementById("admin-sign-in-btn");
const adminSignOutBtn = document.getElementById("admin-sign-out-btn");

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

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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
  const start = 1.0;
  const min = 0.78;
  const countFade = totalActiveCount * 0.0002;
  const regionFade = usedRegionsCount * 0.002;
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
    opacity: clamp(0.08 + randomBetween(-0.015, 0.015), 0.04, 0.12)
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
      opacity: clamp((0.26 + randomBetween(-0.04, 0.04)) * ageFade, 0.10, 0.26),
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
  gridCellsReadout.textContent = `${items.filter(Boolean).length} / ${items.length}`;
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

    const fallback = buildGridItems([]);
    renderGrid(fallback);
    updateGhost(0, 0);
    statusText.textContent = "Could not load Firestore traces. Showing demo grid.";
  }
}

async function getAdminStatus(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) {
    return {
      signedIn: false,
      isAdmin: false,
      email: null,
      uid: null
    };
  }

  const tokenResult = await getIdTokenResult(user, forceRefresh);
  return {
    signedIn: true,
    isAdmin: tokenResult?.claims?.admin === true,
    email: user.email || null,
    uid: user.uid
  };
}

function updateAdminUi(status) {
  if (!adminAuthStatus || !adminSignInBtn || !adminSignOutBtn) return;

  if (!status?.signedIn) {
    adminAuthStatus.textContent = "Not signed in.";
    adminSignInBtn.disabled = false;
    adminSignOutBtn.disabled = true;
    return;
  }

  if (status.isAdmin) {
    adminAuthStatus.textContent = `Signed in as admin: ${status.email || status.uid}`;
  } else {
    adminAuthStatus.textContent = `Signed in, but not admin: ${status.email || status.uid}`;
  }

  adminSignInBtn.disabled = false;
  adminSignOutBtn.disabled = false;
}

async function requireAdmin() {
  const status = await getAdminStatus(true);
  if (!status.signedIn) {
    throw new Error("Please sign in as admin first.");
  }
  if (!status.isAdmin) {
    throw new Error("This signed-in account does not have admin rights.");
  }
  return status;
}

async function handleSubmit(event) {
  event.preventDefault();

  const file = imageInput.files && imageInput.files[0];
  if (!file) {
    statusText.textContent = "Choose an image first.";
    return;
  }

  try {
    await requireAdmin();

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
    statusText.textContent = error?.message || "Upload or Firestore write failed.";
  }
}

adminSignInBtn?.addEventListener("click", async () => {
  const email = adminEmailInput?.value.trim() || "";
  const password = adminPasswordInput?.value || "";

  if (!email) {
    statusText.textContent = "Enter admin email.";
    return;
  }

  if (!password) {
    statusText.textContent = "Enter admin password.";
    return;
  }

  adminSignInBtn.disabled = true;
  statusText.textContent = "Signing in...";

  try {
    await signInWithEmailAndPassword(auth, email, password);
    const status = await getAdminStatus(true);
    updateAdminUi(status);

    if (!status.isAdmin) {
      statusText.textContent = "Signed in, but this account is not admin.";
      return;
    }

    if (adminPasswordInput) adminPasswordInput.value = "";
    statusText.textContent = "Admin sign-in successful.";
  } catch (error) {
    console.error(error);
    statusText.textContent = error?.message || "Sign-in failed.";
  } finally {
    adminSignInBtn.disabled = false;
  }
});

adminSignOutBtn?.addEventListener("click", async () => {
  adminSignOutBtn.disabled = true;
  statusText.textContent = "Signing out...";

  try {
    await signOut(auth);
    if (adminPasswordInput) adminPasswordInput.value = "";
    updateAdminUi({ signedIn: false, isAdmin: false, email: null, uid: null });
    statusText.textContent = "Signed out.";
  } catch (error) {
    console.error(error);
    statusText.textContent = error?.message || "Sign-out failed.";
  } finally {
    adminSignOutBtn.disabled = false;
  }
});

window.addEventListener("DOMContentLoaded", async () => {
  choosePrompt();
  await loadGridField();
  updateAdminUi({ signedIn: false, isAdmin: false, email: null, uid: null });
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    updateAdminUi({ signedIn: false, isAdmin: false, email: null, uid: null });
    return;
  }

  try {
    const status = await getAdminStatus(false);
    updateAdminUi(status);
  } catch (error) {
    console.error(error);
  }
});

imageInput.addEventListener("change", handleFileSelection);
uploadForm.addEventListener("submit", handleSubmit);
