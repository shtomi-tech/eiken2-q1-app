"use strict";

/* ============================================================
   英検 大問1 単語アプリ
   学習フロー：暗記カード → 理解チェック → 本番演習（設問ごと）
   ※ 間隔反復（Leitner）は全級の「意味だけ練習」に対応。進捗は localStorage に保存。
   kobun-vocab と同じ方式で IIFE に閉じ、{ mount, handleKey } のみを公開する。
   ============================================================ */

const EikenQ1App = (function () {

const LEGACY_STORE_KEY = "eiken2_q1_v1";
const STORE_PREFIX = "eiken_q1_progress_";
const EXAMPLE_STORE_PREFIX = "eiken_q1_examples_";
const DATASET_KEY = "eiken_q1_dataset";
const LEGACY_PRE1_PROGRESS_KEY = "eiken_pre1_progress_v1";
const LEGACY_PRE1_ROUND_KEY = "eiken_pre1_round";
const LEGACY_PRE1_APP_ID = "eiken-pre1";
const PRE1_MIGRATION_VERSION = 1;
const CORRUPT_PROGRESS_PREFIX = "eiken_q1_corrupt_";
const MANIFEST_URL = "data/manifest.json";
// datasetId の級プレフィックス → 音声フォルダ名。級の判定・同一級のプール化にも使う。
// ここに無いプレフィックスは「級不明」として扱い、意味練習のプール対象から外す。
const GRADE_BY_PREFIX = { eiken1: "1", eiken2: "2", eikenp1: "pre1", eikenp2: "pre2" };
const DATASET_ID_RE = new RegExp(`^(${Object.keys(GRADE_BY_PREFIX).join("|")})-(\\d{4}-\\d+|mock-\\d+)$`);
// 問題セット一覧は data/manifest.json（"q1"キー）から読み込む。
// 回を追加するときはデータJSONを置いてmanifest.jsonに1エントリ足すだけでよく、このファイルの編集は不要。
let DATASETS = {};
let DEFAULT_DATASET_ID = null;
let aiCheckEndpoint = "";
async function loadManifest() {
  const manifest = await fetch(MANIFEST_URL, { cache: "no-store" }).then((r) => r.json());
  DATASETS = manifest.q1;
  DEFAULT_DATASET_ID = manifest.defaultDatasetId;
}

function availableDatasets() {
  return Object.entries(DATASETS);
}
function defaultDatasetId() {
  return DEFAULT_DATASET_ID;
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
  userExamples: {},
};

const RESUMABLE_MODES = new Set(["learn", "review", "meaning", "final"]);
let resumeRecoveryMessage = "";
let resumeUnavailable = false;

async function loadAiConfig() {
  aiCheckEndpoint = "";
  try {
    const response = await fetch("static/config.json", { cache: "no-store" });
    if (!response.ok) return;
    const config = await response.json();
    if (config && typeof config.aiCheckEndpoint === "string") {
      aiCheckEndpoint = config.aiCheckEndpoint.trim();
    }
  } catch (e) {
    // AI未設定でも、通常の語彙演習と下書き保存は続けられる。
  }
}

/* ---- progress (localStorage) ---- */
function loadDatasetId() {
  try {
    const id = localStorage.getItem(DATASET_KEY);
    if (id && DATASETS[id]) return id;
  } catch (e) { /* ignore */ }
  return defaultDatasetId();
}
function dataset() {
  return DATASETS[state.datasetId] || DATASETS[defaultDatasetId()];
}
function datasetCleared(datasetId) {
  const saved = progressFor(datasetId);
  return Boolean(saved && saved.finalCheck && saved.finalCheck.cleared);
}
// datasetId から級プレフィックス（eiken1 / eiken2 / eikenp1 / eikenp2）を取り出す。
// 意味だけ練習の間隔反復（Leitner）とプール化は、この級単位で行う。
function gradeOf(datasetId) {
  const match = DATASET_ID_RE.exec(datasetId || "");
  return match ? match[1] : null;
}
function currentGrade() {
  return gradeOf(state.datasetId);
}
// 1描画（＝1回のキュー生成）の間だけ、非アクティブ回のブロックをメモ化する。
// ホーム描画は語句ごとに progressFor を呼ぶため、無いと localStorage.getItem + JSON.parse が
// 数百回走る。書き込み系（recordMeaningResult など）は描画パスの外なので、
// 従来どおり毎回 localStorage から読み直してから保存する（古いコピーでの上書きを避ける）。
let progressReadCache = null;
function withProgressReadCache(fn) {
  const outer = progressReadCache; // ネストしても内側で破棄しない
  if (!outer) progressReadCache = new Map();
  try {
    return fn();
  } finally {
    if (!outer) progressReadCache = null;
  }
}
// datasetId のブロックを読み書きする。アクティブ回は state.progress をそのまま使い、
// 別コピーを作らない（renderHome→finalProgress の常時保存が古いコピーで上書きするのを防ぐ）。
function progressFor(datasetId) {
  if (datasetId === state.datasetId) return state.progress;
  if (progressReadCache) {
    if (!progressReadCache.has(datasetId)) progressReadCache.set(datasetId, loadProgress(datasetId));
    return progressReadCache.get(datasetId);
  }
  return loadProgress(datasetId);
}
function saveProgressFor(datasetId, progress) {
  if (datasetId === state.datasetId) { saveProgress(); return; }
  try { localStorage.setItem(progressKey(datasetId), JSON.stringify(progress)); } catch (e) { /* ignore */ }
  if (cloud) cloud.queueSave({
    datasetId,
    progress,
    meta: { lastDatasetId: state.datasetId },
  });
}
function progressKey(datasetId = state.datasetId) {
  return STORE_PREFIX + datasetId;
}
function loadProgress(datasetId = state.datasetId) {
  let raw = null;
  try {
    raw = localStorage.getItem(progressKey(datasetId));
    if (!raw && datasetId === DEFAULT_DATASET_ID) raw = localStorage.getItem(LEGACY_STORE_KEY);
  } catch (e) { return { units: {} }; }
  if (!raw) return { units: {} };
  try {
    const progress = JSON.parse(raw);
    if (!progress || typeof progress !== "object" || Array.isArray(progress)) throw new Error("invalid progress");
    // 旧形式の項目は削除しない。現行フローから参照しなくても、復旧用に元データを残す。
    if (!progress.units || typeof progress.units !== "object" || Array.isArray(progress.units)) {
      progress._recovery = {
        ...(progress._recovery || {}),
        invalidUnits: progress.units,
      };
      progress.units = {};
    }
    return progress;
  } catch (e) {
    // 壊れたJSONを空データとして保存し直さないよう、原文を別キーへ退避する。
    try {
      const backupKey = CORRUPT_PROGRESS_PREFIX + datasetId;
      if (!localStorage.getItem(backupKey)) localStorage.setItem(backupKey, raw);
    } catch (backupError) { /* ignore */ }
    return {
      units: {},
      _recovery: { type: "corrupt-local-record", datasetId },
    };
  }
}

function readStoredObject(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw);
    return value && typeof value === "object" ? value : null;
  } catch (e) {
    return null;
  }
}

