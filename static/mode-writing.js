"use strict";

const EikenWritingApp = (function () {
  const DATA_URL = "data/writing_questions.json";
  const DRAFTS_KEY = "eiken_writing_drafts_v1";
  const PROGRESS_KEY = "eiken_writing_progress_v1";
  const STEP_TITLES = ["設問を訳す", "HEADを作る", "BODY 1を作る", "BODY 2を作る", "CONCLUSIONを書く", "全体をレビュー"];
  const STEP_LABELS = ["TRANSLATE", "HEAD", "BODY 1", "BODY 2", "CONCLUSION", "REVIEW"];
  const SUMMARY_STEP_TITLES = ["第1段落を書く", "第2段落を書く", "第3段落を書く", "添削に出す"];
  const SUMMARY_STEP_LABELS = ["PARAGRAPH 1", "PARAGRAPH 2", "PARAGRAPH 3", "CHECK"];
  const homePanel = document.getElementById("homePanel");
  const sessionPanel = document.getElementById("sessionPanel");
  const state = {
    questions: [],
    grade: "2kyu",
    round: "all",
    index: 0,
    step: 0,
    drafts: readStorage(DRAFTS_KEY),
    completed: readStorage(PROGRESS_KEY),
    loaded: false,
    loading: false,
  };

  function readStorage(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "{}");
      return value && typeof value === "object" ? value : {};
    } catch (error) {
      return {};
    }
  }

  function writeStorage(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (error) { /* 保存できなくても演習は続ける */ }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
  }

  function stringOrEmpty(value) { return typeof value === "string" ? value : ""; }
  function countWords(value) { const text = String(value || "").trim(); return text ? text.split(/\s+/).length : 0; }

  function isSummaryQuestion(question) { return question.type === "SUMMARY"; }

  function flowTitles(question) { return isSummaryQuestion(question) ? SUMMARY_STEP_TITLES : STEP_TITLES; }
  function flowLabels(question) { return isSummaryQuestion(question) ? SUMMARY_STEP_LABELS : STEP_LABELS; }

  function emptyDraft(type = "ESSAY") {
    return type === "SUMMARY"
      ? { paragraph1: "", paragraph2: "", paragraph3: "", answer: "", reviewed: false, clipboardCopied: false }
      : { translation: "", stance: "", head: "", body1Reason: "", body1Simple: "", body2Reason: "", body2Simple: "", conclusion: "", answer: "" };
  }

  function normalizeDraft(raw, type = "ESSAY") {
    const draft = emptyDraft(type);
    if (typeof raw === "string") { draft.answer = raw; return draft; }
    if (!raw || typeof raw !== "object") return draft;
    if (type === "SUMMARY") {
      draft.paragraph1 = stringOrEmpty(raw.paragraph1);
      draft.paragraph2 = stringOrEmpty(raw.paragraph2);
      draft.paragraph3 = stringOrEmpty(raw.paragraph3);
      draft.answer = stringOrEmpty(raw.answer);
      draft.reviewed = Boolean(raw.reviewed);
      draft.clipboardCopied = Boolean(raw.clipboardCopied);
      if (!draft.paragraph1 && !draft.paragraph2 && !draft.paragraph3 && draft.answer.trim()) draft.paragraph1 = draft.answer;
      return draft;
    }
    draft.translation = stringOrEmpty(raw.translation);
    draft.stance = raw.stance === "yes" || raw.stance === "no" ? raw.stance : "";
    draft.head = stringOrEmpty(raw.head);
    draft.body1Reason = stringOrEmpty(raw.body1Reason) || (Array.isArray(raw.reasons) ? stringOrEmpty(raw.reasons[0]) : "");
    draft.body1Simple = stringOrEmpty(raw.body1Simple) || (Array.isArray(raw.simpleReasons) ? stringOrEmpty(raw.simpleReasons[0]) : "");
    draft.body2Reason = stringOrEmpty(raw.body2Reason) || (Array.isArray(raw.reasons) ? stringOrEmpty(raw.reasons[1]) : "");
    draft.body2Simple = stringOrEmpty(raw.body2Simple) || (Array.isArray(raw.simpleReasons) ? stringOrEmpty(raw.simpleReasons[1]) : "");
    draft.conclusion = stringOrEmpty(raw.conclusion);
    draft.answer = stringOrEmpty(raw.answer);
    return draft;
  }

  function getDraft(question) {
    const draft = normalizeDraft(state.drafts[question.id], question.type);
    state.drafts[question.id] = draft;
    return draft;
  }

  function persistDraft(question, draft) {
    state.drafts[question.id] = draft;
    writeStorage(DRAFTS_KEY, state.drafts);
  }

  function visibleQuestions() {
    return state.questions.filter((question) => question.grade === state.grade && (state.round === "all" || question.round === state.round));
  }

  function applyGradeProfile() {
    const profile = window.EikenSerialProfile;
    if (profile && (profile.writingGrade === "2kyu" || profile.writingGrade === "pre2")) {
      state.grade = profile.writingGrade;
      state.round = "all";
    }
  }

  function currentQuestion() {
    const questions = visibleQuestions();
    if (!questions.length) return null;
    if (state.index >= questions.length) state.index = 0;
    return questions[state.index];
  }

  function statusFor(question, count) {
    if (!count) return { key: "empty", label: "未入力" };
    if (count < question.targetMin) return { key: "low", label: "語数不足" };
    if (count > question.targetMax) return { key: "high", label: "語数超過" };
    return { key: "ok", label: "目安内" };
  }

  function sectionTargets(question) {
    return question.grade === "2kyu"
      ? { head: { min: 10, max: 15 }, body1: { min: 29, max: 36 }, body2: { min: 29, max: 36 }, conclusion: { min: 10, max: 15 } }
      : { head: { min: 7, max: 9 }, body1: { min: 18, max: 22 }, body2: { min: 18, max: 22 }, conclusion: { min: 7, max: 9 } };
  }

  function targetMarkup(question, key, label) {
    const target = sectionTargets(question)[key];
    return `<div class="writingSectionTarget"><div><span>${escapeHtml(label)} / 英語の語数目安</span><small>完成した英文で確認</small></div><strong>${target.min}–${target.max}語</strong></div>`;
  }

  function overallTargetMarkup(question) {
    const label = isSummaryQuestion(question) ? "要約全体" : "英作文全体";
    const note = isSummaryQuestion(question) ? "準2級の読解本文を使った練習目安です。" : "文字数ではなく、英語の語数で確認します。";
    return `<div class="writingTarget"><div><p class="writingTargetKicker">WRITING TARGET</p><strong>${label} ${question.targetMin}–${question.targetMax}語</strong><small>${note}</small></div><span>目安</span></div>`;
  }

  function stepComplete(step, draft, question) {
    if (isSummaryQuestion(question)) {
      if (step === 0) return Boolean(draft.paragraph1.trim());
      if (step === 1) return Boolean(draft.paragraph2.trim());
      if (step === 2) return Boolean(draft.paragraph3.trim());
      return Boolean(draft.paragraph1.trim()) && Boolean(draft.paragraph2.trim()) && Boolean(draft.paragraph3.trim());
    }
    if (step === 0) return Boolean(draft.translation.trim());
    if (step === 1) return Boolean(draft.stance) && Boolean(draft.head.trim());
    if (step === 2) return Boolean(draft.body1Reason.trim()) && Boolean(draft.body1Simple.trim());
    if (step === 3) return Boolean(draft.body2Reason.trim()) && Boolean(draft.body2Simple.trim());
    if (step === 4) return Boolean(draft.conclusion.trim());
    return Boolean(draft.answer.trim());
  }

  function resumeStep(question, draft) {
    const last = flowTitles(question).length - 1;
    for (let step = 0; step < last; step += 1) if (!stepComplete(step, draft, question)) return step;
    return last;
  }

  function requirement(step, question) {
    if (isSummaryQuestion(question)) return [
      "第1段落の英文を入力してください。",
      "第2段落の英文を入力してください。",
      "第3段落の英文を入力してください。",
      "3段落を入力してから、添削用テキストを作成してください。",
    ][step];
    return [
      "まず、設問の日本語訳を入力してください。",
      "Yes / Noを選び、HEADの英文を入力してください。",
      "BODY 1の理由と、平易な日本語を入力してください。",
      "BODY 2の理由と、平易な日本語を入力してください。",
      "CONCLUSIONの英文を入力してください。",
      "完成した英作文を入力してください。",
    ][step];
  }

  function summaryParagraphs(question) {
    return String(question.prompt || "").split(/\n\s*\n/).map((value) => value.trim()).filter(Boolean);
  }

  function summaryAnswer(draft) {
    return [draft.paragraph1, draft.paragraph2, draft.paragraph3]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join("\n\n");
  }

  function summaryCopyText(question, draft) {
    const answers = [draft.paragraph1, draft.paragraph2, draft.paragraph3]
      .map((value, index) => `【第${index + 1}段落】\n${String(value || "").trim()}`)
      .join("\n\n");
    return [
      "英検準2級・英文要約練習の添削依頼",
      `練習目安：${question.targetMin}〜${question.targetMax}語`,
      "",
      "【原文】",
      summaryParagraphs(question).join("\n\n"),
      "",
      "【答案】",
      answers,
      "",
      "【添削の依頼】",
      `準2級レベルの英文要約練習として、${question.targetMin}〜${question.targetMax}語の目安を踏まえて添削してください。`,
      "内容・構成・語彙・文法の4観点で、よい点と改善点を具体的に示してください。",
      "第1〜3段落それぞれの内容の不足や、原文にない内容があれば指摘してください。",
      "最後に、修正例を示す場合は、どこを直したかが分かるように説明してください。",
    ].join("\n");
  }

  function summaryPromptMarkup(question) {
    return `<div class="writingSummaryPrompt" aria-label="要約の原文">${summaryParagraphs(question).map((paragraph, index) => `<article class="writingSummaryPromptParagraph"><p class="writingSummaryPromptLabel">原文 第${index + 1}段落</p><p>${escapeHtml(paragraph)}</p></article>`).join("")}</div>`;
  }

  function summaryDraftMarkup(draft) {
    return [draft.paragraph1, draft.paragraph2, draft.paragraph3]
      .map((value, index) => `<article class="summaryDraftParagraph"><span>第${index + 1}段落</span><p>${escapeHtml(value || "未入力")}</p></article>`)
      .join("");
  }

  function isGoodIdeaQuestion(question) { return /good idea/i.test(question.prompt); }

  function headTemplate(question, stance) {
    if (isGoodIdeaQuestion(question)) return stance === "yes" ? "Yes, I think it is a good idea." : "No, I do not think it is a good idea.";
    return stance === "yes" ? "Yes, I think so." : "No, I do not think so.";
  }

  function conclusionTemplate(question, stance) {
    if (isGoodIdeaQuestion(question)) return stance === "yes" ? "Therefore, I think it is a good idea." : "Therefore, I do not think it is a good idea.";
    return stance === "yes" ? "Therefore, I think so." : "Therefore, I do not think so.";
  }

  function fieldTextarea(label, value, field, placeholder) {
    return `<label class="writingField"><span>${escapeHtml(label)}</span><textarea data-field="${escapeHtml(field)}" spellcheck="true" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea></label>`;
  }

  function renderContext(draft, question) {
    if (state.step === 0) return "";
    if (isSummaryQuestion(question)) {
      const paragraphs = [draft.paragraph1, draft.paragraph2, draft.paragraph3].slice(0, state.step);
      return `<details class="writingContext" open><summary>ここまでの入力を確認する</summary><div class="writingSummaryList">${paragraphs.map((value, index) => summaryMarkup(`第${index + 1}段落`, value, index)).join("")}</div></details>`;
    }
    const summaries = [];
    summaries.push(summaryMarkup("設問の日本語訳", draft.translation, 0));
    if (state.step >= 2) {
      summaries.push(summaryMarkup("立場", draft.stance === "yes" ? "YES（賛成）" : "NO（反対）", 1));
      summaries.push(summaryMarkup("HEAD", draft.head, 1));
    }
    if (state.step >= 3) {
      summaries.push(summaryMarkup("BODY 1 / 理由", draft.body1Reason, 2));
      summaries.push(summaryMarkup("BODY 1 / 平易な日本語", draft.body1Simple, 2));
    }
    if (state.step >= 4) {
      summaries.push(summaryMarkup("BODY 2 / 理由", draft.body2Reason, 3));
      summaries.push(summaryMarkup("BODY 2 / 平易な日本語", draft.body2Simple, 3));
    }
    if (state.step >= 5) summaries.push(summaryMarkup("CONCLUSION", draft.conclusion, 4));
    return `<details class="writingContext" open><summary>ここまでの設計を確認する</summary><div class="writingSummaryList">${summaries.join("")}</div></details>`;
  }

  function summaryMarkup(label, value, editStep) {
    return `<div class="writingSummary"><div><span>${escapeHtml(label)}</span><button class="writingTextButton" type="button" data-edit-step="${editStep}">編集</button></div><p>${escapeHtml(value || "未入力")}</p></div>`;
  }

  function stanceMarkup(draft) {
    return `<fieldset class="writingStance"><legend>1. 立場を選ぶ</legend><p>まず、TOPICに対して Yes / No のどちらで書くか決めます。</p><div class="writingStanceOptions"><label class="writingStanceOption"><input type="radio" name="writing-stance" data-field="stance" value="yes" ${draft.stance === "yes" ? "checked" : ""}><span><strong>YES</strong><small>賛成する</small></span></label><label class="writingStanceOption"><input type="radio" name="writing-stance" data-field="stance" value="no" ${draft.stance === "no" ? "checked" : ""}><span><strong>NO</strong><small>反対する</small></span></label></div></fieldset>`;
  }

  function templateMarkup(kind, template) {
    const label = kind === "head" ? "HEADの定型" : "CONCLUSIONの定型";
    return `<div class="writingTemplate"><div><span>${label}</span><button class="writingTextButton" type="button" data-use-template="${kind}">この定型を入力</button></div><p>${escapeHtml(template || "Yes / Noを選ぶと定型が表示されます。")}</p></div>`;
  }

  function renderStepper(question) {
    const titles = flowTitles(question);
    const labels = flowLabels(question);
    return `<div class="writingStepper" role="tablist" aria-label="${titles.length}段階のフロー">${titles.map((title, index) => {
      const current = state.step === index;
      return `<button class="writingStepButton" type="button" role="tab" data-flow-step="${index}" aria-selected="${current}"${current ? " aria-current=\"step\"" : ""}${index > state.step ? " disabled" : ""}><span>${String(index + 1).padStart(2, "0")}</span><small>${labels[index]}</small>${escapeHtml(title)}</button>`;
    }).join("")}</div>`;
  }

  function renderBodyPanel(draft, question, number) {
    const prefix = number === 1 ? "body1" : "body2";
    return `<div class="writingPanel"><p class="writingKicker">STEP ${number + 2} / BODY ${number}</p><h3>BODY ${number}：理由を組み立てる</h3><p class="writingHelp">理由を先に日本語で考え、そのあと英語にしやすい平易な日本語へ直します。</p>${targetMarkup(question, prefix, `BODY ${number}`)}<div class="writingBodyGrid"><div class="writingBodySubstep"><p>01 / REASON</p>${fieldTextarea("理由を考える", draft[`${prefix}Reason`], `${prefix}Reason`, "この理由で立場を支えられるか、日本語で考えます。")}</div><div class="writingBodySubstep"><p>02 / SIMPLIFY</p>${fieldTextarea("平易な日本語にする", draft[`${prefix}Simple`], `${prefix}Simple`, "主語と動詞が見える短い日本語に直します。")}</div></div></div>`;
  }

  function renderSummaryStepPanel(draft, question) {
    let panel = renderContext(draft, question);
    if (state.step === 0) {
      panel += `<div class="writingPanel summaryParagraphPanel"><p class="writingKicker">STEP 1 / PARAGRAPH 1</p><h3>第1段落を書く</h3><p class="writingHelp">本文のテーマや背景を、英語で簡潔にまとめます。</p>${fieldTextarea("第1段落の英文", draft.paragraph1, "paragraph1", "本文のテーマ・背景を英語で書きます。")}</div>`;
    } else if (state.step === 1) {
      panel += `<div class="writingPanel summaryParagraphPanel"><p class="writingKicker">STEP 2 / PARAGRAPH 2</p><h3>第2段落を書く</h3><p class="writingHelp">本文の中心となる説明や具体例を、英語でまとめます。</p>${fieldTextarea("第2段落の英文", draft.paragraph2, "paragraph2", "本文の中心となる説明を書きます。")}</div>`;
    } else if (state.step === 2) {
      panel += `<div class="writingPanel summaryParagraphPanel"><p class="writingKicker">STEP 3 / PARAGRAPH 3</p><h3>第3段落を書く</h3><p class="writingHelp">本文の残りの重要点や注意点を、英語でまとめます。</p>${fieldTextarea("第3段落の英文", draft.paragraph3, "paragraph3", "本文の重要点や注意点を書きます。")}</div>`;
    } else {
      const count = countWords(summaryAnswer(draft));
      const status = statusFor(question, count);
      panel += `<div class="writingPanel writingReviewPanel"><p class="writingKicker">STEP 4 / CHECK</p><h3>個人の生成AIで添削する</h3><p class="writingHelp">3段落をまとめた依頼文を一括コピーし、普段使っている生成AIに貼り付けてください。このアプリ内では採点しません。</p>${overallTargetMarkup(question)}<div class="summaryDraftPreview">${summaryDraftMarkup(draft)}</div><div class="writingWordCount" data-status="${status.key}" aria-live="polite"><strong>${count}</strong><span>${status.label} / 目安 ${question.targetMin}–${question.targetMax}語</span></div><div class="summaryCopyBox"><label class="writingField"><span>生成AIに貼り付けるテキスト</span><textarea id="writingSummaryCopyPayload" class="summaryCopyPayload" readonly rows="14" aria-label="生成AIに貼り付ける添削依頼文"></textarea></label><div class="summaryCopyActions"><button type="button" id="writingSummaryCopyBtn">添削用テキストをコピー</button>${draft.reviewed ? `<span class="summaryCopyStatus">${draft.clipboardCopied ? "コピー済み" : "手動コピー済み"}。生成AIに貼り付けてください。</span>` : `<button class="ghost" type="button" id="writingSummaryManualCompleteBtn">手動でコピーしたので完了にする</button>`}</div></div>${draft.reviewed ? `<div class="resultBox ok"><strong>添削に出す準備ができました</strong><p>コピーしたテキストを個人の生成AIへ貼り付けて、内容・構成・語彙・文法を確認してください。</p><button class="ghost" type="button" id="writingSummaryUnreviewBtn">完了を取り消して編集する</button></div>` : ""}<details class="writingReference"><summary>参考解答を開く</summary><p>生成AIの添削後に、自分の答案との違いを確認します。</p><p>${escapeHtml(question.referenceAnswer)}</p></details></div>`;
    }
    return panel;
  }

  function renderStepPanel(draft, question) {
    if (isSummaryQuestion(question)) return renderSummaryStepPanel(draft, question);
    let panel = renderContext(draft, question);
    if (state.step === 0) {
      panel += `<div class="writingPanel"><p class="writingKicker">STEP 1 / TRANSLATE</p><h3>テーマの英文を日本語に訳す</h3><p class="writingHelp">まずは、設問が何を聞いているかを確かめます。ここでは直訳で構いません。</p>${fieldTextarea("日本語訳", draft.translation, "translation", "テーマの意味を日本語で書きます。")}</div>`;
    } else if (state.step === 1) {
      panel += `<div class="writingPanel"><p class="writingKicker">STEP 2 / HEAD</p><h3>HEAD：立場を示す</h3><p class="writingHelp">最初の1文で Yes / No を明確にします。定型を使って、意見を先に置きます。</p>${targetMarkup(question, "head", "HEAD")}${stanceMarkup(draft)}${templateMarkup("head", draft.stance ? headTemplate(question, draft.stance) : "")}${fieldTextarea("HEADの英文", draft.head, "head", "定型を参考にして、HEADの英文を書きます。")}</div>`;
    } else if (state.step === 2) {
      panel += renderBodyPanel(draft, question, 1);
    } else if (state.step === 3) {
      panel += renderBodyPanel(draft, question, 2);
    } else if (state.step === 4) {
      panel += `<div class="writingPanel"><p class="writingKicker">STEP 5 / CONCLUSION</p><h3>CONCLUSION：意見に戻る</h3><p class="writingHelp">最後に、定型を使って最初の意見へ戻ります。新しい理由はここで足しません。</p>${targetMarkup(question, "conclusion", "CONCLUSION")}${templateMarkup("conclusion", conclusionTemplate(question, draft.stance))}${fieldTextarea("CONCLUSIONの英文", draft.conclusion, "conclusion", "定型を参考にして、CONCLUSIONの英文を書きます。")}</div>`;
    } else {
      const count = countWords(draft.answer);
      const status = statusFor(question, count);
      panel += `<div class="writingPanel writingReviewPanel"><p class="writingKicker">STEP 6 / REVIEW</p><h3>全体をレビューする</h3><p class="writingHelp">HEAD、BODY 1、BODY 2、CONCLUSIONの順につながっているかを確認し、完成した英作文を入力します。</p>${overallTargetMarkup(question)}${fieldTextarea("完成した英作文", draft.answer, "answer", "HEAD → BODY 1 → BODY 2 → CONCLUSION の順で書きます。")}
        <div class="writingWordCount" data-status="${status.key}" aria-live="polite"><strong>${count}</strong><span>${status.label} / 目安 ${question.targetMin}–${question.targetMax}語</span></div>
        <div class="writingReviewActions"><span>${draft.answer.trim() ? "自動保存済み" : "入力すると自動保存"}</span><button class="ghost" type="button" data-action="save">下書きを保存</button><button type="button" data-action="reference">参考解答を見る</button></div>
        <div class="writingChecks"><h4>レビュー項目</h4><label><input type="checkbox"> HEADでYes / Noの立場が伝わる</label><label><input type="checkbox"> BODY 1とBODY 2に、それぞれ理由と説明がある</label><label><input type="checkbox"> CONCLUSIONが最初の意見に戻っている</label><label><input type="checkbox"> 英作文全体の語数と文のつながりを確認した</label></div>
        <details class="writingReference" data-reference><summary>参考解答を開く</summary><p>自分の構成や表現との違いを確認します。</p><p>${escapeHtml(question.referenceAnswer)}</p><p class="writingSourceNote">出典PDFは公開サイトには含めていません。</p></details>
      </div>`;
    }
    return panel;
  }

  function renderSession() {
    const question = currentQuestion();
    if (!question) {
      sessionPanel.innerHTML = `<div class="card"><h2>この条件の問題はありません。</h2><button class="ghost" type="button" data-action="back-home">問題一覧へ戻る</button></div>`;
      return;
    }
    const draft = getDraft(question);
    const questions = visibleQuestions();
    const titles = flowTitles(question);
    const stepCount = titles.length;
    state.step = Math.min(Math.max(0, state.step), stepCount - 1);
    const nextLabel = titles[state.step + 1] || "";
    const questionTitle = isSummaryQuestion(question)
      ? (question.label || `英文要約練習：${question.sourceTitle || ""}`)
      : question.prompt;
    const promptBody = isSummaryQuestion(question)
      ? `<p>${escapeHtml(question.instruction)}</p>${summaryPromptMarkup(question)}`
      : `<p>${escapeHtml(question.instruction)}</p>`;
    const questionNumber = isSummaryQuestion(question) ? "要約補助" : `Q${question.number}`;
    const flowHeading = isSummaryQuestion(question) ? "3段落でまとめる" : "6段階で英作文を組み立てる";
    const finalNavigation = isSummaryQuestion(question)
      ? "<span>添削用テキストをコピーして、個人の生成AIへ貼り付けます。</span>"
      : "<span>チェックを終えたら、参考解答と比べます。</span>";
    const points = question.points.length ? `<div class="writingPoints"><span>POINTS</span>${question.points.map((point) => `<span>${escapeHtml(point)}</span>`).join("")}</div>` : "";
    sessionPanel.className = "writingSession";
    sessionPanel.innerHTML = `<div class="writingSessionHead"><button class="ghost" type="button" data-action="back-home">← 問題一覧</button><p>問題 ${String(state.index + 1).padStart(2, "0")} / ${questions.length}</p><button class="ghost" type="button" data-action="restart">この問題を最初から</button></div>
      <article class="card writingPromptCard"><div class="writingPromptMeta"><span>${escapeHtml(question.type)}</span><span>${escapeHtml(question.gradeLabel)}</span><span>${escapeHtml(question.round)}</span><span>${questionNumber}</span></div><h2>${escapeHtml(questionTitle)}</h2>${promptBody}${overallTargetMarkup(question)}${points}</article>
      <section class="card writingFlow"><div class="writingFlowHeader"><div><p class="writingKicker">YOUR RESPONSE</p><h2>${flowHeading}</h2></div><div class="writingFlowProgress"><strong>STEP ${state.step + 1} / ${stepCount}</strong><span>${escapeHtml(titles[state.step])}</span></div></div>${renderStepper(question)}<p class="writingFlowStatus" aria-live="polite"></p>${renderStepPanel(draft, question)}<div class="writingNavigation"><button class="ghost" type="button" data-flow-nav="previous"${state.step === 0 ? " disabled" : ""}>← 前のステップ</button>${state.step < stepCount - 1 ? `<button type="button" data-flow-nav="next">${nextLabel} →</button>` : finalNavigation}</div></section>
      <div class="writingQuestionNav"><button class="ghost" type="button" data-action="previous-question">← 前の問題</button><button class="ghost" type="button" data-action="next-question">次の問題 →</button></div>`;
    bindSession(question, draft, questions);
  }

  function focusInvalid(step, question) {
    if (isSummaryQuestion(question)) {
      const field = ["paragraph1", "paragraph2", "paragraph3"][step] || "paragraph1";
      sessionPanel.querySelector(`textarea[data-field="${field}"]`)?.focus();
      return;
    }
    const stanceSelected = sessionPanel.querySelector('input[data-field="stance"]:checked');
    const selector = step === 1 && !stanceSelected
      ? 'input[data-field="stance"]'
      : `textarea[data-field="${["translation", "head", "body1Reason", "body2Reason", "conclusion", "answer"][step]}"]`;
    const target = sessionPanel.querySelector(selector);
    if (target) target.focus();
  }

  function bindSession(question, draft, questions) {
    const flowStatus = sessionPanel.querySelector(".writingFlowStatus");
    const answerField = sessionPanel.querySelector('textarea[data-field="answer"]');
    const wordCount = sessionPanel.querySelector(".writingWordCount");
    const updateWordCount = () => {
      if (!answerField || !wordCount) return;
      const count = countWords(answerField.value);
      const status = statusFor(question, count);
      wordCount.dataset.status = status.key;
      wordCount.querySelector("strong").textContent = String(count);
      wordCount.querySelector("span").textContent = `${status.label} / 目安 ${question.targetMin}–${question.targetMax}語`;
      draft.answer = answerField.value;
      persistDraft(question, draft);
    };
    sessionPanel.querySelectorAll("textarea[data-field]").forEach((field) => field.addEventListener("input", () => {
      if (field.dataset.field === "answer") updateWordCount();
      else if (isSummaryQuestion(question)) {
        draft[field.dataset.field] = field.value;
        draft.answer = summaryAnswer(draft);
        draft.reviewed = false;
        draft.clipboardCopied = false;
        state.completed[question.id] = false;
        writeStorage(PROGRESS_KEY, state.completed);
        persistDraft(question, draft);
      } else { draft[field.dataset.field] = field.value; persistDraft(question, draft); }
    }));
    sessionPanel.querySelectorAll('input[data-field="stance"]').forEach((input) => input.addEventListener("change", () => {
      const oldHead = draft.stance ? headTemplate(question, draft.stance) : "";
      const oldConclusion = draft.stance ? conclusionTemplate(question, draft.stance) : "";
      if (!draft.head || draft.head === oldHead) draft.head = "";
      if (!draft.conclusion || draft.conclusion === oldConclusion) draft.conclusion = "";
      draft.stance = input.value;
      persistDraft(question, draft);
      renderSession();
    }));
    sessionPanel.querySelectorAll("[data-flow-step]").forEach((button) => button.addEventListener("click", () => {
      if (!button.disabled) { state.step = Number(button.dataset.flowStep); renderSession(); }
    }));
    sessionPanel.querySelectorAll("[data-edit-step]").forEach((button) => button.addEventListener("click", () => {
      state.step = Number(button.dataset.editStep); renderSession();
    }));
    sessionPanel.querySelectorAll("[data-use-template]").forEach((button) => button.addEventListener("click", () => {
      if (!draft.stance) { flowStatus.textContent = "先にYes / Noの立場を選んでください。"; focusInvalid(1, question); return; }
      const fieldName = button.dataset.useTemplate === "head" ? "head" : "conclusion";
      const field = sessionPanel.querySelector(`textarea[data-field="${fieldName}"]`);
      field.value = fieldName === "head" ? headTemplate(question, draft.stance) : conclusionTemplate(question, draft.stance);
      draft[fieldName] = field.value;
      persistDraft(question, draft);
      field.focus();
    }));
    sessionPanel.querySelectorAll("[data-flow-nav]").forEach((button) => button.addEventListener("click", () => {
      if (button.dataset.flowNav === "previous") { state.step = Math.max(0, state.step - 1); renderSession(); return; }
      const stepCount = flowTitles(question).length;
      if (stepComplete(state.step, draft, question)) { state.step = Math.min(stepCount - 1, state.step + 1); renderSession(); return; }
      flowStatus.textContent = requirement(state.step, question);
      focusInvalid(state.step, question);
    }));
    sessionPanel.querySelector('[data-action="save"]')?.addEventListener("click", () => {
      persistDraft(question, draft);
      if (flowStatus) flowStatus.textContent = "下書きを保存しました。";
    });
    sessionPanel.querySelector('[data-action="reference"]')?.addEventListener("click", () => {
      if (!draft.answer.trim()) { flowStatus.textContent = "まず完成した英作文を入力してください。"; focusInvalid(5, question); return; }
      const reference = sessionPanel.querySelector("[data-reference]");
      reference.open = true;
      state.completed[question.id] = true;
      writeStorage(PROGRESS_KEY, state.completed);
      reference.querySelector("summary").focus();
    });
    const summaryPayload = sessionPanel.querySelector("#writingSummaryCopyPayload");
    if (summaryPayload && isSummaryQuestion(question)) {
      summaryPayload.value = summaryCopyText(question, draft);
      sessionPanel.querySelector("#writingSummaryCopyBtn")?.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(summaryPayload.value);
          draft.reviewed = true;
          draft.clipboardCopied = true;
          state.completed[question.id] = true;
          writeStorage(PROGRESS_KEY, state.completed);
          persistDraft(question, draft);
          renderSession();
        } catch (error) {
          summaryPayload.focus();
          summaryPayload.select();
          if (flowStatus) flowStatus.textContent = "自動コピーできませんでした。テキストを選択したので、Ctrl+Cでコピーしてください。";
        }
      });
      sessionPanel.querySelector("#writingSummaryManualCompleteBtn")?.addEventListener("click", () => {
        draft.reviewed = true;
        draft.clipboardCopied = false;
        state.completed[question.id] = true;
        writeStorage(PROGRESS_KEY, state.completed);
        persistDraft(question, draft);
        renderSession();
      });
      sessionPanel.querySelector("#writingSummaryUnreviewBtn")?.addEventListener("click", () => {
        draft.reviewed = false;
        draft.clipboardCopied = false;
        state.completed[question.id] = false;
        writeStorage(PROGRESS_KEY, state.completed);
        persistDraft(question, draft);
        renderSession();
      });
    }
    sessionPanel.querySelector('[data-action="back-home"]')?.addEventListener("click", renderHome);
    sessionPanel.querySelector('[data-action="restart"]')?.addEventListener("click", () => { state.step = 0; renderSession(); });
    sessionPanel.querySelector('[data-action="previous-question"]')?.addEventListener("click", () => { state.index = (state.index - 1 + questions.length) % questions.length; state.step = 0; renderSession(); });
    sessionPanel.querySelector('[data-action="next-question"]')?.addEventListener("click", () => { state.index = (state.index + 1) % questions.length; state.step = 0; renderSession(); });
  }

  function questionStatus(question) {
    const draft = getDraft(question);
    if (state.completed[question.id]) return { label: "レビュー済み", className: "done", action: "復習する" };
    const fields = isSummaryQuestion(question)
      ? ["paragraph1", "paragraph2", "paragraph3"]
      : ["translation", "stance", "head", "body1Reason", "body1Simple", "body2Reason", "body2Simple", "conclusion", "answer"];
    if (fields.some((field) => String(draft[field] || "").trim())) return { label: `STEP ${resumeStep(question, draft) + 1} まで入力`, className: "progress", action: "続きから" };
    return { label: "未回答", className: "", action: "始める" };
  }

  function renderHome() {
    homePanel.className = "writingHome";
    sessionPanel.className = "hide";
    const gradeQuestions = state.questions.filter((question) => question.grade === state.grade);
    const questions = visibleQuestions();
    const completed = gradeQuestions.filter((question) => Boolean(state.completed[question.id])).length;
    const rounds = [...new Set(gradeQuestions.map((question) => question.round))];
    const isPre2 = state.grade === "pre2";
    const heroLead = isPre2
      ? "テーマ英作文に加えて、読解本文を3段落でまとめる要約補助練習も用意しています。添削は個人の生成AIへ一括で渡します。"
      : "テーマの意味を確認し、HEAD・BODY 1・BODY 2・CONCLUSIONの順に英作文を作ります。日本語の理由を平易に直す工程も省略しません。";
    const heroRule = isPre2
      ? "英作文 6段階 / 要約 4段階"
      : "TRANSLATE → HEAD → BODY 1 → BODY 2 → CONCLUSION → REVIEW";
    homePanel.innerHTML = `<section class="card hero"><p class="label">EIKEN WRITING / ${state.grade === "2kyu" ? "GRADE 2" : "PRE-2"}</p><h2>訳して、組み立てて、書く。</h2><p class="writingLead">${heroLead}</p><div class="writingHeroRule"><strong>${isPre2 ? "2つの練習" : "6段階"}</strong><span>${heroRule}</span></div></section>
      <section class="card"><div class="writingHomeHeader"><div><p class="label">PRACTICE MENU</p><h2>英作文の問題を選ぶ</h2></div><div class="writingGradeButtons"><button class="ghost" type="button" data-grade="2kyu" aria-pressed="${state.grade === "2kyu"}">2級</button><button class="ghost" type="button" data-grade="pre2" aria-pressed="${state.grade === "pre2"}">準2級</button></div></div><div class="writingStats"><div><strong>${completed} / ${gradeQuestions.length}</strong><span>レビュー済み</span></div><div><strong>${questions.length}</strong><span>表示中の問題</span></div><div><strong>${state.grade === "2kyu" ? "80–100" : "50–60"}</strong><span>英作文全体の語数</span></div></div><div class="writingFilters"><button class="writingFilter" type="button" data-round="all" aria-pressed="${state.round === "all"}">すべて</button>${rounds.map((round) => `<button class="writingFilter" type="button" data-round="${escapeHtml(round)}" aria-pressed="${state.round === round}">${escapeHtml(round)}</button>`).join("")}</div><div class="writingQuestionList">${questions.length ? questions.map((question, index) => {
      const status = questionStatus(question);
      const title = isSummaryQuestion(question) ? (question.label || `英文要約練習：${question.sourceTitle || ""}`) : question.prompt;
      const instruction = isSummaryQuestion(question) ? "3段落に分けて英文を書き、添削用テキストを個人の生成AIへコピーします。" : question.instruction;
      const typeLabel = isSummaryQuestion(question) ? "SUMMARY / 補助" : question.type;
      return `<article class="writingQuestionCard ${status.className}"><div class="writingQuestionMeta"><span>${escapeHtml(typeLabel)}</span><span>${escapeHtml(question.round)}</span></div><h3>${escapeHtml(title)}</h3><p>${escapeHtml(instruction)}</p>${overallTargetMarkup(question)}<div class="writingQuestionFooter"><span>${status.label}</span><button type="button" data-practice-index="${index}">${status.action}</button></div></article>`;
    }).join("") : "<p class=\"hint\">この条件の問題はありません。</p>"}</div></section>
      <section class="card writingGuide"><p class="label">HOW TO WRITE</p><h2>入力する順番</h2>${isPre2 ? "<ol><li><strong>英作文</strong><span>テーマを訳し、HEAD・BODY 1・BODY 2・CONCLUSIONを順に作ります。</span></li><li><strong>英文要約</strong><span>原文を確認し、第1〜3段落を書いたあと、添削用テキストをコピーします。</span></li></ol>" : "<ol><li><strong>テーマを訳す</strong><span>何を聞かれているかを日本語で確認します。</span></li><li><strong>HEAD</strong><span>Yes / Noを選び、定型で立場を示します。</span></li><li><strong>BODY 1・2</strong><span>理由を考え、英語にしやすい平易な日本語に直します。</span></li><li><strong>CONCLUSION・REVIEW</strong><span>定型で結び、全体の語数とつながりを確認します。</span></li></ol>"}<p class="hint">表示される語数は文字数ではなく、英語の単語数です。</p></section>`;
    homePanel.querySelectorAll("[data-grade]").forEach((button) => button.addEventListener("click", () => { state.grade = button.dataset.grade; state.round = "all"; state.index = 0; renderHome(); }));
    homePanel.querySelectorAll("[data-round]").forEach((button) => button.addEventListener("click", () => { state.round = button.dataset.round; state.index = 0; renderHome(); }));
    homePanel.querySelectorAll("[data-practice-index]").forEach((button) => button.addEventListener("click", () => {
      state.index = Number(button.dataset.practiceIndex);
      const question = currentQuestion();
      state.step = resumeStep(question, getDraft(question));
      sessionPanel.className = "writingSession";
      homePanel.className = "hide";
      renderSession();
    }));
  }

  function startSerial() {
    applyGradeProfile();
    const questions = visibleQuestions();
    if (!questions.length) {
      renderHome();
      return;
    }
    const nextIndex = questions.findIndex((question) => !state.completed[question.id]);
    state.index = nextIndex >= 0 ? nextIndex : 0;
    const question = currentQuestion();
    state.step = resumeStep(question, getDraft(question));
    homePanel.className = "hide";
    sessionPanel.className = "writingSession";
    renderSession();
  }

  async function mount() {
    applyGradeProfile();
    if (state.loaded) { renderHome(); return; }
    if (state.loading) return;
    state.loading = true;
    homePanel.className = "writingHome";
    sessionPanel.className = "hide";
    homePanel.innerHTML = `<div class="card"><p class="loading">英作文の問題を読み込んでいます…</p></div>`;
    try {
      const response = await fetch(DATA_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      state.questions = Array.isArray(data) ? data : [];
      state.loaded = true;
      if (window.EikenActiveAppId === "writing") renderHome();
    } catch (error) {
      homePanel.innerHTML = `<div class="card"><h2>問題を読み込めませんでした</h2><p>HTTPサーバー経由で起動しているか確認してください。</p><p class="hint">${escapeHtml(error.message)}</p></div>`;
    } finally {
      state.loading = false;
    }
  }

  function handleKey(event) {
    if (window.EikenActiveAppId !== "writing") return;
    if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && event.target instanceof HTMLTextAreaElement) {
      const next = sessionPanel.querySelector('[data-flow-nav="next"]');
      if (next) { event.preventDefault(); next.click(); }
    }
  }

  return { mount, handleKey, startSerial };
})();
