# ガントチャート進捗・報告アプリ – 要件定義書

本ドキュメントは、ガントチャートベースの進捗管理・報告アプリの実装および拡張に関する要件を定義します。

---

## 0. 技術スタック・プロジェクト構成

* **フロントエンドのみ**：モダンなデスクトップブラウザ（最新のChrome/Edge）で動作
* **フロントエンドフレームワーク不使用**：**Vanilla JavaScript**、**HTML**、**CSS**のみを使用
* `index.html`をブラウザで開くだけでアプリが動作すること
* データ永続化には**localStorage**を使用
* **ランタイムでのnpm/ビルドツール不使用**：すべてのCSS/JSライブラリはオフライン使用のためローカルに保存

### 0.1 採用ライブラリ

| ライブラリ | 用途 | 配置先 |
|-----------|------|--------|
| Bulma (v0.9.x+) | CSSフレームワーク | `css/bulma.min.css` |
| bulma-prefers-dark | 常時ダークモード | `css/bulma-prefers-dark.min.css` |
| Frappe Gantt | ガントチャート | `js/frappe-gantt.min.js`, `css/frappe-gantt.min.css` |

### 0.2 ファイル構成

```
project/
├── index.html
├── css/
│   ├── bulma.min.css
│   ├── bulma-prefers-dark.min.css
│   ├── frappe-gantt.min.css
│   └── app.css        # カスタムCSS（ダーク対応・最小限の上書きのみ）
└── js/
    ├── frappe-gantt.min.js
    ├── state.js        # 状態管理・永続化
    ├── dateHelpers.js  # 日付ヘルパー関数
    ├── gantt.js        # ガントチャート操作
    ├── report.js       # 進捗報告生成
    └── main.js         # メインアプリケーション
```

### 0.3 スタイリング方針

* カスタムCSSは最小限に留める（ダークテーマ対応・ガント配色・レイアウト補助のみ）
* BulmaとFrappe Ganttのデフォルトスタイルを尊重し、再定義やリセットを避ける

---

## 1. アプリ概要

### 1.1 目的

本アプリは以下をサポートする**ガントチャートベースの進捗管理ツール**です：

* ガントチャートによるプロジェクトとタスクの視覚的スケジュール管理
* マウスによる直接操作（ドラッグ＆ドロップ、リサイズ）
* キーボードショートカット対応
* 以下の追跡：
  * プロジェクトタスク
  * 作業ログ
  * 一時タスク（アドホック）
* **進捗報告文の自動生成**

### 1.2 実行環境

* デスクトップブラウザ、サーバー不要
* オフライン動作：すべてのデータは**localStorage**に保存

---

## 2. データモデル

```ts
type ProjectStatus = 'planned' | 'active' | 'completed' | 'on_hold';

interface Project {
  id: string;          // UUID v4
  name: string;
  owner?: string;
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  status: ProjectStatus;
}

type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'on_hold';
type TaskPriority = 'high' | 'medium' | 'low';

interface Task {
  id: string;
  projectId: string | null;
  name: string;
  assignee?: string;
  dependsOn?: string[];
  plannedStart: string;   // YYYY-MM-DD
  plannedEnd: string;     // YYYY-MM-DD
  progress: number;       // 0-100
  status: TaskStatus;
  priority?: TaskPriority;
  notes?: string;
}

interface WorkLog {
  id: string;
  taskId: string;
  date: string;           // YYYY-MM-DD
  workNote: string;
  hours?: number;
  progressAfter?: number;
}

interface AdhocTask {
  id: string;
  date: string;           // YYYY-MM-DD
  title: string;
  detail?: string;
  hours?: number;
  relatedProjectId?: string;
}

interface UiPreferences {
  taskTableColumnWidths?: Record<string, number>;
  ganttZoomLevel?: 'Day' | 'Week' | 'Month';
  theme?: 'dark';
}

interface AppState {
  projects: Project[];
  tasks: Task[];
  workLogs: WorkLog[];
  adhocTasks: AdhocTask[];
  uiPreferences: UiPreferences;
}
```

初期値：
- projects / tasks / workLogs / adhocTasks は空配列
- uiPreferences は `{ taskTableColumnWidths: {}, ganttZoomLevel: 'Day', theme: 'dark' }`

### 2.1 ID生成

すべてのエンティティのIDは `crypto.randomUUID()` を優先し、未サポート環境では `crypto.getRandomValues` ベースのUUID v4でフォールバック生成する。

---

## 3. 永続化（localStorage）

* `AppState`全体を単一キー `ganttProgressAppState` で保存
* 自動保存：状態変更時、デバウンス（1000ms）後に保存
* 手動保存：`Ctrl+S` で即座に保存

---

## 4. GUI / UX要件

### 4.1 全体レイアウト（1カラム）

