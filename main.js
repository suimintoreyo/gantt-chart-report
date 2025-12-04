// ガントチャート進捗管理アプリ main.js
const STORAGE_KEY = 'gantt-progress-state-v1';
const autosaveStatus = document.getElementById('autosaveStatus');
const toastEl = document.getElementById('toast');
const taskTableHead = document.querySelector('#taskTable thead');
const taskTableBody = document.querySelector('#taskTable tbody');
const projectSelect = document.getElementById('projectSelect');
const addProjectBtn = document.getElementById('addProjectBtn');
const editProjectBtn = document.getElementById('editProjectBtn');
const deleteProjectBtn = document.getElementById('deleteProjectBtn');
const addTaskBtn = document.getElementById('addTaskBtn');
const statusFilter = document.getElementById('statusFilter');
const taskSearch = document.getElementById('taskSearch');
const ganttArea = document.getElementById('ganttArea');
const sidePanelContent = document.getElementById('sidePanelContent');
const saveBtn = document.getElementById('saveBtn');
const reportBtn = document.getElementById('reportBtn');
const reportModal = document.getElementById('reportModal');
const logsTab = document.getElementById('logsTab');
const adhocTab = document.getElementById('adhocTab');
const tabButtons = document.querySelectorAll('.tab-buttons button');
const addAdhocBtn = document.getElementById('addAdhocBtn');
const todaySummary = document.getElementById('todaySummary');
const viewSwitchButtons = document.querySelectorAll('.view-switch button');

const reportProjectSelect = document.getElementById('reportProject');
const reportStart = document.getElementById('reportStart');
const reportEnd = document.getElementById('reportEnd');
const includeAdhoc = document.getElementById('includeAdhoc');
const reportText = document.getElementById('reportText');
const generateReportBtn = document.getElementById('generateReport');
const selectReportBtn = document.getElementById('selectReport');
const copyReportBtn = document.getElementById('copyReport');

const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_WIDTH = 24; // px

const defaultState = {
  projects: [
    {
      id: 'p1',
      name: 'デモプロジェクト',
      owner: '田中',
      startDate: today(-7),
      endDate: today(30),
      status: 'active'
    }
  ],
  tasks: [
    {
      id: 't1',
      projectId: 'p1',
      name: '要件整理',
      category: '設計',
      assignee: '田中',
      plannedStart: today(-5),
      plannedEnd: today(1),
      progress: 80,
      status: 'in_progress',
      priority: 'high',
      dependsOn: [],
      notes: 'レビュー待ち'
    },
    {
      id: 't2',
      projectId: 'p1',
      name: '実装',
      category: '開発',
      assignee: '佐藤',
      plannedStart: today(-1),
      plannedEnd: today(6),
      progress: 30,
      status: 'in_progress',
      priority: 'medium',
      dependsOn: ['t1'],
      notes: ''
    }
  ],
  workLogs: [
    { id: 'w1', taskId: 't2', date: today(0), workNote: 'API 作成', hours: 3, progressAfter: 30 }
  ],
  adhocTasks: [
    { id: 'a1', date: today(0), title: 'サーバ再起動', detail: 'メンテ', hours: 1 }
  ],
  uiPreferences: { ganttZoomLevel: 1, theme: 'dark' },
  currentProjectId: 'p1'
};

let state = loadState();
let selectedTaskId = state.tasks[0]?.id;
let viewRange = 'week';
let sortColumn = 'plannedStart';
let sortDir = 'asc';
let undoStack = [];
let redoStack = [];
let autosaveTimer = null;
let isDraggingBar = null;

function today(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(defaultState);
  try {
    const parsed = JSON.parse(raw);
    if (!parsed.currentProjectId) parsed.currentProjectId = parsed.projects[0]?.id;
    return parsed;
  } catch (e) {
    console.warn('Failed to parse state', e);
    return structuredClone(defaultState);
  }
}

function saveState(immediate = false) {
  autosaveStatus.textContent = immediate ? '保存中...' : '自動保存待ち';
  if (autosaveTimer) clearTimeout(autosaveTimer);
  const runner = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    autosaveStatus.textContent = '自動保存済み';
  };
  if (immediate) {
    runner();
  } else {
    autosaveTimer = setTimeout(runner, 1200);
  }
}

