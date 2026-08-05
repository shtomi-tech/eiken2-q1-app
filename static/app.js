"use strict";

// 大問1専用アプリ。各大問を束ねるルーターは別アプリへ移管する。
window.EikenActiveAppId = "q1";
window.EikenLearningPath = "q1";

document.addEventListener("keydown", (event) => EikenQ1App.handleKey(event));
EikenQ1App.mount();
