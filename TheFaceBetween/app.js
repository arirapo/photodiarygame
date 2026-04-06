import { db, storage } from "./firebase-config.js";

console.log("firebase import ok", db, storage);

const promptText = document.getElementById("prompt-text");
const statusText = document.getElementById("status-text");

window.addEventListener("DOMContentLoaded", () => {
  if (promptText) {
    promptText.textContent = "Firebase module loaded successfully.";
  }
  if (statusText) {
    statusText.textContent = "Config import works.";
  }
});
