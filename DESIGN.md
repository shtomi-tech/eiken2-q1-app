# DESIGN.md — eiken-practice

> このアプリのUIデザイン正本。エージェントは `dev/CLAUDE.md` の共通指針ではなく**このファイルに準拠**すること。
> ベース: [VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md) の Claude DESIGN.md（Anthropic公式サイト風の暖色エディトリアルデザイン）を本アプリ（英検2級・準2級の語彙・長文・リスニング演習、Windows/モバイル環境）向けに適応。

## デザインの核

暖色クリームの紙面に、セリフ見出し・モノスペースラベル・単一の焦茶アクセント（Clay）を組み合わせたエディトリアルな学習アプリの言語。罫線で区切る活版印刷調から、背景色の階調（canvas／card／soft／strong の4段）と角丸カードで深度を表す構成に転換。影はほぼ使わない。正誤・状態は色だけに頼らず、文言・記号・アイコンを必ず併記する（既存の学習UI設計を継続）。

## カラーパレット

### アクセント（インタラクティブ）
- **Clay** `#a9583e` — 復習・最終チェック等の「要注意・行動喚起」アクション、おすすめ導線の見出し文字、要復習カードの左太罫。Claude原典のcoral `#cc785c` はクリーム地でコントラスト比が約3.1:1しかなくAA未達のため、`primary-active` 相当の値を採用（実測 約4.8:1）
- **Clay Hover** `#8a4732` — Clay要素の押下色
- 第2のアクセント色を追加しない。通常の学習フロー（開始・意味チェック等）は Ink（下記）を主色として使う

### サーフェス
- **Canvas** `#faf9f5` — ページ地色
- **Card** `#efe9de` — カード面（`.card` 等、canvasより一段深いクリーム）
- **Surface Soft** `#f5f0e8` — ホバー時の淡い着色
- **Surface Strong** `#e8e0d2` — 選択状態の着色
- **Dark Tile** `#141413`（Ink と同値）— ヒーロー・完了バナー等の反転タイル。Claude原典の `surface-dark #181715` とはRGB差が数単位で視覚的に無差別なため、別トークンを起こさず Ink に統合

### テキスト
- **Ink** `#141413` — 見出し・本文・主要ボタン背景（開始・意味チェック等の標準フロー）
- **Muted** `#615c54` — 補助テキスト・キャプション・モノスペースラベル。Claude原典の `muted #6c6a64` は本アプリのCard地(`#efe9de`)上で実測4.48:1とAA基準4.5:1をわずかに下回るため、5.5:1前後を確保できる値に微調整
- **On Dark** `var(--parchment)` / 補助は `rgba(250,249,246,.72)` 前後

### ボーダー
- **Hairline** `#e6dfd8` — カード・入力欄・選択肢の枠線（罫線は最小限、太い区切りは章単位の見出し前のみ2pxで残す）

### 機能色（正誤フィードバック用）
- **OK** `#16803a`（正解）／ **NG** `#b42318`（不正解）／ **Warn** `#a16207`（部分一致）
- Claude原典の `success #5db872`（対クリーム地コントラスト約2.3:1）・`warning #d4a017`（約2.3:1）・`error #c64545`（約4.6:1）はいずれもAA未達または現状値より弱いため採用せず、実測でAAを満たす値を維持する（AGENTS.md「理論とアクセシビリティが衝突する場合はアクセシビリティを優先」）

## タイポグラフィ

- 見出し（display）: `"Cormorant Garamond", Georgia, "Hiragino Mincho ProN", "Yu Mincho", serif`。Claude原典のCopernicus（非公開ライセンス書体）代替としてGoogle Fontsから読み込む。ウェイト500〜600、字間は詰めない（日本語混植のため原典のnegative trackingは採用しない）
- 本文: `"Inter", "Segoe UI", "Hiragino Kaku Gothic ProN", "Meiryo", sans-serif`。StyreneB代替。ラテン文字はInter、CJK文字は既存システムフォントに自動フォールバック
- ラベル・カウンタ: `"JetBrains Mono", "SFMono-Regular", Consolas, monospace`。大文字化＋字間拡大（既存踏襲）
- フォント読み込みは `display=swap` 必須。取得中・失敗時も日本語システムフォントでレイアウトが崩れない

