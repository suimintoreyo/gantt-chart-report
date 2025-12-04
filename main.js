const STORAGE_KEY = 'gantt-app-state-v1';
const AUTO_SAVE_DELAY = 1200;

const DEFAULT_STATE = {
  projects: [
    {
      id: 'project-1',
      name: 'MVP 開発',
      owner: 'チームA',
      startDate: '2024-01-01',
      endDate: '2024-01-21',
      status: 'active',
    },
  ],
  tasks: [
    {
      id: 'task-1',
      projectId: 'project-1',
      name: '要件整理',
      category: '計画',
      assignee: '山田',
      plannedStart: '2023-12-25',
      plannedEnd: '2023-12-30',
      progress: 100,
      status: 'completed',
      priority: 'medium',
      notes: 'ヒアリング完了',
    },
    {
      id: 'task-2',
      projectId: 'project-1',
      name: 'UI モック作成',
      category: '設計',
      assignee: '佐藤',
      plannedStart: '2023-12-31',
      plannedEnd: '2024-01-05',
      progress: 45,
      status: 'in_progress',
      priority: 'high',
      notes: 'トップ画面ドラフト',
    },
    {
      id: 'task-3',
      projectId: 'project-1',
      name: 'ガント描画実装',
      category: '開発',
      assignee: '鈴木',
      plannedStart: '2024-01-06',
      plannedEnd: '2024-01-12',
      progress: 10,
      status: 'not_started',
      priority: 'medium',
      notes: '',
    },
  ],
  workLogs: [
    {
      id: 'log-1',
      taskId: 'task-2',
      date: '2024-01-03',
      workNote: 'プロジェクトセットアップ',
      hours: 2,
      progressAfter: 10,
    },
  ],
  adhocTasks: [
    {
      id: 'adhoc-1',
      date: '2024-01-02',
      title: '問い合わせ対応',
      detail: '顧客からの仕様確認',
      hours: 1,
      relatedProjectId: 'project-1',
    },
  ],
  uiPreferences: {
    ganttZoomLevel: 1,
    theme: 'dark',
  },
};

function createSampleState() {
  return structuredClone(DEFAULT_STATE);
}

function saveState(state, storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState(storage = (typeof localStorage !== 'undefined' ? localStorage : null)) {
  if (storage) {
    const stored = storage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.warn('state parse failed', e);
      }
    }
  }
  return createSampleState();
}

function parseDate(value) {
  return new Date(value + 'T00:00:00');
}

