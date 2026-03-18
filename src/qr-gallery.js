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

async function drawQR(canvas, data){
  await QRCode.toCanvas(canvas, data, { width:220 });
}

async function load(){
  try{
    const q = query(collection(db,"qr_codes"), orderBy("createdAt","desc"));
    const snap = await getDocs(q);

    if(snap.empty){
      statusEl.textContent = "No QR codes yet.";
      return;
    }

    const items = snap.docs.map(d=>({id:d.id,...d.data()}));

    grid.innerHTML = items.map(i=>`
      <button class="thumb" data-id="${i.id}">
        <canvas width="220" height="220"></canvas>
        <div>${i.type}</div>
      </button>
    `).join("");

    statusEl.style.display="none";

    const buttons = [...grid.querySelectorAll(".thumb")];

    for(let btn of buttons){
      const item = items.find(x=>x.id===btn.dataset.id);
      const canvas = btn.querySelector("canvas");
      await drawQR(canvas, item.qrData);

      btn.onclick = ()=>{
        alert(item.qrData);
      };
    }

  }catch(e){
    statusEl.textContent = "Error loading";
  }
}

load();
