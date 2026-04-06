import { db, storage } from "./firebase-config.js";
import {
  collection,
  addDoc,
  serverTimestamp
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

function computeGhostOpacity(count) {
  const start = 0.28;
  const min = 0.04;
  const fade = count * 0.005;
  return Math.max(min, start - fade);
}

function renderDemoFragments(items) {
  mosaicLayer.innerHTML = "";

  items.forEach((item, index) => {
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
    img.src = demoImagePool[item.img % demoImagePool.length];
    img.alt = "";
    img.loading = "lazy";

    fragment.appendChild(img);
    mosaicLayer.appendChild(fragment);
  });
}

function updateGhost(count) {
  const opacity = computeGhostOpacity(count);
  ghostLayer.style.opacity = opacity.toFixed(3);
  ghostOpacityReadout.textContent = opacity.toFixed(2);
  traceCount.textContent = String(count);
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

async function handleSubmit(event) {
  event.preventDefault();

  const file = imageInput.files && imageInput.files[0];
  if (!file) {
    statusText.textContent = "Choose an image first.";
    return;
  }

  try {
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
      storagePath: storagePath,
      originalName: file.name,
      word: wordInput.value.trim() || "",
      promptText: currentPrompt,
      createdAt: serverTimestamp(),
      status: "active"
    });

    statusText.textContent = "Your trace has entered the field.";
    uploadForm.reset();
    choosePrompt();
  } catch (error) {
    console.error(error);
    statusText.textContent = "Upload or Firestore write failed. Check rules.";
  }
}

window.addEventListener("DOMContentLoaded", () => {
  choosePrompt();
  renderDemoFragments(demoTraces);
  updateGhost(demoTraces.length);
});

imageInput.addEventListener("change", handleFileSelection);
uploadForm.addEventListener("submit", handleSubmit);
