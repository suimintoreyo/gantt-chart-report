# 開発者用チェックリスト（自分用メモ）

## 0. リポジトリ準備

- [ ] GitHub で `gantt-progress-app`（仮）リポジトリを作成
- [ ] WSL2 の開発用ディレクトリに clone する  
      例: `~/dev/github.com/自分のアカウント/gantt-progress-app`

---

## 1. Next.js プロジェクト作成

- [ ] `npx create-next-app@latest` でプロジェクト生成

  ```bash
  npx create-next-app@latest gantt-progress-app     --typescript     --tailwind     --eslint     --app     --src-dir
  ```

- [ ] 生成されたフォルダに移動し、`npm run dev` で初期画面が表示されることを確認
- [ ] 初回コミット（`feat: init next app`）

---

## 2. Supabase プロジェクト & DB セットアップ

- [ ] Supabase で新規プロジェクト作成
- [ ] Project URL / anon key / DB パスワードをメモ
- [ ] ローカルの `.env.local` に以下を設定

  ```env
  NEXT_PUBLIC_SUPABASE_URL=...
  NEXT_PUBLIC_SUPABASE_ANON_KEY=...
  DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@.../postgres
  ```

- [ ] Supabase の SQL Editor で `requirements.md` のテーブル定義をコピペして実行
  - `projects`
  - `tasks`
  - `daily_snapshots`
  - `daily_task_progress`
  - （必要なら `profiles`）
- [ ] 最初は RLS OFF でも可（後でONにするタイミングを検討）

---

## 3. プロジェクトに要件定義と AGENTS.md を追加

- [ ] `requirements.md` をレポジトリ直下に保存
- [ ] `AGENTS.md` をレポジトリ直下に作成（このテンプレ or 調整版）
- [ ] コミット（`docs: add requirements and AGENTS`）

---

## 4. UI 基盤ライブラリのインストール

- [ ] 依存ライブラリのインストール

  ```bash
  npm install next-themes @supabase/supabase-js
  npm install react-hook-form zod @hookform/resolvers
  npm install date-fns
  npm install gantt-task-react
  ```

- [ ] shadcn/ui の初期化（CLI）

  ```bash
  npx shadcn-ui@latest init
  ```

- [ ] 代表的な UI コンポーネントを導入

  ```bash
  npx shadcn-ui@latest add button input textarea dialog table tabs select label
  ```

- [ ] コミット（`chore: install ui and utility libs`）

---

## 5. Codex に頼むタスク（順番）

ここからは Codex を使って実装する。

### 5-1. テーマ & レイアウト

- [ ] Codex に以下を依頼：
  - `ThemeProvider` コンポーネントの実装（next-themes 使用）
  - `src/app/layout.tsx` に ThemeProvider を組み込む
  - 簡単な `ThemeToggle` ボタンを作成してヘッダ等に置く
- [ ] ダーク / ライトが切り替わることをブラウザで確認
- [ ] コミット（`feat: add theme provider and layout`）

### 5-2. Supabase クライアント & 認証画面

- [ ] `src/lib/supabase-client.ts` を Codex に書かせる
- [ ] `/login` ページを Codex に作ってもらう
  - メール + パスワードでログイン
  - 成功時 `/` に遷移
- [ ] 簡易的に Supabase 上でユーザーを 1 件作成してログイン確認
- [ ] コミット（`feat: add login page with supabase auth`）

### 5-3. プロジェクト一覧 / 作成ページ

- [ ] `/projects` ページを Codex で実装
  - Supabase から `projects` を取得して一覧表示
  - モーダルフォームで新規作成
- [ ] 必要に応じて `/`（ダッシュボード）から `/projects` へリンクを貼る
- [ ] コミット（`feat: projects list and create`）

### 5-4. タスク一覧ページ

- [ ] `/projects/[id]/tasks` ページを Codex に依頼
  - `project_id` で `tasks` を取得
  - テーブル表示
  - モーダルで新規追加・編集
  - 進捗やステータスはインライン編集可能にする
- [ ] コミット（`feat: tasks list and crud`）

### 5-5. ガントチャートページ

- [ ] Codex に `gantt-task-react` を使ったコンポーネントを作らせる
  - `tasks` の `planned_start_date` / `planned_end_date` / `progress` から Gantt 用データを生成
  - `/projects/[id]/gantt` で表示
- [ ] コミット（`feat: gantt view for project`）

### 5-6. スナップショット & レポート

- [ ] `requirements.md` の「スナップショット」と「進捗差分テキスト生成」の仕様を元に、
  Codex に以下を依頼：
  - 「今日のスナップショットを作成」処理（API Route or Server Action）
  - `/projects/[id]/snapshots` ページ
  - 指定日について、前日スナップとの比較で差分テキストを生成するロジック
- [ ] 実データで何度かテスト
- [ ] コミット（`feat: snapshots and diff report`）

---

## 6. 最後に

- [ ] 簡単な README を書く（起動方法、環境変数など）
- [ ] ある程度安定してきたら Vercel にデプロイ
- [ ] 実際に日次で使ってみて、気付いた点を `issues` にメモする
