/**
 * js/main.js
 * メインアプリケーションのエントリーポイント
 */

import { loadState, saveState, saveStateDebounced, generateId } from './state.js';
import { getToday, getThisWeekRange, getThisMonthRange, formatDate, getDelayedTasks } from './dateHelpers.js';
import { initGantt, updateGantt, changeViewMode, highlightTask } from './gantt.js';
import { generateReport } from './report.js';

// グローバル状態
let appState = null;
let selectedProjectId = null;
let selectedTaskId = null;
let undoStack = [];
let redoStack = [];
const MAX_UNDO = 20;

// DOM要素キャッシュ
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/**
 * アプリケーション初期化
 */
function init() {
  appState = loadState();
  setupEventListeners();
  renderProjectSelect();
  renderAll();
  setupKeyboardShortcuts();
  updateSummary();
}

/**
 * イベントリスナーの設定
 */
function setupEventListeners() {
  // プロジェクト選択
  $('#project-select')?.addEventListener('change', (e) => {
    selectedProjectId = e.target.value || null;
    renderAll();
  });

  // プロジェクト管理ボタン
  $('#btn-manage-projects')?.addEventListener('click', openProjectModal);

  // 進捗報告生成ボタン
  $('#btn-generate-report')?.addEventListener('click', openReportModal);

  // 新規タスクボタン
  $('#btn-new-task')?.addEventListener('click', () => {
    openTaskModal();
  });

  // 一時タスク追加ボタン
  $('#btn-add-adhoc')?.addEventListener('click', openAdhocModal);

  // ズームボタン
  $$('.btn-zoom').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mode = e.target.dataset.mode;
      $$('.btn-zoom').forEach(b => b.classList.remove('is-active'));
      e.target.classList.add('is-active');
      changeViewMode(mode);
      appState.uiPreferences.ganttZoomLevel = mode;
      saveStateDebounced(appState);
    });
  });

  // タブ切り替え
  $$('.tabs li').forEach(tab => {
    tab.addEventListener('click', (e) => {
      const tabName = e.currentTarget.dataset.tab;
      $$('.tabs li').forEach(t => t.classList.remove('is-active'));
      e.currentTarget.classList.add('is-active');
      $$('.tab-content').forEach(tc => tc.classList.add('is-hidden'));
      $(`#tab-${tabName}`)?.classList.remove('is-hidden');
    });
  });

  // 自動保存通知
  window.addEventListener('autosaved', () => {
    showToast('自動保存しました', 'light');
  });

  // モーダル閉じる
  $$('.modal-close, .modal-background').forEach(el => {
    el.addEventListener('click', closeAllModals);
  });
}

/**
 * キーボードショートカット
 */
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // IME変換中は無視
    if (e.isComposing) return;

    // Ctrl+S: 手動保存
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault();
      saveState(appState);
      showToast('保存しました', 'success');
    }

    // Ctrl+Z: Undo
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      undo();
    }

    // Ctrl+Y or Ctrl+Shift+Z: Redo
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
      e.preventDefault();
      redo();
    }

    // N: 新規タスク（入力欄にフォーカスしていない時）
    if (e.key === 'n' && !isInputFocused()) {
      e.preventDefault();
      $('#btn-new-task')?.click();
    }

    // Ctrl+F: 検索フォーカス
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      $('#task-search')?.focus();
    }

    // Delete: タスク削除
    if (e.key === 'Delete' && selectedTaskId && !isInputFocused()) {
      e.preventDefault();
      confirmDeleteTask(selectedTaskId);
    }

    // Escape: モーダル閉じる
    if (e.key === 'Escape') {
      closeAllModals();
    }
  });
}

function isInputFocused() {
  const active = document.activeElement;
  return active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.tagName === 'SELECT');
}

/**
 * Undo/Redo
 */
function pushUndo() {
  undoStack.push(JSON.stringify(appState));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack = [];
}

