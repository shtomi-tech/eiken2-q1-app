"use strict";
/* ============================================================
   英検2級 大問3 演習アプリ
   kobun-vocab と同じ方式で IIFE に閉じ、{ mount, handleKey } のみを公開する。
   共有 #homePanel / #sessionPanel を大問1モードと共用するため、
   本モード表示中の choiceBtn / blank 系スタイルは .q3Session で範囲を絞る。
   ============================================================ */

const EikenQ3App = (function () {

const APP_ID = "eiken2-q3";
const LEGACY_LOCAL_KEY = "eiken2q3.progress.v1";
const STORE_PREFIX = "eiken2q3.progress.";
const DATASET_KEY = "eiken_q3_dataset";
const MANIFEST_URL = "data/manifest.json";
// 問題セット一覧は data/manifest.json（"q3"キー）から読み込む。
// 回を追加するときはデータJSONを置いてmanifest.jsonに1エントリ足すだけでよく、このファイルの編集は不要。
let DATASETS = {};
let DEFAULT_DATASET_ID = null;
async function loadManifest() {
  const manifest = await fetch(MANIFEST_URL, { cache: "no-store" }).then((r) => r.json());
  DATASETS = manifest.q3;
  DEFAULT_DATASET_ID = manifest.defaultDatasetId;
}

const homePanel = document.getElementById("homePanel");
const passagePanel = document.getElementById("sessionPanel");
const shareStatusEl = document.getElementById("shareStatus");

let datasetId = null; // loadManifest() 完了後、boot() 内で loadDatasetId() により確定する
let DATA = null;
let progress = { questions: {}, summaries: {} };
let route = { view: "home" };
let pendingReviewSummaries = [];
const summaryDraftCache = {}; // passageId -> { filledMap, active }
const wordOrderCache = {}; // passageId -> shuffled word list

let cloud = null;

function loadDatasetId() {
  try {
    const id = localStorage.getItem(DATASET_KEY);
    if (id && DATASETS[id]) return id;
  } catch (e) { /* ignore */ }
  return DEFAULT_DATASET_ID;
}
function currentDataset() {
  return DATASETS[datasetId] || DATASETS[DEFAULT_DATASET_ID];
}
function progressKey(id = datasetId) {
  return STORE_PREFIX + id;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function saveLocal() {
  try {
    localStorage.setItem(progressKey(), JSON.stringify(progress));
  } catch (e) {
    /* ignore */
  }
  if (cloud) cloud.queueSave();
}

function loadLocal(id = datasetId) {
  progress = { questions: {}, summaries: {} };
  try {
    let raw = localStorage.getItem(progressKey(id));
    if (!raw && id === DEFAULT_DATASET_ID) raw = localStorage.getItem(LEGACY_LOCAL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        progress = {
          questions: parsed.questions || {},
          summaries: parsed.summaries || {},
          resume: parsed.resume || null,
        };
      }
    }
  } catch (e) {
    /* ignore */
  }
}

function saveResume() {
  if (!route || route.view === "home" || route.view === "completion") return;
  const resume = {
    view: route.view,
    passageId: route.passageId || route.queue?.[route.idx]?.passageId || null,
    questionId: route.view === "practice" && route.queue ? route.queue[route.idx]?.qId : null,
    queue: route.queue || [],
    idx: route.idx || 0,
    isReview: Boolean(route.isReview),
  };
  if (route.view === "practice") {
    resume.practiceUiState = { ...practiceUiState, selectedKeys: practiceUiState.selectedKeys.slice() };
  }
  if (route.view === "summary") {
    const draft = summaryDraftCache[route.passageId];
    if (draft) resume.summaryDraft = { ...draft, filledMap: { ...draft.filledMap } };
    if (wordOrderCache[route.passageId]) {
      resume.wordOrder = [...wordOrderCache[route.passageId]];
    }
  }
  progress.resume = resume;
  saveLocal();
}
function clearResume() {
  if (!progress.resume) return;
  delete progress.resume;
  saveLocal();
}
function resumeDescription(resume) {
  if (!resume) return "";
  if (resume.view === "practice") {
    const item = resume.queue?.[resume.idx];
    const passage = findPassage(resume.passageId || item?.passageId);
    const ui = resume.practiceUiState;
    const step = ui?.step === "evidence"
      ? `根拠選択中（${ui.selectedKeys?.length || 0}文）`
      : ui?.step === "result" ? "結果確認" : "選択肢を選ぶ";
    return `${passage ? passageLabel(passage) + "「" + passage.title + "」" : "文章"}・${item ? "第" + item.qId + "問" : "設問"}・${step}`;
  }
  if (resume.view === "summary") {
    const passage = findPassage(resume.passageId);
    return `${passage ? passageLabel(passage) + "「" + passage.title + "」" : "文章"}・内容整理の続き`;
  }
  return "長文演習の続き";
}
function restoreResume() {
  const saved = progress.resume;
  if (!saved || !saved.view) return false;
  route = {
    view: saved.view,
    passageId: saved.passageId || saved.queue?.[saved.idx || 0]?.passageId || null,
    queue: saved.queue || [],
    idx: Number(saved.idx || 0),
    isReview: Boolean(saved.isReview),
  };
  if (route.view === "practice") {
    const item = route.queue[route.idx];
    if (!item || !findPassage(route.passageId)) {
      clearResume();
      return false;
    }
    if (saved.practiceUiState) {
      practiceUiState = { ...saved.practiceUiState, selectedKeys: saved.practiceUiState.selectedKeys || [] };
    }
    renderPractice();
    return true;
  }
  if (route.view === "summary") {
    if (!findPassage(route.passageId)) {
      clearResume();
      return false;
    }
    if (saved.summaryDraft) {
      summaryDraftCache[route.passageId] = { ...saved.summaryDraft, filledMap: { ...saved.summaryDraft.filledMap } };
    }
    if (Array.isArray(saved.wordOrder)) {
      wordOrderCache[route.passageId] = [...saved.wordOrder];
    }
    renderSummary();
    return true;
  }
  clearResume();
  return false;
}

function findPassage(passageId) {
  return DATA.passages.find((p) => p.id === passageId);
}
function findQuestion(passage, qId) {
  return passage.questions.find((q) => q.q === qId);
}

/* ---------------- stats ---------------- */

function passageStats(passage) {
  const qs = passage.questions;
  let answered = 0, correct = 0, exact = 0;
  qs.forEach((q) => {
    const st = progress.questions[q.q];
    if (st && st.answered) {
      answered++;
      if (st.correct) correct++;
      if (st.evidenceMatch === "exact") exact++;
    }
  });
  const sp = progress.summaries[passage.id];
  const sTotal = passage.summary.blanks.length;
  return {
    qTotal: qs.length, qAnswered: answered, qCorrect: correct, qExact: exact,
    sTotal, sGraded: Boolean(sp && sp.graded), sCorrect: sp ? sp.correctCount || 0 : 0,
  };
}

function wrongQuestionQueue() {
  const out = [];
  DATA.passages.forEach((p) => {
    p.questions.forEach((q) => {
      const st = progress.questions[q.q];
      if (st && st.answered && (!st.correct || st.evidenceMatch !== "exact")) {
        out.push({ passageId: p.id, qId: q.q });
      }
    });
  });
  return out;
}

function wrongSummaryPassageIds() {
  const out = [];
  DATA.passages.forEach((p) => {
    const sp = progress.summaries[p.id];
    if (sp && sp.graded && sp.correctCount < p.summary.blanks.length) out.push(p.id);
  });
  return out;
}

/* ---------------- home ---------------- */

function sharedMode() {
  return Boolean(cloud && cloud.isEnabled());
}

function setChromeTitle(title) {
  const titleEl = document.getElementById("appTitle");
  if (titleEl) titleEl.textContent = title;
  document.title = title;
}

function passageIncomplete(p) {
  return p.questions.some((q) => !(progress.questions[q.q] && progress.questions[q.q].answered));
}
function passageSummaryDone(p) {
  const sp = progress.summaries[p.id];
  return Boolean(sp && sp.graded);
}
function passageLabel(p) {
  return p.part === "A" ? "3A" : "3B";
}

// おすすめ（主導線）＝状態に応じて1つだけ決める（Hickの法則：大問1ホームと同じ考え方）。
// 重要度：復習 → 未完了の文章 → 未実施の内容整理 → 周回。
function computePrimaryAction(reviewCount) {
  if (progress.resume) {
    return {
      label: "続きから再開する",
      why: "前回保存した位置から再開します。",
      onclick: () => { if (!restoreResume()) renderHome(); },
    };
  }
  if (reviewCount > 0) {
    return {
      label: `間違えた${reviewCount}件をまとめて復習する`,
      why: "誤答・根拠不一致の設問と、要復習の内容整理をまとめて解消します。",
      onclick: startReview,
    };
  }
  const incomplete = DATA.passages.find(passageIncomplete);
  if (incomplete) {
    const s = passageStats(incomplete);
    const answeredLabel = s.qAnswered > 0
      ? `続きから解く（${s.qAnswered}/${s.qTotal}問）`
      : `解く（全${s.qTotal}問）`;
    return {
      label: `${passageLabel(incomplete)}「${incomplete.title}」を${answeredLabel}`,
      why: "4択に解答し、根拠だと思う文を本文からタップして選びます。",
      onclick: () => openPractice(incomplete.id),
    };
  }
  const unsummarized = DATA.passages.find((p) => !passageSummaryDone(p));
  if (unsummarized) {
    return {
      label: `${passageLabel(unsummarized)}「${unsummarized.title}」の内容整理に進む`,
      why: "本文を見ながら、要約の空所を埋めます。",
      onclick: () => openSummary(unsummarized.id),
    };
  }
  return {
    label: "最初の文章からもう一周する",
    why: "設問・内容整理を解き直します。",
    onclick: () => openPractice(DATA.passages[0].id),
  };
}

function renderHome() {
  setChromeTitle(`英検${currentDataset().shortLabel} 大問3 演習アプリ`);
  route = { view: "home" };
  passagePanel.classList.add("hide");
  passagePanel.classList.remove("q3Session");
  passagePanel.innerHTML = "";
  homePanel.classList.remove("hide");

  const datasetOptions = Object.entries(DATASETS).map(([id, d]) =>
    `<option value="${id}"${id === datasetId ? " selected" : ""}>${escapeHtml(d.label)}</option>`
  ).join("");
  const datasetPickerHtml = `<label class="datasetPicker">
    <span class="fieldLabel">問題セット</span>
    <select class="datasetSelect" id="q3DatasetSelect">${datasetOptions}</select>
  </label>`;

  const heroHtml = `<section class="card hero">
    <p class="label">学習の流れ</p>
    <h2>長文を読み、根拠を示しながら解く</h2>
    <p class="hint">4択に解答したら、根拠だと思う文を本文からタップして選ぶ。選択肢が合っていても根拠がずれていれば、それも記録される。内容整理では、本文を見ながら日本語の要約の空所を埋める。</p>
  </section>`;

  const wrongQ = wrongQuestionQueue();
  const wrongS = wrongSummaryPassageIds();
  const reviewCount = wrongQ.length + wrongS.length;
  const primary = computePrimaryAction(reviewCount);

  // 問題セット選択の置き場所を大問1（Today/MissionカードのsectionHead右側）と揃える
  const resumeHtml = progress.resume ? `<div class="resumeNotice">
    <p class="label">途中保存</p>
    <p class="resumeText">${escapeHtml(resumeDescription(progress.resume))}</p>
    <p class="hint">この端末に保存されています。続きから再開できます。</p>
  </div>` : "";
  const todayHtml = `<section class="card">
    <div class="sectionHead">
      <div>
        <p class="label">${reviewCount > 0 ? "復習" : "今日の学習"}</p>
        <h2>${escapeHtml(currentDataset().shortLabel)} 大問3を進める</h2>
      </div>
      ${datasetPickerHtml}
    </div>
    ${resumeHtml}
    <div class="recommend">
      <p class="recEyebrow">▶ ${progress.resume ? "続きから" : "まずはここから"}</p>
      <button type="button" class="cta startCta" id="primaryActionBtn">${escapeHtml(primary.label)}</button>
      <p class="recWhy">${escapeHtml(primary.why)}</p>
    </div>
  </section>`;

  const cards = DATA.passages.map((p) => {
    const s = passageStats(p);
    const typeLabel = p.type === "email" ? "Eメール文" : "説明文";
    const summaryLabel = s.sGraded ? `${s.sCorrect}/${s.sTotal} 正解・やり直し` : "未挑戦";
    const practiceLabel = s.qAnswered > 0 ? `${s.qAnswered}/${s.qTotal}問` : `全${s.qTotal}問`;
    return `
      <div class="passageCard">
        <div class="passageInfo">
          <p class="psub">${passageLabel(p)} ・ ${typeLabel}</p>
          <p class="ptitle">${escapeHtml(p.title)}</p>
        </div>
        <div class="passageStatsGrid">
          <div class="passageStatCell">
            <p class="dailyCaption">設問</p>
            <p class="statValue">${s.qAnswered}/${s.qTotal} 解答済み（正解 ${s.qCorrect}・根拠一致 ${s.qExact}）</p>
          </div>
          <div class="passageStatCell">
            <p class="dailyCaption">内容整理</p>
            <p class="statValue">${summaryLabel}</p>
          </div>
        </div>
        <div class="actionRow">
          <button class="cta" type="button" data-action="practice" data-passage="${p.id}">設問を解く（${practiceLabel}）</button>
          <button class="ghost" type="button" data-action="summary" data-passage="${p.id}">内容整理（${summaryLabel}）</button>
        </div>
      </div>`;
  }).join("");

  const passagesHtml = `<section class="card">
    <div class="sectionHead">
      <div>
        <p class="label">文章一覧</p>
        <h2>文章一覧（全${DATA.passages.length}本）</h2>
      </div>
    </div>
    <div class="passageList">${cards}</div>
  </section>`;

  const otherHtml = sharedMode() ? "" : `<section class="card">
    <details class="moreDetails">
      <summary class="label">その他</summary>
      <div class="actions">
        <button class="ghost" id="resetBtn" type="button">進捗リセット</button>
      </div>
    </details>
  </section>`;

  homePanel.innerHTML = `${heroHtml}${todayHtml}${passagesHtml}${otherHtml}`;

  const datasetSelect = document.getElementById("q3DatasetSelect");
  if (datasetSelect) datasetSelect.addEventListener("change", (e) => switchDataset(e.target.value));

  const primaryBtn = document.getElementById("primaryActionBtn");
  if (primaryBtn) primaryBtn.addEventListener("click", primary.onclick);

  homePanel.querySelectorAll('[data-action="practice"]').forEach((btn) => {
    btn.addEventListener("click", () => openPractice(btn.dataset.passage));
  });
  homePanel.querySelectorAll('[data-action="summary"]').forEach((btn) => {
    btn.addEventListener("click", () => openSummary(btn.dataset.passage));
  });
  const resetBtn = document.getElementById("resetBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      if (!confirm("進捗をすべてリセットします。よろしいですか？")) return;
      progress = { questions: {}, summaries: {}, resume: null };
      saveLocal();
      Object.keys(summaryDraftCache).forEach((k) => delete summaryDraftCache[k]);
      renderHome();
    });
  }
}