function calculateTaskDelay(task, today) {
  if (!task || task.progress >= 100) return null;
  const todayDate = parseDate(today);
  const plannedEnd = parseDate(task.plannedEnd);
  if (plannedEnd >= todayDate) return null;
  const diff = Math.round((todayDate - plannedEnd) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : null;
}

function getDelayedTasks(tasks, today) {
  return tasks.filter((task) => calculateTaskDelay(task, today));
}

function getTasksInPeriod(tasks, startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  return tasks.filter((task) => {
    const taskStart = parseDate(task.plannedStart);
    const taskEnd = parseDate(task.plannedEnd);
    return taskEnd >= start && taskStart <= end;
  });
}

function generateReport(appState, options) {
  const { from, to, projectIds, includeAdhoc = false } = options;
  const targetProjects = projectIds && projectIds.length ? projectIds : appState.projects.map((p) => p.id);
  const tasks = appState.tasks.filter((t) => targetProjects.includes(t.projectId));
  const completed = tasks.filter((t) => t.progress >= 100 && t.plannedEnd >= from && t.plannedEnd <= to);
  const progressing = tasks.filter((t) => t.progress < 100 && t.progress > 0 && t.plannedStart <= to && t.plannedEnd >= from);
  const delayed = getDelayedTasks(tasks, to);
  const adhoc = includeAdhoc
    ? appState.adhocTasks.filter((a) => a.date >= from && a.date <= to && (!projectIds || projectIds.includes(a.relatedProjectId || '')))
    : [];

  const completedSection = completed.length ? completed.map((t) => `- ${t.name}`).join('\n') : 'なし';
  const progressingSection = progressing.length
    ? progressing.map((t) => `- ${t.name} (${t.progress}%)`).join('\n')
    : 'なし';
  const delayedSection = delayed.length
    ? delayed.map((t) => `- ${t.name} (予定 ${t.plannedEnd})`).join('\n')
    : 'なし';
  const adhocSection = adhoc.length ? adhoc.map((a) => `- ${a.title} (${a.hours || '?'}h)`).join('\n') : '';

  return [
    `【期間】${from} 〜 ${to}`,
    `【進捗サマリー】完了 ${completed.length} / 進行中 ${progressing.length} / 遅延 ${delayed.length}`,
    `【完了タスク】\n${completedSection}`,
    `【進行中】\n${progressingSection}`,
    `【遅延懸念】\n${delayedSection}`,
    includeAdhoc ? `【一時タスク】\n${adhocSection || 'なし'}` : null,
    '次回までの予定：進行中タスクを優先し、依存関係に留意して進めます。',
  ]
    .filter(Boolean)
    .join('\n');
}

// --- 以下、ブラウザ向け UI ロジック ---
/** @type {AppState} */
let appState;
let activeProjectId = '';
let selectedTaskId = '';
let viewRange = 'day';
let autoSaveTimer;
let undoStack = [];
let redoStack = [];
let currentSort = { key: 'plannedStart', dir: 'asc' };

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
function dateDiff(start, end) {
  return Math.round((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));
}
function clamp(num, min, max) { return Math.min(Math.max(num, min), max); }

/**
 * タスクの開始・終了をまとめて日数シフトする
 * @param {Task} task
 * @param {number} deltaDays
 */
function shiftTaskDates(task, deltaDays) {
  return {
    ...task,
    plannedStart: formatDate(addDays(task.plannedStart, deltaDays)),
    plannedEnd: formatDate(addDays(task.plannedEnd, deltaDays)),
  };
}

/**
 * タスクの開始日のみをリサイズする（終了日を超えないようにする）
 * @param {Task} task
 * @param {number} deltaDays
 */
function resizeTaskStart(task, deltaDays) {
  const candidate = formatDate(addDays(task.plannedStart, deltaDays));
  const safeStart = parseDate(candidate) > parseDate(task.plannedEnd) ? task.plannedEnd : candidate;
  return { ...task, plannedStart: safeStart };
}

/**
 * タスクの終了日のみをリサイズする（開始日を下回らないようにする）
 * @param {Task} task
 * @param {number} deltaDays
 */
function resizeTaskEnd(task, deltaDays) {
  const candidate = formatDate(addDays(task.plannedEnd, deltaDays));
  const safeEnd = parseDate(candidate) < parseDate(task.plannedStart) ? task.plannedStart : candidate;
  return { ...task, plannedEnd: safeEnd };
}

function updateSaveStatus(text) {
  const el = document.getElementById('saveStatus');
  if (el) el.textContent = text;
}

function pushUndo() {
  undoStack.push(structuredClone(appState));
  if (undoStack.length > 25) undoStack.shift();
  redoStack = [];
}

function applyState(newState) {
  appState = newState;
  renderAll();
  scheduleSave();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(structuredClone(appState));
  appState = undoStack.pop();
  renderAll();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(structuredClone(appState));
  appState = redoStack.pop();
  renderAll();
}

function scheduleSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => saveState(appState), AUTO_SAVE_DELAY);
  updateSaveStatus('保存待機中...');
}

function renderAll() {
  renderProjectOptions();
  renderTaskTable();
  renderGantt();
  renderSidePanel();
  renderTabs();
  renderSummary();
  const zoomInput = document.getElementById('ganttZoom');
  if (zoomInput) zoomInput.value = appState.uiPreferences.ganttZoomLevel || 1;
}

function renderProjectOptions() {
  const select = document.getElementById('projectSelect');
  if (!select) return;
  select.innerHTML = '';
  appState.projects.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
  if (!activeProjectId && appState.projects.length) {
    activeProjectId = appState.projects[0].id;
  }
  select.value = activeProjectId;
  renderReportProjectOptions();
}

function renderSummary() {
  const today = formatDate(new Date());
  const tasks = appState.tasks.filter((t) => t.projectId === activeProjectId);
  const todayTasks = tasks.filter((t) => t.status !== 'completed' && t.plannedStart <= today && t.plannedEnd >= today);
  const delayed = tasks.filter((t) => t.status !== 'completed' && t.plannedEnd < today);
  const summaryEl = document.getElementById('summary');
  if (!summaryEl) return;
  summaryEl.innerHTML = `
    <div class="tooltip">今日やるタスク: <strong>${todayTasks.length}</strong></div>
    <div class="tooltip">遅延: <strong>${delayed.length}</strong></div>
  `;
}

