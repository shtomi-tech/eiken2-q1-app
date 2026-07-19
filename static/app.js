"use strict";

/* ============================================================
   英検 演習 — 大問1（語彙）／大問3（長文） を切り替える薄いシェル。
   kobun-vocab と同じ方式。各モードは static/mode-*.js に IIFE で閉じており、
   ここではフラットな1段タブの切替と、表示中モードへのキー入力の橋渡しのみを担当する。
   ============================================================ */

const APPS = [
  { id: "q1", tag: "単語を覚える", label: "大問1（語彙）", title: "英検 大問1 単語アプリ", mount: () => EikenQ1App.mount(), handleKey: (e) => EikenQ1App.handleKey(e) },
  { id: "q3", tag: "長文を読む", label: "大問3（長文）", title: "英検 大問3 演習アプリ", mount: () => EikenQ3App.mount(), handleKey: (e) => EikenQ3App.handleKey(e) },
  { id: "dictation", tag: "聞いて書く", label: "リスニング", title: "英検 リスニング・ディクテーション", mount: () => EikenDictationApp.mount(), handleKey: (e) => EikenDictationApp.handleKey(e) },
  { id: "paraphrase", tag: "英作文で使う", label: "言い換え練習", title: "英作文 言い換え練習", mount: () => EikenParaphraseApp.mount(), handleKey: (e) => EikenParaphraseApp.handleKey(e) },
];
const ACTIVE_APP_KEY = "eiken_active_app";

let currentAppId = null;
window.EikenActiveAppId = null;

function loadActiveAppId() {
  try {
    const saved = localStorage.getItem(ACTIVE_APP_KEY);
    if (APPS.some((app) => app.id === saved)) return saved;
  } catch (e) { /* ignore */ }
  return "q1";
}

function renderAppNav() {
  const nav = document.getElementById("appNav");
  nav.innerHTML = "";
  APPS.forEach(a => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "appTab";
    btn.setAttribute("aria-pressed", a.id === currentAppId ? "true" : "false");
    const tag = document.createElement("span");
    tag.textContent = a.tag;
    btn.appendChild(tag);
    btn.appendChild(document.createTextNode(a.label));
    btn.addEventListener("click", () => switchApp(a.id));
    nav.appendChild(btn);
  });
}

function switchApp(id) {
  if (currentAppId === id) return;
  currentAppId = id;
  window.EikenActiveAppId = id;
  try { localStorage.setItem(ACTIVE_APP_KEY, id); } catch (e) { /* ignore */ }
  const next = APPS.find(a => a.id === id);
  document.getElementById("appTitle").textContent = next.title;
  document.title = next.title;
  // モード切替時、モード固有スコープのクラス（例: q3Session）が残らないようリセットする
  const sessionPanel = document.getElementById("sessionPanel");
  sessionPanel.className = "hide";
  renderAppNav();
  next.mount();
}

document.addEventListener("keydown", (e) => {
  const app = APPS.find(a => a.id === currentAppId);
  if (app && app.handleKey) app.handleKey(e);
});

switchApp(loadActiveAppId());