function openPractice(passageId) {
  const passage = findPassage(passageId);
  const queue = passage.questions.map((q) => ({ passageId, qId: q.q }));
  let idx = queue.findIndex((item) => !progress.questions[item.qId] || !progress.questions[item.qId].answered);
  if (idx < 0) idx = 0;
  clearResume();
  route = { view: "practice", passageId, queue, idx, isReview: false };
  renderPractice();
}

function startReview() {
  const queue = wrongQuestionQueue();
  pendingReviewSummaries = wrongSummaryPassageIds();
  if (queue.length > 0) {
    clearResume();
    route = { view: "practice", passageId: queue[0].passageId, queue, idx: 0, isReview: true };
    renderPractice();
  } else if (pendingReviewSummaries.length > 0) {
    const pid = pendingReviewSummaries.shift();
    openSummary(pid, true);
  }
}

function openSummary(passageId, isReview) {
  delete summaryDraftCache[passageId];
  clearResume();
  route = { view: "summary", passageId, isReview: Boolean(isReview) };
  renderSummary();
}

/* ---------------- shared text panel ---------------- */

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function renderTextPanel(passage, opts) {
  const { evidenceKeys = [], selectedKeys = [], showResult = false, interactive = false, transVisible } = opts || {};

  let header = "";
  if (passage.type === "email" && passage.header) {
    const h = passage.header;
    header = `<div class="emailHeader">
      <div class="row"><span class="k">From</span><span class="v">${escapeHtml(h.from)}</span></div>
      <div class="row"><span class="k">To</span><span class="v">${escapeHtml(h.to)}</span></div>
      <div class="row"><span class="k">Date</span><span class="v">${escapeHtml(h.date)}</span></div>
      <div class="row"><span class="k">Subject</span><span class="v">${escapeHtml(h.subject)}</span></div>
    </div>`;
  } else {
    header = `<p class="articleTitle">${escapeHtml(passage.title)}</p>`;
  }

  const paras = passage.paragraphs.map((para, pi) => {
    const sentHtml = para.sentences.map((s, si) => {
      const key = `${pi}-${si}`;
      const classes = ["sent"];
      if (showResult) {
        if (evidenceKeys.includes(key)) classes.push("evidenceCorrect");
        else if (selectedKeys.includes(key)) classes.push("evidenceMissed");
      } else if (selectedKeys.includes(key)) {
        classes.push("selected");
      }
      if (interactive) {
        return `<button type="button" class="${classes.join(" ")}" data-key="${key}" aria-pressed="${selectedKeys.includes(key)}" aria-label="第${pi + 1}段落の${si + 1}文を根拠として${selectedKeys.includes(key) ? "選択解除" : "選択"}">${escapeHtml(s)} </button>`;
      }
      return `<span class="${classes.join(" ")}" data-key="${key}" data-locked="1">${escapeHtml(s)} </span>`;
    }).join("");
    const transId = `trans-${pi}-${passage.id}`;
    const shown = transVisible === true;
    return `<p class="para">${sentHtml}
      <div class="paraTrans${shown ? "" : " hide"}" id="${transId}">${escapeHtml(para.translation)}</div>
    </p>`;
  }).join("");

  return `<div class="textPanel" id="textPanel">
    ${header}
    ${paras}
    <button class="linkBtn" id="toggleAllTrans" type="button">${transVisible ? "段落の和訳を隠す" : "段落の和訳を表示"}</button>
  </div>`;
}

