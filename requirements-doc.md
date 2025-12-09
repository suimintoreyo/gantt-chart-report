# ガントチャート進捗・報告アプリ – 要件定義書

本ドキュメントは、ガントチャートベースの進捗管理・報告アプリの実装および拡張に関する要件を定義します。

本プロジェクトには**2つの主要スコープ**があります：

1. ブラウザベースのガントチャート進捗報告アプリの実装・改良（Vanilla JS、HTML、CSS）。GUI操作性とローカル永続化に重点を置く。
2. 既存リポジトリ `https://github.com/suimintoreyo/gantt-chart-report.git` に対して、各ガントチャートのタスクバーを**マウスで直接編集**（ドラッグで移動・リサイズ）できる機能を追加し、日付と期間が正しく更新されるようにする。

また、主要ロジックに対してJestを使用したユニットテストを追加します。

---

## 0. 技術スタック・プロジェクト構成

* **フロントエンドのみ**：モダンなデスクトップブラウザ（最新のChrome/Edge）で動作
* **フロントエンドフレームワーク不使用**：**Vanilla JavaScript**、**HTML**、**CSS**のみを使用
* `index.html`（または既存のエントリーHTML）をブラウザで開くだけでアプリが動作すること
* データ永続化には**localStorage**を使用
* テスト可能なロジックには**Node + Jest**環境を構築
* **ランタイムでのnpm/ビルドツール不使用**：すべてのCSS/JSライブラリはオフライン使用のためローカルに保存

### 0.1 CSSフレームワーク：Bulma

* **採用フレームワーク**：Bulma（v0.9.x または最新安定版）
* **採用理由**：
  - 豊富な色バリエーション（`is-primary`、`is-danger`、`is-success`、`is-warning`、`is-info`）
  - 内蔵コンポーネント：タブ、モーダル、通知、カード、ナビバー
  - カスタムCSSが最小限で済む
  - JavaScript依存なし（純粋なCSS）
  - オフライン対応可能（ローカルファイル保存）
* **ファイルサイズ**：約25KB（minified + gzip）
* **ダークモード**：**常時ダークモード**
  - `bulma-prefers-dark.css`を使用
  - OS設定に関係なく、アプリは常にダークモードで表示
  - ライト/ダークの切り替え機能は実装しない
  - 配置：`css/bulma-prefers-dark.min.css`

### 0.2 ガントチャートライブラリ：Frappe Gantt

* **採用ライブラリ**：Frappe Gantt（最新安定版）
* **採用理由**：
  - ドラッグ＆ドロップ内蔵（バー全体の移動）
  - リサイズ内蔵（左右端のドラッグ）
  - 進捗表示内蔵
  - 今日の線（トゥデイライン）内蔵
  - カスタムクラス対応（優先度による色分け）
  - 軽量（約40KB）
  - MITライセンス
  - オフライン対応可能（ローカルファイル配置）
* **ファイルサイズ**：約40KB（minified）
* **配置**：`js/frappe-gantt.min.js`、`css/frappe-gantt.css`

### 0.3 カスタムCSS方針

* **目標**：カスタムCSSを最小限に（目標：20〜30行以下）
* Bulmaの内蔵クラスを最大限活用
* 優先度の色分け：`is-danger`、`is-warning`、`is-success`、`is-info`を再利用
* カスタムスタイルが必要な箇所：
  - レイアウト調整（グリッド設定）
  - ガントチャート統合スタイル
  - 遅延タスクの視覚的インジケーター

### 想定ファイル構成（新規または更新）

```
project/
├── index.html
├── css/
│   ├── bulma.min.css              ← Bulmaフレームワーク（25KB）
│   ├── bulma-prefers-dark.min.css ← ダークモード対応（オプション）
│   ├── frappe-gantt.css           ← ガントチャートスタイル（採用時）
│   └── app.css                    ← 最小限のカスタムCSS
├── js/
│   ├── frappe-gantt.min.js        ← ガントチャートライブラリ（採用時）
│   ├── state.js                   ← 状態管理・永続化
│   ├── gantt.js                   ← ガントチャート連携
│   ├── report.js                  ← 報告書生成
│   └── main.js                    ← エントリーポイント
├── __tests__/
│   ├── state.test.js
│   ├── dateHelpers.test.js
│   └── report.test.js
├── package.json                   ← Jest設定
└── jest.config.js                 ← Jest設定（必要に応じて）
```