function renderTaskTable() {
  const container = document.getElementById('taskTable');
  if (!container) return;
  container.innerHTML = '';
  const header = document.createElement('div');
  header.className = 'task-header';
  const cols = ['タスク名', '担当', 'カテゴリ', '計画開始', '計画終了', '優先度', ''];
  cols.forEach((c, idx) => {
    const cell = document.createElement('div');
    cell.textContent = c;
    if (idx <= 5) {
      cell.style.cursor = 'pointer';
      cell.addEventListener('click', () => changeSort(idx));
    }
    header.appendChild(cell);
  });
  container.appendChild(header);

  const showCompleted = document.getElementById('showCompleted')?.checked;
  const search = (document.getElementById('taskSearch')?.value || '').toLowerCase();
  const tasks = appState.tasks
    .filter((t) => t.projectId === activeProjectId)
    .filter((t) => showCompleted || t.status !== 'completed')
    .filter((t) => t.name.toLowerCase().includes(search))
    .sort((a, b) => compareTask(a, b));

  tasks.forEach((task) => {
    const row = document.createElement('div');
    row.className = 'task-row';
    if (task.id === selectedTaskId) row.classList.add('selected');

    row.appendChild(inputCell(task, 'name'));
    row.appendChild(inputCell(task, 'assignee'));
    row.appendChild(inputCell(task, 'category'));
    row.appendChild(dateCell(task, 'plannedStart'));
    row.appendChild(dateCell(task, 'plannedEnd'));
    row.appendChild(selectCell(task, 'priority', [
      { value: 'high', label: '高' },
      { value: 'medium', label: '中' },
      { value: 'low', label: '低' },
    ]));

    const actions = document.createElement('div');
    const status = document.createElement('div');
    status.className = `status-badge status-${task.status}`;
    status.textContent = statusLabel(task.status);
    actions.appendChild(status);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '🗑';
    deleteBtn.className = 'ghost';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTask(task.id);
    });
    actions.appendChild(deleteBtn);
    row.appendChild(actions);

    row.addEventListener('click', () => {
      selectedTaskId = task.id;
      renderSidePanel();
      highlightSelection(task.id);
    });

    container.appendChild(row);
  });
}

function compareTask(a, b) {
  const key = ['name', 'assignee', 'category', 'plannedStart', 'plannedEnd', 'priority'][currentSort.keyIndex || 3];
  const dir = currentSort.dir === 'asc' ? 1 : -1;
  return a[key] > b[key] ? dir : a[key] < b[key] ? -dir : 0;
}

function changeSort(idx) {
  if (currentSort.keyIndex === idx) {
    currentSort.dir = currentSort.dir === 'asc' ? 'desc' : 'asc';
  } else {
    currentSort = { keyIndex: idx, dir: 'asc' };
  }
  renderTaskTable();
}

function inputCell(task, key) {
  const wrap = document.createElement('div');
  const input = document.createElement('input');
  input.value = task[key] || '';
  input.addEventListener('change', () => updateTask(task.id, key, input.value));
  wrap.appendChild(input);
  return wrap;
}

function dateCell(task, key) {
  const wrap = document.createElement('div');
  const input = document.createElement('input');
  input.type = 'date';
  input.value = task[key];
  input.addEventListener('change', () => updateTask(task.id, key, input.value));
  wrap.appendChild(input);
  return wrap;
}

function selectCell(task, key, options) {
  const wrap = document.createElement('div');
  const select = document.createElement('select');
  options.forEach((opt) => {
    const o = document.createElement('option');
    o.value = opt.value; o.textContent = opt.label;
    select.appendChild(o);
  });
  select.value = task[key] || 'medium';
  select.addEventListener('change', () => updateTask(task.id, key, select.value));
  wrap.appendChild(select);
  return wrap;
}

function statusLabel(status) {
  return { not_started: '未着手', in_progress: '進行中', completed: '完了', on_hold: '保留' }[status];
}

function updateTask(id, key, value) {
  pushUndo();
  const task = appState.tasks.find((t) => t.id === id);
  if (!task) return;
  task[key] = value;
  if (key === 'progress') task.status = value >= 100 ? 'completed' : task.status;
  renderAll();
  scheduleSave();
}