function bindTextPanelToggle(getVisible, setVisible) {
  const btn = document.getElementById("toggleAllTrans");
  if (!btn) return;
  btn.addEventListener("click", () => {
    const next = !getVisible();
    setVisible(next);
    document.querySelectorAll(".paraTrans").forEach((el) => el.classList.toggle("hide", !next));
    btn.textContent = next ? "段落の和訳を隠す" : "段落の和訳を表示";
  });
}

/* ---------------- practice (question) view ---------------- */

let practiceUiState = { chosenIndex: null, step: "choice", selectedKeys: [], transVisible: false };

function renderPractice() {
  homePanel.classList.add("hide");
  passagePanel.classList.remove("hide");
  passagePanel.classList.add("q3Session");

  const item = route.queue[route.idx];
  const passage = findPassage(item.passageId);
  const question = findQuestion(passage, item.qId);
  const stored = progress.questions[item.qId];
  // 復習モードでは、以前の記録があっても読み取り専用にせず再挑戦させる。
  const isAnswered = !route.isReview && Boolean(stored && stored.answered);
  const savedPassageId = progress.resume?.passageId || progress.resume?.queue?.[progress.resume?.idx || 0]?.passageId;
  const savedResume = progress.resume && progress.resume.view === "practice"
    && savedPassageId === passage.id
    && progress.resume.questionId === question.q;

  practiceUiState = savedResume && progress.resume.practiceUiState
    ? { ...progress.resume.practiceUiState, selectedKeys: progress.resume.practiceUiState.selectedKeys || [] }
    : isAnswered
    ? { chosenIndex: stored.chosenIndex, step: "result", selectedKeys: stored.chosenEvidence || [], transVisible: false }
    : { chosenIndex: null, step: "choice", selectedKeys: [], transVisible: false };

  paintPractice(passage, question, isAnswered, stored);
  saveResume();
}