既存リポジトリ `gantt-chart-report` については、上記構成を既存の構造に適応させ、既存のビルド・起動フローを壊さないこと。

---

## 1. アプリ概要

### 1.1 目的

本アプリは以下をサポートする**ガントチャートベースの進捗管理ツール**です：

* ガントチャートによるプロジェクトとタスクの視覚的スケジュール管理
* 快適なGUI操作：
  * マウスによる直接操作（ドラッグ＆ドロップ、リサイズ）
  * パワーユーザー向けの素早いキーボード操作
* 以下の追跡：
  * 通常のプロジェクトタスク
  * アドホック/一回限りのタスク（一時タスク）
* 以下に基づく**進捗報告文の自動生成**：
  * タスクとその進捗
  * 作業ログ
  * 一時タスク

### 1.2 実行環境

* デスクトップブラウザ、サーバー不要
* オフライン動作：すべてのデータは**localStorage**に保存
* 既存リポジトリ（`gantt-chart-report`）がベースライン。ゼロから書き直すのではなく、拡張・改良する

---

## 2. データモデル

以下の概念的データ構造を使用します。実装はプレーンなJSオブジェクトで可能です。TypeScript型はドキュメント目的で記載しています。

```ts
type ProjectStatus = 'planned' | 'active' | 'completed' | 'on_hold';

interface Project {
  id: string;
  name: string;
  owner?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  status: ProjectStatus;
}

type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'on_hold';
type TaskPriority = 'high' | 'medium' | 'low';

interface Task {
  id: string;
  projectId: string;
  name: string;
  category?: string;      // フェーズ/カテゴリ
  assignee?: string;
  plannedStart: string;   // YYYY-MM-DD
  plannedEnd: string;     // YYYY-MM-DD
  progress: number;       // 0-100
  status: TaskStatus;
  priority?: TaskPriority;
  dependsOn?: string[];   // タスクID配列
  notes?: string;
}

interface WorkLog {
  id: string;
  taskId: string;
  date: string;           // YYYY-MM-DD
  workNote: string;
  hours?: number;         // 作業時間
  progressAfter?: number; // 作業後の進捗率
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
  taskTableColumnWidths?: { [columnKey: string]: number };
  ganttZoomLevel?: number; // 整数のズームレベル
  theme?: 'dark' | 'light';
}

interface AppState {
  projects: Project[];
  tasks: Task[];
  workLogs: WorkLog[];
  adhocTasks: AdhocTask[];
  uiPreferences: UiPreferences;
}
```

`AppState`全体をlocalStorageに保存します。

### 2.1 ID生成方法

すべてのエンティティ（Project, Task, WorkLog, AdhocTask）のIDは **UUID v4** を使用します。

```js
// ブラウザ標準APIを使用（Chrome 92+, Edge 92+）
const generateId = () => crypto.randomUUID();
// 例: "550e8400-e29b-41d4-a716-446655440000"
```

* **採用理由**：
  - 外部ライブラリ不要
  - 衝突の可能性が実質ゼロ
  - 標準API使用でオフライン完全対応
* **形式**: 36文字（ハイフン含む）、例: `"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"`

---

## 3. 永続化（localStorage）

### 3.1 要件

* `AppState`全体の永続化に`localStorage`を使用
* 単一の安定したキーを使用（例：`ganttProgressAppState`）
* エラーハンドリングと簡単なマイグレーションフックを備えた堅牢なロード/セーブ関数を提供

### 3.2 API（純粋関数）

以下のユーティリティ関数を実装（`state.js`または同等のファイル内）：

```js
const STORAGE_KEY = 'ganttProgressAppState';

/**
 * localStorageからAppStateを読み込む。
 * 存在しないかパースに失敗した場合、有効な初期状態を返す。
 */
export function loadState() {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return getInitialState();
    const state = JSON.parse(json);
    return migrateStateIfNeeded(state);
  } catch (e) {
    console.error('状態の読み込みに失敗', e);
    return getInitialState();
  }
}

/**
 * AppStateをlocalStorageに保存（JSON文字列化）。
 */
export function saveState(state) {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
    // オプション：「自動保存済み」などのUIインジケーターを表示
  } catch (e) {
    console.error('状態の保存に失敗', e);
  }
}
```

追加で実装：

