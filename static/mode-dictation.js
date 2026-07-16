"use strict";
/* ============================================================
   英検 リスニング・ディクテーション モード
   kobun-vocab と同じ方式で IIFE に閉じ、{ mount, handleKey } のみを公開する。
   共有 #homePanel / #sessionPanel を他モードと共用するため、
   本モード表示中のマークアップは #sessionPanel 内の .dictSession に描画し、
   スタイルは .dictSession でスコープして上書きする。
   進捗の保存キー（localStorage）・クラウド同期のappId（eiken-dictation）は
   統合前の eiken-dictation リポと同じものを維持し、既存の生徒進捗を引き継ぐ。
   ============================================================ */

const EikenDictationApp = (function () {

const APP_ID = "eiken-dictation";
const MANIFEST_URL = "data/manifest.json";
const PROGRESS_PREFIX = "eiken_dictation_progress_";

const homePanel = document.getElementById("homePanel");
const sessionPanel = document.getElementById("sessionPanel");

let ROUNDS = [];
let DEFAULT_ROUND = "2026-1";
let datasets = {};
let cloud = null;
let booted = false;

async function loadManifest() {
  const manifest = await fetch(MANIFEST_URL, { cache: "no-store" }).then((r) => r.json());
  const d = manifest.dictation;
  ROUNDS = d.rounds;
  DEFAULT_ROUND = d.defaultRound;
  datasets = d.levels;
}

function progressKey(level, round) {
  return `${PROGRESS_PREFIX}${level}_${round}`;
}

function loadAnswers(level, round) {
  try {
    const raw = localStorage.getItem(progressKey(level, round));
    if (raw) return new Map(Object.entries(JSON.parse(raw)).map(([id, v]) => [Number(id), v]));
  } catch (e) {
    /* ignore */
  }
  return new Map();
}

function saveAnswers() {
  try {
    localStorage.setItem(progressKey(state.level, state.round), JSON.stringify(Object.fromEntries(state.answers)));
    if (cloud) cloud.queueSave();
  } catch (e) {
    /* ignore */
  }
}

function cloudPayload() {
  const out = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !key.startsWith(PROGRESS_PREFIX)) continue;
    try {
      out[key.slice(PROGRESS_PREFIX.length)] = JSON.parse(localStorage.getItem(key));
    } catch {
      // 壊れたローカル記録は送信しない。
    }
  }
  return { version: 1, datasets: out };
}

function applyCloudPayload(payload) {
  const cloudDatasets = payload && typeof payload === "object" ? payload.datasets : null;
  if (!cloudDatasets || typeof cloudDatasets !== "object") return;
  Object.entries(cloudDatasets).forEach(([key, answers]) => {
    if (answers && typeof answers === "object") {
      localStorage.setItem(`${PROGRESS_PREFIX}${key}`, JSON.stringify(answers));
    }
  });
}

const state = {
  level: "g2",
  round: DEFAULT_ROUND,
  lessons: [],
  index: 0,
  mode: "problem",
  answers: new Map(),
  segment: { start: 0, end: 0 },
  selected: null,
  seeking: false,
  playhead: 0,
  loop: false,
  audioUrl: null,
  audioLoadToken: 0,
};

let els = {};