function evidenceKeysOf(question) {
  const ev = question.evidence;
  return ev.sentences.map((s) => `${ev.paragraph}-${s}`);
}

function paintPractice(passage, question, isAnswered, stored) {
  const evidenceKeys = evidenceKeysOf(question);
  const showResult = practiceUiState.step === "result";

  const textHtml = renderTextPanel(passage, {
    evidenceKeys: showResult ? evidenceKeys : [],
    selectedKeys: practiceUiState.selectedKeys,
    showResult,
    interactive: practiceUiState.step === "evidence",
    transVisible: practiceUiState.transVisible,
  });

  const idxLabel = `${passage.part === "A" ? "3A" : "3B"} ・ 第${question.q}問（${route.idx + 1}/${route.queue.length}）`;

  const choicesHtml = question.choices.map((c, i) => {
    let cls = "choiceBtn";
    let disabled = "";
    if (practiceUiState.step !== "choice") {
      disabled = "disabled";
      if (i === question.answerIndex) cls += " correct";
      else if (i === practiceUiState.chosenIndex) cls += " wrong";
    }
    return `<button type="button" class="${cls}" data-idx="${i}" ${disabled}>
      <span class="key">${i + 1}</span><span>${escapeHtml(c)}</span>
    </button>`;
  }).join("");

  let stepHtml = "";
  if (practiceUiState.step === "evidence") {
    stepHtml = `<div class="evidenceStep">
      <p class="evidenceHint" aria-live="polite">根拠を選ぶ：${practiceUiState.selectedKeys.length}文。本文の文を選択してください（複数可）。</p>
      <div class="navRow evidenceNavRow">
        <button class="ghost" type="button" id="skipEvidenceBtn">根拠を選ばず採点</button>
        <button type="button" id="submitEvidenceBtn">この根拠で答え合わせ</button>
      </div>
    </div>`;
  } else if (showResult) {
    const st = stored || computeResultForCurrentSelection(question);
    stepHtml = `<div class="resultBox ${st.correct ? "ok" : "ng"}">
      <div class="resultLine">
        <span class="tag ${st.correct ? "ok" : "ng"}">${st.correct ? "正解" : "不正解"}</span>
        <span class="tag ${st.evidenceMatch}">根拠: ${st.evidenceMatch === "exact" ? "一致" : st.evidenceMatch === "partial" ? "部分一致" : "不一致"}</span>
      </div>
      <p class="explain">${escapeHtml(question.explanation)}</p>
      <button class="linkBtn" id="toggleQTrans" type="button">設問の和訳を表示</button>
      <div class="translateBox hide" id="qTransBox">${escapeHtml(question.translation)}</div>
    </div>`;
  }

  const isLast = route.idx === route.queue.length - 1;
  const navHtml = `<div class="navRow">
    ${route.idx > 0 ? '<button class="ghost" type="button" id="prevQBtn">前の設問</button>' : "<span></span>"}
    ${showResult ? `<button type="button" id="nextQBtn">${isLast ? "この文章を終える" : "次の設問へ"}</button>` : ""}
  </div>`;

  passagePanel.innerHTML = `<div class="practiceGrid">
    ${textHtml}
    <div class="taskPanel">
      <div class="qMeta"><span class="qNum">${idxLabel}</span><button class="ghost smallGhost" type="button" id="backToHomeBtn">一覧に戻る</button></div>
      <p class="qStem">${escapeHtml(question.stem)}</p>
      <div class="choices">${choicesHtml}</div>
      ${stepHtml}
      ${navHtml}
    </div>
  </div>`;

  bindTextPanelToggle(() => practiceUiState.transVisible, (v) => { practiceUiState.transVisible = v; });

  document.getElementById("backToHomeBtn").addEventListener("click", renderHome);
  const prevBtn = document.getElementById("prevQBtn");
  if (prevBtn) prevBtn.addEventListener("click", () => { route.idx -= 1; renderPractice(); });
  const nextBtn = document.getElementById("nextQBtn");
  if (nextBtn) nextBtn.addEventListener("click", goNextQuestion);

  if (practiceUiState.step === "choice") {
      passagePanel.querySelectorAll(".choiceBtn").forEach((btn) => {
      btn.addEventListener("click", () => {
        practiceUiState.chosenIndex = Number(btn.dataset.idx);
        practiceUiState.step = "evidence";
        saveResume();
        paintPractice(passage, question, isAnswered, stored);
      });
    });
  }

  if (practiceUiState.step === "evidence") {
    passagePanel.querySelectorAll(".sent").forEach((el) => {
      el.addEventListener("click", () => {
        const key = el.dataset.key;
        const i = practiceUiState.selectedKeys.indexOf(key);
        if (i >= 0) practiceUiState.selectedKeys.splice(i, 1);
        else practiceUiState.selectedKeys.push(key);
        saveResume();
        paintPractice(passage, question, isAnswered, stored);
      });
    });
    document.getElementById("skipEvidenceBtn").addEventListener("click", () => finalizeAnswer(passage, question));
    document.getElementById("submitEvidenceBtn").addEventListener("click", () => finalizeAnswer(passage, question));
  }

  if (showResult) {
    const toggleQTrans = document.getElementById("toggleQTrans");
    if (toggleQTrans) {
      toggleQTrans.addEventListener("click", () => {
        const box = document.getElementById("qTransBox");
        const nowHidden = box.classList.toggle("hide");
        toggleQTrans.textContent = nowHidden ? "設問の和訳を表示" : "設問の和訳を隠す";
      });
    }
  }
}