## 角丸スケール

- `pill` 9999px — バッジ・チップ・丸番号バッジ（`.key`）
- `lg` 12px — カード全般（`.card` `.flash` `.passageCard` `.textPanel` 等）
- `md` 8px — ボタン・入力欄・タブ・グリッドタイル
- `sm` 6px — リスニングの問題一覧タイルなど小型要素
- 全面ブリードのタイル（`.hero` `.doneBanner` `.completionCard` の内部要素）は文脈に応じてlg

## 影・深度

- **影はほぼ使わない**。深度は (1) サーフェス色の切替（canvas ⇔ card ⇔ soft/strong ⇔ dark tile）(2) hairline ボーダー（入力欄・選択肢・小区切りのみ）で表現
- 例外: フローティングパネル（`.dictSettingsBody` 等、背景から浮くポップオーバー）のみ軽いdrop-shadowを許容
- 罫線結合グリッド（親にborder-top/left、子にborder-right/bottomを持たせて格子を作る手法）は廃止。`gap` + 個々のセルへの背景色・角丸に置き換える

## スペーシング

既存のグリッド不使用（4/8/12/16/24/32px前後の実測値を踏襲）。新規・変更箇所は 4/8/12/16/24/32 のスケールに寄せる。ボタン・選択肢の gap は 12px に統一。

## コンポーネント規範

- **主ボタン（既定button）**: Ink地＋Parchment文字、角丸md、min-height 44px。通常の学習フロー（開始・意味チェック・次へ等）に使用
- **要注意アクション（`.reviewCta` `.finalCta`）**: Clay地。復習・最終チェックなど「間違いに向き合う」文脈で使用し、通常フローと視覚的に区別する
- **副ボタン（`.ghost`）**: 透明地＋Ink文字＋hairline枠、角丸md。ホバーでInk地に反転
- **二次アクション（`.secondaryCta`）**: 透明地＋hairline枠、角丸md。reviewCta/finalCta系統は枠・文字をClayに
- **カード（`.card` 等）**: Card地・角丸lg・枠なし・影なし
- **強調タイル（`.hero` `.doneBanner` `.completionCard`）**: Ink地＋Parchment文字の反転表示、角丸lg。「学習フローの始まり」と「締めくくり」を示す
- **選択肢（`.choiceBtn` `.dictChoice`）**: Paper地＋Ink文字＋hairline枠、角丸md。ホバー/選択でInk反転。正解＝OK色の2px枠、不正解＝NG色の2px枠（coral化しない。主要CTAとの混同を避けるため中立表現を維持）
- **番号バッジ（`.key`）**: 24×24pxの円形（角丸pill）、currentColor枠
- **タブ／グリッドタイル（`.appTab` `.qCard` `.dictQuestionList .qBtn`）**: 罫線結合ではなくgapベースのグリッド。各セルはPaper/Parchment地＋角丸md/sm
- **バッジ・チップ（`.tag` `.dictBadge` `.chip`）**: 角丸pill、hairline枠
- **フィードバックカード（`.feedback` `.resultBox`）**: 左4px太罫（Ink既定、OK/NGで色変化）＋Paper地、角丸md、外枠なし
- **入力欄（select/input）**: Paper地＋hairline枠、角丸md、min-height 44px

## Do / Don't

✓ CSS変数名は旧デザインとの互換のため維持し、値だけ差し替える（JSがvar参照するため）／ 正誤・状態は色だけでなく文言・記号を併記する／ 44px以上のタップターゲットを死守する（Claude原典のheight:40pxより優先）／ WCAG 2.2 AA を満たす／ 罫線は入力欄・選択肢・章区切りなど機能的な意味がある箇所にのみ残す

✗ `--ok`/`--ng`/`--warn` にClaude原典の生トークンを使わない（実測でAAコントラスト未達）／ 選択肢ボタン（`.choiceBtn`等）の背景をClay/coralにしない（主要CTAとの意味的な混同を避ける）／ 罫線結合グリッド（border-top+left / border-right+bottomの組み合わせ）を新規に作らない／ 装飾のためだけの影を追加しない