function renderShell() {
  sessionPanel.innerHTML = `
    <div class="dictSession">
      <div class="dictHead">
        <p class="roundInfo" id="dictGradeLabel">EIKEN GRADE 2</p>
        <div class="datasetPicker">
          <label class="fieldLabel" for="dictStudySelect">問題セット</label>
          <select id="dictStudySelect" class="datasetSelect"></select>
        </div>
      </div>

      <div class="stageBar" aria-label="進行状況">
        <span id="dictModeProblem" class="stagePill active" aria-current="step">① 問題</span>
        <span id="dictModeDictation" class="stagePill">② 書き取り</span>
        <span id="dictModeReview" class="stagePill">③ 答えとスクリプト</span>
      </div>

      <div class="dictLayout">
        <aside class="dictSidebar" aria-label="問題一覧">
          <div class="dictSideHead">
            <p class="label">Questions</p>
            <p id="dictScoreLine" class="dictScore">0 / 30</p>
          </div>
          <div id="dictQuestionList" class="dictQuestionList"></div>
        </aside>

        <section class="dictWorkbench">
          <div class="dictLessonHead">
            <div>
              <p id="dictPartLabel" class="label">Part</p>
              <h2 id="dictLessonTitle">読み込み中…</h2>
            </div>
            <div id="dictResultBadge" class="dictBadge" aria-live="polite">未解答</div>
          </div>

          <div class="card">
            <h3 class="dictStepTitle">1. 音声を聞く</h3>
            <audio id="dictAudio" preload="metadata"></audio>
            <div class="dictTransport">
              <button id="dictPlayBtn" class="cta dictPlay" type="button">▶ 音声を聞く</button>
              <button id="dictBackBtn" class="ghost" type="button">5秒戻る</button>
              <details class="dictSettings">
                <summary>再生設定</summary>
                <div class="dictSettingsBody">
                  <button id="dictReplayBtn" class="ghost" type="button">音声を先頭から再生</button>
                  <button id="dictLoopBtn" class="ghost" type="button" aria-pressed="false">区間を繰り返す</button>
                  <label class="dictSpeed">
                    <span class="fieldLabel">速度</span>
                    <select id="dictSpeedSelect" aria-label="再生速度">
                      <option value="1">1.00x（おすすめ）</option>
                      <option value="0.85">0.85x</option>
                      <option value="0.7">0.70x</option>
                    </select>
                  </label>
                </div>
              </details>
            </div>
            <div class="dictTimelineRow">
              <span id="dictTimeNow">0:00</span>
              <input id="dictTimeline" type="range" min="0" max="1000" value="0" aria-label="再生位置">
              <span id="dictTimeEnd">0:00</span>
            </div>
            <details class="dictSegmentEdit">
              <summary>区間調整</summary>
              <div class="dictTrimPanel">
                <div class="dictTrimActions">
                  <button id="dictSetStartBtn" class="ghost" type="button">ここから開始</button>
                  <button id="dictSetEndBtn" class="ghost" type="button">ここで終了</button>
                  <button id="dictResetSegmentBtn" class="ghost" type="button">区間設定を解除</button>
                </div>
                <div class="dictTrimGrid">
                  <label>
                    <span>開始</span>
                    <input id="dictStartInput" type="range" min="0" max="1000" value="0" aria-label="開始位置">
                    <strong id="dictStartValue">0:00</strong>
                  </label>
                  <label>
                    <span>終了</span>
                    <input id="dictEndInput" type="range" min="0" max="1000" value="1000" aria-label="終了位置">
                    <strong id="dictEndValue">0:00</strong>
                  </label>
                </div>
              </div>
            </details>
          </div>

          <div id="dictProblemPanel" class="card"></div>
          <div id="dictDictationPanel" class="card hide"></div>
          <div id="dictReviewPanel" class="card hide"></div>
        </section>
      </div>
    </div>
  `;

  els = {
    audio: document.getElementById("dictAudio"),
    studySelect: document.getElementById("dictStudySelect"),
    gradeLabel: document.getElementById("dictGradeLabel"),
    questionList: document.getElementById("dictQuestionList"),
    scoreLine: document.getElementById("dictScoreLine"),
    partLabel: document.getElementById("dictPartLabel"),
    lessonTitle: document.getElementById("dictLessonTitle"),
    resultBadge: document.getElementById("dictResultBadge"),
    playBtn: document.getElementById("dictPlayBtn"),
    replayBtn: document.getElementById("dictReplayBtn"),
    backBtn: document.getElementById("dictBackBtn"),
    loopBtn: document.getElementById("dictLoopBtn"),
    speedSelect: document.getElementById("dictSpeedSelect"),
    timeline: document.getElementById("dictTimeline"),
    timeNow: document.getElementById("dictTimeNow"),
    timeEnd: document.getElementById("dictTimeEnd"),
    startInput: document.getElementById("dictStartInput"),
    endInput: document.getElementById("dictEndInput"),
    startValue: document.getElementById("dictStartValue"),
    endValue: document.getElementById("dictEndValue"),
    setStartBtn: document.getElementById("dictSetStartBtn"),
    setEndBtn: document.getElementById("dictSetEndBtn"),
    resetSegmentBtn: document.getElementById("dictResetSegmentBtn"),
    problemPanel: document.getElementById("dictProblemPanel"),
    dictationPanel: document.getElementById("dictDictationPanel"),
    reviewPanel: document.getElementById("dictReviewPanel"),
    tabs: {
      problem: document.getElementById("dictModeProblem"),
      dictation: document.getElementById("dictModeDictation"),
      review: document.getElementById("dictModeReview"),
    },
  };
}