function computeResultForCurrentSelection(question) {
  const evidenceKeys = evidenceKeysOf(question);
  const selected = practiceUiState.selectedKeys;
  const correct = practiceUiState.chosenIndex === question.answerIndex;
  const hit = selected.filter((k) => evidenceKeys.includes(k));
  let evidenceMatch = "miss";
  if (hit.length > 0) {
    const exact = hit.length === evidenceKeys.length && selected.length === evidenceKeys.length;
    evidenceMatch = exact ? "exact" : "partial";
  }
  return { correct, evidenceMatch };
}

function finalizeAnswer(passage, question) {
  const result = computeResultForCurrentSelection(question);
  progress.questions[question.q] = {
    answered: true,
    correct: result.correct,
    chosenIndex: practiceUiState.chosenIndex,
    chosenEvidence: practiceUiState.selectedKeys.slice(),
    evidenceMatch: result.evidenceMatch,
  };
  saveLocal();
  practiceUiState.step = "result";
  saveResume();
  paintPractice(passage, question, true, progress.questions[question.q]);
}

function goNextQuestion() {
  if (route.idx < route.queue.length - 1) {
    route.idx += 1;
    renderPractice();
    return;
  }
  // queue finished
  if (route.isReview && pendingReviewSummaries.length > 0) {
    const pid = pendingReviewSummaries.shift();
    openSummary(pid, true);
    return;
  }
  const passage = findPassage(route.queue[route.queue.length - 1].passageId);
  renderCompletion(passage);
}

