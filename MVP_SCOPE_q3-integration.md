# MVP_SCOPE — 英検アプリ統合（eiken2-q3 を eiken2-q1 に吸収・kobun-vocab 方式）

作成日: 2026-07-10 / 対象リポ: `C:\Users\shtom\dev\eiken-practice`（公開: `shtomi-tech/eiken2-q1-app` → GitHub Pages）

## 目的

大問1（語彙）アプリと大問3（長文読解）アプリを、**kobun-vocab（古文演習）と同じ方式**で1つの静的アプリに統合する。
古文演習は `kobun-katsuyo` を `kobun-vocab` に吸収した前例で、方式は以下のとおり:

- **器 = QR配布済み・クラウド同期を持つ既存公開リポ側**を採用（公開URL・QR・Supabase同期を維持）。
- 各モードは `static/mode-*.js` に **IIFE で閉じ**、`return { mount, handleKey }` だけを公開。
- `static/app.js` は**薄いシェル（〜50行）**: 1段タブの切替、タイトル差し替え、表示中モードへのキー入力の橋渡しのみ。
- index.html は共通の `#homePanel` / `#sessionPanel` を全モードで共用。
- **localStorage キーは統合前のまま**維持 → 匿名ローカル利用者の進捗も引き継がれる。
- クラウド同期は各モードが自分の `APP_ID` で `createCloud` を持つ（kobun でも mode-vocab / mode-katsuyo がそれぞれ呼んでいる）→ **DB移行・追加SQL不要**。
- README に「由来」節を書き、統合経緯と器の採用理由を残す。

## 確定した方針

- **器 = eiken2-q1**（`eiken2-q1-app`）。QR配布済み（`eiken2-q1-app-qr.png`）・クラウド同期実績があるのはこちら側のため、kobun の採用基準と同じ。
- eiken2-q3 のコードは `static/mode-q3.js` として移植。eiken2-q1 の現行 app.js は `static/mode-q1.js` に IIFE 化して退避し、app.js を薄いシェルに置き換える。
- タブは2つ: **「大問1（語彙）」「大問3（長文）」**（kobun の4タブ相当。大問1内部のデータセット選択＝級・回の切替は、現行どおりモード内に残す）。
- クラウドの appId は **"eiken2-q1" / "eiken2-q3" のまま変えない**。`?s=<id>&t=<token>` を両モードで共有し、cloud.js の2インスタンスがそれぞれ auth→load→save する（cloud.js は両リポで同一ファイルであることを確認済み）。
- localStorage キー: `eiken_q1_progress_*` / `eiken_q1_dataset` / `eiken2q3.progress.v1` を**すべて現行のまま**使う。GitHub Pages は同一オリジンなので、旧 q3 URL で貯めた匿名進捗も統合後アプリで読める。
- デザインは claude デザインスキル準拠（両アプリとも準拠済み）。タブUIは kobun-vocab の `appNav` / `appTab`（mono大文字タグ＋ラベル、`aria-pressed`）をそのまま流用。

## 実装スコープ

### A. モード分離（エージェント実装）

1. `static/mode-q1.js`: 現行 `eiken2-q1/static/app.js`（926行）を `const EikenQ1App = (function(){ ... return { mount, handleKey }; })();` に包む。`boot()` は初回 `mount()` 時のみ実行（kobun の `booted` フラグ方式）。ヒーローカード（Vocabulary First）は q1 モードの homePanel 内へ移動。
2. `static/mode-q3.js`: `eiken2-q3/static/app.js`（643行）を同様に IIFE 化。`passagePanel` → 共通 `#sessionPanel` に、`headerBackBtn` はモード内描画に付け替え。`heroCard`・`resetBtn` の扱いも q1 と揃える。
3. `static/app.js`: kobun-vocab の app.js（50行）を雛形に、APPS 配列を2エントリで書き換え。
4. index.html: kobun 型に更新（`#appNav` 追加、タイトルを「英検 演習」等の総称に、script タグに mode-q1.js / mode-q3.js を追加、キャッシュバスターの版上げ）。
5. styles.css: q3 の styles.css（280行）のうち q3 固有分（本文パネル・根拠ハイライト・語群チップ等）をマージ。kobun の `appNav` / `appTab` スタイルを移植。クラス名衝突は q3 側にプレフィックスを付けて回避。

### B. データ移設

- `eiken2-q3/data/questions_2026-1.json` → `eiken2-q1/data/q3_questions_2026-1.json`（mode-q3.js の DATA_URL を更新）。既存 q1 データはパス変更しない。

### C. 公開まわり

- `eiken2-q3-app`（デプロイ済み）: index.html を「新URLへ `?s=&t=` を引き継いで転送する」1枚に差し替え → その後リポをアーカイブ（kobun-katsuyo と同じ末路）。
- ポータル `apps.json`: eiken2-q3 のエントリを削除または eiken2-q1 へのリンクに統合。
- README: 「由来」節を追記（kobun-vocab README の体裁に合わせる）。

## 非スコープ

- 進捗データの appId 統合（"eiken2-q1"/"eiken2-q3" の2行のまま。Supabase 側の変更ゼロ）。
- 大問2ほか新モードの追加（タブ方式なので将来 `mode-q2.js` を足すだけで拡張可能、今回はやらない）。
- 先生用進捗閲覧UI、通し演習・タイマー（従来どおり非スコープ）。
- ローカル `dev\eiken2-q3` リポの削除（アーカイブ判断はユーザー）。

## 検証（完了条件）

- config.json 無しで匿名ローカル動作すること（両タブ）。
- タブ切替で q1⇄q3 が行き来でき、各モードの状態が壊れないこと（kobun 同様、切替時は各モードの home に戻る挙動でよい）。
- 統合前の localStorage 進捗（q1 の4データセット分・q3 分）がそのまま表示されること。
- `?s=&t=` 付きURLで、q1・q3 それぞれの `app_progress` 行に auth→load→save が通ること。別端末で復元されること。
- q3 の全機能（4択・根拠判定3段階・要約穴埋め・復習モード）が統合後も MVP_SCOPE（eiken2-q3）の完了条件を満たすこと。
- 旧 q3 URL からの転送で `?s=&t=` が失われないこと。

## 段取り

1. エージェント: A（モード分離）＋ B（データ移設）→ ローカルサーバーで検証。
2. エージェント: ポータル `apps.json` 更新、README 追記。
3. ユーザー: push 承認 → `eiken2-q1-app` デプロイ → 実機検証。
4. ユーザー承認のうえ: `eiken2-q3-app` に転送ページを push → リポをアーカイブ。
