# Gantt Chart Progress & Report App – Requirements (for Codex)

This document defines the requirements for implementing and extending a Gantt chart–based progress management & reporting app. The implementation will be driven by Codex based on this specification.

The work has **two main scopes**:

1. Implement / refine a browser-based Gantt progress-report app (Vanilla JS, HTML, CSS) with a strong focus on GUI usability and local persistence.
2. For the existing repository
   `https://github.com/suimintoreyo/gantt-chart-report.git`
   add **direct mouse-based editing** of each Gantt task bar (drag to move/resize) and ensure that underlying dates and durations are updated correctly.

Additionally, unit tests should be added for key logic using Jest.

---

## 0. Tech Stack & Project Structure

* **Frontend only**; runs in a modern desktop browser (latest Chrome/Edge).
* **No frontend frameworks**: use **Vanilla JavaScript**, **HTML**, and **CSS** only.
* The app should run by just opening `index.html` (or the repo's existing entry HTML) in a browser.
* Use **localStorage** for data persistence.
* For testable logic, set up a **Node + Jest** environment.
* **No npm/build tools at runtime**: all CSS/JS libraries must be locally stored for offline use.

### 0.1 CSS Framework: Bulma

* **Adopted framework**: Bulma (v0.9.x or latest stable)
* **Reason for adoption**:
  - Rich color variations (`is-primary`, `is-danger`, `is-success`, `is-warning`, `is-info`)
  - Built-in components: tabs, modals, notifications, cards, navbar
  - Minimal custom CSS required
  - No JavaScript dependency (pure CSS)
  - Offline-capable (local file storage)
* **File size**: ~25KB (minified + gzipped)
* **Dark mode**: Use `bulma-prefers-dark.css` add-on or custom CSS variables

### 0.2 Gantt Chart Library: Frappe Gantt (Candidate - High Priority)

* **Status**: High priority candidate, pending final decision
* **Reason for consideration**:
  - Built-in drag & drop (move entire bar)
  - Built-in resize (drag left/right edges)
  - Built-in progress display
  - Built-in today line
  - Support for custom classes (priority color coding)
  - Lightweight (~40KB)
  - MIT License
  - Offline-capable
* **If not adopted**: Implement custom Gantt chart with similar functionality

### 0.3 Custom CSS Policy

* **Goal**: Minimize custom CSS (target: 20-30 lines or less)
* Maximize use of Bulma's built-in classes
* Priority color coding: reuse `is-danger`, `is-warning`, `is-success`, `is-info`
* Only custom styles needed:
  - Layout adjustments (grid setup)
  - Gantt chart integration styles
  - Delayed task visual indicator

### Expected Files (new or updated)

```
project/
├── index.html
├── css/
│   ├── bulma.min.css            ← Bulma framework (25KB)
│   ├── bulma-prefers-dark.min.css ← Dark mode support (optional)
│   ├── frappe-gantt.css         ← Gantt chart styles (if adopted)
│   └── app.css                  ← Minimal custom CSS
├── js/
│   ├── frappe-gantt.min.js      ← Gantt chart library (if adopted)
│   ├── state.js                 ← State management & persistence
│   ├── gantt.js                 ← Gantt chart integration
│   ├── report.js                ← Report generation
│   └── main.js                  ← Entry point
├── __tests__/
│   ├── state.test.js
│   ├── dateHelpers.test.js
│   └── report.test.js
├── package.json                 ← Jest configuration
└── jest.config.js               ← Jest settings (if needed)
```

For the existing repo `gantt-chart-report`, adapt the above structure to what is already in place; do not break existing build/launch flow.

---

## 1. High-Level App Overview

### 1.1 Purpose

The app is a **Gantt chart–based progress management tool** that supports:

* Visual schedule management of projects and tasks via a Gantt chart.
* Comfortable GUI operations:

  * Direct manipulation with mouse (drag & drop, resize).
  * Quick keyboard operations for power users.
* Tracking of:

  * Regular project tasks.
  * Ad-hoc / one-off tasks ("一時タスク").
* **Automatic progress report generation** in text form, based on:

  * Tasks and their progress.
  * Work logs (作業ログ).
  * Ad-hoc tasks.

### 1.2 Execution Environment

* Desktop browser, no server required.
* Works offline: all data stored in **localStorage**.
* The existing repo (`gantt-chart-report`) is the baseline. Extend/improve it rather than rewriting from scratch.

---

## 2. Data Model

Use the following conceptual data structures. Implementation can be plain JS objects; TypeScript types are provided just as documentation.

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
  category?: string;      // phase/category
  assignee?: string;
  plannedStart: string;   // YYYY-MM-DD
  plannedEnd: string;     // YYYY-MM-DD
  progress: number;       // 0-100
  status: TaskStatus;
  priority?: TaskPriority;
  dependsOn?: string[];   // task IDs
  notes?: string;
}

