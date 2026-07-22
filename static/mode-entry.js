"use strict";

/*
 * 英検 級入口
 *
 * 級を一度選ぶと、各技能モードが同じ級・回を使うように既存設定を揃える。
 * 学習ルートと自由演習のどちらから入るかは、この画面で選択する。
 */
const EikenGradeEntryApp = (function () {
  const MANIFEST_URL = "data/manifest.json";
  const PROFILE_KEY = "eiken_grade_profile_v1";
  const homePanel = document.getElementById("homePanel");
  const sessionPanel = document.getElementById("sessionPanel");

  let manifest = null;
  let loading = null;
  let identity = null; // { state: "anonymous" | "student" | "error", ... } — 一度解決したら再取得しない

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

  // 共有URL（?s=&t=）でログイン中の生徒名を解決する。共有URLでなければ何もしない（従来どおり匿名ローカル）。
  async function ensureIdentity() {
    if (identity) return identity;
    const shared = typeof parseSharedParams === "function" ? parseSharedParams() : { studentId: "", token: "" };
    if (!shared.studentId && !shared.token) {
      identity = { state: "anonymous" };
      return identity;
    }
    try {
      const cfg = normalizeConfig(await loadOptionalJson("static/config.json"));
      if (!cfg.supabaseUrl || !cfg.supabaseAnonKey) throw new Error("クラウド設定が未完了です。先生に連絡してください。");
      const response = await fetch(`${cfg.supabaseUrl}/rest/v1/rpc/app_auth_student`, {
        method: "POST",
        headers: {
          apikey: cfg.supabaseAnonKey,
          Authorization: `Bearer ${cfg.supabaseAnonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ p_student_id: shared.studentId, p_access_token: shared.token }),
      });
      if (!response.ok) throw new Error(`app_auth_student: HTTP ${response.status}`);
      const rows = await response.json();
      const student = Array.isArray(rows) ? rows[0] : rows;
      if (!student || !student.id) throw new Error("生徒URLを確認できませんでした。QRコードを作り直してください。");
      identity = { state: "student", id: String(student.id), name: String(student.display_name || student.id) };
    } catch (error) {
      console.error(error);
      identity = { state: "error", id: shared.studentId, message: error.message || "生徒URLを確認できませんでした。" };
    }
    return identity;
  }

  function setShareStatus(message, tone = "") {
    const slot = document.getElementById("shareStatus");
    if (!slot) return;
    slot.textContent = message || "";
    slot.className = `shareStatus${tone ? ` ${tone}` : ""}`;
  }

  function renderIdentity() {
    if (!identity || identity.state === "anonymous") {
      setShareStatus("");
      return "";
    }
    if (identity.state === "error") {
      setShareStatus(identity.message, "ng");
      return `<div class="gradeEntryUser isError"><span class="label">LOGIN / 確認が必要</span><strong>生徒を確認できませんでした</strong><span>${escapeHtml(identity.message)}</span></div>`;
    }
    setShareStatus(`${identity.name} さんとして学習中（進捗はクラウド保存）`, "ok");
    return `<div class="gradeEntryUser"><span class="label">LOGGED IN / ログイン中</span><strong>${escapeHtml(identity.name)} さん</strong><span>ID: ${escapeHtml(identity.id)}／この先の進捗は、この生徒として保存されます。</span></div>`;
  }

  async function ensureLoaded() {
    if (manifest) return manifest;
    if (loading) return loading;
    loading = fetch(MANIFEST_URL, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) throw new Error(`${MANIFEST_URL}: HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        manifest = data;
        return manifest;
      })
      .finally(() => { loading = null; });
    return loading;
  }

  function gradeFromQ1Id(q1Id) {
    const id = String(q1Id);
    if (id.startsWith("eikenp1-")) return "pre1";
    if (id.startsWith("eikenp2-")) return "pre2";
    return "2kyu";
  }

  function makeProfile(q1Id) {
    if (!manifest) return null;
    if (manifest.pre1 && manifest.pre1.rounds && q1Id && q1Id.startsWith("eikenp1-")) {
      const round = manifest.pre1.rounds.find((item) => item.id === q1Id.replace("eikenp1-", "")) || manifest.pre1.rounds[0];
      return {
        id: q1Id,
        grade: "pre1",
        label: `英検準1級 ${round.label.replace("年度 ", "年度")}`,
        q1Id: null,
        q3Id: null,
        pre1Id: q1Id,
        dictation: null,
        writingGrade: "pre1",
      };
    }
    if (!manifest.q1 || !manifest.q1[q1Id]) return null;
    const grade = gradeFromQ1Id(q1Id);
    const q3Id = manifest.q3 && manifest.q3[q1Id] ? q1Id : manifest.defaultDatasetId;
    const level = grade === "pre2" ? "p2" : "g2";
    const fallbackRound = q1Id.slice(q1Id.lastIndexOf("-") + 1);
    const rounds = manifest.dictation.levels[level].rounds;
    const round = rounds[fallbackRound] ? fallbackRound : manifest.dictation.defaultRound;
    return {
      id: q1Id,
      grade,
      label: manifest.q1[q1Id].label,
      q1Id,
      q3Id,
      dictation: { level, round },
      writingGrade: grade,
    };
  }

  function currentQ1Id() {
    const savedProfile = readJson(PROFILE_KEY, null);
    if (savedProfile && manifest.q1 && manifest.q1[savedProfile.q1Id]) return savedProfile.q1Id;
    if (savedProfile && manifest.pre1 && savedProfile.pre1Id && manifest.pre1.rounds.some((round) => `eikenp1-${round.id}` === savedProfile.pre1Id)) return savedProfile.pre1Id;
    const savedDataset = localStorage.getItem("eiken_q1_dataset");
    if (manifest.q1 && manifest.q1[savedDataset]) return savedDataset;
    return null;
  }

  function getProfile() {
    if (!manifest) return null;
    const q1Id = currentQ1Id();
    return q1Id ? makeProfile(q1Id) : null;
  }

  function preferredQ1Id(grade) {
    const current = currentQ1Id();
    if (current && gradeFromQ1Id(current) === grade) return current;
    if (grade === "pre1") {
      const preferred = manifest.pre1.rounds.find((round) => round.id === "2026-1") || manifest.pre1.rounds[0];
      return `eikenp1-${preferred.id}`;
    }
    const prefix = grade === "pre2" ? "eikenp2-" : "eiken2-";
    const ids = Object.keys(manifest.q1 || {}).filter((id) => id.startsWith(prefix));
    return ids.find((id) => id.endsWith("2026-1")) || ids[0] || manifest.defaultDatasetId;
  }

  function applyProfile(nextProfile) {
    if (!nextProfile) return null;
    try {
      localStorage.setItem(PROFILE_KEY, JSON.stringify(nextProfile));
      if (nextProfile.q1Id) localStorage.setItem("eiken_q1_dataset", nextProfile.q1Id);
      if (nextProfile.q3Id) localStorage.setItem("eiken_q3_dataset", nextProfile.q3Id);
      if (nextProfile.dictation) localStorage.setItem("eiken_dictation_dataset", JSON.stringify(nextProfile.dictation));
      if (nextProfile.pre1Id) localStorage.setItem("eiken_pre1_round", nextProfile.pre1Id.replace("eikenp1-", ""));
    } catch (error) {
      /* 保存できなくても、その場の演習は続けられる */
    }
    window.EikenSerialProfile = nextProfile;
    return nextProfile;
  }

  function setGrade(grade) {
    const nextProfile = makeProfile(preferredQ1Id(grade));
    return applyProfile(nextProfile);
  }

  function startPath(grade, path) {
    const nextProfile = setGrade(grade);
    if (!nextProfile || !window.EikenAppRouter) return;
    if (nextProfile.grade === "pre1") {
      window.EikenAppRouter.open(path === "free" ? "pre1" : "serial", path === "free" ? { free: true } : {});
      return;
    }
    window.EikenAppRouter.open(path === "free" ? "free" : "serial");
  }

  function renderHome() {
    const profile = getProfile();
    homePanel.className = "gradeEntryHome";
    sessionPanel.className = "hide";
    const current = profile
      ? `<div class="gradeEntryCurrent"><span class="label">現在の設定</span><strong>${escapeHtml(profile.label)}</strong><span>級を選び直すと、各技能のデータも同じ級に切り替わります。</span></div>`
      : `<div class="gradeEntryCurrent"><span class="label">最初にすること</span><strong>受験する級を選ぶ</strong><span>あとから変更できます。進捗データは級ごとに残ります。</span></div>`;

    const grades = [
      {
        id: "pre2",
        label: "準2級",
        eyebrow: "EIKEN GRADE PRE-2",
        description: "高校中級程度。準2級用の語彙・長文・音声に切り替わります。",
      },
      {
        id: "2kyu",
        label: "2級",
        eyebrow: "EIKEN GRADE 2",
        description: "高校卒業程度。語彙・英作文・長文をまとまりで進めます。",
      },
      {
        id: "pre1",
        label: "準1級",
        eyebrow: "EIKEN GRADE PRE-1",
        description: "大学中級程度。準1級の過去問3回分を、セクションごとに演習します。",
      },
    ];
    const cards = grades.map((grade) => `<article class="gradeChoiceCard ${profile && profile.grade === grade.id ? "isSelected" : ""}">
      <p class="label">${grade.eyebrow}</p>
      <h3>${grade.label}</h3>
      <p>${grade.description}</p>
      <div class="gradeChoiceActions">
        <button class="cta" type="button" data-grade="${grade.id}" data-route="serial">学習ルートへ</button>
        <button class="ghost" type="button" data-grade="${grade.id}" data-route="free">自由演習へ</button>
      </div>
    </article>`).join("");

    homePanel.innerHTML = `<section class="card hero gradeEntryHero">
      <p class="label">CHOOSE GRADE / START HERE</p>
      <h2>${profile ? "級を確認して、演習を始める" : "英検の級を選ぶ"}</h2>
      <p class="gradeEntryLead">級を先に決めると、語彙・英作文・リスニング・長文の入口が揃います。そのあと、順番に進むか、好きな技能から始めるかを選べます。</p>
      ${renderIdentity()}
      ${current}
    </section>
    <section class="card gradeChoiceSection">
      <div class="sectionHead"><div><p class="label">GRADE</p><h2>受験する級</h2></div><p class="hint">先に級、次に進み方。</p></div>
      <div class="gradeChoiceGrid">${cards}</div>
    </section>
    <section class="card gradeEntryNote"><p class="label">2つの進み方</p><div class="gradeEntryModes"><p><strong>学習ルート</strong><span>大問1 → 言い換え → 英作文 → リスニング → 大問3の順に進みます。</span></p><p><strong>自由演習</strong><span>順番のロックを外し、五つの技能からその日に取り組むものを選べます。</span></p></div></section>`;

    homePanel.querySelectorAll("[data-grade][data-route]").forEach((button) => {
      button.addEventListener("click", () => startPath(button.dataset.grade, button.dataset.route));
    });
    if (window.EikenAppRouter) window.EikenAppRouter.refreshNav();
  }

  async function mount() {
    homePanel.className = "gradeEntryHome";
    sessionPanel.className = "hide";
    homePanel.innerHTML = `<div class="card"><p class="loading">級の設定を読み込んでいます…</p></div>`;
    try {
      await Promise.all([ensureLoaded(), ensureIdentity()]);
      renderHome();
    } catch (error) {
      homePanel.innerHTML = `<div class="card"><h2>級の設定を読み込めませんでした</h2><p>HTTPサーバー経由で起動しているか確認してください。</p><p class="hint">${escapeHtml(error.message)}</p></div>`;
      console.error(error);
    }
  }

  function handleKey() { /* 入口はキーボードショートカットなし */ }

  return { mount, handleKey, ensureLoaded, getProfile, setGrade, applyProfile };
})();

window.EikenGradeEntryApp = EikenGradeEntryApp;