function pushUndo() {
  undoStack.push(JSON.stringify(state));
  if (undoStack.length > 30) undoStack.shift();
  redoStack = [];
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(JSON.stringify(state));
  state = JSON.parse(undoStack.pop());
  renderAll();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(JSON.stringify(state));
  state = JSON.parse(redoStack.pop());
  renderAll();
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function renderProjects() {
  projectSelect.innerHTML = '';
  reportProjectSelect.innerHTML = '<option value="">すべて</option>';
  state.projects.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.name;
    projectSelect.appendChild(opt);

    const opt2 = opt.cloneNode(true);
    reportProjectSelect.appendChild(opt2);
  });
  if (!state.projects.find(p => p.id === state.currentProjectId)) {
    state.currentProjectId = state.projects[0]?.id;
  }
  projectSelect.value = state.currentProjectId;
  reportProjectSelect.value = '';
}

function filteredTasks() {
  let tasks = state.tasks.filter(t => t.projectId === state.currentProjectId);
  const filterStatus = statusFilter.value;
  if (filterStatus) tasks = tasks.filter(t => t.status === filterStatus);
  const q = taskSearch.value.trim().toLowerCase();
  if (q) tasks = tasks.filter(t => t.name.toLowerCase().includes(q) || (t.assignee || '').toLowerCase().includes(q));
  tasks.sort((a, b) => {
    const valA = a[sortColumn];
    const valB = b[sortColumn];
    if (valA < valB) return sortDir === 'asc' ? -1 : 1;
    if (valA > valB) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });
  return tasks;
}

function renderTaskTable() {
  const columns = [
    { key: 'name', label: 'タスク名', editable: true },
    { key: 'assignee', label: '担当', editable: true },
    { key: 'plannedStart', label: '開始', type: 'date', editable: true },
    { key: 'plannedEnd', label: '終了', type: 'date', editable: true },
    { key: 'status', label: 'ステータス', type: 'select', editable: true },
    { key: 'progress', label: '進捗(%)', type: 'number', editable: true },
    { key: 'priority', label: '優先度', type: 'select', editable: true },
    { key: 'category', label: 'カテゴリ', editable: true },
    { key: 'notes', label: 'メモ', editable: true },
    { key: 'actions', label: '' }
  ];

  taskTableHead.innerHTML = '<tr>' + columns.map(col => {
    if (col.key === 'actions') return '<th></th>';
    const sortIcon = sortColumn === col.key ? (sortDir === 'asc' ? '▲' : '▼') : '';
    return `<th data-sort="${col.key}">${col.label} ${sortIcon}</th>`;
  }).join('') + '</tr>';

  const tasks = filteredTasks();
  if (tasks.length && !tasks.find(t => t.id === selectedTaskId)) {
    selectedTaskId = tasks[0].id;
  }
  taskTableBody.innerHTML = '';
  tasks.forEach(t => {
    const tr = document.createElement('tr');
    if (t.id === selectedTaskId) tr.classList.add('selected');
    columns.forEach(col => {
      const td = document.createElement('td');
      if (col.key === 'actions') {
        const delBtn = document.createElement('button');
        delBtn.textContent = '削除';
        delBtn.onclick = () => deleteTask(t.id);
        td.appendChild(delBtn);
      } else if (col.type === 'select') {
        const select = document.createElement('select');
        const options = col.key === 'status'
          ? [
            { value: 'not_started', label: '未着手' },
            { value: 'in_progress', label: '進行中' },
            { value: 'completed', label: '完了' },
            { value: 'on_hold', label: '保留' }
          ]
          : [
            { value: 'high', label: '高' },
            { value: 'medium', label: '中' },
            { value: 'low', label: '低' },
          ];
        options.forEach(o => {
          const opt = document.createElement('option');
          opt.value = o.value;
          opt.textContent = o.label;
          select.appendChild(opt);
        });
        select.value = t[col.key] || '';
        select.onchange = () => updateTaskField(t.id, col.key, select.value);
        td.appendChild(select);
      } else if (col.editable) {
        const input = document.createElement('input');
        input.type = col.type || 'text';
        input.value = t[col.key] || '';
        input.onchange = () => updateTaskField(t.id, col.key, normalizeInput(input.value, col.type));
        td.appendChild(input);
      }
      tr.appendChild(td);
    });
    tr.onclick = () => { selectedTaskId = t.id; renderAll(); };
    taskTableBody.appendChild(tr);
  });
}