function renderStudyOptions() {
  const options = Object.entries(datasets).flatMap(([level, dataset]) =>
    ROUNDS.filter((round) => dataset.rounds[round.id]).map((round) => ({
      value: `${level}::${round.id}`,
      label: `${level === "g2" ? "2級" : "準2級"}・${round.label}`,
    })),
  );
  els.studySelect.innerHTML = options
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join("");
  els.studySelect.value = `${state.level}::${state.round}`;
}

async function loadLevel(level, round = state.round) {
  const dataset = datasets[level];
  if (!dataset) return;
  const file = dataset.rounds[round];
  if (!file) return;
  try {
    const response = await fetch(file, { cache: "no-store" });
    if (!response.ok) throw new Error(`lessons load failed: ${response.status}`);
    const payload = await response.json();
    if (!payload.lessons || payload.lessons.length === 0) throw new Error("lessons empty");
    state.level = level;
    state.round = round;
    state.lessons = payload.lessons;
    state.answers = loadAnswers(level, round);
    const nextUpIndex = state.lessons.findIndex((lesson) => !state.answers.has(lesson.id));
    state.index = nextUpIndex >= 0 ? nextUpIndex : 0;
    state.mode = "problem";
    state.selected = null;
    renderStudyOptions();
    els.gradeLabel.textContent = dataset.grade;
    renderAll();
  } catch (error) {
    showLoadError(error);
  }
}

function showLoadError(error) {
  console.error(error);
  els.lessonTitle.textContent = "読み込みに失敗しました";
  els.playBtn.disabled = true;
  els.problemPanel.classList.remove("hide");
  els.problemPanel.innerHTML =
    '<p class="feedback ng" aria-live="polite">問題データを読み込めませんでした。ページを再読み込みするか、data/lessons.json を確認してください。</p>';
}

function bindEvents() {
  els.studySelect.addEventListener("change", () => {
    els.audio.pause();
    const [level, round] = els.studySelect.value.split("::");
    loadLevel(level, round);
  });
  els.playBtn.addEventListener("click", togglePlay);
  els.replayBtn.addEventListener("click", () => playFromStart());
  els.backBtn.addEventListener("click", () => {
    els.audio.currentTime = Math.max(state.segment.start, els.audio.currentTime - 5);
    els.audio.play();
  });
  els.loopBtn.addEventListener("click", toggleLoop);
  els.speedSelect.addEventListener("change", () => {
    els.audio.playbackRate = Number(els.speedSelect.value);
  });
  els.audio.addEventListener("timeupdate", updateTimeline);
  els.audio.addEventListener("pause", () => {
    els.playBtn.textContent = "▶ 音声を聞く";
  });
  els.audio.addEventListener("play", () => {
    els.playBtn.textContent = "■ 一時停止";
  });
  els.timeline.addEventListener("input", () => {
    state.seeking = true;
    const ratio = Number(els.timeline.value) / 1000;
    state.playhead = state.segment.start + ratio * segmentLength();
    els.audio.currentTime = state.playhead;
    state.seeking = false;
  });
  els.startInput.addEventListener("input", () => updateSegmentFromSliders("start"));
  els.endInput.addEventListener("input", () => updateSegmentFromSliders("end"));
  els.setStartBtn.addEventListener("click", () => setTrimPoint("start"));
  els.setEndBtn.addEventListener("click", () => setTrimPoint("end"));
  els.resetSegmentBtn.addEventListener("click", resetSegment);
}