function renderCompletion(passage) {
  clearResume();
  route = { view: "completion", passageId: passage.id };
  passagePanel.classList.remove("hide");
  passagePanel.classList.add("q3Session");
  homePanel.classList.add("hide");
  const stats = passageStats(passage);
  const nextSummary = !passageSummaryDone(passage);
  const nextPassage = DATA.passages.find((candidate) => candidate.id !== passage.id && passageIncomplete(candidate));
  const nextAction = nextSummary
    ? `<button type="button" class="cta" id="completionNextBtn">内容整理へ進む</button>`
    : nextPassage
      ? `<button type="button" class="cta" id="completionNextBtn">次の文章へ進む</button>`
      : `<button type="button" class="cta" id="completionNextBtn">文章一覧へ戻る</button>`;
  passagePanel.innerHTML = `<section class="completionCard">
    <p class="label">文章の学習が完了</p>
    <h2>${escapeHtml(passageLabel(passage))}「${escapeHtml(passage.title)}」</h2>
    <p class="completionScore">設問 ${stats.qAnswered}/${stats.qTotal}問・正解 ${stats.qCorrect}問・根拠一致 ${stats.qExact}問</p>
    <p class="hint">${nextSummary ? "次は本文の内容整理です。" : nextPassage ? "次の文章へ進めます。" : "この回の文章をすべて確認しました。"}</p>
    <div class="actions">${nextAction}<button type="button" class="ghost" id="completionHomeBtn">一覧へ戻る</button></div>
  </section>`;
  document.getElementById("completionNextBtn").addEventListener("click", () => {
    if (nextSummary) openSummary(passage.id, false);
    else if (nextPassage) openPractice(nextPassage.id);
    else renderHome();
  });
  document.getElementById("completionHomeBtn").addEventListener("click", renderHome);
}

/* ---------------- summary (content review) view ---------------- */

