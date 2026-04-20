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
  previewUrl: null,
  isAdmin: false
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

// Admin UI
const adminEmailInput = document.querySelector("#adminEmail");
const adminPasswordInput = document.querySelector("#adminPassword");
const adminSignInBtn = document.querySelector("#adminSignInBtn");
const adminSignOutBtn = document.querySelector("#adminSignOutBtn");
const adminAuthStatus = document.querySelector("#adminAuthStatus");

// HELPERS
function setStatus(msg, type = "") {
  statusEl.textContent = msg;
  statusEl.className = type ? `status ${type}` : "status";
}

function setMode(mode) {
  state.mode = mode;
  tabs.forEach((t) => t.classList.toggle("active", t.dataset.mode === mode));
  Object.entries(panels).forEach(([key, panel]) => {
    panel.classList.toggle("hidden", key !== mode);
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
        reject(new Error("QR canvas could not be converted to a blob."));
        return;
      }
      resolve(blob);
    }, "image/png");
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
  state.isAdmin = Boolean(status?.isAdmin);

  if (!status?.signedIn) {
    adminAuthStatus.textContent = "Not signed in.";
    adminSignInBtn.disabled = false;
    adminSignOutBtn.disabled = true;
    createBtn.disabled = false;
    return;
  }

  if (status.isAdmin) {
    adminAuthStatus.textContent = `Signed in as admin: ${status.email || status.uid}`;
    adminSignInBtn.disabled = true;
    adminSignOutBtn.disabled = false;
  } else {
    adminAuthStatus.textContent = `Signed in, but not admin: ${status.email || status.uid}`;
    adminSignInBtn.disabled = false;
    adminSignOutBtn.disabled = false;
  }

  createBtn.disabled = false;
}

function setResultMetaDefault() {
  meta.innerHTML = `<div class="small">No QR code yet.</div>`;
}

function revokePreviewUrl() {
  if (state.previewUrl) {
    URL.revokeObjectURL(state.previewUrl);
    state.previewUrl = null;
  }
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

// EVENTS
tabs.forEach((tab) => {
  tab.addEventListener("click", () => setMode(tab.dataset.mode));
});

imageInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  revokePreviewUrl();

  if (!file) {
    state.imageFile = null;
    previewImg.removeAttribute("src");
    previewWrap.classList.add("hidden");
    return;
  }

  state.imageFile = file;
  state.previewUrl = URL.createObjectURL(file);
  previewImg.src = state.previewUrl;
  previewWrap.classList.remove("hidden");
});

downloadBtn.addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = "qr.png";
  a.click();
});

adminSignInBtn.addEventListener("click", async () => {
  const email = adminEmailInput.value.trim();
  const password = adminPasswordInput.value;

  if (!email) {
    setStatus("Enter admin email.", "warn");
    return;
  }

  if (!password) {
    setStatus("Enter admin password.", "warn");
    return;
  }

  adminSignInBtn.disabled = true;
  setStatus("Signing in...");

  try {
    await signInWithEmailAndPassword(auth, email, password);

    const status = await getAdminStatus(true);
    updateAdminUi(status);

    if (!status.isAdmin) {
      setStatus("Signed in, but this account is not admin.", "warn");
      return;
    }

    adminPasswordInput.value = "";
    setStatus("Admin sign-in successful.", "ok");
  } catch (err) {
    console.error(err);
    setStatus(err?.message || "Sign-in failed.", "warn");
    updateAdminUi({
      signedIn: false,
      isAdmin: false,
      email: null,
      uid: null
    });
  } finally {
    adminSignInBtn.disabled = false;
  }
});

adminSignOutBtn.addEventListener("click", async () => {
  adminSignOutBtn.disabled = true;
  setStatus("Signing out...");

  try {
    await signOut(auth);
    adminPasswordInput.value = "";
    updateAdminUi({
      signedIn: false,
      isAdmin: false,
      email: null,
      uid: null
    });
    setStatus("Signed out.", "ok");
  } catch (err) {
    console.error(err);
    setStatus(err?.message || "Sign-out failed.", "warn");
  } finally {
    adminSignOutBtn.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    updateAdminUi({
      signedIn: false,
      isAdmin: false,
      email: null,
      uid: null
    });
    return;
  }

  try {
    const status = await getAdminStatus(false);
    updateAdminUi(status);
  } catch (err) {
    console.error(err);
    updateAdminUi({
      signedIn: true,
      isAdmin: false,
      email: user.email || null,
      uid: user.uid
    });
  }
});

// MAIN
createBtn.addEventListener("click", async () => {
  try {
    createBtn.disabled = true;
    setStatus("");
    await requireAdmin();

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

      const imageExt = state.imageFile.name.includes(".")
        ? state.imageFile.name.split(".").pop().toLowerCase()
        : "jpg";

      const imageRef = ref(storage, `qr/${id}.${imageExt}`);
      await uploadBytes(imageRef, state.imageFile, {
        contentType: state.imageFile.type
      });

      sourceImageUrl = await getDownloadURL(imageRef);
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

    const status = await getAdminStatus(false);
    meta.innerHTML = `
      <div class="small">Signed in as: ${escapeHtml(status.email || status.uid)}</div>
      <div>Type: ${escapeHtml(type)}</div>
      <div><a href="qr-gallery.html">Open gallery</a></div>
    `;
  } catch (err) {
    console.error(err);
    setStatus(err?.message || "Saving failed.", "warn");
  } finally {
    createBtn.disabled = false;
  }
});

setMode("text");
setResultMetaDefault();
updateAdminUi({
  signedIn: false,
  isAdmin: false,
  email: null,
  uid: null
});
