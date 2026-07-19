"use strict";

/*
 * 英検 直列コース
 *
 * 既存モードの回答データは各モードの保存領域をそのまま使い、
 * ここでは「どのモードを次に開くか」だけを管理する。
 */
const EikenSerialApp = (function () {
  const MANIFEST_URL = "data/manifest.json";
  const PARAPHRASE_URL = "data/paraphrase_questions.json";
  const WRITING_URL = "data/writing_questions.json";
  const ROUTE_KEY = "eiken_serial_progress_v1";
  const PROFILE_KEY = "eiken_grade_profile_v1";
  const homePanel = document.getElementById("homePanel");
  const sessionPanel = document.getElementById("sessionPanel");

  const STEPS = [
    { id: "q1", label: "大問1（語彙）", tag: "VOCABULARY", reason: "語彙をすべて学習し、最終チェックをCLEARします。" },
    { id: "paraphrase", label: "言い換え", tag: "PARAPHRASE", reason: "全問題を回答し、自己判定を登録します。" },
    { id: "writing", label: "英作文", tag: "WRITING", reason: "各題を最後まで書き、参考解答とレビューします。" },
    { id: "dictation", label: "リスニング", tag: "LISTENING", reason: "全設問を聞き、解答と書き取りを確認します。" },
    { id: "q3", label: "大問3（長文）", tag: "READING", reason: "全本文の設問と内容整理を完了します。" },
  ];

  let manifest = null;
  let profile = null;
  let assets = null;
  let loaded = false;
  let loading = null;
  let summaries = [];
  let currentStepIndex = 0;

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
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function selectedQ1Id() {
    const savedProfile = readJson(PROFILE_KEY, null);
    if (savedProfile && manifest.q1[savedProfile.q1Id]) return savedProfile.q1Id;
    const saved = localStorage.getItem("eiken_q1_dataset");
    if (manifest.q1[saved]) return saved;
    return manifest.defaultDatasetId;
  }

  function selectedProfile() {
    const q1Id = selectedQ1Id();
    const q1 = manifest.q1[q1Id];
    const q3Id = manifest.q3[q1Id] ? q1Id : manifest.defaultDatasetId;
    const grade = q1Id.startsWith("eikenp2-") ? "pre2" : "2kyu";
    const dictSaved = readJson("eiken_dictation_dataset", {});
    const level = grade === "pre2" ? "p2" : "g2";
    const fallbackRound = q1Id.slice(q1Id.lastIndexOf("-") + 1);
    const round = dictSaved.level === level && manifest.dictation.levels[level].rounds[dictSaved.round]
      ? dictSaved.round
      : (manifest.dictation.levels[level].rounds[fallbackRound] ? fallbackRound : manifest.dictation.defaultRound);
    return {
      id: q1Id,
      grade,
      label: q1.label,
      q1Id,
      q3Id,
      dictation: { level, round },
      writingGrade: grade,
    };
  }

  async function getJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.json();
  }

  async function loadAssets() {
    profile = selectedProfile();
    const q1Data = manifest.q1[profile.q1Id];
    const q3Data = manifest.q3[profile.q3Id];
    const dictData = manifest.dictation.levels[profile.dictation.level];
    const [q1, q3, paraphrase, writing, dictation] = await Promise.all([
      getJson(q1Data.questionsUrl),
      getJson(q3Data.dataUrl),
      getJson(PARAPHRASE_URL),
      getJson(WRITING_URL),
      getJson(dictData.rounds[profile.dictation.round]),
    ]);
    assets = { q1, q3, paraphrase, writing, dictation };
    loaded = true;
  }

  async function ensureLoaded() {
    if (loaded && profile && profile.id === selectedProfile().id) return;
    if (loading) return loading;
    loading = (async () => {
      manifest = await getJson(MANIFEST_URL);
      await loadAssets();
    })().finally(() => { loading = null; });
    return loading;
  }

  function routeState() {
    return readJson(ROUTE_KEY, { version: 1, profileId: null, currentStep: 0 });
  }

  function saveRouteState() {
    try {
      localStorage.setItem(ROUTE_KEY, JSON.stringify({
        version: 1,
        profileId: profile ? profile.id : null,
        currentStep: currentStepIndex,
      }));
    } catch (error) { /* 保存できなくても演習は続ける */ }
  }

  function q1Summary() {
    const data = assets.q1 || {};
    const questions = Array.isArray(data.questions) ? data.questions : [];
    const saved = readJson(`eiken_q1_progress_${profile.q1Id}`, null)
      || (profile.q1Id === manifest.defaultDatasetId ? readJson("eiken2_q1_v1", {}) : {});
    const units = saved.units && typeof saved.units === "object" ? saved.units : {};
    const learned = questions.filter((question) => units[question.q] && units[question.q].learned).length;
    const clear = Boolean(saved.finalCheck && saved.finalCheck.cleared);
    const next = questions.find((question) => !(units[question.q] && units[question.q].learned));
    return {
      complete: clear,
      completed: clear ? questions.length : learned,
      total: questions.length,
      status: clear ? "done" : learned ? "progress" : "ready",
      nextLabel: clear ? "CLEAR済み" : next ? `第${next.q}問を学習` : "最終チェックに挑戦",
      detail: clear ? "最終チェックCLEAR" : `${learned} / ${questions.length}問・${saved.resume ? "途中保存あり" : "未完了"}`,
    };
  }

  function paraphraseSummary() {
    const questions = Array.isArray(assets.paraphrase.questions) ? assets.paraphrase.questions : [];
    const saved = readJson("eiken_paraphrase_practice_v1", {});
    const units = saved.units && typeof saved.units === "object" ? saved.units : {};
    const completed = questions.filter((question) => units[question.id] && units[question.id].solved).length;
    const next = questions.find((question) => !(units[question.id] && units[question.id].solved));
    return {
      complete: completed === questions.length && questions.length > 0,
      completed,
      total: questions.length,
      status: completed === questions.length && questions.length > 0 ? "done" : completed ? "progress" : "ready",
      nextLabel: next ? `${next.targetJa}を練習` : "全問題を確認済み",
      detail: `${completed} / ${questions.length}問・${saved.resume ? "途中保存あり" : ""}`,
    };
  }

  function writingSummary() {
    const questions = (Array.isArray(assets.writing) ? assets.writing : [])
      .filter((question) => question.grade === profile.writingGrade);
    const saved = readJson("eiken_writing_progress_v1", {});
    const completed = questions.filter((question) => saved[question.id]).length;
    const next = questions.find((question) => !saved[question.id]);
    return {
      complete: completed === questions.length && questions.length > 0,
      completed,
      total: questions.length,
      status: completed === questions.length && questions.length > 0 ? "done" : completed ? "progress" : "ready",
      nextLabel: next ? `${next.round}の英作文` : "全問題をレビュー済み",
      detail: `${completed} / ${questions.length}題・${saved ? "下書きは自動保存" : ""}`,
    };
  }

  function dictationSummary() {
    const lessons = Array.isArray(assets.dictation.lessons) ? assets.dictation.lessons : [];
    const key = `eiken_dictation_progress_${profile.dictation.level}_${profile.dictation.round}`;
    const saved = readJson(key, {});
    const answered = lessons.filter((lesson) => Object.prototype.hasOwnProperty.call(saved, String(lesson.id))).length;
    const next = lessons.find((lesson) => !Object.prototype.hasOwnProperty.call(saved, String(lesson.id)));
    return {
      complete: answered === lessons.length && lessons.length > 0,
      completed: answered,
      total: lessons.length,
      status: answered === lessons.length && lessons.length > 0 ? "done" : answered ? "progress" : "ready",
      nextLabel: next ? `No. ${next.id}を聞く` : "全設問を確認済み",
      detail: `${answered} / ${lessons.length}問・${profile.dictation.level === "g2" ? "2級" : "準2級"}`,
    };
  }

  function q3Summary() {
    const passages = Array.isArray(assets.q3.passages) ? assets.q3.passages : [];
    const saved = readJson(`eiken2q3.progress.${profile.q3Id}`, {});
    const questions = saved.questions && typeof saved.questions === "object" ? saved.questions : {};
    const summaries = saved.summaries && typeof saved.summaries === "object" ? saved.summaries : {};
    const completePassages = passages.filter((passage) => {
      const questionsDone = passage.questions.every((question) => questions[question.q] && questions[question.q].answered);
      return questionsDone && summaries[passage.id] && summaries[passage.id].graded;
    }).length;
    const next = passages.find((passage) => {
      const questionsDone = passage.questions.every((question) => questions[question.q] && questions[question.q].answered);
      return !(questionsDone && summaries[passage.id] && summaries[passage.id].graded);
    });
    let nextLabel = "全本文を完了";
    if (next) {
      const questionsDone = next.questions.every((question) => questions[question.q] && questions[question.q].answered);
      nextLabel = questionsDone ? `${next.title}の内容整理` : `${next.title}の設問`;
    }
    return {
      complete: completePassages === passages.length && passages.length > 0,
      completed: completePassages,
      total: passages.length,
      status: completePassages === passages.length && passages.length > 0 ? "done" : completePassages ? "progress" : "ready",
      nextLabel,
      detail: `${completePassages} / ${passages.length}本文・${saved.resume ? "途中保存あり" : ""}`,
    };
  }

  function collectSummaries() {
    summaries = [q1Summary(), paraphraseSummary(), writingSummary(), dictationSummary(), q3Summary()];
    const firstIncomplete = summaries.findIndex((summary) => !summary.complete);
    currentStepIndex = firstIncomplete >= 0 ? firstIncomplete : STEPS.length - 1;
    saveRouteState();
    return summaries;
  }

  function statusLabel(summary, index) {
    if (summary.complete) return "完了";
    if (index === currentStepIndex) return "現在の段階";
    return "順番待ち";
  }

  function primaryLabel(summary) {
    if (summary.status === "progress") return "続きから進める";
    if (summary.status === "ready") return "この段階を始める";
    return "復習する";
  }

  function setSerialPreferences() {
    try {
      localStorage.setItem("eiken_q1_dataset", profile.q1Id);
      localStorage.setItem("eiken_q3_dataset", profile.q3Id);
      localStorage.setItem("eiken_dictation_dataset", JSON.stringify(profile.dictation));
    } catch (error) { /* 各モード側の既存設定を優先しても演習は続ける */ }
    window.EikenSerialProfile = profile;
  }

  function startCurrent() {
    const step = STEPS[currentStepIndex];
    if (!step) return;
    setSerialPreferences();
    window.EikenSerialContext = { active: true, stepId: step.id, profileId: profile.id };
    if (window.EikenAppRouter) window.EikenAppRouter.open(step.id, { serial: true });
  }

  function renderHome() {
    collectSummaries();
    const current = STEPS[currentStepIndex];
    const currentSummary = summaries[currentStepIndex];
    const allComplete = summaries.every((summary) => summary.complete);
    homePanel.className = "serialHome";
    sessionPanel.className = "hide";
    const cards = STEPS.map((step, index) => {
      const summary = summaries[index];
      const locked = index > currentStepIndex && !summary.complete;
      const cls = `serialStepCard ${summary.complete ? "isDone" : index === currentStepIndex ? "isCurrent" : "isLocked"}`;
      const progress = summary.total ? `${summary.completed} / ${summary.total}` : "—";
      return `<article class="${cls}">
        <div class="serialStepTop"><span class="serialStepNo">${String(index + 1).padStart(2, "0")}</span><span class="serialStepTag">${step.tag}</span><span class="serialStepStatus">${statusLabel(summary, index)}</span></div>
        <h3>${step.label}</h3>
        <p>${escapeHtml(summary.detail || step.reason)}</p>
        <div class="serialStepProgress"><strong>${progress}</strong><span>${escapeHtml(summary.nextLabel)}</span></div>
        ${locked ? `<p class="serialLock">前の段階を完了すると解放されます。</p>` : ""}
      </article>`;
    }).join("");

    homePanel.innerHTML = `<section class="card hero serialHero">
      <p class="label">SERIAL COURSE / ${escapeHtml(profile.label)}</p>
      <h2>${allComplete ? "直列コースを完了しました" : `${current.label}を進める`}</h2>
      <p class="serialLead">大問1 → 言い換え → 英作文 → リスニング → 大問3の順に、一つずつ進みます。</p>
      <div class="serialCurrent"><span class="label">${allComplete ? "コース完了" : "現在の学習"}</span><strong>${allComplete ? "最初から復習できます" : current.label}</strong><span>${escapeHtml(allComplete ? "記録は残したまま、各段階を復習できます。" : currentSummary.detail)}</span></div>
      <div class="actions"><button class="cta serialPrimary" type="button" id="serialStartBtn">${allComplete ? "大問1から復習する" : primaryLabel(currentSummary)}</button></div>
      <div class="serialModeLinks"><button class="ghost" type="button" id="serialFreeBtn">自由演習へ</button><button class="ghost" type="button" id="serialGradeBtn">級を変更</button></div>
    </section>
    <section class="card serialPathCard"><div class="sectionHead"><div><p class="label">学習順</p><h2>5段階のコース</h2></div><p class="hint">完了した段階は復習できます。</p></div><div class="serialStepList">${cards}</div></section>
    <section class="card serialNote"><p class="label">保存について</p><p>各モードの回答・下書き・途中位置は、これまでどおり各モードの保存領域に記録されます。この画面は次に進む段階だけを管理します。</p></section>`;

    document.getElementById("serialStartBtn").addEventListener("click", () => {
      if (allComplete) currentStepIndex = 0;
      startCurrent();
    });
    document.getElementById("serialFreeBtn").addEventListener("click", () => {
      if (window.EikenAppRouter) window.EikenAppRouter.open("free");
    });
    document.getElementById("serialGradeBtn").addEventListener("click", () => {
      if (window.EikenAppRouter) window.EikenAppRouter.open("entry");
    });
    if (window.EikenAppRouter) window.EikenAppRouter.refreshNav();
  }

  async function mount() {
    homePanel.className = "serialHome";
    sessionPanel.className = "hide";
    homePanel.innerHTML = `<div class="card"><p class="loading">学習ルートを読み込んでいます…</p></div>`;
    try {
      await ensureLoaded();
      window.EikenSerialContext = null;
      renderHome();
    } catch (error) {
      homePanel.innerHTML = `<div class="card"><h2>学習ルートを読み込めませんでした</h2><p>HTTPサーバー経由で起動しているか確認してください。</p><p class="hint">${escapeHtml(error.message)}</p></div>`;
      console.error(error);
    }
  }

  function isUnlocked(id) {
    if (id === "serial") return true;
    const index = STEPS.findIndex((step) => step.id === id);
    if (index < 0) return true;
    if (summaries.length) return index <= currentStepIndex;
    const saved = routeState();
    return index <= Number(saved.currentStep || 0);
  }

  function refreshNav() {
    if (loaded) collectSummaries();
  }

  function handleKey() { /* 直列コースはキーボード操作なし */ }

  return { mount, handleKey, isUnlocked, refreshNav };
})();

window.EikenSerialApp = EikenSerialApp;