interface WorkLog {
  id: string;
  taskId: string;
  date: string;           // YYYY-MM-DD
  workNote: string;
  hours?: number;         // hours worked
  progressAfter?: number; // progress % after work
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
  ganttZoomLevel?: number; // integer zoom level
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

`AppState` as a whole is stored in localStorage.

---

## 3. Persistence (localStorage)

### 3.1 Requirements

* Use `localStorage` for persisting the entire `AppState`.
* Use a single, stable key, e.g., `ganttProgressAppState`.
* Provide robust load/save functions with error handling and simple migration hooks.

### 3.2 API (pure functions)

Implement these utility functions (either in `state.js` or equivalent):

```js
const STORAGE_KEY = 'ganttProgressAppState';

/**
 * Load AppState from localStorage.
 * If not present or parse fails, return a valid initial state.
 */
export function loadState() {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return getInitialState();
    const state = JSON.parse(json);
    return migrateStateIfNeeded(state);
  } catch (e) {
    console.error('Failed to load state', e);
    return getInitialState();
  }
}

/**
 * Save AppState to localStorage (stringified JSON).
 */
export function saveState(state) {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
    // Optionally show some UI indicator like "auto saved".
  } catch (e) {
    console.error('Failed to save state', e);
  }
}
```

Additionally implement:

* `getInitialState()` – returns an empty but valid `AppState`.
* `migrateStateIfNeeded(state)` – if necessary, upgrade older state versions (can initially be a pass-through).

### 3.3 Auto-Save & Manual Save

* **Auto-save:** On relevant state changes (task edited, dates moved, etc.), save after a short debounce (e.g. 500–2000 ms).
* **Manual save:** `Ctrl+S` triggers an explicit `saveState(currentState)` and shows a small toast "保存しました" or similar.

---

## 4. GUI / UX Requirements

### 4.1 Overall Layout (Desktop)

Single-page layout using **Bulma components**:

* **Top header** (`.navbar`)

  * Project selection dropdown (`.select`).
  * Date range selector (e.g., today / this week / this month).
  * A small "Today's summary" area (number of tasks due today, delayed tasks, etc. – can be simple).
  * Button: **"進捗報告文生成"** (`.button.is-primary`, opens report modal).

* **Center: Two main panes (left & right)** (CSS Grid or `.columns`)

  * **Left:** Task list table (`.table`).
  * **Right:** Gantt chart (Frappe Gantt or custom).

* **Bottom area:** Tabbed view (`.tabs`)

  * Tabs: `作業ログ` | `一時タスク`.
  * Each tab shows a table list for that category.

* **Right side (or similar):**

  * **Side panel** (`.card`) for selected task: details and progress update controls.

* **Floating button (bottom-right):**

  * `＋一時タスク` (`.button.is-primary.is-rounded`) – quick entry for ad-hoc tasks from any view.

### 4.2 Bulma Components Mapping

| UI Element | Bulma Component |
|------------|-----------------|
| Header/Navigation | `.navbar` |
| Buttons | `.button`, `.button.is-primary`, `.button.is-danger`, etc. |
| Form inputs | `.input`, `.select`, `.textarea` |
| Tables | `.table.is-striped.is-hoverable` |
| Cards | `.card`, `.card-header`, `.card-content`, `.card-footer` |
| Modals | `.modal`, `.modal-card` |
| Tabs | `.tabs`, `.tab-content` (custom) |
| Notifications | `.notification.is-success`, `.notification.is-danger` |
| Progress bar | `.progress.is-primary` |
| Tags/Badges | `.tag.is-danger`, `.tag.is-warning`, `.tag.is-success` |
| Dropdown | `.dropdown` |

### 4.3 Common UX Rules

* Prioritize **low click count**:

  * Most edits should be reachable by double-click or single click + side panel.

* **Keyboard support**:

  * `Ctrl+S` – manual save.
  * `N` – focus new task row.
  * `Ctrl+F` – focus search/filter input.
  * `Ctrl+Enter` – confirm in report modal.
  * `Ctrl+Z / Ctrl+Y` – Undo / Redo for recent edits (at least 10–20 steps covering task creation, deletion, and date changes).

* **IME Safety**:

  * When IME composition is active (Japanese input), `Enter` must not trigger global shortcuts (closing modals, etc.).

* Provide **visual feedback**:

  * Hover states on buttons and rows.
  * Selection highlight (clicked task row and its Gantt bar).
  * Small auto-save indicator using Bulma `.notification` (e.g., "自動保存済み").

---

## 5. Task List Table (Left Pane)

### 5.1 Columns

At minimum:

* Checkbox (row selection)
* Task name
* Assignee
* Progress %
* Start date
* End date
* Status (未着手 / 進行中 / 完了 / 保留) – use `.tag` with colors
* Priority (高 / 中 / 低) – use `.tag.is-danger`, `.tag.is-warning`, `.tag.is-info`

### 5.2 Behavior

* **Inline editing**:

  * Double-clicking a cell enters edit mode.
  * Tab / Shift+Tab moves between editable cells.
* **New task row**:

  * Keep a special bottom row like `+ 新規タスク`.
  * Typing into it should create a new task.
* **Sorting & filtering**:

  * Clicking column headers toggles sorting.
  * Simple header filters for Assignee and Status (e.g., small dropdowns).
* **Row selection**:

  * Selecting a row highlights the corresponding bar in the Gantt chart.
  * The selected task's details are shown in the side panel.
* **Deletion**:

  * `Delete` key or a row menu can delete the task.

---

## 6. Gantt Chart (Right Pane)

The Gantt chart is central and must support **direct mouse manipulation** of task bars.

### 6.1 Basic Display

* Vertical axis: tasks (aligned with the task table).
* Horizontal axis: time in days.
* Each task is drawn as a bar:

  * Entire bar = planned duration (from `plannedStart` to `plannedEnd`).
  * Internal fill = progress % (left-to-right fill proportion).
* A vertical line indicates **today**.
* Delayed tasks are visually distinctive (e.g., different color/border). A task is "delayed" when `plannedEnd < today` and `progress < 100`.

### 6.2 Priority Color Coding

Use Bulma color classes via `custom_class` (if using Frappe Gantt) or direct CSS:

| Priority | Color Class | Visual |
|----------|-------------|--------|
| High (高) | `is-danger` / red | #F14668 |
| Medium (中) | `is-warning` / yellow | #FFE08A |
| Low (低) | `is-success` / green | #48C78E |
| Delayed | `is-danger` + dashed border | Red with pattern |

### 6.3 Mouse-Based Editing (Core Requirement)

For each bar representing a task, implement **three kinds of mouse interactions**:

1. **Drag the entire bar horizontally** – shift start & end dates together.
2. **Drag the left edge** – adjust only the start date.
3. **Drag the right edge** – adjust only the end date.

Use a day-based snapping system based on pixel movements.

#### Shared rules

* Horizontal movement translates into integer day offsets:

  ```js
  const deltaX = currentMouseX - dragStartMouseX;
  const deltaDays = Math.round(deltaX / dayWidth); // dayWidth: pixels per day
  ```

* While dragging, update the bar's position/width visually in real time.

* On drag end (`mouseup` / `pointerup`):

  * Convert final `deltaDays` to new `plannedStart` / `plannedEnd`.
  * Update the corresponding `Task` object in state.
  * Persist via `saveState` (with debounce).
  * Refresh any related UI (table, side panel dates, etc.).

#### 6.3.1 Entire Bar Drag (Shift Start & End)

* Active when clicking and dragging **the middle area** of the bar (not the edges).
* Behavior:

  * Drag right: both `plannedStart` and `plannedEnd` move later by `deltaDays`.
  * Drag left: both move earlier.

Pseudo logic:

```js
// On drag end
const newStart = addDays(task.plannedStart, deltaDays);
const newEnd   = addDays(task.plannedEnd, deltaDays);

updateTaskDates(task.id, newStart, newEnd);
```

* Optional constraints:

  * Clamp so dates do not exceed global min/max timeline (if any).
  * If dependency logic exists, ensure not to violate basic constraints, or at least document behavior.

#### 6.3.2 Left Edge Drag (Change Start Only)

* A resize handle on the **left edge** (can be a separate DOM element or region) starts a "resize-left" drag.
* Behavior:

  * Drag left: `plannedStart` moves earlier (duration increases).
  * Drag right: `plannedStart` moves later (duration decreases).

On drag end:

```js
const newStart = addDays(task.plannedStart, deltaDays);
// Ensure newStart <= plannedEnd
if (new Date(newStart) > new Date(task.plannedEnd)) {
  // clamp to maintain at least 1 day duration, for example
  // or just set newStart = plannedEnd
}
updateTaskDates(task.id, newStart, task.plannedEnd);
```

#### 6.3.3 Right Edge Drag (Change End Only)

* A resize handle on the **right edge** starts a "resize-right" drag.
* Behavior:

  * Drag right: `plannedEnd` moves later (duration increases).
  * Drag left: `plannedEnd` moves earlier (duration decreases).

On drag end:

```js
const newEnd = addDays(task.plannedEnd, deltaDays);
// Ensure newEnd >= plannedStart
if (new Date(newEnd) < new Date(task.plannedStart)) {
  // clamp to at least same as start, or 1 day duration
}
updateTaskDates(task.id, task.plannedStart, newEnd);
```

### 6.4 Implementation Details

* If using **Frappe Gantt**: leverage built-in drag/resize functionality with callbacks:
  ```js
  const gantt = new Gantt('#gantt', tasks, {
    on_click: (task) => showTaskDetail(task),
    on_date_change: (task, start, end) => updateTaskDates(task.id, start, end),
    on_progress_change: (task, progress) => updateTaskProgress(task.id, progress),
    view_mode: 'Day'
  });
  ```
* If implementing custom: use HTML elements (divs) + absolute positioning, or SVG.
* Each bar must be associated with the task ID (e.g., `data-task-id`).
* Use `pointerdown` / `pointermove` / `pointerup` or traditional mouse events.
* While IME is active for text fields, do not accidentally trigger drag logic.

---

## 7. Side Panel – Task Detail & Progress Update

When a task is selected (from table or Gantt bar), display a side panel (`.card`) with:

* Task name (editable).
* Project, assignee.
* Planned start & end dates (editable; must stay in sync with Gantt changes).
* Status (`.select`).
* Progress controls:

  * Slider from 0–100 (`<input type="range">`).
  * Numeric input for exact %.
* Notes field (`.textarea`).
* Work log entry:

  * Today's date (default).
  * Work description.
  * Hours.
  * Button: "今日の作業ログに追加" (`.button.is-primary`) – creates a `WorkLog` entry.

All changes must update `AppState` and then `saveState`.

---

## 8. Bottom Tabs – Logs & Ad-hoc Tasks

Use Bulma `.tabs` component for tab navigation.

### 8.1 作業ログ (Work Logs)

* Table columns (`.table`):

  * Date
  * Task name
  * Work note
  * Hours
  * Progress % after the work
* Features:

  * Period filter: today / this week / custom date range.
  * Edit / delete existing logs.

### 8.2 一時タスク (Ad-hoc Tasks)

* Table columns:

  * Date
  * Title
  * Detail note
  * Hours
  * Related project (optional).
* Features:

  * Add/edit/delete.
  * Quick-add via the floating `＋一時タスク` button (opens a `.modal`):

    * Date (default to today).
    * Title.
    * Hours.
    * Detail.
    * Save.

---

## 9. Progress Report Generation

Provide a **modal** dialog (`.modal.modal-card`) invoked from the main header button "進捗報告文生成".

### 9.1 Modal Options

* Period selection:

  * Today.
  * This week.
  * Custom date range (from/to).
* Target projects:

  * Multi-select list of projects.
* Option:

  * Include ad-hoc tasks? (checkbox).

### 9.2 Report Content Structure

Implement a pure function to generate the report text:

```js
export function generateReport(appState, options) {
  // options: { from: string, to: string, projectIds?: string[], includeAdhoc?: boolean }
  // returns string
}
```

The resulting text should follow a structure like:

1. **Overview**

   * e.g. "○月○日（〜○月○日）の進捗報告です。"
2. **Completed tasks**

   * List of tasks with `status === 'completed'` and completed within the period.
3. **In-progress tasks**

   * Tasks with `status === 'in_progress'`, including progress % and short description (from recent logs if available).
4. **Delayed / at-risk tasks**