function normalizeInput(value, type) {
  if (type === 'number') return Math.max(0, Math.min(100, Number(value) || 0));
  return value;
}

function updateTaskField(id, key, value) {
  pushUndo();
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;
  task[key] = value;
  if (key === 'progress') task.status = value >= 100 ? 'completed' : task.status;
  saveState();
  renderAll();
}

function deleteTask(id) {
  pushUndo();
  state.tasks = state.tasks.filter(t => t.id !== id);
  if (selectedTaskId === id) selectedTaskId = state.tasks[0]?.id;
  saveState();
  renderAll();
}

function addTask() {
  if (!state.currentProjectId) return;
  pushUndo();
  const newTask = {
    id: uid('t'),
    projectId: state.currentProjectId,
    name: '新規タスク',
    category: '',
    assignee: '',
    plannedStart: today(0),
    plannedEnd: today(3),
    progress: 0,
    status: 'not_started',
    priority: 'medium',
    dependsOn: [],
    notes: ''
  };
  state.tasks.push(newTask);
  selectedTaskId = newTask.id;
  saveState();
  renderAll();
}

function addProject() {
  const name = prompt('プロジェクト名');
  if (!name) return;
  pushUndo();
  const newProject = {
    id: uid('p'),
    name,
    owner: '',
    startDate: today(0),
    endDate: today(14),
    status: 'active'
  };
  state.projects.push(newProject);
  state.currentProjectId = newProject.id;
  saveState();
  renderAll();
}

function editProject() {
  const project = state.projects.find(p => p.id === state.currentProjectId);
  if (!project) return;
  const name = prompt('新しいプロジェクト名', project.name);
  if (!name) return;
  pushUndo();
  project.name = name;
  saveState();
  renderProjects();
}

function deleteProject(projectId) {
  if (!confirm('プロジェクトを削除しますか？')) return;
  pushUndo();
  const remainingTasks = state.tasks.filter(t => t.projectId !== projectId);
  state.projects = state.projects.filter(p => p.id !== projectId);
  state.tasks = remainingTasks;
  const validTaskIds = new Set(remainingTasks.map(t => t.id));
  state.workLogs = state.workLogs.filter(w => validTaskIds.has(w.taskId));
  state.currentProjectId = state.projects[0]?.id;
  saveState();
  renderAll();
}

function renderGantt() {
  ganttArea.innerHTML = '';
  const tasks = filteredTasks();
  const bounds = getRangeBounds(tasks);
  const container = document.createElement('div');
  container.style.position = 'relative';
  container.style.paddingLeft = '160px';
  container.style.minHeight = `${tasks.length * 34 + 30}px`;
  container.style.minWidth = '800px';

  const grid = document.createElement('div');
  grid.className = 'gantt-grid';
  grid.style.height = `${tasks.length * 34}px`;
  const days = Math.max(15, Math.round((bounds.end - bounds.start) / DAY_MS) + 2);
  for (let i = 0; i < days; i++) {
    const day = document.createElement('div');
    day.className = 'gantt-day';
    day.style.width = `${DAY_WIDTH * state.uiPreferences.ganttZoomLevel}px`;
    if (i % 7 === 0) day.style.background = 'rgba(255,255,255,0.01)';
    grid.appendChild(day);
  }
  grid.style.left = '160px';
  container.appendChild(grid);

  const todayLine = document.createElement('div');
  todayLine.className = 'today-line';
  const todayPos = ((new Date() - bounds.start) / DAY_MS) * DAY_WIDTH * state.uiPreferences.ganttZoomLevel + 160;
  todayLine.style.left = `${todayPos}px`;
  container.appendChild(todayLine);

  tasks.forEach((task, idx) => {
    const row = document.createElement('div');
    row.className = 'gantt-row';
    row.style.top = `${idx * 34}px`;

    const label = document.createElement('div');
    label.className = 'gantt-label';
    label.textContent = task.name;
    row.appendChild(label);

    const bar = document.createElement('div');
    bar.className = 'gantt-bar';
    if (task.status === 'completed') bar.classList.add('completed');
    const start = new Date(task.plannedStart);
    const end = new Date(task.plannedEnd);
    const x = ((start - bounds.start) / DAY_MS) * DAY_WIDTH * state.uiPreferences.ganttZoomLevel + 160;
    const w = (Math.max(1, (end - start) / DAY_MS + 1)) * DAY_WIDTH * state.uiPreferences.ganttZoomLevel;
    bar.style.left = `${x}px`;
    bar.style.width = `${w}px`;
    if (end < new Date()) bar.classList.add('delay');

    const handleStart = document.createElement('div');
    handleStart.className = 'gantt-handle start';
    const handleEnd = document.createElement('div');
    handleEnd.className = 'gantt-handle end';
    bar.appendChild(handleStart);
    bar.appendChild(handleEnd);

    bar.addEventListener('mousedown', e => beginDrag(e, task.id, 'move'));
    handleStart.addEventListener('mousedown', e => beginDrag(e, task.id, 'start'));
    handleEnd.addEventListener('mousedown', e => beginDrag(e, task.id, 'end'));

    row.appendChild(bar);
    container.appendChild(row);
  });

  ganttArea.appendChild(container);
}