function undo() {
  if (undoStack.length === 0) return;
  redoStack.push(JSON.stringify(appState));
  appState = JSON.parse(undoStack.pop());
  renderAll();
  saveStateDebounced(appState);
  showToast('元に戻しました', 'info');
}

function redo() {
  if (redoStack.length === 0) return;
  undoStack.push(JSON.stringify(appState));
  appState = JSON.parse(redoStack.pop());
  renderAll();
  saveStateDebounced(appState);
  showToast('やり直しました', 'info');
}

/**
 * 全体再描画
 */
function renderAll() {
  renderTaskTable();
  renderGantt();
  renderWorkLogs();
  renderAdhocTasks();
  updateSummary();
}

/**
 * プロジェクト選択ドロップダウンの描画
 */
function renderProjectSelect() {
  const select = $('#project-select');
  if (!select) return;

  select.innerHTML = '<option value="">全プロジェクト</option>';
  appState.projects.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.name;
    select.appendChild(option);
  });
}

/**
 * タスクテーブルの描画
 */
function renderTaskTable() {
  const tbody = $('#task-table-body');
  if (!tbody) return;

  // フィルタ
  let tasks = appState.tasks;
  if (selectedProjectId) {
    tasks = tasks.filter(t => t.projectId === selectedProjectId);
  }

  // 検索フィルタ
  const searchText = $('#task-search')?.value?.toLowerCase() || '';
  if (searchText) {
    tasks = tasks.filter(t => t.name.toLowerCase().includes(searchText));
  }

  tbody.innerHTML = '';
  tasks.forEach(task => {
    const tr = document.createElement('tr');
    tr.dataset.taskId = task.id;
    tr.classList.toggle('is-selected', task.id === selectedTaskId);

    const project = appState.projects.find(p => p.id === task.projectId);
    const statusClass = getStatusClass(task.status);
    const priorityClass = getPriorityClass(task.priority);

    tr.innerHTML = `
      <td><input type="checkbox" class="task-checkbox" data-id="${task.id}"></td>
      <td class="task-name">${escapeHtml(task.name)}</td>
      <td>${escapeHtml(task.assignee || '-')}</td>
      <td>
        <progress class="progress is-small ${priorityClass}" value="${task.progress}" max="100">${task.progress}%</progress>
        <span class="progress-text">${task.progress}%</span>
      </td>
      <td>${task.plannedStart}</td>
      <td>${task.plannedEnd}</td>
      <td><span class="tag ${statusClass}">${getStatusLabel(task.status)}</span></td>
      <td><span class="tag ${priorityClass}">${getPriorityLabel(task.priority)}</span></td>
    `;

    tr.addEventListener('click', () => selectTask(task.id));
    tr.addEventListener('dblclick', () => openTaskModal(task));
    tbody.appendChild(tr);
  });
}

/**
 * ガントチャートの描画
 */
function renderGantt() {
  let tasks = appState.tasks;
  if (selectedProjectId) {
    tasks = tasks.filter(t => t.projectId === selectedProjectId);
  }

  if (tasks.length === 0) {
    $('#gantt-container').innerHTML = '<p class="has-text-centered p-4">タスクがありません</p>';
    return;
  }

  const existingGantt = $('#gantt-container svg');
  if (existingGantt) {
    updateGantt(tasks);
  } else {
    $('#gantt-container').innerHTML = '';
    initGantt('#gantt-container', tasks, {
      onDateChange: (taskId, start, end) => {
        pushUndo();
        const task = appState.tasks.find(t => t.id === taskId);
        if (task) {
          task.plannedStart = start;
          task.plannedEnd = end;
          renderTaskTable();
          saveStateDebounced(appState);
        }
      },
      onClick: (taskId) => {
        selectTask(taskId);
      },
      onProgressChange: (taskId, progress) => {
        pushUndo();
        const task = appState.tasks.find(t => t.id === taskId);
        if (task) {
          task.progress = progress;
          renderTaskTable();
          updateSidePanel();
          saveStateDebounced(appState);
        }
      },
    });

    // 初期ズームレベルを設定
    const zoomLevel = appState.uiPreferences.ganttZoomLevel || 'Day';
    changeViewMode(zoomLevel);
    $$('.btn-zoom').forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.mode === zoomLevel);
    });
  }
}

