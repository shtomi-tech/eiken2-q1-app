# 英検2級 演習（大問1・大問3）

英検2級のリーディング大問1（語彙）と大問3（長文読解）を1つの静的Webアプリにまとめたものです。

- **大問1（語彙）**タブ：英検2級・準2級の各回を切り替え、選択肢の意味・語源・例文を確認 → 意味チェック → 本番形式の4択、の3ステップで演習。誤答復習・最終チェックあり。
- **大問3（長文）**タブ：4択解答 → 根拠だと思う文を本文からタップ選択 → 判定（選択肢正誤＋根拠一致度）。内容整理（要約穴埋め）と誤答・根拠不一致の復習モードあり。

各モードは `static/mode-q1.js` / `static/mode-q3.js` に IIFE で分離されており、`static/app.js` が上部タブでどちらを表示するかだけを切り替えます（kobun-vocab と同じ方式）。進捗の保存キー（localStorage）・クラウド同期のappId（`eiken2-q1` / `eiken2-q3`）は従来どおり別々のため、統合前の進捗もそのまま引き継がれます。

## 学習の流れ（大問1）

1. 選択肢の意味・語源・例文を確認する
2. 意味チェックを行う
3. 本番形式の4択問題を解く

通常の進捗はブラウザのローカルストレージに保存されます。

## 起動

```powershell
cd C:\Users\shtom\dev\eiken2-q1
py -3 -m http.server 8061 --bind 127.0.0.1
```

ブラウザで `http://127.0.0.1:8061/` を開きます。データJSONは相対パスで読み込むため、`index.html` を直接開かずHTTPサーバー経由で確認してください。

## 公開版・生徒別進捗

公開版は [GitHub Pages](https://shtomi-tech.github.io/eiken2-q1-app/) です。

生徒別URLの `?s=<id>&t=<token>` が付く場合は、公開設定が有効なら共通Supabaseスキーマの `app_students` / `app_progress` へ進捗を同期します（大問1・大問3ともappIdが異なる行として保存されます）。設定がない通常利用では、従来どおりローカル保存だけで動作します。生徒の登録SQLとQR発行は `portal` が担当します。

## データと共通エンジン

- 大問1のデータ: `data/questions_*.json` と `data/vocab_*.json`
- 大問3のデータ: `data/q3_questions_2026-1.json`
- 画面・アプリ固有ロジック: `static/mode-q1.js`（大問1）・`static/mode-q3.js`（大問3）・`static/app.js`（タブ切替の薄いシェル）
- 共通クラウド同期層: `static/vendor/harness/`

`static/vendor/harness/` は `C:\Users\shtom\dev\harness` から配布される生成物です。直接編集せず、更新後は次で確認します。

```powershell
cd C:\Users\shtom\dev\harness
node scripts/sync.mjs --check
```

`static/config.json` には公開時の接続設定が入るためgit管理しません。ローカル確認用には `static/config.example.json` を参照してください。

## 由来

このリポジトリは、もともと大問1（語彙）のみだった `eiken2-q1` に `eiken2-q3`（大問3・長文読解）を統合したものです。公開URLとQRコード配布・Supabase生徒別クラウド同期を維持するため、器はこちら（eiken2-q1）側を採用しています（`kobun-vocab` が `kobun-katsuyo` を吸収したのと同じ方式）。旧 `eiken2-q3-app`（GitHub Pages）は本アプリへの転送ページに差し替え、リポジトリはアーカイブします。
