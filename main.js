const STORAGE_KEY = 'gantt-app-state-v1';
const AUTO_SAVE_DELAY = 1200;

/** @type {AppState} */
let appState;
let activeProjectId = '';
let selectedTaskId = '';
let viewRange = 'day';
let autoSaveTimer;
let undoStack = [];
let redoStack = [];
let currentSort = { key: 'plannedStart', dir: 'asc' };

// --- 初期データ ---
function createSampleState() {
  const today = new Date();
  const format = (d) => d.toISOString().slice(0, 10);
  const projectId = crypto.randomUUID();
  return {
    projects: [{
      id: projectId,
      name: 'MVP 開発',
      owner: 'チームA',
      startDate: format(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)),
      endDate: format(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 21)),
      status: 'active',
    }],
    tasks: [
      {
        id: crypto.randomUUID(),
        projectId,
        name: '要件整理',
        category: '計画',
        assignee: '山田',
        plannedStart: format(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7)),
        plannedEnd: format(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2)),
        progress: 100,
        status: 'completed',
        priority: 'medium',
        notes: 'ヒアリング完了',
      },
      {
        id: crypto.randomUUID(),
        projectId,
        name: 'UI モック作成',
        category: '設計',
        assignee: '佐藤',
        plannedStart: format(new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2)),
        plannedEnd: format(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3)),
        progress: 45,
        status: 'in_progress',
        priority: 'high',
        notes: 'トップ画面ドラフト',
      },
      {
        id: crypto.randomUUID(),
        projectId,
        name: 'ガント描画実装',
        category: '開発',
        assignee: '鈴木',
        plannedStart: format(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)),
        plannedEnd: format(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7)),
        progress: 10,
        status: 'not_started',
        priority: 'medium',
        notes: '',
      },
    ],
    workLogs: [
      {
        id: crypto.randomUUID(),
        taskId: '',
        date: format(today),
        workNote: 'プロジェクトセットアップ',
        hours: 2,
        progressAfter: 10,
      },
    ],
    adhocTasks: [
      {
        id: crypto.randomUUID(),
        date: format(today),
        title: '問い合わせ対応',
        detail: '顧客からの仕様確認',
        hours: 1,
        relatedProjectId: projectId,
      },
    ],
    uiPreferences: {
      ganttZoomLevel: 1,
      theme: 'dark',
    },
  };
}

function loadState() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch (e) {
      console.warn('state parse failed', e);
    }
  }
  return createSampleState();
}

function saveState(manual = false) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  updateSaveStatus(manual ? '手動保存しました' : '保存しました');
}

function scheduleSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => saveState(false), AUTO_SAVE_DELAY);
  updateSaveStatus('保存待機中...');
}