function deleteTask(id) {
  pushUndo();
  appState.tasks = appState.tasks.filter((t) => t.id !== id);
  if (selectedTaskId === id) selectedTaskId = '';
  renderAll();
  scheduleSave();
}

function addTask() {
  if (!activeProjectId) return;
  pushUndo();
  const today = formatDate(new Date());
  const newTask = {
    id: crypto.randomUUID(),
    projectId: activeProjectId,
    name: '新規タスク',
    category: '',
    assignee: '',
    plannedStart: today,
    plannedEnd: today,
    progress: 0,
    status: 'not_started',
    priority: 'medium',
    notes: '',
  };
  appState.tasks.push(newTask);
  selectedTaskId = newTask.id;
  renderAll();
  scheduleSave();
}

function renderGantt() {
  const header = document.getElementById('ganttHeader');
  const body = document.getElementById('ganttBody');
  if (!header || !body) return;
  header.innerHTML = '';
  body.innerHTML = '';
  const zoom = parseFloat(document.getElementById('ganttZoom')?.value || 1);
  appState.uiPreferences.ganttZoomLevel = zoom;

  const { startDate, endDate } = getRange();
  const days = dateDiff(startDate, endDate) + 1;
  header.style.gridTemplateColumns = `repeat(${days}, minmax(${60 * zoom}px, 1fr))`;
  for (let i = 0; i < days; i++) {
    const d = addDays(startDate, i);
    const cell = document.createElement('div');
    cell.textContent = formatDate(d).slice(5);
    header.appendChild(cell);
  }

  const dayWidth = (header.getBoundingClientRect().width || header.clientWidth || 1) / days || 1;
  const tasks = appState.tasks.filter((t) => t.projectId === activeProjectId);
  tasks.forEach((task) => {
    const row = document.createElement('div');
    row.className = 'gantt-row';
    const bar = document.createElement('div');
    bar.className = 'gantt-bar';
    bar.dataset.taskId = task.id;

    const leftHandle = document.createElement('div');
    leftHandle.className = 'gantt-handle left';
    leftHandle.dataset.side = 'start';
    const rightHandle = document.createElement('div');
    rightHandle.className = 'gantt-handle right';
    rightHandle.dataset.side = 'end';
    const label = document.createElement('span');
    label.className = 'gantt-bar-label';
    label.textContent = task.name;

    bar.appendChild(leftHandle);
    bar.appendChild(label);
    bar.appendChild(rightHandle);

    updateBarPosition(bar, startDate, days, task.plannedStart, task.plannedEnd);
    bar.style.opacity = task.status === 'completed' ? 0.6 : 1;
    bar.addEventListener('click', () => {
      selectedTaskId = task.id;
      renderSidePanel();
      highlightSelection(task.id);
    });

    attachBarDrag(bar, task, { startDate, totalDays: days, dayWidth });
    row.appendChild(bar);
    body.appendChild(row);
  });

  const todayLine = document.getElementById('todayLine');
  if (!todayLine) return;
  const todayIdx = dateDiff(startDate, formatDate(new Date()));
  if (todayIdx >= 0 && todayIdx <= days) {
    todayLine.style.display = 'block';
    todayLine.style.left = `${(todayIdx / days) * 100}%`;
  } else {
    todayLine.style.display = 'none';
  }
}

function calculateBarPlacement(rangeStart, totalDays, taskStart, taskEnd) {
  const startIdx = dateDiff(rangeStart, taskStart);
  const endIdx = dateDiff(rangeStart, taskEnd) + 1;
  const clampedStart = clamp(startIdx, 0, totalDays);
  const clampedEnd = clamp(endIdx, 0, totalDays);
  const widthDays = Math.max(clampedEnd - clampedStart, 0);
  return {
    left: (clampedStart / totalDays) * 100,
    width: (widthDays / totalDays) * 100,
  };
}

/**
 * ドラッグ操作で適用する開始日・終了日のドラフト値を算出する
 * @param {Task} task
 * @param {number} deltaDays
 * @param {'move' | 'start' | 'end'} dragMode
 */