function renderAll() {
  const lesson = currentLesson();
  if (!lesson) return;
  state.selected = null;
  state.segment = { start: lesson.start, end: lesson.end };
  loadAudioForLesson(lesson);
  els.audio.playbackRate = Number(els.speedSelect.value);
  els.partLabel.textContent = `PART ${lesson.part}`;
  els.lessonTitle.textContent = `No. ${lesson.id}`;
  syncSegmentInputs();
  renderQuestionList();
  renderPanels();
  updateScore();
  updateBadge();
}

async function loadAudioForLesson(lesson) {
  const token = ++state.audioLoadToken;
  els.audio.pause();
  els.playBtn.disabled = true;
  els.playBtn.textContent = "読込中…";
  if (state.audioUrl) {
    URL.revokeObjectURL(state.audioUrl);
    state.audioUrl = null;
  }
  els.audio.removeAttribute("src");
  els.audio.load();
  try {
    const response = await fetch(lesson.audio, { cache: "no-store" });
    if (!response.ok) throw new Error(`audio load failed: ${response.status}`);
    const blob = await response.blob();
    if (token !== state.audioLoadToken) return;
    state.audioUrl = URL.createObjectURL(blob);
    els.audio.src = state.audioUrl;
    els.audio.load();
  } finally {
    if (token === state.audioLoadToken) {
      els.playBtn.disabled = false;
      els.playBtn.textContent = "▶ 音声を聞く";
    }
  }
}

function renderQuestionList() {
  const nextUpIndex = state.lessons.findIndex((lesson) => !state.answers.has(lesson.id));
  let lastPart = null;
  els.questionList.innerHTML = state.lessons.map((lesson, index) => {
    const result = state.answers.get(lesson.id);
    const classes = ["qBtn"];
    if (index === state.index) classes.push("active");
    if (result === true) classes.push("correct");
    if (result === false) classes.push("wrong");
    if (index === nextUpIndex && index !== state.index) classes.push("nextUp");
    let header = "";
    if (lesson.part !== lastPart) {
      lastPart = lesson.part;
      header = `<p class="qPartHead">PART ${lesson.part}</p>`;
    }
    return `${header}<button class="${classes.join(" ")}" type="button" data-index="${index}">${lesson.id}</button>`;
  }).join("");
  els.questionList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      state.index = Number(button.dataset.index);
      state.mode = "problem";
      els.audio.pause();
      renderAll();
    });
  });
}

function renderPanels() {
  const lesson = currentLesson();
  const selected = state.selected;
  els.problemPanel.innerHTML = `
    <h3 class="dictStepTitle">2. 答えを選ぶ</h3>
    <div class="dictChoices">
      ${lesson.choices.map((choice, index) => {
        const value = index + 1;
        const checked = selected === value ? "checked" : "";
        const selectedClass = selected === value ? " selected" : "";
        return `<label class="dictChoice${selectedClass}">
          <input class="srOnly" type="radio" name="dictChoice" value="${value}" ${checked}>
          <span class="key">${value}</span>
          <span>${escapeHtml(choice)}</span>
        </label>`;
      }).join("")}
    </div>
    <p id="dictFeedback" class="feedback" aria-live="polite"></p>
    <div class="dictActions">
      <button id="dictCheckBtn" class="cta" type="button" ${selected ? "" : "disabled"}>選択した答えを確認する</button>
      <button id="dictSkipBtn" class="dictLink" type="button">この問題を飛ばす</button>
    </div>
  `;

  els.dictationPanel.innerHTML = `
    <h3 class="dictStepTitle">2. 書き取り</h3>
    <p class="dictLead">No. ${lesson.id} の英文を紙に書き取り、目視で確認します。</p>
    <div class="dictActions">
      <button id="dictShowScriptBtn" class="cta" type="button">スクリプトを表示して確認する</button>
      <button id="dictBackProblemBtn" class="dictLink" type="button">問題へ戻る</button>
    </div>
  `;

  els.reviewPanel.innerHTML = `
    <h3 class="dictStepTitle">3. 答えとスクリプト</h3>
    <p class="dictAnswerLine">正解: ${lesson.answer}. ${escapeHtml(lesson.choices[lesson.answer - 1])}</p>
    <div class="dictScript">${escapeHtml(scriptWithQuestion(lesson))}</div>
    <p class="label dictTipsLabel">Listening Points</p>
    <ul class="dictTips">
      ${lesson.tips.map((tip) => `<li>${escapeHtml(tip)}</li>`).join("")}
    </ul>
    <div class="dictActions">
      <button id="dictNextBtn" class="cta" type="button">次の問題へ</button>
      <button id="dictAgainBtn" class="ghost" type="button">音声をもう一度聞く</button>
    </div>
  `;

  els.problemPanel.querySelectorAll("input[name='dictChoice']").forEach((input) => {
    input.addEventListener("change", () => {
      state.selected = Number(input.value);
      renderPanels();
      setMode("problem");
    });
  });
  document.getElementById("dictCheckBtn").addEventListener("click", checkAnswer);
  document.getElementById("dictSkipBtn").addEventListener("click", nextLesson);
  document.getElementById("dictShowScriptBtn").addEventListener("click", () => setMode("review"));
  document.getElementById("dictBackProblemBtn").addEventListener("click", () => setMode("problem"));
  document.getElementById("dictNextBtn").addEventListener("click", nextLesson);
  document.getElementById("dictAgainBtn").addEventListener("click", playFromStart);
  setMode(state.mode);
}