function updateSaveStatus(text) {
  const el = document.getElementById('saveStatus');
  el.textContent = text;
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

// --- ユーティリティ ---
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

// --- レンダリング ---
function renderAll() {
  renderProjectOptions();
  renderTaskTable();
  renderGantt();
  renderSidePanel();
  renderTabs();
  renderSummary();
  document.getElementById('ganttZoom').value = appState.uiPreferences.ganttZoomLevel || 1;
}

function renderProjectOptions() {
  const select = document.getElementById('projectSelect');
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
  summaryEl.innerHTML = `
    <div class="tooltip">今日やるタスク: <strong>${todayTasks.length}</strong></div>
    <div class="tooltip">遅延: <strong>${delayed.length}</strong></div>
  `;
}

function renderTaskTable() {
  const container = document.getElementById('taskTable');
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

  const showCompleted = document.getElementById('showCompleted').checked;
  const search = document.getElementById('taskSearch').value.toLowerCase();
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
  header.innerHTML = '';
  body.innerHTML = '';
  const zoom = parseFloat(document.getElementById('ganttZoom').value || 1);
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

  const tasks = appState.tasks.filter((t) => t.projectId === activeProjectId);
  tasks.forEach((task) => {
    const row = document.createElement('div');
    row.className = 'gantt-row';
    const bar = document.createElement('div');
    bar.className = 'gantt-bar';
    bar.textContent = task.name;
    const startIdx = Math.max(0, dateDiff(startDate, task.plannedStart));
    const endIdx = Math.min(days, dateDiff(startDate, task.plannedEnd) + 1);
    const left = (startIdx / days) * 100;
    const width = ((endIdx - startIdx) / days) * 100;
    bar.style.left = `${left}%`;
    bar.style.width = `${width}%`;
    bar.style.opacity = task.status === 'completed' ? 0.6 : 1;
    bar.addEventListener('click', () => {
      selectedTaskId = task.id;
      renderSidePanel();
      highlightSelection(task.id);
    });
    row.appendChild(bar);
    body.appendChild(row);
  });

  const todayLine = document.getElementById('todayLine');
  const todayIdx = dateDiff(startDate, formatDate(new Date()));
  if (todayIdx >= 0 && todayIdx <= days) {
    todayLine.style.display = 'block';
    todayLine.style.left = `${(todayIdx / days) * 100}%`;
  } else {
    todayLine.style.display = 'none';
  }
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

function renderSidePanel() {
  const container = document.getElementById('sideContent');
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
      <thead><tr><th>日付</th><th>タスク</th><th>内容</th><th>時間</th><th>進捗%</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="tooltip">ログなし</td></tr>'}</tbody>
    </table>`;
}

function renderAdhoc() {
  const tab = document.getElementById('adhocTab');
  const rows = appState.adhocTasks.map((a) => `
    <tr>
      <td>${a.date}</td>
      <td>${a.title}</td>
      <td>${a.detail || ''}</td>
      <td>${a.hours || '-'}h</td>
      <td><button class="ghost" data-id="${a.id}">🗑</button></td>
    </tr>
  `).join('');
  tab.innerHTML = `
    <table class="table">
      <thead><tr><th>日付</th><th>タイトル</th><th>詳細</th><th>時間</th><th></th></tr></thead>
      <tbody>${rows || '<tr><td colspan="5" class="tooltip">一時タスクなし</td></tr>'}</tbody>
    </table>`;
  tab.querySelectorAll('button[data-id]').forEach((btn) => btn.addEventListener('click', () => deleteAdhoc(btn.dataset.id)));
}

function addWorkLog(taskId, note, hours) {
  if (!note) return showToast('ログ内容を入力してください');
  pushUndo();
  appState.workLogs.unshift({
    id: crypto.randomUUID(),
    taskId,
    date: formatDate(new Date()),
    workNote: note,
    hours,
    progressAfter: appState.tasks.find((t) => t.id === taskId)?.progress || undefined,
  });
  renderTabs();
  scheduleSave();
  showToast('作業ログを追加しました');
}

function addAdhoc() {
  pushUndo();
  const date = formatDate(new Date());
  const title = prompt('一時タスク名');
  if (!title) return;
  appState.adhocTasks.unshift({
    id: crypto.randomUUID(),
    date,
    title,
    detail: '',
    hours: 1,
    relatedProjectId: activeProjectId,
  });
  renderTabs();
  scheduleSave();
}

function deleteAdhoc(id) {
  pushUndo();
  appState.adhocTasks = appState.adhocTasks.filter((a) => a.id !== id);
  renderTabs();
  scheduleSave();
}

// --- プロジェクト ---
function openProjectModal(mode) {
  const modal = document.getElementById('projectModal');
  modal.classList.remove('hidden');
  const title = document.getElementById('projectModalTitle');
  title.textContent = mode === 'add' ? 'プロジェクト追加' : 'プロジェクト編集';
  if (mode === 'edit') {
    const p = appState.projects.find((p) => p.id === activeProjectId);
    document.getElementById('projectNameInput').value = p.name;
    document.getElementById('projectStartInput').value = p.startDate;
    document.getElementById('projectEndInput').value = p.endDate;
    document.getElementById('projectStatusInput').value = p.status;
  } else {
    document.getElementById('projectNameInput').value = '';
    document.getElementById('projectStartInput').value = formatDate(new Date());
    document.getElementById('projectEndInput').value = formatDate(addDays(new Date(), 14));
    document.getElementById('projectStatusInput').value = 'planned';
  }
  modal.dataset.mode = mode;
}

function closeProjectModal() {
  document.getElementById('projectModal').classList.add('hidden');
}

function saveProjectFromModal() {
  const mode = document.getElementById('projectModal').dataset.mode;
  const name = document.getElementById('projectNameInput').value.trim();
  if (!name) return showToast('プロジェクト名を入力してください');
  const data = {
    name,
    startDate: document.getElementById('projectStartInput').value,
    endDate: document.getElementById('projectEndInput').value,
    status: document.getElementById('projectStatusInput').value,
  };
  pushUndo();
  if (mode === 'add') {
    const id = crypto.randomUUID();
    appState.projects.push({ id, ...data });
    activeProjectId = id;
  } else {
    const p = appState.projects.find((p) => p.id === activeProjectId);
    Object.assign(p, data);
  }
  closeProjectModal();
  renderAll();
  scheduleSave();
}

function deleteProject() {
  if (!activeProjectId) return;
  if (!confirm('プロジェクトを削除しますか？')) return;
  pushUndo();
  appState.projects = appState.projects.filter((p) => p.id !== activeProjectId);
  appState.tasks = appState.tasks.filter((t) => t.projectId !== activeProjectId);
  activeProjectId = appState.projects[0]?.id || '';
  renderAll();
  scheduleSave();
}

function renderReportProjectOptions() {
  const select = document.getElementById('reportProject');
  select.innerHTML = '<option value="all">すべて</option>';
  appState.projects.forEach((p) => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    select.appendChild(opt);
  });
}

// --- レポート生成 ---
function generateReport() {
  const start = document.getElementById('reportStart').value || formatDate(addDays(new Date(), -7));
  const end = document.getElementById('reportEnd').value || formatDate(new Date());
  const project = document.getElementById('reportProject').value;
  const includeAdhoc = document.getElementById('reportIncludeAdhoc').checked;

  const tasks = appState.tasks.filter((t) => (project === 'all' ? true : t.projectId === project));
  const completed = tasks.filter((t) => t.status === 'completed');
  const progressing = tasks.filter((t) => t.status === 'in_progress');
  const delayed = tasks.filter((t) => t.status !== 'completed' && t.plannedEnd < end);
  const adhoc = includeAdhoc ? appState.adhocTasks.filter((a) => a.date >= start && a.date <= end) : [];

  const text = `【期間】${start} 〜 ${end}
【進捗サマリー】完了 ${completed.length} / 進行中 ${progressing.length} / 遅延 ${delayed.length}
【完了タスク】\n- ${completed.map((t) => t.name).join('\n- ') || 'なし'}
【進行中】\n- ${progressing.map((t) => `${t.name} (${t.progress}%)`).join('\n- ') || 'なし'}
【遅延懸念】\n- ${delayed.map((t) => `${t.name} (予定 ${t.plannedEnd})`).join('\n- ') || 'なし'}
${adhoc.length ? `【一時タスク】\n- ${adhoc.map((a) => `${a.title} (${a.hours || '?'}h)`).join('\n- ')}` : ''}
次回までの予定：進行中タスクを優先し、依存関係に留意して進めます。`;
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
      saveState(true);
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
      generateReport();
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
  document.getElementById('reportBtn').addEventListener('click', () => { openReportModal(); generateReport(); });
  document.getElementById('closeReport').addEventListener('click', closeReportModal);
  document.getElementById('generateReport').addEventListener('click', generateReport);
  document.getElementById('selectReport').addEventListener('click', () => { const ta = document.getElementById('reportText'); ta.focus(); ta.select(); });
  document.getElementById('copyReport').addEventListener('click', () => { const ta = document.getElementById('reportText'); ta.select(); document.execCommand('copy'); showToast('コピーしました'); });
  document.getElementById('manualSaveBtn').addEventListener('click', () => { saveState(true); showToast('保存しました'); });
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

function init() {
  appState = loadState();
  activeProjectId = appState.projects[0]?.id || '';
  renderAll();
  bindEvents();
  setupShortcuts();
}

window.addEventListener('load', init);

// --- 型定義（参考） ---
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