function resolveDragDates(task, deltaDays, dragMode) {
  if (dragMode === 'move') {
    const shifted = shiftTaskDates(task, deltaDays);
    return { start: shifted.plannedStart, end: shifted.plannedEnd };
  }

  if (dragMode === 'start') {
    const candidate = formatDate(addDays(task.plannedStart, deltaDays));
    const safeStart = parseDate(candidate) > parseDate(task.plannedEnd) ? task.plannedEnd : candidate;
    return { start: safeStart, end: task.plannedEnd };
  }

  if (dragMode === 'end') {
    const candidate = formatDate(addDays(task.plannedEnd, deltaDays));
    const safeEnd = parseDate(candidate) < parseDate(task.plannedStart) ? task.plannedStart : candidate;
    return { start: task.plannedStart, end: safeEnd };
  }

  return { start: task.plannedStart, end: task.plannedEnd };
}

function updateBarPosition(bar, rangeStart, totalDays, taskStart, taskEnd) {
  const placement = calculateBarPlacement(rangeStart, totalDays, taskStart, taskEnd);
  bar.style.left = `${placement.left}%`;
  bar.style.width = `${placement.width}%`;
}

/**
 * ガントバーのドラッグ＆リサイズを司るイベントバインド
 */
function attachBarDrag(bar, task, timeline) {
  let startX = 0;
  let dragMode = 'move';
  let pointerId;
  let currentStart = parseDate(task.plannedStart);
  let currentEnd = parseDate(task.plannedEnd);
  let hasMoved = false;

  const applyDraftPosition = () => {
    updateBarPosition(bar, timeline.startDate, timeline.totalDays, formatDate(currentStart), formatDate(currentEnd));
  };

  const onPointerMove = (e) => {
    if (pointerId !== e.pointerId) return;
    const deltaDays = Math.round((e.clientX - startX) / (timeline.dayWidth || 1));
    if (deltaDays === 0 && !hasMoved) return;
    hasMoved = hasMoved || deltaDays !== 0;

    const draft = resolveDragDates(task, deltaDays, dragMode);
    currentStart = parseDate(draft.start);
    currentEnd = parseDate(draft.end);
    applyDraftPosition();
  };

  const onPointerUp = (e) => {
    if (pointerId !== e.pointerId) return;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    if (bar.hasPointerCapture(pointerId)) bar.releasePointerCapture(pointerId);
    bar.classList.remove('dragging');
    if (!hasMoved) {
      highlightSelection(task.id);
      return;
    }
    commitTaskDateChange(task.id, formatDate(currentStart), formatDate(currentEnd));
  };

  bar.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.gantt-handle');
    dragMode = handle ? (handle.dataset.side === 'start' ? 'start' : 'end') : 'move';
    startX = e.clientX;
    pointerId = e.pointerId;
    currentStart = parseDate(task.plannedStart);
    currentEnd = parseDate(task.plannedEnd);
    hasMoved = false;
    bar.setPointerCapture(pointerId);
    bar.classList.add('dragging');
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    selectedTaskId = task.id;
    renderSidePanel();
    e.preventDefault();
  });
}

function getRange() {
  const now = new Date();
  if (viewRange === 'day') {
    return { startDate: formatDate(now), endDate: formatDate(now) };
  }
  if (viewRange === 'week') {
    const day = now.getDay();
    const start = addDays(now, -day);
    const end = addDays(start, 6);
    return { startDate: formatDate(start), endDate: formatDate(end) };
  }
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { startDate: formatDate(start), endDate: formatDate(end) };
}

function highlightSelection(taskId) {
  selectedTaskId = taskId;
  renderTaskTable();
  renderGantt();
}

function commitTaskDateChange(taskId, startDate, endDate) {
  const task = appState.tasks.find((t) => t.id === taskId);
  if (!task) return;
  if (task.plannedStart === startDate && task.plannedEnd === endDate) return;
  pushUndo();
  task.plannedStart = startDate;
  task.plannedEnd = endDate;
  selectedTaskId = taskId;
  renderAll();
  scheduleSave();
}