function checkAnswer() {
  const lesson = currentLesson();
  const feedback = document.getElementById("dictFeedback");
  if (!state.selected) {
    feedback.textContent = "選択肢を選んでください。";
    return;
  }
  const correct = state.selected === lesson.answer;
  state.answers.set(lesson.id, correct);
  saveAnswers();
  updateScore();
  updateBadge();
  renderQuestionList();
  feedback.classList.add(correct ? "ok" : "ng");
  if (correct) {
    feedback.textContent = "正解です。";
    window.setTimeout(nextLesson, 650);
  } else {
    feedback.textContent = "不正解です。書き取りに進みます。";
    window.setTimeout(() => setMode("dictation"), 650);
  }
}

function setMode(mode) {
  state.mode = mode;
  els.problemPanel.classList.toggle("hide", mode !== "problem");
  els.dictationPanel.classList.toggle("hide", mode !== "dictation");
  els.reviewPanel.classList.toggle("hide", mode !== "review");
  Object.entries(els.tabs).forEach(([name, element]) => {
    element.classList.toggle("active", name === mode);
    if (name === mode) element.setAttribute("aria-current", "step");
    else element.removeAttribute("aria-current");
  });
}

function nextLesson() {
  els.audio.pause();
  state.index = Math.min(state.lessons.length - 1, state.index + 1);
  state.mode = "problem";
  renderAll();
}

function togglePlay() {
  if (els.audio.paused) {
    if (els.audio.currentTime < state.segment.start || els.audio.currentTime >= state.segment.end) {
      els.audio.currentTime = state.segment.start;
    }
    els.audio.play();
  } else {
    els.audio.pause();
  }
}

function playFromStart() {
  els.audio.currentTime = state.segment.start;
  els.audio.play();
}

function updateTimeline() {
  if (els.audio.currentTime >= state.segment.end) {
    if (state.loop) {
      els.audio.currentTime = state.segment.start;
      if (els.audio.paused) {
        els.audio.play();
      }
    } else {
      els.audio.pause();
      els.audio.currentTime = state.segment.end;
    }
  }
  state.playhead = els.audio.currentTime;
  if (!state.seeking) {
    const ratio = segmentLength() ? (els.audio.currentTime - state.segment.start) / segmentLength() : 0;
    els.timeline.value = String(Math.max(0, Math.min(1000, Math.round(ratio * 1000))));
  }
  els.timeNow.textContent = formatTime(Math.max(0, els.audio.currentTime - state.segment.start));
  els.timeEnd.textContent = formatTime(segmentLength());
}

function toggleLoop() {
  state.loop = !state.loop;
  els.loopBtn.classList.toggle("active", state.loop);
  els.loopBtn.setAttribute("aria-pressed", String(state.loop));
  els.loopBtn.textContent = state.loop ? "繰り返し中" : "区間を繰り返す";
}