function getRangeBounds(tasks) {
  const startDates = tasks.map(t => new Date(t.plannedStart).getTime());
  const endDates = tasks.map(t => new Date(t.plannedEnd).getTime());
  const minStart = startDates.length ? Math.min(...startDates) : new Date().getTime();
  const maxEnd = endDates.length ? Math.max(...endDates) : new Date().getTime();
  const todayDate = new Date(today(0));
  let rangeStart = new Date(minStart - DAY_MS * 3);
  let rangeEnd = new Date(maxEnd + DAY_MS * 5);
  if (viewRange === 'today') {
    rangeStart = addDays(todayDate, -1);
    rangeEnd = addDays(todayDate, 5);
  } else if (viewRange === 'week') {
    const weekday = todayDate.getDay();
    const monday = addDays(todayDate, -((weekday + 6) % 7));
    rangeStart = addDays(monday, -1);
    rangeEnd = addDays(monday, 13);
  } else if (viewRange === 'month') {
    const first = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);
    const last = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0);
    rangeStart = addDays(first, -3);
    rangeEnd = addDays(last, 7);
  }
  const start = new Date(Math.min(rangeStart.getTime(), minStart - DAY_MS * 3));
  const end = new Date(Math.max(rangeEnd.getTime(), maxEnd + DAY_MS * 3));
  return { start, end };
}

function beginDrag(event, taskId, mode) {
  event.stopPropagation();
  pushUndo();
  const startX = event.clientX;
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  const initialStart = new Date(task.plannedStart);
  const initialEnd = new Date(task.plannedEnd);
  isDraggingBar = { taskId, mode, startX, initialStart, initialEnd };
  document.body.style.userSelect = 'none';
}

function onDrag(event) {
  if (!isDraggingBar) return;
  const { taskId, mode, startX, initialStart, initialEnd } = isDraggingBar;
  const dx = event.clientX - startX;
  const diffDays = Math.round(dx / (DAY_WIDTH * state.uiPreferences.ganttZoomLevel));
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (mode === 'move') {
    task.plannedStart = dateToStr(addDays(initialStart, diffDays));
    task.plannedEnd = dateToStr(addDays(initialEnd, diffDays));
  } else if (mode === 'start') {
    task.plannedStart = dateToStr(addDays(initialStart, diffDays));
  } else {
    task.plannedEnd = dateToStr(addDays(initialEnd, diffDays));
  }
  renderGantt();
}

function endDrag() {
  if (isDraggingBar) saveState();
  isDraggingBar = null;
  document.body.style.userSelect = '';
}

function addDays(date, diff) {
  const d = new Date(date);
  d.setDate(d.getDate() + diff);
  return d;
}