/**
 * タスク選択
 */
function selectTask(taskId) {
  selectedTaskId = taskId;
  $$('#task-table-body tr').forEach(tr => {
    tr.classList.toggle('is-selected', tr.dataset.taskId === taskId);
  });
  highlightTask(taskId);
  updateSidePanel();
}

/**
 * サイドパネル更新
 */
function updateSidePanel() {
  const panel = $('#side-panel');
  if (!panel) return;

  if (!selectedTaskId) {
    panel.innerHTML = '<p class="has-text-centered p-4">タスクを選択してください</p>';
    return;
  }

  const task = appState.tasks.find(t => t.id === selectedTaskId);
  if (!task) {
    panel.innerHTML = '<p class="has-text-centered p-4">タスクが見つかりません</p>';
    return;
  }

  const project = appState.projects.find(p => p.id === task.projectId);

  panel.innerHTML = `
    <div class="card-content">
      <h3 class="title is-5 mb-3">${escapeHtml(task.name)}</h3>
      <div class="field">
        <label class="label is-small">プロジェクト</label>
        <p>${escapeHtml(project?.name || '未分類')}</p>
      </div>
      <div class="field">
        <label class="label is-small">担当者</label>
        <p>${escapeHtml(task.assignee || '-')}</p>
      </div>
      <div class="field">
        <label class="label is-small">期間</label>
        <p>${task.plannedStart} 〜 ${task.plannedEnd}</p>
      </div>
      <div class="field">
        <label class="label is-small">ステータス</label>
        <div class="select is-small">
          <select id="panel-status">
            <option value="not_started" ${task.status === 'not_started' ? 'selected' : ''}>未着手</option>
            <option value="in_progress" ${task.status === 'in_progress' ? 'selected' : ''}>進行中</option>
            <option value="completed" ${task.status === 'completed' ? 'selected' : ''}>完了</option>
            <option value="on_hold" ${task.status === 'on_hold' ? 'selected' : ''}>保留</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label class="label is-small">進捗 (${task.progress}%)</label>
        <input type="range" id="panel-progress" class="slider" min="0" max="100" value="${task.progress}">
      </div>
      <div class="field">
        <label class="label is-small">メモ</label>
        <textarea id="panel-notes" class="textarea is-small" rows="2">${escapeHtml(task.notes || '')}</textarea>
      </div>
      <hr>
      <h4 class="title is-6">作業ログを追加</h4>
      <div class="field">
        <input type="date" id="worklog-date" class="input is-small" value="${getToday()}">
      </div>
      <div class="field">
        <input type="text" id="worklog-note" class="input is-small" placeholder="作業内容">
      </div>
      <div class="field">
        <input type="number" id="worklog-hours" class="input is-small" placeholder="作業時間(h)" min="0" step="0.5">
      </div>
      <button id="btn-add-worklog" class="button is-primary is-small">作業ログに追加</button>
    </div>
  `;

  // イベントリスナー
  $('#panel-status')?.addEventListener('change', (e) => {
    pushUndo();
    task.status = e.target.value;
    renderTaskTable();
    updateGantt(getFilteredTasks());
    saveStateDebounced(appState);
  });

  $('#panel-progress')?.addEventListener('input', (e) => {
    const progress = parseInt(e.target.value);
    task.progress = progress;
    panel.querySelector('.label.is-small').textContent = `進捗 (${progress}%)`;
  });

  $('#panel-progress')?.addEventListener('change', (e) => {
    pushUndo();
    task.progress = parseInt(e.target.value);
    renderTaskTable();
    updateGantt(getFilteredTasks());
    saveStateDebounced(appState);
  });

  $('#panel-notes')?.addEventListener('change', (e) => {
    pushUndo();
    task.notes = e.target.value;
    saveStateDebounced(appState);
  });

  $('#btn-add-worklog')?.addEventListener('click', () => {
    const date = $('#worklog-date').value;
    const workNote = $('#worklog-note').value;
    const hours = parseFloat($('#worklog-hours').value) || null;

    if (!workNote) {
      showToast('作業内容を入力してください', 'warning');
      return;
    }

    pushUndo();
    appState.workLogs.push({
      id: generateId(),
      taskId: task.id,
      date,
      workNote,
      hours,
      progressAfter: task.progress,
    });

    renderWorkLogs();
    saveStateDebounced(appState);
    showToast('作業ログを追加しました', 'success');

    $('#worklog-note').value = '';
    $('#worklog-hours').value = '';
  });
}