function renderSidePanel() {
  const container = document.getElementById('sideContent');
  if (!container) return;
  container.innerHTML = '';
  const task = appState.tasks.find((t) => t.id === selectedTaskId);
  if (!task) {
    container.innerHTML = '<p class="tooltip">タスクを選択すると詳細が表示されます</p>';
    return;
  }
  const fields = [
    ['名前', 'name', 'text'],
    ['担当', 'assignee', 'text'],
    ['カテゴリ', 'category', 'text'],
  ];
  fields.forEach(([label, key, type]) => {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const l = document.createElement('label');
    l.textContent = label;
    const input = document.createElement('input');
    input.type = type;
    input.value = task[key] || '';
    input.addEventListener('change', () => updateTask(task.id, key, input.value));
    wrap.appendChild(l); wrap.appendChild(input); container.appendChild(wrap);
  });

  const progressField = document.createElement('div');
  progressField.className = 'field';
  const pLabel = document.createElement('label'); pLabel.textContent = '進捗';
  const range = document.createElement('input'); range.type = 'range'; range.min = 0; range.max = 100; range.step = 5; range.value = task.progress;
  const val = document.createElement('div'); val.textContent = `${task.progress}%`;
  range.addEventListener('input', () => { val.textContent = `${range.value}%`; });
  range.addEventListener('change', () => updateTask(task.id, 'progress', Number(range.value)));
  progressField.appendChild(pLabel); progressField.appendChild(range); progressField.appendChild(val);
  container.appendChild(progressField);

  const statusField = document.createElement('div');
  statusField.className = 'field';
  const sLabel = document.createElement('label'); sLabel.textContent = '状態';
  const select = document.createElement('select');
  ['not_started','in_progress','completed','on_hold'].forEach((s) => {
    const o = document.createElement('option'); o.value = s; o.textContent = statusLabel(s); select.appendChild(o);
  });
  select.value = task.status;
  select.addEventListener('change', () => updateTask(task.id, 'status', select.value));
  statusField.appendChild(sLabel); statusField.appendChild(select);
  container.appendChild(statusField);

  const noteField = document.createElement('div'); noteField.className = 'field';
  const nLabel = document.createElement('label'); nLabel.textContent = 'メモ';
  const textarea = document.createElement('textarea'); textarea.value = task.notes || '';
  textarea.addEventListener('change', () => updateTask(task.id, 'notes', textarea.value));
  noteField.appendChild(nLabel); noteField.appendChild(textarea);
  container.appendChild(noteField);

  const logField = document.createElement('div'); logField.className = 'field';
  logField.innerHTML = '<label>作業ログ</label>';
  const logInput = document.createElement('input'); logInput.type = 'text'; logInput.placeholder = '内容';
  const logHours = document.createElement('input'); logHours.type = 'number'; logHours.min = 0; logHours.step = 0.5; logHours.placeholder = 'h';
  const logBtn = document.createElement('button'); logBtn.textContent = '追加';
  logBtn.addEventListener('click', () => addWorkLog(task.id, logInput.value, Number(logHours.value || 0)));
  logField.appendChild(logInput); logField.appendChild(logHours); logField.appendChild(logBtn);
  container.appendChild(logField);
}

function renderTabs() {
  renderWorkLogs();
  renderAdhoc();
}

function renderWorkLogs() {
  const tab = document.getElementById('workLogTab');
  if (!tab) return;
  const logs = appState.workLogs.filter((w) => {
    if (!activeProjectId) return true;
    const task = appState.tasks.find((t) => t.id === w.taskId);
    return !task || task.projectId === activeProjectId;
  });
  const rows = logs.map((log) => {
    const task = appState.tasks.find((t) => t.id === log.taskId);
    return `
      <tr>
        <td>${log.date}</td>
        <td>${task ? task.name : '―'}</td>
        <td>${log.workNote}</td>
        <td>${log.hours || '-'}h</td>
        <td>${log.progressAfter || '-'}</td>
      </tr>
    `;
  }).join('');
  tab.innerHTML = `
    <table class="table">
      <thead><tr><th>日付</th><th>タスク</th><th>内容</th><th>時間</th><th>進捗</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5">ログなし</td></tr>'}</tbody>
    </table>
  `;
}

function renderAdhoc() {
  const tab = document.getElementById('adhocTab');
  if (!tab) return;
  const rows = appState.adhocTasks
    .filter((a) => !activeProjectId || a.relatedProjectId === activeProjectId)
    .map((a) => `
      <tr>
        <td>${a.date}</td>
        <td>${a.title}</td>
        <td>${a.detail || '-'}</td>
        <td>${a.hours || '-'}h</td>
      </tr>
    `).join('');
  tab.innerHTML = `
    <table class="table">
      <thead><tr><th>日付</th><th>内容</th><th>詳細</th><th>時間</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="4">なし</td></tr>'}</tbody>
    </table>
  `;
}

