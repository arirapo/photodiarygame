import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

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

const statusEl = document.querySelector("#status");
const gridEl = document.querySelector("#grid");
const emptyEl = document.querySelector("#empty");
const countPill = document.querySelector("#countPill");

const modal = document.querySelector("#modal");
const modalClose = document.querySelector("#modalClose");
const modalCanvas = document.querySelector("#modalCanvas");
const modalDate = document.querySelector("#modalDate");
const modalPoem = document.querySelector("#modalPoem");
const modalInfo = document.querySelector("#modalInfo");
const openDataBtn = document.querySelector("#openDataBtn");
const copyTextBtn = document.querySelector("#copyTextBtn");
const textBlock = document.querySelector("#textBlock");

function esc(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatDate(ts, fallback = "") {
  try {
    if (ts && typeof ts.toDate === "function") {
      return new Intl.DateTimeFormat("fi-FI", {
        dateStyle: "medium",
        timeStyle: "short"
      }).format(ts.toDate());
    }
  } catch {}
  return fallback || "Unknown time";
}

function buildTags(item) {
  const tags = [item.type || "unknown"];
  if (item.poem) tags.push("poem");
  return tags;
}

async function drawQrToCanvas(canvas, data, size) {
  await QRCode.toCanvas(canvas, data, {
    width: size,
    margin: 1,
    errorCorrectionLevel: "M"
  });
}

async function openModal(item) {
  await drawQrToCanvas(modalCanvas, item.qrData || "", 420);

  modalDate.textContent = formatDate(item.createdAt, "Created");
  modalPoem.textContent = item.poem || "";

  modalInfo.innerHTML = `
    <div><strong>Type:</strong> ${esc(item.type || "unknown")}</div>
    <div><strong>Created:</strong> ${esc(formatDate(item.createdAt, "Unknown time"))}</div>
    <div><strong>Document id:</strong> ${esc(item.id)}</div>
  `;

  openDataBtn.classList.add("hidden");
  copyTextBtn.classList.add("hidden");
  textBlock.classList.add("hidden");
  textBlock.textContent = "";

  if (item.type === "url") {
    openDataBtn.href = item.urlValue || item.qrData || "#";
    openDataBtn.textContent = "Open original data";
    openDataBtn.classList.remove("hidden");
  } else if (item.type === "image") {
    openDataBtn.href = item.sourceImageUrl || item.qrData || "#";
    openDataBtn.textContent = "Open original data";
    openDataBtn.classList.remove("hidden");
  } else if (item.type === "text") {
    const textValue = item.textValue || item.qrData || "";

    textBlock.textContent = textValue;
    textBlock.classList.remove("hidden");

    copyTextBtn.textContent = "Copy text";
    copyTextBtn.classList.remove("hidden");
    copyTextBtn.onclick = async () => {
      try {
        await navigator.clipboard.writeText(textValue);
        copyTextBtn.textContent = "Copied";
        setTimeout(() => {
          copyTextBtn.textContent = "Copy text";
        }, 1200);
      } catch {}
    };

    openDataBtn.href = `data:text/plain;charset=utf-8,${encodeURIComponent(textValue)}`;
    openDataBtn.textContent = "Open original data";
    openDataBtn.classList.remove("hidden");
  }

  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

modalClose.addEventListener("click", closeModal);

modal.addEventListener("click", e => {
  if (e.target === modal) closeModal();
});

window.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

async function loadGallery() {
  try {
    const q = query(collection(db, "qr_poems"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);

    if (snap.empty) {
      statusEl.style.display = "none";
      emptyEl.style.display = "block";
      countPill.textContent = "0 QR poems";
      return;
    }

    const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    countPill.textContent = `${items.length} QR poem${items.length === 1 ? "" : "s"}`;

    gridEl.innerHTML = items.map(item => {
      const date = formatDate(item.createdAt, "Unknown time");
      const tags = buildTags(item);

      return `
        <button class="thumb" data-id="${esc(item.id)}">
          <div class="thumb-qr">
            <canvas class="thumb-canvas" width="220" height="220"></canvas>
          </div>
          <div class="thumb-meta">
            <div class="thumb-date">${esc(date)}</div>
            <div class="thumb-tags">
              ${tags.map(tag => `<span class="tag">${esc(tag)}</span>`).join("")}
            </div>
          </div>
        </button>
      `;
    }).join("");

    gridEl.style.display = "grid";
    statusEl.style.display = "none";

    const buttons = [...gridEl.querySelectorAll(".thumb")];

    for (const btn of buttons) {
      const item = items.find(x => x.id === btn.dataset.id);
      const canvas = btn.querySelector("canvas");

      if (item && canvas) {
        await drawQrToCanvas(canvas, item.qrData || "", 220);
      }

      btn.addEventListener("click", () => {
        if (item) openModal(item);
      });
    }
  } catch (err) {
    console.error(err);
    statusEl.textContent = "Gallery loading failed. Check Firestore rules, collection name, or network connection.";
    statusEl.classList.add("warn");
    countPill.textContent = "Load failed";
  }
}

loadGallery();