* `getInitialState()` – 空だが有効な`AppState`を返す
* `migrateStateIfNeeded(state)` – 必要に応じて古い状態バージョンをアップグレード（初期はパススルーで可）

### 3.3 自動保存と手動保存

* **自動保存**：関連する状態変更時（タスク編集、日付移動など）、短いデバウンス（例：500〜2000ms）後に保存
* **手動保存**：`Ctrl+S`で明示的に`saveState(currentState)`を実行し、小さなトースト「保存しました」などを表示

---

## 4. GUI / UX要件

### 4.1 全体レイアウト（デスクトップ）

**Bulmaコンポーネント**を使用したシングルページレイアウト：

* **トップヘッダー**（`.navbar`）
  * プロジェクト選択ドロップダウン（`.select`）
  * 日付範囲セレクター（例：今日 / 今週 / 今月）
  * 小さな「今日のサマリー」エリア（今日が期限のタスク数、遅延タスク数など）
  * ボタン：**「進捗報告文生成」**（`.button.is-primary`、報告モーダルを開く）

* **中央：2つのメインペイン（左右）**（CSSグリッドまたは`.columns`）
  * **左**：タスクリストテーブル（`.table`）
  * **右**：ガントチャート（Frappe Ganttまたはカスタム）

* **下部エリア**：タブビュー（`.tabs`）
  * タブ：`作業ログ` | `一時タスク`
  * 各タブはそのカテゴリのテーブルリストを表示

* **右側（または類似位置）**：
  * **サイドパネル**（`.card`）：選択タスクの詳細と進捗更新コントロール

* **フローティングボタン（右下）**：
  * `＋一時タスク`（`.button.is-primary.is-rounded`）– どの画面からでも一時タスクをクイック入力

### 4.2 プロジェクト管理UI

プロジェクトの追加/編集/削除は**専用モーダル**で行う。

* **起動方法**：ヘッダーの「プロジェクト管理」ボタン（`.button`）をクリック
* **モーダル構成**（`.modal.modal-card`）：
  * プロジェクト一覧テーブル（名前、ステータス、期間）
  * 操作ボタン：「＋新規作成」「編集」「削除」
  * 選択中プロジェクトのハイライト表示

```
┌─────────────────────────────────────┐
│ プロジェクト管理                 ✕  │
├─────────────────────────────────────┤
│ [＋新規作成]                        │
│ ┌─────────────────────────────────┐ │
│ │ 名前         ステータス  期間   │ │
│ ├─────────────────────────────────┤ │
│ │ ProjectA     進行中      12/1-  │ │
│ │ ProjectB     計画中      1/15-  │ │
│ └─────────────────────────────────┘ │
│              [編集] [削除] [閉じる] │
└─────────────────────────────────────┘
```

* **新規作成/編集時**：インラインフォームまたはネストモーダルで入力
  * プロジェクト名（必須）
  * オーナー（オプション）
  * 開始日・終了日
  * ステータス（計画中/進行中/完了/保留）

### 4.3 Bulmaコンポーネントマッピング

| UI要素 | Bulmaコンポーネント |
|--------|---------------------|
| ヘッダー/ナビゲーション | `.navbar` |
| ボタン | `.button`、`.button.is-primary`、`.button.is-danger`など |
| フォーム入力 | `.input`、`.select`、`.textarea` |
| テーブル | `.table.is-striped.is-hoverable` |
| カード | `.card`、`.card-header`、`.card-content`、`.card-footer` |
| モーダル | `.modal`、`.modal-card` |
| タブ | `.tabs`、`.tab-content`（カスタム） |
| 通知 | `.notification.is-success`、`.notification.is-danger` |
| プログレスバー | `.progress.is-primary` |
| タグ/バッジ | `.tag.is-danger`、`.tag.is-warning`、`.tag.is-success` |
| ドロップダウン | `.dropdown` |

### 4.4 共通UXルール

* **クリック数を最小限に**：
  * ほとんどの編集はダブルクリックまたはシングルクリック＋サイドパネルで到達可能に

* **キーボードサポート**：
  * `Ctrl+S` – 手動保存
  * `N` – 新規タスク行にフォーカス
  * `Ctrl+F` – 検索入力にフォーカス（タスク名で絞り込み）
  * `Ctrl+Enter` – 報告モーダルで確定
  * `Ctrl+Z / Ctrl+Y` – 直近の編集をUndo/Redo（タスク作成、削除、日付変更を含む最低10〜20ステップ）

