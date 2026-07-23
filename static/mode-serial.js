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
    { id: "q1", label: "大問1（語彙）", tag: "VOCABULARY", reason: "過去問3回分の語彙を学習し、各回の最終チェックをCLEARします。" },
    { id: "paraphrase", label: "言い換え", tag: "PARAPHRASE / SUB", reason: "補助練習8問を回答し、自己判定を登録します。過去問3回分の判定対象外です。" },
    { id: "writing", label: "英作文", tag: "WRITING", reason: "過去問3回分を書き、各題の参考解答とレビューを確認します。" },
    { id: "dictation", label: "リスニング", tag: "LISTENING", reason: "過去問3回分の全設問を聞き、解答と書き取りを確認します。" },
    { id: "q3", label: "大問3（長文）", tag: "READING", reason: "過去問3回分の本文・設問・内容整理を完了します。" },
  ];
  const PRE1_STEPS = [
    { id: "reading1", label: "大問1（語彙）", tag: "VOCABULARY", reason: "過去問3回分の語彙を、意味確認から4択まで学習します。" },
    { id: "reading2", label: "大問2（空所補充）", tag: "CLOZE", reason: "過去問3回分の空所補充問題を確認します。" },
    { id: "writing", label: "ライティング", tag: "WRITING", reason: "過去問3回分の英文要約・英作文を組み立て、レビューします。" },
    { id: "listening", label: "リスニング", tag: "LISTENING", reason: "過去問3回分の音声問題を聞き、解答と書き取りを確認します。" },
    { id: "reading3", label: "大問3（長文）", tag: "READING", reason: "過去問3回分の長文・根拠文・内容整理を完了します。" },
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

  function orderedIds(ids, activeId) {
    const unique = [...new Set(ids)].filter(Boolean);
    if (!activeId || !unique.includes(activeId)) return unique;
    return [activeId, ...unique.filter((id) => id !== activeId)];
  }

  function roundSuffix(id) {
    const match = String(id || "").match(/(\d{4}-\d+)$/);
    return match ? match[1] : "";
  }

  function profileRounds(q1Id, dictationRound) {
    const gradePrefix = q1Id.startsWith("eikenp2-") ? "eikenp2-" : "eiken2-";
    const q1Ids = orderedIds(
      Object.keys(manifest.q1).filter((id) => id.startsWith(gradePrefix)),
      q1Id,
    );
    const q3Ids = q1Ids.filter((id) => manifest.q3[id]);
    const dictationIds = orderedIds(
      manifest.dictation.rounds.map((round) => round.id),
      dictationRound,
    );
    return { q1: q1Ids, q3: q3Ids, dictation: dictationIds };
  }

  function roundLabel(type, id) {
    if (type === "dictation") {
      const round = manifest.dictation.rounds.find((item) => item.id === id);
      return round ? round.label : id;
    }
    const dataset = manifest[type] && manifest[type][id];
    return dataset ? dataset.label : id;
  }

  function selectedQ1Id() {
    const savedProfile = readJson(PROFILE_KEY, null);
    if (savedProfile && manifest.q1[savedProfile.q1Id]) return savedProfile.q1Id;
    const saved = localStorage.getItem("eiken_q1_dataset");
    if (manifest.q1[saved]) return saved;
    return manifest.defaultDatasetId;
  }

  function selectedProfile() {
    const savedProfile = readJson(PROFILE_KEY, null);
    if (savedProfile && savedProfile.grade === "pre1" && savedProfile.pre1Id && manifest.pre1) {
      const roundId = savedProfile.pre1Id.replace("eikenp1-", "");
      const round = manifest.pre1.rounds.find((item) => item.id === roundId) || manifest.pre1.rounds[0];
      return {
        id: savedProfile.pre1Id,
        grade: "pre1",
        label: savedProfile.label || `英検準1級 ${round.label}`,
        pre1Id: `eikenp1-${round.id}`,
        rounds: { pre1: manifest.pre1.rounds.map((item) => item.id) },
      };
    }
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
      rounds: profileRounds(q1Id, round),
    };
  }

  async function getJson(url) {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    return response.json();
  }

  async function loadAssets() {
    profile = selectedProfile();
    const q1Entries = await Promise.all(profile.rounds.q1.map(async (id) => [
      id,
      await getJson(manifest.q1[id].questionsUrl),
    ]));
    const q3Entries = await Promise.all(profile.rounds.q3.map(async (id) => [
      id,
      await getJson(manifest.q3[id].dataUrl),
    ]));
    const dictationEntries = await Promise.all(profile.rounds.dictation.map(async (round) => [
      round,
      await getJson(manifest.dictation.levels[profile.dictation.level].rounds[round]),
    ]));
    const [paraphrase, writing] = await Promise.all([
      getJson(PARAPHRASE_URL),
      getJson(WRITING_URL),
    ]);
    assets = {
      q1: Object.fromEntries(q1Entries),
      q3: Object.fromEntries(q3Entries),
      paraphrase,
      writing,
      dictation: Object.fromEntries(dictationEntries),
    };
    loaded = true;
  }

  async function loadPre1Assets() {
    profile = selectedProfile();
    const entries = await Promise.all(profile.rounds.pre1.map(async (roundId) => {
      const round = manifest.pre1.rounds.find((item) => item.id === roundId);
      return [roundId, await getJson(round.dataUrl)];
    }));
    assets = { pre1: Object.fromEntries(entries) };
    loaded = true;
  }

  async function ensureLoaded() {
    const nextProfile = manifest ? selectedProfile() : null;
    if (loaded && profile && nextProfile && profile.id === nextProfile.id
      && (profile.grade === "pre1" || profile.dictation.round === nextProfile.dictation.round)) return;
    if (loading) return loading;
    loading = (async () => {
      manifest = await getJson(MANIFEST_URL);
      profile = selectedProfile();
      if (profile.grade === "pre1") await loadPre1Assets();
      else await loadAssets();
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
    const roundIds = profile.rounds.q1;
    const roundSummaries = roundIds.map((id) => {
      const data = assets.q1[id] || {};
      const questions = Array.isArray(data.questions) ? data.questions : [];
      const saved = readJson(`eiken_q1_progress_${id}`, null)
        || (id === manifest.defaultDatasetId ? readJson("eiken2_q1_v1", {}) : {});
      const units = saved.units && typeof saved.units === "object" ? saved.units : {};
      const learned = questions.filter((question) => units[question.q] && units[question.q].learned).length;
      const clear = Boolean(saved.finalCheck && saved.finalCheck.cleared);
      return { id, questions, saved, learned, clear };
    });
    const completedRounds = roundSummaries.filter((round) => round.clear).length;
    const learnedQuestions = roundSummaries.reduce((sum, round) => sum + round.learned, 0);
    const totalQuestions = roundSummaries.reduce((sum, round) => sum + round.questions.length, 0);
    const nextRound = roundSummaries.find((round) => !round.clear);
    const next = nextRound && nextRound.questions.find((question) => !(nextRound.saved.units && nextRound.saved.units[question.q] && nextRound.saved.units[question.q].learned));
    const inProgress = learnedQuestions > 0 || completedRounds > 0;
    const nextLabel = !nextRound
      ? "3回分CLEAR済み"
      : next
        ? `${roundLabel("q1", nextRound.id)}・第${next.q}問を学習`
        : `${roundLabel("q1", nextRound.id)}・最終チェックに挑戦`;
    return {
      complete: completedRounds === roundIds.length && roundIds.length > 0,
      completed: completedRounds,
      total: roundIds.length,
      status: completedRounds === roundIds.length && roundIds.length > 0 ? "done" : inProgress ? "progress" : "ready",
      nextId: nextRound ? nextRound.id : null,
      nextLabel,
      detail: `${completedRounds} / ${roundIds.length}回・${learnedQuestions} / ${totalQuestions}問${completedRounds === roundIds.length ? "・各回CLEAR" : ""}`,
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
      detail: `${completed} / ${questions.length}問・補助練習（過去問3回分の判定対象外）${saved.resume ? "・途中保存あり" : ""}`,
    };
  }

  function writingSummary() {
    const questions = (Array.isArray(assets.writing) ? assets.writing : [])
      .filter((question) => question.grade === profile.writingGrade);
    const saved = readJson("eiken_writing_progress_v1", {});
    const roundIds = [...new Set(questions.map((question) => question.round))].filter(Boolean);
    const completedQuestions = questions.filter((question) => saved[question.id]).length;
    const completedRounds = roundIds.filter((round) => {
      const roundQuestions = questions.filter((question) => question.round === round);
      return roundQuestions.length > 0 && roundQuestions.every((question) => saved[question.id]);
    }).length;
    const next = questions.find((question) => !saved[question.id]);
    return {
      complete: completedRounds === roundIds.length && roundIds.length > 0,
      completed: completedRounds,
      total: roundIds.length,
      status: completedRounds === roundIds.length && roundIds.length > 0 ? "done" : completedQuestions ? "progress" : "ready",
      nextLabel: next ? `${next.round}の英作文` : "全問題をレビュー済み",
      detail: `${completedRounds} / ${roundIds.length}回・${completedQuestions} / ${questions.length}題・下書きは自動保存`,
    };
  }

  function dictationSummary() {
    const roundIds = profile.rounds.dictation;
    const roundSummaries = roundIds.map((round) => {
      const lessons = Array.isArray(assets.dictation[round] && assets.dictation[round].lessons)
        ? assets.dictation[round].lessons
        : [];
      const saved = readJson(`eiken_dictation_progress_${profile.dictation.level}_${round}`, {});
      const answered = lessons.filter((lesson) => Object.prototype.hasOwnProperty.call(saved, String(lesson.id))).length;
      return { round, lessons, saved, answered };
    });
    const completedRounds = roundSummaries.filter((item) => item.lessons.length > 0 && item.answered === item.lessons.length).length;
    const answered = roundSummaries.reduce((sum, item) => sum + item.answered, 0);
    const totalLessons = roundSummaries.reduce((sum, item) => sum + item.lessons.length, 0);
    const nextRound = roundSummaries.find((item) => item.answered < item.lessons.length);
    const next = nextRound && nextRound.lessons.find((lesson) => !Object.prototype.hasOwnProperty.call(nextRound.saved, String(lesson.id)));
    return {
      complete: completedRounds === roundIds.length && roundIds.length > 0,
      completed: completedRounds,
      total: roundIds.length,
      status: completedRounds === roundIds.length && roundIds.length > 0 ? "done" : answered ? "progress" : "ready",
      nextId: nextRound ? nextRound.round : null,
      nextLabel: nextRound ? `${roundLabel("dictation", nextRound.round)}・No. ${next ? next.id : "確認"}を聞く` : "3回分確認済み",
      detail: `${completedRounds} / ${roundIds.length}回・${answered} / ${totalLessons}問・${profile.dictation.level === "g2" ? "2級" : "準2級"}`,
    };
  }

  function q3Summary() {
    const roundIds = profile.rounds.q3;
    const roundSummaries = roundIds.map((id) => {
      const data = assets.q3[id] || {};
      const passages = Array.isArray(data.passages) ? data.passages : [];
      const saved = readJson(`eiken2q3.progress.${id}`, {});
      const questions = saved.questions && typeof saved.questions === "object" ? saved.questions : {};
      const summaries = saved.summaries && typeof saved.summaries === "object" ? saved.summaries : {};
      const completePassages = passages.filter((passage) => {
        const questionsDone = passage.questions.every((question) => questions[question.q] && questions[question.q].answered);
        return questionsDone && summaries[passage.id] && summaries[passage.id].graded;
      }).length;
      const answeredQuestions = passages.reduce((sum, passage) => sum + passage.questions.filter((question) => questions[question.q] && questions[question.q].answered).length, 0);
      const totalQuestions = passages.reduce((sum, passage) => sum + passage.questions.length, 0);
      return { id, passages, saved, questions, summaries, completePassages, answeredQuestions, totalQuestions };
    });
    const completedRounds = roundSummaries.filter((round) => round.passages.length > 0 && round.completePassages === round.passages.length).length;
    const completedPassages = roundSummaries.reduce((sum, round) => sum + round.completePassages, 0);
    const totalPassages = roundSummaries.reduce((sum, round) => sum + round.passages.length, 0);
    const answeredQuestions = roundSummaries.reduce((sum, round) => sum + round.answeredQuestions, 0);
    const totalQuestions = roundSummaries.reduce((sum, round) => sum + round.totalQuestions, 0);
    const nextRound = roundSummaries.find((round) => round.completePassages < round.passages.length);
    const next = nextRound && nextRound.passages.find((passage) => {
      const questionsDone = passage.questions.every((question) => nextRound.questions[question.q] && nextRound.questions[question.q].answered);
      return !(questionsDone && nextRound.summaries[passage.id] && nextRound.summaries[passage.id].graded);
    });
    let nextLabel = "3回分完了";
    if (nextRound && next) {
      const questionsDone = next.questions.every((question) => nextRound.questions[question.q] && nextRound.questions[question.q].answered);
      nextLabel = `${roundLabel("q3", nextRound.id)}・${questionsDone ? `${next.title}の内容整理` : `${next.title}の設問`}`;
    }
    return {
      complete: completedRounds === roundIds.length && roundIds.length > 0,
      completed: completedRounds,
      total: roundIds.length,
      status: completedRounds === roundIds.length && roundIds.length > 0 ? "done" : answeredQuestions ? "progress" : "ready",
      nextId: nextRound ? nextRound.id : null,
      nextLabel,
      detail: `${completedRounds} / ${roundIds.length}回・${completedPassages} / ${totalPassages}本文・${answeredQuestions} / ${totalQuestions}設問`,
    };
  }

  function pre1RoundLabel(id) {
    const round = manifest.pre1.rounds.find((item) => item.id === id);
    return round ? round.label : id;
  }

  function pre1Sections(data) {
    const part3 = [];
    (data.reading && data.reading.part3 || []).forEach((passage) => {
      passage.questions.forEach((question) => part3.push({ ...question, passage }));
    });
    return [
      { id: "reading1", type: "questions", questions: data.reading && data.reading.part1 || [] },
      { id: "reading2", type: "questions", questions: data.reading && data.reading.part2 || [] },
      { id: "reading3", type: "questions", questions: part3 },
      { id: "listening", type: "questions", questions: data.listening || [] },
      { id: "writing", type: "writing", questions: data.writing || [] },
    ];
  }

  function pre1Progress(roundId) {
    const store = readJson("eiken_pre1_progress_v1", {});
    const saved = store.rounds && store.rounds[roundId] && typeof store.rounds[roundId] === "object"
      ? store.rounds[roundId]
      : {};
    return {
      questions: saved.questions && typeof saved.questions === "object" ? saved.questions : {},
      writing: saved.writing && typeof saved.writing === "object" ? saved.writing : {},
      summaries: saved.summaries && typeof saved.summaries === "object" ? saved.summaries : {},
      finalCheck: saved.finalCheck && typeof saved.finalCheck === "object" ? saved.finalCheck : {},
    };
  }

  function pre1QuestionKey(sectionId, question) { return `${sectionId}:${question.q}`; }

  function pre1SectionComplete(section, progress) {
    if (section.id === "reading1") {
      return section.questions.length > 0 && section.questions.every((question) => {
        const saved = progress.questions[pre1QuestionKey(section.id, question)];
        return saved && saved.answered && saved.correct;
      }) && Boolean(progress.finalCheck && progress.finalCheck.cleared);
    }
    if (section.type === "writing") {
      return section.questions.length > 0 && section.questions.every((task) => progress.writing[task.id] && progress.writing[task.id].reviewed);
    }
    const questionsDone = section.questions.length > 0 && section.questions.every((question) => {
      const saved = progress.questions[pre1QuestionKey(section.id, question)];
      return saved && saved.answered;
    });
    if (section.id !== "reading3" || !questionsDone) return questionsDone;
    const passages = [...new Map(section.questions.map((question) => [question.passage.id, question.passage])).values()];
    return passages.every((passage) => progress.summaries[passage.id] && progress.summaries[passage.id].graded);
  }

  function pre1SectionStats(section, progress) {
    if (section.type === "writing") {
      const done = section.questions.filter((task) => progress.writing[task.id] && progress.writing[task.id].reviewed).length;
      return { done, total: section.questions.length };
    }
    const answered = section.questions.filter((question) => {
      const saved = progress.questions[pre1QuestionKey(section.id, question)];
      return saved && saved.answered;
    });
    return {
      done: answered.length,
      total: section.questions.length,
      correct: answered.filter((question) => progress.questions[pre1QuestionKey(section.id, question)].correct).length,
    };
  }

  function pre1StepSummary(step) {
    const roundSummaries = profile.rounds.pre1.map((roundId) => {
      const section = pre1Sections(assets.pre1[roundId] || {}).find((item) => item.id === step.id);
      const progress = pre1Progress(roundId);
      const stats = pre1SectionStats(section, progress);
      return { id: roundId, section, progress, stats, complete: pre1SectionComplete(section, progress) };
    });
    const completedRounds = roundSummaries.filter((round) => round.complete).length;
    const done = roundSummaries.reduce((sum, round) => sum + round.stats.done, 0);
    const total = roundSummaries.reduce((sum, round) => sum + round.stats.total, 0);
    const nextRound = roundSummaries.find((round) => !round.complete);
    let nextLabel = "3回分完了";
    if (nextRound) {
      if (step.id === "writing") {
        const next = nextRound.section.questions.find((task) => !(nextRound.progress.writing[task.id] && nextRound.progress.writing[task.id].reviewed));
        nextLabel = `${pre1RoundLabel(nextRound.id)}・${next ? `課題${next.number || next.id}` : "レビュー"}`;
      } else {
        const next = nextRound.section.questions.find((question) => {
          const saved = nextRound.progress.questions[pre1QuestionKey(step.id, question)];
          return !(saved && saved.answered && (step.id !== "reading1" || saved.correct));
        });
        const q1Ready = step.id === "reading1" && !next
          && nextRound.progress.finalCheck && nextRound.progress.finalCheck.cleared !== true;
        nextLabel = `${pre1RoundLabel(nextRound.id)}・${next ? `第${next.q}問` : q1Ready ? "最終チェック" : "内容整理"}`;
      }
    }
    const inProgress = done > 0 || completedRounds > 0;
    const unit = step.id === "writing" ? "題" : "問";
    return {
      complete: completedRounds === profile.rounds.pre1.length && profile.rounds.pre1.length > 0,
      completed: completedRounds,
      total: profile.rounds.pre1.length,
      status: completedRounds === profile.rounds.pre1.length && profile.rounds.pre1.length > 0 ? "done" : inProgress ? "progress" : "ready",
      nextId: nextRound ? nextRound.id : null,
      nextLabel,
      detail: `${completedRounds} / ${profile.rounds.pre1.length}回・${done} / ${total}${unit}`,
    };
  }

  function collectPre1Summaries() {
    summaries = PRE1_STEPS.map((step) => pre1StepSummary(step));
    const firstIncomplete = summaries.findIndex((summary) => !summary.complete);
    currentStepIndex = firstIncomplete >= 0 ? firstIncomplete : PRE1_STEPS.length - 1;
    saveRouteState();
    return summaries;
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

  function renderPre1Home() {
    collectPre1Summaries();
    const current = PRE1_STEPS[currentStepIndex];
    const currentSummary = summaries[currentStepIndex];
    const allComplete = summaries.every((summary) => summary.complete);
    homePanel.className = "serialHome";
    sessionPanel.className = "hide";
    const cards = PRE1_STEPS.map((step, index) => {
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
      <p class="serialLead">大問1（語彙） → 大問2（空所補充） → ライティング → リスニング → 大問3（長文）の順に進みます。</p>
      <div class="serialCurrent"><span class="label">${allComplete ? "コース完了" : "現在の学習"}</span><strong>${allComplete ? "最初から復習できます" : current.label}</strong><span>${escapeHtml(allComplete ? "記録は残したまま、各段階を復習できます。" : currentSummary.detail)}</span></div>
      <div class="actions"><button class="cta serialPrimary" type="button" id="serialStartBtn">${allComplete ? "大問1から復習する" : primaryLabel(currentSummary)}</button></div>
      <div class="serialModeLinks"><button class="ghost" type="button" id="serialFreeBtn">自由演習へ</button><button class="ghost" type="button" id="serialGradeBtn">級を変更</button></div>
    </section>
    <section class="card serialPathCard"><div class="sectionHead"><div><p class="label">学習順</p><h2>5段階のコース</h2></div><p class="hint">準1級の過去問3回分を、セクションごとに進めます。</p></div><div class="serialStepList">${cards}</div></section>
    <section class="card serialNote"><p class="label">保存について</p><p>準1級の各回の回答・下書き・途中位置は、準1級モードと同じ保存領域を使います。主要5セクションは3回分が完了するまで次の段階へ進みません。</p></section>`;

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

  function q1IdForRound(round) {
    return profile.rounds.q1.find((id) => roundSuffix(id) === round) || profile.q1Id;
  }

  function q3IdForRound(round) {
    return profile.rounds.q3.find((id) => roundSuffix(id) === round) || profile.q3Id;
  }

  function setSerialPreferences(step, summary) {
    if (profile.grade === "pre1") {
      const activeRound = summary.nextId || profile.pre1Id.replace("eikenp1-", "");
      try { localStorage.setItem("eiken_pre1_round", activeRound); } catch (error) { /* その場の演習は続ける */ }
      return profile;
    }
    const activeProfile = {
      ...profile,
      dictation: { ...profile.dictation },
    };
    let activeRound = "";
    if (step.id === "q1" || step.id === "q3") activeRound = roundSuffix(summary.nextId);
    if (step.id === "dictation") activeRound = summary.nextId || "";
    if (activeRound) {
      activeProfile.q1Id = q1IdForRound(activeRound);
      activeProfile.q3Id = q3IdForRound(activeRound);
      activeProfile.dictation.round = profile.rounds.dictation.includes(activeRound)
        ? activeRound
        : activeProfile.dictation.round;
    }
    try {
      localStorage.setItem("eiken_q1_dataset", activeProfile.q1Id);
      localStorage.setItem("eiken_q3_dataset", activeProfile.q3Id);
      localStorage.setItem("eiken_dictation_dataset", JSON.stringify(activeProfile.dictation));
    } catch (error) { /* 各モード側の既存設定を優先しても演習は続ける */ }
    window.EikenSerialProfile = activeProfile;
    return activeProfile;
  }

  function startCurrent() {
    const steps = profile.grade === "pre1" ? PRE1_STEPS : STEPS;
    const step = steps[currentStepIndex];
    if (!step) return;
    const summary = summaries[currentStepIndex];
    setSerialPreferences(step, summary);
    if (profile.grade === "pre1") {
      window.EikenSerialContext = {
        active: true,
        stepId: step.id,
        roundId: summary.nextId || profile.pre1Id.replace("eikenp1-", ""),
        profileId: profile.id,
      };
      if (window.EikenAppRouter) window.EikenAppRouter.open("pre1", { serial: true });
      return;
    }
    window.EikenSerialContext = { active: true, stepId: step.id, profileId: profile.id };
    if (window.EikenAppRouter) window.EikenAppRouter.open(step.id, { serial: true });
  }

  function renderHome() {
    if (profile && profile.grade === "pre1") return renderPre1Home();
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
      <p class="serialLead">大問1（3回分） → 言い換え（補助） → 英作文（3回分） → リスニング（3回分） → 大問3（3回分）の順に進みます。</p>
      <div class="serialCurrent"><span class="label">${allComplete ? "コース完了" : "現在の学習"}</span><strong>${allComplete ? "最初から復習できます" : current.label}</strong><span>${escapeHtml(allComplete ? "記録は残したまま、各段階を復習できます。" : currentSummary.detail)}</span></div>
      <div class="actions"><button class="cta serialPrimary" type="button" id="serialStartBtn">${allComplete ? "大問1から復習する" : primaryLabel(currentSummary)}</button></div>
      <div class="serialModeLinks"><button class="ghost" type="button" id="serialFreeBtn">自由演習へ</button><button class="ghost" type="button" id="serialGradeBtn">級を変更</button></div>
    </section>
    <section class="card serialPathCard"><div class="sectionHead"><div><p class="label">学習順</p><h2>5段階のコース</h2></div><p class="hint">主要4パートは過去問3回分。言い換えは補助練習です。</p></div><div class="serialStepList">${cards}</div></section>
    <section class="card serialNote"><p class="label">保存について</p><p>各回の回答・下書き・途中位置は、これまでどおり回ごとの保存領域に記録されます。主要4パートは3回分が完了するまで次の段階へ進みません。</p></section>`;

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
    if (loaded) {
      if (profile && profile.grade === "pre1") collectPre1Summaries();
      else collectSummaries();
    }
  }

  function stepSummaries() {
    if (!loaded || !profile) return null;
    if (profile.grade === "pre1") collectPre1Summaries();
    else collectSummaries();
    const steps = profile.grade === "pre1" ? PRE1_STEPS : STEPS;
    return {
      currentIndex: currentStepIndex,
      steps: steps.map((step, index) => ({
        id: step.id,
        label: step.label,
        complete: Boolean(summaries[index] && summaries[index].complete),
      })),
    };
  }

  function handleKey() { /* 直列コースはキーボード操作なし */ }

  return { mount, handleKey, isUnlocked, refreshNav, stepSummaries };
})();

window.EikenSerialApp = EikenSerialApp;