function renderSummary() {
  homePanel.classList.add("hide");
  passagePanel.classList.remove("hide");
  passagePanel.classList.add("q3Session");

  const passage = findPassage(route.passageId);
  const stored = progress.summaries[passage.id];
  const graded = Boolean(stored && stored.graded);

  if (!summaryDraftCache[passage.id]) {
    const filledMap = {};
    if (stored && stored.filled) Object.assign(filledMap, stored.filled);
    summaryDraftCache[passage.id] = { filledMap, active: null, transVisible: false };
  }
  if (!wordOrderCache[passage.id]) {
    const words = passage.summary.blanks.map((b) => b.answer).concat(passage.summary.distractors);
    wordOrderCache[passage.id] = shuffle(words);
  }

  paintSummary(passage, graded, stored);
  saveResume();
}

function paintSummary(passage, graded, stored) {
  const draft = summaryDraftCache[passage.id];

  const textHtml = renderTextPanel(passage, { transVisible: draft.transVisible });

  const sectionsHtml = passage.summary.sections.map((sec) => {
    const lineHtml = sec.lines.map((line) => {
      const parts = line.map((part) => {
        if (typeof part === "string") return escapeHtml(part);
        const id = part.blank;
        const blankDef = passage.summary.blanks.find((b) => b.id === id);
        const filledText = draft.filledMap[id];
        let cls = "blank";
        let gradedInfo = null;
        if (graded && stored && stored.gradedCorrect) {
          gradedInfo = stored.gradedCorrect[id];
          cls += gradedInfo ? " correct filled" : " wrong filled";
        } else if (filledText) {
          cls += " filled";
        } else {
          cls += " empty";
        }
        if (draft.active === id) cls += " active";
        const lockAttr = graded ? ' data-locked="1"' : "";
        const label = filledText ? escapeHtml(filledText) : `( ${id} )`;
        const ariaLabel = filledText ? `空欄${id}: ${filledText}` : `空欄${id}を選ぶ`;
        const pressedAttr = draft.active === id ? ' aria-pressed="true"' : ' aria-pressed="false"';
        const tag = graded ? "span" : "button";
        const typeAttr = graded ? "" : ' type="button"';
        return `<${tag} class="${cls}" data-blank="${id}"${lockAttr}${typeAttr} aria-label="${escapeHtml(ariaLabel)}"${pressedAttr}>${label}</${tag}>`;
      }).join("");
      return `<p class="sLine">${parts}</p>`;
    }).join("");
    return `<div class="summarySection"><p class="sLabel">${escapeHtml(sec.label)}</p>${lineHtml}</div>`;
  }).join("");

  let revealHtml = "";
  if (graded && stored) {
    const wrongs = passage.summary.blanks.filter((b) => !stored.gradedCorrect[b.id]);
    if (wrongs.length > 0) {
      revealHtml = `<div class="answerReveal">${wrongs.map((b) => `空所${b.id}の正解：${escapeHtml(b.answer)}`).join("<br>")}</div>`;
    }
  }

  const allFilled = passage.summary.blanks.every((b) => draft.filledMap[b.id]);

  const wordsHtml = graded ? "" : `<div class="wordBank">
    ${wordOrderCache[passage.id].map((w) => {
      const usedFor = Object.entries(draft.filledMap).find(([, v]) => v === w);
      const isUsed = Boolean(usedFor);
      return `<button type="button" class="chip${isUsed ? " used" : ""}" data-word="${escapeHtml(w)}" ${isUsed ? "disabled" : ""}>${escapeHtml(w)}</button>`;
    }).join("")}
  </div>`;

  const actionHtml = graded
    ? `<div class="navRow" style="justify-content:flex-end;">
        <div style="display:flex; gap:8px;">
          <button class="ghost" type="button" id="retrySummaryBtn">やり直す</button>
          ${route.isReview && pendingReviewSummaries.length > 0 ? '<button type="button" id="nextReviewBtn">次の復習へ</button>' : ""}
        </div>
      </div>`
    : `<div class="navRow" style="justify-content:flex-end;">
        <button type="button" id="gradeSummaryBtn" ${allFilled ? "" : "disabled"}>採点する（${Object.keys(draft.filledMap).length}/${passage.summary.blanks.length}）</button>
      </div>`;

  passagePanel.innerHTML = `<div class="practiceGrid">
    ${textHtml}
    <div class="taskPanel">
      <div class="qMeta"><span class="qNum">${passage.part === "A" ? "3A" : "3B"} ・ 内容整理（要約穴埋め）</span><button class="ghost smallGhost" type="button" id="backToHomeBtn">一覧に戻る</button></div>
      <p class="hint">本文を見ながら、要約の空所に合う語句を下の語群からタップして埋めてください。</p>
      ${sectionsHtml}
      ${revealHtml}
      ${wordsHtml}
      ${actionHtml}
    </div>
  </div>`;

  bindTextPanelToggle(() => draft.transVisible, (v) => { draft.transVisible = v; });

  document.getElementById("backToHomeBtn").addEventListener("click", renderHome);

  if (!graded) {
    passagePanel.querySelectorAll(".blank").forEach((el) => {
      el.addEventListener("click", () => {
        const id = Number(el.dataset.blank);
        if (draft.filledMap[id]) {
          delete draft.filledMap[id];
          draft.active = null;
        } else {
          draft.active = id;
        }
        saveResume();
        paintSummary(passage, graded, stored);
      });
    });
    passagePanel.querySelectorAll(".chip").forEach((el) => {
      el.addEventListener("click", () => {
        if (draft.active == null) return;
        draft.filledMap[draft.active] = el.dataset.word;
        draft.active = null;
        saveResume();
        paintSummary(passage, graded, stored);
      });
    });
    const gradeBtn = document.getElementById("gradeSummaryBtn");
    if (gradeBtn) gradeBtn.addEventListener("click", () => gradeSummary(passage));
  } else {
    const retryBtn = document.getElementById("retrySummaryBtn");
    if (retryBtn) retryBtn.addEventListener("click", () => {
      delete progress.summaries[passage.id];
      delete summaryDraftCache[passage.id];
      saveLocal();
      openSummary(passage.id, route.isReview);
    });
    const nextReviewBtn = document.getElementById("nextReviewBtn");
    if (nextReviewBtn) nextReviewBtn.addEventListener("click", () => {
      const pid = pendingReviewSummaries.shift();
      openSummary(pid, true);
    });
  }
}