* **IME安全性**：
  * IME変換中（日本語入力）は、`Enter`がグローバルショートカット（モーダルを閉じるなど）をトリガーしないこと

* **視覚的フィードバック**：
  * ボタンと行のホバー状態
  * 選択ハイライト（クリックしたタスク行とそのガントバー）

* **トースト通知**：
  * **表示位置**：右下（作業エリアを邪魔しない）
  * **表示時間**：3秒で自動消去
  * **複数通知**：最新1件のみ表示（前の通知は即座に置換）
  * **通知の種類**：
    | 内容 | Bulmaクラス | 例 |
    |------|-------------|-----|
    | 自動保存完了 | `.notification.is-light` | 「自動保存しました」 |
    | 手動保存完了 | `.notification.is-success` | 「保存しました」 |
    | エラー | `.notification.is-danger` | 「保存に失敗しました」 |
    | コピー完了 | `.notification.is-success` | 「クリップボードにコピーしました」 |

---

## 5. タスクリストテーブル（左ペイン）

### 5.1 カラム

最低限：

* チェックボックス（行選択）
* タスク名
* 担当者
* 進捗率
* 開始日
* 終了日
* ステータス（未着手 / 進行中 / 完了 / 保留）– `.tag`と色を使用
* 優先度（高 / 中 / 低）– `.tag.is-danger`、`.tag.is-warning`、`.tag.is-info`を使用

### 5.2 動作

* **インライン編集**：
  * セルをダブルクリックで編集モードに入る
  * Tab / Shift+Tabで編集可能セル間を移動

* **新規タスク行**：
  * `+ 新規タスク`のような特別な最下行を保持
  * 入力すると新しいタスクが作成される

* **検索**：
  * テーブル上部に検索入力欄（`.input`）
  * **タスク名のみ**を対象に部分一致でフィルター
  * `Ctrl+F`でフォーカス移動

* **ソートとフィルター**：
  * カラムヘッダーをクリックでソートを切り替え
  * 担当者とステータス用の簡易ヘッダーフィルター（例：小さなドロップダウン）

* **行選択**：
  * 行を選択するとガントチャート内の対応するバーがハイライト
  * 選択したタスクの詳細がサイドパネルに表示

* **削除**：
  * `Delete`キーまたは行メニューでタスクを削除
  * **確認ダイアログ**：削除前に必ず確認を表示
  * **関連データの扱い**：タスクに紐づく作業ログも一緒に削除（データ整合性を保つ）

---

## 5.3 削除ルール

| 対象 | ルール | 関連データ |
|------|--------|------------|
| タスク | 確認ダイアログ後に削除 | 紐づく作業ログも削除 |
| プロジェクト | タスクが存在する場合は削除不可 | 先にタスクを削除/移動する必要あり |
| 作業ログ | 確認ダイアログ後に削除 | なし |
| 一時タスク | 確認ダイアログ後に削除 | なし |

---

## 6. ガントチャート（右ペイン）

ガントチャートは中心的な機能であり、タスクバーの**マウスによる直接操作**をサポートする必要があります。

### 6.1 基本表示

* 縦軸：タスク（タスクテーブルと揃える）
* 横軸：日単位の時間
* 各タスクはバーとして描画：
  * バー全体 = 予定期間（`plannedStart`から`plannedEnd`まで）
  * 内部の塗りつぶし = 進捗率（左から右への塗りつぶし割合）
* 縦線で**今日**を示す
* 遅延タスクは視覚的に区別（例：異なる色/ボーダー）。`plannedEnd < 今日` かつ `progress < 100` のタスクが「遅延」

### 6.2 ズーム操作

ガントチャートの時間軸表示を切り替える機能。

* **操作方法**：トグルボタン形式（3つのボタン）
* **ズームレベル**：
  | レベル | 表示単位 | 用途 |
  |--------|----------|------|
  | 日 | 1日単位 | 詳細な日程確認（デフォルト） |
  | 週 | 1週間単位 | 中期的な進捗確認 |
  | 月 | 1ヶ月単位 | 長期的な俯瞰 |

* **UI配置**：ガントチャート上部に配置
  ```
  [日] [週] [月]   ← 選択中のボタンがアクティブ表示
  ```

