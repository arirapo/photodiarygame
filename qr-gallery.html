import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

// FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyD-FTHW5Mg8o7_JNXNalKIw_sdxtC-A-G0",
  authDomain: "photodiarygame.firebaseapp.com",
  projectId: "photodiarygame",
  storageBucket: "photodiarygame.firebasestorage.app",
  messagingSenderId: "745003978989",
  appId: "1:745003978989:web:727489ba72b34d77af3ce4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const grid = document.querySelector("#grid");
const statusEl = document.querySelector("#status");
const countPill = document.querySelector("#countPill");
const emptyEl = document.querySelector("#empty");

async function drawQR(canvas, data) {
  await QRCode.toCanvas(canvas, data, {
    width: 220,
    margin: 1,
    errorCorrectionLevel: "M"
  });
}

function formatDate(ts) {
  try {
    if (ts && typeof ts.toDate === "function") {
      return new Intl.DateTimeFormat("fi-FI", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(ts.toDate());
    }
  } catch {}
  return "Unknown time";
}

async function load() {
  try {
    const q = query(collection(db, "qr_codes"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    if (snap.empty) {
      statusEl.style.display = "none";
      emptyEl.style.display = "block";
      countPill.textContent = "0 QR codes";
      return;
    }

    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    countPill.textContent = `${items.length} QR code${items.length === 1 ? "" : "s"}`;

    grid.innerHTML = items.map(item => `
      <button class="thumb" data-id="${item.id}">
        <div class="thumb-qr">
          <canvas class="thumb-canvas" width="220" height="220"></canvas>
        </div>
        <div class="thumb-meta">
          <div class="thumb-date">${formatDate(item.createdAt)}</div>
          <div class="thumb-tags">
            <span class="tag">${item.type || "unknown"}</span>
          </div>
        </div>
      </button>
    `).join("");

    grid.style.display = "grid";
    statusEl.style.display = "none";
    emptyEl.style.display = "none";

    const buttons = [...grid.querySelectorAll(".thumb")];

    for (const btn of buttons) {
      const item = items.find(x => x.id === btn.dataset.id);
      const canvas = btn.querySelector("canvas");
      if (item && canvas) {
        await drawQR(canvas, item.qrData || "");
      }

      btn.onclick = () => {
        alert(item.qrData || "");
      };
    }

  } catch (e) {
    console.error(e);
    statusEl.textContent = "Error loading QR gallery";
    statusEl.style.display = "block";
    countPill.textContent = "Load failed";
  }
}

load();