function addWorkLog(taskId, note, hours) {
  pushUndo();
  const log = {
    id: crypto.randomUUID(),
    taskId,
    date: formatDate(new Date()),
    workNote: note,
    hours,
    progressAfter: appState.tasks.find((t) => t.id === taskId)?.progress || 0,
  };
  appState.workLogs.push(log);
  renderTabs();
  scheduleSave();
}

function addAdhoc() {
  pushUndo();
  const newAdhoc = {
    id: crypto.randomUUID(),
    date: formatDate(new Date()),
    title: '一時タスク',
    detail: '',
    hours: 1,
    relatedProjectId: activeProjectId,
  };
  appState.adhocTasks.push(newAdhoc);
  renderAdhoc();
  scheduleSave();
}

function renderReportProjectOptions() {
  const select = document.getElementById('reportProject');
  if (!select) return;
  select.innerHTML = '<option value="all">すべて</option>';
  appState.projects.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
}

function handleReportGenerate() {
  const start = document.getElementById('reportStart').value;
  const end = document.getElementById('reportEnd').value;
  const project = document.getElementById('reportProject').value;
  const includeAdhoc = document.getElementById('reportIncludeAdhoc').checked;
  const options = { from: start, to: end, includeAdhoc };
  if (project !== 'all') options.projectIds = [project];
  const text = generateReport(appState, options);
  const textarea = document.getElementById('reportText');
  textarea.value = text.trim();
  textarea.focus();
  textarea.select();
  navigator.clipboard?.writeText(textarea.value).then(() => showToast('報告文をコピーしました'));
}

function openReportModal() {
  const modal = document.getElementById('reportModal');
  modal.classList.remove('hidden');
  const now = new Date();
  document.getElementById('reportStart').value = formatDate(addDays(now, -7));
  document.getElementById('reportEnd').value = formatDate(now);
  document.getElementById('reportProject').value = activeProjectId || 'all';
}

function closeReportModal() { document.getElementById('reportModal').classList.add('hidden'); }

function showToast(text) {
  const toast = document.getElementById('toast');
  toast.textContent = text;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

function setupShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      saveState(appState);
      showToast('保存しました');
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      document.getElementById('taskSearch').focus();
    }
    if (e.key.toLowerCase() === 'n' && !e.ctrlKey) {
      addTask();
    }
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
    const reportOpen = !document.getElementById('reportModal').classList.contains('hidden');
    if (reportOpen && e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleReportGenerate();
    }
  });
}

function bindEvents() {
  document.getElementById('projectSelect').addEventListener('change', (e) => {
    activeProjectId = e.target.value;
    selectedTaskId = '';
    renderAll();
  });
  document.getElementById('rangeToggle').querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      viewRange = btn.dataset.range;
      document.querySelectorAll('#rangeToggle button').forEach((b) => b.classList.toggle('active', b === btn));
      renderGantt();
    });
  });
  document.getElementById('newTaskBtn').addEventListener('click', addTask);
  document.getElementById('taskSearch').addEventListener('input', renderTaskTable);
  document.getElementById('showCompleted').addEventListener('change', renderTaskTable);
  document.getElementById('ganttZoom').addEventListener('input', renderGantt);
  document.getElementById('closeSidePanel').addEventListener('click', () => { selectedTaskId = ''; renderSidePanel(); highlightSelection(''); });
  document.getElementById('adhocFloat').addEventListener('click', addAdhoc);
  document.getElementById('reportBtn').addEventListener('click', () => { openReportModal(); handleReportGenerate(); });
  document.getElementById('closeReport').addEventListener('click', closeReportModal);
  document.getElementById('generateReport').addEventListener('click', handleReportGenerate);
  document.getElementById('selectReport').addEventListener('click', () => { const ta = document.getElementById('reportText'); ta.focus(); ta.select(); });
  document.getElementById('copyReport').addEventListener('click', () => { const ta = document.getElementById('reportText'); ta.select(); document.execCommand('copy'); showToast('コピーしました'); });
  document.getElementById('manualSaveBtn').addEventListener('click', () => { saveState(appState); showToast('保存しました'); });
  document.getElementById('addProjectBtn').addEventListener('click', () => openProjectModal('add'));
  document.getElementById('editProjectBtn').addEventListener('click', () => openProjectModal('edit'));
  document.getElementById('deleteProjectBtn').addEventListener('click', deleteProject);
  document.getElementById('projectModalCancel').addEventListener('click', closeProjectModal);
  document.getElementById('projectModalSave').addEventListener('click', saveProjectFromModal);
  document.querySelectorAll('.tab-buttons button').forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
}

