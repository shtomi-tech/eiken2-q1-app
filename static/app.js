"use strict";

/* ============================================================
   英検2級 大問1 単語アプリ
   学習フロー：暗記カード → 理解チェック → 本番演習（設問ごと）
   ※ 間隔反復（Leitner）は未実装。進捗は localStorage に保存。
   ============================================================ */

const STORE_KEY = "eiken2_q1_v1";
const VOCAB_URL = "data/vocab_2026-1.json";
const QUESTIONS_URL = "data/questions_2026-1.json";

const state = {
  itemsByQ: {},   // q -> [item, ...]
  questions: {},  // q -> {stem, choices, answerIndex, translation}
  qList: [],      // [1..17]
  meaningPool: { word: [], idiom: [] }, // ダミー用の意味プール
  progress: loadProgress(),
};

/* ---- progress (localStorage) ---- */
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return { units: {} };
}
function saveProgress() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(state.progress)); } catch (e) { /* ignore */ }
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

/* ============================================================
   load data
   ============================================================ */
async function loadData() {
  const [vocab, qs] = await Promise.all([
    fetch(VOCAB_URL).then((r) => r.json()),
    fetch(QUESTIONS_URL).then((r) => r.json()),
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

/* ============================================================
   HOME
   ============================================================ */
function renderHome() {
  $("#sessionPanel").classList.add("hide");
  const home = $("#homePanel");
  home.classList.remove("hide");
  home.innerHTML = "";

  const total = state.qList.length;
  const learned = state.qList.filter((q) => unit(q).learned).length;
  const solved = state.qList.filter((q) => unit(q).solvedCorrect).length;
  const reviewQs = reviewQueue();

  // daily / summary
  const summary = el("section", { class: "card" });
  summary.appendChild(el("div", { class: "sectionHead" },
    el("div", {},
      el("p", { class: "label" }, "Today"),
      el("h2", {}, "設問ごとに「覚えて→確かめて→解く」"),
    ),
  ));
  const grid = el("div", { class: "dailyGrid" });
  grid.appendChild(statCell(learned, total, "学習した設問"));
  grid.appendChild(statCell(solved, total, "本番で正解"));
  grid.appendChild(statCell(reviewQs.length, total, "間違えた設問"));
  summary.appendChild(grid);

  const nextQ = state.qList.find((q) => !unit(q).learned);
  const actions = el("div", { class: "actions" });
  actions.appendChild(el("button", { class: "cta meaningCta", onclick: startMeaningPractice },
    "意味チェックだけ演習する（全語句ランダム）"));
  if (reviewQs.length) {
    actions.appendChild(el("button", { class: "cta reviewCta", onclick: startReview },
      `間違えた問題を演習する（${reviewQs.length}問）`));
  }
  if (nextQ) {
    actions.appendChild(el("button", { class: "cta", onclick: () => startLearn(nextQ) },
      `次の設問を学習する（第${nextQ}問）`));
  } else {
    actions.appendChild(el("button", { class: "cta", onclick: () => startLearn(state.qList[0]) },
      "もう一周する（第1問から）"));
  }
  summary.appendChild(actions);
  home.appendChild(summary);

  // question path
  const path = el("section", { class: "card" });
  path.appendChild(el("div", { class: "pathHead" },
    el("p", { class: "label" }, "Question Path"),
    el("h2", {}, "大問1（全17問）"),
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
}

function statCell(n, d, caption) {
  return el("div", { class: "dailyCell" },
    el("div", { class: "dailyNum", html: `${n}<small>/ ${d}</small>` }),
    el("div", { class: "dailyCaption" }, caption),
  );
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

/* ============================================================
   LEARN FLOW (per question)
   stages: flash -> check -> practice -> done
   ============================================================ */
let session = null;

function startLearn(q) {
  session = {
    mode: "learn",
    q,
    items: state.itemsByQ[q],
    stage: "flash",
    flashIdx: 0,
    checkOrder: shuffle(state.itemsByQ[q]),
    checkIdx: 0,
    checkAnswered: false,
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
  };
  renderSession();
}

function renderSession() {
  $("#homePanel").classList.add("hide");
  const panel = $("#sessionPanel");
  panel.classList.remove("hide");
  panel.innerHTML = "";

  const isMeaning = session.mode === "meaning";
  const q = session.q;
  const isIdiom = !isMeaning && session.items[0].type === "idiom";
  const isReview = session.mode === "review";

  // header
  panel.appendChild(el("div", { class: "itemHead" },
    el("div", {},
      el("p", { class: "label" }, sessionLabel(q, isIdiom, isReview, isMeaning)),
      el("h2", {}, stageTitle(session.stage)),
    ),
    el("button", { class: "ghost", onclick: () => renderHome() }, "一覧へ戻る"),
  ));

  // stage bar
  if (isMeaning) panel.appendChild(meaningBar());
  else if (isReview) panel.appendChild(reviewBar());
  else panel.appendChild(stageBar(session.stage));

  const body = el("div", {});
  panel.appendChild(body);

  if (session.stage === "flash") renderFlash(body);
  else if (session.stage === "check") renderCheck(body);
  else if (session.stage === "practice") renderPractice(body);
  else if (session.stage === "done") renderDone(body);
}

function sessionLabel(q, isIdiom, isReview, isMeaning) {
  if (isMeaning) return `全語句ランダム ${session.checkIdx + 1} / ${session.checkOrder.length}`;
  if (isReview) return `復習演習 ${session.reviewIdx + 1} / ${session.reviewQueue.length}`;
  return `第${q}問 ・ ${isIdiom ? "熟語" : "単語"}`;
}

function stageTitle(stage) {
  if (session && session.mode === "meaning") return "意味チェックだけ演習";
  if (session && session.mode === "review") return "間違えた問題を演習";
  return {
    flash: "STEP 1　覚える（暗記カード）",
    check: "STEP 2　確かめる（意味チェック）",
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

function stageBar(stage) {
  const order = ["flash", "check", "practice"];
  const cur = order.indexOf(stage);
  const labels = { flash: "1 覚える", check: "2 確かめる", practice: "3 解く" };
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
function renderFlash(body) {
  const items = session.items;
  const item = items[session.flashIdx];

  const card = el("div", { class: "flash" });
  const head = el("div", { class: "flashHead" });
  head.appendChild(el("div", {},
    el("div", { class: "flashWord" }, surfaceOf(item)),
    el("div", { class: "flashPos" }, item.pos || ""),
  ));
  card.appendChild(head);

  const inner = el("div", { class: "flashBody" });
  inner.appendChild(flashRow("意味", item.meaning, "flashMeaning"));
  if (item.etymology) inner.appendChild(flashRow("語源・なりたち", item.etymology, "flashEtym"));
  if (item.example) inner.appendChild(flashExampleRow(item));
  if (item.collocation) inner.appendChild(flashRow("使い方・コロケーション", item.collocation, "flashColl"));
  card.appendChild(inner);
  body.appendChild(card);

  const nav = el("div", { class: "actions" });
  if (session.flashIdx > 0) {
    nav.appendChild(el("button", { class: "ghost", onclick: () => { session.flashIdx--; renderSession(); } }, "← 前のカード"));
  }
  const last = session.flashIdx === items.length - 1;
  nav.appendChild(el("button", {
    class: "cta",
    onclick: () => {
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

/* ---- STEP 2: meaning check ---- */
function renderCheck(body) {
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

  const choiceWrap = el("div", { class: "choices" });
  choices.forEach((m, i) => {
    const btn = el("button", { class: "choiceBtn" },
      el("span", { class: "key" }, String(i + 1)),
      el("span", {}, m),
    );
    btn.addEventListener("click", () => {
      if (session.checkAnswered) return;
      session.checkAnswered = true;
      const isCorrect = m === correct;
      [...choiceWrap.children].forEach((c) => {
        c.disabled = true;
        const txt = c.querySelector("span:last-child").textContent;
        if (txt === correct) c.classList.add("correct");
        else if (txt === m && !isCorrect) c.classList.add("wrong");
      });
      if (session.mode === "meaning" && isCorrect) session.meaningCorrect += 1;
      const fb = el("div", { class: "feedback " + (isCorrect ? "ok" : "ng") },
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
            session._checkChoices = null;
            if (last) {
              session.stage = session.mode === "meaning" ? "done" : "practice";
              renderSession();
            }
            else { session.checkIdx++; renderSession(); }
          },
        }, last ? (session.mode === "meaning" ? "結果を見る →" : "本番形式の問題へ →") : "次へ →"),
      );
      box.appendChild(actions);
      revealAnswerActions(actions);
    });
    choiceWrap.appendChild(btn);
  });
  box.appendChild(choiceWrap);
  body.appendChild(box);
}

/* ---- STEP 3: practice (actual question) ---- */
function renderPractice(body) {
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
  const segs = q_.stem.split(/\(\s*\)/);
  segs.forEach((seg, i) => {
    stemP.appendChild(document.createTextNode(seg));
    if (i < segs.length - 1) stemP.appendChild(el("span", { class: "blank" }, "　"));
  });
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
  if (session.practiceAnswered) return;
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
  const q = session.q;
  const isMeaning = session.mode === "meaning";
  const isReview = session.mode === "review";
  const banner = el("div", { class: "doneBanner" });
  banner.appendChild(el("p", { class: "label", style: "color:rgba(250,249,246,.72)" }, "Step Complete"));
  if (isMeaning) {
    banner.appendChild(el("div", { class: "big" }, `${session.meaningCorrect} / ${session.checkOrder.length}`));
    banner.appendChild(el("h2", {}, "全語句の意味チェックが完了しました"));
  } else {
    banner.appendChild(el("div", { class: "big" }, session.practiceResult ? "正解！" : "復習リストに残しました"));
    banner.appendChild(el("h2", {}, isReview ? `第${q}問の復習演習が完了しました` : `第${q}問の4語句を学習しました`));
  }
  body.appendChild(banner);

  const actions = el("div", { class: "actions" });
  if (isMeaning) {
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
    }
  }
  actions.appendChild(el("button", { class: "ghost", onclick: renderHome }, "一覧へ戻る"));
  body.appendChild(actions);
}

/* ============================================================
   init
   ============================================================ */
async function init() {
  $("#resetBtn").addEventListener("click", () => {
    if (confirm("すべての進捗を消去します。よろしいですか？")) {
      state.progress = { units: {} };
      saveProgress();
      renderHome();
    }
  });
  try {
    await loadData();
    renderHome();
  } catch (e) {
    $("#homePanel").innerHTML = "";
    $("#homePanel").appendChild(el("div", { class: "empty" },
      "データの読み込みに失敗しました。ローカルサーバー経由で開いているか確認してください。"));
    console.error(e);
  }
}

document.addEventListener("DOMContentLoaded", init);
