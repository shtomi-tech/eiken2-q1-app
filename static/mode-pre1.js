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
  const homePanel = document.getElementById("homePanel");
  const sessionPanel = document.getElementById("sessionPanel");

  let manifest = null;
  let loading = null;
  const dataCache = {};
  let state = {
    roundId: "2026-1",
    data: null,
    sectionId: null,
    index: 0,
    selectedIndex: null,
    resultShown: false,
    writingIndex: 0,
  };

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
      store.rounds[roundId] = { questions: {}, writing: {} };
    }
    if (!store.rounds[roundId].questions || typeof store.rounds[roundId].questions !== "object") store.rounds[roundId].questions = {};
    if (!store.rounds[roundId].writing || typeof store.rounds[roundId].writing !== "object") store.rounds[roundId].writing = {};
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
    });
    saveJson(ROUND_KEY, state.roundId);
  }

  function clearResume() {
    try { localStorage.removeItem(RESUME_KEY); } catch (error) { /* ignore */ }
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

  function mcSections(data) {
    const part3 = [];
    (data.reading.part3 || []).forEach((passage) => {
      passage.questions.forEach((question) => part3.push({ ...question, passage }));
    });
    return [
      { id: "reading1", label: "大問1・語彙", tag: "READING 1", type: "questions", questions: data.reading.part1 || [] },
      { id: "reading2", label: "大問2・空所補充", tag: "READING 2", type: "questions", questions: data.reading.part2 || [] },
      { id: "reading3", label: "大問3・長文", tag: "READING 3", type: "questions", questions: part3 },
      { id: "listening", label: "リスニング", tag: "LISTENING", type: "questions", questions: data.listening || [] },
      { id: "writing", label: "ライティング", tag: "WRITING", type: "writing", questions: data.writing || [] },
    ];
  }

  function questionKey(sectionId, question) { return `${sectionId}:${question.q}`; }

  function sectionComplete(section) {
    const progress = roundProgress();
    if (section.type === "writing") {
      return section.questions.length > 0 && section.questions.every((task) => progress.writing[task.id] && progress.writing[task.id].reviewed);
    }
    return section.questions.length > 0 && section.questions.every((question) => progress.questions[questionKey(section.id, question)] && progress.questions[questionKey(section.id, question)].answered);
  }

  function sectionStats(section) {
    const progress = roundProgress();
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
    clearResume();
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
      const score = section.type === "writing" ? `${stats.done} / ${stats.total}題` : `${stats.done} / ${stats.total}問`;
      return `<article class="pre1SectionCard ${done ? "isDone" : ""}">
        <div class="pre1SectionTop"><span class="pre1SectionTag">${escapeHtml(section.tag)}</span><span class="pre1SectionStatus">${done ? "完了 ✅" : score}</span></div>
        <h3>${escapeHtml(section.label)}</h3>
        <p>${section.type === "writing" ? "英文要約と英作文。下書きは自動保存されます。" : "選択肢を選び、答えを確認します。"}</p>
        <button class="cta" type="button" data-section="${section.id}">${done ? "復習する" : stats.done ? "続きから解く" : "始める"}</button>
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
      <p class="pre1Lead">大問1〜3、ライティング、リスニングを分けて保存します。正解数だけでなく、どこまで終えたかも回ごとに残ります。</p>
      <div class="pre1Overall"><strong>${totalStats.done} / ${totalStats.total}</strong><span>設問・課題を確認済み</span>${complete ? "<b>この回は完了 ✅</b>" : ""}</div>
      <div class="actions">${resume && resume.roundId === state.roundId ? `<button class="cta" type="button" id="pre1ResumeBtn">続きから再開する</button>` : `<button class="cta" type="button" data-section="${sections.find((section) => !sectionComplete(section))?.id || "reading1"}">未完了のセクションから始める</button>`}<button class="ghost" type="button" id="pre1GradeBtn">級を変更</button></div>
    </section>
    <section class="card pre1SectionArea"><div class="sectionHead"><div><p class="label">SECTIONS</p><h2>一次試験の構成</h2></div><p class="hint">${escapeHtml(info.label)}</p></div><div class="pre1SectionGrid">${sectionCards}</div></section>
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

  async function switchRound(roundId) {
    state.roundId = roundId;
    state.data = await loadRound(roundId);
    saveJson(ROUND_KEY, roundId);
    renderHome();
  }

  function activeSection() {
    return mcSections(state.data).find((section) => section.id === state.sectionId);
  }

  function openSection(sectionId, index = 0) {
    const section = mcSections(state.data).find((candidate) => candidate.id === sectionId);
    if (!section) return;
    state.sectionId = sectionId;
    state.index = Math.max(0, Math.min(index, section.questions.length - 1));
    state.selectedIndex = null;
    state.resultShown = false;
    state.writingIndex = 0;
    saveResume();
    if (section.type === "writing") renderWriting();
    else renderQuestion();
  }

  function resumeSession() {
    const resume = loadResume();
    if (!resume || resume.roundId !== state.roundId) return renderHome();
    state.sectionId = resume.sectionId;
    state.index = Number(resume.index || 0);
    state.selectedIndex = resume.selectedIndex == null ? null : Number(resume.selectedIndex);
    state.resultShown = Boolean(resume.resultShown);
    state.writingIndex = Number(resume.writingIndex || 0);
    const section = activeSection();
    if (!section) return renderHome();
    if (section.type === "writing") renderWriting();
    else renderQuestion();
  }

  function renderSectionHeader(section, currentLabel) {
    const stats = sectionStats(section);
    return `<div class="pre1SessionHead"><div><p class="label">${escapeHtml(section.tag)}</p><h2>${escapeHtml(section.label)}</h2><p class="hint">${currentLabel}</p></div><div class="pre1SessionActions"><span>${stats.done} / ${stats.total}確認済み</span><button class="ghost smallGhost" type="button" id="pre1BackHomeBtn">セクション一覧</button></div></div>`;
  }

  function renderQuestion() {
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
    const passageHtml = question.passage
      ? `<article class="pre1Passage"><p class="label">長文本文</p><h3>${escapeHtml(question.passage.title)}</h3><p>${escapeHtml(question.passage.text)}</p></article>`
      : question.context
        ? `<article class="pre1Passage"><p class="label">空所補充の本文</p><p>${escapeHtml(question.context)}</p></article>`
        : "";
    const audioHtml = question.audio
      ? `<div class="pre1Audio"><p class="label">音声 / Part ${question.part}</p><audio controls preload="metadata" src="${escapeHtml(question.audio)}"></audio><p class="hint">設問の音声はPart単位です。必要な箇所まで再生位置を移動してください。</p></div>`
      : "";
    const choicesHtml = question.choices.map((choice, index) => {
      let cls = "choiceBtn";
      if (showResult) {
        if (index === question.answerIndex) cls += " correct";
        else if (index === selectedIndex) cls += " wrong";
      }
      return `<button type="button" class="${cls}" data-choice="${index}" ${showResult ? "disabled" : ""}><span class="key">${index + 1}</span><span>${escapeHtml(choice)}</span></button>`;
    }).join("");
    const resultHtml = showResult
      ? `<div class="resultBox ${correct ? "ok" : "ng"}"><strong>${correct ? "正解" : "不正解"}</strong><p>正解：${question.answerIndex + 1} ${escapeHtml(question.choices[question.answerIndex])}</p></div>`
      : `<p class="pre1Prompt">最も適切な選択肢を選んでください。</p>`;
    const isLast = state.index === section.questions.length - 1;
    sessionPanel.className = "pre1Session";
    homePanel.className = "hide";
    sessionPanel.innerHTML = `<section class="card pre1QuestionCard">
      ${renderSectionHeader(section, `第${question.q}問（${state.index + 1} / ${section.questions.length}）`)}
      ${passageHtml}${audioHtml}
      <div class="pre1QuestionMeta"><span>Q${question.q}</span><span>${section.id === "listening" ? `Part ${question.part}` : "4択"}</span></div>
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
    if (prevButton) prevButton.addEventListener("click", () => { state.index -= 1; state.selectedIndex = null; state.resultShown = false; saveResume(); renderQuestion(); });
    const nextButton = document.getElementById("pre1NextBtn");
    if (nextButton) nextButton.addEventListener("click", () => {
      if (!isLast) { state.index += 1; state.selectedIndex = null; state.resultShown = false; saveResume(); renderQuestion(); }
      else renderHome();
    });
  }

  function bindCommonSessionButtons() {
    const button = document.getElementById("pre1BackHomeBtn");
    if (button) button.addEventListener("click", renderHome);
  }

  function wordCount(value) {
    const text = String(value || "").trim();
    return text ? text.split(/\s+/).length : 0;
  }

  function renderWriting() {
    const section = activeSection();
    if (!section || !section.questions.length) return renderHome();
    const task = section.questions[state.writingIndex];
    const progressState = progressBundle();
    const progress = progressState.progress;
    const saved = progress.writing[task.id] || { answer: "", reviewed: false };
    const points = task.points && task.points.length ? `<div class="pre1Points"><span>使うPOINT</span>${task.points.map((point) => `<b>${escapeHtml(point)}</b>`).join("")}</div>` : "";
    const reviewedHtml = saved.reviewed
      ? `<div class="resultBox ok"><strong>確認済み</strong><p>この課題は完了として記録されています。</p><button class="ghost" type="button" id="pre1UnreviewBtn">確認済みを解除する</button></div>`
      : `<button class="cta" type="button" id="pre1ReviewBtn">この課題を確認済みにする</button>`;
    const isLast = state.writingIndex === section.questions.length - 1;
    sessionPanel.className = "pre1Session";
    homePanel.className = "hide";
    sessionPanel.innerHTML = `<section class="card pre1WritingCard">
      ${renderSectionHeader(section, `課題${task.number}（${state.writingIndex + 1} / ${section.questions.length}）`)}
      <div class="pre1WritingMeta"><span>${escapeHtml(task.type)}</span><strong>${task.targetMin}–${task.targetMax}語</strong></div>
      <h3>${escapeHtml(task.label)}</h3><p class="pre1WritingPrompt">${escapeHtml(task.prompt)}</p>${points}
      <label class="pre1WritingField"><span>下書き・解答</span><textarea id="pre1WritingText" rows="12" placeholder="ここに英文を書きます。入力内容は自動保存されます。">${escapeHtml(saved.answer)}</textarea></label>
      <p class="pre1WordCount" id="pre1WordCount">${wordCount(saved.answer)}語 / 目安 ${task.targetMin}–${task.targetMax}語</p>${reviewedHtml}
      <div class="navRow pre1QuestionNav"><button class="ghost" type="button" id="pre1WritingPrevBtn" ${state.writingIndex === 0 ? "disabled" : ""}>前の課題</button>${saved.reviewed && isLast ? `<button class="cta" type="button" id="pre1WritingHomeBtn">セクション一覧へ</button>` : saved.reviewed ? `<button class="cta" type="button" id="pre1WritingNextBtn">次の課題へ</button>` : ""}</div>
    </section>`;
    bindCommonSessionButtons();
    const textarea = document.getElementById("pre1WritingText");
    textarea.addEventListener("input", () => {
      progress.writing[task.id] = { answer: textarea.value, reviewed: Boolean(progress.writing[task.id] && progress.writing[task.id].reviewed) };
      saveProgress(progressState.store);
      document.getElementById("pre1WordCount").textContent = `${wordCount(textarea.value)}語 / 目安 ${task.targetMin}–${task.targetMax}語`;
      saveResume();
    });
    const reviewButton = document.getElementById("pre1ReviewBtn");
    if (reviewButton) reviewButton.addEventListener("click", () => {
      progress.writing[task.id] = { answer: textarea.value, reviewed: true };
      saveProgress(progressState.store);
      renderWriting();
    });
    const unreviewButton = document.getElementById("pre1UnreviewBtn");
    if (unreviewButton) unreviewButton.addEventListener("click", () => {
      progress.writing[task.id] = { answer: textarea.value, reviewed: false };
      saveProgress(progressState.store);
      renderWriting();
    });
    const prevButton = document.getElementById("pre1WritingPrevBtn");
    if (prevButton) prevButton.addEventListener("click", () => { state.writingIndex -= 1; saveResume(); renderWriting(); });
    const nextButton = document.getElementById("pre1WritingNextBtn");
    if (nextButton) nextButton.addEventListener("click", () => { state.writingIndex += 1; saveResume(); renderWriting(); });
    const homeButton = document.getElementById("pre1WritingHomeBtn");
    if (homeButton) homeButton.addEventListener("click", renderHome);
  }

  async function boot() {
    await ensureLoaded();
    const savedRound = readString(ROUND_KEY, null);
    const roundId = typeof savedRound === "string" && manifest.pre1.rounds.some((round) => round.id === savedRound)
      ? savedRound
      : manifest.pre1.defaultRound;
    state.roundId = roundId;
    await Promise.all(manifest.pre1.rounds.map((round) => loadRound(round.id)));
    state.data = dataCache[roundId];
    renderHome();
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

  function handleKey(event) {
    if (event.defaultPrevented || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
    if (!state.sectionId || state.resultShown) return;
    const number = Number(event.key);
    if (number >= 1 && number <= 4) {
      const button = sessionPanel.querySelector(`[data-choice="${number - 1}"]`);
      if (button) button.click();
    }
  }

  return { mount, handleKey };
})();

window.EikenPre1App = EikenPre1App;
