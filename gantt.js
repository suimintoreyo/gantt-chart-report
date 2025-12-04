import { addDays, daysBetween, formatDate, getRange } from './dateHelpers.js';

const DAY_WIDTH = 32;

const STATUS_COLORS = {
  not_started: '#6366f1',
  in_progress: '#38bdf8',
  completed: '#22c55e',
  on_hold: '#f59e0b',
};

function clampDate(dateStr, min, max) {
  const d = new Date(dateStr);
  if (d < new Date(min)) return min;
  if (d > new Date(max)) return max;
  return formatDate(d);
}

function buildTimeline(tasks) {
  if (!tasks.length) {
    const today = formatDate(new Date());
    return { start: today, end: addDays(today, 14) };
  }
  const start = tasks.reduce((acc, t) => (new Date(t.plannedStart) < new Date(acc) ? t.plannedStart : acc), tasks[0].plannedStart);
  const end = tasks.reduce((acc, t) => (new Date(t.plannedEnd) > new Date(acc) ? t.plannedEnd : acc), tasks[0].plannedEnd);
  return { start, end: addDays(end, 2) };
}

export function renderGantt(container, state, onUpdateTask) {
  container.innerHTML = '';
  const { start, end } = buildTimeline(state.tasks);
  const days = getRange(start, end);

  const grid = document.createElement('div');
  grid.className = 'gantt-grid';

  const header = document.createElement('div');
  header.className = 'gantt-header';
  days.forEach((day) => {
    const el = document.createElement('div');
    el.className = 'gantt-day';
    el.textContent = day.slice(5);
    header.appendChild(el);
  });
  grid.appendChild(header);

  const rows = document.createElement('div');
  rows.className = 'gantt-rows';

  state.tasks.forEach((task, index) => {
    const row = document.createElement('div');
    row.className = 'gantt-row';
    row.style.top = `${index * 32}px`;
    row.style.height = '32px';
    row.textContent = task.name;

    const bar = document.createElement('div');
    bar.className = 'gantt-bar';
    bar.dataset.id = task.id;
    const left = daysBetween(start, task.plannedStart) * DAY_WIDTH;
    const width = (daysBetween(task.plannedStart, task.plannedEnd) + 1) * DAY_WIDTH;
    bar.style.left = `${left}px`;
    bar.style.width = `${width}px`;
    bar.style.background = STATUS_COLORS[task.status] || STATUS_COLORS.not_started;
    bar.title = `${task.plannedStart} → ${task.plannedEnd}`;

    const startHandle = document.createElement('div');
    startHandle.className = 'handle start';
    const endHandle = document.createElement('div');
    endHandle.className = 'handle end';

    const label = document.createElement('span');
    label.style.flex = '1';
    label.textContent = `${task.name} (${task.progress}%)`;

    bar.append(startHandle, label, endHandle);
    attachDrag(bar, startHandle, endHandle, task, { start, end, onUpdateTask });

    row.appendChild(bar);
    rows.appendChild(row);
  });

  grid.appendChild(rows);
  container.appendChild(grid);
}

function attachDrag(bar, startHandle, endHandle, task, ctx) {
  let dragging = null;
  const baseLeft = bar.style.left;

  const onMouseDown = (type) => (e) => {
    e.preventDefault();
    const rect = bar.getBoundingClientRect();
    dragging = {
      type,
      startX: e.clientX,
      startLeft: rect.left,
      offset: e.clientX - rect.left,
      originalStart: task.plannedStart,
      originalEnd: task.plannedEnd,
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    const deltaPx = e.clientX - dragging.startX;
    const deltaDays = Math.round(deltaPx / DAY_WIDTH);

    if (dragging.type === 'move') {
      const newStart = clampDate(addDays(dragging.originalStart, deltaDays), ctx.start, ctx.end);
      const span = daysBetween(dragging.originalStart, dragging.originalEnd);
      const newEnd = addDays(newStart, span);
      task.plannedStart = newStart;
      task.plannedEnd = clampDate(newEnd, ctx.start, ctx.end);
    }

    if (dragging.type === 'resize-start') {
      const candidate = addDays(dragging.originalStart, deltaDays);
      if (new Date(candidate) <= new Date(task.plannedEnd)) {
        task.plannedStart = clampDate(candidate, ctx.start, task.plannedEnd);
      }
    }

    if (dragging.type === 'resize-end') {
      const candidate = addDays(dragging.originalEnd, deltaDays);
      if (new Date(candidate) >= new Date(task.plannedStart)) {
        task.plannedEnd = clampDate(candidate, task.plannedStart, ctx.end);
      }
    }

    const left = daysBetween(ctx.start, task.plannedStart) * DAY_WIDTH;
    const width = (daysBetween(task.plannedStart, task.plannedEnd) + 1) * DAY_WIDTH;
    bar.style.left = `${left}px`;
    bar.style.width = `${width}px`;
  };

  const onMouseUp = () => {
    if (dragging) {
      ctx.onUpdateTask({ ...task });
    }
    dragging = null;
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  };

  bar.addEventListener('mousedown', onMouseDown('move'));
  startHandle.addEventListener('mousedown', onMouseDown('resize-start'));
  endHandle.addEventListener('mousedown', onMouseDown('resize-end'));
}