* **実装**（Frappe Gantt使用時）：
  ```js
  gantt.change_view_mode('Day');   // 日
  gantt.change_view_mode('Week');  // 週
  gantt.change_view_mode('Month'); // 月
  ```

### 6.3 優先度による色分け

Frappe Gantt使用時は`custom_class`経由、または直接CSSでBulmaの色クラスを使用：

| 優先度 | 色クラス | 表示色 |
|--------|----------|--------|
| 高 | `is-danger` / 赤 | #F14668 |
| 中 | `is-warning` / 黄 | #FFE08A |
| 低 | `is-success` / 緑 | #48C78E |
| 遅延 | `is-danger` + 破線ボーダー | パターン付き赤 |

### 6.4 マウスベース編集（コア要件）

タスクを表す各バーに対して、**3種類のマウスインタラクション**を実装：

1. **バー全体を水平にドラッグ** – 開始日と終了日を同時に移動
2. **左端をドラッグ** – 開始日のみ調整
3. **右端をドラッグ** – 終了日のみ調整

ピクセル移動に基づく日単位のスナッピングシステムを使用。

#### 共通ルール

* 水平移動を整数の日オフセットに変換：

  ```js
  const deltaX = currentMouseX - dragStartMouseX;
  const deltaDays = Math.round(deltaX / dayWidth); // dayWidth: 1日あたりのピクセル数
  ```

* ドラッグ中はバーの位置/幅をリアルタイムで視覚的に更新

* ドラッグ終了時（`mouseup` / `pointerup`）：
  * 最終的な`deltaDays`を新しい`plannedStart` / `plannedEnd`に変換
  * 状態内の対応する`Task`オブジェクトを更新
  * `saveState`で永続化（デバウンス付き）
  * 関連UIを更新（テーブル、サイドパネルの日付など）

#### 6.4.1 バー全体のドラッグ（開始と終了を移動）

* バーの**中央エリア**（端以外）をクリック＆ドラッグで有効
* 動作：
  * 右にドラッグ：`plannedStart`と`plannedEnd`の両方が`deltaDays`分後ろに移動
  * 左にドラッグ：両方が前に移動

疑似ロジック：

```js
// ドラッグ終了時
const newStart = addDays(task.plannedStart, deltaDays);
const newEnd   = addDays(task.plannedEnd, deltaDays);

updateTaskDates(task.id, newStart, newEnd);
```

* オプションの制約：
  * 日付がグローバルな最小/最大タイムラインを超えないようにクランプ（存在する場合）
  * 依存関係ロジックがある場合、基本的な制約に違反しないようにするか、少なくとも動作を文書化

#### 6.4.2 左端のドラッグ（開始日のみ変更）

* **左端**のリサイズハンドル（別のDOM要素または領域）で「resize-left」ドラッグを開始
* 動作：
  * 左にドラッグ：`plannedStart`が前に移動（期間が増加）
  * 右にドラッグ：`plannedStart`が後ろに移動（期間が減少）

ドラッグ終了時：

```js
const newStart = addDays(task.plannedStart, deltaDays);
// newStart <= plannedEnd を確保
if (new Date(newStart) > new Date(task.plannedEnd)) {
  // 最低1日の期間を維持するようにクランプ
  // または newStart = plannedEnd に設定
}
updateTaskDates(task.id, newStart, task.plannedEnd);
```

#### 6.4.3 右端のドラッグ（終了日のみ変更）

* **右端**のリサイズハンドルで「resize-right」ドラッグを開始
* 動作：
  * 右にドラッグ：`plannedEnd`が後ろに移動（期間が増加）
  * 左にドラッグ：`plannedEnd`が前に移動（期間が減少）

ドラッグ終了時：

```js
const newEnd = addDays(task.plannedEnd, deltaDays);
// newEnd >= plannedStart を確保
if (new Date(newEnd) < new Date(task.plannedStart)) {
  // 最低でも開始日と同じか、1日の期間にクランプ
}
updateTaskDates(task.id, task.plannedStart, newEnd);
```

### 6.5 実装詳細

* **Frappe Gantt**使用時：コールバック付きの内蔵ドラッグ/リサイズ機能を活用：
  ```js
  const gantt = new Gantt('#gantt', tasks, {
    on_click: (task) => showTaskDetail(task),
    on_date_change: (task, start, end) => updateTaskDates(task.id, start, end),
    on_progress_change: (task, progress) => updateTaskProgress(task.id, progress),
    view_mode: 'Day'
  });
  ```
