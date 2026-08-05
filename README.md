# 英検 大問1 単語アプリ

英検1級・2級・準2級・準1級の大問1（語彙）だけを扱う静的Webアプリです。各級3回分、合計12セットを収録しています。

## 学習の流れ

1. 選択肢の意味・補足情報を確認する
2. 意味チェックを行う
3. 本番形式の4択問題を解く
4. 間違えた語句を復習する
5. 全語句の最終チェックで80%以上を目指す

問題セット・問題別進捗・途中位置はブラウザのローカルストレージに保存されます。

## 対象データ

- 2級: `data/questions_*.json` / `data/vocab_*.json`
- 準2級: `data/questions_p2_*.json` / `data/vocab_p2_*.json`
- 準1級: `data/questions_pre1_*.json` / `data/vocab_pre1_*.json`
- 1級: `data/questions_1_*.json` / `data/vocab_1_*.json`
- 問題セット一覧: `data/manifest.json` の `q1`

準1級のQ1データは、全体過去問データから次で抽出します。

```powershell
py -3 scripts/build_q1_pre1_data.py
py -3 scripts/build_q1_1_data.py
py -3 scripts/check_q1_data.py
```

## 起動

```powershell
cd C:\Users\shtom\dev\eiken-practice
py -3 -m http.server 8061 --bind 127.0.0.1
```

ブラウザで `http://127.0.0.1:8061/` を開きます。JSONを相対パスで読むため、`index.html` を直接開かないでください。

## 公開版・生徒別進捗

公開版は [GitHub Pages](https://shtomi-tech.github.io/eiken2-q1-app/) です。

生徒別URLの `?s=<id>&t=<token>` と公開設定がそろう場合は、共通Supabaseスキーマの `app_students` / `app_progress` に進捗を同期します。匿名利用では従来どおりローカル保存だけで動作します。

Q1のクラウドアプリIDは `eiken2-q1` です。旧準1級アプリの `eiken-pre1` 進捗は、初回起動時にQ1形式へ読み取り移行します。旧キーは移行確認のため残します。

## 保存キー

- `eiken_q1_dataset`
- `eiken_q1_progress_<datasetId>`
- `eiken_q1_examples_<datasetId>`
- 旧Q1互換: `eiken2_q1_v1`

## 構成

- `static/mode-q1.js`: 全級共通の大問1ロジック
- `static/app.js`: Q1アプリの起動だけを担当する薄いシェル
- `static/vendor/harness/cloud.js`: 生徒別クラウド同期の生成物。直接編集しない
- `scripts/build_q1_pre1_data.py`: 準1級Q1データの抽出
- `scripts/build_q1_1_data.py`: 1級公式PDFから大問1を抽出
- `scripts/check_q1_data.py`: 12セットのデータ契約チェック

大問2以降の旧統合コードは移管用にリポジトリ内へ残っていますが、現在のQ1アプリでは読み込まず、Pages公開物にも含めません。