   * Tasks for which `plannedEnd < to` and `progress < 100`. Show reason/notes if available.
5. **Ad-hoc / other tasks** (if `includeAdhoc` is true)

   * Summaries of ad-hoc tasks and their hours.
6. **Plans until next report**

   * Simple forecast based on in-progress tasks (e.g., "タスクXの実装完了〜単体テスト着手") – this can be heuristic/simple.

### 9.3 Modal UI

* Show a large textarea containing the generated report.
* Buttons:

  * Generate / Regenerate (`.button.is-primary`).
  * Copy to clipboard (`.button.is-success`).
  * Close (`.button`).
* Optional: auto-select and auto-copy after generation, with a small toast notification (`.notification`).

---

## 10. Testing Requirements (Jest)

Set up **Jest** for unit testing of the non-DOM logic.

### 10.1 Environment Setup

1. Initialize Node project and install Jest:

```bash
npm init -y
npm install --save-dev jest
```

2. In `package.json`, add:

```json
"scripts": {
  "test": "jest"
}
```

3. If necessary, add a Jest config file so tests can import ES modules or use CommonJS consistently.

### 10.2 Test Targets

Write tests for at least these functions (and any helpers they need):

* `saveState(state)` / `loadState()`
* Date/time helpers:

  * `addDays(dateStr, n)`
  * `getTasksInPeriod(tasks, from, to)`
  * `getDelayedTasks(tasks, today)`
* Report generation:

  * `generateReport(appState, options)`

Place test files under `__tests__/`, e.g.:

* `__tests__/state.test.js`
* `__tests__/dateHelpers.test.js`
* `__tests__/report.test.js`

### 10.3 Example Test Cases

1. **saveState/loadState**

   * Saving an `AppState` then loading it returns an object with the same structure/values.
   * When no data in localStorage, `loadState()` returns `getInitialState()`.

2. **Delayed tasks**

   * For tasks where `plannedEnd < today` and `progress < 100`, `getDelayedTasks()` includes them.
   * Tasks with `plannedEnd === today` or `progress === 100` are not considered delayed.

3. **Period filter**

   * `getTasksInPeriod()` returns tasks whose date ranges intersect the given period.
   * Boundary conditions: tasks starting exactly at `from` or ending exactly at `to` are included.

4. **Report generation**

   * Completed tasks appear in the "completed" section.
   * In-progress tasks appear with their progress %.
   * Delayed tasks appear in the "delayed" section.
   * Ad-hoc tasks appear only when `options.includeAdhoc` is `true`.

Run `npm test` and ensure all tests pass.

---

## 11. Integration with Existing Repo

All of the above requirements must be applied **within** the existing project structure of:

* `https://github.com/suimintoreyo/gantt-chart-report.git`

Instructions:

1. Clone the repo and identify the main entry point and Gantt implementation.
2. Integrate or refactor code to conform to:

   * The data model and persistence layer.
   * Direct manipulation (dragging/resizing) of Gantt task bars.
   * Progress reporting.
3. Keep or improve any existing features, without breaking the current basic behavior. If there are existing data structures that differ, either:

   * Add thin adapters to map them to the `AppState`-style structures above, or
   * Refactor in a way that is localized and well-commented.

---

## 12. Deliverables

Codex should produce and/or update the following:

* Application source code (HTML/CSS/JS) satisfying the functional and UX requirements.
* Gantt chart implementation with direct mouse-based editing:

  * Drag bar to move.
  * Drag left edge to change start.
  * Drag right edge to change end.
  * Underlying dates and durations are updated, saved, and reflected in all views.
* `AppState` persistence via localStorage with `loadState` / `saveState` utilities.
* Progress report generation function and modal.
* Test setup (`package.json`, Jest config) and test files under `__tests__/` that cover:

  * State persistence.
  * Date helper logic.
  * Report generation.
* A short note or comments in code explaining the main modules and how drag logic is implemented.

Once these requirements are met, running the app in a browser and `npm test` in the project root should both succeed without errors.

---

## 13. Pending / Undecided Items

| Item | Status | Notes |
|------|--------|-------|
| Frappe Gantt adoption | **Pending (High Priority)** | Final decision after evaluation |
| Dark mode implementation | Undecided | `bulma-prefers-dark.css` or custom CSS variables |
| Dependency arrows display | Under consideration | Frappe Gantt supports this |
| Mobile/responsive support | Out of scope | Desktop-first, may consider later |