function syncSegmentInputs() {
  const duration = currentLessonDuration();
  els.startInput.value = duration ? String(Math.round((state.segment.start / duration) * 1000)) : "0";
  els.endInput.value = duration ? String(Math.round((state.segment.end / duration) * 1000)) : "1000";
  els.startValue.textContent = formatTime(state.segment.start);
  els.endValue.textContent = formatTime(state.segment.end);
  els.timeNow.textContent = "0:00";
  els.timeEnd.textContent = formatTime(segmentLength());
  els.timeline.value = "0";
  state.playhead = state.segment.start;
}

function updateSegmentFromSliders(changed) {
  const duration = currentLessonDuration();
  if (!duration) return;
  let start = (Number(els.startInput.value) / 1000) * duration;
  let end = (Number(els.endInput.value) / 1000) * duration;
  if (end - start < 1) {
    if (changed === "start") {
      start = Math.max(0, end - 1);
    } else {
      end = Math.min(duration, start + 1);
    }
  }
  state.segment = { start: roundTime(start), end: roundTime(end) };
  syncSegmentInputs();
  els.audio.currentTime = state.segment.start;
}

function setTrimPoint(kind) {
  const duration = currentLessonDuration();
  if (!duration) return;
  const current = currentPlayhead();
  if (kind === "start") {
    state.segment.start = roundTime(Math.min(current, state.segment.end - 1));
  } else {
    state.segment.end = roundTime(Math.max(current, state.segment.start + 1));
  }
  syncSegmentInputs();
  if (kind === "start") {
    els.audio.currentTime = state.segment.start;
    els.audio.play();
  } else {
    els.audio.currentTime = Math.min(state.segment.start, state.segment.end);
  }
}

function resetSegment() {
  const lesson = currentLesson();
  state.segment = { start: lesson.start, end: lesson.end };
  syncSegmentInputs();
  playFromStart();
}

function updateScore() {
  const correct = Array.from(state.answers.values()).filter(Boolean).length;
  els.scoreLine.textContent = `${correct} / ${state.lessons.length}`;
}

function updateBadge() {
  const lesson = currentLesson();
  const result = state.answers.get(lesson.id);
  els.resultBadge.className = "dictBadge";
  if (result === true) {
    els.resultBadge.textContent = "正解";
    els.resultBadge.classList.add("correct");
  } else if (result === false) {
    els.resultBadge.textContent = "書き取り";
    els.resultBadge.classList.add("wrong");
  } else {
    els.resultBadge.textContent = "未解答";
  }
}

function currentLesson() {
  return state.lessons[state.index];
}

function segmentLength() {
  return Math.max(0, state.segment.end - state.segment.start);
}

function currentLessonDuration() {
  const lesson = currentLesson();
  return lesson ? Math.max(0, lesson.end) : 0;
}

function currentPlayhead() {
  const fromSlider = state.segment.start + (Number(els.timeline.value) / 1000) * segmentLength();
  const fromAudio = Number.isFinite(els.audio.currentTime) ? els.audio.currentTime : fromSlider;
  const hasSliderPosition = Number(els.timeline.value) > 0;
  const value = hasSliderPosition ? fromSlider : fromAudio;
  return Math.max(0, Math.min(currentLessonDuration(), value));
}

function roundTime(value) {
  return Math.round(value * 10) / 10;
}

function cleanScript(script) {
  return script
    .replace(/\n?☆☆\s*$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function scriptWithQuestion(lesson) {
  const script = cleanScript(lesson.script);
  if (!lesson.question) return script;
  return `${script}\n\nQuestion: ${lesson.question}`;
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const minutes = Math.floor(safe / 60);
  const rest = String(safe % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function boot() {
  try {
    await loadManifest();
  } catch (error) {
    showLoadError(error);
    return;
  }
  cloud = createCloud({
    appId: APP_ID,
    getPayload: cloudPayload,
    applyLoaded: applyCloudPayload,
  });
  await cloud.init();
  state.round = DEFAULT_ROUND;
  renderStudyOptions();
  await loadLevel(state.level, state.round);
}

async function mount() {
  homePanel.classList.add("hide");
  sessionPanel.classList.remove("hide");
  renderShell();
  bindEvents();
  if (booted) {
    renderStudyOptions();
    renderAll();
    return;
  }
  booted = true;
  await boot();
}

function handleKey() { /* リスニングモードはキーボード操作なし */ }

return { mount, handleKey };
})();