function dateToStr(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function renderSidePanel() {
  const task = state.tasks.find(t => t.id === selectedTaskId);
  if (!task) {
    sidePanelContent.textContent = 'タスクを選択してください。';
    return;
  }
  const workLogs = state.workLogs.filter(w => w.taskId === task.id);
  sidePanelContent.innerHTML = `
    <div class="badge">${task.name}</div>
    <label>担当<input id="sideAssignee" value="${task.assignee || ''}"></label>
    <label>進捗 <input id="sideProgress" type="range" min="0" max="100" value="${task.progress}"> <span id="sideProgressVal">${task.progress}%</span></label>
    <label>メモ<textarea id="sideNotes" rows="3">${task.notes || ''}</textarea></label>
    <button id="updateTaskBtn">更新</button>
    <hr>
    <h4>作業ログ追加</h4>
    <label>日付<input id="logDate" type="date" value="${today(0)}"></label>
    <label>内容<textarea id="logNote" rows="2"></textarea></label>
    <label>時間(h)<input id="logHours" type="number" min="0" step="0.5"></label>
    <button id="addLogBtn">追加</button>
    <h4>ログ一覧</h4>
    <ul class="log-list">${workLogs.map(w => `<li>${w.date} ${w.workNote} (${w.hours || 0}h)</li>`).join('')}</ul>
  `;
  document.getElementById('sideProgress').oninput = (e) => {
    document.getElementById('sideProgressVal').textContent = `${e.target.value}%`;
  };
  document.getElementById('updateTaskBtn').onclick = () => {
    pushUndo();
    task.assignee = document.getElementById('sideAssignee').value;
    task.progress = Number(document.getElementById('sideProgress').value);
    task.notes = document.getElementById('sideNotes').value;
    if (task.progress >= 100) task.status = 'completed';
    saveState();
    renderAll();
  };
  document.getElementById('addLogBtn').onclick = () => {
    pushUndo();
    state.workLogs.push({
      id: uid('w'),
      taskId: task.id,
      date: document.getElementById('logDate').value || today(0),
      workNote: document.getElementById('logNote').value || '作業',
      hours: Number(document.getElementById('logHours').value) || 0,
      progressAfter: task.progress
    });
    saveState();
    renderAll();
  };
}

function renderTabs() {
  const logs = state.workLogs
    .filter(w => state.tasks.find(t => t.id === w.taskId && t.projectId === state.currentProjectId))
    .sort((a, b) => b.date.localeCompare(a.date));
  logsTab.innerHTML = `
    <table class="log-table">
      <thead><tr><th>日付</th><th>タスク</th><th>内容</th><th>時間</th></tr></thead>
      <tbody>${logs.map(l => {
        const task = state.tasks.find(t => t.id === l.taskId);
        return `<tr><td>${l.date}</td><td>${task?.name || ''}</td><td>${l.workNote}</td><td>${l.hours || ''}</td></tr>`;
      }).join('')}</tbody>
    </table>
  `;

  const adhocRows = state.adhocTasks.sort((a, b) => b.date.localeCompare(a.date)).map(a => `
    <tr>
      <td><input data-id="${a.id}" data-field="date" type="date" value="${a.date}"></td>
      <td><input data-id="${a.id}" data-field="title" value="${a.title}"></td>
      <td><input data-id="${a.id}" data-field="detail" value="${a.detail || ''}"></td>
      <td><input data-id="${a.id}" data-field="hours" type="number" min="0" step="0.5" value="${a.hours || ''}"></td>
      <td><button data-del="${a.id}">削除</button></td>
    </tr>`).join('');
  adhocTab.innerHTML = `
    <table class="adhoc-table">
      <thead><tr><th>日付</th><th>タイトル</th><th>詳細</th><th>時間</th><th></th></tr></thead>
      <tbody>${adhocRows}</tbody>
    </table>
  `;
  adhocTab.querySelectorAll('input').forEach(input => {
    input.onchange = () => {
      pushUndo();
      const item = state.adhocTasks.find(a => a.id === input.dataset.id);
      if (item) item[input.dataset.field] = input.type === 'number' ? Number(input.value) : input.value;
      saveState();
    };
  });
  adhocTab.querySelectorAll('button[data-del]').forEach(btn => {
    btn.onclick = () => {
      pushUndo();
      state.adhocTasks = state.adhocTasks.filter(a => a.id !== btn.dataset.del);
      saveState();
      renderTabs();
    };
  });
}

function renderSummary() {
  const tasks = filteredTasks();
  const todayDate = today(0);
  const dueToday = tasks.filter(t => t.plannedEnd === todayDate).length;
  const delayed = tasks.filter(t => t.plannedEnd < todayDate && t.status !== 'completed').length;
  const doing = tasks.filter(t => t.status === 'in_progress').length;
  todaySummary.textContent = `今日: ${dueToday}件 / 進行中: ${doing}件 / 遅延: ${delayed}件`;
}

function renderReportModal() {
  reportStart.value = reportStart.value || today(-7);
  reportEnd.value = reportEnd.value || today(0);
}

function generateReport() {
  const start = reportStart.value || today(-7);
  const end = reportEnd.value || today(0);
  const projId = reportProjectSelect.value;
  const tasks = state.tasks.filter(t => (!projId || t.projectId === projId));
  const logs = state.workLogs.filter(w => w.date >= start && w.date <= end);
  const adhocs = includeAdhoc.checked ? state.adhocTasks.filter(a => a.date >= start && a.date <= end) : [];

  const lines = [];
  lines.push(`期間: ${start} 〜 ${end}`);
  if (projId) {
    const proj = state.projects.find(p => p.id === projId);
    lines.push(`プロジェクト: ${proj?.name}`);
  }
  lines.push('\n■ タスク進捗');
  tasks.forEach(t => {
    const status = t.status === 'completed' ? '完了' : `${t.progress}%`;
    lines.push(`- ${t.name} (${status}) ${t.plannedStart}〜${t.plannedEnd}`);
  });
  lines.push('\n■ 作業ログ');
  logs.forEach(l => {
    const task = state.tasks.find(t => t.id === l.taskId);
    lines.push(`- ${l.date} ${task?.name || ''} ${l.workNote} (${l.hours || 0}h)`);
  });
  if (adhocs.length) {
    lines.push('\n■ 一時タスク');
    adhocs.forEach(a => lines.push(`- ${a.date} ${a.title} (${a.hours || 0}h) ${a.detail || ''}`));
  }
  reportText.value = lines.join('\n');
  copyToClipboard(reportText.value);
  showToast('報告文を生成しました（自動コピー）');
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast('クリップボードにコピーしました');
  });
}

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 1800);
}