function getFilteredTasks() {
  let tasks = appState.tasks;
  if (selectedProjectId) {
    tasks = tasks.filter(t => t.projectId === selectedProjectId);
  }
  return tasks;
}

/**
 * 作業ログの描画
 */
function renderWorkLogs() {
  const tbody = $('#worklog-table-body');
  if (!tbody) return;

  const logs = appState.workLogs.sort((a, b) => b.date.localeCompare(a.date));

  tbody.innerHTML = '';
  logs.forEach(log => {
    const task = appState.tasks.find(t => t.id === log.taskId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${log.date}</td>
      <td>${escapeHtml(task?.name || '削除済みタスク')}</td>
      <td>${escapeHtml(log.workNote)}</td>
      <td>${log.hours || '-'}</td>
      <td>${log.progressAfter ?? '-'}%</td>
      <td>
        <button class="button is-small is-danger is-light btn-delete-log" data-id="${log.id}">削除</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // 削除ボタン
  $$('.btn-delete-log').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const logId = e.target.dataset.id;
      if (confirm('この作業ログを削除しますか？')) {
        pushUndo();
        appState.workLogs = appState.workLogs.filter(l => l.id !== logId);
        renderWorkLogs();
        saveStateDebounced(appState);
        showToast('作業ログを削除しました', 'success');
      }
    });
  });
}

/**
 * 一時タスクの描画
 */
function renderAdhocTasks() {
  const tbody = $('#adhoc-table-body');
  if (!tbody) return;

  const adhocs = appState.adhocTasks.sort((a, b) => b.date.localeCompare(a.date));

  tbody.innerHTML = '';
  adhocs.forEach(adhoc => {
    const project = appState.projects.find(p => p.id === adhoc.relatedProjectId);
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${adhoc.date}</td>
      <td>${escapeHtml(adhoc.title)}</td>
      <td>${escapeHtml(adhoc.detail || '-')}</td>
      <td>${adhoc.hours || '-'}</td>
      <td>${escapeHtml(project?.name || '-')}</td>
      <td>
        <button class="button is-small is-danger is-light btn-delete-adhoc" data-id="${adhoc.id}">削除</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // 削除ボタン
  $$('.btn-delete-adhoc').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const adhocId = e.target.dataset.id;
      if (confirm('この一時タスクを削除しますか？')) {
        pushUndo();
        appState.adhocTasks = appState.adhocTasks.filter(a => a.id !== adhocId);
        renderAdhocTasks();
        saveStateDebounced(appState);
        showToast('一時タスクを削除しました', 'success');
      }
    });
  });
}

/**
 * サマリー更新
 */
function updateSummary() {
  const today = getToday();
  const dueTodayCount = appState.tasks.filter(t => t.plannedEnd === today && t.progress < 100).length;
  const delayedCount = getDelayedTasks(appState.tasks, today).length;

  $('#summary-due-today').textContent = dueTodayCount;
  $('#summary-delayed').textContent = delayedCount;
}

/**
 * プロジェクト管理モーダル
 */
