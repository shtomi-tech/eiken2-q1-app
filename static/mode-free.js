"use strict";

/*
 * 英検 自由演習
 *
 * 直列コースの順序・ロックを外した技能一覧。各技能の回答保存は既存モードに任せる。
 */
const EikenFreeApp = (function () {
  const homePanel = document.getElementById("homePanel");
  const sessionPanel = document.getElementById("sessionPanel");
  const SKILLS = [
    { id: "q1", label: "大問1（語彙）", tag: "VOCABULARY", description: "意味確認から4択、誤答復習まで。" },
    { id: "paraphrase", label: "言い換え", tag: "PARAPHRASE", description: "もの・人・場所を別の言い方で説明する練習。" },
    { id: "writing", label: "英作文", tag: "WRITING", description: "型に沿って理由と結論を書き、レビューする練習。" },
    { id: "dictation", label: "リスニング", tag: "LISTENING", description: "音声を聞いて答え、必要な設問を書き取る練習。" },
    { id: "q3", label: "大問3（長文）", tag: "READING", description: "設問と本文の根拠、内容整理まで確認する練習。" },
  ];

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function getProfile() {
    if (!window.EikenGradeEntryApp) return null;
    if (typeof window.EikenGradeEntryApp.ensureLoaded === "function") await window.EikenGradeEntryApp.ensureLoaded();
    return window.EikenGradeEntryApp.getProfile();
  }

  function openSkill(id) {
    if (window.EikenAppRouter) window.EikenAppRouter.open(id, { free: true });
  }

  function renderHome(profile) {
    homePanel.className = "freeHome";
    sessionPanel.className = "hide";
    if (!profile) {
      homePanel.innerHTML = `<section class="card hero freeHero">
        <p class="label">FREE PRACTICE / SETUP REQUIRED</p>
        <h2>先に英検の級を選びます</h2>
        <p>自由演習でも、問題データを正しい級に合わせる必要があります。</p>
        <div class="actions"><button class="cta serialPrimary" type="button" id="freeChooseGradeBtn">級を選ぶ</button></div>
      </section>`;
      document.getElementById("freeChooseGradeBtn").addEventListener("click", () => {
        if (window.EikenAppRouter) window.EikenAppRouter.open("entry");
      });
      return;
    }

    if (window.EikenGradeEntryApp) window.EikenGradeEntryApp.applyProfile(profile);
    const cards = SKILLS.map((skill) => `<article class="freeSkillCard">
      <div class="freeSkillTop"><span class="freeSkillNo">${String(SKILLS.indexOf(skill) + 1).padStart(2, "0")}</span><span class="freeSkillTag">${skill.tag}</span></div>
      <h3>${skill.label}</h3>
      <p>${skill.description}</p>
      <button class="cta" type="button" data-skill="${skill.id}">この技能を演習する</button>
    </article>`).join("");
    homePanel.innerHTML = `<section class="card hero freeHero">
      <p class="label">FREE PRACTICE / ${escapeHtml(profile.label)}</p>
      <h2>好きな技能から演習する</h2>
      <p>順番のロックはありません。今日の課題や残り時間に合わせて、取り組む技能を選べます。</p>
      <div class="freeModeLinks"><button class="ghost" type="button" id="freeSerialBtn">学習ルートへ戻る</button><button class="ghost" type="button" id="freeGradeBtn">級を変更</button></div>
    </section>
    <section class="card freeSkillSection">
      <div class="sectionHead"><div><p class="label">SKILLS</p><h2>演習する技能</h2></div><p class="hint">現在の設定：${escapeHtml(profile.label)}</p></div>
      <div class="freeSkillList">${cards}</div>
    </section>
    <section class="card gradeEntryNote"><p class="label">保存について</p><p class="freeNoteText">回答・下書き・途中位置は、これまでどおり各技能に保存されます。自由演習で進めても、学習ルートの進捗データは壊れません。</p></section>`;

    homePanel.querySelectorAll("[data-skill]").forEach((button) => {
      button.addEventListener("click", () => openSkill(button.dataset.skill));
    });
    document.getElementById("freeSerialBtn").addEventListener("click", () => {
      if (window.EikenAppRouter) window.EikenAppRouter.open("serial");
    });
    document.getElementById("freeGradeBtn").addEventListener("click", () => {
      if (window.EikenAppRouter) window.EikenAppRouter.open("entry");
    });
    if (window.EikenAppRouter) window.EikenAppRouter.refreshNav();
  }

  async function mount() {
    homePanel.className = "freeHome";
    sessionPanel.className = "hide";
    homePanel.innerHTML = `<div class="card"><p class="loading">自由演習を読み込んでいます…</p></div>`;
    try {
      const profile = await getProfile();
      renderHome(profile);
    } catch (error) {
      homePanel.innerHTML = `<div class="card"><h2>自由演習を読み込めませんでした</h2><p class="hint">${escapeHtml(error.message)}</p></div>`;
      console.error(error);
    }
  }

  function handleKey() { /* 自由演習一覧はキーボードショートカットなし */ }

  return { mount, handleKey };
})();

window.EikenFreeApp = EikenFreeApp;
