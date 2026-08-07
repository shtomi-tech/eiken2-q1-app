# 英検 大問1 単語アプリ

英検1級・2級・準2級・準1級の大問1（語彙）だけを扱う静的Webアプリです。各級3回分、合計12セットを収録しています。

## 学習の流れ

1. 選択肢の意味・補足情報を確認する
2. 意味チェックを行う
3. 本番形式の4択問題を解く
4. 間違えた語句を復習する
5. 全語句の最終チェックで80%以上を目指す

問題セット・問題別進捗・途中位置はブラウザのローカルストレージに保存されます。

### 意味練習（全級共通）

各級とも、その級3回分の語句をまとめた「意味だけ練習」を中心学習として使えます。通常学習で最後まで解いた設問の語句だけが対象になり、未学習の語句は出題されません。1回の出題は最大30語句で、正解した語句は1日・3日・7日・14日の間隔で復習へ回ります。対象語句は通常学習の進行に合わせて、その級の全語句まで増えます。

| 級 | 設問数（3回合計） | 対象語句の上限 |
| --- | --- | --- |
| 2級 | 51 | 204 |
| 準2級 | 45 | 180 |
| 準1級 | 54 | 216 |
| 1級 | 66 | 264 |

語句ごとの復習間隔は、その語句が属する回の進捗（`eiken_q1_progress_<datasetId>` の `items`）に保存します。級をまたいで混ざることはありません。

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
py -3 scripts/enrich_flashcard_fields.py
py -3 scripts/curate_1_examples.py
py -3 scripts/check_q1_data.py
```

## 起動

```powershell
cd C:\Users\shtom\dev\eiken-practice
py -3 -m http.server 8061 --bind 127.0.0.1
```

ブラウザで `http://127.0.0.1:8061/` を開きます。JSONを相対パスで読むため、`index.html` を直接開かないでください。

## 英検1級・2級・準1級・準2級の単語・熟語音声

Azure Speechのキーを保存せず、環境変数から読み込んで単語・熟語MP3を生成します。

```powershell
$env:AZURE_SPEECH_KEY = "AzureポータルのKEY 1"
$env:AZURE_SPEECH_REGION = "japaneast"
py -3 scripts/generate_tts_1.py --grade 1 --round all
py -3 scripts/generate_tts_1.py --grade 2 --round all
py -3 scripts/generate_tts_1.py --grade pre1 --round all
py -3 scripts/generate_tts_1.py --grade pre2 --round all
```

生成先は単語が `assets/audio/vocab/<級>/<回>/`、熟語が `assets/audio/vocab/<級>/<回>/idiom/` です。生成済みの単語・熟語は大問1の暗記カードと意味チェックで「音声」ボタンから再生できます。
準1級はMP3がない場合も、暗記カードの「音声」ボタンからブラウザ標準の英語音声を再生します。

## 暗記カードの共通構成

全級で、見出し語・発音記号・品詞・意味・語源（収録されている場合）・例文・例文の日本語訳を同じ順序で表示します。
1級の例文は公式の設問文を流用せず、語句ごとに作成したオリジナル英文と日本語訳を表示します。

## 暗記カードの例文訳

1級・2級・準2級・準1級の例文には `exampleTranslation` として日本語訳を収録しています。訳のない例文を補う
場合は、次のスクリプトを実行します。取得した機械翻訳は、教材として使う前に必要に応じて確認してください。

```powershell
py -3 scripts/add_example_translations.py --dry-run
py -3 scripts/add_example_translations.py
```

暗記カードでは、例文の下に日本語訳を表示し、従来の「使い方・コロケーション」欄は表示しません。

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
- `scripts/enrich_flashcard_fields.py`: 1級・準1級の発音・品詞の補完
- `scripts/curate_1_examples.py`: 1級のオリジナル例文・日本語訳の適用
- `scripts/check_q1_data.py`: 12セットのデータ契約チェック

大問2以降の旧統合コードは移管用にリポジトリ内へ残っていますが、現在のQ1アプリでは読み込まず、Pages公開物にも含めません。
