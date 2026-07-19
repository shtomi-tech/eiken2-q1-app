"use strict";

/* ============================================================
   英検 大問1 単語アプリ
   学習フロー：暗記カード → 理解チェック → 本番演習（設問ごと）
   ※ 間隔反復（Leitner）は未実装。進捗は localStorage に保存。
   kobun-vocab と同じ方式で IIFE に閉じ、{ mount, handleKey } のみを公開する。
   ============================================================ */

const EikenQ1App = (function () {

const LEGACY_STORE_KEY = "eiken2_q1_v1";
const STORE_PREFIX = "eiken_q1_progress_";
const DATASET_KEY = "eiken_q1_dataset";
const MANIFEST_URL = "data/manifest.json";
// 問題セット一覧は data/manifest.json（"q1"キー）から読み込む。
// 回を追加するときはデータJSONを置いてmanifest.jsonに1エントリ足すだけでよく、このファイルの編集は不要。
let DATASETS = {};
let DEFAULT_DATASET_ID = null;
async function loadManifest() {
  const manifest = await fetch(MANIFEST_URL, { cache: "no-store" }).then((r) => r.json());
  DATASETS = manifest.q1;
  DEFAULT_DATASET_ID = manifest.defaultDatasetId;
}
// 選択肢を描画した直後、この時間だけクリックを無視する（誤ダブルクリック防止）
const CHOICE_GUARD_MS = 400;
const FLASH_NAV_GUARD_MS = 450;

const state = {
  datasetId: null, // loadManifest() 完了後、boot() 内で loadDatasetId() により確定する
  itemsByQ: {},   // q -> [item, ...]
  questions: {},  // q -> {stem, choices, answerIndex, translation}
  qList: [],      // [1..n]
  meaningPool: { word: [], idiom: [] }, // ダミー用の意味プール
  progress: { units: {} },
};

/* ---- progress (localStorage) ---- */
function loadDatasetId() {
  try {
    const id = localStorage.getItem(DATASET_KEY);
    if (id && DATASETS[id]) return id;
  } catch (e) { /* ignore */ }
  return DEFAULT_DATASET_ID;
}
function dataset() {
  return DATASETS[state.datasetId] || DATASETS[DEFAULT_DATASET_ID];
}
function progressKey(datasetId = state.datasetId) {
  return STORE_PREFIX + datasetId;
}
function loadProgress(datasetId = state.datasetId) {
  try {
    let raw = localStorage.getItem(progressKey(datasetId));
    if (!raw && datasetId === DEFAULT_DATASET_ID) raw = localStorage.getItem(LEGACY_STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { units: {} };
}
function saveProgress() {
  try { localStorage.setItem(progressKey(), JSON.stringify(state.progress)); } catch (e) { /* ignore */ }
  if (cloud) cloud.queueSave();
}
function itemSnapshot(item) {
  return item ? { type: item.type, surface: surfaceOf(item) } : null;
}
function resolveItem(snapshot) {
  if (!snapshot) return null;
  return allVocabularyItems().find((item) => item.type === snapshot.type && surfaceOf(item) === snapshot.surface) || null;
}
function resumeDescription(resume) {
  if (!resume) return "";
  if (resume.mode === "learn") {
    const stage = {
      flash: `STEP 1 暗記カード ${Number(resume.flashIdx || 0) + 1}/${resume.items?.length || 4}`,
      check: `STEP 2 意味チェック ${Number(resume.checkIdx || 0) + 1}/${resume.checkOrder?.length || 4}`,
      wrongReview: "間違えた語句の復習",
      practice: "STEP 3 本番形式",
      done: "完了確認",
    }[resume.stage] || "学習中";
    return `第${resume.q}問・${stage}`;
  }
  if (resume.mode === "review") return `復習 ${Number(resume.reviewIdx || 0) + 1}/${resume.reviewQueue?.length || 1}（第${resume.q}問）`;
  if (resume.mode === "meaning") return `全語句の意味チェック ${Number(resume.checkIdx || 0) + 1}/${resume.checkOrder?.length || 1}`;
  if (resume.mode === "final") return `最終チェック ${Number(resume.checkIdx || 0) + 1}/${resume.checkOrder?.length || 1}`;
  return "学習の続き";
}
function saveResume() {
  if (!session) return;
  state.progress.resume = {
    mode: session.mode,
    q: session.q,
    stage: session.stage,
    flashIdx: session.flashIdx,
    checkIdx: session.checkIdx,
    checkAnswered: Boolean(session.checkAnswered),
    checkPicked: session.checkPicked,
    checkCorrect: session.checkCorrect,
    checkOrder: (session.checkOrder || []).map(itemSnapshot),
    items: (session.items || []).map(itemSnapshot),
    reviewQueue: session.reviewQueue || [],
    reviewIdx: session.reviewIdx || 0,
    wrongLog: (session.wrongLog || []).map((entry) => ({
      item: itemSnapshot(entry.item),
      picked: entry.picked,
    })),
    wrongChecked: session.wrongChecked || [],
    wrongReviewed: Boolean(session.wrongReviewed),
    meaningCorrect: session.meaningCorrect || 0,
    finalCorrect: session.finalCorrect || 0,
    practiceAnswered: Boolean(session.practiceAnswered),
    practiceResult: session.practiceResult,
    checkChoices: session._checkChoices || null,
  };
  saveProgress();
}
function clearResume() {
  if (!state.progress.resume) return;
  delete state.progress.resume;
  saveProgress();
}
function restoreSession() {
  const saved = state.progress.resume;
  if (!saved || !saved.mode) return false;
  const items = (saved.items || []).map(resolveItem).filter(Boolean);
  const checkOrder = (saved.checkOrder || []).map(resolveItem).filter(Boolean);
  if ((saved.mode === "learn" && !items.length) || ((saved.mode === "meaning" || saved.mode === "final") && !checkOrder.length)) {
    clearResume();
    return false;
  }
  session = {
    ...saved,
    q: saved.q == null ? null : Number(saved.q),
    items,
    checkOrder,
    reviewQueue: saved.reviewQueue || [],
    wrongLog: (saved.wrongLog || []).map((entry) => ({ item: resolveItem(entry.item), picked: entry.picked })).filter((entry) => entry.item),
    _checkChoices: saved.checkChoices || null,
  };
  renderSession();
  return true;
}
function unit(q) {
  if (!state.progress.units[q]) state.progress.units[q] = {};
  const u = state.progress.units[q];
  if (typeof u.learned !== "boolean") u.learned = false;
  if (typeof u.solvedCorrect !== "boolean") u.solvedCorrect = false;
  if (typeof u.needsReview !== "boolean") u.needsReview = false;
  if (typeof u.attempts !== "number") u.attempts = 0;
  if (typeof u.wrongCount !== "number") u.wrongCount = 0;
  return state.progress.units[q];
}
function finalProgress(finalTotal) {
  if (!state.progress.finalCheck) state.progress.finalCheck = {};
  const f = state.progress.finalCheck;
  if (typeof f.bestScore !== "number") f.bestScore = 0;
  if (typeof f.lastScore !== "number") f.lastScore = 0;
  if (typeof f.cleared !== "boolean") f.cleared = false;
  // 語彙データが後から増減すると、以前のCLEAR判定（当時の総数基準）が
  // 現在の総数と食い違い、最終チェックが解放されないまま隠れてしまう。
  if (f.cleared && typeof finalTotal === "number" && f.bestScore < finalTotal) {
    f.cleared = false;
    saveProgress();
  }
  return f;
}

/* ============================================================
   cloud sync（生徒別・共有URL ?s=&t=）— harness/cloud.js を利用
   共通スキーマ app_students / app_progress（app="eiken2-q1"）。
   config.json が無ければ no-op で、従来どおり匿名ローカル動作（無回帰）。
   RPC/認証/デバウンス保存は vendor/harness/cloud.js に集約。
   このアプリ固有＝複数データセットの進捗を1つのjsonbにまとめる点のみ。
   ============================================================ */
const APP_ID = "eiken2-q1";
let cloud = null; // harness createCloud のインスタンス（init で生成）

function setShareStatus(message, tone = "") {
  const slot = $("#shareStatus");
  if (!slot) return;
  slot.textContent = message || "";
  slot.className = "shareStatus" + (tone ? " " + tone : "");
}
// クラウド保存は全データセット分の進捗を1つのjsonbにまとめる: { [datasetId]: progress }
function collectAllProgress() {
  const map = {};
  Object.keys(DATASETS).forEach((id) => {
    try {
      const raw = localStorage.getItem(progressKey(id));
      if (raw) map[id] = JSON.parse(raw);
    } catch (e) { /* ignore */ }
  });
  map[state.datasetId] = state.progress; // 直近のメモリ状態を優先
  return map;
}
// クラウドから来た進捗（{datasetId: progress}）を localStorage へ反映
function applyCloudProgress(map) {
  if (!map || typeof map !== "object") return;
  Object.entries(map).forEach(([id, prog]) => {
    if (DATASETS[id] && prog && typeof prog === "object") {
      try { localStorage.setItem(progressKey(id), JSON.stringify(prog)); } catch (e) { /* ignore */ }
    }
  });
}
function applySharedUi() {
  const enabled = Boolean(cloud && cloud.isEnabled());
  document.body.classList.toggle("sharedMode", enabled);
}
function sharedMode() {
  return Boolean(cloud && cloud.isEnabled());
}

/* ---- helpers ---- */
const $ = (sel) => document.querySelector(sel);
function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const kid of kids) {
    if (kid == null) continue;
    n.appendChild(typeof kid === "string" ? document.createTextNode(kid) : kid);
  }
  return n;
}
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function surfaceOf(item) { return item.type === "idiom" ? item.phrase : item.word; }
// 選んだ誤答の意味が本当はどの語句のものかを逆引き（混同ペアの可視化）
function findOwnerOfMeaning(type, meaning, excludeItem) {
  return allVocabularyItems().find((it) => it !== excludeItem && it.type === type && it.meaning === meaning);
}
// 選択肢を描画した瞬間の時刻を記録し、直後の誤クリックを無視する
function armChoiceGuard() { session._choicesReadyAt = performance.now() + CHOICE_GUARD_MS; }
function choicesLocked() { return performance.now() < (session._choicesReadyAt || 0); }
function armFlashNavGuard() { session._flashNavReadyAt = performance.now() + FLASH_NAV_GUARD_MS; }
function flashNavLocked() { return performance.now() < (session._flashNavReadyAt || 0); }

/* ============================================================
   load data
   ============================================================ */
async function loadData(datasetId = state.datasetId) {
  state.datasetId = datasetId;
  state.itemsByQ = {};
  state.questions = {};
  state.qList = [];
  state.meaningPool = { word: [], idiom: [] };
  state.progress = loadProgress(datasetId);
  try { localStorage.setItem(DATASET_KEY, datasetId); } catch (e) { /* ignore */ }

  const current = dataset();
  const [vocab, qs] = await Promise.all([
    fetch(current.vocabUrl).then((r) => r.json()),
    fetch(current.questionsUrl).then((r) => r.json()),
  ]);

  const words = (vocab.words || []).map((w) => ({ ...w, type: "word" }));
  const idioms = (vocab.idioms || []).map((i) => ({ ...i, type: "idiom" }));
  const all = words.concat(idioms);

  for (const it of all) {
    if (!state.itemsByQ[it.q]) state.itemsByQ[it.q] = [];
    state.itemsByQ[it.q].push(it);
    state.meaningPool[it.type].push(it.meaning);
  }
  for (const q of qs.questions) state.questions[q.q] = q;

  state.qList = Object.keys(state.itemsByQ)
    .map(Number)
    .sort((a, b) => a - b);
}

async function switchDataset(datasetId) {
  if (!DATASETS[datasetId] || datasetId === state.datasetId) return;
  await loadData(datasetId);
  if (window.EikenActiveAppId !== "q1") return;
  session = null;
  renderHome();
}

function setChromeTitle(title) {
  const titleEl = document.getElementById("appTitle");
  if (titleEl) titleEl.textContent = title;
  document.title = title;
}

/* ============================================================
   HOME
   ============================================================ */
function renderHome() {
  setChromeTitle(`英検${dataset().shortLabel} 大問1 単語アプリ`);
  $("#sessionPanel").classList.add("hide");
  const home = $("#homePanel");
  home.classList.remove("hide");
  home.innerHTML = "";

  const total = state.qList.length;
  const learned = state.qList.filter((q) => unit(q).learned).length;
  const solved = state.qList.filter((q) => unit(q).solvedCorrect).length;
  const reviewQs = reviewQueue();
  const finalTotal = allVocabularyItems().length;
  const final = finalProgress(finalTotal);
  const currentDataset = dataset();

  // hero は初回訪問（まだ何も学習していない）時だけ表示し、Today見出しとの説明重複を避ける
  if (learned === 0) {
    home.appendChild(el("section", { class: "card hero" },
      el("p", { class: "label" }, "学習の流れ"),
      el("h2", {}, "大問1の語句を「覚えてから解く」"),
      el("p", { class: "hint" }, "各設問の4つの選択肢を、意味・語源・例文で覚える → 意味チェック → 本番形式で解く、の3ステップ。"),
    ));
  }

  // daily / summary（旧・Today/Missionカードを統合。重複する指標は1本化する）
  const summary = el("section", { class: "card" });
  const headerTitle = final.cleared ? `${currentDataset.shortLabel} 大問1 CLEAR` : `${currentDataset.shortLabel} 大問1を「覚えて→確かめて→解く」`;
  summary.appendChild(el("div", { class: "sectionHead" },
    el("div", {},
      el("p", { class: "label" }, final.cleared ? "達成状況" : "今日の学習"),
      el("h2", {}, headerTitle),
    ),
    datasetPicker(),
  ));
  const grid = el("div", { class: "dailyGrid cols4" });
  grid.appendChild(statCell(learned, total, "学習した設問"));
  grid.appendChild(statCell(solved, total, "正解"));
  grid.appendChild(statCell(reviewQs.length, total, "復習対象"));
  grid.appendChild(statCell(final.bestScore, finalTotal, "最終チェック BEST"));
  summary.appendChild(grid);

  // --- 次にやること（Hickの法則：迷わせないため主導線は常に1つに絞る） ---
  const resume = state.progress.resume;
  const nextQ = state.qList.find((q) => !unit(q).learned);
  const canStartFinal = finalUnlocked();

  if (resume) {
    summary.appendChild(el("div", { class: "resumeNotice" },
      el("p", { class: "label" }, "途中保存"),
      el("p", { class: "resumeText" }, resumeDescription(resume)),
      el("p", { class: "hint" }, "この端末に保存されています。続きから再開できます。"),
    ));
  }

  // おすすめ（主導線）＝状態に応じて1つだけ決める。重要度：学習 → 復習 → 最終 → 周回。
  let primary;
  if (resume) {
    primary = {
      label: "続きから再開する",
      why: "前回保存した位置から再開します。",
      onclick: () => { if (!restoreSession()) renderHome(); },
    };
  } else if (nextQ) {
    primary = {
      label: `第${nextQ}問を学習する`,
      why: "暗記カード → 意味チェック → 本番形式の3ステップで進みます。",
      onclick: () => startLearn(nextQ),
    };
  } else if (reviewQs.length) {
    primary = {
      label: `間違えた${reviewQs.length}問を復習する`,
      why: "まちがえた設問をつぶすと、最終チェックが解放されます。",
      onclick: startReview,
    };
  } else if (canStartFinal && !final.cleared) {
    primary = {
      label: `最終チェック${finalTotal}問に挑戦する`,
      why: `全${finalTotal}語の意味を通しで確認。${finalTotal}問正解でCLEARです。`,
      onclick: startFinalCheck,
    };
  } else {
    primary = {
      label: "第1問からもう一周する",
      why: "はじめの設問から、覚え直し・解き直しをします。",
      onclick: () => startLearn(state.qList[0]),
    };
  }

  const rec = el("div", { class: "recommend" });
  rec.appendChild(el("p", { class: "recEyebrow" }, "▶ まずはここから"));
  rec.appendChild(el("button", { class: "cta startCta", onclick: primary.onclick }, primary.label));
  rec.appendChild(el("p", { class: "recWhy" }, primary.why));
  summary.appendChild(rec);

  // そのほかの練習（従属メニュー・重要度順）。
  // 問題セット（データセット）や進捗によってボタンの有無が変わるとページ構造が揃わないため、
  // 常に同じ3項目を固定順で表示し、選べない状態はdisabledで示す（表示/非表示の切り替えはしない）。
  const remain = total - solved;
  const more = [
    {
      cls: "secondaryCta reviewCta",
      label: reviewQs.length ? `間違えた${reviewQs.length}問を復習` : "復習対象はありません",
      onclick: startReview,
      disabled: !reviewQs.length || primary.onclick === startReview,
    },
    final.cleared
      ? { cls: "secondaryCta finalCta", label: `最終チェックCLEAR済み（BEST ${final.bestScore}/${finalTotal}）`, disabled: true }
      : canStartFinal
        ? { cls: "secondaryCta finalCta", label: `最終チェック${finalTotal}問に挑戦`, onclick: startFinalCheck, disabled: primary.onclick === startFinalCheck }
        : { cls: "secondaryCta", label: `最終チェック（あと${remain}問で解放）`, disabled: true },
    { cls: "secondaryCta", label: `意味だけをまとめて練習（全${finalTotal}語・設問は解かない）`, onclick: startMeaningPractice },
  ];

  const moreWrap = el("div", { class: "secondaryActions" });
  moreWrap.appendChild(el("p", { class: "label" }, "その他の練習"));
  const row = el("div", { class: "actions" });
  more.forEach((m) => {
    const attrs = { class: m.cls };
    if (m.disabled) attrs.disabled = "disabled";
    else attrs.onclick = m.onclick;
    row.appendChild(el("button", attrs, m.label));
  });
  moreWrap.appendChild(row);
  summary.appendChild(moreWrap);
  summary.appendChild(el("div", { class: "missionNote" },
    el("p", { class: "hint" }, finalMessage(solved, total, reviewQs.length, final, finalTotal)),
  ));
  home.appendChild(summary);

  // question path
  const path = el("section", { class: "card" });
  path.appendChild(el("div", { class: "pathHead" },
    el("p", { class: "label" }, "問題一覧"),
    el("h2", {}, `${currentDataset.shortLabel} 大問1（全${total}問）`),
    el("p", { class: "hint" }, "各設問に出る4つの語句を覚えてから、その設問を解きます。クリックで開始。"),
  ));
  const list = el("div", { class: "itemList" });
  for (const q of state.qList) {
    const u = unit(q);
    const items = state.itemsByQ[q];
    const isIdiom = items[0].type === "idiom";
    const words = items.map(surfaceOf).join(" / ");
    const cls = "qCard" + (u.needsReview ? " review" : (u.learned ? " done" : ""));
    const stat = u.needsReview
      ? `復習対象・ミス${u.wrongCount}回`
      : (u.learned ? (u.solvedCorrect ? "学習済・正解" : "学習済") : "未学習");
    list.appendChild(el("button", { class: cls, onclick: () => startLearn(q) },
      el("span", { class: "qno" }, `第${q}問 ・ ${isIdiom ? "熟語" : "単語"}`),
      el("span", { class: "qwords" }, words),
      el("span", { class: "qstat" }, stat),
    ));
  }
  path.appendChild(list);
  home.appendChild(path);

  if (!sharedMode()) {
    const other = el("section", { class: "card" },
      el("details", { class: "moreDetails" },
        el("summary", { class: "label" }, "その他"),
        el("div", { class: "actions" },
          el("button", {
            class: "ghost", type: "button", onclick: () => {
              if (confirm("すべての進捗を消去します。よろしいですか？")) {
                state.progress = { units: {} };
                saveProgress();
                renderHome();
              }
            },
          }, "進捗リセット"),
        ),
      ),
    );
    home.appendChild(other);
  }
}

function statCell(n, d, caption) {
  return el("div", { class: "dailyCell" },
    el("div", { class: "dailyNum", html: `${n}<small>/ ${d}</small>` }),
    el("div", { class: "dailyCaption" }, caption),
  );
}

function datasetPicker() {
  const wrap = el("label", { class: "datasetPicker" },
    el("span", { class: "fieldLabel" }, "問題セット"),
  );
  const select = el("select", { class: "datasetSelect", onchange: (e) => switchDataset(e.target.value) });
  Object.entries(DATASETS).forEach(([id, data]) => {
    const opt = el("option", { value: id }, data.label);
    if (id === state.datasetId) opt.selected = true;
    select.appendChild(opt);
  });
  wrap.appendChild(select);
  return wrap;
}

function answerActions(...buttons) {
  return el("div", { class: "actions answerActions" }, ...buttons);
}

function revealAnswerActions(actions) {
  requestAnimationFrame(() => {
    actions.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

function reviewQueue() {
  return state.qList.filter((q) => unit(q).needsReview);
}

function allVocabularyItems() {
  return state.qList.flatMap((q) => state.itemsByQ[q] || []);
}

function finalUnlocked() {
  return state.qList.length > 0
    && state.qList.every((q) => unit(q).solvedCorrect)
    && reviewQueue().length === 0;
}

function finalMessage(solved, total, reviewCount, final, finalTotal) {
  if (final.cleared) return `最終チェックを${final.lastScore}/${finalTotal}で突破済みです。`;
  if (!finalUnlocked()) {
    const needs = [];
    if (solved < total) needs.push(`通常ステージをあと${total - solved}問`);
    if (reviewCount) needs.push(`復習対象をあと${reviewCount}問`);
    return `最終チェック解放まで：${needs.join(" / ")}`;
  }
  return final.bestScore
    ? `最終チェック解放中。過去最高は${final.bestScore}/${finalTotal}です。${finalTotal}/${finalTotal}でCLEAR。`
    : `最終チェック解放中。${finalTotal}問の意味チェックで${finalTotal}/${finalTotal}を取るとCLEAR。`;
}

/* ============================================================
   LEARN FLOW (per question)
   stages: flash -> check -> practice -> done
   ============================================================ */
let session = null;

function startLearn(q) {
  const items = state.itemsByQ[q];
  session = {
    mode: "learn",
    q,
    items: shuffle(items),
    stage: "flash",
    flashIdx: 0,
    checkOrder: shuffle(items),
    checkIdx: 0,
    checkAnswered: false,
    meaningCorrect: 0,
    wrongLog: [],
    wrongChecked: [],
    wrongReviewed: false,
  };
  renderSession();
}

function startReview() {
  const queue = reviewQueue();
  if (!queue.length) {
    renderHome();
    return;
  }
  const q = queue[0];
  session = {
    mode: "review",
    reviewQueue: queue,
    reviewIdx: 0,
    q,
    items: state.itemsByQ[q],
    stage: "practice",
  };
  renderSession();
}

function startMeaningPractice() {
  const queue = shuffle(allVocabularyItems());
  session = {
    mode: "meaning",
    q: null,
    items: queue,
    stage: "check",
    checkOrder: queue,
    checkIdx: 0,
    checkAnswered: false,
    meaningCorrect: 0,
    wrongLog: [],
    wrongChecked: [],
    wrongReviewed: false,
  };
  renderSession();
}

function startFinalCheck() {
  const queue = shuffle(allVocabularyItems());
  session = {
    mode: "final",
    q: null,
    items: queue,
    stage: "check",
    checkOrder: queue,
    checkIdx: 0,
    checkAnswered: false,
    finalCorrect: 0,
    wrongLog: [],
    wrongChecked: [],
    wrongReviewed: false,
  };
  renderSession();
}

function renderSession() {
  saveResume();
  $("#homePanel").classList.add("hide");
  const panel = $("#sessionPanel");
  panel.classList.remove("hide");
  panel.innerHTML = "";

  const isMeaning = session.mode === "meaning";
  const isFinal = session.mode === "final";
  const q = session.q;
  const isIdiom = !isMeaning && !isFinal && session.items[0].type === "idiom";
  const isReview = session.mode === "review";

  // header
  panel.appendChild(el("div", { class: "itemHead" },
     el("div", {},
       el("p", { class: "label" }, sessionLabel(q, isIdiom, isReview, isMeaning, isFinal)),
       el("h2", {}, stageTitle(session.stage)),
       el("p", { class: "sessionState" }, "現在地をこの端末に保存中"),
     ),
    el("button", { class: "ghost", onclick: () => renderHome() }, "一覧へ戻る"),
  ));

  // stage bar
  if (isFinal) panel.appendChild(finalBar());
  else if (isMeaning) panel.appendChild(meaningBar());
  else if (isReview) panel.appendChild(reviewBar());
  else panel.appendChild(stageBar(session.stage));

  const body = el("div", {});
  panel.appendChild(body);

  if (session.stage === "flash") renderFlash(body);
  else if (session.stage === "check") renderCheck(body);
  else if (session.stage === "wrongReview") renderWrongReview(body);
  else if (session.stage === "practice") renderPractice(body);
  else if (session.stage === "done") renderDone(body);
}

function sessionLabel(q, isIdiom, isReview, isMeaning, isFinal) {
  if (isFinal) return `最終チェック ${session.checkIdx + 1} / ${session.checkOrder.length}`;
  if (isMeaning) return `全語句ランダム ${session.checkIdx + 1} / ${session.checkOrder.length}`;
  if (isReview) return `復習演習 ${session.reviewIdx + 1} / ${session.reviewQueue.length}`;
  return `第${q}問 ・ ${isIdiom ? "熟語" : "単語"}`;
}

function stageTitle(stage) {
  if (session && session.mode === "final") return `最終チェック${session.checkOrder.length}問`;
  if (session && session.mode === "meaning") return "意味チェックだけ演習";
  if (session && session.mode === "review") return "間違えた問題を演習";
  return {
    flash: "STEP 1　覚える（暗記カード）",
    check: "STEP 2　確かめる（意味チェック）",
    wrongReview: "必要なときの復習",
    practice: "STEP 3　解く（本番形式）",
    done: "完了",
  }[stage];
}

function reviewBar() {
  const bar = el("div", { class: "stageBar reviewBar" });
  const count = session.reviewQueue.length;
  session.reviewQueue.forEach((q, i) => {
    let cls = "stagePill";
    if (i < session.reviewIdx) cls += " cleared";
    if (i === session.reviewIdx) cls += " active";
    bar.appendChild(el("div", { class: cls }, `第${q}問`));
  });
  if (!count) bar.appendChild(el("div", { class: "stagePill active" }, "復習完了"));
  return bar;
}

function meaningBar() {
  return el("div", { class: "stageBar meaningBar" },
    el("div", { class: "stagePill active" },
      `意味チェック ${session.checkIdx + 1} / ${session.checkOrder.length}`),
    el("div", { class: "stagePill" },
      `回答済 ${session.checkIdx} / 正解 ${session.meaningCorrect}`),
  );
}

function finalBar() {
  return el("div", { class: "stageBar meaningBar" },
    el("div", { class: "stagePill active" },
      `最終チェック ${session.checkIdx + 1} / ${session.checkOrder.length}`),
    el("div", { class: "stagePill" },
      `回答済 ${session.checkIdx} / 正解 ${session.finalCorrect}`),
  );
}

function stageBar(stage) {
  const order = ["flash", "check"];
  if (stage === "wrongReview" || (session.wrongLog && session.wrongLog.length)) order.push("wrongReview");
  order.push("practice");
  const cur = order.indexOf(stage);
  const labels = { flash: "1 覚える", check: "2 確かめる", wrongReview: "必要なら復習", practice: "3 解く" };
  const bar = el("div", { class: "stageBar" });
  order.forEach((s, i) => {
    let cls = "stagePill";
    if (stage === "done" || i < cur) cls += " cleared";
    if (s === stage) cls += " active";
    bar.appendChild(el("div", { class: cls }, labels[s]));
  });
  return bar;
}

/* ---- STEP 1: flashcards ---- */
function buildFlashCard(item) {
  const card = el("div", { class: "flash" });
  const head = el("div", { class: "flashHead" });
  const wordLine = el("div", { class: "flashWordLine" },
    el("div", { class: "flashWord" }, surfaceOf(item)),
  );
  if (item.ipa) wordLine.appendChild(el("div", { class: "flashIpa" }, item.ipa));
  head.appendChild(el("div", {},
    wordLine,
    el("div", { class: "flashPos" }, item.pos || ""),
  ));
  card.appendChild(head);

  const inner = el("div", { class: "flashBody" });
  inner.appendChild(flashRow("意味", item.meaning, "flashMeaning"));
  if (item.etymology) inner.appendChild(flashRow("語源・なりたち", item.etymology, "flashEtym"));
  if (item.example) inner.appendChild(flashExampleRow(item));
  if (item.collocation) inner.appendChild(flashRow("使い方・コロケーション", item.collocation, "flashColl"));
  card.appendChild(inner);
  return card;
}

function renderFlash(body) {
  const items = session.items;
  const item = items[session.flashIdx];

  body.appendChild(buildFlashCard(item));

  const nav = el("div", { class: "actions flashNav" });
  const canGoBack = session.flashIdx > 0;
  const prevAttrs = canGoBack ? { class: "ghost" } : { class: "ghost", disabled: "disabled" };
  prevAttrs.onclick = () => {
    if (!canGoBack || flashNavLocked()) return;
    armFlashNavGuard();
    session.flashIdx--;
    renderSession();
  };
  nav.appendChild(el("button", prevAttrs, "← 前のカード"));
  const last = session.flashIdx === items.length - 1;
  nav.appendChild(el("button", {
    class: "cta",
    onclick: () => {
      if (flashNavLocked()) return;
      armFlashNavGuard();
      if (last) { session.stage = "check"; renderSession(); }
      else { session.flashIdx++; renderSession(); }
    },
  }, last ? "意味チェックへ進む →" : "次のカード →"));
  body.appendChild(nav);

  body.appendChild(el("p", { class: "cardCounter", style: "margin-top:10px" },
    `カード ${session.flashIdx + 1} / ${items.length}`));
}

function flashRow(labelText, text, cls) {
  return el("div", { class: "flashRow" },
    el("strong", {}, labelText),
    el("div", { class: cls }, text),
  );
}
function flashExampleRow(item) {
  const surface = surfaceOf(item);
  const row = el("div", { class: "flashRow" });
  row.appendChild(el("strong", {}, "例文"));
  // 見出し語をハイライト
  const re = new RegExp("(" + surface.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "i");
  const parts = item.example.split(re);
  const p = el("div", { class: "flashEx" });
  parts.forEach((part) => {
    if (part.toLowerCase() === surface.toLowerCase()) p.appendChild(el("em", {}, part));
    else p.appendChild(document.createTextNode(part));
  });
  row.appendChild(p);
  return row;
}

function appendStemWithBreaks(target, stem) {
  const lines = stem
    .replace(/\s+(?=[AB]:\s)/g, "\n")
    .split("\n")
    .filter(Boolean);

  lines.forEach((line, lineIdx) => {
    const segs = line.split(/\(\s*\)/);
    segs.forEach((seg, i) => {
      target.appendChild(document.createTextNode(seg));
      if (i < segs.length - 1) target.appendChild(el("span", { class: "blank" }, "　"));
    });
    if (lineIdx < lines.length - 1) target.appendChild(el("br"));
  });
}

/* ---- STEP 2: meaning check ---- */
function renderCheck(body) {
  armChoiceGuard();
  const item = session.checkOrder[session.checkIdx];
  const surface = surfaceOf(item);

  body.appendChild(el("div", { class: "roundInfo" }, `意味チェック ${session.checkIdx + 1} / ${session.checkOrder.length}`));

  const box = el("div", { class: "quizBox" });
  box.appendChild(el("p", { class: "label" }, "次の語句の意味は？"));
  box.appendChild(el("p", { class: "askWord" }, surface));

  // choices: correct meaning + 3 distractors of same type
  if (!session._checkChoices) {
    const pool = state.meaningPool[item.type].filter((m) => m !== item.meaning);
    const distractors = shuffle(pool).slice(0, 3);
    session._checkChoices = shuffle([item.meaning, ...distractors]);
  }
  const choices = session._checkChoices;
  const correct = item.meaning;
  const last = session.checkIdx === session.checkOrder.length - 1;

  const choiceWrap = el("div", { class: "choices" });
  choices.forEach((m, i) => {
    const btn = el("button", { class: "choiceBtn" },
      el("span", { class: "key" }, String(i + 1)),
      el("span", {}, m),
    );
    if (session.checkAnswered) {
      btn.disabled = true;
      if (m === correct) btn.classList.add("correct");
      else if (m === session.checkPicked) btn.classList.add("wrong");
    }
    btn.addEventListener("click", () => {
      if (session.checkAnswered || choicesLocked()) return;
      session.checkAnswered = true;
      session.checkPicked = m;
      const isCorrect = m === correct;
      session.checkCorrect = isCorrect;
      [...choiceWrap.children].forEach((c) => {
        c.disabled = true;
        const txt = c.querySelector("span:last-child").textContent;
        if (txt === correct) c.classList.add("correct");
        else if (txt === m && !isCorrect) c.classList.add("wrong");
      });
      if ((session.mode === "meaning" || session.mode === "learn") && isCorrect) session.meaningCorrect += 1;
      if (session.mode === "final" && isCorrect) session.finalCorrect += 1;
      if (!isCorrect && session.wrongLog) session.wrongLog.push({ item, picked: m });
      if (last && session.mode === "final") saveFinalResult();
      saveResume();
      appendCheckFeedback(box, item, surface, correct, isCorrect);
    });
    choiceWrap.appendChild(btn);
  });
  box.appendChild(choiceWrap);
  if (session.checkAnswered) {
    appendCheckFeedback(box, item, surface, correct, session.checkCorrect);
  }
  body.appendChild(box);
}

function appendCheckFeedback(box, item, surface, correct, isCorrect) {
  if (box.querySelector(".checkFeedback")) return;
  const fb = el("div", { class: "feedback checkFeedback " + (isCorrect ? "ok" : "ng") },
    el("h3", {}, isCorrect ? "正解！" : "おしい！"),
    el("p", {}, `${surface}：${correct}`),
  );
  if (item.etymology) fb.appendChild(el("p", { class: "trans" }, item.etymology));
  box.appendChild(fb);

  const last = session.checkIdx === session.checkOrder.length - 1;
  const actions = answerActions(
    el("button", {
      class: "cta",
      onclick: () => {
        session.checkAnswered = false;
        session.checkPicked = null;
        session.checkCorrect = null;
        session._checkChoices = null;
        if (last) {
          session.stage = nextStageAfterCheck();
          renderSession();
        } else {
          session.checkIdx++;
          renderSession();
        }
      },
    }, last ? nextAfterCheckLabel() : "次へ →"),
  );
  box.appendChild(actions);
  revealAnswerActions(actions);
}

// 意味チェックの最終問のあと：誤答があればまず復習ステージへ、無ければ従来どおりの行き先へ
function afterCheckDestination() {
  return (session.mode === "meaning" || session.mode === "final") ? "done" : "practice";
}
function nextStageAfterCheck() {
  if (session.wrongLog && session.wrongLog.length && !session.wrongReviewed) return "wrongReview";
  return afterCheckDestination();
}
function nextAfterCheckLabel() {
  if (session.wrongLog && session.wrongLog.length && !session.wrongReviewed) return "間違えた語句を復習する →";
  return afterCheckDestination() === "done" ? "結果を見る →" : "本番形式の問題へ →";
}

/* ---- STEP 2.5: 誤答復習（暗記カード＋逆引き＋読了チェック） ---- */
function renderWrongReview(body) {
  const log = session.wrongLog;
  const checked = new Set(session.wrongChecked || []);

  body.appendChild(el("p", { class: "hint" }, "間違えた語句を確認してください。読み終えたら「確認した」を押してください。"));

  const listWrap = el("div", { class: "wrongReview" });
  const hint = el("p", { class: "hint reviewCountHint" }, `残り${log.length}語`);
  const nextBtn = el("button", {
    class: "cta",
    disabled: "disabled",
    onclick: () => {
      session.wrongReviewed = true;
      session.stage = afterCheckDestination();
      renderSession();
    },
  }, afterCheckDestination() === "done" ? "結果を見る →" : "本番形式の問題へ →");

  log.forEach((entry, i) => {
    const { item, picked } = entry;
    const owner = findOwnerOfMeaning(item.type, picked, item);
    const card = buildFlashCard(item);
    card.classList.add("reviewCard");
    const wrongLine = el("div", { class: "flashRow" },
      el("strong", {}, "選んだ意味"),
      el("div", { class: "flashEtym" }, picked + (owner ? `　→　これは「${surfaceOf(owner)}」の意味です` : "")),
    );
    card.querySelector(".flashBody").appendChild(wrongLine);
    const checkBtn = el("button", { class: "ghost smallGhost reviewCheckBtn", type: "button" }, "確認した");
    if (checked.has(i)) {
      checkBtn.disabled = true;
      checkBtn.textContent = "確認済み";
      card.classList.add("reviewCardDone");
    }
    checkBtn.addEventListener("click", () => {
      if (checked.has(i)) return;
      checked.add(i);
      session.wrongChecked = [...checked];
      saveResume();
      checkBtn.disabled = true;
      checkBtn.textContent = "確認済み";
      card.classList.add("reviewCardDone");
      const remaining = log.length - checked.size;
      hint.textContent = remaining > 0 ? `残り${remaining}語` : "すべて確認しました";
      if (checked.size === log.length) nextBtn.disabled = false;
    });
    card.appendChild(checkBtn);
    listWrap.appendChild(card);
  });

  body.appendChild(listWrap);
  const remaining = log.length - checked.size;
  hint.textContent = remaining > 0 ? `残り${remaining}語` : "すべて確認しました";
  if (checked.size === log.length) nextBtn.disabled = false;
  body.appendChild(hint);
  body.appendChild(el("div", { class: "actions" }, nextBtn));
}

function saveFinalResult() {
  const f = finalProgress();
  f.lastScore = session.finalCorrect;
  f.bestScore = Math.max(f.bestScore, session.finalCorrect);
  f.lastTriedAt = new Date().toISOString();
  if (session.finalCorrect === session.checkOrder.length) {
    f.cleared = true;
    f.clearedAt = new Date().toISOString();
  }
  saveProgress();
}

/* ---- STEP 3: practice (actual question) ---- */
function renderPractice(body) {
  armChoiceGuard();
  const q = session.q;
  const q_ = state.questions[q];
  const items = state.itemsByQ[q];
  const itemBySurface = {};
  for (const it of items) itemBySurface[surfaceOf(it).toLowerCase()] = it;

  const box = el("div", { class: "quizBox" });
  box.appendChild(el("div", { class: "quizTop" },
    el("span", { class: "label", style: "margin:0" }, `第${q}問　本番形式`),
  ));

  // stem with blank
  const stemP = el("p", { class: "stem" });
  appendStemWithBreaks(stemP, q_.stem);
  box.appendChild(stemP);

  const choiceWrap = el("div", { class: "choices" });
  q_.choices.forEach((c, i) => {
    const btn = el("button", { class: "choiceBtn" },
      el("span", { class: "key" }, String(i + 1)),
      el("span", {}, c),
    );
    btn.addEventListener("click", () => onPracticeAnswer(i, box, choiceWrap, q_, itemBySurface));
    choiceWrap.appendChild(btn);
  });
  box.appendChild(choiceWrap);
  body.appendChild(box);
}

function onPracticeAnswer(idx, box, choiceWrap, q_, itemBySurface) {
  if (session.practiceAnswered || choicesLocked()) return;
  session.practiceAnswered = true;
  const correctIdx = q_.answerIndex;
  const isCorrect = idx === correctIdx;

  [...choiceWrap.children].forEach((c, i) => {
    c.disabled = true;
    if (i === correctIdx) c.classList.add("correct");
    else if (i === idx) c.classList.add("wrong");
  });

  const correctWord = q_.choices[correctIdx];
  const ansItem = itemBySurface[correctWord.toLowerCase()];

  const fb = el("div", { class: "feedback " + (isCorrect ? "ok" : "ng") },
    el("h3", {}, isCorrect ? "正解！" : "不正解"),
    el("p", {}, `正解：${correctIdx + 1}　${correctWord}　— ${ansItem ? ansItem.meaning : ""}`),
  );
  if (q_.translation) fb.appendChild(el("p", { class: "trans" }, "和訳：" + q_.translation));
  box.appendChild(fb);

  const u = unit(session.q);
  u.learned = true;
  u.attempts += 1;
  u.lastAnsweredAt = new Date().toISOString();
  u.solvedCorrect = isCorrect;
  u.needsReview = !isCorrect;
  if (!isCorrect) u.wrongCount += 1;
  saveProgress();

  session.practiceResult = isCorrect;
  const actions = answerActions(
    el("button", { class: "cta", onclick: () => { session.stage = "done"; renderSession(); } }, "結果を見る →"),
  );
  box.appendChild(actions);
  revealAnswerActions(actions);
}

/* ---- DONE ---- */
function renderDone(body) {
  clearResume();
  const q = session.q;
  const isMeaning = session.mode === "meaning";
  const isFinal = session.mode === "final";
  const isReview = session.mode === "review";
  const banner = el("div", { class: "doneBanner" });
  banner.appendChild(el("p", { class: "label", style: "color:rgba(250,249,246,.72)" }, "Step Complete"));
  if (isFinal) {
    banner.appendChild(el("div", { class: "big" }, `${session.finalCorrect} / ${session.checkOrder.length}`));
    banner.appendChild(el("h2", {}, session.finalCorrect === session.checkOrder.length
      ? `${dataset().shortLabel} 大問1 CLEAR`
      : `最終チェック完了。${session.finalCorrect}/${session.checkOrder.length}でした`));
  } else if (isMeaning) {
    banner.appendChild(el("div", { class: "big" }, `${session.meaningCorrect} / ${session.checkOrder.length}`));
    banner.appendChild(el("h2", {}, "全語句の意味チェックが完了しました"));
  } else {
    banner.appendChild(el("div", { class: "big" }, session.practiceResult ? "正解！" : "復習リストに残しました"));
    banner.appendChild(el("h2", {}, isReview ? `第${q}問の復習演習が完了しました` : `第${q}問の4語句を学習しました`));
    if (!isReview) {
      banner.appendChild(el("p", { class: "hint" },
        `意味チェック ${session.meaningCorrect}/${session.checkOrder.length}・誤答 ${session.wrongLog.length}語`));
    }
  }
  body.appendChild(banner);

  const actions = el("div", { class: "actions" });
  if (isFinal) {
    if (session.finalCorrect !== session.checkOrder.length) {
      actions.appendChild(el("button", { class: "cta finalCta", onclick: startFinalCheck }, `もう一度${session.checkOrder.length}問に挑戦する`));
    }
  } else if (isMeaning) {
    actions.appendChild(el("button", { class: "cta meaningCta", onclick: startMeaningPractice },
      "もう一度ランダムで演習する"));
  } else if (isReview) {
    const nextReview = reviewQueue()[0];
    if (nextReview) {
      actions.appendChild(el("button", { class: "cta reviewCta", onclick: startReview },
        `次の復習へ（第${nextReview}問） →`));
    }
  } else {
    const nextQ = state.qList.find((qq) => !unit(qq).learned);
    if (nextQ) {
      actions.appendChild(el("button", { class: "cta", onclick: () => startLearn(nextQ) }, `次の設問へ（第${nextQ}問） →`));
    } else if (finalUnlocked() && !finalProgress(allVocabularyItems().length).cleared) {
      actions.appendChild(el("button", { class: "cta finalCta", onclick: startFinalCheck }, "最終チェックへ →"));
    } else {
      actions.appendChild(el("button", { class: "cta", onclick: renderHome }, "次の学習を選ぶ →"));
    }
  }
  actions.appendChild(el("button", { class: "ghost", onclick: renderHome }, "一覧へ戻る"));
  body.appendChild(actions);
}

/* ============================================================
   boot / mount（kobun-vocab と同じ: 初回のみ boot、以降はタブ復帰で renderHome のみ）
   ============================================================ */
let booted = false;

async function boot() {
  try {
    await loadManifest();
    state.datasetId = loadDatasetId();

    // 生徒別クラウド同期（共有URL ?s=&t= があり、config.json が揃っているときのみ有効）
    cloud = createCloud({
      appId: APP_ID,
      getPayload: collectAllProgress,
      applyLoaded: applyCloudProgress,
      onStatus: setShareStatus,
    });
    await cloud.init();
    applySharedUi();

    await loadData();
    if (window.EikenActiveAppId !== "q1") return;
    renderHome();
  } catch (e) {
    if (window.EikenActiveAppId !== "q1") return;
    $("#homePanel").innerHTML = "";
    $("#homePanel").appendChild(el("div", { class: "empty" },
      "データの読み込みに失敗しました。ローカルサーバー経由で開いているか確認してください。"));
    console.error(e);
  }
}

async function mount() {
  if (booted) {
    const preferredDatasetId = loadDatasetId();
    if (preferredDatasetId !== state.datasetId) {
      await loadData(preferredDatasetId);
      session = null;
    }
    renderHome();
    return;
  }
  booted = true;
  await boot();
}

function startSerial() {
  if (state.progress.resume && restoreSession()) return;
  const nextQ = state.qList.find((q) => !unit(q).learned);
  if (nextQ) {
    startLearn(nextQ);
    return;
  }
  const reviewQs = reviewQueue();
  if (reviewQs.length) {
    startReview();
    return;
  }
  const final = finalProgress(allVocabularyItems().length);
  if (finalUnlocked() && !final.cleared) {
    startFinalCheck();
    return;
  }
  renderHome();
}

function handleKey() { /* 大問1モードはキーボード操作なし */ }

return { mount, handleKey, startSerial };
})();
