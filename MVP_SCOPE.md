# MVP_SCOPE — 英検2級大問1 生徒別クラウド同期（パイロット）

作成日: 2026-07-06 / 対象リポ: `C:\Users\shtom\dev\eiken2-q1`（公開: `shtomi-tech/eiken2-q1-app` → GitHub Pages）

## 目的

英検2級大問1アプリを、ポラリスと同じ「生徒別クラウド同期」方式にする。生徒が配布された
`?s=<id>&t=<token>` のQR/URLを自分の端末で開くと、その生徒の進捗が Supabase に保存され、
端末をまたいで継続でき、先生は Supabase ダッシュボードで確認できる。

## 確定した方針（grill-me 合意）

- 進捗の扱い: **Supabase同期（ポラリス方式）**。
- 先生の閲覧: **Supabaseダッシュボードで見る**（専用の閲覧UIは作らない）。
- DB: **共通スキーマ（全アプリ共用の生徒テーブル `app_students`）** ＋ アプリ別進捗 `app_progress(app, student_id, ...)`。生徒登録1回で全アプリ有効。
- ポラリスの既存進捗データは**引き継がない**（よりよい統一形を優先。ポラリスは後日同スキーマへ載せ替え、旧テーブルは破棄）。
- URL規約は全アプリ共通の `?s=<id>&t=<token>`（ポータルの統一名簿・トークンと一致）。
- 生徒別URL・QRの発行と印刷は**ポータル**が担当（既存機能）。このアプリは受け取って同期するだけ。

## 前提・ブロッカー（着手前に解決）

1. **ローカルリポの履歴ずれ**: `dev\eiken2-q1` はコード内容が本番 `eiken2-q1-app` と一致するが、git履歴が別物で remote 未設定だった（remote は今回 `origin` を追加済み・fetch済み）。本番へ push するには、ローカル main を `origin/main` に載せ替える必要がある（コード同一のため作業ロスなし）。※ `git checkout -B main origin/main` は自動判定でブロックされたため、**ユーザーが実行 or 許可**する。
2. **Supabase**: 共通スキーマSQL（下記）を **ユーザーが Supabase で実行**（エージェントはダッシュボード不可）。ポラリスと同じ Supabase プロジェクトを再利用する。
3. **GitHub Secrets**: `eiken2-q1-app` リポに `SUPABASE_URL` / `SUPABASE_ANON_KEY` を **ユーザーが設定**（エージェントは鍵を扱わない）。値はポラリスと同じプロジェクトのもの。

## 役割分担

- **エージェント（コード・SQL文面・手順）**: アプリのクラウド同期実装、`config.json` 注入の仕組みとデプロイ workflow 追記、ポータルの `apps.json` 追記、SQL文面と手順書の作成。
- **ユーザー（アクセス権が要る操作）**: ローカル履歴の載せ替え実行/許可、Supabase での SQL 実行、GitHub Secrets 設定、公開リポへの push 承認。

## 実装スコープ

### A. Supabase（ユーザーが実行するSQL・共通スキーマ）

```sql
create table if not exists public.app_students (
  id text primary key,
  display_name text not null,
  access_token text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create table if not exists public.app_progress (
  app text not null,
  student_id text not null references public.app_students(id) on delete cascade,
  progress jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (app, student_id)
);
alter table public.app_students enable row level security;
alter table public.app_progress enable row level security;

create or replace function public.app_auth_student(p_student_id text, p_access_token text)
returns table(id text, display_name text) language sql security definer set search_path = public as $$
  select s.id, s.display_name from public.app_students s
  where s.id = p_student_id and s.access_token = p_access_token and s.active = true limit 1;
$$;

create or replace function public.app_load_progress(p_app text, p_student_id text, p_access_token text)
returns jsonb language sql security definer set search_path = public as $$
  select coalesce(p.progress, '{}'::jsonb)
  from public.app_students s
  left join public.app_progress p on p.student_id = s.id and p.app = p_app
  where s.id = p_student_id and s.access_token = p_access_token and s.active = true limit 1;
$$;

create or replace function public.app_save_progress(p_app text, p_student_id text, p_access_token text, p_progress jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.app_students s
      where s.id = p_student_id and s.access_token = p_access_token and s.active = true) then
    raise exception 'invalid student token';
  end if;
  insert into public.app_progress (app, student_id, progress, updated_at)
  values (p_app, p_student_id, coalesce(p_progress, '{}'::jsonb), now())
  on conflict (app, student_id) do update set progress = excluded.progress, updated_at = now();
end;
$$;

grant execute on function public.app_auth_student(text, text) to anon;
grant execute on function public.app_load_progress(text, text, text) to anon;
grant execute on function public.app_save_progress(text, text, text, jsonb) to anon;
```

生徒登録SQL（ポータルが `app_students` へ発行する共通テンプレ）:

```sql
insert into public.app_students (id, display_name, access_token, active)
values ('{id}', '{name}', '{token}', true)
on conflict (id) do update set display_name = excluded.display_name,
  access_token = excluded.access_token, active = true;
```

### B. 英検2級アプリ（エージェント実装）

- `static/config.json` を実行時設定として読み込む（ポラリス同様 `runtimeConfig`）。`config.json` は gitignore し、デプロイ時に Secrets から生成。**設定が無ければ従来どおり匿名ローカル動作**（`hasCloudConfig()` ガードで既存利用に無影響）。
- `?s=&t=` を読み取り、`app_auth_student` → `app_load_progress`（app="eiken2-q1"）で進捗を復元。解答のたびに `app_save_progress` をデバウンス保存。共有モードUI（生徒名表示・リセット抑制）。
- 進捗の内部表現は既存の `progressKey(datasetId)` の localStorage を土台に、共有時はクラウドと同期。

### C. デプロイ（エージェントが workflow 追記・ユーザーが Secrets 設定）

- `pages.yml` に「config.json 生成」ステップを追加（`SUPABASE_URL` / `SUPABASE_ANON_KEY` / `APP_BASE_URL` を env で注入）。`scripts/write-config.mjs` をポラリスに倣って追加。
- `eiken2-q1-app` リポに Secrets を設定（ユーザー）。

### D. ポータル（エージェント実装・ローカルのみ）

- `apps.json` の eiken2-q1 に `perStudent: true` と `studentShare.registerSqlTemplate`（上記 `app_students` INSERT）を追加。
- これで印刷パネルの生徒モードが英検2級に生徒別URL/QRを出し、登録SQLを表示する。

## 非スコープ

- 先生用の進捗閲覧UI（Supabaseダッシュボードで代替）。
- ポラリスの共通スキーマ移行（別ステップ。旧データ破棄で載せ替え）。
- 帝京数学の対応（英検2級で方式確立後に横展開）。

## 検証

- config.json 無しで従来動作（匿名ローカル）が壊れないこと。
- `?s=&t=` で auth→load→save が通り、Supabase の `app_progress` に app="eiken2-q1" 行が入ること。
- 別端末で同じURLを開くと進捗が復元されること。
- 不正トークンで拒否されること。

## 段取り（推奨順）

1. ローカル main を origin/main に載せ替え（ユーザー実行/許可）。
2. エージェント: アプリのクラウド同期実装＋workflow＋write-config＋ポータル追記。
3. ユーザー: Supabase で A のSQL実行、`eiken2-q1-app` に Secrets 設定。
4. push（ユーザー承認）→ デプロイ → 生徒別URLで実機検証。