function switchTab(tab) {
  document.querySelectorAll('.tab-buttons button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('workLogTab').classList.toggle('hidden', tab !== 'work');
  document.getElementById('adhocTab').classList.toggle('hidden', tab !== 'adhoc');
}

function openProjectModal(mode) {
  const modal = document.getElementById('projectModal');
  modal.classList.remove('hidden');
  modal.dataset.mode = mode;
  if (mode === 'edit') {
    const project = appState.projects.find((p) => p.id === activeProjectId);
    document.getElementById('projectNameInput').value = project?.name || '';
    document.getElementById('projectStartInput').value = project?.startDate || '';
    document.getElementById('projectEndInput').value = project?.endDate || '';
    document.getElementById('projectStatusInput').value = project?.status || 'planned';
  } else {
    document.getElementById('projectNameInput').value = '';
    document.getElementById('projectStartInput').value = '';
    document.getElementById('projectEndInput').value = '';
    document.getElementById('projectStatusInput').value = 'planned';
  }
}

function closeProjectModal() {
  document.getElementById('projectModal').classList.add('hidden');
}

function saveProjectFromModal() {
  const mode = document.getElementById('projectModal').dataset.mode;
  const name = document.getElementById('projectNameInput').value || '新規プロジェクト';
  const startDate = document.getElementById('projectStartInput').value || formatDate(new Date());
  const endDate = document.getElementById('projectEndInput').value || formatDate(addDays(new Date(), 7));
  const status = document.getElementById('projectStatusInput').value;
  if (mode === 'edit') {
    const project = appState.projects.find((p) => p.id === activeProjectId);
    if (project) {
      project.name = name;
      project.startDate = startDate;
      project.endDate = endDate;
      project.status = status;
    }
  } else {
    const newProject = { id: crypto.randomUUID(), name, startDate, endDate, status };
    appState.projects.push(newProject);
    activeProjectId = newProject.id;
  }
  renderAll();
  scheduleSave();
  closeProjectModal();
}

function deleteProject() {
  if (!activeProjectId) return;
  pushUndo();
  appState.projects = appState.projects.filter((p) => p.id !== activeProjectId);
  appState.tasks = appState.tasks.filter((t) => t.projectId !== activeProjectId);
  activeProjectId = appState.projects[0]?.id || '';
  renderAll();
  scheduleSave();
}

function init() {
  appState = loadState();
  activeProjectId = appState.projects[0]?.id || '';
  renderAll();
  bindEvents();
  setupShortcuts();
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', init);
}

if (typeof module !== 'undefined') {
  module.exports = {
    STORAGE_KEY,
    DEFAULT_STATE,
    createSampleState,
    saveState,
    loadState,
    calculateTaskDelay,
    getDelayedTasks,
    getTasksInPeriod,
    generateReport,
    shiftTaskDates,
    resizeTaskStart,
    resizeTaskEnd,
    resolveDragDates,
  };
}

// --- 型定義参考） ---
/**
 * @typedef {'planned' | 'active' | 'completed' | 'on_hold'} ProjectStatus
 * @typedef {{ id: string; name: string; owner?: string; startDate: string; endDate: string; status: ProjectStatus; }} Project
 * @typedef {'not_started' | 'in_progress' | 'completed' | 'on_hold'} TaskStatus
 * @typedef {'high' | 'medium' | 'low'} TaskPriority
 * @typedef {{ id: string; projectId: string; name: string; category?: string; assignee?: string; plannedStart: string; plannedEnd: string; progress: number; status: TaskStatus; priority?: TaskPriority; dependsOn?: string[]; notes?: string; }} Task
 * @typedef {{ id: string; taskId: string; date: string; workNote: string; hours?: number; progressAfter?: number; }} WorkLog
 * @typedef {{ id: string; date: string; title: string; detail?: string; hours?: number; relatedProjectId?: string; }} AdhocTask
 * @typedef {{ projects: Project[]; tasks: Task[]; workLogs: WorkLog[]; adhocTasks: AdhocTask[]; uiPreferences: { taskTableColumnWidths?: Record<string, number>; ganttZoomLevel?: number; theme?: 'dark' | 'light'; }; }} AppState
 */