function openProjectModal() {
  const modal = $('#modal-project');
  modal?.classList.add('is-active');
  renderProjectList();
}

function renderProjectList() {
  const container = $('#project-list');
  if (!container) return;

  container.innerHTML = '';
  appState.projects.forEach(project => {
    const div = document.createElement('div');
    div.className = 'box mb-2';
    div.innerHTML = `
      <div class="is-flex is-justify-content-space-between is-align-items-center">
        <div>
          <strong>${escapeHtml(project.name)}</strong>
          <span class="tag is-light ml-2">${getProjectStatusLabel(project.status)}</span>
          <br>
          <small>${project.startDate} 〜 ${project.endDate}</small>
        </div>
        <div class="buttons are-small">
          <button class="button is-info btn-edit-project" data-id="${project.id}">編集</button>
          <button class="button is-danger btn-delete-project" data-id="${project.id}">削除</button>
        </div>
      </div>
    `;
    container.appendChild(div);
  });

  // 新規作成ボタン
  $('#btn-new-project')?.addEventListener('click', () => {
    openProjectForm();
  });

  // 編集ボタン
  $$('.btn-edit-project').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const projectId = e.target.dataset.id;
      const project = appState.projects.find(p => p.id === projectId);
      if (project) openProjectForm(project);
    });
  });

  // 削除ボタン
  $$('.btn-delete-project').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const projectId = e.target.dataset.id;
      const hasTasks = appState.tasks.some(t => t.projectId === projectId);
      if (hasTasks) {
        showToast('タスクが存在するプロジェクトは削除できません', 'danger');
        return;
      }
      if (confirm('このプロジェクトを削除しますか？')) {
        pushUndo();
        appState.projects = appState.projects.filter(p => p.id !== projectId);
        renderProjectList();
        renderProjectSelect();
        saveStateDebounced(appState);
        showToast('プロジェクトを削除しました', 'success');
      }
    });
  });
}

function openProjectForm(project = null) {
  const form = $('#project-form');
  form?.classList.remove('is-hidden');
  $('#project-list')?.classList.add('is-hidden');

  $('#project-form-title').textContent = project ? 'プロジェクト編集' : '新規プロジェクト';
  $('#project-name').value = project?.name || '';
  $('#project-owner').value = project?.owner || '';
  $('#project-start').value = project?.startDate || getToday();
  $('#project-end').value = project?.endDate || '';
  $('#project-status').value = project?.status || 'planned';

  const editingId = project?.id || null;

  $('#btn-save-project').onclick = () => {
    const name = $('#project-name').value.trim();
    if (!name) {
      showToast('プロジェクト名を入力してください', 'warning');
      return;
    }

    pushUndo();
    if (editingId) {
      const p = appState.projects.find(p => p.id === editingId);
      if (p) {
        p.name = name;
        p.owner = $('#project-owner').value.trim() || undefined;
        p.startDate = $('#project-start').value;
        p.endDate = $('#project-end').value;
        p.status = $('#project-status').value;
      }
    } else {
      appState.projects.push({
        id: generateId(),
        name,
        owner: $('#project-owner').value.trim() || undefined,
        startDate: $('#project-start').value,
        endDate: $('#project-end').value,
        status: $('#project-status').value,
      });
    }

    form?.classList.add('is-hidden');
    $('#project-list')?.classList.remove('is-hidden');
    renderProjectList();
    renderProjectSelect();
    saveStateDebounced(appState);
    showToast('プロジェクトを保存しました', 'success');
  };

  $('#btn-cancel-project').onclick = () => {
    form?.classList.add('is-hidden');
    $('#project-list')?.classList.remove('is-hidden');
  };
}

/**
 * タスク編集モーダル
 */
