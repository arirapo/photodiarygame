import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import {
  getStorage,
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  getIdTokenResult
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

// 🔥 Firebase config
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
const auth = getAuth(app);

// STATE
const state = {
  mode: "text",
  imageFile: null,
  preview: null,
  adminChecked: false
};

// ELEMENTS
const tabs = document.querySelectorAll(".mode-tab");
const panels = {
  text: document.querySelector("#panel-text"),
  url: document.querySelector("#panel-url"),
  image: document.querySelector("#panel-image")
};

const textInput = document.querySelector("#textInput");
const urlInput = document.querySelector("#urlInput");
const imageInput = document.querySelector("#imageInput");
const previewWrap = document.querySelector("#imagePreviewWrap");
const previewImg = document.querySelector("#imagePreview");

const createBtn = document.querySelector("#createBtn");
const canvas = document.querySelector("#qrCanvas");
const statusEl = document.querySelector("#status");
const meta = document.querySelector("#resultMeta");
const downloadBtn = document.querySelector("#downloadBtn");

// HELPERS
function setStatus(msg, type = "") {
  statusEl.textContent = msg;
  statusEl.className = type ? "status " + type : "status";
}

function setMode(mode) {
  state.mode = mode;
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.mode === mode));
  Object.entries(panels).forEach(([k, p]) => {
    p.classList.toggle("hidden", k !== mode);
  });
}

function uid() {
  return crypto.randomUUID();
}

async function drawQR(data) {
  await QRCode.toCanvas(canvas, data, { width: 320 });
}

function canvasToBlob() {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("QR canvas could not be converted to blob."));
        return;
      }
      resolve(blob);
    }, "image/png");
  });
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return map[ch];
  });
}

function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function getAdminStatus(forceRefresh = false) {
  const user = auth.currentUser;
  if (!user) return { signedIn: false, isAdmin: false, email: null };

  const tokenResult = await getIdTokenResult(user, forceRefresh);
  const isAdmin = tokenResult?.claims?.admin === true;

  return {
    signedIn: true,
    isAdmin,
    email: user.email || null
  };
}

async function ensureAdmin() {
  let status = await getAdminStatus(true);

  if (status.isAdmin) {
    state.adminChecked = true;
    return auth.currentUser;
  }

  const email = window.prompt("Admin email:");
  if (!email) {
    throw new Error("Admin sign-in cancelled.");
  }

  const password = window.prompt("Admin password:");
  if (!password) {
    throw new Error("Admin sign-in cancelled.");
  }

  await signInWithEmailAndPassword(auth, email.trim(), password);

  status = await getAdminStatus(true);

  if (!status.isAdmin) {
    await signOut(auth);
    throw new Error("Signed in, but this account does not have admin rights.");
  }

  state.adminChecked = true;
  return auth.currentUser;
}

function updateAuthUi(user, isAdmin = false) {
  const authLine = user
    ? `Signed in: ${escapeHtml(user.email || user.uid)}${isAdmin ? " (admin)" : ""}`
    : "Not signed in.";

  const existing = meta.querySelector(".auth-line");
  if (existing) existing.remove();

  const div = document.createElement("div");
  div.className = "small auth-line";
  div.innerHTML = authLine;
  meta.prepend(div);
}

// EVENTS
tabs.forEach((tab) => {
  tab.onclick = () => setMode(tab.dataset.mode);
});

imageInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) {
    state.imageFile = null;
    previewWrap.classList.add("hidden");
    previewImg.removeAttribute("src");
    return;
  }

  state.imageFile = file;
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewWrap.classList.remove("hidden");
};

downloadBtn.onclick = () => {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "qr.png";
  a.click();
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    updateAuthUi(null, false);
    return;
  }

  try {
    const status = await getAdminStatus(false);
    updateAuthUi(user, status.isAdmin);
  } catch {
    updateAuthUi(user, false);
  }
});

// MAIN
createBtn.onclick = async () => {
  try {
    createBtn.disabled = true;
    setStatus("Checking admin access...");

    await ensureAdmin();

    setStatus("Processing...");

    let data = "";
    let type = state.mode;
    let sourceImageUrl = null;

    const id = uid();

    if (type === "text") {
      data = textInput.value.trim();
      if (!data) throw new Error("Empty text.");
    }

    if (type === "url") {
      data = urlInput.value.trim();
      if (!data) throw new Error("Empty URL.");
      if (!isValidUrl(data)) throw new Error("Invalid URL.");
    }

    if (type === "image") {
      if (!state.imageFile) throw new Error("No image selected.");
      if (!state.imageFile.type.startsWith("image/")) {
        throw new Error("Selected file is not an image.");
      }

      const refPath = ref(storage, `qr/${id}.jpg`);
      await uploadBytes(refPath, state.imageFile, {
        contentType: state.imageFile.type
      });
      sourceImageUrl = await getDownloadURL(refPath);
      data = sourceImageUrl;
    }

    await drawQR(data);

    const blob = await canvasToBlob();
    const qrRef = ref(storage, `qr/${id}_qr.png`);
    await uploadBytes(qrRef, blob, {
      contentType: "image/png"
    });
    const qrUrl = await getDownloadURL(qrRef);

    await addDoc(collection(db, "qr_codes"), {
      createdAt: serverTimestamp(),
      type,
      qrData: data,
      qrImageUrl: qrUrl,
      sourceImageUrl
    });

    setStatus("Saved ✔", "ok");
    downloadBtn.classList.remove("hidden");

    const adminInfo = await getAdminStatus(false);
    meta.innerHTML = `
      <div class="small auth-line">
        Signed in: ${escapeHtml(adminInfo.email || auth.currentUser?.uid || "unknown")} (admin)
      </div>
      <div>Type: ${escapeHtml(type)}</div>
      <div><a href="qr-gallery.html">Open gallery</a></div>
    `;
  } catch (e) {
    console.error(e);
    setStatus(e?.message || String(e), "warn");
  } finally {
    createBtn.disabled = false;
  }
};

setMode("text");
updateAuthUi(auth.currentUser, false);
