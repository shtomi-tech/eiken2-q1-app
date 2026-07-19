"use strict";

/*
 * 英作文 言い換え練習
 * 大問1・大問3・リスニングと同じ共有パネル方式で動く追加モード。
 * 問題データとlocalStorageキーは既存モードから分離する。
 */
const EikenParaphraseApp = (function () {
  const DATA_URL = "data/paraphrase_questions.json";
  const STORE_KEY = "eiken_paraphrase_practice_v1";
  const homePanel = document.getElementById("homePanel");
  const sessionPanel = document.getElementById("sessionPanel");
  const state = {
    questions: [],
    units: {},
    resume: null,
    filter: "all",
    view: "home",
    currentId: null,
    draft: "",
    submitted: false,
    result: null,
    rated: false,
    tutorialFrom: "home",
  };
  let root = homePanel;
  let loaded = false;
  let statusTimer = null;

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalize(value) {
    return String(value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[.,!?;:()[\]{}“”‘’'`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function question(id) {
    return state.questions.find((item) => item.id === id) || null;
  }

  function unit(id) {
    if (!state.units[id]) state.units[id] = {};
    const current = state.units[id];
    if (typeof current.attempts !== "number") current.attempts = 0;
    if (typeof current.solved !== "boolean") current.solved = false;
    if (typeof current.needsReview !== "boolean") current.needsReview = false;
    return current;
  }

  function loadStore() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && parsed.units && typeof parsed.units === "object") state.units = parsed.units;
      if (parsed && parsed.resume && typeof parsed.resume.id === "string") state.resume = parsed.resume;
    } catch (error) {
      state.units = {};
      state.resume = null;
    }
  }

  function persist(message = "") {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ version: 1, units: state.units, resume: state.resume }));
    } catch (error) {
      if (message) showStatus("この端末には進捗を保存できません", "error");
      return;
    }
    if (message) showStatus(message, "ok");
  }

  function showStatus(message, tone = "") {
    const slot = document.querySelector("#shareStatus");
    if (!slot) return;
    window.clearTimeout(statusTimer);
    slot.textContent = message;
    slot.className = `shareStatus ${tone}`.trim();
    statusTimer = window.setTimeout(() => {
      slot.textContent = "";
      slot.className = "shareStatus";
    }, 2200);
  }

  function summary() {
    const total = state.questions.length;
    const completed = state.questions.filter((item) => unit(item.id).solved).length;
    const due = state.questions.filter((item) => unit(item.id).needsReview).length;
    return { total, completed, due, remaining: Math.max(0, total - completed) };
  }

  function recommendedQuestion() {
    return state.questions.find((item) => unit(item.id).needsReview)
      || state.questions.find((item) => !unit(item.id).solved)
      || state.questions[0]
      || null;
  }

  function filteredQuestions() {
    if (state.filter === "all") return state.questions;
    return state.questions.filter((item) => item.category === state.filter);
  }

  function statusText(item) {
    const current = unit(item.id);
    if (current.needsReview) return { text: "要復習", className: "due" };
    if (current.solved) return { text: "できた", className: "done" };
    if (current.attempts > 0) return { text: "練習済み", className: "" };
    return { text: "未回答", className: "" };
  }

  function showHomePanel() {
    homePanel.classList.remove("hide");
    sessionPanel.className = "hide";
  }

  function showSessionPanel() {
    homePanel.classList.add("hide");
    sessionPanel.className = "paraphraseSession";
  }

  function renderHome() {
    state.view = "home";
    showHomePanel();
    const stats = summary();
    const recommended = recommendedQuestion();
    const resumeQuestion = state.resume ? question(state.resume.id) : null;
    const filters = [["all", "すべて"], ["thing", "もの・こと"], ["person", "人"], ["place", "場所"], ["abstract", "抽象概念"]];
    const cards = filteredQuestions().map((item, index) => {
      const status = statusText(item);
      const current = unit(item.id);
      return `<article class="questionCard ${current.needsReview ? "isDue" : ""}">
        <div class="qMeta"><span>QUESTION ${String(index + 1).padStart(2, "0")}</span><span class="tag">${escapeHtml(item.categoryLabel)}</span></div>
        <h3 class="qTarget">${escapeHtml(item.targetJa)}</h3>
        <p class="qMeaning">${escapeHtml(item.meaningJa)}</p>
        <div class="qStatus ${status.className}">${escapeHtml(status.text)}${current.attempts ? ` ・ ${current.attempts}回` : ""}</div>
        <button class="qAction" type="button" data-start="${escapeHtml(item.id)}">この問題を始める</button>
      </article>`;
    }).join("");

    homePanel.innerHTML = `<div class="paraphraseHome">
      <section class="card hero">
        <span class="label">言い換えから始める</span>
        <h2>知らない名詞を、知っている英語で説明する</h2>
        <p class="heroLead">英作文では、単語を思い出せないことがあります。そんなときは、もの・人・場所を関係詞で説明すれば、文を止めずに先へ進めます。</p>
        <div class="heroRule"><code>something that + S + V</code><span>「主語が動詞するもの」</span></div>
        <p class="hint">まず自分で入力し、あとから例答と型を確認します。</p>
        <div class="actions">
          ${recommended ? `<button class="primary" type="button" data-action="start-recommended">${stats.due ? "要復習から始める" : "今日の練習を始める"}</button>` : ""}
          <button class="ghost" type="button" data-action="open-tutorial">言い換えのやり方を見る</button>
        </div>
      </section>
      ${resumeQuestion ? `<section class="card resumeCard"><span class="label">続きから</span><h2>途中の問題があります</h2><p><strong>${escapeHtml(resumeQuestion.targetJa)}</strong> — 入力途中の回答を続けます。</p><div class="actions"><button type="button" data-action="resume">続きから始める</button><button class="ghost" type="button" data-action="discard-resume">破棄する</button></div></section>` : ""}
      <section class="card">
        <div class="sectionHead"><div><span class="label">練習メニュー</span><h2>問題一覧</h2></div><p class="hint">${stats.remaining}問が未達成です。</p></div>
        <div class="statsGrid"><div class="stat"><span class="statValue">${stats.total}</span><span class="statLabel">問題</span></div><div class="stat"><span class="statValue">${stats.completed}</span><span class="statLabel">できた</span></div><div class="stat"><span class="statValue">${stats.due}</span><span class="statLabel">要復習</span></div></div>
        <div class="filterBar" aria-label="問題の分類">${filters.map(([id, label]) => `<button class="filterBtn" type="button" data-filter="${id}" aria-pressed="${state.filter === id}">${label}</button>`).join("")}</div>
        <div class="questionList">${cards || `<div class="empty">この分類には問題がありません。</div>`}</div>
      </section>
    </div>`;
    root = homePanel.firstElementChild;

    root.querySelectorAll("[data-filter]").forEach((button) => button.addEventListener("click", () => { state.filter = button.dataset.filter; renderHome(); }));
    root.querySelectorAll("[data-start]").forEach((button) => button.addEventListener("click", () => startSession(button.dataset.start, false)));
    root.querySelector("[data-action='start-recommended']")?.addEventListener("click", () => { if (recommended) startSession(recommended.id, false); });
    root.querySelector("[data-action='open-tutorial']")?.addEventListener("click", () => openTutorial("home"));
    root.querySelector("[data-action='resume']")?.addEventListener("click", () => { if (resumeQuestion) startSession(resumeQuestion.id, true); });
    root.querySelector("[data-action='discard-resume']")?.addEventListener("click", () => { state.resume = null; persist("途中入力を破棄しました"); renderHome(); });
  }

  function openTutorial(from) {
    state.tutorialFrom = from;
    renderTutorial();
  }

  function returnFromTutorial() {
    if (state.tutorialFrom === "session") renderSession();
    else renderHome();
  }

  function renderTutorial() {
    state.view = "tutorial";
    const fromSession = state.tutorialFrom === "session";
    const recommended = recommendedQuestion();
    if (fromSession) {
      showSessionPanel();
      root = sessionPanel;
    } else {
      showHomePanel();
      homePanel.innerHTML = "";
      root = homePanel;
    }
    const html = `<div class="${fromSession ? "" : "paraphraseHome"}">
      <div class="sessionHead"><button class="ghost backButton" type="button" data-action="tutorial-back">← ${fromSession ? "問題に戻る" : "問題一覧"}</button><p class="sessionMeta">チュートリアル / 3段階</p></div>
      <section class="card tutorialCard"><span class="label">チュートリアル</span><h2>言い換えは、単語を当てる練習ではありません。</h2><p class="tutorialLead">知らない名詞を、知っている英語の組み合わせで説明します。目標は、相手が何を指しているか分かる説明を作ることです。</p>
        <section class="tutorialExample"><div class="sectionHead tutorialExampleHead"><div><span class="label">例で見る</span><h3>「常識」を説明する</h3></div><span class="tag">名詞を使わない</span></div>
          <div class="meaningSplit"><div><span class="label">言いたい日本語</span><strong>常識</strong><p>多くの人が正しいと思うこと</p></div><div class="meaningArrow" aria-hidden="true">→</div><div><span class="label">説明に分ける</span><p>もの・こと ＋ 関係詞 ＋ その特徴</p></div></div>
          <ol class="tutorialSteps"><li><span class="tutorialStepNo">01</span><div><strong>種類を置く</strong><p>「常識」はもの・ことなので、まず <code>something</code> と置きます。</p></div></li><li><span class="tutorialStepNo">02</span><div><strong>関係詞をつなぐ</strong><p>もの・ことの説明を始める <code>that</code> を置きます。</p></div></li><li><span class="tutorialStepNo">03</span><div><strong>特徴を書く</strong><p>「多くの人が正しいと思う」→ <code>many people think is right</code> とします。</p></div></li></ol>
          <div class="construction"><div class="constructionPart"><code>something</code><span>もの・こと</span></div><span class="constructionJoin">+</span><div class="constructionPart"><code>that</code><span>関係詞</span></div><span class="constructionJoin">+</span><div class="constructionPart"><code>many people think is right</code><span>特徴</span></div></div>
          <div class="tutorialAnswer"><span class="label">完成</span><code>something that many people think is right</code><p>日本語の名詞を消しても、説明の組み合わせで意味を伝えられます。</p></div>
        </section>
        <section class="patternGuide"><span class="label">よく使う3つの型</span><h3>まずは「種類」を決めます。</h3><div class="patternGrid"><div class="patternCard"><code>something that + S + V</code><strong>もの・こと</strong><p>「人が使うもの」「人が言うこと」</p></div><div class="patternCard"><code>a person who + V</code><strong>人</strong><p>「人を助ける人」</p></div><div class="patternCard"><code>a place that + S + V</code><strong>場所</strong><p>「多くの人が訪れる場所」</p></div></div></section>
        <section class="stuckBox"><span class="label">困ったとき</span><h3>日本語を3つの質問に分けます。</h3><ol><li><strong>それは何？</strong> → もの・人・場所のどれかを決める。</li><li><strong>何をする？</strong> → 知っている動詞を1つ置く。</li><li><strong>誰が・いつ・なぜ？</strong> → 必要なら説明を足す。</li></ol><p class="hint">種類を置ければ、半分は終わりです。</p></section>
        <div class="actions tutorialActions"><button class="primary" type="button" data-action="tutorial-primary">${fromSession ? "この問題に戻る" : "この流れで練習する"}</button>${!fromSession && recommended ? `<span class="tutorialNextHint">最初の問題：${escapeHtml(recommended.targetJa)}</span>` : ""}</div>
      </section></div>`;
    root.innerHTML = html;
    if (!fromSession) root = homePanel.firstElementChild;
    root.querySelector("[data-action='tutorial-back']")?.addEventListener("click", returnFromTutorial);
    root.querySelector("[data-action='tutorial-primary']")?.addEventListener("click", () => { if (fromSession) returnFromTutorial(); else if (recommended) startSession(recommended.id, false); });
  }

  function relationPresent(item, typed) {
    const patterns = { that: /\b(that|which)\b/, who: /\b(who|that)\b/, where: /\b(where|in which)\b/, what: /\bwhat\b/ };
    return Boolean(patterns[item.relation]?.test(typed));
  }

  function hasClause(typed) {
    return typed.split(" ").filter(Boolean).length >= 4 && /\b(is|are|was|were|be|been|being|believe|believes|think|thinks|help|helps|follow|follows|visit|visits|say|says|explain|explains|pass|passed|use|uses|do|does|done|did|have|has|must|make|makes|made|keep|keeps|may)\b/.test(typed);
  }

  function evaluate(item, answer) {
    const typed = normalize(answer);
    const exact = item.acceptedAnswers.some((candidate) => normalize(candidate) === typed);
    const hasRelation = relationPresent(item, typed);
    const hitCount = item.signals.filter((signal) => typed.includes(normalize(signal))).length;
    const meaningful = hitCount >= Math.min(2, item.signals.length);
    const clause = hasRelation && hasClause(typed);
    if (exact) return { level: "ok", title: "型を使えています。例に近いです。", summary: "関係詞の型と、説明したい意味の手がかりが入っています。", checks: [{ label: `関係詞 ${item.relation} を使えている`, ok: true }, { label: "関係詞の後ろに主語・動詞がある", ok: true }, { label: "意味の手がかりが含まれている", ok: true }] };
    if (hasRelation && meaningful && clause) return { level: "near", title: "型は使えています。", summary: "例とは表現が違いますが、関係詞で意味を説明できています。日本語の意味と合うかを例と比べましょう。", checks: [{ label: `関係詞 ${item.relation} を使えている`, ok: true }, { label: "関係詞の後ろに主語・動詞がある", ok: true }, { label: "意味の手がかりが含まれている", ok: true }] };
    return { level: "needsReview", title: hasRelation ? "関係詞は使えています。もう少し具体化します。" : "まず関係詞の型に置き換えてみます。", summary: hasRelation ? "関係詞の後ろに、「だれが・何をするか」を入れてみましょう。" : `まず「${item.structure}」に置き換え、関係詞の後ろに主語と動詞を置きます。`, checks: [{ label: `関係詞 ${item.relation} を使えている`, ok: hasRelation }, { label: "関係詞の後ろに主語・動詞がある", ok: clause }, { label: "意味の手がかりが含まれている", ok: meaningful }] };
  }

  function feedbackHtml(item) {
    if (!state.result) return "";
    const result = state.result;
    return `<section class="feedback ${result.level}" aria-live="polite"><h3>${escapeHtml(result.title)}</h3><p>${escapeHtml(result.summary)}</p><ul class="checkList">${result.checks.map((check) => `<li class="${check.ok ? "yes" : "no"}"><span class="mark">${check.ok ? "✓" : "－"}</span><span>${escapeHtml(check.label)}</span></li>`).join("")}</ul></section><section class="modelAnswer"><span class="answerLabel">答えの例</span><div class="answerMeaning"><span class="label">この英語の意味</span><p>${escapeHtml(item.answerMeaning)}</p></div><span class="answerPhrase"><code>${escapeHtml(item.answer)}</code></span><p class="explanation">${escapeHtml(item.explanation)}</p><div class="patternNote"><span class="label">使った型</span><strong>${escapeHtml(item.structure)}</strong></div></section>`;
  }

  function nextQuestion(item) {
    const index = state.questions.findIndex((candidate) => candidate.id === item.id);
    return state.questions[(index + 1) % state.questions.length] || state.questions[0] || null;
  }

  function renderSession() {
    const item = question(state.currentId);
    if (!item) return renderHome();
    state.view = "session";
    showSessionPanel();
    root = sessionPanel;
    const index = state.questions.findIndex((candidate) => candidate.id === item.id);
    const next = nextQuestion(item);
    const stage = state.rated ? 3 : state.submitted ? 2 : 1;
    sessionPanel.innerHTML = `<div class="sessionHead"><button class="ghost backButton" type="button" data-action="back">← 問題一覧</button><div class="sessionTools"><p class="sessionMeta">問題 ${String(index + 1).padStart(2, "0")} / ${state.questions.length}</p><button class="ghost helpButton" type="button" data-action="open-tutorial">言い換えの手順</button></div></div><div class="stageBar" aria-label="学習ステップ"><div class="stagePill ${stage === 1 ? "active" : "cleared"}">1 考える</div><div class="stagePill ${stage === 2 ? "active" : stage > 2 ? "cleared" : ""}">2 型を確認</div><div class="stagePill ${state.rated ? "active" : ""}">3 復習登録</div></div><section class="card promptCard"><div class="promptTop"><div><span class="label">${escapeHtml(item.categoryLabel)}</span><h2>${escapeHtml(item.targetJa)}</h2></div><span class="tag">${escapeHtml(item.relation)} を使う型</span></div><p class="promptMeaning">${escapeHtml(item.meaningJa)}</p><div class="situation"><span class="label">使う場面</span><p>${escapeHtml(item.situationJa)}</p></div><div class="frameBox"><span class="label">文の形</span><span class="frameText">${escapeHtml(item.frame)}</span></div><label class="answerLabel" for="paraphraseAnswer">英単語を使わずに、説明を書いてください</label><textarea id="paraphraseAnswer" autocomplete="off" spellcheck="false" placeholder="例: something that ..." ${state.submitted ? "disabled" : ""}>${escapeHtml(state.draft)}</textarea><div class="inputMeta"><p class="hint">短くても構いません。まずは型を置きます。</p><span class="charCount" id="paraphraseCharCount">${state.draft.length}文字</span></div><div class="submitRow"><p class="hint">${state.submitted ? "例答を見て、表現を比べます。" : "Ctrl + Enter でも確認できます。"}</p>${state.submitted ? `<button class="ghost" type="button" data-action="edit">書き直す</button>` : `<button class="primary" type="button" data-action="submit" ${state.draft.trim() ? "" : "disabled"}>回答を確認</button>`}</div>${feedbackHtml(item)}${state.submitted ? `<div class="selfCheck"><p>${state.rated ? "自己判定を保存しました。" : "答えを確認したら、自分の手応えを登録します。"}</p><div class="actions"><button type="button" data-rating="solved">できた</button><button class="clay" type="button" data-rating="review">要復習にする</button></div></div>` : ""}</section>${state.submitted ? `<div class="nextRow"><button class="ghost" type="button" data-action="back">一覧に戻る</button><button class="next" type="button" data-action="next" ${state.rated ? "" : "disabled"}>次の問題「${escapeHtml(next?.targetJa || "次の問題")}"へ</button></div>` : ""}`;

    root.querySelectorAll("[data-action='back']").forEach((button) => button.addEventListener("click", () => { if (!state.submitted && state.draft.trim()) state.resume = { id: item.id, draft: state.draft }; else if (state.submitted) state.resume = null; persist(); renderHome(); }));
    root.querySelector("[data-action='open-tutorial']")?.addEventListener("click", () => openTutorial("session"));
    const input = root.querySelector("#paraphraseAnswer");
    input?.addEventListener("input", () => { state.draft = input.value; root.querySelector("#paraphraseCharCount").textContent = `${state.draft.length}文字`; const submit = root.querySelector("[data-action='submit']"); if (submit) submit.disabled = !state.draft.trim(); state.resume = state.draft.trim() ? { id: item.id, draft: state.draft } : null; persist(); });
    root.querySelector("[data-action='submit']")?.addEventListener("click", () => { if (!state.draft.trim()) return; state.submitted = true; state.result = evaluate(item, state.draft); state.rated = false; unit(item.id).attempts += 1; state.resume = null; persist("回答を記録しました"); renderSession(); root.querySelector(".feedback")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
    root.querySelector("[data-action='edit']")?.addEventListener("click", () => { state.submitted = false; state.result = null; state.rated = false; renderSession(); root.querySelector("#paraphraseAnswer")?.focus(); });
    root.querySelectorAll("[data-rating]").forEach((button) => button.addEventListener("click", () => { const current = unit(item.id); current.solved = button.dataset.rating === "solved"; current.needsReview = !current.solved; state.rated = true; state.resume = null; persist("自己判定を保存しました"); renderSession(); }));
    root.querySelector("[data-action='next']")?.addEventListener("click", () => { if (!state.rated || !next) return; state.currentId = next.id; state.draft = ""; state.submitted = false; state.result = null; state.rated = false; renderSession(); root.querySelector("#paraphraseAnswer")?.focus(); });
  }

  function startSession(id, resume) {
    const item = question(id);
    if (!item) return;
    state.currentId = id;
    state.draft = resume && state.resume?.id === id ? String(state.resume.draft || "") : "";
    state.submitted = false;
    state.result = null;
    state.rated = false;
    renderSession();
    root.querySelector("#paraphraseAnswer")?.focus();
  }

  async function mount() {
    if (loaded) return renderHome();
    loaded = true;
    loadStore();
    showHomePanel();
    homePanel.innerHTML = `<p class="loading">問題を読み込んでいます…</p>`;
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`data: ${response.status}`);
      const payload = await response.json();
      state.questions = Array.isArray(payload.questions) ? payload.questions : [];
      renderHome();
    } catch (error) {
      homePanel.innerHTML = `<div class="empty"><h2>問題を読み込めませんでした</h2><p>HTTPサーバー経由で起動しているか確認してください。</p><p class="hint">${escapeHtml(error.message)}</p></div>`;
    }
  }

  function handleKey(event) {
    if (state.view === "tutorial" && event.key === "Escape") { returnFromTutorial(); return true; }
    if (state.view !== "session") return false;
    if (event.key === "Escape") { root.querySelector("[data-action='back']")?.click(); return true; }
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") { root.querySelector("[data-action='submit']")?.click(); return true; }
    return false;
  }

  return { mount, handleKey };
})();
