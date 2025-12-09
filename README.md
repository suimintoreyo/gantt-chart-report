# ガントチャート進捗報告アプリ

`requirements.md` をベースにした Next.js + Supabase 構成の進捗管理アプリ（MVP 要件）。ガントチャートでタスクを可視化し、日次スナップショットと差分レポートを生成することを目的とします。

## 現行MVPで目指すこと
- 認証: Supabase Auth によるメール+パスワードログイン（未ログイン時は `/login` へリダイレクト）。
- プロジェクト: 一覧/作成/編集/削除（`owner_id` でユーザーに紐付け）。
- タスク: プロジェクト単位での一覧・追加・編集・削除。進捗率/ステータスのインライン編集。
- ガントチャートビュー: `@svar-ui/react-gantt` で表示（日/週/月ビュー、ステータス色分け、Today line）。`gantt-task-react` は React 19 非対応のため代替採用。MVPでは表示主体（ドラッグ編集は後続フェーズで検討）。
- スナップショット & 差分レポート: 日次スナップショットを保存し、前日との差分から進捗レポートテキストを生成・コピー。
- テーマ切替: `light / dark / system` の3種切替。

## 主要画面（URLは暫定）
- `/login`: メール+パスワードでログイン。
- `/`: ダッシュボード。自分のプロジェクト一覧とテーマ切替。
- `/projects`: プロジェクト一覧と新規作成。
- `/projects/[id]`: プロジェクト概要。タブでガント/タスク/スナップショットに切替。
  - `/projects/[id]/gantt`: ガントチャート表示（表示優先）。
  - `/projects/[id]/tasks`: タスクテーブル（CRUD、進捗・ステータスの即時編集）。
  - `/projects/[id]/snapshots`: 日次スナップショット一覧と差分レポート生成。

## 技術スタック
- 言語/フレームワーク: TypeScript, Next.js 14+ (App Router), React
- ホスティング/バックエンド: Vercel, Supabase (PostgreSQL + Auth)
- UI: Tailwind CSS, shadcn/ui, next-themes
- フォーム/バリデーション: react-hook-form, Zod
- 日付: date-fns
- ガント: @svar-ui/react-gantt

## データモデル（概要）
- `profiles`: Supabase Auth に紐づくユーザー情報（display_name, theme_preference 等）。
- `projects`: `owner_id`, `name`, `description`, `start_date`, `end_date` など。
- `tasks`: プロジェクト内のタスク。`planned_start_date/end_date`, `progress`, `status`, `assignee_name` など。
- `daily_snapshots`: 1プロジェクト×1日1件のスナップショット。
- `daily_task_progress`: スナップショット時点のタスク進捗/ステータス。

## 非機能メモ
- Hobbyプラン（Vercel/Supabase）内で運用できる規模を想定。
- タスク数数百件でもガント/一覧が実用的な表示速度を目標。
- Row Level Security は段階的導入を検討。

## セットアップの方向性（開発時）
- Supabase プロジェクトを用意し、上記テーブルを作成（`ON DELETE CASCADE` で子テーブルを連鎖削除）。
- Next.js (App Router) プロジェクトを作成し、`.env` に Supabase の URL / anon key を設定。
- 依存インストール例: `npm install next react react-dom tailwindcss supabase-js @supabase/auth-helpers-nextjs date-fns react-hook-form zod @svar-ui/react-gantt class-variance-authority lucide-react next-themes`
- ローカル開発: `npm run dev`
- テスト（必要に応じて）: `npm test` または `npm run lint`

## ドキュメント
- 詳細要件・画面/データ仕様: `requirements.md`
- 運用ガイドライン: `AGENTS.md`
