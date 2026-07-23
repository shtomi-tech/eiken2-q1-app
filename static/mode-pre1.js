"use strict";

/*
 * 英検準1級 過去問モード
 *
 * 準1級は既存の大問1・大問3モードとは出題構成が異なるため、
 * 3回分の一次試験を回・セクション単位で扱う専用モードにする。
 */
const EikenPre1App = (function () {
  const MANIFEST_URL = "data/manifest.json";
  const PROGRESS_KEY = "eiken_pre1_progress_v1";
  const ROUND_KEY = "eiken_pre1_round";
  const RESUME_KEY = "eiken_pre1_resume";
  const APP_ID = "eiken-pre1";
  const homePanel = document.getElementById("homePanel");
  const sessionPanel = document.getElementById("sessionPanel");

  let manifest = null;
  let loading = null;
  const dataCache = {};
  const vocabCache = {};
  let state = {
    roundId: "2026-1",
    data: null,
    sectionId: null,
    index: 0,
    selectedIndex: null,
    resultShown: false,
    writingIndex: 0,
    writingStep: 0,
    listeningMode: "problem",
    vocabStage: "flash",
    flashIdx: 0,
    checkIdx: 0,
    checkOrder: [],
    checkPicked: null,
    checkAnswered: false,
    wrongLog: [],
    wrongChecked: [],
    finalCorrect: 0,
    finalOrder: [],
    finalChoices: null,
    finalAnswerIndex: -1,
    finalPicked: null,
    finalAnswered: false,
    q3Phase: "practice",
    q3Step: "choice",
    q3SelectedIndex: null,
    q3SelectedEvidence: [],
    q3SummaryPassageId: null,
    q3SummaryFilled: {},
    q3SummaryActive: null,
    q3TransVisible: false,
  };
  const audioBlobCache = {};
  const q3WordOrderCache = {};
  let cloud = null;
  let shareStatus = { message: "", tone: "" };

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const value = JSON.parse(raw);
      return value && typeof value === "object" ? value : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function readString(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value == null ? fallback : value;
    } catch (error) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* 匿名ローカル利用を止めない */ }
  }

  function allProgress() {
    const value = readJson(PROGRESS_KEY, {});
    return value && typeof value.rounds === "object" ? value : { version: 1, rounds: {} };
  }

  function ensureRoundProgress(store, roundId = state.roundId) {
    if (!store.rounds[roundId] || typeof store.rounds[roundId] !== "object") {
      store.rounds[roundId] = { questions: {}, writing: {}, summaries: {}, finalCheck: {} };
    }
    if (!store.rounds[roundId].questions || typeof store.rounds[roundId].questions !== "object") store.rounds[roundId].questions = {};
    if (!store.rounds[roundId].writing || typeof store.rounds[roundId].writing !== "object") store.rounds[roundId].writing = {};
    if (!store.rounds[roundId].summaries || typeof store.rounds[roundId].summaries !== "object") store.rounds[roundId].summaries = {};
    if (!store.rounds[roundId].finalCheck || typeof store.rounds[roundId].finalCheck !== "object") store.rounds[roundId].finalCheck = {};
    return store.rounds[roundId];
  }

  function roundProgress(roundId = state.roundId) {
    const store = allProgress();
    return ensureRoundProgress(store, roundId);
  }

  function progressBundle(roundId = state.roundId) {
    const store = allProgress();
    return { store, progress: ensureRoundProgress(store, roundId) };
  }

  function saveProgress(store = allProgress()) {
    store.version = 1;
    ensureRoundProgress(store, state.roundId);
    saveJson(PROGRESS_KEY, store);
    if (cloud) cloud.queueSave();
  }

  function applyCloudProgress(value) {
    if (!value || typeof value !== "object" || !value.rounds || typeof value.rounds !== "object") return;
    saveJson(PROGRESS_KEY, value);
  }

  function setShareStatus(message, tone = "") {
    shareStatus = { message: message || "", tone };
    const slot = document.getElementById("pre1ShareStatus");
    if (!slot) return;
    slot.textContent = shareStatus.message;
    slot.className = `shareStatus${shareStatus.tone ? ` ${shareStatus.tone}` : ""}`;
  }

  function loadResume() {
    const resume = readJson(RESUME_KEY, null);
    if (!resume || !resume.roundId || !resume.sectionId) return null;
    return resume;
  }

  function saveResume() {
    if (!state.sectionId) return;
    saveJson(RESUME_KEY, {
      roundId: state.roundId,
      sectionId: state.sectionId,
      index: state.index,
      selectedIndex: state.selectedIndex,
      resultShown: state.resultShown,
      writingIndex: state.writingIndex,
      writingStep: state.writingStep,
      listeningMode: state.listeningMode,
    });
    saveJson(ROUND_KEY, state.roundId);
  }

  async function ensureLoaded() {
    if (manifest) return manifest;
    if (loading) return loading;
    loading = fetch(MANIFEST_URL, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`${MANIFEST_URL}: HTTP ${response.status}`);
        return response.json();
      })
      .then((value) => {
        if (!value.pre1 || !Array.isArray(value.pre1.rounds)) throw new Error("準1級データの設定がありません");
        manifest = value;
        return manifest;
      })
      .finally(() => { loading = null; });
    return loading;
  }

  function rounds() { return manifest.pre1.rounds; }
  function roundInfo(roundId = state.roundId) { return rounds().find((round) => round.id === roundId) || rounds()[0]; }

  async function loadRound(roundId) {
    if (dataCache[roundId]) return dataCache[roundId];
    const info = roundInfo(roundId);
    const response = await fetch(info.dataUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`${info.dataUrl}: HTTP ${response.status}`);
    const data = await response.json();
    dataCache[roundId] = data;
    return data;
  }

  async function loadVocab(roundId) {
    if (vocabCache[roundId]) return vocabCache[roundId];
    const info = roundInfo(roundId);
    if (!info.vocabUrl) return null;
    const response = await fetch(info.vocabUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`${info.vocabUrl}: HTTP ${response.status}`);
    const data = await response.json();
    vocabCache[roundId] = data.part1;
    return data.part1;
  }

  function shuffle(list) {
    const copy = list.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function mcSections(data) {
    const part3 = [];
    (data.reading.part3 || []).forEach((passage) => {
      passage.questions.forEach((question) => part3.push({ ...question, passage }));
    });
    return [
      { id: "reading1", label: "大問1・語彙", tag: "VOCABULARY", type: "questions", questions: data.reading.part1 || [] },
      { id: "reading2", label: "大問2・空所補充", tag: "CLOZE", type: "questions", questions: data.reading.part2 || [] },
      { id: "writing", label: "ライティング", tag: "WRITING", type: "writing", questions: data.writing || [] },
      { id: "listening", label: "リスニング", tag: "LISTENING", type: "questions", questions: data.listening || [] },
      { id: "reading3", label: "大問3・長文", tag: "READING", type: "questions", questions: part3 },
    ];
  }

  function questionKey(sectionId, question) { return `${sectionId}:${question.q}`; }

  function allVocabItems(roundId = state.roundId) {
    const vocab = vocabCache[roundId] || {};
    return Object.keys(vocab)
      .sort((a, b) => Number(a) - Number(b))
      .flatMap((qKey) => (Array.isArray(vocab[qKey]) ? vocab[qKey] : []).map((item, wordIdx) => ({
        ...item,
        q: Number(qKey),
        wordIdx,
      })));
  }

  function finalPassScore(finalTotal) { return Math.ceil(finalTotal * 0.8); }

  function finalCheckCleared(progress, finalTotal) {
    const final = progress.finalCheck;
    return Boolean(final && final.cleared && final.bestTotal === finalTotal);
  }

  function reading1Stats(section, progress) {
    const answered = section.questions.filter((question) => {
      const saved = progress.questions[questionKey(section.id, question)];
      return saved && saved.answered;
    });
    return {
      done: answered.length,
      total: section.questions.length,
      correct: answered.filter((question) => progress.questions[questionKey(section.id, question)].correct).length,
      finalTotal: allVocabItems().length,
      finalBestScore: Number(progress.finalCheck?.bestScore) || 0,
    };
  }

  function reading1ReadyForFinal(section, progress) {
    const stats = reading1Stats(section, progress);
    return stats.total > 0 && stats.done === stats.total && stats.correct === stats.total && stats.finalTotal > 0;
  }

  function sectionComplete(section) {
    const progress = roundProgress();
    if (section.id === "reading1") {
      const stats = reading1Stats(section, progress);
      return reading1ReadyForFinal(section, progress) && finalCheckCleared(progress, stats.finalTotal);
    }
    if (section.type === "writing") {
      return section.questions.length > 0 && section.questions.every((task) => progress.writing[task.id] && progress.writing[task.id].reviewed);
    }
    const questionsDone = section.questions.length > 0 && section.questions.every((question) => progress.questions[questionKey(section.id, question)] && progress.questions[questionKey(section.id, question)].answered);
    if (section.id !== "reading3" || !questionsDone) return questionsDone;
    const passages = [...new Map(section.questions.map((question) => [question.passage.id, question.passage])).values()];
    return passages.every((passage) => progress.summaries[passage.id] && progress.summaries[passage.id].graded);
  }

  function sectionStats(section) {
    const progress = roundProgress();
    if (section.id === "reading1") return reading1Stats(section, progress);
    if (section.type === "writing") {
      const completed = section.questions.filter((task) => progress.writing[task.id] && progress.writing[task.id].reviewed).length;
      return { done: completed, total: section.questions.length };
    }
    const answered = section.questions.filter((question) => progress.questions[questionKey(section.id, question)] && progress.questions[questionKey(section.id, question)].answered);
    const correct = answered.filter((question) => progress.questions[questionKey(section.id, question)].correct).length;
    return { done: answered.length, total: section.questions.length, correct };
  }

  function roundComplete(data = state.data) {
    return mcSections(data).every(sectionComplete);
  }

  function renderLoading(message) {
    homePanel.className = "pre1Home";
    sessionPanel.className = "hide";
    homePanel.innerHTML = `<div class="card"><p class="loading">${escapeHtml(message)}</p></div>`;
  }

  function setChromeTitle(title) {
    const titleEl = document.getElementById("appTitle");
    if (titleEl) titleEl.textContent = title;
    document.title = title;
  }

  function renderHome() {
    const info = roundInfo();
    const sections = mcSections(state.data);
    const complete = roundComplete(state.data);
    setChromeTitle("英検準1級 過去問演習");
    homePanel.className = "pre1Home";
    sessionPanel.className = "hide";
    const roundOptions = rounds().map((round) => {
      const data = dataCache[round.id];
      const done = data && roundCompleteFor(round.id, data);
      return `<option value="${escapeHtml(round.id)}"${round.id === state.roundId ? " selected" : ""}>${escapeHtml(round.label)}${done ? " ✅" : ""}</option>`;
    }).join("");
    const sectionCards = sections.map((section) => {
      const stats = sectionStats(section);
      const done = sectionComplete(section);
      const score = section.type === "writing"
        ? `${stats.done} / ${stats.total}題`
        : section.id === "reading1"
          ? `${stats.done} / ${stats.total}問・正解 ${stats.correct}問`
          : `${stats.done} / ${stats.total}問`;
      const buttonLabel = done
        ? "復習する"
        : section.id === "reading1" && stats.done === stats.total && stats.correct === stats.total
          ? "最終チェックへ"
          : stats.done
            ? "続きから解く"
            : "始める";
      return `<article class="pre1SectionCard ${done ? "isDone" : ""}">
        <div class="pre1SectionTop"><span class="pre1SectionTag">${escapeHtml(section.tag)}</span><span class="pre1SectionStatus">${done ? "完了 ✅" : score}</span></div>
        <h3>${escapeHtml(section.label)}</h3>
        <p>${section.type === "writing" ? "英文要約と英作文。下書きは自動保存されます。" : "選択肢を選び、答えを確認します。"}</p>
        <button class="cta" type="button" data-section="${section.id}">${buttonLabel}</button>
      </article>`;
    }).join("");
    const totalStats = sections.reduce((sum, section) => {
      const stats = sectionStats(section);
      return { done: sum.done + stats.done, total: sum.total + stats.total };
    }, { done: 0, total: 0 });
    const resume = loadResume();

    homePanel.innerHTML = `<section class="card hero pre1Hero">
      <div class="pre1HomeHead"><div><p class="label">EIKEN PRE-1 / PAST EXAMS</p><h2>${complete ? "この回を完了しました" : "準1級の過去問を、回ごとに解く"}</h2></div>
        <label class="datasetPicker"><span class="fieldLabel">問題セット</span><select class="datasetSelect" id="pre1RoundSelect">${roundOptions}</select></label>
      </div>
      <p class="pre1Lead">大問1、大問2、ライティング、リスニング、大問3を分けて保存します。正解数だけでなく、どこまで終えたかも回ごとに残ります。</p>
      <div class="shareStatus${shareStatus.tone ? ` ${shareStatus.tone}` : ""}" id="pre1ShareStatus" aria-live="polite">${escapeHtml(shareStatus.message)}</div>
      <div class="pre1Overall"><strong>${totalStats.done} / ${totalStats.total}</strong><span>設問・課題を確認済み</span>${complete ? "<b>この回は完了 ✅</b>" : ""}</div>
      <div class="actions">${resume && resume.roundId === state.roundId ? `<button class="cta" type="button" id="pre1ResumeBtn">続きから再開する</button>` : `<button class="cta" type="button" data-section="${sections.find((section) => !sectionComplete(section))?.id || "reading1"}">未完了のセクションから始める</button>`}<button class="ghost" type="button" id="pre1GradeBtn">級を変更</button></div>
    </section>
    <section class="card pre1SectionArea"><div class="sectionHead"><div><p class="label">SKILLS</p><h2>演習する技能</h2></div><p class="hint">${escapeHtml(info.label)}</p></div><div class="pre1SectionGrid">${sectionCards}</div></section>
    <section class="card pre1Note"><p class="label">保存について</p><p>選択問題の回答、ライティングの下書き、途中位置はブラウザに保存されます。公式PDFの問題文を公開用データとして再配布する設定にはしていません。</p></section>`;

    const select = document.getElementById("pre1RoundSelect");
    select.addEventListener("change", () => { void switchRound(select.value); });
    homePanel.querySelectorAll("[data-section]").forEach((button) => button.addEventListener("click", () => openSection(button.dataset.section)));
    const resumeButton = document.getElementById("pre1ResumeBtn");
    if (resumeButton) resumeButton.addEventListener("click", resumeSession);
    document.getElementById("pre1GradeBtn").addEventListener("click", () => {
      if (window.EikenAppRouter) window.EikenAppRouter.open("entry");
    });
  }

  function roundCompleteFor(roundId, data) {
    const previous = state.roundId;
    state.roundId = roundId;
    const result = roundComplete(data);
    state.roundId = previous;
    return result;
  }

  async function switchRound(roundId, sectionId = null) {
    state.roundId = roundId;
    state.data = await loadRound(roundId);
    saveJson(ROUND_KEY, roundId);
    if (sectionId) openSection(sectionId);
    else renderHome();
  }

  function activeSection() {
    return mcSections(state.data).find((section) => section.id === state.sectionId);
  }

  function firstOpenQuestionIndex(section, progress) {
    const idx = section.questions.findIndex((question) => {
      const saved = progress.questions[questionKey(section.id, question)];
      return !(saved && saved.answered && (section.id !== "reading1" || saved.correct));
    });
    return idx >= 0 ? idx : 0;
  }

  function firstOpenWritingIndex(section, progress) {
    const idx = section.questions.findIndex((task) => !(progress.writing[task.id] && progress.writing[task.id].reviewed));
    return idx >= 0 ? idx : 0;
  }

  function renderSection(section) {
    if (section.type === "writing") return renderWriting();
    if (section.id === "listening") return renderListening();
    if (section.id === "reading1") return renderReading1();
    if (section.id === "reading3") return renderReading3();
    return renderQuestion();
  }

  function resetQ3Flow() {
    state.q3Phase = "practice";
    state.q3Step = "choice";
    state.q3SelectedIndex = null;
    state.q3SelectedEvidence = [];
    state.q3SummaryPassageId = null;
    state.q3SummaryFilled = {};
    state.q3SummaryActive = null;
  }

  function openSection(sectionId) {
    const section = mcSections(state.data).find((candidate) => candidate.id === sectionId);
    if (!section) return;
    const progress = roundProgress();
    state.sectionId = sectionId;
    if (section.type === "writing") {
      state.writingIndex = firstOpenWritingIndex(section, progress);
      const task = section.questions[state.writingIndex];
      state.writingStep = writingResumeStep(task, normalizeWritingDraft(task.type, progress.writing[task.id]));
    } else {
      state.index = firstOpenQuestionIndex(section, progress);
      state.selectedIndex = null;
      state.resultShown = false;
      state.listeningMode = "problem";
      if (section.id === "reading1") resetVocabStudyState();
      if (section.id === "reading3") resetQ3Flow();
    }
    saveResume();
    setChromeTitle(`英検準1級 ${section.label}`);
    renderSection(section);
  }

  function resumeSession() {
    const resume = loadResume();
    if (!resume || resume.roundId !== state.roundId) return renderHome();
    state.sectionId = resume.sectionId;
    state.index = Number(resume.index || 0);
    state.selectedIndex = resume.selectedIndex == null ? null : Number(resume.selectedIndex);
    state.resultShown = Boolean(resume.resultShown);
    state.writingIndex = Number(resume.writingIndex || 0);
    state.writingStep = Number(resume.writingStep || 0);
    state.listeningMode = resume.listeningMode === "dictation" || resume.listeningMode === "review" ? resume.listeningMode : "problem";
    resetVocabStudyState();
    resetQ3Flow();
    const section = activeSection();
    if (!section) return renderHome();
    renderSection(section);
  }

  /* ---- 大問1：暗記カード → 意味チェック → [誤答があれば]見直し → 本番4択 → 最終チェック ----
   * 既存のstatic/mode-q1.jsと同じ通常4段階の学習フローを、reading1セクションにのみ適用し、
   * セクション完了には全語句の最終チェック（正答率80%以上）も求める。
   * 本番4択そのものは既存のrenderQuestion()をそのまま使う(進捗スキーマ・採点ロジックを変えないため)。
   * 暗記カード・意味チェックの途中位置はセッション内メモリのみで保持し、resumeでは常にカード1枚目から
   * 再開する(語彙学習のやり直しは実害が小さく、状態の保存を複雑にしない設計判断)。
   */
  function renderLoadingSession(message) {
    sessionPanel.className = "pre1Session";
    homePanel.className = "hide";
    sessionPanel.innerHTML = `<section class="card"><p class="loading">${escapeHtml(message)}</p></section>`;
  }

  function vocabPool(roundId, excludeQ, excludeIdx) {
    const vocab = vocabCache[roundId];
    const pool = [];
    if (!vocab) return pool;
    Object.keys(vocab).forEach((qKey) => {
      vocab[qKey].forEach((entry, idx) => {
        if (Number(qKey) === excludeQ && idx === excludeIdx) return;
        pool.push(entry);
      });
    });
    return pool;
  }

  function resetVocabStudyState() {
    state.vocabStage = "flash";
    state.flashIdx = 0;
    state.checkIdx = 0;
    state.checkOrder = [];
    state.checkChoices = null;
    state.checkAnswerIndex = -1;
    state.checkPicked = null;
    state.checkAnswered = false;
    state.wrongLog = [];
    state.wrongChecked = [];
    state.finalCorrect = 0;
    state.finalOrder = [];
    state.finalChoices = null;
    state.finalAnswerIndex = -1;
    state.finalPicked = null;
    state.finalAnswered = false;
  }

  function renderReading1() {
    const section = activeSection();
    if (!section || !section.questions.length) return renderHome();
    const question = section.questions[state.index];
    const progressState = progressBundle();
    const progress = progressState.progress;
    const key = questionKey(section.id, question);
    const saved = progress.questions[key];
    const vocab = vocabCache[state.roundId];
    if (!vocab) {
      renderLoadingSession("語彙データを読み込んでいます…");
      loadVocab(state.roundId).then(() => {
        if (state.sectionId === "reading1") renderReading1();
      }).catch((error) => {
        console.error(error);
        state.vocabStage = "practice";
        renderQuestion();
      });
      return;
    }
    if (state.vocabStage === "final") return renderVocabFinalCheck(section);
    if (state.vocabStage === "finalDone") return renderVocabFinalDone(section);
    if (reading1ReadyForFinal(section, progress) && !finalCheckCleared(progress, allVocabItems().length)) {
      return startFinalCheck(section);
    }
    if ((saved && saved.answered) || state.vocabStage === "practice") return renderQuestion();

    const words = vocab[String(question.q)];
    if (!words) { state.vocabStage = "practice"; return renderQuestion(); }

    if (state.vocabStage === "check") return renderVocabCheck(section, question, words);
    if (state.vocabStage === "wrongReview") return renderVocabWrongReview(section, question, words);
    return renderVocabFlash(section, question, words);
  }

  function renderVocabFlash(section, question, words) {
    const idx = Math.max(0, Math.min(state.flashIdx, words.length - 1));
    const item = words[idx];
    const isLast = idx === words.length - 1;
    const rows = [
      `<div class="flashRow"><strong>意味</strong><p class="flashMeaning">${escapeHtml(item.meaning)}</p></div>`,
      `<div class="flashRow"><strong>語源</strong><p class="flashEtym">${escapeHtml(item.etymology)}${item.etymologyUncertain ? "(要確認：定説がはっきりしない語源です)" : ""}</p></div>`,
      `<div class="flashRow"><strong>例文</strong><p class="flashEx">${escapeHtml(item.example)}</p></div>`,
      item.collocation ? `<div class="flashRow"><strong>使い方</strong><p class="flashColl">${escapeHtml(item.collocation)}</p></div>` : "",
    ].join("");
    sessionPanel.className = "pre1Session";
    homePanel.className = "hide";
    sessionPanel.innerHTML = `<section class="card pre1QuestionCard">
      ${renderSectionHeader(section, `第${question.q}問 ・ STEP 1 意味・語源・例文の確認`)}
      <div class="cardCounter">カード ${idx + 1} / ${words.length}</div>
      <article class="flash">
        <div class="flashHead"><div class="flashWordLine"><span class="flashWord">${escapeHtml(item.word)}</span></div>${item.pos ? `<span class="flashPos">${escapeHtml(item.pos)}</span>` : ""}</div>
        <div class="flashBody">${rows}</div>
      </article>
      <div class="navRow flashNav"><button class="ghost" type="button" id="pre1FlashPrevBtn" ${idx === 0 ? "disabled" : ""}>前のカード</button><button class="cta" type="button" id="pre1FlashNextBtn">${isLast ? "意味チェックへ進む" : "次のカード"}</button></div>
    </section>`;
    bindCommonSessionButtons();
    document.getElementById("pre1FlashPrevBtn").addEventListener("click", () => { state.flashIdx -= 1; renderVocabFlash(section, question, words); });
    document.getElementById("pre1FlashNextBtn").addEventListener("click", () => {
      if (isLast) {
        state.vocabStage = "check";
        state.checkIdx = 0;
        state.checkOrder = shuffle(words.map((_, i) => i));
        state.checkChoices = null;
        renderReading1();
      } else {
        state.flashIdx += 1;
        renderVocabFlash(section, question, words);
      }
    });
  }

  function prepareCheckChoices(question, words) {
    const wordIdx = state.checkOrder[state.checkIdx];
    const item = words[wordIdx];
    const pool = shuffle(vocabPool(state.roundId, question.q, wordIdx)).slice(0, 3);
    const options = shuffle([item.meaning, ...pool.map((entry) => entry.meaning)]);
    state.checkChoices = options;
    state.checkAnswerIndex = options.indexOf(item.meaning);
    state.checkPicked = null;
    state.checkAnswered = false;
  }

  function renderVocabCheck(section, question, words) {
    if (!state.checkChoices) prepareCheckChoices(question, words);
    const wordIdx = state.checkOrder[state.checkIdx];
    const item = words[wordIdx];
    const showResult = state.checkAnswered;
    const choicesHtml = state.checkChoices.map((meaning, i) => {
      let cls = "choiceBtn";
      if (showResult) {
        if (i === state.checkAnswerIndex) cls += " correct";
        else if (i === state.checkPicked) cls += " wrong";
      }
      return `<button type="button" class="${cls}" data-check-choice="${i}" ${showResult ? "disabled" : ""}><span class="key">${i + 1}</span><span>${escapeHtml(meaning)}</span></button>`;
    }).join("");
    const isLastCheck = state.checkIdx === state.checkOrder.length - 1;
    const correct = state.checkPicked === state.checkAnswerIndex;
    sessionPanel.className = "pre1Session";
    homePanel.className = "hide";
    sessionPanel.innerHTML = `<section class="card pre1QuestionCard">
      ${renderSectionHeader(section, `第${question.q}問 ・ STEP 2 意味チェック`)}
      <div class="quizBox">
        <div class="roundInfo">意味チェック ${state.checkIdx + 1} / ${state.checkOrder.length}</div>
        <p class="askWord">${escapeHtml(item.word)} の意味は?</p>
        <div class="choices">${choicesHtml}</div>
        ${showResult ? `<div class="resultBox ${correct ? "ok" : "ng"}"><strong>${correct ? "正解" : "不正解"}</strong><p>正解：${escapeHtml(item.meaning)}</p></div>` : `<p class="pre1Prompt">最も適切な意味を選んでください。</p>`}
      </div>
      <div class="navRow pre1QuestionNav">${showResult ? `<button class="cta" type="button" id="pre1CheckNextBtn">${isLastCheck ? "次へ進む" : "次の単語へ"}</button>` : ""}</div>
    </section>`;
    bindCommonSessionButtons();
    if (!showResult) {
      sessionPanel.querySelectorAll("[data-check-choice]").forEach((button) => button.addEventListener("click", () => {
        state.checkPicked = Number(button.dataset.checkChoice);
        state.checkAnswered = true;
        if (state.checkPicked !== state.checkAnswerIndex) {
          state.wrongLog.push({ wordIdx, picked: state.checkChoices[state.checkPicked] });
        }
        renderVocabCheck(section, question, words);
      }));
    } else {
      document.getElementById("pre1CheckNextBtn").addEventListener("click", () => {
        if (isLastCheck) {
          if (state.wrongLog.length) {
            state.vocabStage = "wrongReview";
            state.wrongChecked = [];
          } else {
            state.vocabStage = "practice";
          }
        } else {
          state.checkIdx += 1;
          state.checkChoices = null;
        }
        renderReading1();
      });
    }
  }

  function renderVocabWrongReview(section, question, words) {
    const entries = state.wrongLog.map((log) => ({ ...log, item: words[log.wordIdx] }));
    const allChecked = entries.every((_, i) => state.wrongChecked.includes(i));
    const cardsHtml = entries.map((entry, i) => {
      const checked = state.wrongChecked.includes(i);
      return `<article class="flash reviewCard ${checked ? "reviewCardDone" : ""}">
        <div class="flashHead"><div class="flashWordLine"><span class="flashWord">${escapeHtml(entry.item.word)}</span></div></div>
        <div class="flashBody">
          <div class="flashRow"><strong>正しい意味</strong><p class="flashMeaning">${escapeHtml(entry.item.meaning)}</p></div>
          <div class="flashRow"><strong>選んでしまった意味</strong><p class="flashEtym">${escapeHtml(entry.picked)}</p></div>
          <div class="flashRow"><strong>例文</strong><p class="flashEx">${escapeHtml(entry.item.example)}</p></div>
        </div>
        ${checked ? "" : `<button class="ghost reviewCheckBtn" type="button" data-wrong-check="${i}">確認した</button>`}
      </article>`;
    }).join("");
    sessionPanel.className = "pre1Session";
    homePanel.className = "hide";
    sessionPanel.innerHTML = `<section class="card pre1QuestionCard">
      ${renderSectionHeader(section, `第${question.q}問 ・ STEP 2.5 間違えた語の見直し`)}
      <p class="pre1Prompt">意味チェックで間違えた語を、もう一度確認します。</p>
      <div class="wrongReview">${cardsHtml}</div>
      <div class="navRow pre1QuestionNav"><button class="cta" type="button" id="pre1WrongContinueBtn" ${allChecked ? "" : "disabled"}>本番形式へ進む</button></div>
    </section>`;
    bindCommonSessionButtons();
    sessionPanel.querySelectorAll("[data-wrong-check]").forEach((button) => button.addEventListener("click", () => {
      state.wrongChecked.push(Number(button.dataset.wrongCheck));
      renderVocabWrongReview(section, question, words);
    }));
    const continueButton = document.getElementById("pre1WrongContinueBtn");
    if (continueButton) continueButton.addEventListener("click", () => {
      if (!allChecked) return;
      state.vocabStage = "practice";
      state.wrongLog = [];
      state.wrongChecked = [];
      renderReading1();
    });
  }

  function startFinalCheck(section) {
    const items = allVocabItems();
    if (!items.length) return renderQuestion();
    state.vocabStage = "final";
    state.finalCorrect = 0;
    state.finalOrder = shuffle(items.map((item) => ({ q: item.q, wordIdx: item.wordIdx })));
    state.checkIdx = 0;
    state.finalChoices = null;
    state.finalAnswerIndex = -1;
    state.finalPicked = null;
    state.finalAnswered = false;
    renderReading1();
  }

  function finalItem() {
    const ref = state.finalOrder[state.checkIdx];
    const vocab = vocabCache[state.roundId] || {};
    return ref && vocab[String(ref.q)] ? vocab[String(ref.q)][ref.wordIdx] : null;
  }

  function prepareFinalChoices() {
    const item = finalItem();
    if (!item) return;
    const ref = state.finalOrder[state.checkIdx];
    const pool = shuffle(allVocabItems().filter((entry) => entry.q !== ref.q || entry.wordIdx !== ref.wordIdx)).slice(0, 3);
    const options = shuffle([item.meaning, ...pool.map((entry) => entry.meaning)]);
    state.finalChoices = options;
    state.finalAnswerIndex = options.indexOf(item.meaning);
    state.finalPicked = null;
    state.finalAnswered = false;
  }

  function renderVocabFinalCheck(section) {
    if (!state.finalChoices) prepareFinalChoices();
    const item = finalItem();
    if (!item || !state.finalChoices) return renderHome();
    const showResult = state.finalAnswered;
    const choicesHtml = state.finalChoices.map((meaning, i) => {
      let cls = "choiceBtn";
      if (showResult) {
        if (i === state.finalAnswerIndex) cls += " correct";
        else if (i === state.finalPicked) cls += " wrong";
      }
      return `<button type="button" class="${cls}" data-final-choice="${i}" ${showResult ? "disabled" : ""}><span class="key">${i + 1}</span><span>${escapeHtml(meaning)}</span></button>`;
    }).join("");
    const total = state.finalOrder.length;
    const isLast = state.checkIdx === total - 1;
    const correct = state.finalPicked === state.finalAnswerIndex;
    sessionPanel.className = "pre1Session";
    homePanel.className = "hide";
    sessionPanel.innerHTML = `<section class="card pre1QuestionCard">
      ${renderSectionHeader(section, `大問1 ・ 最終チェック ${state.checkIdx + 1} / ${total}`)}
      <div class="quizBox">
        <div class="roundInfo">最終チェック ${state.checkIdx + 1} / ${total}</div>
        <p class="askWord">${escapeHtml(item.word)} の意味は?</p>
        <div class="choices">${choicesHtml}</div>
        ${showResult ? `<div class="resultBox ${correct ? "ok" : "ng"}"><strong>${correct ? "正解" : "不正解"}</strong><p>正解：${escapeHtml(item.meaning)}</p></div>` : `<p class="pre1Prompt">全語句の意味を確認します。正答率80%以上でCLEARです。</p>`}
      </div>
      <div class="navRow pre1QuestionNav">${showResult ? `<button class="cta" type="button" id="pre1FinalNextBtn">${isLast ? "結果を見る" : "次の語句へ"}</button>` : ""}</div>
    </section>`;
    bindCommonSessionButtons();
    if (!showResult) {
      sessionPanel.querySelectorAll("[data-final-choice]").forEach((button) => button.addEventListener("click", () => {
        state.finalPicked = Number(button.dataset.finalChoice);
        state.finalAnswered = true;
        if (state.finalPicked === state.finalAnswerIndex) state.finalCorrect += 1;
        renderVocabFinalCheck(section);
      }));
    } else {
      document.getElementById("pre1FinalNextBtn").addEventListener("click", () => {
        if (isLast) {
          saveFinalResult(total);
          state.vocabStage = "finalDone";
          renderVocabFinalDone(section);
          return;
        }
        state.checkIdx += 1;
        state.finalChoices = null;
        state.finalPicked = null;
        state.finalAnswered = false;
        renderVocabFinalCheck(section);
      });
    }
  }

  function saveFinalResult(finalTotal) {
    const progressState = progressBundle();
    const final = progressState.progress.finalCheck;
    final.lastScore = state.finalCorrect;
    final.bestScore = Math.max(Number(final.bestScore) || 0, state.finalCorrect);
    final.bestTotal = finalTotal;
    final.lastTriedAt = new Date().toISOString();
    final.cleared = state.finalCorrect >= finalPassScore(finalTotal);
    if (final.cleared) final.clearedAt = new Date().toISOString();
    saveProgress(progressState.store);
  }

  function renderVocabFinalDone(section) {
    const total = state.finalOrder.length || allVocabItems().length;
    const passed = state.finalCorrect >= finalPassScore(total);
    sessionPanel.className = "pre1Session";
    homePanel.className = "hide";
    sessionPanel.innerHTML = `<section class="completionCard">
      <p class="label">大問1 ・ 最終チェック</p>
      <h2>${passed ? "大問1 CLEAR" : "最終チェック完了"}</h2>
      <div class="completionScore">${state.finalCorrect} / ${total}問</div>
      <p class="hint">${finalPassScore(total)} / ${total}問以上（正答率80%以上）でCLEAR</p>
      <div class="actions">${passed ? "" : `<button class="cta" type="button" id="pre1FinalRetryBtn">もう一度最終チェックに挑戦する</button>`}<button class="ghost" type="button" id="pre1FinalHomeBtn">セクション一覧へ戻る</button></div>
    </section>`;
    document.getElementById("pre1FinalRetryBtn")?.addEventListener("click", () => startFinalCheck(section));
    document.getElementById("pre1FinalHomeBtn").addEventListener("click", renderHome);
  }

  function renderSectionHeader(section, currentLabel) {
    const stats = sectionStats(section);
    const roundOptions = rounds().map((round) => `<option value="${escapeHtml(round.id)}"${round.id === state.roundId ? " selected" : ""}>${escapeHtml(round.label)}</option>`).join("");
    const backLabel = window.EikenLearningPath === "free" ? "技能一覧" : "セクション一覧";
    return `<div class="pre1SessionHead"><div><p class="label">${escapeHtml(section.tag)}</p><h2>${escapeHtml(section.label)}</h2><p class="hint">${currentLabel}</p></div><div class="pre1SessionActions"><label class="datasetPicker"><span class="fieldLabel">問題セット</span><select class="datasetSelect" id="pre1SessionRoundSelect">${roundOptions}</select></label><span>${stats.done} / ${stats.total}確認済み</span><button class="ghost smallGhost" type="button" id="pre1BackHomeBtn">${backLabel}</button></div></div>`;
  }

  function renderQuestion() {
    const section = activeSection();
    if (!section || !section.questions.length) return renderHome();
    const question = section.questions[state.index];
    const progressState = progressBundle();
    const progress = progressState.progress;
    const key = questionKey(section.id, question);
    const saved = progress.questions[key];
    const showResult = state.resultShown || Boolean(saved && saved.answered && (section.id !== "reading1" || saved.correct));
    const selectedIndex = state.selectedIndex == null ? (saved ? saved.selectedIndex : null) : state.selectedIndex;
    const correct = showResult && selectedIndex === question.answerIndex;
    const passageHtml = question.passage
      ? `<article class="pre1Passage"><p class="label">長文本文</p><h3>${escapeHtml(question.passage.title)}</h3><p>${escapeHtml(question.passage.text)}</p></article>`
      : question.context
        ? `<article class="pre1Passage"><p class="label">空所補充の本文</p><p>${escapeHtml(question.context)}</p></article>`
        : "";
    const choicesHtml = question.choices.map((choice, index) => {
      let cls = "choiceBtn";
      if (showResult) {
        if (index === question.answerIndex) cls += " correct";
        else if (index === selectedIndex) cls += " wrong";
      }
      return `<button type="button" class="${cls}" data-choice="${index}" ${showResult ? "disabled" : ""}><span class="key">${index + 1}</span><span>${escapeHtml(choice)}</span></button>`;
    }).join("");
    const vocabWords = section.id === "reading1" ? vocabCache[state.roundId]?.[String(question.q)] : null;
    const correctMeaning = Array.isArray(vocabWords)
      ? vocabWords.find((entry) => entry.word === question.choices[question.answerIndex])?.meaning || ""
      : "";
    const resultHtml = showResult
      ? `<div class="resultBox ${correct ? "ok" : "ng"}"><strong>${correct ? "正解" : "不正解"}</strong><p>正解：${question.answerIndex + 1} ${escapeHtml(question.choices[question.answerIndex])}${correctMeaning ? `（意味：${escapeHtml(correctMeaning)}）` : ""}</p></div>`
      : `<p class="pre1Prompt">最も適切な選択肢を選んでください。</p>`;
    const isLast = state.index === section.questions.length - 1;
    sessionPanel.className = "pre1Session";
    homePanel.className = "hide";
    sessionPanel.innerHTML = `<section class="card pre1QuestionCard">
      ${renderSectionHeader(section, `第${question.q}問（${state.index + 1} / ${section.questions.length}）`)}
      ${passageHtml}
      <div class="pre1QuestionMeta"><span>Q${question.q}</span><span>4択</span></div>
      <p class="pre1QuestionStem">${escapeHtml(question.stem || "本文の流れに合うものを選んでください。")}</p>
      <div class="choices">${choicesHtml}</div>${resultHtml}
      <div class="navRow pre1QuestionNav"><button class="ghost" type="button" id="pre1PrevBtn" ${state.index === 0 ? "disabled" : ""}>前の設問</button>${showResult ? `<button class="cta" type="button" id="pre1NextBtn">${isLast ? "セクション一覧へ" : "次の設問へ"}</button>` : ""}</div>
    </section>`;
    bindCommonSessionButtons();
    sessionPanel.querySelectorAll("[data-choice]").forEach((button) => button.addEventListener("click", () => {
      state.selectedIndex = Number(button.dataset.choice);
      state.resultShown = true;
      progress.questions[key] = { answered: true, selectedIndex: state.selectedIndex, correct: state.selectedIndex === question.answerIndex };
      saveProgress(progressState.store);
      saveResume();
      renderQuestion();
    }));
    const prevButton = document.getElementById("pre1PrevBtn");
    if (prevButton) prevButton.addEventListener("click", () => goToSiblingQuestion(section, -1));
    const nextButton = document.getElementById("pre1NextBtn");
    if (nextButton) nextButton.addEventListener("click", () => {
      if (!isLast) goToSiblingQuestion(section, 1);
      else renderHome();
    });
  }

  function goToSiblingQuestion(section, delta) {
    state.index += delta;
    state.selectedIndex = null;
    state.resultShown = false;
    if (section.id === "reading1") resetVocabStudyState();
    saveResume();
    renderSection(section);
  }

  /* ---- 大問3：4択 → 根拠文タップ → 判定 → [パッセージの最後の設問後]要約穴埋め ----
   * 既存のstatic/mode-q3.jsと同じ考え方(本文と設問を左右2カラムで並べ、根拠文を本文からタップさせる)を
   * reading3セクションにのみ適用する。reading3のsection.questionsは大問1・2と同じ「フラットな配列」だが、
   * 各要素にmcSections()で付与された`passage`(段落・要約データ)を持つため、パッセージ境界は
   * 隣接要素のpassage.idの変化で検出する。q3の細かい進行状態(q3Step/q3SelectedEvidence/要約の下書き)は
   * 語彙学習(vocabStage等)と同じくセッション内メモリのみで保持し、RESUME_KEYには保存しない
   * (再開時は常にそのセクションの最初の未回答設問からになる。書き直しの実害は小さいため)。
   */
  function q3Passages() {
    return [...new Map(activeSection().questions.map((question) => [question.passage.id, question.passage])).values()];
  }

  function q3PassageNumber(passageId) {
    return q3Passages().findIndex((passage) => passage.id === passageId) + 1;
  }

  function q3NextPassage(passage) {
    const list = q3Passages();
    const idx = list.findIndex((candidate) => candidate.id === passage.id);
    return list[idx + 1] || null;
  }

  function q3EvidenceKeys(question) {
    return question.evidence.sentences.map((sentence) => `${question.evidence.paragraph}-${sentence}`);
  }

  function q3ComputeResult(question) {
    const evidenceKeys = q3EvidenceKeys(question);
    const selected = state.q3SelectedEvidence;
    const correct = state.q3SelectedIndex === question.answerIndex;
    const hit = selected.filter((key) => evidenceKeys.includes(key));
    let evidenceMatch = "miss";
    if (hit.length > 0) {
      const exact = hit.length === evidenceKeys.length && selected.length === evidenceKeys.length;
      evidenceMatch = exact ? "exact" : "partial";
    }
    return { correct, evidenceMatch };
  }

  function renderQ3TextPanel(passage, opts) {
    const { evidenceKeys = [], selectedKeys = [], showResult = false, interactive = false } = opts || {};
    const shown = state.q3TransVisible === true;
    const paras = passage.paragraphs.map((para, pi) => {
      const sentHtml = para.sentences.map((sentence, si) => {
        const key = `${pi}-${si}`;
        const classes = ["sent"];
        if (showResult) {
          if (evidenceKeys.includes(key)) classes.push("evidenceCorrect");
          else if (selectedKeys.includes(key)) classes.push("evidenceMissed");
        } else if (selectedKeys.includes(key)) {
          classes.push("selected");
        }
        if (interactive) {
          const pressed = selectedKeys.includes(key);
          return `<button type="button" class="${classes.join(" ")}" data-key="${key}" aria-pressed="${pressed}" aria-label="第${pi + 1}段落の${si + 1}文目を根拠として${pressed ? "選択解除" : "選択"}">${escapeHtml(sentence)} </button>`;
        }
        return `<span class="${classes.join(" ")}" data-key="${key}" data-locked="1">${escapeHtml(sentence)} </span>`;
      }).join("");
      return `<p class="para">${sentHtml}<div class="paraTrans${shown ? "" : " hide"}" id="pre1Q3Trans-${pi}">${escapeHtml(para.translation)}</div></p>`;
    }).join("");
    return `<div class="textPanel">
      <p class="articleTitle">${escapeHtml(passage.title)}</p>
      ${paras}
      <button class="linkBtn" type="button" id="pre1Q3ToggleAllTrans">${shown ? "段落の和訳を隠す" : "段落の和訳を表示"}</button>
    </div>`;
  }

  function bindQ3TextPanelToggle() {
    const button = document.getElementById("pre1Q3ToggleAllTrans");
    if (!button) return;
    button.addEventListener("click", () => {
      state.q3TransVisible = !state.q3TransVisible;
      sessionPanel.querySelectorAll(".paraTrans").forEach((el) => el.classList.toggle("hide", !state.q3TransVisible));
      button.textContent = state.q3TransVisible ? "段落の和訳を隠す" : "段落の和訳を表示";
    });
  }

  function seedQ3PracticeState(section) {
    const question = section.questions[state.index];
    const saved = roundProgress().questions[questionKey(section.id, question)];
    if (saved && saved.answered) {
      state.q3Step = "result";
      state.q3SelectedIndex = saved.selectedIndex;
      state.q3SelectedEvidence = saved.chosenEvidence || [];
    } else {
      state.q3Step = "choice";
      state.q3SelectedIndex = null;
      state.q3SelectedEvidence = [];
    }
  }

  function q3GoToQuestion(section, index) {
    state.index = index;
    state.q3Phase = "practice";
    saveResume();
    renderReading3();
  }

  function q3Advance(section) {
    const currentPassageId = section.questions[state.index].passage.id;
    const nextQuestion = section.questions[state.index + 1];
    if (nextQuestion && nextQuestion.passage.id === currentPassageId) {
      q3GoToQuestion(section, state.index + 1);
      return;
    }
    state.q3Phase = "passageDone";
    state.q3SummaryPassageId = currentPassageId;
    saveResume();
    renderReading3();
  }

  function q3Finalize(section, question) {
    const progressState = progressBundle();
    const result = q3ComputeResult(question);
    progressState.progress.questions[questionKey(section.id, question)] = {
      answered: true,
      correct: result.correct,
      selectedIndex: state.q3SelectedIndex,
      chosenEvidence: state.q3SelectedEvidence.slice(),
      evidenceMatch: result.evidenceMatch,
    };
    saveProgress(progressState.store);
    state.q3Step = "result";
    saveResume();
    paintQ3Practice(section);
  }

  function paintQ3Practice(section) {
    const question = section.questions[state.index];
    const passage = question.passage;
    const showResult = state.q3Step === "result";
    const textHtml = renderQ3TextPanel(passage, {
      evidenceKeys: showResult ? q3EvidenceKeys(question) : [],
      selectedKeys: state.q3SelectedEvidence,
      showResult,
      interactive: state.q3Step === "evidence",
    });
    const choicesHtml = question.choices.map((choice, i) => {
      let cls = "choiceBtn";
      if (showResult) {
        if (i === question.answerIndex) cls += " correct";
        else if (i === state.q3SelectedIndex) cls += " wrong";
      }
      return `<button type="button" class="${cls}" data-choice="${i}" ${state.q3Step !== "choice" ? "disabled" : ""}><span class="key">${i + 1}</span><span>${escapeHtml(choice)}</span></button>`;
    }).join("");

    let stepHtml;
    if (state.q3Step === "evidence") {
      stepHtml = `<div class="evidenceStep">
        <p class="evidenceHint" aria-live="polite">根拠を選ぶ：${state.q3SelectedEvidence.length}文。本文の文をタップしてください（複数可）。</p>
        <div class="navRow evidenceNavRow"><button class="ghost" type="button" id="pre1Q3SkipEvidenceBtn">根拠を選ばず採点</button><button class="cta" type="button" id="pre1Q3SubmitEvidenceBtn">この根拠で答え合わせ</button></div>
      </div>`;
    } else if (showResult) {
      const result = q3ComputeResult(question);
      const matchLabel = result.evidenceMatch === "exact" ? "一致" : result.evidenceMatch === "partial" ? "部分一致" : "不一致";
      stepHtml = `<div class="resultBox ${result.correct ? "ok" : "ng"}">
        <div class="resultLine"><span class="tag ${result.correct ? "ok" : "ng"}">${result.correct ? "正解" : "不正解"}</span><span class="tag ${result.evidenceMatch}">根拠：${matchLabel}</span></div>
        <p>正解：${question.answerIndex + 1} ${escapeHtml(question.choices[question.answerIndex])}</p>
        <p class="explain">${escapeHtml(question.explanation)}</p>
        <button class="linkBtn" type="button" id="pre1Q3ToggleTransBtn">設問の和訳を表示</button>
        <div class="translateBox hide" id="pre1Q3TransBox">${escapeHtml(question.translation)}</div>
      </div>`;
    } else {
      stepHtml = `<p class="pre1Prompt">最も適切な選択肢を選んでください。</p>`;
    }

    const nextQuestion = section.questions[state.index + 1];
    const isLastOfPassage = !nextQuestion || nextQuestion.passage.id !== passage.id;
    const navHtml = `<div class="navRow pre1QuestionNav"><button class="ghost" type="button" id="pre1PrevBtn" ${state.index === 0 ? "disabled" : ""}>前の設問</button>${showResult ? `<button class="cta" type="button" id="pre1NextBtn">${isLastOfPassage ? "この文章を終える" : "次の設問へ"}</button>` : ""}</div>`;

    sessionPanel.className = "pre1Session q3Session";
    homePanel.className = "hide";
    sessionPanel.innerHTML = `<section class="card pre1QuestionCard">
      ${renderSectionHeader(section, `長文${q3PassageNumber(passage.id)}「${escapeHtml(passage.title)}」・第${question.q}問（${state.index + 1} / ${section.questions.length}）`)}
      <div class="practiceGrid">
        ${textHtml}
        <div class="taskPanel">
          <div class="pre1QuestionMeta"><span>Q${question.q}</span><span>4択</span></div>
          <p class="pre1QuestionStem">${escapeHtml(question.stem)}</p>
          <div class="choices">${choicesHtml}</div>
          ${stepHtml}
          ${navHtml}
        </div>
      </div>
    </section>`;
    bindCommonSessionButtons();
    bindQ3TextPanelToggle();

    if (state.q3Step === "choice") {
      sessionPanel.querySelectorAll("[data-choice]").forEach((button) => button.addEventListener("click", () => {
        state.q3SelectedIndex = Number(button.dataset.choice);
        state.q3Step = "evidence";
        saveResume();
        paintQ3Practice(section);
      }));
    }
    if (state.q3Step === "evidence") {
      sessionPanel.querySelectorAll(".sent").forEach((el) => el.addEventListener("click", () => {
        const key = el.dataset.key;
        const i = state.q3SelectedEvidence.indexOf(key);
        if (i >= 0) state.q3SelectedEvidence.splice(i, 1);
        else state.q3SelectedEvidence.push(key);
        saveResume();
        paintQ3Practice(section);
      }));
      document.getElementById("pre1Q3SkipEvidenceBtn").addEventListener("click", () => q3Finalize(section, question));
      document.getElementById("pre1Q3SubmitEvidenceBtn").addEventListener("click", () => q3Finalize(section, question));
    }
    if (showResult) {
      const toggleButton = document.getElementById("pre1Q3ToggleTransBtn");
      if (toggleButton) toggleButton.addEventListener("click", () => {
        const box = document.getElementById("pre1Q3TransBox");
        const nowHidden = box.classList.toggle("hide");
        toggleButton.textContent = nowHidden ? "設問の和訳を表示" : "設問の和訳を隠す";
      });
    }
    const prevButton = document.getElementById("pre1PrevBtn");
    if (prevButton) prevButton.addEventListener("click", () => q3GoToQuestion(section, state.index - 1));
    const nextButton = document.getElementById("pre1NextBtn");
    if (nextButton) nextButton.addEventListener("click", () => q3Advance(section));
  }

  function renderQ3PassageDone(section) {
    const passage = q3Passages().find((candidate) => candidate.id === state.q3SummaryPassageId) || section.questions[state.index].passage;
    const progress = roundProgress();
    const qs = section.questions.filter((question) => question.passage.id === passage.id);
    const answered = qs.filter((question) => {
      const saved = progress.questions[questionKey(section.id, question)];
      return saved && saved.answered;
    });
    const correct = answered.filter((question) => progress.questions[questionKey(section.id, question)].correct).length;
    const exact = answered.filter((question) => progress.questions[questionKey(section.id, question)].evidenceMatch === "exact").length;
    const summaryDone = Boolean(progress.summaries[passage.id] && progress.summaries[passage.id].graded);
    const nextPassage = q3NextPassage(passage);
    const nextLabel = !summaryDone ? "内容整理へ進む" : nextPassage ? "次の文章へ進む" : "セクション一覧へ戻る";

    sessionPanel.className = "pre1Session q3Session";
    homePanel.className = "hide";
    sessionPanel.innerHTML = `<section class="completionCard">
      <p class="label">文章の学習が完了</p>
      <h2>長文${q3PassageNumber(passage.id)}「${escapeHtml(passage.title)}」</h2>
      <p class="completionScore">設問 ${answered.length}/${qs.length}問・正解 ${correct}問・根拠一致 ${exact}問</p>
      <p class="hint">${!summaryDone ? "次は本文の内容整理です。本文を見ながら要約の空所を埋めます。" : nextPassage ? "次の文章へ進めます。" : "この回の長文をすべて確認しました。"}</p>
      <div class="actions"><button class="cta" type="button" id="pre1Q3DoneNextBtn">${nextLabel}</button><button class="ghost" type="button" id="pre1Q3DoneHomeBtn">セクション一覧へ戻る</button></div>
    </section>`;
    document.getElementById("pre1Q3DoneNextBtn").addEventListener("click", () => {
      if (!summaryDone) { openQ3Summary(section, passage.id); return; }
      if (nextPassage) { q3GoToQuestion(section, section.questions.findIndex((question) => question.passage.id === nextPassage.id)); return; }
      renderHome();
    });
    document.getElementById("pre1Q3DoneHomeBtn").addEventListener("click", renderHome);
  }

  function openQ3Summary(section, passageId) {
    state.q3Phase = "summary";
    state.q3SummaryPassageId = passageId;
    const progress = roundProgress();
    const stored = progress.summaries[passageId];
    state.q3SummaryFilled = stored && stored.filled ? { ...stored.filled } : {};
    state.q3SummaryActive = null;
    const cacheKey = `${state.roundId}:${passageId}`;
    if (!q3WordOrderCache[cacheKey]) {
      const passage = q3Passages().find((candidate) => candidate.id === passageId);
      const words = passage.summary.blanks.map((blank) => blank.answer).concat(passage.summary.distractors);
      q3WordOrderCache[cacheKey] = shuffle(words);
    }
    saveResume();
    renderReading3();
  }

  function paintQ3Summary(section) {
    const passage = q3Passages().find((candidate) => candidate.id === state.q3SummaryPassageId);
    const progressState = progressBundle();
    const stored = progressState.progress.summaries[passage.id];
    const graded = Boolean(stored && stored.graded);
    const wordOrder = q3WordOrderCache[`${state.roundId}:${passage.id}`] || [];

    const textHtml = renderQ3TextPanel(passage, {});
    const sectionsHtml = passage.summary.sections.map((sec) => {
      const lineHtml = sec.lines.map((line) => {
        const parts = line.map((part) => {
          if (typeof part === "string") return escapeHtml(part);
          const id = part.blank;
          const filledText = state.q3SummaryFilled[id];
          let cls = "blank";
          if (graded && stored.gradedCorrect) cls += stored.gradedCorrect[id] ? " correct filled" : " wrong filled";
          else if (filledText) cls += " filled";
          else cls += " empty";
          if (state.q3SummaryActive === id) cls += " active";
          const lockAttr = graded ? ' data-locked="1"' : "";
          const label = filledText ? escapeHtml(filledText) : `( ${id} )`;
          const ariaLabel = filledText ? `空欄${id}：${filledText}` : `空欄${id}を選ぶ`;
          const pressedAttr = state.q3SummaryActive === id ? ' aria-pressed="true"' : ' aria-pressed="false"';
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
      const wrongs = passage.summary.blanks.filter((blank) => !stored.gradedCorrect[blank.id]);
      if (wrongs.length) revealHtml = `<div class="answerReveal">${wrongs.map((blank) => `空所${blank.id}の正解：${escapeHtml(blank.answer)}`).join("<br>")}</div>`;
    }

    const allFilled = passage.summary.blanks.every((blank) => state.q3SummaryFilled[blank.id]);
    const wordsHtml = graded ? "" : `<div class="wordBank">${wordOrder.map((word) => {
      const isUsed = Object.values(state.q3SummaryFilled).includes(word);
      return `<button type="button" class="chip${isUsed ? " used" : ""}" data-word="${escapeHtml(word)}" ${isUsed ? "disabled" : ""}>${escapeHtml(word)}</button>`;
    }).join("")}</div>`;

    const nextPassage = q3NextPassage(passage);
    const actionHtml = graded
      ? `<div class="navRow"><button class="ghost" type="button" id="pre1Q3RetryBtn">やり直す</button><button class="cta" type="button" id="pre1Q3SummaryNextBtn">${nextPassage ? "次の文章へ" : "セクション一覧へ"}</button></div>`
      : `<div class="navRow" style="justify-content:flex-end;"><button class="cta" type="button" id="pre1Q3GradeBtn" ${allFilled ? "" : "disabled"}>採点する（${Object.keys(state.q3SummaryFilled).length}/${passage.summary.blanks.length}）</button></div>`;

    sessionPanel.className = "pre1Session q3Session";
    homePanel.className = "hide";
    sessionPanel.innerHTML = `<section class="card pre1QuestionCard">
      ${renderSectionHeader(section, `長文${q3PassageNumber(passage.id)}「${escapeHtml(passage.title)}」・内容整理`)}
      <div class="practiceGrid">
        ${textHtml}
        <div class="taskPanel">
          <p class="pre1Prompt">本文を見ながら、要約の空所に合う語句を下の語群からタップして選んでください。</p>
          ${sectionsHtml}
          ${revealHtml}
          ${wordsHtml}
          ${actionHtml}
        </div>
      </div>
    </section>`;
    bindCommonSessionButtons();
    bindQ3TextPanelToggle();

    if (!graded) {
      sessionPanel.querySelectorAll(".blank").forEach((el) => el.addEventListener("click", () => {
        const id = Number(el.dataset.blank);
        if (state.q3SummaryFilled[id]) {
          delete state.q3SummaryFilled[id];
          state.q3SummaryActive = null;
        } else {
          state.q3SummaryActive = id;
        }
        paintQ3Summary(section);
      }));
      sessionPanel.querySelectorAll(".chip").forEach((el) => el.addEventListener("click", () => {
        if (state.q3SummaryActive == null) return;
        state.q3SummaryFilled[state.q3SummaryActive] = el.dataset.word;
        state.q3SummaryActive = null;
        paintQ3Summary(section);
      }));
      const gradeButton = document.getElementById("pre1Q3GradeBtn");
      if (gradeButton) gradeButton.addEventListener("click", () => q3GradeSummary(section, passage));
    } else {
      document.getElementById("pre1Q3RetryBtn").addEventListener("click", () => {
        const progressState = progressBundle();
        delete progressState.progress.summaries[passage.id];
        saveProgress(progressState.store);
        openQ3Summary(section, passage.id);
      });
      document.getElementById("pre1Q3SummaryNextBtn").addEventListener("click", () => {
        if (nextPassage) {
          q3GoToQuestion(section, section.questions.findIndex((question) => question.passage.id === nextPassage.id));
        } else {
          renderHome();
        }
      });
    }
  }

  function q3GradeSummary(section, passage) {
    const progressState = progressBundle();
    const gradedCorrect = {};
    let correctCount = 0;
    passage.summary.blanks.forEach((blank) => {
      const filled = state.q3SummaryFilled[blank.id];
      const accepted = blank.accepted && blank.accepted.length ? blank.accepted : [blank.answer];
      const ok = accepted.includes(filled);
      gradedCorrect[blank.id] = ok;
      if (ok) correctCount += 1;
    });
    progressState.progress.summaries[passage.id] = {
      graded: true,
      filled: { ...state.q3SummaryFilled },
      gradedCorrect,
      correctCount,
      total: passage.summary.blanks.length,
    };
    saveProgress(progressState.store);
    paintQ3Summary(section);
  }

  function renderReading3() {
    const section = activeSection();
    if (!section || !section.questions.length) return renderHome();
    if (state.q3Phase === "passageDone") return renderQ3PassageDone(section);
    if (state.q3Phase === "summary") return paintQ3Summary(section);
    seedQ3PracticeState(section);
    paintQ3Practice(section);
  }

  /* ---- リスニング：4択 → [誤答のみ]書き取り → スクリプト確認、の3ステップ ----
   * 既存の大問1〜3とは別関数にして、音声のセグメント再生・書き取り指示・
   * スクリプト表示という専用フローを持たせる（大問1〜3側には影響させない）。
   */
  function loadAudioBlobUrl(path) {
    if (!audioBlobCache[path]) {
      audioBlobCache[path] = fetch(path, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
          return response.blob();
        })
        .then((blob) => URL.createObjectURL(blob));
    }
    return audioBlobCache[path];
  }

  function cleanListeningScript(script) {
    return String(script || "").replace(/\n{3,}/g, "\n\n").trim();
  }

  function listeningScriptWithQuestion(question) {
    const script = cleanListeningScript(question.script);
    return question.question ? `${script}\n\nQuestion: ${question.question}` : script;
  }

  function setupListeningAudio(question) {
    const audioEl = document.getElementById("pre1ListenAudio");
    if (!audioEl) return;
    const hasSegment = question.start != null && question.end != null;
    loadAudioBlobUrl(question.audio).then((url) => {
      audioEl.src = url;
      if (hasSegment) audioEl.currentTime = question.start;
    }).catch((error) => console.error(error));
    if (!hasSegment) return;
    audioEl.addEventListener("play", () => {
      if (audioEl.currentTime < question.start || audioEl.currentTime >= question.end) audioEl.currentTime = question.start;
    });
    audioEl.addEventListener("timeupdate", () => {
      if (audioEl.currentTime < question.end) return;
      const loop = document.getElementById("pre1LoopToggle");
      if (loop && loop.checked) audioEl.currentTime = question.start;
      else audioEl.pause();
    });
  }

  function renderListening() {
    const section = activeSection();
    if (!section || !section.questions.length) return renderHome();
    const question = section.questions[state.index];
    const progressState = progressBundle();
    const progress = progressState.progress;
    const key = questionKey(section.id, question);
    const saved = progress.questions[key];
    const showResult = state.resultShown || Boolean(saved && saved.answered);
    const selectedIndex = state.selectedIndex == null ? (saved ? saved.selectedIndex : null) : state.selectedIndex;
    const correct = showResult && selectedIndex === question.answerIndex;
    const mode = showResult ? state.listeningMode : "problem";
    const isLast = state.index === section.questions.length - 1;
    const hasSegment = question.start != null && question.end != null;

    const audioHtml = `<div class="pre1Audio"><p class="label">音声 / Part ${question.part}</p><audio id="pre1ListenAudio" controls preload="none"></audio>${
      hasSegment
        ? `<label class="pre1LoopLabel"><input type="checkbox" id="pre1LoopToggle"> この設問区間をリピート再生</label>`
        : `<p class="hint">設問の音声はPart単位です。必要な箇所まで再生位置を移動してください。</p>`
    }</div>`;
    const choicesHtml = question.choices.map((choice, index) => {
      let cls = "choiceBtn";
      if (showResult) {
        if (index === question.answerIndex) cls += " correct";
        else if (index === selectedIndex) cls += " wrong";
      }
      return `<button type="button" class="${cls}" data-choice="${index}" ${showResult || mode !== "problem" ? "disabled" : ""}><span class="key">${index + 1}</span><span>${escapeHtml(choice)}</span></button>`;
    }).join("");

    let stepHtml;
    if (!showResult) {
      stepHtml = `<p class="pre1Prompt">最も適切な選択肢を選んでください。</p>`;
    } else if (mode === "dictation") {
      stepHtml = `<div class="resultBox ng"><strong>不正解</strong><p>書き取りに進みます。</p></div>
        <p class="pre1WritingPrompt">Q${question.q} の英文を紙に書き取り、目視で確認します。</p>
        <div class="navRow pre1QuestionNav"><button class="ghost" type="button" id="pre1DictBackBtn">問題へ戻る</button><button class="cta" type="button" id="pre1DictScriptBtn">スクリプトを表示して確認する</button></div>`;
    } else if (mode === "review") {
      stepHtml = `<div class="resultBox ng"><strong>不正解</strong><p>正解：${question.answerIndex + 1} ${escapeHtml(question.choices[question.answerIndex])}</p></div>
        <article class="pre1Passage"><p class="label">スクリプト</p><p class="pre1WritingPrompt">${escapeHtml(listeningScriptWithQuestion(question))}</p></article>
        ${question.tips && question.tips.length ? `<p class="label">聞き取りのポイント</p><ul class="pre1TipsList">${question.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}</ul>` : ""}
        <div class="navRow pre1QuestionNav"><button class="ghost" type="button" id="pre1PrevBtn" ${state.index === 0 ? "disabled" : ""}>前の設問</button><button class="cta" type="button" id="pre1NextBtn">${isLast ? "セクション一覧へ" : "次の設問へ"}</button></div>`;
    } else {
      stepHtml = `<div class="resultBox ${correct ? "ok" : "ng"}"><strong>${correct ? "正解" : "不正解"}</strong></div>
        <div class="navRow pre1QuestionNav"><button class="ghost" type="button" id="pre1PrevBtn" ${state.index === 0 ? "disabled" : ""}>前の設問</button>${
          correct
            ? `<button class="cta" type="button" id="pre1NextBtn">${isLast ? "セクション一覧へ" : "次の設問へ"}</button>`
            : `<button class="cta" type="button" id="pre1DictationBtn">書き取りへ進む</button>`
        }</div>`;
    }

    sessionPanel.className = "pre1Session";
    homePanel.className = "hide";
    sessionPanel.innerHTML = `<section class="card pre1QuestionCard">
      ${renderSectionHeader(section, `第${question.q}問（${state.index + 1} / ${section.questions.length}）`)}
      ${audioHtml}
      <div class="pre1QuestionMeta"><span>Q${question.q}</span><span>Part ${question.part}</span></div>
      <p class="pre1QuestionStem">${escapeHtml(question.stem || "音声を聞いて、最も適切な選択肢を選んでください。")}</p>
      <div class="choices">${choicesHtml}</div>
      ${stepHtml}
    </section>`;
    bindCommonSessionButtons();
    setupListeningAudio(question);

    if (!showResult && mode === "problem") {
      sessionPanel.querySelectorAll("[data-choice]").forEach((button) => button.addEventListener("click", () => {
        state.selectedIndex = Number(button.dataset.choice);
        state.resultShown = true;
        state.listeningMode = "problem";
        progress.questions[key] = { answered: true, selectedIndex: state.selectedIndex, correct: state.selectedIndex === question.answerIndex };
        saveProgress(progressState.store);
        saveResume();
        renderListening();
      }));
    }
    const prevButton = document.getElementById("pre1PrevBtn");
    if (prevButton) prevButton.addEventListener("click", () => {
      state.index -= 1; state.selectedIndex = null; state.resultShown = false; state.listeningMode = "problem"; saveResume(); renderListening();
    });
    const nextButton = document.getElementById("pre1NextBtn");
    if (nextButton) nextButton.addEventListener("click", () => {
      if (!isLast) { state.index += 1; state.selectedIndex = null; state.resultShown = false; state.listeningMode = "problem"; saveResume(); renderListening(); }
      else renderHome();
    });
    const dictationButton = document.getElementById("pre1DictationBtn");
    if (dictationButton) dictationButton.addEventListener("click", () => { state.listeningMode = "dictation"; saveResume(); renderListening(); });
    const dictBackButton = document.getElementById("pre1DictBackBtn");
    if (dictBackButton) dictBackButton.addEventListener("click", () => { state.listeningMode = "problem"; saveResume(); renderListening(); });
    const dictScriptButton = document.getElementById("pre1DictScriptBtn");
    if (dictScriptButton) dictScriptButton.addEventListener("click", () => { state.listeningMode = "review"; saveResume(); renderListening(); });
  }

  function bindCommonSessionButtons() {
    const button = document.getElementById("pre1BackHomeBtn");
    if (button) button.addEventListener("click", () => {
      if (window.EikenLearningPath === "free" && window.EikenAppRouter) window.EikenAppRouter.open("free");
      else renderHome();
    });
    const select = document.getElementById("pre1SessionRoundSelect");
    if (select) select.addEventListener("change", () => { void switchRound(select.value, state.sectionId); });
  }

  function wordCount(value) {
    const text = String(value || "").trim();
    return text ? text.split(/\s+/).length : 0;
  }

  /* ---- 英作文：ESSAY(6段階)/SUMMARY(4段階)の多段階フロー ----
   * ESSAYは既存2級/準2級のstatic/mode-writing.jsと同じ6段階(TRANSLATE→HEAD→BODY1→BODY2→CONCLUSION→REVIEW)。
   * SUMMARYは賛否の立場(stance)を持たない要約課題のため、新規に4段階(TRANSLATE→OUTLINE→WRITE→REVIEW)を設計している。
   */
  const ESSAY_STEP_TITLES = ["設問を訳す", "HEADを作る", "BODY 1を作る", "BODY 2を作る", "CONCLUSIONを書く", "全体をレビュー"];
  const ESSAY_STEP_LABELS = ["TRANSLATE", "HEAD", "BODY 1", "BODY 2", "CONCLUSION", "REVIEW"];
  const SUMMARY_STEP_TITLES = ["原文を確認する", "要点を整理する", "英語で要約する", "全体をレビュー"];
  const SUMMARY_STEP_LABELS = ["TRANSLATE", "OUTLINE", "WRITE", "REVIEW"];

  function essaySectionTargets() {
    return { head: { min: 18, max: 23 }, body1: { min: 42, max: 53 }, body2: { min: 42, max: 53 }, conclusion: { min: 18, max: 23 } };
  }

  function isGoodIdeaTask(task) { return /good idea/i.test(task.prompt); }
  function essayHeadTemplate(stance, task) {
    if (isGoodIdeaTask(task)) return stance === "yes" ? "Yes, I think it is a good idea." : "No, I do not think it is a good idea.";
    return stance === "yes" ? "Yes, I think so." : "No, I do not think so.";
  }
  function essayConclusionTemplate(stance, task) {
    if (isGoodIdeaTask(task)) return stance === "yes" ? "Therefore, I think it is a good idea." : "Therefore, I do not think it is a good idea.";
    return stance === "yes" ? "Therefore, I think so." : "Therefore, I do not think so.";
  }

  function emptyWritingDraft(type) {
    return type === "SUMMARY"
      ? { translation: "", forPoint: "", againstPoint: "", answer: "", reviewed: false }
      : { translation: "", stance: "", head: "", body1Reason: "", body1Simple: "", body2Reason: "", body2Simple: "", conclusion: "", answer: "", reviewed: false };
  }

  function normalizeWritingDraft(type, raw) {
    const draft = emptyWritingDraft(type);
    if (!raw || typeof raw !== "object") return draft;
    draft.answer = typeof raw.answer === "string" ? raw.answer : "";
    draft.reviewed = Boolean(raw.reviewed);
    draft.translation = typeof raw.translation === "string" ? raw.translation : "";
    if (type === "SUMMARY") {
      draft.forPoint = typeof raw.forPoint === "string" ? raw.forPoint : "";
      draft.againstPoint = typeof raw.againstPoint === "string" ? raw.againstPoint : "";
    } else {
      draft.stance = raw.stance === "yes" || raw.stance === "no" ? raw.stance : "";
      draft.head = typeof raw.head === "string" ? raw.head : "";
      draft.body1Reason = typeof raw.body1Reason === "string" ? raw.body1Reason : "";
      draft.body1Simple = typeof raw.body1Simple === "string" ? raw.body1Simple : "";
      draft.body2Reason = typeof raw.body2Reason === "string" ? raw.body2Reason : "";
      draft.body2Simple = typeof raw.body2Simple === "string" ? raw.body2Simple : "";
      draft.conclusion = typeof raw.conclusion === "string" ? raw.conclusion : "";
    }
    return draft;
  }

  function writingStepCount(task) { return task.type === "SUMMARY" ? SUMMARY_STEP_TITLES.length : ESSAY_STEP_TITLES.length; }

  function writingStepComplete(task, draft, step) {
    if (task.type === "SUMMARY") {
      if (step === 0) return Boolean(draft.translation.trim());
      if (step === 1) return Boolean(draft.forPoint.trim()) && Boolean(draft.againstPoint.trim());
      return Boolean(draft.answer.trim());
    }
    if (step === 0) return Boolean(draft.translation.trim());
    if (step === 1) return Boolean(draft.stance) && Boolean(draft.head.trim());
    if (step === 2) return Boolean(draft.body1Reason.trim()) && Boolean(draft.body1Simple.trim());
    if (step === 3) return Boolean(draft.body2Reason.trim()) && Boolean(draft.body2Simple.trim());
    if (step === 4) return Boolean(draft.conclusion.trim());
    return Boolean(draft.answer.trim());
  }

  function writingResumeStep(task, draft) {
    const last = writingStepCount(task) - 1;
    for (let step = 0; step < last; step += 1) if (!writingStepComplete(task, draft, step)) return step;
    return last;
  }

  function writingRequirement(task, step) {
    if (task.type === "SUMMARY") {
      return ["まず、原文の内容を日本語で確認してください。", "賛成派・反対派、両方の要点を入力してください。", "完成した要約を入力してください。", "完成した要約を入力してください。"][step];
    }
    return ["まず、設問の日本語訳を入力してください。", "Yes / Noを選び、HEADの英文を入力してください。", "BODY 1の理由と、平易な日本語を入力してください。", "BODY 2の理由と、平易な日本語を入力してください。", "CONCLUSIONの英文を入力してください。", "完成した英作文を入力してください。"][step];
  }

  function writingFieldMarkup(label, value, field, placeholder) {
    return `<label class="writingField"><span>${escapeHtml(label)}</span><textarea data-writing-field="${escapeHtml(field)}" spellcheck="true" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea></label>`;
  }

  function writingTargetMarkup(target, label) {
    return `<div class="writingSectionTarget"><div><span>${escapeHtml(label)} / 英語の語数目安</span><small>完成した英文で確認</small></div><strong>${target.min}–${target.max}語</strong></div>`;
  }

  function writingStanceMarkup(draft) {
    return `<fieldset class="writingStance"><legend>1. 立場を選ぶ</legend><p>まず、設問に対して Yes / No のどちらで書くか決めます。</p><div class="writingStanceOptions"><label class="writingStanceOption"><input type="radio" name="pre1-writing-stance" data-writing-field="stance" value="yes" ${draft.stance === "yes" ? "checked" : ""}><span><strong>YES</strong><small>賛成する</small></span></label><label class="writingStanceOption"><input type="radio" name="pre1-writing-stance" data-writing-field="stance" value="no" ${draft.stance === "no" ? "checked" : ""}><span><strong>NO</strong><small>反対する</small></span></label></div></fieldset>`;
  }

  function writingTemplateMarkup(kind, template) {
    const label = kind === "head" ? "HEADの定型" : "CONCLUSIONの定型";
    return `<div class="writingTemplate"><div><span>${label}</span><button class="writingTextButton" type="button" data-writing-use-template="${kind}">この定型を入力</button></div><p>${escapeHtml(template || "Yes / Noを選ぶと定型が表示されます。")}</p></div>`;
  }

  function writingSummaryMarkup(label, value, editStep) {
    return `<div class="writingSummary"><div><span>${escapeHtml(label)}</span><button class="writingTextButton" type="button" data-writing-edit-step="${editStep}">編集</button></div><p>${escapeHtml(value || "未入力")}</p></div>`;
  }

  function renderWritingContext(task, draft) {
    if (state.writingStep === 0) return "";
    const isSummary = task.type === "SUMMARY";
    const items = [writingSummaryMarkup(isSummary ? "原文の内容(日本語)" : "設問の日本語訳", draft.translation, 0)];
    if (isSummary) {
      if (state.writingStep >= 2) {
        items.push(writingSummaryMarkup("賛成派の要点", draft.forPoint, 1));
        items.push(writingSummaryMarkup("反対派の要点", draft.againstPoint, 1));
      }
    } else {
      if (state.writingStep >= 2) {
        items.push(writingSummaryMarkup("立場", draft.stance === "yes" ? "YES（賛成）" : draft.stance === "no" ? "NO（反対）" : "", 1));
        items.push(writingSummaryMarkup("HEAD", draft.head, 1));
      }
      if (state.writingStep >= 3) {
        items.push(writingSummaryMarkup("BODY 1 / 理由", draft.body1Reason, 2));
        items.push(writingSummaryMarkup("BODY 1 / 平易な日本語", draft.body1Simple, 2));
      }
      if (state.writingStep >= 4) {
        items.push(writingSummaryMarkup("BODY 2 / 理由", draft.body2Reason, 3));
        items.push(writingSummaryMarkup("BODY 2 / 平易な日本語", draft.body2Simple, 3));
      }
      if (state.writingStep >= 5) items.push(writingSummaryMarkup("CONCLUSION", draft.conclusion, 4));
    }
    return `<details class="writingContext" open><summary>ここまでの入力を確認する</summary><div class="writingSummaryList">${items.join("")}</div></details>`;
  }

  function renderEssayBodyPanel(task, draft, number) {
    const prefix = number === 1 ? "body1" : "body2";
    const target = essaySectionTargets()[prefix];
    return `<div class="writingPanel"><p class="writingKicker">STEP ${number + 2} / BODY ${number}</p><h3>BODY ${number}：理由を組み立てる</h3><p class="writingHelp">理由を先に日本語で考え、そのあと英語にしやすい平易な日本語へ直します。</p>${writingTargetMarkup(target, `BODY ${number}`)}<div class="writingBodyGrid"><div class="writingBodySubstep"><p>01 / REASON</p>${writingFieldMarkup("理由を考える", draft[`${prefix}Reason`], `${prefix}Reason`, "この理由で立場を支えられるか、日本語で考えます。")}</div><div class="writingBodySubstep"><p>02 / SIMPLIFY</p>${writingFieldMarkup("平易な日本語にする", draft[`${prefix}Simple`], `${prefix}Simple`, "主語と動詞が見える短い日本語に直します。")}</div></div></div>`;
  }

  function renderWritingReviewPanel(task, draft) {
    const count = wordCount(draft.answer);
    const status = count === 0 ? { key: "empty", label: "未入力" } : count < task.targetMin ? { key: "low", label: "語数不足" } : count > task.targetMax ? { key: "high", label: "語数超過" } : { key: "ok", label: "目安内" };
    const isSummary = task.type === "SUMMARY";
    return `<div class="writingPanel writingReviewPanel"><p class="writingKicker">STEP ${writingStepCount(task)} / REVIEW</p><h3>全体をレビューする</h3><p class="writingHelp">ここまでの内容がつながっているかを確認し、完成した英文を入力します。</p>
      <div class="writingTarget"><div><p class="writingTargetKicker">WRITING TARGET</p><strong>${isSummary ? "要約" : "英作文"}全体 ${task.targetMin}–${task.targetMax}語</strong><small>文字数ではなく、英語の語数で確認します。</small></div><span>目安</span></div>
      ${writingFieldMarkup(isSummary ? "完成した要約" : "完成した英作文", draft.answer, "answer", isSummary ? "賛成派・反対派の要点を含めてまとめます。" : "HEAD → BODY 1 → BODY 2 → CONCLUSION の順で書きます。")}
      <div class="writingWordCount" data-status="${status.key}" aria-live="polite"><strong>${count}</strong><span>${status.label} / 目安 ${task.targetMin}–${task.targetMax}語</span></div>
      ${draft.reviewed
        ? `<div class="resultBox ok"><strong>確認済み</strong><p>この課題は完了として記録されています。</p><button class="ghost" type="button" id="pre1WritingUnreviewBtn">確認済みを解除する</button></div>`
        : `<div class="writingReviewActions"><button type="button" id="pre1WritingReferenceBtn">参考解答を見る</button></div>`}
      <details class="writingReference" id="pre1WritingReferenceDetails" ${draft.reviewed ? "open" : ""}><summary>参考解答を開く</summary><p>自分の構成や表現との違いを確認します。</p><p>${escapeHtml(task.referenceAnswer || "")}</p></details>
    </div>`;
  }

  function renderWritingStepPanel(task, draft) {
    if (task.type === "SUMMARY") {
      if (state.writingStep === 0) return `<div class="writingPanel"><p class="writingKicker">STEP 1 / TRANSLATE</p><h3>原文を日本語で確認する</h3><p class="writingHelp">まずは原文が何を言っているかを、日本語で大まかに確認します。直訳で構いません。</p>${writingFieldMarkup("日本語訳（下書き）", draft.translation, "translation", "原文の内容を日本語で書きます。")}</div>`;
      if (state.writingStep === 1) return `<div class="writingPanel"><p class="writingKicker">STEP 2 / OUTLINE</p><h3>賛成派・反対派の要点を整理する</h3><p class="writingHelp">原文に出てくる賛成派(Supporters)と反対派(Critics / Opponents)、それぞれの主張を一言で整理します。</p><div class="writingBodyGrid"><div class="writingBodySubstep"><p>01 / FOR</p>${writingFieldMarkup("賛成派の要点", draft.forPoint, "forPoint", "賛成派が挙げている理由を日本語でまとめます。")}</div><div class="writingBodySubstep"><p>02 / AGAINST</p>${writingFieldMarkup("反対派の要点", draft.againstPoint, "againstPoint", "反対派が挙げている理由を日本語でまとめます。")}</div></div></div>`;
      if (state.writingStep === 2) return `<div class="writingPanel"><p class="writingKicker">STEP 3 / WRITE</p><h3>英語で要約を書く</h3><p class="writingHelp">整理した要点をもとに、${task.targetMin}〜${task.targetMax}語の英語で要約します。</p>${writingFieldMarkup("英語の要約", draft.answer, "answer", "賛成派・反対派、両方の要点を含めて要約します。")}</div>`;
      return renderWritingReviewPanel(task, draft);
    }
    if (state.writingStep === 0) return `<div class="writingPanel"><p class="writingKicker">STEP 1 / TRANSLATE</p><h3>設問の英文を日本語に訳す</h3><p class="writingHelp">まずは、設問が何を聞いているかを確かめます。ここでは直訳で構いません。</p>${writingFieldMarkup("日本語訳", draft.translation, "translation", "設問の意味を日本語で書きます。")}</div>`;
    if (state.writingStep === 1) return `<div class="writingPanel"><p class="writingKicker">STEP 2 / HEAD</p><h3>HEAD：立場を示す</h3><p class="writingHelp">最初の1文で Yes / No を明確にします。定型を使って、意見を先に置きます。</p>${writingTargetMarkup(essaySectionTargets().head, "HEAD")}${writingStanceMarkup(draft)}${writingTemplateMarkup("head", draft.stance ? essayHeadTemplate(draft.stance, task) : "")}${writingFieldMarkup("HEADの英文", draft.head, "head", "定型を参考にして、HEADの英文を書きます。")}</div>`;
    if (state.writingStep === 2) return renderEssayBodyPanel(task, draft, 1);
    if (state.writingStep === 3) return renderEssayBodyPanel(task, draft, 2);
    if (state.writingStep === 4) return `<div class="writingPanel"><p class="writingKicker">STEP 5 / CONCLUSION</p><h3>CONCLUSION：意見に戻る</h3><p class="writingHelp">最後に、定型を使って最初の意見へ戻ります。新しい理由はここで足しません。</p>${writingTargetMarkup(essaySectionTargets().conclusion, "CONCLUSION")}${writingTemplateMarkup("conclusion", essayConclusionTemplate(draft.stance, task))}${writingFieldMarkup("CONCLUSIONの英文", draft.conclusion, "conclusion", "定型を参考にして、CONCLUSIONの英文を書きます。")}</div>`;
    return renderWritingReviewPanel(task, draft);
  }

  function renderWriting() {
    const section = activeSection();
    if (!section || !section.questions.length) return renderHome();
    const task = section.questions[state.writingIndex];
    const progressState = progressBundle();
    const progress = progressState.progress;
    const draft = normalizeWritingDraft(task.type, progress.writing[task.id]);
    progress.writing[task.id] = draft;
    const stepTitles = task.type === "SUMMARY" ? SUMMARY_STEP_TITLES : ESSAY_STEP_TITLES;
    const stepLabels = task.type === "SUMMARY" ? SUMMARY_STEP_LABELS : ESSAY_STEP_LABELS;
    const stepCount = stepTitles.length;
    state.writingStep = Math.max(0, Math.min(state.writingStep || 0, stepCount - 1));
    const isLastTask = state.writingIndex === section.questions.length - 1;
    const points = task.points && task.points.length ? `<div class="pre1Points"><span>使うPOINT</span>${task.points.map((point) => `<b>${escapeHtml(point)}</b>`).join("")}</div>` : "";
    const stepperHtml = stepTitles.map((title, index) => {
      const current = state.writingStep === index;
      return `<button class="writingStepButton" type="button" data-writing-step="${index}" aria-selected="${current}" ${index > state.writingStep ? "disabled" : ""}><span>${String(index + 1).padStart(2, "0")}</span><small>${stepLabels[index]}</small>${escapeHtml(title)}</button>`;
    }).join("");
    const nextLabel = stepTitles[state.writingStep + 1] || "";

    sessionPanel.className = "pre1Session writingSession";
    homePanel.className = "hide";
    sessionPanel.innerHTML = `<section class="card pre1WritingCard">
      ${renderSectionHeader(section, `課題${task.number}（${state.writingIndex + 1} / ${section.questions.length}）`)}
      <div class="writingPromptMeta"><span>${escapeHtml(task.type)}</span><strong>${task.targetMin}–${task.targetMax}語</strong></div>
      <h3>${escapeHtml(task.label)}</h3><p class="pre1WritingPrompt">${escapeHtml(task.prompt)}</p>${points}
      <div class="writingFlowHeader"><div><p class="writingKicker">YOUR RESPONSE</p><h2>${stepCount}段階で組み立てる</h2></div><div class="writingFlowProgress"><strong>STEP ${state.writingStep + 1} / ${stepCount}</strong><span>${stepTitles[state.writingStep]}</span></div></div>
      <div class="writingStepper" role="tablist" aria-label="${stepCount}段階のフロー">${stepperHtml}</div>
      <p class="writingFlowStatus" aria-live="polite"></p>
      ${renderWritingContext(task, draft)}
      ${renderWritingStepPanel(task, draft)}
      <div class="writingNavigation"><button class="ghost" type="button" id="pre1WritingPrevStepBtn" ${state.writingStep === 0 ? "disabled" : ""}>← 前のステップ</button>${state.writingStep < stepCount - 1 ? `<button type="button" id="pre1WritingNextStepBtn">${escapeHtml(nextLabel)} →</button>` : "<span>チェックを終えたら、参考解答と比べます。</span>"}</div>
      <div class="navRow pre1QuestionNav"><button class="ghost" type="button" id="pre1WritingPrevBtn" ${state.writingIndex === 0 ? "disabled" : ""}>前の課題</button>${draft.reviewed && isLastTask ? `<button class="cta" type="button" id="pre1WritingHomeBtn">セクション一覧へ</button>` : draft.reviewed ? `<button class="cta" type="button" id="pre1WritingNextBtn">次の課題へ</button>` : ""}</div>
    </section>`;
    bindCommonSessionButtons();
    bindWritingSession(section, task, draft, progressState, stepCount);
  }

  function bindWritingSession(section, task, draft, progressState, stepCount) {
    const flowStatus = sessionPanel.querySelector(".writingFlowStatus");
    const persist = () => { saveProgress(progressState.store); saveResume(); };

    sessionPanel.querySelectorAll("textarea[data-writing-field]").forEach((field) => field.addEventListener("input", () => {
      draft[field.dataset.writingField] = field.value;
      if (field.dataset.writingField === "answer") {
        const count = wordCount(field.value);
        const key = count === 0 ? "empty" : count < task.targetMin ? "low" : count > task.targetMax ? "high" : "ok";
        const label = { empty: "未入力", low: "語数不足", high: "語数超過", ok: "目安内" }[key];
        const wc = sessionPanel.querySelector(".writingWordCount");
        if (wc) {
          wc.dataset.status = key;
          wc.querySelector("strong").textContent = String(count);
          wc.querySelector("span").textContent = `${label} / 目安 ${task.targetMin}–${task.targetMax}語`;
        }
      }
      persist();
    }));

    sessionPanel.querySelectorAll('input[data-writing-field="stance"]').forEach((input) => input.addEventListener("change", () => {
      const oldHead = draft.stance ? essayHeadTemplate(draft.stance, task) : "";
      const oldConclusion = draft.stance ? essayConclusionTemplate(draft.stance, task) : "";
      if (!draft.head || draft.head === oldHead) draft.head = "";
      if (!draft.conclusion || draft.conclusion === oldConclusion) draft.conclusion = "";
      draft.stance = input.value;
      persist();
      renderWriting();
    }));

    sessionPanel.querySelectorAll("[data-writing-step]").forEach((button) => button.addEventListener("click", () => {
      if (button.disabled) return;
      state.writingStep = Number(button.dataset.writingStep);
      saveResume();
      renderWriting();
    }));
    sessionPanel.querySelectorAll("[data-writing-edit-step]").forEach((button) => button.addEventListener("click", () => {
      state.writingStep = Number(button.dataset.writingEditStep);
      saveResume();
      renderWriting();
    }));
    sessionPanel.querySelectorAll("[data-writing-use-template]").forEach((button) => button.addEventListener("click", () => {
      if (!draft.stance) { if (flowStatus) flowStatus.textContent = "先にYes / Noの立場を選んでください。"; return; }
      const fieldName = button.dataset.writingUseTemplate === "head" ? "head" : "conclusion";
      const field = sessionPanel.querySelector(`textarea[data-writing-field="${fieldName}"]`);
      field.value = fieldName === "head" ? essayHeadTemplate(draft.stance, task) : essayConclusionTemplate(draft.stance, task);
      draft[fieldName] = field.value;
      persist();
      field.focus();
    }));

    const prevStepButton = document.getElementById("pre1WritingPrevStepBtn");
    if (prevStepButton) prevStepButton.addEventListener("click", () => { state.writingStep = Math.max(0, state.writingStep - 1); saveResume(); renderWriting(); });
    const nextStepButton = document.getElementById("pre1WritingNextStepBtn");
    if (nextStepButton) nextStepButton.addEventListener("click", () => {
      if (writingStepComplete(task, draft, state.writingStep)) {
        state.writingStep = Math.min(stepCount - 1, state.writingStep + 1);
        saveResume();
        renderWriting();
        return;
      }
      if (flowStatus) flowStatus.textContent = writingRequirement(task, state.writingStep);
    });

    const referenceButton = document.getElementById("pre1WritingReferenceBtn");
    if (referenceButton) referenceButton.addEventListener("click", () => {
      if (!draft.answer.trim()) {
        if (flowStatus) flowStatus.textContent = task.type === "SUMMARY" ? "まず完成した要約を入力してください。" : "まず完成した英作文を入力してください。";
        return;
      }
      draft.reviewed = true;
      persist();
      renderWriting();
    });
    const unreviewButton = document.getElementById("pre1WritingUnreviewBtn");
    if (unreviewButton) unreviewButton.addEventListener("click", () => { draft.reviewed = false; persist(); renderWriting(); });

    const prevTaskButton = document.getElementById("pre1WritingPrevBtn");
    if (prevTaskButton) prevTaskButton.addEventListener("click", () => {
      state.writingIndex -= 1;
      const prevTask = section.questions[state.writingIndex];
      state.writingStep = writingResumeStep(prevTask, normalizeWritingDraft(prevTask.type, progressState.progress.writing[prevTask.id]));
      saveResume();
      renderWriting();
    });
    const nextTaskButton = document.getElementById("pre1WritingNextBtn");
    if (nextTaskButton) nextTaskButton.addEventListener("click", () => {
      state.writingIndex += 1;
      const nextTask = section.questions[state.writingIndex];
      state.writingStep = writingResumeStep(nextTask, normalizeWritingDraft(nextTask.type, progressState.progress.writing[nextTask.id]));
      saveResume();
      renderWriting();
    });
    const homeButton = document.getElementById("pre1WritingHomeBtn");
    if (homeButton) homeButton.addEventListener("click", renderHome);
  }

  async function boot() {
    await ensureLoaded();
    if (typeof createCloud === "function" && !cloud) {
      cloud = createCloud({
        appId: APP_ID,
        getPayload: allProgress,
        applyLoaded: applyCloudProgress,
        onStatus: setShareStatus,
      });
      await cloud.init();
      document.body.classList.toggle("sharedMode", cloud.isEnabled());
    }
    const savedRound = readString(ROUND_KEY, null);
    const roundId = typeof savedRound === "string" && manifest.pre1.rounds.some((round) => round.id === savedRound)
      ? savedRound
      : manifest.pre1.defaultRound;
    state.roundId = roundId;
    await Promise.all([
      ...manifest.pre1.rounds.map((round) => loadRound(round.id)),
      ...manifest.pre1.rounds.map((round) => loadVocab(round.id)),
    ]);
    state.data = dataCache[roundId];
    renderHome();
  }

  async function startCourse() {
    const context = window.EikenSerialContext;
    if (!context || !context.active) return;
    await ensureLoaded();
    const requestedRound = context.roundId || readString(ROUND_KEY, manifest.pre1.defaultRound);
    const roundId = rounds().some((round) => round.id === requestedRound)
      ? requestedRound
      : manifest.pre1.defaultRound;
    state.roundId = roundId;
    state.data = await loadRound(roundId);
    openSection(context.stepId || "reading1");
  }

  async function mount() {
    renderLoading("準1級の問題セットを読み込んでいます…");
    try {
      await boot();
    } catch (error) {
      homePanel.innerHTML = `<div class="card"><h2>準1級モードを読み込めませんでした</h2><p>HTTPサーバー経由で起動しているか確認してください。</p><p class="hint">${escapeHtml(error.message)}</p></div>`;
      console.error(error);
    }
  }

  async function mountSection(sectionId) {
    renderLoading("準1級の問題セットを読み込んでいます…");
    try {
      await boot();
      openSection(sectionId);
    } catch (error) {
      homePanel.innerHTML = `<div class="card"><h2>準1級モードを読み込めませんでした</h2><p>HTTPサーバー経由で起動しているか確認してください。</p><p class="hint">${escapeHtml(error.message)}</p></div>`;
      console.error(error);
    }
  }

  function handleKey(event) {
    if (event.defaultPrevented || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
    if (!state.sectionId || state.resultShown) return;
    const number = Number(event.key);
    if (number >= 1 && number <= 4) {
      const button = sessionPanel.querySelector(`[data-choice="${number - 1}"]`);
      if (button) button.click();
    }
  }

  return { mount, mountSection, handleKey, startCourse };
})();

window.EikenPre1App = EikenPre1App;