* カスタム実装の場合：HTML要素（div）＋絶対配置、またはSVGを使用
* 各バーはタスクIDと関連付け（例：`data-task-id`）
* `pointerdown` / `pointermove` / `pointerup`または従来のマウスイベント（`mousedown` / `mousemove` / `mouseup`）を使用
* テキストフィールドでIMEがアクティブな間は、誤ってドラッグロジックをトリガーしないこと

---

## 7. サイドパネル – タスク詳細と進捗更新

タスクが選択されたとき（テーブルまたはガントバーから）、サイドパネル（`.card`）を表示：

* タスク名（編集可能）
* プロジェクト、担当者
* 予定開始日・終了日（編集可能、ガントの変更と同期）
* ステータス（`.select`）
* 進捗コントロール：
  * 0〜100のスライダー（`<input type="range">`）
  * 正確な％のための数値入力
* メモフィールド（`.textarea`）
* 作業ログ入力：
  * 今日の日付（デフォルト）
  * 作業内容
  * 時間
  * ボタン：「今日の作業ログに追加」（`.button.is-primary`）– `WorkLog`エントリを作成

すべての変更は`AppState`を更新し、`saveState`を実行すること。

---

## 8. 下部タブ – ログと一時タスク

タブナビゲーションにはBulmaの`.tabs`コンポーネントを使用。

### 8.1 作業ログ

* テーブルカラム（`.table`）：
  * 日付
  * タスク名
  * 作業メモ
  * 時間
  * 作業後の進捗率

* 機能：
  * 期間フィルター：今日 / 今週 / カスタム日付範囲
  * 既存ログの編集/削除

### 8.2 一時タスク

* テーブルカラム：
  * 日付
  * タイトル
  * 詳細メモ
  * 時間
  * 関連プロジェクト（オプション）

* 機能：
  * 追加/編集/削除
  * フローティング`＋一時タスク`ボタンでクイック追加（`.modal`を開く）：
    * 日付（デフォルトは今日）
    * タイトル
    * 時間
    * 詳細
    * 保存

---

## 9. 進捗報告文生成

メインヘッダーの「進捗報告文生成」ボタンから呼び出す**モーダル**ダイアログ（`.modal.modal-card`）を提供。

### 9.1 モーダルオプション

* 期間選択：
  * 今日
  * 今週
  * カスタム日付範囲（開始/終了）

* 対象プロジェクト：
  * プロジェクトの複数選択リスト

* オプション：
  * 一時タスクを含める？（チェックボックス）

### 9.2 報告内容構造

報告テキストを生成する純粋関数を実装：

```js
export function generateReport(appState, options) {
  // options: { from: string, to: string, projectIds?: string[], includeAdhoc?: boolean }
  // 文字列を返す
}
```

生成されるテキストは以下の構造に従う：

1. **概要**
   * 例：「○月○日（〜○月○日）の進捗報告です。」

2. **完了タスク**
   * `status === 'completed'`で期間内に完了したタスクのリスト

3. **進行中タスク**
   * `status === 'in_progress'`のタスク。進捗率と短い説明（直近のログがあれば）を含む

4. **遅延/リスクありタスク**
   * `plannedEnd < to` かつ `progress < 100` のタスク。理由/メモがあれば表示

5. **一時タスク/その他**（`includeAdhoc`がtrueの場合）
   * 一時タスクのサマリーと時間

6. **次回報告までの予定**
   * 進行中タスクに基づく簡単な予測（例：「タスクXの実装完了〜単体テスト着手」）– ヒューリスティック/シンプルで可

### 9.3 モーダルUI

* 生成された報告を含む大きなテキストエリアを表示
* ボタン：
  * 生成/再生成（`.button.is-primary`）
  * クリップボードにコピー（`.button.is-success`）
  * 閉じる（`.button`）
* オプション：生成後に自動選択・自動コピーし、小さなトースト通知（`.notification`）を表示

---

## 10. テスト要件（Jest）

非DOMロジックのユニットテスト用に**Jest**をセットアップ。

### 10.1 環境セットアップ

1. Nodeプロジェクトを初期化しJestをインストール：

```bash
npm init -y
npm install --save-dev jest
```

2. `package.json`に追加：

```json
"scripts": {
  "test": "jest"
}
```