**Bulmaコンポーネント**を使用したシンプルな縦並びレイアウト：
* 常時ダークテーマ（bulma-prefers-dark + カスタムCSS。ガント領域/モーダルも暗色に統一）
* ガントコンテナはBulmaのbox＋最小限のカスタム（パディング、薄い枠・角丸）

1. **トップヘッダー**（`.navbar`）
   * プロジェクト選択ドロップダウン
   * プロジェクト管理ボタン
   * 今日のサマリー（今日期限、遅延タスク数）
   * 進捗報告文生成ボタン

2. **ツールバー**
   * 新規タスクボタン
   * 検索入力欄
   * ズーム切替ボタン（日/週/月）

3. **ガントチャート**（`.box`内）

4. **タスク一覧テーブル**（`.box`内）

5. **下部タブ**（`.tabs`）
   * 作業ログタブ
   * 一時タスクタブ

6. **フローティングボタン**（右下）
   * `＋一時タスク` ボタン

### 4.2 キーボードショートカット

| キー | 動作 |
|------|------|
| `Ctrl+S` | 手動保存 |
| `N` | 新規タスクモーダルを開く |
| `Ctrl+F` | 検索入力にフォーカス |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` / `Ctrl+Shift+Z` | Redo |
| `Delete` | 選択タスクを削除 |
| `Escape` | モーダルを閉じる |

### 4.3 トースト通知

* 表示位置：右下
* 表示時間：3秒で自動消去
* 最新1件のみ表示

---

## 5. タスクテーブル

### 5.1 カラム

* チェックボックス
* タスク名
* 担当者
* 進捗率
* 開始日
* 終了日
* ステータス（タグ表示）
* 優先度（タグ表示）

### 5.2 動作

* 行クリックでタスク選択（ガントバーもハイライト）
* 行ダブルクリックで編集モーダル
* 検索：タスク名で部分一致フィルター
* プロジェクト未選択のタスクも「プロジェクトなし」として追加・表示可能

### 5.3 削除ルール

| 対象 | ルール |
|------|--------|
| タスク | 確認後削除、紐づく作業ログも削除 |
| プロジェクト | タスクが存在する場合は削除不可 |
| 作業ログ | 確認後削除 |
| 一時タスク | 確認後削除 |

---

## 6. ガントチャート

### 6.1 基本表示

* Frappe Ganttを使用
* 縦軸：タスク
* 横軸：時間（日/週/月で切替可能）
* 進捗率を内部塗りつぶしで表示
* 今日を縦線で表示
* 横スクロールで期間全体を確認可能（ガントコンテナはoverflow-x: auto）
* ステータス別の枠線表現（未着手/進行中/完了/保留）と遅延の視覚化

### 6.2 ズーム操作

| レベル | 表示単位 |
|--------|----------|
| 日 | 1日単位（デフォルト） |
| 週 | 1週間単位 |
| 月 | 1ヶ月単位 |

### 6.3 優先度による色分け

| 優先度 | 色 |
|--------|-----|
| 高 | 赤 (#F14668) |
| 中 | 黄 (#FFE08A) |
| 低 | 緑 (#48C78E) |
| 遅延 | 赤 + 破線ボーダー |

### 6.4 マウス操作

* バー中央をドラッグ：開始日・終了日を同時に移動
* 左端をドラッグ：開始日のみ調整
* 右端をドラッグ：終了日のみ調整
* バークリック：タスク選択
* 進捗バーをドラッグ：進捗率変更
* バーホバー/クリック時のポップアップにステータス・進捗・期間を表示

---

## 7. モーダル

### 7.1 プロジェクト管理モーダル

* プロジェクト一覧表示
* 新規作成/編集/削除

### 7.2 タスク編集モーダル

* タスク名、プロジェクト、担当者
* 開始日、終了日
* ステータス、優先度
* 進捗率、メモ
* プロジェクトは任意（未選択の場合は「プロジェクトなし」で保存）

### 7.3 一時タスクモーダル

* 日付、タイトル
* 詳細、作業時間
* 関連プロジェクト

### 7.4 進捗報告モーダル

* 期間選択（今日/今週/今月/カスタム）
* 対象プロジェクト選択
* 一時タスク含める/含めないオプション
* 報告文テキストエリア
* クリップボードにコピーボタン

---

## 8. 進捗報告文

生成される報告文の構造：

1. **概要**：期間の表示
2. **完了タスク**：期間内に完了したタスク一覧
3. **進行中タスク**：進捗率と直近の作業ログ
4. **遅延/リスクありタスク**：期限超過タスク
5. **一時タスク/その他**：オプション
6. **次回報告までの予定**：進行中タスクの継続予定

---

## 9. スコープ外事項

以下は初期実装から除外：

* ユニットテスト
* 依存関係UI
* モバイル/レスポンシブ対応
* エクスポート/インポート機能
* 印刷対応
* サンプルデータ/チュートリアル
* ファビコン
* インライン編集（テーブルセル直接編集）
* ソート/フィルター機能
