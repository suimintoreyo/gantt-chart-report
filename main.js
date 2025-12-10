(function (global) {
  const STORAGE_KEY = 'gantt_app_state_v1';
  const DAY_WIDTH = 64;

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function addDays(dateStr, n) {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  function diffDays(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    return Math.round((e - s) / (1000 * 60 * 60 * 24));
  }

  function getInitialState() {
    const baseStart = todayISO();
    return {
      projects: [
        {
          id: 'proj-1',
          name: 'Demo Project',
          owner: 'You',
          startDate: baseStart,
          endDate: addDays(baseStart, 30),
          status: 'active'
        }
      ],
      tasks: [
        {
          id: 'task-1',
          projectId: 'proj-1',
          name: 'Research requirements',
          plannedStart: baseStart,
          plannedEnd: addDays(baseStart, 4),
          progress: 50,
          status: 'in_progress',
          priority: 'high'
        },
        {
          id: 'task-2',
          projectId: 'proj-1',
          name: 'Prototype UI',
          plannedStart: addDays(baseStart, 2),
          plannedEnd: addDays(baseStart, 10),
          progress: 30,
          status: 'in_progress',
          priority: 'medium'
        },
        {
          id: 'task-3',
          projectId: 'proj-1',
          name: 'Prepare report',
          plannedStart: addDays(baseStart, 7),
          plannedEnd: addDays(baseStart, 12),
          progress: 0,
          status: 'not_started',
          priority: 'medium'
        }
      ],
      workLogs: [],
      adhocTasks: [
        {
          id: 'adhoc-1',
          date: baseStart,
          title: 'Team sync',
          detail: 'Aligned on scope and milestones',
          hours: 1.5
        }
      ]
    };
  }

  function saveState(state) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function loadState() {
    if (typeof localStorage === 'undefined') return getInitialState();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getInitialState();
    try {
      const parsed = JSON.parse(raw);
      return {
        projects: parsed.projects || [],
        tasks: parsed.tasks || [],
        workLogs: parsed.workLogs || [],
        adhocTasks: parsed.adhocTasks || []
      };
    } catch (e) {
      console.warn('Failed to parse saved state, resetting', e);
      return getInitialState();
    }
  }

  function normalizeRange(from, to) {
    if (!from || !to) return { from, to };
    return from <= to ? { from, to } : { from: to, to: from };
  }

  function getTasksInPeriod(tasks, from, to) {
    const range = normalizeRange(from, to);
    return tasks.filter((task) => task.plannedStart <= range.to && task.plannedEnd >= range.from);
  }

  function getDelayedTasks(tasks, today) {
    return tasks.filter((task) => task.plannedEnd < today && task.progress < 100);
  }

  function generateReport(appState, options = {}) {
    const opts = { includeAdhoc: true, today: todayISO(), ...options };
    const lines = [];
    const today = opts.today;

    const completed = appState.tasks.filter((t) => t.progress === 100 || t.status === 'completed');
    const inProgress = appState.tasks.filter((t) => t.progress > 0 && t.progress < 100 && t.status !== 'on_hold');
    const delayed = getDelayedTasks(appState.tasks, today);

    lines.push(`Report date: ${today}`);
    lines.push('');

    lines.push('Completed tasks:');
    lines.push(...(completed.length ? completed.map((t) => `- ${t.name} (${t.plannedStart} → ${t.plannedEnd})`) : ['- None']));
    lines.push('');

    lines.push('In-progress tasks:');
    lines.push(
      ...(inProgress.length
        ? inProgress.map((t) => `- ${t.name}: ${t.progress}% (ends ${t.plannedEnd})`)
        : ['- None'])
    );
    lines.push('');

    lines.push('Delayed tasks:');
    lines.push(...(delayed.length ? delayed.map((t) => `- ${t.name} (was due ${t.plannedEnd})`) : ['- None']));
    lines.push('');

    if (opts.includeAdhoc) {
      lines.push('Ad-hoc tasks:');
      lines.push(
        ...(appState.adhocTasks.length
          ? appState.adhocTasks.map((a) => `- ${a.date}: ${a.title}${a.hours ? ` (${a.hours}h)` : ''}`)
          : ['- None'])
      );
      lines.push('');
    }

    lines.push('Next steps:');
    lines.push('- Highlight risks and unblock dependencies.');

    return lines.join('\n');
  }

  // UI state and rendering
  let appState = loadState();

  const elements = {};
  function cacheElements() {
    elements.taskForm = document.getElementById('taskForm');
    elements.taskName = document.getElementById('taskName');
    elements.plannedStart = document.getElementById('plannedStart');
    elements.plannedEnd = document.getElementById('plannedEnd');
    elements.progress = document.getElementById('progress');
    elements.status = document.getElementById('status');
    elements.priority = document.getElementById('priority');
    elements.taskListBody = document.getElementById('taskListBody');
    elements.ganttContainer = document.getElementById('ganttContainer');
    elements.generateReportBtn = document.getElementById('generateReportBtn');
    elements.reportModal = document.getElementById('reportModal');
    elements.reportOutput = document.getElementById('reportOutput');
    elements.copyReportBtn = document.getElementById('copyReportBtn');
    elements.closeReportBtn = document.getElementById('closeReportBtn');
    elements.includeAdhoc = document.getElementById('includeAdhoc');
    elements.regenReportBtn = document.getElementById('regenReportBtn');
    elements.resetStateBtn = document.getElementById('resetStateBtn');
    elements.toast = document.getElementById('toast');
  }

  function renderTaskList() {
    if (!elements.taskListBody) return;
    elements.taskListBody.innerHTML = '';
    [...appState.tasks]
      .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart))
      .forEach((task) => {
        const row = document.createElement('div');
        row.className = 'task-row';
        row.innerHTML = `
          <span>${task.name}</span>
          <span>${task.plannedStart}</span>
          <span>${task.plannedEnd}</span>
          <span>${task.progress}%</span>
          <span class="status"><span class="status-dot status-${task.status}"></span>${task.status.replace('_', ' ')}</span>
        `;
        elements.taskListBody.appendChild(row);
      });
  }

  function getChartBounds(tasks) {
    if (!tasks.length) {
      const start = todayISO();
      return { start, end: addDays(start, 7) };
    }
    const starts = tasks.map((t) => t.plannedStart);
    const ends = tasks.map((t) => t.plannedEnd);
    const minStart = starts.reduce((a, b) => (a < b ? a : b));
    const maxEnd = ends.reduce((a, b) => (a > b ? a : b));
    return { start: addDays(minStart, -2), end: addDays(maxEnd, 2) };
  }

  function renderGantt() {
    if (!elements.ganttContainer) return;
    elements.ganttContainer.innerHTML = '';
    const bounds = getChartBounds(appState.tasks);
    const totalDays = diffDays(bounds.start, bounds.end) + 1;

    const header = document.createElement('div');
    header.className = 'gantt-header';
    for (let i = 0; i < totalDays; i++) {
      const date = addDays(bounds.start, i);
      const cell = document.createElement('div');
      cell.textContent = date.slice(5);
      header.appendChild(cell);
    }

    const grid = document.createElement('div');
    grid.className = 'gantt-grid';
    grid.appendChild(header);

    [...appState.tasks]
      .sort((a, b) => a.plannedStart.localeCompare(b.plannedStart))
      .forEach((task) => {
        const row = document.createElement('div');
        row.className = 'gantt-row';
        const label = document.createElement('div');
        label.className = 'gantt-label';
        label.textContent = task.name;
        row.appendChild(label);

        const track = document.createElement('div');
        track.className = 'gantt-track';

        const bar = document.createElement('div');
        bar.className = `gantt-bar ${task.status}`;
        const offset = diffDays(bounds.start, task.plannedStart);
        const length = diffDays(task.plannedStart, task.plannedEnd) + 1;
        bar.style.left = `${offset * DAY_WIDTH}px`;
        bar.style.width = `${length * DAY_WIDTH}px`;
        bar.dataset.taskId = task.id;

        const progress = document.createElement('div');
        progress.className = 'progress';
        progress.style.width = `${Math.min(task.progress, 100)}%`;
        bar.appendChild(progress);

        const handleStart = document.createElement('div');
        handleStart.className = 'handle start';
        handleStart.dataset.taskId = task.id;
        handleStart.dataset.handle = 'start';
        bar.appendChild(handleStart);

        const handleEnd = document.createElement('div');
        handleEnd.className = 'handle end';
        handleEnd.dataset.taskId = task.id;
        handleEnd.dataset.handle = 'end';
        bar.appendChild(handleEnd);

        bar.addEventListener('mousedown', onBarMouseDown);
        handleStart.addEventListener('mousedown', onHandleMouseDown);
        handleEnd.addEventListener('mousedown', onHandleMouseDown);

        track.appendChild(bar);
        row.appendChild(track);
        grid.appendChild(row);
      });

    elements.ganttContainer.appendChild(grid);
  }

  function updateTask(taskId, updates) {
    const idx = appState.tasks.findIndex((t) => t.id === taskId);
    if (idx === -1) return;
    const nextTask = { ...appState.tasks[idx], ...updates };
    const didChange = Object.keys(nextTask).some((key) => nextTask[key] !== appState.tasks[idx][key]);
    if (!didChange) return;
    appState.tasks[idx] = nextTask;
    saveState(appState);
    renderTaskList();
    renderGantt();
  }

  function onBarMouseDown(event) {
    if (event.target.classList.contains('handle')) return; // handled separately
    startDrag(event, 'move');
  }

  function onHandleMouseDown(event) {
    event.stopPropagation();
    const handleType = event.target.dataset.handle;
    startDrag(event, handleType === 'start' ? 'resize-start' : 'resize-end');
  }

  let dragContext = null;

  function startDrag(event, mode) {
    const bar = event.currentTarget.closest('.gantt-bar');
    const taskId = bar.dataset.taskId;
    const task = appState.tasks.find((t) => t.id === taskId);
    if (!task) return;

    dragContext = {
      mode,
      taskId,
      startX: event.clientX,
      originalStart: task.plannedStart,
      originalEnd: task.plannedEnd
    };

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', endDrag);
  }

  function onDragMove(event) {
    if (!dragContext) return;
    const dx = event.clientX - dragContext.startX;
    const daysDelta = Math.round(dx / DAY_WIDTH);
    const task = appState.tasks.find((t) => t.id === dragContext.taskId);
    if (!task) return;

    if (dragContext.mode === 'move') {
      const newStart = addDays(dragContext.originalStart, daysDelta);
      const duration = diffDays(dragContext.originalStart, dragContext.originalEnd);
      const newEnd = addDays(newStart, duration);
      updateTask(task.id, { plannedStart: newStart, plannedEnd: newEnd });
    } else if (dragContext.mode === 'resize-start') {
      const proposed = addDays(dragContext.originalStart, daysDelta);
      if (new Date(proposed) > new Date(task.plannedEnd)) return;
      updateTask(task.id, { plannedStart: proposed });
    } else if (dragContext.mode === 'resize-end') {
      const proposed = addDays(dragContext.originalEnd, daysDelta);
      if (new Date(proposed) < new Date(task.plannedStart)) return;
      updateTask(task.id, { plannedEnd: proposed });
    }
  }

  function endDrag() {
    dragContext = null;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', endDrag);
  }

  function showToast(message) {
    if (!elements.toast) return;
    elements.toast.textContent = message;
    elements.toast.classList.add('visible');
    elements.toast.classList.remove('hidden');
    setTimeout(() => {
      elements.toast.classList.remove('visible');
      elements.toast.classList.add('hidden');
    }, 1600);
  }

  function openReportModal() {
    elements.reportModal.classList.remove('hidden');
    elements.reportModal.setAttribute('aria-hidden', 'false');
    elements.reportOutput.value = generateReport(appState, {
      includeAdhoc: elements.includeAdhoc.checked
    });
  }

  function closeReportModal() {
    elements.reportModal.classList.add('hidden');
    elements.reportModal.setAttribute('aria-hidden', 'true');
  }

  function registerEvents() {
    if (!elements.taskForm) return;
    elements.taskForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target;
      const name = form.taskName.value.trim();
      if (!name) return;

      const newTask = {
        id: `task-${Date.now()}`,
        projectId: appState.projects[0].id,
        name,
        plannedStart: form.plannedStart.value,
        plannedEnd: form.plannedEnd.value,
        progress: Number(form.progress.value) || 0,
        status: form.status.value,
        priority: form.priority.value
      };
      appState.tasks.push(newTask);
      saveState(appState);
      renderTaskList();
      renderGantt();
      form.reset();
    });

    elements.generateReportBtn.addEventListener('click', openReportModal);
    elements.closeReportBtn.addEventListener('click', closeReportModal);
    elements.regenReportBtn.addEventListener('click', () => {
      elements.reportOutput.value = generateReport(appState, {
        includeAdhoc: elements.includeAdhoc.checked
      });
    });
    elements.copyReportBtn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(elements.reportOutput.value);
      showToast('Report copied');
    });
    elements.reportModal.addEventListener('click', (e) => {
      if (e.target === elements.reportModal) closeReportModal();
    });
    elements.resetStateBtn.addEventListener('click', () => {
      appState = getInitialState();
      saveState(appState);
      renderTaskList();
      renderGantt();
    });
  }

  function init() {
    if (typeof document === 'undefined') return;
    cacheElements();
    const defaultStart = todayISO();
    if (elements.plannedStart) elements.plannedStart.value = defaultStart;
    if (elements.plannedEnd) elements.plannedEnd.value = addDays(defaultStart, 3);
    renderTaskList();
    renderGantt();
    registerEvents();
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', init);
  }

  const exported = {
    STORAGE_KEY,
    addDays,
    diffDays,
    getTasksInPeriod,
    getDelayedTasks,
    generateReport,
    getInitialState,
    loadState,
    saveState
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = exported;
  } else {
    Object.assign(global, exported);
  }
})(typeof window !== 'undefined' ? window : globalThis);