function openTaskModal(task = null) {
  const modal = $('#modal-task');
  modal?.classList.add('is-active');

  $('#task-form-title').textContent = task ? 'タスク編集' : '新規タスク';
  $('#task-name-input').value = task?.name || '';
  $('#task-assignee').value = task?.assignee || '';
  $('#task-start').value = task?.plannedStart || getToday();
  $('#task-end').value = task?.plannedEnd || getToday();
  $('#task-status-select').value = task?.status || 'not_started';
  $('#task-priority').value = task?.priority || 'medium';
  $('#task-progress-input').value = task?.progress || 0;
  $('#task-notes-input').value = task?.notes || '';

  // プロジェクト選択
  const projectSelect = $('#task-project');
  projectSelect.innerHTML = '<option value="">プロジェクトなし</option>';
  appState.projects.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.name;
    option.selected = (task?.projectId === p.id) || (!task && p.id === selectedProjectId);
    projectSelect.appendChild(option);
  });

  const editingId = task?.id || null;

  $('#btn-save-task').onclick = () => {
    const name = $('#task-name-input').value.trim();
    if (!name) {
      showToast('タスク名を入力してください', 'warning');
      return;
    }

    pushUndo();
    if (editingId) {
      const t = appState.tasks.find(t => t.id === editingId);
      if (t) {
        t.name = name;
        t.projectId = $('#task-project').value || null;
        t.assignee = $('#task-assignee').value.trim() || undefined;
        t.plannedStart = $('#task-start').value;
        t.plannedEnd = $('#task-end').value;
        t.status = $('#task-status-select').value;
        t.priority = $('#task-priority').value;
        t.progress = parseInt($('#task-progress-input').value) || 0;
        t.notes = $('#task-notes-input').value.trim() || undefined;
      }
    } else {
      appState.tasks.push({
        id: generateId(),
        projectId: $('#task-project').value || null,
        name,
        assignee: $('#task-assignee').value.trim() || undefined,
        plannedStart: $('#task-start').value,
        plannedEnd: $('#task-end').value,
        status: $('#task-status-select').value,
        priority: $('#task-priority').value,
        progress: parseInt($('#task-progress-input').value) || 0,
        notes: $('#task-notes-input').value.trim() || undefined,
      });
    }

    closeAllModals();
    renderAll();
    saveStateDebounced(appState);
    showToast('タスクを保存しました', 'success');
  };

  $('#btn-delete-task')?.classList.toggle('is-hidden', !editingId);
  $('#btn-delete-task').onclick = () => {
    if (editingId) {
      confirmDeleteTask(editingId);
    }
  };
}

function confirmDeleteTask(taskId) {
  if (!confirm('このタスクと関連する作業ログを削除しますか？')) return;

  pushUndo();
  appState.tasks = appState.tasks.filter(t => t.id !== taskId);
  appState.workLogs = appState.workLogs.filter(l => l.taskId !== taskId);

  if (selectedTaskId === taskId) {
    selectedTaskId = null;
  }

  closeAllModals();
  renderAll();
  saveStateDebounced(appState);
  showToast('タスクを削除しました', 'success');
}

/**
 * 一時タスクモーダル
 */
function openAdhocModal() {
  const modal = $('#modal-adhoc');
  modal?.classList.add('is-active');

  $('#adhoc-date').value = getToday();
  $('#adhoc-title').value = '';
  $('#adhoc-detail').value = '';
  $('#adhoc-hours').value = '';

  // プロジェクト選択
  const projectSelect = $('#adhoc-project');
  projectSelect.innerHTML = '<option value="">関連なし</option>';
  appState.projects.forEach(p => {
    const option = document.createElement('option');
    option.value = p.id;
    option.textContent = p.name;
    projectSelect.appendChild(option);
  });

  $('#btn-save-adhoc').onclick = () => {
    const title = $('#adhoc-title').value.trim();
    if (!title) {
      showToast('タイトルを入力してください', 'warning');
      return;
    }

    pushUndo();
    appState.adhocTasks.push({
      id: generateId(),
      date: $('#adhoc-date').value,
      title,
      detail: $('#adhoc-detail').value.trim() || undefined,
      hours: parseFloat($('#adhoc-hours').value) || undefined,
      relatedProjectId: $('#adhoc-project').value || undefined,
    });

    closeAllModals();
    renderAdhocTasks();
    saveStateDebounced(appState);
    showToast('一時タスクを追加しました', 'success');
  };
}

