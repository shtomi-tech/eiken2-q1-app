"use strict";

/* 英検2級・準2級 大問2（空所補充） */
const EikenQ2App = (function () {
  const MANIFEST_URL = "data/manifest.json";
  const DATASET_KEY = "eiken_q2_dataset";
  const PROGRESS_PREFIX = "eiken2q2.progress.";
  const homePanel = document.getElementById("homePanel");
  const sessionPanel = document.getElementById("sessionPanel");
  let manifest = null;
  let datasets = {};
  let datasetId = null;
  let data = null;
  let progress = { questions: {}, resume: null };
  let index = 0;
  let selectedIndex = null;
  let resultShown = false;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[char]));
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

  function activeGrade() {
    const profile = window.EikenGradeEntryApp && window.EikenGradeEntryApp.getProfile
      ? window.EikenGradeEntryApp.getProfile() : null;
    if (profile && profile.grade) return profile.grade;
    return String(localStorage.getItem("eiken_q1_dataset") || "").startsWith("eikenp2-") ? "pre2" : "2kyu";
  }

  function activeEntries() {
    const prefix = activeGrade() === "pre2" ? "eikenp2-" : "eiken2-";
    return Object.entries(datasets).filter(([id]) => id.startsWith(prefix));
  }

  function defaultDataset() {
    const entries = activeEntries();
    const suffix = String(manifest.defaultDatasetId || "").replace(/^eiken(?:p2|2)-/, "");
    return entries.find(([id]) => id.endsWith(suffix))?.[0] || entries[0]?.[0] || null;
  }

  function progressKey(id = datasetId) { return `${PROGRESS_PREFIX}${id}`; }

  function loadProgress(id = datasetId) {
    const saved = readJson(progressKey(id), {});
    progress = {
      questions: saved.questions && typeof saved.questions === "object" ? saved.questions : {},
      resume: saved.resume && typeof saved.resume === "object" ? saved.resume : null,
    };
  }

  function saveProgress() {
    try { localStorage.setItem(progressKey(), JSON.stringify(progress)); } catch (error) { /* 続行 */ }
  }

  function questionKey(question) { return String(question.q); }

  function stats() {
    const questions = Array.isArray(data?.questions) ? data.questions : [];
    const answered = questions.filter((question) => progress.questions[questionKey(question)]?.answered);
    return {
      total: questions.length,
      answered: answered.length,
      correct: answered.filter((question) => progress.questions[questionKey(question)].correct).length,
    };
  }

  function complete() {
    const current = stats();
    return current.total > 0 && current.answered === current.total;
  }

  async function getJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.json();
  }

  async function loadDataset(id) {
    datasetId = id;
    try { localStorage.setItem(DATASET_KEY, id); } catch (error) { /* 保存できなくても演習は続ける */ }
    data = await getJson(datasets[id].dataUrl);
    loadProgress(id);
  }

  function roundLabel(id) {
    return datasets[id]?.label || id;
  }

  function backToPath() {
    const path = window.EikenLearningPath === "free" ? "free" : "serial";
    if (window.EikenAppRouter) window.EikenAppRouter.open(path);
  }

  function saveResume() {
    if (!data || resultShown) return;
    progress.resume = { index };
    saveProgress();
  }

  function clearResume() {
    if (progress.resume) {
      delete progress.resume;
      saveProgress();
    }
  }

  function renderHome() {
    const current = stats();
    const options = activeEntries().map(([id, item]) => `<option value="${escapeHtml(id)}"${id === datasetId ? " selected" : ""}>${escapeHtml(item.label)}</option>`).join("");
    const nextQuestion = data.questions.find((question) => !progress.questions[questionKey(question)]?.answered);
    const resume = progress.resume && data.questions[progress.resume.index];
    const primaryLabel = resume ? `続きから解く（第${resume.q}問）` : nextQuestion ? `大問2を解く（第${nextQuestion.q}問から）` : "もう一周する";
    homePanel.className = "q2Home";
    sessionPanel.className = "hide";
    homePanel.innerHTML = `<section class="card hero q2Hero">
      <p class="label">READING / CLOZE</p>
      <h2>大問2・空所補充を、本文の流れから選ぶ</h2>
      <p>級と回を選び、本文中の空所に入る語句を4択で確認します。回答と途中位置はこの端末に保存されます。</p>
      <div class="q2HomeControls"><label class="datasetPicker"><span class="fieldLabel">問題セット</span><select class="datasetSelect" id="q2DatasetSelect">${options}</select></label><button class="cta" type="button" id="q2PrimaryBtn">${escapeHtml(primaryLabel)}</button></div>
      <p class="hint">${current.answered} / ${current.total}問 解答済み・正解 ${current.correct}問</p>
    </section>
    <section class="card q2RoundCard">
      <div class="sectionHead"><div><p class="label">問題セット</p><h2>${escapeHtml(roundLabel(datasetId))}</h2></div><span class="q2ProgressBadge">${complete() ? "完了" : `${current.answered} / ${current.total}`}</span></div>
      <p class="hint">${escapeHtml(data.meta?.sourceNote || "公式過去問を学習用に構造化")}</p>
      <div class="q2QuestionList">${data.questions.map((question, qIndex) => {
        const saved = progress.questions[questionKey(question)];
        const status = saved?.answered ? (saved.correct ? "正解" : "解答済み") : "未回答";
        return `<button type="button" class="q2QuestionLink" data-q-index="${qIndex}"><span>第${question.q}問</span><strong>${status}</strong></button>`;
      }).join("")}</div>
      <div class="actions"><button class="ghost" type="button" id="q2BackBtn">${window.EikenLearningPath === "free" ? "技能一覧へ" : "学習ルートへ"}</button><button class="ghost" type="button" id="q2ResetBtn">この回の進捗をリセット</button></div>
    </section>`;
    document.getElementById("q2DatasetSelect").addEventListener("change", async (event) => {
      await loadDataset(event.target.value);
      renderHome();
    });
    document.getElementById("q2PrimaryBtn").addEventListener("click", () => {
      index = resume ? Number(resume.index) : nextQuestion ? data.questions.indexOf(nextQuestion) : 0;
      clearResume();
      selectedIndex = null;
      resultShown = false;
      renderQuestion();
    });
    homePanel.querySelectorAll("[data-q-index]").forEach((button) => button.addEventListener("click", () => {
      index = Number(button.dataset.qIndex);
      clearResume();
      selectedIndex = null;
      resultShown = false;
      renderQuestion();
    }));
    document.getElementById("q2BackBtn").addEventListener("click", backToPath);
    document.getElementById("q2ResetBtn").addEventListener("click", () => {
      if (!confirm("この回の大問2の進捗をリセットします。よろしいですか？")) return;
      progress = { questions: {}, resume: null };
      saveProgress();
      renderHome();
    });
  }

  function renderQuestion() {
    const question = data.questions[index];
    if (!question) return renderHome();
    const saved = progress.questions[questionKey(question)];
    const shown = resultShown || Boolean(saved?.answered);
    const selected = selectedIndex == null ? saved?.selectedIndex : selectedIndex;
    const correct = shown && selected === question.answerIndex;
    const choices = question.choices.map((choice, choiceIndex) => {
      let className = "choiceBtn";
      if (shown) {
        if (choiceIndex === question.answerIndex) className += " correct";
        else if (choiceIndex === selected) className += " wrong";
      }
      return `<button type="button" class="${className}" data-choice="${choiceIndex}" ${shown ? "disabled" : ""}><span class="key">${choiceIndex + 1}</span><span>${escapeHtml(choice)}</span></button>`;
    }).join("");
    const result = shown
      ? `<div class="resultBox ${correct ? "ok" : "ng"}"><strong>${correct ? "正解" : "不正解"}</strong><p>正解：${question.answerIndex + 1} ${escapeHtml(question.choices[question.answerIndex])}</p></div>`
      : `<p class="pre1Prompt">本文の流れに合う選択肢を選んでください。</p>`;
    const isLast = index === data.questions.length - 1;
    homePanel.className = "hide";
    sessionPanel.className = "q2Session";
    sessionPanel.innerHTML = `<section class="card pre1QuestionCard q2QuestionCard">
      <div class="pre1SessionHead"><div><p class="label">READING / CLOZE</p><h2>${escapeHtml(datasets[datasetId].shortLabel)} 大問2</h2><p class="hint">${escapeHtml(roundLabel(datasetId))} ・ 第${question.q}問（${index + 1} / ${data.questions.length}）</p></div><div class="pre1SessionActions"><span>${stats().answered} / ${data.questions.length}問解答済み</span><button class="ghost smallGhost" type="button" id="q2BackHomeBtn">一覧へ戻る</button></div></div>
      <article class="pre1Passage q2Passage"><p class="label">本文</p><p>${escapeHtml(question.context)}</p></article>
      <div class="pre1QuestionMeta"><span>Q${question.q}</span><span>4択</span></div>
      <p class="pre1QuestionStem">${escapeHtml(question.stem)}</p><div class="choices">${choices}</div>${result}
      <div class="navRow pre1QuestionNav"><button class="ghost" type="button" id="q2PrevBtn" ${index === 0 ? "disabled" : ""}>前の設問</button>${shown ? `<button class="cta" type="button" id="q2NextBtn">${isLast ? "問題セット一覧へ" : "次の設問へ"}</button>` : ""}</div>
    </section>`;
    document.getElementById("q2BackHomeBtn").addEventListener("click", renderHome);
    document.getElementById("q2PrevBtn").addEventListener("click", () => { index -= 1; selectedIndex = null; resultShown = false; renderQuestion(); });
    const nextButton = document.getElementById("q2NextBtn");
    if (nextButton) nextButton.addEventListener("click", () => { if (isLast) renderHome(); else { index += 1; selectedIndex = null; resultShown = false; renderQuestion(); } });
    sessionPanel.querySelectorAll("[data-choice]").forEach((button) => button.addEventListener("click", () => {
      selectedIndex = Number(button.dataset.choice);
      resultShown = true;
      progress.questions[questionKey(question)] = { answered: true, selectedIndex, correct: selectedIndex === question.answerIndex };
      saveProgress();
      renderQuestion();
    }));
  }

  function startSerial() {
    const resume = progress.resume && data.questions[progress.resume.index];
    const nextQuestion = data.questions.find((question) => !progress.questions[questionKey(question)]?.answered);
    index = resume ? Number(progress.resume.index) : nextQuestion ? data.questions.indexOf(nextQuestion) : 0;
    clearResume();
    selectedIndex = null;
    resultShown = false;
    renderQuestion();
  }

  async function mount() {
    homePanel.className = "q2Home";
    sessionPanel.className = "hide";
    homePanel.innerHTML = `<div class="card"><p class="loading">大問2の問題を読み込んでいます…</p></div>`;
    try {
      if (window.EikenGradeEntryApp?.ensureLoaded) await window.EikenGradeEntryApp.ensureLoaded();
      manifest = await getJson(MANIFEST_URL);
      datasets = manifest.q2 || {};
      const saved = localStorage.getItem(DATASET_KEY);
      const desired = saved && datasets[saved] && activeEntries().some(([id]) => id === saved) ? saved : defaultDataset();
      await loadDataset(desired);
      renderHome();
    } catch (error) {
      homePanel.innerHTML = `<div class="card"><h2>大問2を読み込めませんでした</h2><p class="hint">${escapeHtml(error.message)}</p></div>`;
      console.error(error);
    }
  }

  function handleKey() { /* 選択肢は通常のボタン操作を使う */ }

  return { mount, handleKey, startSerial };
})();

window.EikenQ2App = EikenQ2App;