function gradeSummary(passage) {
  const draft = summaryDraftCache[passage.id];
  const gradedCorrect = {};
  let correctCount = 0;
  passage.summary.blanks.forEach((b) => {
    const filled = draft.filledMap[b.id];
    const accepted = b.accepted || [b.answer];
    const ok = accepted.includes(filled);
    gradedCorrect[b.id] = ok;
    if (ok) correctCount++;
  });
  progress.summaries[passage.id] = {
    graded: true,
    attempted: true,
    filled: { ...draft.filledMap },
    gradedCorrect,
    correctCount,
    total: passage.summary.blanks.length,
  };
  saveLocal();
  clearResume();
  paintSummary(passage, true, progress.summaries[passage.id]);
}

/* ---------------- boot ---------------- */

function setShareStatus(message, tone) {
  shareStatusEl.textContent = message || "";
  shareStatusEl.className = "shareStatus" + (tone ? ` ${tone}` : "");
}

async function loadData(id) {
  datasetId = id;
  try { localStorage.setItem(DATASET_KEY, id); } catch (e) { /* ignore */ }
  loadLocal(id);
  const res = await fetch(currentDataset().dataUrl, { cache: "no-store" });
  DATA = await res.json();
}

async function switchDataset(id) {
  if (!DATASETS[id] || id === datasetId) return;
  await loadData(id);
  if (window.EikenActiveAppId !== "q3") return;
  Object.keys(summaryDraftCache).forEach((k) => delete summaryDraftCache[k]);
  Object.keys(wordOrderCache).forEach((k) => delete wordOrderCache[k]);
  renderHome();
}

function collectAllProgress() {
  const map = {};
  Object.keys(DATASETS).forEach((id) => {
    try {
      const raw = localStorage.getItem(progressKey(id));
      if (raw) map[id] = JSON.parse(raw);
    } catch (e) { /* ignore */ }
  });
  map[datasetId] = progress;
  return map;
}

function applyCloudProgress(map) {
  if (!map || typeof map !== "object") return;
  // 旧形式（{questions, summaries} を直接保存していたころ）の互換読み込み。
  if (map.questions || map.summaries) {
    try { localStorage.setItem(progressKey(DEFAULT_DATASET_ID), JSON.stringify(map)); } catch (e) { /* ignore */ }
    return;
  }
  Object.entries(map).forEach(([id, prog]) => {
    if (DATASETS[id] && prog && typeof prog === "object") {
      try { localStorage.setItem(progressKey(id), JSON.stringify(prog)); } catch (e) { /* ignore */ }
    }
  });
}

async function boot() {
  await loadManifest();
  await loadData(loadDatasetId());

  if (typeof createCloud === "function") {
    cloud = createCloud({
      appId: APP_ID,
      configPath: "static/config.json",
      getPayload: () => collectAllProgress(),
      applyLoaded: (loaded) => {
        applyCloudProgress(loaded);
        loadLocal(datasetId);
        if (window.EikenActiveAppId === "q3" && route.view === "home") renderHome();
      },
      onStatus: setShareStatus,
    });
    await cloud.init();
  }

  if (window.EikenActiveAppId === "q3") renderHome();
}

let booted = false;
async function mount() {
  if (booted) { renderHome(); return; }
  booted = true;
  await boot();
}

function startSerial() {
  if (progress.resume && restoreResume()) return;
  const passage = DATA.passages.find(passageIncomplete) || DATA.passages[0];
  if (!passage) {
    renderHome();
    return;
  }
  if (passageIncomplete(passage)) openPractice(passage.id);
  else openSummary(passage.id);
}

function handleKey() { /* 大問3モードはキーボード操作なし */ }

return { mount, handleKey, startSerial };
})();