/**
 * 進捗報告モーダル
 */
function openReportModal() {
  const modal = $('#modal-report');
  modal?.classList.add('is-active');

  // 期間選択の初期値
  const { from, to } = getThisWeekRange();
  $('#report-from').value = from;
  $('#report-to').value = to;

  // プロジェクト選択
  const projectList = $('#report-projects');
  projectList.innerHTML = '';
  appState.projects.forEach(p => {
    const label = document.createElement('label');
    label.className = 'checkbox mr-3';
    label.innerHTML = `<input type="checkbox" value="${p.id}" checked> ${escapeHtml(p.name)}`;
    projectList.appendChild(label);
  });

  $('#report-output').value = '';

  // 期間プリセット
  $('#report-preset-today')?.addEventListener('click', () => {
    const today = getToday();
    $('#report-from').value = today;
    $('#report-to').value = today;
  });

  $('#report-preset-week')?.addEventListener('click', () => {
    const { from, to } = getThisWeekRange();
    $('#report-from').value = from;
    $('#report-to').value = to;
  });

  $('#report-preset-month')?.addEventListener('click', () => {
    const { from, to } = getThisMonthRange();
    $('#report-from').value = from;
    $('#report-to').value = to;
  });

  // 生成ボタン
  $('#btn-generate').onclick = () => {
    const from = $('#report-from').value;
    const to = $('#report-to').value;
    const projectIds = [...projectList.querySelectorAll('input:checked')].map(cb => cb.value);
    const includeAdhoc = $('#report-include-adhoc').checked;

    const report = generateReport(appState, { from, to, projectIds, includeAdhoc });
    $('#report-output').value = report;
  };

  // コピーボタン
  $('#btn-copy-report').onclick = () => {
    const output = $('#report-output');
    output.select();
    navigator.clipboard.writeText(output.value);
    showToast('クリップボードにコピーしました', 'success');
  };
}

/**
 * モーダルを全て閉じる
 */
function closeAllModals() {
  $$('.modal').forEach(m => m.classList.remove('is-active'));
}

/**
 * トースト通知
 */
function showToast(message, type = 'info') {
  const container = $('#toast-container');
  if (!container) return;

  container.innerHTML = '';
  const toast = document.createElement('div');
  toast.className = `notification is-${type}`;
  toast.innerHTML = `<button class="delete"></button>${escapeHtml(message)}`;

  toast.querySelector('.delete')?.addEventListener('click', () => toast.remove());

  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

/**
 * ヘルパー関数
 */
function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function getStatusClass(status) {
  const map = {
    not_started: 'is-light',
    in_progress: 'is-info',
    completed: 'is-success',
    on_hold: 'is-warning',
  };
  return map[status] || 'is-light';
}

function getStatusLabel(status) {
  const map = {
    not_started: '未着手',
    in_progress: '進行中',
    completed: '完了',
    on_hold: '保留',
  };
  return map[status] || status;
}

function getPriorityClass(priority) {
  const map = {
    high: 'is-danger',
    medium: 'is-warning',
    low: 'is-success',
  };
  return map[priority] || 'is-info';
}

function getPriorityLabel(priority) {
  const map = {
    high: '高',
    medium: '中',
    low: '低',
  };
  return map[priority] || priority;
}

function getProjectStatusLabel(status) {
  const map = {
    planned: '計画中',
    active: '進行中',
    completed: '完了',
    on_hold: '保留',
  };
  return map[status] || status;
}

// 検索入力のイベント
$('#task-search')?.addEventListener('input', () => {
  renderTaskTable();
});

// アプリ起動
document.addEventListener('DOMContentLoaded', init);