3. 必要に応じてJest設定ファイルを追加し、テストがESモジュールをインポートできるか、CommonJSを一貫して使用できるようにする。

### 10.2 テスト対象

最低限以下の関数（および必要なヘルパー）のテストを作成：

* `saveState(state)` / `loadState()`
* 日付/時刻ヘルパー：
  * `addDays(dateStr, n)`
  * `getTasksInPeriod(tasks, from, to)`
  * `getDelayedTasks(tasks, today)`
* 報告生成：
  * `generateReport(appState, options)`

テストファイルは`__tests__/`配下に配置：

* `__tests__/state.test.js`
* `__tests__/dateHelpers.test.js`
* `__tests__/report.test.js`

### 10.3 テストケース例

1. **saveState/loadState**
   * `AppState`を保存後に読み込むと、同じ構造/値のオブジェクトが返る
   * localStorageにデータがない場合、`loadState()`は`getInitialState()`を返す

2. **遅延タスク**
   * `plannedEnd < today` かつ `progress < 100` のタスクは`getDelayedTasks()`に含まれる
   * `plannedEnd === today` または `progress === 100` のタスクは遅延とみなされない

3. **期間フィルター**
   * `getTasksInPeriod()`は日付範囲が指定期間と交差するタスクを返す
   * 境界条件：`from`で開始または`to`で終了するタスクは含まれる

4. **報告生成**
   * 完了タスクは「完了」セクションに表示
   * 進行中タスクは進捗率とともに表示
   * 遅延タスクは「遅延」セクションに表示
   * 一時タスクは`options.includeAdhoc`がtrueの場合のみ表示

`npm test`を実行し、すべてのテストがパスすることを確認。

---

## 11. 既存リポジトリとの統合

上記すべての要件は、以下の既存プロジェクト構造**内で**適用する必要があります：

* `https://github.com/suimintoreyo/gantt-chart-report.git`

手順：

1. リポジトリをクローンし、メインエントリーポイントとガント実装を特定
2. 以下に準拠するようコードを統合またはリファクタリング：
   * データモデルと永続化レイヤー
   * ガントタスクバーの直接操作（ドラッグ/リサイズ）
   * 進捗報告
3. 既存機能を維持または改善し、現在の基本動作を壊さない。既存のデータ構造が異なる場合：
   * 上記の`AppState`スタイル構造にマッピングする薄いアダプターを追加、または
   * ローカライズされ、コメントが付けられた方法でリファクタリング

---

## 12. 成果物

以下を作成または更新すること：

* 機能およびUX要件を満たすアプリケーションソースコード（HTML/CSS/JS）
* マウスベース編集を備えたガントチャート実装：
  * バーをドラッグして移動
  * 左端をドラッグして開始日を変更
  * 右端をドラッグして終了日を変更
  * 基礎となる日付と期間が更新、保存され、すべてのビューに反映
* `loadState` / `saveState`ユーティリティによるlocalStorageでの`AppState`永続化
* 進捗報告生成関数とモーダル
* テストセットアップ（`package.json`、Jest設定）と`__tests__/`配下のテストファイル：
  * 状態永続化
  * 日付ヘルパーロジック
  * 報告生成
* メインモジュールとドラッグロジックの実装方法を説明する短いメモまたはコード内コメント

これらの要件が満たされたら、ブラウザでアプリを実行し、プロジェクトルートで`npm test`を実行して、両方ともエラーなく成功すること。

---

## 13. 未決定・保留事項

| 項目 | ステータス | 備考 |
|------|------------|------|
| Frappe Gantt採用 | **採用決定** | ドラッグ＆ドロップ、リサイズ、進捗表示を内蔵 |
| ダークモード実装 | **採用決定** | 常時ダークモード（`bulma-prefers-dark.css`使用） |
| 依存関係（dependsOn）UI | スコープ外 | データモデルは残すが、表示・編集は初期実装から除外。将来拡張可能 |
| モバイル/レスポンシブ対応 | スコープ外 | デスクトップ優先、後で検討の可能性あり |
| エクスポート/インポート機能 | スコープ外 | localStorageのみで対応、将来検討の可能性あり |
| 印刷対応 | スコープ外 | 印刷用CSSは初期実装から除外 |
| 初期データ/サンプルデータ | スコープ外 | 空の状態で開始、チュートリアルなし |
| ファビコン | スコープ外 | デフォルトのブラウザアイコンを使用 |
