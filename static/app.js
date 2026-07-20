"use strict";

/* ============================================================
   英検 演習 — 級入口・直列コース・自由演習を切り替える薄いシェル。
   各モードの問題・進捗はモード側が管理し、ここでは画面切替だけを担当する。
   ============================================================ */

const APPS = [
  { id: "entry", tag: "CHOOSE GRADE", label: "級を選ぶ", title: "英検 級を選ぶ", mount: () => EikenGradeEntryApp.mount(), handleKey: (e) => EikenGradeEntryApp.handleKey(e) },
  { id: "serial", tag: "SERIAL COURSE", label: "学習ルート", title: "英検 学習ルート", mount: () => EikenSerialApp.mount(), handleKey: (e) => EikenSerialApp.handleKey(e) },
  { id: "free", tag: "FREE PRACTICE", label: "自由演習", title: "英検 自由演習", mount: () => EikenFreeApp.mount(), handleKey: (e) => EikenFreeApp.handleKey(e) },
  { id: "pre1", tag: "PRE-1 / 過去問", label: "準1級モード", title: "英検準1級 過去問演習", skill: true, mount: () => EikenPre1App.mount(), handleKey: (e) => EikenPre1App.handleKey(e) },
  { id: "q1", tag: "01 / 語彙", label: "大問1（語彙）", title: "英検 大問1 単語アプリ", skill: true, mount: () => EikenQ1App.mount(), handleKey: (e) => EikenQ1App.handleKey(e), startSerial: () => EikenQ1App.startSerial() },
  { id: "paraphrase", tag: "02 / 型", label: "言い換え", title: "英作文 言い換え練習", skill: true, mount: () => EikenParaphraseApp.mount(), handleKey: (e) => EikenParaphraseApp.handleKey(e), startSerial: () => EikenParaphraseApp.startSerial() },
  { id: "writing", tag: "03 / 構成", label: "英作文", title: "英検 英作文アプリ", skill: true, mount: () => EikenWritingApp.mount(), handleKey: (e) => EikenWritingApp.handleKey(e), startSerial: () => EikenWritingApp.startSerial() },
  { id: "dictation", tag: "04 / 音声", label: "リスニング", title: "英検 リスニング・ディクテーション", skill: true, mount: () => EikenDictationApp.mount(), handleKey: (e) => EikenDictationApp.handleKey(e), startSerial: () => EikenDictationApp.startSerial() },
  { id: "q3", tag: "05 / 長文", label: "大問3（長文）", title: "英検 大問3 演習アプリ", skill: true, mount: () => EikenQ3App.mount(), handleKey: (e) => EikenQ3App.handleKey(e), startSerial: () => EikenQ3App.startSerial() },
];
const ACTIVE_APP_KEY = "eiken_active_app";

let currentAppId = null;
let currentPath = "entry";
window.EikenActiveAppId = null;
window.EikenLearningPath = "entry";

function loadActiveAppId() {
  return "entry";
}

function renderAppNav() {
  const nav = document.getElementById("appNav");
  nav.innerHTML = "";
  const profile = window.EikenGradeEntryApp && window.EikenGradeEntryApp.getProfile
    ? window.EikenGradeEntryApp.getProfile()
    : null;
  const isPre1 = Boolean(profile && profile.grade === "pre1");
  const visibleApps = APPS.filter((app) => {
    if (isPre1 && app.id === "serial") return false;
    if (!app.skill) return true;
    return currentPath === "free" && (isPre1 ? app.id === "pre1" : app.id !== "pre1");
  });
  visibleApps.forEach(a => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "appTab";
    if (a.id === "serial") btn.classList.add("serialTab");
    if (a.id === "free") btn.classList.add("freeTab");
    btn.setAttribute("aria-pressed", a.id === currentAppId ? "true" : "false");
    const locked = currentPath !== "free" && a.skill && window.EikenSerialApp && !window.EikenSerialApp.isUnlocked(a.id);
    if (locked) {
      btn.disabled = true;
      btn.setAttribute("aria-label", `${a.label}。前の段階を完了すると解放されます`);
      btn.title = "前の段階を完了すると解放されます";
    }
    const tag = document.createElement("span");
    tag.textContent = a.tag;
    btn.appendChild(tag);
    btn.appendChild(document.createTextNode(a.label));
    btn.addEventListener("click", () => switchApp(a.id));
    nav.appendChild(btn);
  });
}

function switchApp(id, options = {}) {
  const next = APPS.find(a => a.id === id);
  if (!next) return Promise.resolve(false);
  const nextPath = id === "entry"
    ? "entry"
    : id === "serial"
      ? "serial"
      : id === "free" || options.free || currentPath === "free"
        ? "free"
        : "serial";
  if (next.skill && nextPath !== "free" && window.EikenSerialApp && !window.EikenSerialApp.isUnlocked(id)) return Promise.resolve(false);
  if (currentAppId === id && !options.force) return Promise.resolve(true);
  currentAppId = id;
  currentPath = nextPath;
  window.EikenActiveAppId = id;
  window.EikenLearningPath = currentPath;
  try { localStorage.setItem(ACTIVE_APP_KEY, id); } catch (e) { /* ignore */ }
  document.getElementById("appTitle").textContent = next.title;
  document.title = next.title;
  // モード切替時、モード固有スコープのクラス（例: q3Session）が残らないようリセットする
  const sessionPanel = document.getElementById("sessionPanel");
  sessionPanel.className = "hide";
  renderAppNav();
  return Promise.resolve(next.mount()).then(() => {
    if (options.serial && currentAppId === id && typeof next.startSerial === "function") next.startSerial();
    return true;
  });
}

window.EikenAppRouter = {
  open: (id, options = {}) => switchApp(id, options),
  refreshNav: renderAppNav,
};

document.addEventListener("keydown", (e) => {
  const app = APPS.find(a => a.id === currentAppId);
  if (app && app.handleKey) app.handleKey(e);
});

switchApp(loadActiveAppId());
