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
const DATASETS = {
  "eiken2-2026-1": {
    label: "英検2級 2026年度第1回",
    dataUrl: "data/q3_questions_2026-1.json",
  },
  "eiken2-2025-3": {
    label: "英検2級 2025年度第3回",
    dataUrl: "data/q3_questions_2025-3.json",
  },
  "eiken2-2025-2": {
    label: "英検2級 2025年度第2回",
    dataUrl: "data/q3_questions_2025-2.json",
  },
  "eikenp2-2026-1": {
    label: "英検準2級 2026年度第1回",
    dataUrl: "data/q3_questions_p2_2026-1.json",
  },
  "eikenp2-2025-3": {
    label: "英検準2級 2025年度第3回",
    dataUrl: "data/q3_questions_p2_2025-3.json",
  },
  "eikenp2-2025-2": {
    label: "英検準2級 2025年度第2回",
    dataUrl: "data/q3_questions_p2_2025-2.json",
  },
};
const DEFAULT_DATASET_ID = "eiken2-2026-1";

const homePanel = document.getElementById("homePanel");
const passagePanel = document.getElementById("sessionPanel");
const shareStatusEl = document.getElementById("shareStatus");

let datasetId = loadDatasetId();
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
        };
      }
    }
  } catch (e) {
    /* ignore */
  }
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

function renderHome() {
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
    <p class="label">Reading Comprehension</p>
    <h2>長文を読み、根拠を示しながら解く</h2>
    <p class="hint">4択に解答したら、根拠だと思う文を本文からタップして選ぶ。選択肢が合っていても根拠がずれていれば、それも記録される。内容整理では、本文を見ながら日本語の要約の空所を埋める。</p>
    ${datasetPickerHtml}
  </section>`;

  const wrongQ = wrongQuestionQueue();
  const wrongS = wrongSummaryPassageIds();
  const reviewCount = wrongQ.length + wrongS.length;

  const banner = reviewCount > 0
    ? `<div class="reviewBanner">
        <p>復習が必要な項目が <span class="count">${reviewCount}</span> 件あります（誤答・根拠不一致の設問／要復習の内容整理）。</p>
        <button type="button" id="startReviewBtn">まとめて復習する</button>
      </div>`
    : "";

  const cards = DATA.passages.map((p) => {
    const s = passageStats(p);
    const label = p.part === "A" ? "3A" : "3B";
    const typeLabel = p.type === "email" ? "Eメール文" : "説明文";
    const summaryLabel = s.sGraded ? `${s.sCorrect} / ${s.sTotal} 正解` : "未挑戦";
    return `
      <div class="passageCard">
        <p class="psub">${label} ・ ${typeLabel}</p>
        <p class="ptitle">${escapeHtml(p.title)}</p>
        <div class="statRow">
          <span class="stat">設問: <b>${s.qAnswered}/${s.qTotal}</b> 解答済み（正解 <b>${s.qCorrect}</b>・根拠一致 <b>${s.qExact}</b>）</span>
          <span class="stat">内容整理: <b>${summaryLabel}</b></span>
        </div>
        <div class="actionRow">
          <button type="button" data-action="practice" data-passage="${p.id}">設問演習</button>
          <button class="ghost" type="button" data-action="summary" data-passage="${p.id}">内容整理（要約穴埋め）</button>
        </div>
      </div>`;
  }).join("");

  const otherHtml = sharedMode() ? "" : `<section class="card">
    <details class="moreDetails">
      <summary class="label">その他</summary>
      <div class="actions">
        <button class="ghost" id="resetBtn" type="button">進捗リセット</button>
      </div>
    </details>
  </section>`;

  homePanel.innerHTML = `${heroHtml}${banner}<div class="passageList">${cards}</div>${otherHtml}`;

  const datasetSelect = document.getElementById("q3DatasetSelect");
  if (datasetSelect) datasetSelect.addEventListener("change", (e) => switchDataset(e.target.value));

  const reviewBtn = document.getElementById("startReviewBtn");
  if (reviewBtn) reviewBtn.addEventListener("click", startReview);

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
      progress = { questions: {}, summaries: {} };
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
  route = { view: "practice", queue, idx, isReview: false };
  renderPractice();
}

function startReview() {
  const queue = wrongQuestionQueue();
  pendingReviewSummaries = wrongSummaryPassageIds();
  if (queue.length > 0) {
    route = { view: "practice", queue, idx: 0, isReview: true };
    renderPractice();
  } else if (pendingReviewSummaries.length > 0) {
    const pid = pendingReviewSummaries.shift();
    openSummary(pid, true);
  }
}

function openSummary(passageId, isReview) {
  delete summaryDraftCache[passageId];
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
      const lockAttr = interactive ? "" : ' data-locked="1"';
      return `<span class="${classes.join(" ")}" data-key="${key}"${lockAttr}>${escapeHtml(s)} </span>`;
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

  practiceUiState = isAnswered
    ? { chosenIndex: stored.chosenIndex, step: "result", selectedKeys: stored.chosenEvidence || [], transVisible: false }
    : { chosenIndex: null, step: "choice", selectedKeys: [], transVisible: false };

  paintPractice(passage, question, isAnswered, stored);
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
      <span class="num">${i + 1}</span><span>${escapeHtml(c)}</span>
    </button>`;
  }).join("");

  let stepHtml = "";
  if (practiceUiState.step === "evidence") {
    stepHtml = `<div class="evidenceStep">
      <p class="evidenceHint">根拠だと思う文を本文からタップして選んでください（複数可）。分からなければスキップできます。</p>
      <div class="navRow">
        <button class="ghost" type="button" id="skipEvidenceBtn">スキップ</button>
        <button type="button" id="submitEvidenceBtn">この根拠で答え合わせ</button>
      </div>
    </div>`;
  } else if (showResult) {
    const st = stored || computeResultForCurrentSelection(question);
    stepHtml = `<div class="resultBox">
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
  const navHtml = `<div class="navRow" style="justify-content:flex-end;">
    <div style="display:flex; gap:8px;">
      ${route.idx > 0 ? '<button class="ghost" type="button" id="prevQBtn">前の設問</button>' : ""}
      ${showResult ? `<button type="button" id="nextQBtn">${isLast ? "この文章を終える" : "次の設問へ"}</button>` : ""}
    </div>
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
  renderHome();
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
    if (!wordOrderCache[passage.id]) {
      const words = passage.summary.blanks.map((b) => b.answer).concat(passage.summary.distractors);
      wordOrderCache[passage.id] = shuffle(words);
    }
  }

  paintSummary(passage, graded, stored);
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
        return `<span class="${cls}" data-blank="${id}"${lockAttr}>${label}</span>`;
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
        paintSummary(passage, graded, stored);
      });
    });
    passagePanel.querySelectorAll(".chip").forEach((el) => {
      el.addEventListener("click", () => {
        if (draft.active == null) return;
        draft.filledMap[draft.active] = el.dataset.word;
        draft.active = null;
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
  await loadData(datasetId);

  if (typeof createCloud === "function") {
    cloud = createCloud({
      appId: APP_ID,
      configPath: "static/config.json",
      getPayload: () => collectAllProgress(),
      applyLoaded: (loaded) => {
        applyCloudProgress(loaded);
        loadLocal(datasetId);
        if (route.view === "home") renderHome();
      },
      onStatus: setShareStatus,
    });
    await cloud.init();
  }

  renderHome();
}

let booted = false;
async function mount() {
  if (booted) { renderHome(); return; }
  booted = true;
  await boot();
}

function handleKey() { /* 大問3モードはキーボード操作なし */ }

return { mount, handleKey };
})();
