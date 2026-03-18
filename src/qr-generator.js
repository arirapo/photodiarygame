import QRCode from "https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm";
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getFirestore, collection, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

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

// STATE
const state = { mode:"text", imageFile:null, preview:null };

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
function setStatus(msg, type=""){
  statusEl.textContent = msg;
  statusEl.className = type ? "status "+type : "status";
}

function setMode(mode){
  state.mode = mode;
  tabs.forEach(t => t.classList.toggle("active", t.dataset.mode===mode));
  Object.entries(panels).forEach(([k,p])=>{
    p.classList.toggle("hidden", k!==mode);
  });
}

function uid(){
  return crypto.randomUUID();
}

async function drawQR(data){
  await QRCode.toCanvas(canvas, data, { width:320 });
}

function canvasToBlob(){
  return new Promise(resolve => canvas.toBlob(resolve));
}

// EVENTS
tabs.forEach(tab=>{
  tab.onclick = ()=>setMode(tab.dataset.mode);
});

imageInput.onchange = e=>{
  const file = e.target.files[0];
  if(!file) return;
  state.imageFile = file;
  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewWrap.classList.remove("hidden");
};

downloadBtn.onclick = ()=>{
  const a = document.createElement("a");
  a.href = canvas.toDataURL();
  a.download = "qr.png";
  a.click();
};

// MAIN
createBtn.onclick = async ()=>{
  try{
    setStatus("Processing...");

    let data = "";
    let type = state.mode;
    let sourceImageUrl = null;

    const id = uid();

    if(type==="text"){
      data = textInput.value.trim();
      if(!data) throw "Empty text";
    }

    if(type==="url"){
      data = urlInput.value.trim();
      if(!data) throw "Empty URL";
    }

    if(type==="image"){
      if(!state.imageFile) throw "No image";
      const refPath = ref(storage, `qr/${id}.jpg`);
      await uploadBytes(refPath, state.imageFile);
      sourceImageUrl = await getDownloadURL(refPath);
      data = sourceImageUrl;
    }

    await drawQR(data);

    const blob = await canvasToBlob();
    const qrRef = ref(storage, `qr/${id}_qr.png`);
    await uploadBytes(qrRef, blob);
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

    meta.innerHTML = `
      <div>Type: ${type}</div>
      <div><a href="qr-gallery.html">Open gallery</a></div>
    `;

  }catch(e){
    setStatus(e.toString(), "warn");
  }
};

setMode("text");