function bindEvents() {
  addTaskBtn.onclick = addTask;
  addProjectBtn.onclick = addProject;
  editProjectBtn.onclick = editProject;
  deleteProjectBtn.onclick = () => deleteProject(state.currentProjectId);
  projectSelect.onchange = () => {
    state.currentProjectId = projectSelect.value;
    renderAll();
  };
  statusFilter.onchange = () => renderAll();
  taskSearch.oninput = () => renderAll();
  saveBtn.onclick = () => saveState(true);
  reportBtn.onclick = () => {
    renderReportModal();
    reportModal.classList.remove('hidden');
  };
  reportModal.addEventListener('click', (e) => {
    if (e.target.dataset.close !== undefined || e.target === reportModal) {
      reportModal.classList.add('hidden');
    }
  });
  generateReportBtn.onclick = generateReport;
  copyReportBtn.onclick = () => copyToClipboard(reportText.value);
  selectReportBtn.onclick = () => {
    reportText.focus();
    reportText.select();
  };
  viewSwitchButtons.forEach(btn => {
    btn.onclick = () => {
      viewSwitchButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      viewRange = btn.dataset.range;
      renderGantt();
    };
  });
  tabButtons.forEach(btn => {
    btn.onclick = () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById(`${btn.dataset.tab}Tab`).classList.remove('hidden');
    };
  });
  addAdhocBtn.onclick = () => {
    pushUndo();
    state.adhocTasks.unshift({ id: uid('a'), date: today(0), title: '一時タスク', detail: '', hours: 1 });
    saveState();
    renderTabs();
  };
  window.addEventListener('keydown', (e) => {
    if (e.isComposing) return;
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      saveState(true);
    }
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      taskSearch.focus();
    }
    if (e.key.toLowerCase() === 'n' && !e.ctrlKey) {
      addTask();
    }
    if (e.ctrlKey && e.key === 'z') {
      e.preventDefault();
      undo();
    }
    if (e.ctrlKey && e.key === 'y') {
      e.preventDefault();
      redo();
    }
    if (e.ctrlKey && e.key === 'Enter' && !reportModal.classList.contains('hidden')) {
      e.preventDefault();
      generateReport();
    }
  });
  taskTableHead.addEventListener('click', (e) => {
    const key = e.target.dataset.sort;
    if (!key) return;
    if (sortColumn === key) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else sortColumn = key;
    renderTaskTable();
  });
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', endDrag);
}

function renderAll() {
  renderProjects();
  renderTaskTable();
  renderGantt();
  renderSidePanel();
  renderTabs();
  renderSummary();
}

function init() {
  bindEvents();
  renderAll();
  saveState(true);
}

init();