let migratedLegacyDatasetIds = [];
function migrateLegacyPre1Progress(legacyStore) {
  migratedLegacyDatasetIds = [];
  if (!legacyStore || typeof legacyStore !== "object" || !legacyStore.rounds) return false;
  let changed = false;
  Object.entries(legacyStore.rounds).forEach(([roundId, oldRound]) => {
    const datasetId = `eikenp1-${roundId}`;
    if (!DATASETS[datasetId] || !oldRound || typeof oldRound !== "object") return;
    const target = loadProgress(datasetId);
    if (target.migrations?.pre1ProgressV1 === PRE1_MIGRATION_VERSION) return;
    if (!target.units || typeof target.units !== "object") target.units = {};

    Object.entries(oldRound.questions || {}).forEach(([key, saved]) => {
      const match = /^reading1:(\d+)$/.exec(key);
      if (!match || !saved || !saved.answered) return;
      const q = Number(match[1]);
      const correct = Boolean(saved.correct);
      const current = target.units[q];
      if (current && current.learned) return;
      target.units[q] = {
        learned: true,
        solvedCorrect: correct,
        needsReview: !correct,
        answerResult: correct ? "correct" : "incorrect",
        attempts: 1,
        wrongCount: correct ? 0 : 1,
        lastAnsweredAt: saved.answeredAt || null,
      };
    });

    if (oldRound.finalCheck && typeof oldRound.finalCheck === "object") {
      target.finalCheck = {
        ...oldRound.finalCheck,
        ...(target.finalCheck || {}),
      };
    }
    target.migrations = {
      ...(target.migrations || {}),
      pre1ProgressV1: PRE1_MIGRATION_VERSION,
      migratedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(progressKey(datasetId), JSON.stringify(target));
      migratedLegacyDatasetIds.push(datasetId);
      changed = true;
    } catch (e) { /* 移行できなくても旧データは残す */ }
  });

  try {
    const currentDatasetId = localStorage.getItem(DATASET_KEY);
    const oldRound = localStorage.getItem(LEGACY_PRE1_ROUND_KEY);
    if (!currentDatasetId && oldRound && DATASETS[`eikenp1-${oldRound}`]) {
      localStorage.setItem(DATASET_KEY, `eikenp1-${oldRound}`);
    }
  } catch (e) { /* ignore */ }
  return changed;
}
function examplesKey(datasetId = state.datasetId) {
  return EXAMPLE_STORE_PREFIX + datasetId;
}
function loadUserExamples(datasetId = state.datasetId) {
  try {
    const raw = localStorage.getItem(examplesKey(datasetId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (e) {
    return {};
  }
}
function saveUserExamples() {
  try {
    localStorage.setItem(examplesKey(), JSON.stringify(state.userExamples));
  } catch (e) { /* ignore */ }
}
function exampleItemKey(item) {
  return `${item.type}:${item.q}:${surfaceOf(item).toLowerCase()}`;
}
function userExampleRecord(item) {
  const key = exampleItemKey(item);
  if (!state.userExamples[key] || typeof state.userExamples[key] !== "object") {
    state.userExamples[key] = { draft: "", feedback: null, updatedAt: null };
  }
  return state.userExamples[key];
}
function saveProgress() {
  try { localStorage.setItem(progressKey(), JSON.stringify(state.progress)); } catch (e) { /* ignore */ }
  if (cloud) cloud.queueSave();
}
function itemSnapshot(item) {
  return item ? { type: item.type, surface: surfaceOf(item), datasetId: item._datasetId || null } : null;
}
// pool省略時は現在の回のみを検索（従来どおり）。級プール済みセッションの再開時は
// pool を渡す。datasetId が付いたスナップショットは同名衝突（例:"coup"）を優先的に厳密一致させ、
// 見つからなければ従来どおり (type, surface) だけで解決する（旧形式のスナップショットとの互換）。
function resolveItem(snapshot, pool) {
  if (!snapshot) return null;
  const candidates = pool || allVocabularyItems();
  if (snapshot.datasetId) {
    const exact = candidates.find((item) => item.type === snapshot.type && surfaceOf(item) === snapshot.surface && item._datasetId === snapshot.datasetId);
    if (exact) return exact;
  }
  return candidates.find((item) => item.type === snapshot.type && surfaceOf(item) === snapshot.surface) || null;
}
function resumeDescription(resume) {
  if (!resume) return "";
  if (resume.mode === "learn") {
    const stage = {
      flash: `STEP 1 暗記カード ${Number(resume.flashIdx || 0) + 1}/${resume.items?.length || 4}`,
      check: `STEP 2 4語句の意味確認 ${Number(resume.checkIdx || 0) + 1}/${resume.checkOrder?.length || 4}`,
      wrongReview: "間違えた語句の復習",
      practice: "STEP 3 本番形式",
      done: "完了確認",
    }[resume.stage] || "学習中";
    return `第${resume.q}問・${stage}`;
  }
  if (resume.mode === "review") return `復習 ${Number(resume.reviewIdx || 0) + 1}/${resume.reviewQueue?.length || 1}（第${resume.q}問）`;
  if (resume.mode === "meaning") {
    const label = resume.dueOnly ? "意味だけ復習" : "全語句の意味確認";
    return `${label} ${Number(resume.checkIdx || 0) + 1}/${resume.checkOrder?.length || 1}`;
  }
  if (resume.mode === "final") return `最終チェック ${Number(resume.checkIdx || 0) + 1}/${resume.checkOrder?.length || 1}`;
  return "学習の続き";
}
function currentResume() {
  const resume = state.progress && state.progress.resume;
  return resume && RESUMABLE_MODES.has(resume.mode) && !resumeUnavailable ? resume : null;
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
    dueOnly: Boolean(session.dueOnly),
    meaningVersion: session.meaningVersion || null,
    meaningBatchSize: session.meaningBatchSize || null,
    practiceAnswered: Boolean(session.practiceAnswered),
    practiceResult: session.practiceResult,
    checkChoices: session._checkChoices || null,
  };
  resumeRecoveryMessage = "";
  resumeUnavailable = false;
  saveProgress();
}
function clearResume() {
  if (!state.progress.resume) return;
  delete state.progress.resume;
  resumeRecoveryMessage = "";
  resumeUnavailable = false;
  saveProgress();
}
async function restoreSession() {
  const saved = state.progress.resume;
  if (!saved || !saved.mode) return false;
  if (!RESUMABLE_MODES.has(saved.mode)) {
    resumeRecoveryMessage = "以前の形式の途中記録は保持しています。現在の学習フローでは、第1問から再開してください。";
    resumeUnavailable = true;
    return false;
  }
  // プール済み「意味だけ演習」を再開する場合のみ、同じ級の全回プールを取得。
  // 取得失敗（オフライン等）は「対象が無い」と区別し、resumeを消さずに諦める。
  let pool = null;
  if (saved.mode === "meaning" && currentGrade()) {
    try {
      pool = (await loadPooledItems()).items;
    } catch (e) {
      return false;
    }
  }
  const items = (saved.items || []).map((s) => resolveItem(s, pool)).filter(Boolean);
  let checkOrder = (saved.checkOrder || []).map((s) => resolveItem(s, pool)).filter(Boolean);
  if ((saved.mode === "learn" && !items.length) || ((saved.mode === "meaning" || saved.mode === "final") && !checkOrder.length)) {
    resumeRecoveryMessage = "途中記録は保持していますが、現在の問題データと一致しないため自動再開できません。第1問から再開してください。";
    resumeUnavailable = true;
    return false;
  }
  if (saved.mode === "meaning" && currentGrade()
    && (saved.meaningVersion !== MEANING_PROGRESS_VERSION
      || saved.meaningBatchSize !== MEANING_SESSION_SIZE
      || checkOrder.length > MEANING_SESSION_SIZE)) {
    return Boolean(await startMeaningPractice(true));
  }
  session = {
    ...saved,
    q: saved.q == null ? null : Number(saved.q),
    items,
    checkOrder,
    reviewQueue: saved.reviewQueue || [],
    wrongLog: (saved.wrongLog || []).map((entry) => ({ item: resolveItem(entry.item, pool), picked: entry.picked })).filter((entry) => entry.item),
    _checkChoices: saved.checkChoices || null,
  };
  resumeRecoveryMessage = "";
  resumeUnavailable = false;
  renderSession();
  resetSessionScroll();
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
  if (!["correct", "incorrect", "unknown", "unseen"].includes(u.answerResult)) {
    u.answerResult = u.solvedCorrect ? "correct" : (u.needsReview ? "incorrect" : (u.learned ? "unknown" : "unseen"));
  }
  return state.progress.units[q];
}
function unitResult(u) {
  if (!u.learned) return "unseen";
  if (u.answerResult === "correct" || u.solvedCorrect) return "correct";
  if (u.answerResult === "incorrect" || u.needsReview) return "incorrect";
  return "unknown";
}

/* ---- 語句単位の進捗（意味だけ練習でのみ使用。既存の units とは別ブロック） ---- */
const LEITNER_LADDER = [1, 3, 7, 14]; // 正解のたびに進む復習間隔（日）
const MEANING_INTERVALS = [
  { days: 0, label: "当日" },
  { days: 1, label: "1日後" },
  { days: 3, label: "3日後" },
  { days: 7, label: "7日後" },
  { days: 14, label: "14日後" },
];
const MEANING_SESSION_SIZE = 30; // 1回に出す語句の上限
const MEANING_PROGRESS_VERSION = 2;
const DEFAULT_ITEM_STATE = Object.freeze({ wrongCount: 0, leitnerStage: 0, nextReviewAt: null, lastAnsweredAt: null });

function itemKeyOf(item) {
  return `${item.type}:${surfaceOf(item).toLowerCase()}`;
}
// 読み取り専用。フィルタ/ソート/件数計算で使う（生成しない＝localStorageを汚さない）。
function readItemState(progress, key) {
  return (progress.items && progress.items[key]) || DEFAULT_ITEM_STATE;
}
// 破壊的。解答を記録する一箇所だけで使う。
function itemState(progress, key) {
  if (!progress.items) progress.items = {};
  if (!progress.items[key]) progress.items[key] = {};
  const s = progress.items[key];
  if (typeof s.wrongCount !== "number") s.wrongCount = 0;
  if (typeof s.leitnerStage !== "number") s.leitnerStage = 0;
  if (typeof s.nextReviewAt !== "string" && s.nextReviewAt !== null) s.nextReviewAt = null;
  if (typeof s.lastAnsweredAt !== "string" && s.lastAnsweredAt !== null) s.lastAnsweredAt = null;
  return s;
}
// 意味だけ演習の解答結果をLeitnerに反映する。item._datasetId があれば本来の回の進捗へ書く。
function recordMeaningResult(item, isCorrect) {
  const datasetId = item._datasetId || state.datasetId;
  const progress = progressFor(datasetId);
  const s = itemState(progress, itemKeyOf(item));
  const answeredAt = new Date();
  s.lastAnsweredAt = answeredAt.toISOString();
  if (isCorrect) {
    const stage = Math.min(s.leitnerStage, LEITNER_LADDER.length - 1);
    const next = new Date(answeredAt);
    next.setDate(next.getDate() + LEITNER_LADDER[stage]);
    s.nextReviewAt = next.toISOString();
    s.leitnerStage = Math.min(stage + 1, LEITNER_LADDER.length - 1);
  } else {
    s.wrongCount += 1;
    s.leitnerStage = 0;
    s.nextReviewAt = null;
  }
  saveProgressFor(datasetId, progress);
}

const FINAL_PASS_RATE = 0.8;

function finalPassScore(finalTotal) {
  return Math.ceil(finalTotal * FINAL_PASS_RATE);
}

function finalProgress(finalTotal) {
  if (!state.progress.finalCheck) state.progress.finalCheck = {};
  const f = state.progress.finalCheck;
  if (typeof f.bestScore !== "number") f.bestScore = 0;
  if (typeof f.lastScore !== "number") f.lastScore = 0;
  if (typeof f.cleared !== "boolean") f.cleared = false;
  let changed = false;
  if (typeof finalTotal === "number" && typeof f.bestTotal !== "number") {
    f.bestTotal = f.cleared ? f.bestScore : finalTotal;
    changed = true;
  }
  // 語彙データが後から増減した場合、以前のCLEAR判定をそのまま引き継がない。
  if (f.cleared && typeof finalTotal === "number" && f.bestTotal !== finalTotal) {
    f.cleared = false;
    changed = true;
  }
  if (!f.cleared && typeof finalTotal === "number"
    && f.bestTotal === finalTotal && f.bestScore >= finalPassScore(finalTotal)) {
    f.cleared = true;
    f.clearedAt = f.clearedAt || new Date().toISOString();
    changed = true;
  }
  if (changed) {
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
let legacyPre1Cloud = null;
let legacyPre1CloudProgress = null;

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

/* ---- 級ごとに全回の語彙を読み込み、通常学習済みだけを意味練習へ回す ---- */
// 級をまたいでも取り違えないよう、プールは級プレフィックスをキーにして持つ。
const pooledPromiseByGrade = new Map(); // grade -> Promise<{items, meaningPool}>
const pooledDataByGrade = new Map();    // grade -> {items, meaningPool}（解決済みのみ）
function gradeDatasetIds(grade) {
  return Object.keys(DATASETS).filter((id) => gradeOf(id) === grade);
}
// 同期的に使える解決済みプール。未読み込み・級不明のときは null。
function pooledData(grade = currentGrade()) {
  return (grade && pooledDataByGrade.get(grade)) || null;
}
async function loadPooledItems(grade = currentGrade()) {
  if (!grade) return { items: [], meaningPool: { word: [], idiom: [] } };
  const cached = pooledDataByGrade.get(grade);
  if (cached) return cached;
  if (!pooledPromiseByGrade.has(grade)) {
    pooledPromiseByGrade.set(grade, Promise.all(
      gradeDatasetIds(grade).map((id) => fetch(DATASETS[id].vocabUrl).then((r) => r.json()).then((vocab) => ({ id, vocab })))
    ).then((loaded) => {
      const items = [];
      const meaningPool = { word: [], idiom: [] };
      for (const { id, vocab } of loaded) {
        const words = (vocab.words || []).map((w) => ({ ...w, type: "word", _datasetId: id }));
        const idioms = (vocab.idioms || []).map((w) => ({ ...w, type: "idiom", _datasetId: id }));
        for (const it of words.concat(idioms)) {
          items.push(it);
          meaningPool[it.type].push(it.meaning);
        }
      }
      return { items, meaningPool };
    }).catch((e) => {
      // 失敗したPromiseを残すと以後ずっと同じ失敗を返すため、再試行できるようにする。
      pooledPromiseByGrade.delete(grade);
      throw e;
    }));
  }
  const data = await pooledPromiseByGrade.get(grade);
  pooledDataByGrade.set(grade, data);
  return data;
}

function isLearnedQuestion(progress, q) {
  return Boolean(progress && progress.units && progress.units[q] && progress.units[q].learned);
}

function learnedPooledItems(items = []) {
  return items.filter((item) => isLearnedQuestion(
    progressFor(item._datasetId || state.datasetId),
    item.q,
  ));
}

function meaningPoolForItems(items) {
  const pool = { word: [], idiom: [] };
  for (const item of items) {
    if (!pool[item.type]) pool[item.type] = [];
    if (item.meaning && !pool[item.type].includes(item.meaning)) pool[item.type].push(item.meaning);
  }
  return pool;
}

// 学習済みだけで誤答を作ると、学習量が少ない段階では候補がその設問の残り語句に
// 固定され、消去法で正解できてしまう。候補が下限に満たない間は同じ級の未学習語の
// 意味で補い、それでも4択に足りなければ別type（word↔idiom）からも補う。
const MEANING_DISTRACTOR_MIN_POOL = 8;

function meaningDistractors(item, count = 3) {
  const pooled = session.mode === "meaning" ? pooledData() : null;
  const learnedPool = pooled ? meaningPoolForItems(learnedPooledItems(pooled.items)) : state.meaningPool;
  const fullPool = pooled ? pooled.meaningPool : state.meaningPool;
  const sameType = (pool) => (pool[item.type] || []).filter((m) => m && m !== item.meaning);
  const otherTypes = (pool) => Object.keys(pool)
    .filter((t) => t !== item.type)
    .reduce((acc, t) => acc.concat(pool[t] || []), [])
    .filter((m) => m && m !== item.meaning);

  const candidates = [];
  const add = (list) => {
    for (const m of list) if (!candidates.includes(m)) candidates.push(m);
  };

  add(sameType(learnedPool));
  if (candidates.length < MEANING_DISTRACTOR_MIN_POOL) add(shuffle(sameType(fullPool)));
  if (candidates.length < count) add(shuffle(otherTypes(fullPool)));
  return shuffle(candidates).slice(0, count);
}

function meaningPracticeSummary() {
  const pooled = pooledData();
  if (!pooled) return { total: 0, learned: 0, due: 0, locked: 0 };
  const learned = learnedPooledItems(pooled.items);
  const due = learned.filter((item) => isItemDue(item));
  return {
    total: pooled.items.length,
    learned: learned.length,
    due: due.length,
    locked: Math.max(0, pooled.items.length - learned.length),
  };
}

// 今回出題される語句を、直前の復習間隔で分類する。
function meaningIntervalLabel(item) {
  const itemState = readItemStateOf(item);
  if (!itemState.lastAnsweredAt || !itemState.nextReviewAt) return "当日";
  const elapsedDays = Math.round(
    (new Date(itemState.nextReviewAt).getTime() - new Date(itemState.lastAnsweredAt).getTime())
      / (24 * 60 * 60 * 1000),
  );
  return MEANING_INTERVALS.find(({ days }) => days === elapsedDays)?.label || "当日";
}

function meaningIntervalBreakdown(items) {
  const counts = Object.fromEntries(MEANING_INTERVALS.map(({ label }) => [label, 0]));
  items.forEach((item) => { counts[meaningIntervalLabel(item)] += 1; });
  const wrap = el("div", {
    class: "meaningMissionIntervals",
    "aria-label": "学習済み語句の復習間隔別内訳",
  });
  wrap.appendChild(el("p", { class: "meaningMissionIntervalsLabel" }, "学習済み語句の復習間隔別内訳"));
  wrap.appendChild(el("p", { class: "meaningMissionIntervalsHelp" },
    `全${items.length}語句の現在の復習間隔です。「今すぐ復習」の件数とは別に集計しています。`,
  ));
  const grid = el("div", { class: "meaningMissionIntervalGrid" });
  MEANING_INTERVALS.forEach(({ label }) => {
    grid.appendChild(el("div", { class: "meaningMissionInterval" },
      el("strong", {}, String(counts[label])),
      el("span", {}, label),
    ));
  });
  wrap.appendChild(grid);
  return wrap;
}
// クラウドから来た進捗（{datasetId: progress}）を localStorage へ反映
function applyCloudProgress(map) {
  if (!map || typeof map !== "object") return;
  const lastDatasetId = map._meta && typeof map._meta.lastDatasetId === "string"
    ? map._meta.lastDatasetId
    : "";
  if (lastDatasetId && DATASETS[lastDatasetId]) {
    try { localStorage.setItem(DATASET_KEY, lastDatasetId); } catch (e) { /* ignore */ }
  }
  Object.entries(map).forEach(([id, prog]) => {
    if (DATASETS[id] && prog && typeof prog === "object") {
      try { localStorage.setItem(progressKey(id), JSON.stringify(prog)); } catch (e) { /* ignore */ }
    }
  });
}
function applyLegacyPre1CloudProgress(value) {
  if (value && typeof value === "object" && value.rounds && typeof value.rounds === "object") {
    legacyPre1CloudProgress = value;
  }
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
function normalizedSurface(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\b(one's|his|her|my|your|our|their|its)\b/g, "@poss")
    .replace(/\s+/g, " ")
    .trim();
}
function audioSlug(value) {
  return normalizedSurface(value).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function vocabularyAudioDataset(item) {
  if (!item || (item.type !== "word" && item.type !== "idiom")) return null;
  const match = DATASET_ID_RE.exec((item._datasetId || state.datasetId) || "");
  return match ? { appGrade: match[1], round: match[2] } : null;
}
function vocabularyAudioPath(item) {
  const dataset = vocabularyAudioDataset(item);
  if (!dataset) return "";
  const audioGrade = GRADE_BY_PREFIX[dataset.appGrade];
  if (!audioGrade) return "";
  const slug = audioSlug(surfaceOf(item));
  if (!slug) return "";
  const folder = item.type === "idiom" ? "/idiom" : "";
  return `assets/audio/vocab/${audioGrade}/${dataset.round}${folder}/${slug}.mp3`;
}
function vocabularyAudioEnabled(item) { return Boolean(vocabularyAudioDataset(item)); }
let activeVocabAudio = null;
let activeVocabButton = null;
let activeVocabSpeech = null;
function resetVocabAudioButton(button) {
  if (!button) return;
  button.disabled = false;
  button.classList.remove("isPlaying");
}
function stopVocabSpeech() {
  if (!activeVocabSpeech) return;
  window.speechSynthesis.cancel();
  resetVocabAudioButton(activeVocabSpeech.button);
  activeVocabSpeech = null;
}
function playVocabSpeech(text, button) {
  if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) {
    button.title = "このブラウザでは音声を再生できません。";
    return;
  }
  if (activeVocabAudio) {
    activeVocabAudio.pause();
    activeVocabAudio.currentTime = 0;
    activeVocabAudio = null;
  }
  resetVocabAudioButton(activeVocabButton);
  stopVocabSpeech();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  activeVocabSpeech = { utterance, button };
  button.disabled = true;
  button.classList.add("isPlaying");
  const finish = () => {
    resetVocabAudioButton(button);
    if (activeVocabSpeech?.utterance === utterance) activeVocabSpeech = null;
  };
  utterance.addEventListener("end", finish, { once: true });
  utterance.addEventListener("error", finish, { once: true });
  window.speechSynthesis.speak(utterance);
}
function playVocabAudio(path, button, text) {
  if (!path) {
    playVocabSpeech(text, button);
    return;
  }
  stopVocabSpeech();
  if (activeVocabAudio) {
    activeVocabAudio.pause();
    activeVocabAudio.currentTime = 0;
  }
  resetVocabAudioButton(activeVocabButton);
  const audio = new Audio(path);
  activeVocabAudio = audio;
  activeVocabButton = button;
  button.disabled = true;
  button.classList.add("isPlaying");
  const finish = () => {
    resetVocabAudioButton(button);
    if (activeVocabAudio === audio) {
      activeVocabAudio = null;
      activeVocabButton = null;
    }
  };
  audio.addEventListener("ended", finish, { once: true });
  audio.addEventListener("error", () => {
    finish();
    button.title = "MP3を読み込めないため、ブラウザ音声を再生します。";
    playVocabSpeech(text, button);
  }, { once: true });
  audio.play().catch(finish);
}
function buildVocabAudioButton(item, className = "flashListenButton") {
  const surface = surfaceOf(item);
  const audioButton = el("button", {
    class: className,
    type: "button",
    "aria-label": `${surface}の発音を聞く`,
    title: "発音を聞く",
  });
  audioButton.appendChild(el("span", { "aria-hidden": "true" }, "▶"));
  audioButton.appendChild(document.createTextNode(" 音声"));
  audioButton.addEventListener("click", () => playVocabAudio(vocabularyAudioPath(item), audioButton, surface));
  return audioButton;
}
function surfaceVariants(value) {
  const base = normalizedSurface(value);
  const variants = new Set([base]);
  if (base.endsWith("ies") && base.length > 3) variants.add(base.slice(0, -3) + "y");
  if (base.endsWith("ied") && base.length > 3) variants.add(base.slice(0, -3) + "y");
  if (base.endsWith("es") && base.length > 3) variants.add(base.slice(0, -2));
  if (base.endsWith("s") && base.length > 2) variants.add(base.slice(0, -1));
  if (base.endsWith("ed") && base.length > 3) {
    const stem = base.slice(0, -2);
    variants.add(stem);
    if (/(.)\1$/.test(stem)) variants.add(stem.slice(0, -1));
    if (stem.endsWith("i")) variants.add(stem.slice(0, -1) + "y");
    variants.add(stem + "e");
  }
  if (base.endsWith("ing") && base.length > 4) {
    const stem = base.slice(0, -3);
    variants.add(stem);
    if (/(.)\1$/.test(stem)) variants.add(stem.slice(0, -1));
    variants.add(stem + "e");
  }
  return variants;
}
function findItemForSurface(items, value) {
  const target = normalizedSurface(value);
  const exact = items.find((item) => normalizedSurface(surfaceOf(item)) === target);
  if (exact) return exact;
  const targetVariants = surfaceVariants(value);
  return items.find((item) => {
    for (const variant of surfaceVariants(surfaceOf(item))) {
      if (targetVariants.has(variant)) return true;
    }
    return false;
  }) || null;
}
// 選んだ誤答の意味が本当はどの語句のものかを逆引き（混同ペアの可視化）
function findOwnerOfMeaning(type, meaning, excludeItem) {
  const pooled = session && session.mode === "meaning" ? pooledData() : null;
  const pool = pooled ? learnedPooledItems(pooled.items) : allVocabularyItems();
  return pool.find((it) => it !== excludeItem && it.type === type && it.meaning === meaning);
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
  resumeRecoveryMessage = "";
  resumeUnavailable = false;
  state.itemsByQ = {};
  state.questions = {};
  state.qList = [];
  state.meaningPool = { word: [], idiom: [] };
  state.progress = loadProgress(datasetId);
  state.userExamples = loadUserExamples(datasetId);
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
  if (cloud) cloud.queueSave();
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
  // 同期処理のみ。await をまたぐとキャッシュが別パスへ漏れるので中で非同期処理を待たない。
  return withProgressReadCache(renderHomeContent);
}
function renderHomeContent() {
  setChromeTitle(`英検${dataset().shortLabel} 大問1 単語アプリ`);
  $("#sessionPanel").classList.add("hide");
  const home = $("#homePanel");
  home.classList.remove("hide");
  home.innerHTML = "";

  const total = state.qList.length;
  const learned = state.qList.filter((q) => unit(q).learned).length;
  const solved = state.qList.filter((q) => unit(q).solvedCorrect).length;
  const unknown = state.qList.filter((q) => unitResult(unit(q)) === "unknown").length;
  const reviewQs = reviewQueue();
  const finalTotal = allVocabularyItems().length;
  const final = finalProgress(finalTotal);
  const currentDataset = dataset();
  // 意味だけ練習のバッジ・ラベル用（finalTotal とは別名。finalProgress の再判定に巻き込まない）。
  const grade = currentGrade();
  // 各級の収録セットの語彙を読み込むが、通常学習済みの設問に属する語句だけを対象にする。
  // ホーム画面を表示中で、かつ級が変わっていないときだけ再描画
  // （学習セッション中や級の切り替え後に、古い級の数字で画面が奪われないようにする）。
  if (grade && !pooledData(grade)) {
    loadPooledItems(grade).then(() => {
      if (currentGrade() === grade && !$("#homePanel").classList.contains("hide")) renderHome();
    }).catch(() => { /* オフライン等。次の描画で再試行する。 */ });
  }
  const pooled = pooledData(grade);
  const meaningSummary = grade ? meaningPracticeSummary() : null;
  const meaningItems = pooled ? learnedPooledItems(pooled.items) : [];
  const meaningQueue = pooled ? meaningPracticeQueue(meaningItems, true) : [];
  const meaningDueCount = meaningSummary ? meaningSummary.due : 0;

  // hero は初回訪問（まだ何も学習していない）時だけ表示し、Today見出しとの説明重複を避ける
  if (learned === 0) {
    home.appendChild(el("section", { class: "card hero" },
      el("p", { class: "label" }, "学習の流れ"),
      el("h2", {}, "大問1の語句を「覚えてから解く」"),
      el("p", { class: "hint" }, "各設問の4つの選択肢を、意味・補足情報で覚える → 意味を確認 → 本番形式で解く、の3ステップ。"),
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
  const grid = el("div", { class: "dailyGrid cols5" });
  grid.appendChild(statCell(learned, total, "学習済み"));
  grid.appendChild(statCell(solved, total, "正解確認済み"));
  grid.appendChild(statCell(unknown, total, "要確認"));
  grid.appendChild(statCell(reviewQs.length, total, "復習対象"));
  grid.appendChild(statCell(final.bestScore, finalTotal, "全語句 BEST"));

  // --- 次にやること（Hickの法則：迷わせないため主導線は常に1つに絞る） ---
  const resume = currentResume();
  const nextQ = state.qList.find((q) => !unit(q).learned);
  const canStartFinal = finalUnlocked();

  if (resume) {
    summary.appendChild(el("div", { class: "resumeNotice" },
      el("p", { class: "label" }, "途中保存"),
      el("p", { class: "resumeText" }, resumeDescription(resume)),
      el("p", { class: "hint" }, "この端末に保存されています。続きから再開できます。"),
    ));
  }
  if (resumeRecoveryMessage) {
    summary.appendChild(el("div", { class: "resumeNotice recoveryNotice" },
      el("p", { class: "label" }, "記録の扱い"),
      el("p", { class: "hint" }, resumeRecoveryMessage),
    ));
  }

  // おすすめ（主導線）＝状態に応じて1つだけ決める。詳細な進捗より先に置く。
  let primary;
  if (resume) {
    primary = {
      label: "続きから再開する",
      why: "前回保存した位置から再開します。",
      onclick: async () => { if (!(await restoreSession())) renderHome(); },
    };
  } else if (nextQ) {
    primary = {
      label: `第${nextQ}問を学習する`,
      why: "暗記カード → 意味確認 → 本番形式の3ステップで進みます。",
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
      why: `全${finalTotal}語の意味を通しで確認。${finalPassScore(finalTotal)}/${finalTotal}問以上（正答率80%以上）でCLEARです。`,
      onclick: startFinalCheck,
    };
  } else if (grade && meaningDueCount > 0) {
    // 1周目の学習・復習・最終チェックが片付いたあとの「戻ってきた日」の主導線。
    // ここが無いと、復習待ちの語句があっても常に「第1問からもう一周」だけが案内される。
    primary = {
      label: `意味だけの復習を始める（今回${Math.min(meaningDueCount, MEANING_SESSION_SIZE)}語句）`,
      why: `今すぐ復習する語句は${meaningDueCount}語句。最大${MEANING_SESSION_SIZE}語句ずつ確認します。`,
      onclick: () => startMeaningPractice(true, meaningQueue),
      isMeaningDue: true,
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

  if (grade) {
    summary.appendChild(meaningMission(meaningSummary, Boolean(pooled), meaningQueue, meaningItems));
  }
  summary.appendChild(el("div", { class: "missionNote" },
    el("p", { class: "hint" }, finalMessage(solved, total, reviewQs.length, final, finalTotal)),
  ));
  const progressDetails = el("details", { class: "progressDetails" },
    el("summary", { class: "progressDetailsSummary" }, "進捗の詳細"),
  );
  progressDetails.appendChild(grid);
  summary.appendChild(progressDetails);
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
    const result = unitResult(u);
    const items = state.itemsByQ[q];
    const isIdiom = items[0].type === "idiom";
    const words = items.map(surfaceOf).join(" / ");
    const cls = "qCard" + (u.needsReview ? " review" : (result === "correct" ? " done" : (result === "unknown" ? " unknown" : "")));
    const stat = u.needsReview
      ? `復習対象・ミス${u.wrongCount}回`
      : (result === "correct" ? "学習済み・正解確認済み" : (result === "unknown" ? "学習済み・要確認" : "未学習"));
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

function meaningMission(summary, ready, nextQueue = [], learnedItems = []) {
  const total = summary.total;
  const learned = summary.learned;
  const due = summary.due;
  const batch = nextQueue.length || Math.min(due, MEANING_SESSION_SIZE);
  const remaining = Math.max(0, due - batch);
  const mission = el("div", { class: "meaningMission" });
  const head = el("div", { class: "meaningMissionHead" },
    el("div", {},
      el("p", { class: "label" }, "中心学習"),
      el("h3", {}, "学習済みの語句を、意味だけ復習"),
    ),
    el("span", { class: "meaningMissionBadge" }, ready ? `対象 ${learned} / ${total}語句` : "対象を確認中"),
  );
  mission.appendChild(head);
  mission.appendChild(el("p", { class: "meaningMissionLead" },
    `通常学習で最後まで解いた設問の4語句だけが対象です。${dataset().shortLabel}の収録セットをまとめ、復習期限が来た語句から1回に最大${MEANING_SESSION_SIZE}語句を出題します。`,
  ));

  const metrics = el("div", { class: "meaningMissionMetrics" },
    el("div", {}, el("strong", {}, ready ? `${learned} / ${total}` : "—"), el("span", {}, "学習済み対象")),
    el("div", { class: due > 0 ? "meaningMissionMetricDue" : "" }, el("strong", {}, ready ? `${due}語句` : "—"), el("span", {}, "今すぐ復習")),
    el("div", {}, el("strong", {}, ready ? `${batch}語句` : "—"), el("span", {}, "今回の1回分")),
    el("div", {}, el("strong", {}, ready ? `${summary.locked}語句` : "—"), el("span", {}, "未解放")),
  );
  mission.appendChild(metrics);
  if (ready && learnedItems.length) mission.appendChild(meaningIntervalBreakdown(learnedItems));

  const progress = el("progress", {
    class: "meaningMissionProgress",
    max: Math.max(1, total),
    value: learned,
    "aria-label": `${dataset().shortLabel}の意味だけ復習対象語句数`,
  });
  progress.setAttribute("aria-valuetext", ready ? `学習済み対象 ${learned}語句 / 全${total}語句` : "対象語句を確認中");
  mission.appendChild(progress);

  const buttonAttrs = { class: "cta secondaryCta meaningMissionCta", type: "button" };
  let buttonLabel = "対象を確認中…";
  let note = "通常学習を進めると、ここに語句が追加されます。";
  if (ready && learned === 0) {
    buttonLabel = "第1問を学習すると開始できます";
    note = "まだ意味練習の対象はありません。まず通常学習で設問を解いてください。";
  } else if (ready && due === 0) {
    buttonLabel = "今すぐ復習する語句はありません";
    note = "復習期限が来た語句はありません。次の復習日にまた表示されます。";
  } else if (ready) {
    buttonLabel = `今回の${batch}語句を練習する`;
    note = remaining > 0
      ? `今すぐ復習する${due}語句のうち、今回は${batch}語句を出題します。残り${remaining}語句は次の回に回ります。`
      : `今すぐ復習する語句は${due}語句です。正解した語句は復習間隔に沿って次回へ回ります。`;
    buttonAttrs.onclick = () => startMeaningPractice(true, nextQueue);
  }
  if (!buttonAttrs.onclick) buttonAttrs.disabled = "disabled";
  mission.appendChild(el("button", buttonAttrs, buttonLabel));
  mission.appendChild(el("p", { class: "meaningMissionNote" }, note));
  return mission;
}

function datasetGrades() {
  const grades = [];
  for (const [id] of availableDatasets()) {
    const grade = gradeOf(id);
    if (grade && !grades.includes(grade)) grades.push(grade);
  }
  return grades;
}

function datasetGradeLabel(grade) {
  const entry = availableDatasets().find(([id]) => gradeOf(id) === grade);
  return entry ? entry[1].shortLabel : grade;
}

function datasetSetKind(datasetId) {
  return datasetId.includes("-mock-") ? "模試" : "過去問";
}

function datasetSetLabel(datasetId, data) {
  const prefix = `英検${data.shortLabel || ""}`;
  let label = String(data.label || "");
  if (prefix && label.startsWith(prefix)) label = label.slice(prefix.length).trim();
  if (datasetSetKind(datasetId) === "模試") label = label.replace(/^模試\s*/, "");
  return label || data.label || datasetId;
}

function datasetPicker() {
  const entries = availableDatasets();
  const grades = datasetGrades();
  let pickerGrade = currentGrade() || grades[0];
  const wrap = el("div", { class: "datasetPicker" });
  const current = el("p", { class: "datasetPickerCurrent", "aria-live": "polite" });
  const gradeChoices = el("div", {
    class: "datasetGradeChoices",
    role: "group",
    "aria-label": "級を選ぶ",
  });
  const setField = el("label", { class: "datasetSetField" },
    el("span", { class: "fieldLabel" }, "回を選ぶ"),
  );
  const select = el("select", { class: "datasetSelect" });

  function renderOptions() {
    select.innerHTML = "";
    const currentDatasetGrade = currentGrade();
    if (currentDatasetGrade !== pickerGrade) {
      const placeholder = el("option", { value: "" }, `${datasetGradeLabel(pickerGrade)}のセットを選ぶ`);
      placeholder.disabled = "disabled";
      placeholder.selected = true;
      select.appendChild(placeholder);
    }

    for (const kind of ["過去問", "模試"]) {
      const groupEntries = entries.filter(([id]) => gradeOf(id) === pickerGrade && datasetSetKind(id) === kind);
      if (!groupEntries.length) continue;
      const group = el("optgroup", { label: `${datasetGradeLabel(pickerGrade)}・${kind}` });
      for (const [id, data] of groupEntries) {
        const opt = el("option", { value: id }, `${datasetSetLabel(id, data)}${datasetCleared(id) ? " ✅" : ""}`);
        if (id === state.datasetId) opt.selected = true;
        group.appendChild(opt);
      }
      select.appendChild(group);
    }

    if (currentDatasetGrade === pickerGrade) select.value = state.datasetId;
    const currentLabel = `${dataset().label}${datasetCleared(state.datasetId) ? " ✅" : ""}`;
    current.textContent = currentDatasetGrade === pickerGrade
      ? `現在：${currentLabel}`
      : `現在：${currentLabel} ／ ${datasetGradeLabel(pickerGrade)}の回を選ぶと切り替わります`;
  }

  function renderGradeChoices() {
    gradeChoices.innerHTML = "";
    for (const grade of grades) {
      gradeChoices.appendChild(el("button", {
        class: "datasetGradeChoice",
        type: "button",
        "aria-pressed": String(grade === pickerGrade),
        onclick: () => {
          pickerGrade = grade;
          renderGradeChoices();
          renderOptions();
        },
      }, datasetGradeLabel(grade)));
    }
  }

  select.addEventListener("change", (event) => {
    if (event.target.value) switchDataset(event.target.value);
  });
  wrap.appendChild(el("span", { class: "fieldLabel" }, "問題セット"));
  wrap.appendChild(gradeChoices);
  wrap.appendChild(current);
  setField.appendChild(select);
  wrap.appendChild(setField);
  renderGradeChoices();
  renderOptions();
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
  const passScore = finalPassScore(finalTotal);
  if (final.cleared) return `最終チェックを${final.lastScore}/${finalTotal}で突破済みです（${passScore}/${finalTotal}問以上でCLEAR）。`;
  if (!finalUnlocked()) {
    const needs = [];
    if (solved < total) needs.push(`通常ステージをあと${total - solved}問`);
    if (reviewCount) needs.push(`復習対象をあと${reviewCount}問`);
    return `最終チェック解放まで：${needs.join(" / ")}`;
  }
  return final.bestScore
    ? `最終チェック解放中。過去最高は${final.bestScore}/${finalTotal}です。${passScore}/${finalTotal}問以上（正答率80%以上）でCLEAR。`
    : `最終チェック解放中。${finalTotal}問の意味チェックで${passScore}/${finalTotal}問以上（正答率80%以上）を取るとCLEAR。`;
}

/* ============================================================
   LEARN FLOW (per question)
   stages: flash -> check -> practice -> done
   ============================================================ */
let session = null;

function resetSessionScroll() {
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

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
  resetSessionScroll();
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
  resetSessionScroll();
}

// 語句の進捗を、その語句が属する回（item._datasetId、無ければ現在の回）から読み取る。
function readItemStateOf(item) {
  return readItemState(progressFor(item._datasetId || state.datasetId), itemKeyOf(item));
}
function isItemDue(item, now = Date.now()) {
  const itemState = readItemStateOf(item);
  // 旧形式の意味記録には回答時刻がないため、新仕様で一度だけ対象に戻す。
  if (!itemState.lastAnsweredAt) return true;
  const nextReviewAt = itemState.nextReviewAt;
  return !nextReviewAt || new Date(nextReviewAt).getTime() <= now;
}
// 誤答履歴が多い語を前に出す（ES2019以降 Array#sort は安定なので確率抽選は不要）。
function weightedOrder(items) {
  // 比較のたびに進捗を読み直さないよう、シャッフル後の並びで wrongCount を先に取る
  // （同数の並びはシャッフル順のまま＝従来と同じ抽選）。
  const shuffled = shuffle(items);
  const wrongCounts = new Map(shuffled.map((item) => [item, readItemStateOf(item).wrongCount]));
  return shuffled.sort((a, b) => wrongCounts.get(b) - wrongCounts.get(a));
}
// dueOnly=true: 復習日が来た語だけ。未学習語句や次回予定の語句は補充しない。
function meaningPracticeQueue(items, dueOnly) {
  return withProgressReadCache(() => {
    const candidates = dueOnly ? items.filter((it) => isItemDue(it)) : items;
    return weightedOrder(candidates).slice(0, MEANING_SESSION_SIZE);
  });
}

async function startMeaningPractice(dueOnly = true, queueOverride = null) {
  const grade = currentGrade();
  let queue;
  if (grade) {
    let pooled;
    try {
      pooled = await loadPooledItems(grade);
    } catch (e) {
      // オフライン等で収録セットを読めないときは、ホームに戻して次の操作で再試行させる。
      renderHome();
      return false;
    }
    queue = Array.isArray(queueOverride)
      ? queueOverride
      // await をまたがない同期ブロックとしてまとめて読む
      : withProgressReadCache(() => meaningPracticeQueue(learnedPooledItems(pooled.items), dueOnly));
  } else {
    // 級を判定できないdatasetIdへの保険。現在の回の語句だけで組む。
    queue = shuffle(allVocabularyItems()).slice(0, MEANING_SESSION_SIZE);
  }
  if (!queue.length) {
    renderHome();
    return false;
  }
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
    dueOnly: Boolean(grade) && dueOnly,
    meaningVersion: grade ? MEANING_PROGRESS_VERSION : null,
    meaningBatchSize: grade ? MEANING_SESSION_SIZE : null,
  };
  renderSession();
  resetSessionScroll();
  return true;
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
  resetSessionScroll();
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
       el("p", { class: "sessionState" }, "現在地はこの端末に保存済み"),
     ),
    el("button", { class: "ghost", onclick: () => { saveResume(); renderHome(); } }, "一覧へ戻る"),
  ));

  // stage bar
  if (isFinal) panel.appendChild(finalBar());
  else if (isMeaning) panel.appendChild(meaningBar());
  else if (isReview) panel.appendChild(reviewBar());
  else panel.appendChild(stageBar(session.stage));
  panel.appendChild(questionProgressBar());

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
  if (isMeaning) {
    const label = "意味だけ復習";
    return `${label} ${session.checkIdx + 1} / ${session.checkOrder.length}`;
  }
  if (isReview) return `復習演習 ${session.reviewIdx + 1} / ${session.reviewQueue.length}`;
  return `第${q}問 ・ ${isIdiom ? "熟語" : "単語"}`;
}

function stageTitle(stage) {
  if (session && session.mode === "final") return `最終チェック${session.checkOrder.length}問`;
  if (session && session.mode === "meaning") return `意味だけの復習（最大${MEANING_SESSION_SIZE}語句）`;
  if (session && session.mode === "review") return "間違えた問題を演習";
  return {
    flash: "STEP 1　覚える（暗記カード）",
    check: "STEP 2　確かめる（4語句の意味確認）",
    wrongReview: "間違えた語句を復習",
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
  const answered = session.checkIdx + (session.checkAnswered ? 1 : 0);
  const remaining = Math.max(0, session.checkOrder.length - answered);
  return el("div", { class: "stageBar meaningBar" },
    el("div", { class: "stagePill active" },
      answered ? `残り ${remaining}語句` : `今回 ${session.checkOrder.length}語句`),
    el("div", { class: "stagePill" },
      `回答済 ${answered} / 正解 ${session.meaningCorrect}`),
  );
}

function refreshMeaningBar() {
  if (!session || session.mode !== "meaning") return;
  const bar = document.querySelector("#sessionPanel .meaningBar");
  if (!bar) return;
  const answered = session.checkIdx + (session.checkAnswered ? 1 : 0);
  const remaining = Math.max(0, session.checkOrder.length - answered);
  const pills = bar.querySelectorAll(".stagePill");
  if (pills[0]) pills[0].textContent = answered ? `残り ${remaining}語句` : `今回 ${session.checkOrder.length}語句`;
  if (pills[1]) pills[1].textContent = `回答済 ${answered} / 正解 ${session.meaningCorrect}`;
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
  const bar = el("div", { class: "stageBar", role: "list", "aria-label": "学習ステップ" });
  order.forEach((s, i) => {
    let cls = "stagePill";
    if (stage === "done" || i < cur) cls += " cleared";
    if (s === stage) cls += " active";
    bar.appendChild(el("div", { class: cls, role: "listitem", "aria-current": s === stage ? "step" : "false" }, labels[s]));
  });
  return bar;
}

function questionProgressBar() {
  const total = state.qList.length;
  if (!total) return el("div", { class: "q1Progress hide" });

  if (session.mode === "meaning" && currentGrade()) return meaningProgressBar();

  const isQuestionSession = session.q != null;
  const current = isQuestionSession
    ? Math.max(1, state.qList.indexOf(session.q) + 1)
    : state.qList.filter((q) => unit(q).learned).length;
  const value = Math.min(total, current);
  const remaining = Math.max(0, total - value);
  const label = isQuestionSession ? `第${value}問 / ${total}問` : `学習済み ${value} / ${total}問`;

  const wrap = el("div", { class: "q1Progress" },
    el("div", { class: "q1ProgressHead" },
      el("span", { class: "label" }, "大問1 設問進捗"),
      el("strong", { class: "q1ProgressValue" }, label),
      el("span", { class: "q1ProgressRemaining" }, `残り${remaining}問`),
    ),
  );
  const progress = el("progress", {
    class: "q1ProgressBar",
    max: total,
    value,
    "aria-label": "大問1の設問進捗",
  });
  progress.setAttribute("aria-valuetext", `${label}、残り${remaining}問`);
  wrap.appendChild(progress);
  return wrap;
}

function meaningProgressBar() {
  const summary = meaningPracticeSummary();
  const total = summary.total;
  if (!total) return el("div", { class: "q1Progress hide" });
  const remaining = Math.max(0, total - summary.learned);
  const label = `対象 ${summary.learned} / ${total}語句`;
  const wrap = el("div", { class: "q1Progress meaningProgress" },
    el("div", { class: "q1ProgressHead" },
      el("span", { class: "label" }, "意味練習の解放状況"),
      el("strong", { class: "q1ProgressValue" }, label),
      el("span", { class: "q1ProgressRemaining" }, `未解放${remaining}語句`),
    ),
  );
  const progress = el("progress", {
    class: "q1ProgressBar",
    max: total,
    value: summary.learned,
    "aria-label": `${dataset().shortLabel}の意味練習対象語句の解放状況`,
  });
  progress.setAttribute("aria-valuetext", `${label}、未解放${remaining}語句`);
  wrap.appendChild(progress);
  return wrap;
}

/* ---- STEP 1: flashcards ---- */
function buildFlashCard(item) {
  const card = el("div", { class: "flash" });
  const head = el("div", { class: "flashHead" });
  const surface = surfaceOf(item);
  const wordLine = el("div", { class: "flashWordLine" },
    el("div", { class: "flashWord" }, surface),
  );
  if (item.ipa) wordLine.appendChild(el("div", { class: "flashIpa" }, item.ipa));
  if (vocabularyAudioEnabled(item)) {
    wordLine.appendChild(buildVocabAudioButton(item));
  }
  head.appendChild(el("div", {},
    wordLine,
    el("div", { class: "flashPos" }, item.pos || ""),
  ));
  card.appendChild(head);

  const inner = el("div", { class: "flashBody" });
  inner.appendChild(flashRow("意味", item.meaning, "flashMeaning"));
  if (item.etymology) inner.appendChild(flashRow("語源・なりたち", item.etymology, "flashEtym"));
  if (item.example) inner.appendChild(flashExampleRow(item));
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
  if (item.exampleTranslation) {
    row.appendChild(el("p", { class: "flashExampleTranslation" },
      el("span", { class: "flashExampleTranslationLabel" }, "日本語訳"),
      document.createTextNode(item.exampleTranslation),
    ));
  }
  return row;
}

function flashRelatedRow(item) {
  const row = el("div", { class: "flashRow flashRelated" });
  row.appendChild(el("strong", {}, "関連語"));
  const list = el("div", { class: "relatedWordList" });
  item.relatedWords.forEach((related) => {
    const relation = related.relation === "word_family" ? "語族" : (related.relation || "関連語");
    const chip = el("div", { class: "relatedWord" },
      el("span", { class: "relatedWordSurface" }, related.word || ""),
      el("span", { class: "relatedWordMeaning" }, `${related.meaning || ""}（${relation}）`),
    );
    list.appendChild(chip);
  });
  row.appendChild(list);
  return row;
}

function countEnglishWords(text) {
  return String(text || "").trim().split(/\s+/).filter(Boolean).length;
}

function validateSelfExample(item, sentence) {
  const text = String(sentence || "").trim();
  if (!text) return "まず自作英文を入力してください。";
  if (text.length > 280) return "英文は280文字以内で入力してください。";
  const target = surfaceOf(item).toLowerCase();
  if (!text.toLowerCase().includes(target)) return `「${surfaceOf(item)}」を含む英文にしてください。`;
  return "";
}

function renderSelfExampleFeedback(host, feedback) {
  host.innerHTML = "";
  if (!feedback) return;
  const verdict = feedback.verdict === "ok" ? "ok" : "revise";
  const title = verdict === "ok" ? "使い方を確認しました" : "少し見直してみましょう";
  const box = el("div", { class: `selfExampleFeedback ${verdict}`, role: "status" },
    el("p", { class: "selfExampleFeedbackTitle" }, title),
  );
  if (feedback.meaningFit) box.appendChild(el("p", {}, `意味との一致：${feedback.meaningFit === "good" ? "よく合っています" : "要確認"}`));
  if (feedback.grammar?.status) box.appendChild(el("p", {}, `文法：${feedback.grammar.status === "ok" ? "問題ありません" : "要確認"}`));
  if (feedback.explanationJa) box.appendChild(el("p", { class: "selfExampleFeedbackText" }, feedback.explanationJa));
  if (feedback.suggestedSentence) {
    box.appendChild(el("p", { class: "selfExampleSuggestionLabel" }, "より自然な例"));
    box.appendChild(el("p", { class: "selfExampleSuggestion" }, feedback.suggestedSentence));
  }
  if (feedback.nextHint) box.appendChild(el("p", { class: "selfExampleFeedbackText" }, `次の一手：${feedback.nextHint}`));
  host.appendChild(box);
}

async function checkSelfExample(item, textarea, checkButton, status, feedbackHost) {
  const sentence = textarea.value.trim();
  const validationMessage = validateSelfExample(item, sentence);
  if (validationMessage) {
    status.textContent = validationMessage;
    status.className = "selfExampleStatus ng";
    return;
  }
  if (!aiCheckEndpoint) {
    status.textContent = "AIチェックの接続設定がまだありません。下書きは保存できます。";
    status.className = "selfExampleStatus";
    return;
  }

  const record = userExampleRecord(item);
  record.draft = sentence;
  record.feedback = null;
  record.updatedAt = new Date().toISOString();
  saveUserExamples();
  checkButton.disabled = true;
  status.textContent = "AIが英文を確認しています…";
  status.className = "selfExampleStatus";
  feedbackHost.innerHTML = "";
  try {
    const response = await fetch(aiCheckEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        word: surfaceOf(item),
        meaning: item.meaning,
        partOfSpeech: item.pos || "",
        sentence,
        learnerLevel: dataset().shortLabel,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.feedback) throw new Error(payload.error || `HTTP ${response.status}`);
    record.feedback = payload.feedback;
    record.checkedAt = new Date().toISOString();
    saveUserExamples();
    renderSelfExampleFeedback(feedbackHost, record.feedback);
    status.textContent = "チェック結果を保存しました。";
    status.className = "selfExampleStatus ok";
  } catch (error) {
    status.textContent = "AIチェックに失敗しました。下書きは保存されています。";
    status.className = "selfExampleStatus ng";
    console.error(error);
  } finally {
    checkButton.disabled = false;
  }
}

function buildSelfExamplePanel(item) {
  const record = userExampleRecord(item);
  const panel = el("section", { class: "selfExamplePanel", "aria-labelledby": `self-example-${item.q}` });
  panel.appendChild(el("div", { class: "selfExampleHead" },
    el("div", {},
      el("p", { class: "label" }, "OUTPUT PRACTICE"),
      el("h3", { id: `self-example-${item.q}` }, "自作英文を作る"),
    ),
    el("span", { class: "selfExampleTag" }, "任意・保存できます"),
  ));
  panel.appendChild(el("p", { class: "selfExamplePrompt" }, `「${surfaceOf(item)}」を使って、あなた自身の英文を1文作ってみましょう。`));
  const textareaId = `self-example-input-${item.q}`;
  const label = el("label", { class: "fieldLabel", for: textareaId }, "自作英文");
  const textarea = el("textarea", {
    id: textareaId,
    rows: "4",
    maxlength: "280",
    placeholder: `例：I used ${surfaceOf(item)} to explain the idea.`,
  });
  textarea.value = record.draft || "";
  label.appendChild(textarea);
  panel.appendChild(label);
  const status = el("p", { class: "selfExampleStatus", role: "status", "aria-live": "polite" });
  const count = el("span", { class: "selfExampleCount" }, `${countEnglishWords(record.draft)} words`);
  const meta = el("div", { class: "selfExampleMeta" }, count, status);
  panel.appendChild(meta);
  const feedbackHost = el("div", { class: "selfExampleFeedbackHost" });
  renderSelfExampleFeedback(feedbackHost, record.feedback);
  panel.appendChild(feedbackHost);
  const saveButton = el("button", { class: "ghost", type: "button" }, "下書きを保存");
  const checkAttrs = { class: "cta", type: "button" };
  if (!aiCheckEndpoint) checkAttrs.disabled = "disabled";
  const checkButton = el("button", checkAttrs, aiCheckEndpoint ? "AIでチェック" : "AIチェックは未設定");
  const actions = el("div", { class: "selfExampleActions" }, saveButton, checkButton);
  panel.appendChild(actions);
  if (!aiCheckEndpoint) panel.appendChild(el("p", { class: "hint selfExampleUnavailable" }, "AI接続後にチェックが使えるようになります。下書き保存は利用できます。"));

  function saveDraft() {
    const current = userExampleRecord(item);
    current.draft = textarea.value;
    current.updatedAt = new Date().toISOString();
    saveUserExamples();
    status.textContent = "下書きを保存しました。";
    status.className = "selfExampleStatus ok";
  }
  textarea.addEventListener("input", () => {
    const current = userExampleRecord(item);
    current.draft = textarea.value;
    current.feedback = null;
    current.updatedAt = new Date().toISOString();
    saveUserExamples();
    count.textContent = `${countEnglishWords(textarea.value)} words`;
    feedbackHost.innerHTML = "";
    status.textContent = "入力を保存中";
    status.className = "selfExampleStatus";
  });
  saveButton.addEventListener("click", saveDraft);
  checkButton.addEventListener("click", () => checkSelfExample(item, textarea, checkButton, status, feedbackHost));
  return panel;
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

  body.appendChild(el("div", { class: "roundInfo" }, `4語句の意味確認 ${session.checkIdx + 1} / ${session.checkOrder.length}`));

  const box = el("div", { class: "quizBox" });
  box.appendChild(el("p", { class: "label" }, "次の語句の意味は？"));
  box.appendChild(el("div", { class: "askWordLine" },
    el("p", { class: "askWord" }, surface),
    buildVocabAudioButton(item, "quizListenButton"),
  ));

  // choices: correct meaning + 3 distractors of same type
  if (!session._checkChoices) {
    session._checkChoices = shuffle([item.meaning, ...meaningDistractors(item)]);
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
      if (session.mode === "meaning" && currentGrade()) recordMeaningResult(item, isCorrect);
      saveResume();
      refreshMeaningBar();
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
  const fb = el("div", { class: "feedback checkFeedback " + (isCorrect ? "ok" : "ng"), role: "status", "aria-live": "polite" },
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
  const nextLabel = afterCheckDestination() === "done" ? "結果を見る →" : "本番形式の問題へ →";
  const lockedNextLabel = afterCheckDestination() === "done"
    ? "すべて確認すると結果へ →"
    : "すべて確認すると本番形式へ →";

  body.appendChild(el("p", { class: "hint" }, "間違えた語句を確認してください。読み終えたら「確認した」を押してください。"));

  const listWrap = el("div", { class: "wrongReview" });
  const hint = el("p", {
    id: "wrongReviewProgress",
    class: "hint reviewCountHint",
    role: "status",
    "aria-live": "polite",
  });
  const nextBtn = el("button", {
    class: "cta",
    disabled: "disabled",
    "aria-describedby": "wrongReviewProgress",
    onclick: () => {
      session.wrongReviewed = true;
      session.stage = afterCheckDestination();
      renderSession();
    },
  }, lockedNextLabel);
  const updateReviewState = () => {
    const remaining = log.length - checked.size;
    const complete = remaining === 0;
    hint.textContent = complete
      ? `復習 ${log.length}/${log.length}語を確認済み`
      : `復習 ${checked.size}/${log.length}語を確認済み（残り${remaining}語）`;
    nextBtn.disabled = !complete;
    nextBtn.textContent = complete ? nextLabel : lockedNextLabel;
  };
  updateReviewState();

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
      updateReviewState();
    });
    card.appendChild(checkBtn);
    listWrap.appendChild(card);
  });

  body.appendChild(hint);
  body.appendChild(listWrap);
  body.appendChild(el("div", { class: "actions" }, nextBtn));
}

function saveFinalResult() {
  const finalTotal = session.checkOrder.length;
  const f = finalProgress(finalTotal);
  f.lastScore = session.finalCorrect;
  f.bestScore = Math.max(f.bestScore, session.finalCorrect);
  f.bestTotal = finalTotal;
  f.lastTriedAt = new Date().toISOString();
  if (session.finalCorrect >= finalPassScore(finalTotal)) {
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
    btn.addEventListener("click", () => onPracticeAnswer(i, box, choiceWrap, q_, items));
    choiceWrap.appendChild(btn);
  });
  box.appendChild(choiceWrap);
  body.appendChild(box);
}

function onPracticeAnswer(idx, box, choiceWrap, q_, items) {
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
  const ansItem = findItemForSurface(items, correctWord);

  const fb = el("div", { class: "feedback " + (isCorrect ? "ok" : "ng"), role: "status", "aria-live": "polite" },
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
  u.answerResult = isCorrect ? "correct" : "incorrect";
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
  const meaningSummary = isMeaning && currentGrade() ? meaningPracticeSummary() : null;
  const pendingReviews = !isMeaning && !isFinal && !isReview ? reviewQueue() : [];
  const banner = el("div", { class: "doneBanner" });
  banner.appendChild(el("p", { class: "label", style: "color:rgba(250,249,246,.72)" }, "Step Complete"));
  if (isFinal) {
    const finalTotal = session.checkOrder.length;
    const passed = session.finalCorrect >= finalPassScore(finalTotal);
    banner.appendChild(el("div", { class: "big" }, `${session.finalCorrect} / ${session.checkOrder.length}`));
    banner.appendChild(el("h2", {}, passed
      ? `${dataset().shortLabel} 大問1 CLEAR`
      : `最終チェック完了。${session.finalCorrect}/${session.checkOrder.length}でした`));
    banner.appendChild(el("p", { class: "hint" }, `${finalPassScore(finalTotal)}/${finalTotal}問以上（正答率80%以上）でCLEAR`));
  } else if (isMeaning) {
    banner.appendChild(el("div", { class: "big" }, `${session.meaningCorrect} / ${session.checkOrder.length}`));
    banner.appendChild(el("h2", {}, currentGrade()
      ? `今回の${session.checkOrder.length}語句を完了しました`
      : "意味チェックが完了しました"));
    if (meaningSummary) {
      banner.appendChild(el("p", { class: "hint" },
        `意味だけの復習対象は現在${meaningSummary.learned}/${meaningSummary.total}語句。未解放の語句は通常学習後に追加されます。`,
      ));
    }
  } else {
    banner.appendChild(el("div", { class: "big" }, session.practiceResult ? "正解！" : "復習リストに残しました"));
    banner.appendChild(el("h2", {}, isReview ? `第${q}問の復習演習が完了しました` : `第${q}問の4語句を学習しました`));
    if (!isReview) {
      banner.appendChild(el("p", { class: "hint" },
        `意味確認 ${session.meaningCorrect}/${session.checkOrder.length}・誤答 ${session.wrongLog.length}語`));
      if (pendingReviews.length) {
        banner.appendChild(el("p", { class: "hint" },
          `復習対象が${pendingReviews.length}問あります。下のボタンから確認できます。`));
      }
    }
  }
  body.appendChild(banner);

  const actions = el("div", { class: "actions" });
  if (isFinal) {
    if (session.finalCorrect < finalPassScore(session.checkOrder.length)) {
      actions.appendChild(el("button", { class: "cta finalCta", onclick: startFinalCheck }, `もう一度${session.checkOrder.length}問に挑戦する`));
    }
  } else if (isMeaning) {
    if (meaningSummary && meaningSummary.due > 0) {
      actions.appendChild(el("button", { class: "cta meaningCta", onclick: () => startMeaningPractice(true) },
        `次の意味だけ復習（今回${Math.min(meaningSummary.due, MEANING_SESSION_SIZE)}語句）へ →`));
    } else if (!meaningSummary) {
      actions.appendChild(el("button", { class: "cta meaningCta", onclick: () => startMeaningPractice(session.dueOnly) },
        "もう一度、意味だけの復習をする"));
    }
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
      if (pendingReviews.length) {
        actions.appendChild(el("button", { class: "secondaryCta", onclick: startReview },
          `復習対象を確認する（あと${pendingReviews.length}問） →`));
      }
    } else if (pendingReviews.length) {
      actions.appendChild(el("button", { class: "cta reviewCta", onclick: startReview },
        `復習対象を確認する（あと${pendingReviews.length}問） →`));
    } else if (finalUnlocked() && !finalProgress(allVocabularyItems().length).cleared) {
      actions.appendChild(el("button", { class: "cta finalCta", onclick: startFinalCheck }, "最終チェックへ →"));
    } else {
      actions.appendChild(el("button", { class: "cta", onclick: renderHome }, "次の学習を選ぶ →"));
    }
  }
  actions.appendChild(el("button", {
    class: "ghost",
    onclick: renderHome,
  }, "一覧へ戻る"));
  body.appendChild(actions);
}

/* ============================================================
   boot / mount（kobun-vocab と同じ: 初回のみ boot、以降はタブ復帰で renderHome のみ）
   ============================================================ */
let booted = false;

async function boot() {
  try {
    await loadManifest();
    await loadAiConfig();

    // 旧準1級アプリのクラウド進捗は読み取り専用で一度だけ取り込む。
    legacyPre1Cloud = createCloud({
      appId: LEGACY_PRE1_APP_ID,
      getPayload: () => readStoredObject(LEGACY_PRE1_PROGRESS_KEY) || {},
      applyLoaded: applyLegacyPre1CloudProgress,
      onStatus: () => {},
    });
    await legacyPre1Cloud.init();

    // 生徒別クラウド同期（共有URL ?s=&t= があり、config.json が揃っているときのみ有効）
    cloud = createCloud({
      appId: APP_ID,
      getPayload: collectAllProgress,
      getPatch: () => ({
        datasetId: state.datasetId,
        progress: state.progress,
        meta: { lastDatasetId: state.datasetId },
      }),
      applyLoaded: applyCloudProgress,
      onStatus: setShareStatus,
    });
    await cloud.init();
    applySharedUi();

    const legacyProgress = legacyPre1CloudProgress || readStoredObject(LEGACY_PRE1_PROGRESS_KEY);
    const migratedLegacy = migrateLegacyPre1Progress(legacyProgress);
    state.datasetId = loadDatasetId();
    if (migratedLegacy) {
      migratedLegacyDatasetIds.forEach((datasetId) => {
        cloud.queueSave({
          datasetId,
          progress: loadProgress(datasetId),
          meta: { lastDatasetId: state.datasetId },
        });
      });
    }

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

function handleKey() { /* 大問1モードはキーボード操作なし */ }

return { mount, handleKey };
})();
