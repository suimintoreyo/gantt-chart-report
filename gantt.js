import { addDays, dateDiffInDays, formatDate, toDate } from './dateHelpers.js';
import { updateTaskProgress } from './state.js';

const DAY_WIDTH = 24;

function buildTimeline(startDate, endDate) {
  const days = [];
  let current = toDate(startDate);
  const end = toDate(endDate);
  while (current <= end) {
    days.push(formatDate(current));
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
  }
  return days;
}

function calculateBounds(tasks) {
  if (!tasks.length) {
    const today = formatDate(new Date());
    return { start: today, end: addDays(today, 30) };
  }
  const starts = tasks.map((t) => toDate(t.plannedStart));
  const ends = tasks.map((t) => toDate(t.plannedEnd));
  const minStart = new Date(Math.min(...starts));
  const maxEnd = new Date(Math.max(...ends));
  const paddedEnd = new Date(maxEnd.getTime() + 5 * 24 * 60 * 60 * 1000);
  return { start: formatDate(minStart), end: formatDate(paddedEnd) };
}

function createHandle(side) {
  const handle = document.createElement('div');
  handle.className = `bar-handle handle-${side}`;
  handle.dataset.handle = side;
  return handle;
}

function createBar(task, chartStart, onDragStart) {
  const bar = document.createElement('div');
  bar.className = `gantt-bar status-${task.status}`;
  bar.dataset.taskId = task.id;

  const offset = dateDiffInDays(chartStart, task.plannedStart) * DAY_WIDTH;
  const width = (dateDiffInDays(task.plannedStart, task.plannedEnd) + 1) * DAY_WIDTH;

  bar.style.left = `${offset}px`;
  bar.style.width = `${width}px`;
  bar.title = `${task.name} (${task.progress}%)`;

  bar.appendChild(createHandle('left'));

  const label = document.createElement('span');
  label.className = 'bar-label';
  label.textContent = task.name;
  bar.appendChild(label);

  bar.appendChild(createHandle('right'));

  ['mousedown', 'touchstart'].forEach((ev) => {
    bar.addEventListener(ev, (event) => onDragStart(event, task));
  });

  return bar;
}

function createRow(task, chartStart, onDragStart) {
  const row = document.createElement('div');
  row.className = 'gantt-row';
  const title = document.createElement('div');
  title.className = 'gantt-row-title';
  title.textContent = task.name;
  const track = document.createElement('div');
  track.className = 'gantt-row-track';
  track.appendChild(createBar(task, chartStart, onDragStart));
  row.appendChild(title);
  row.appendChild(track);
  return row;
}

export function renderGantt(container, tasks, onTaskChange) {
  container.innerHTML = '';
  const { start, end } = calculateBounds(tasks);
  const timeline = buildTimeline(start, end);

  const header = document.createElement('div');
  header.className = 'gantt-timeline';
  timeline.forEach((day, index) => {
    const cell = document.createElement('div');
    cell.className = 'gantt-timeline-cell';
    cell.textContent = day.slice(5);
    cell.style.width = `${DAY_WIDTH}px`;
    if (index % 7 === 0) {
      cell.classList.add('timeline-week');
    }
    header.appendChild(cell);
  });
  container.appendChild(header);

  const rowsWrapper = document.createElement('div');
  rowsWrapper.className = 'gantt-rows';

  const dragState = { task: null, mode: null, startX: 0, originalStart: null, originalEnd: null };

  const onDragStart = (event, task) => {
    const target = event.target;
    const isHandle = target.dataset.handle;
    dragState.task = task;
    dragState.mode = isHandle ? `resize-${isHandle}` : 'move';
    dragState.startX = event.touches ? event.touches[0].clientX : event.clientX;
    dragState.originalStart = task.plannedStart;
    dragState.originalEnd = task.plannedEnd;
    event.preventDefault();
  };

  const onDragMove = (event) => {
    if (!dragState.task) return;
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const deltaPx = clientX - dragState.startX;
    const deltaDays = Math.round(deltaPx / DAY_WIDTH);

    const task = dragState.task;
    if (dragState.mode === 'move') {
      const newStart = addDays(dragState.originalStart, deltaDays);
      const newEnd = addDays(dragState.originalEnd, deltaDays);
      task.plannedStart = newStart;
      task.plannedEnd = newEnd;
    } else if (dragState.mode === 'resize-left') {
      const newStart = addDays(dragState.originalStart, deltaDays);
      if (toDate(newStart) <= toDate(task.plannedEnd)) {
        task.plannedStart = newStart;
      }
    } else if (dragState.mode === 'resize-right') {
      const newEnd = addDays(dragState.originalEnd, deltaDays);
      if (toDate(newEnd) >= toDate(task.plannedStart)) {
        task.plannedEnd = newEnd;
      }
    }
    onTaskChange(task);
  };

  const onDragEnd = () => {
    dragState.task = null;
  };

  ['mousemove', 'touchmove'].forEach((ev) => document.addEventListener(ev, onDragMove));
  ['mouseup', 'touchend', 'touchcancel', 'mouseleave'].forEach((ev) => document.addEventListener(ev, onDragEnd));

  tasks.forEach((task) => {
    rowsWrapper.appendChild(createRow(task, start, onDragStart));
  });
  container.appendChild(rowsWrapper);
}

export function renderProgressList(listContainer, tasks, onProgressChange) {
  listContainer.innerHTML = '';
  tasks.forEach((task) => {
    const item = document.createElement('div');
    item.className = 'task-progress-item';
    const label = document.createElement('div');
    label.textContent = `${task.name} (${task.plannedStart} → ${task.plannedEnd})`;
    const controls = document.createElement('div');
    controls.className = 'task-progress-controls';
    const input = document.createElement('input');
    input.type = 'range';
    input.min = 0;
    input.max = 100;
    input.value = task.progress;
    input.addEventListener('input', (e) => {
      const value = Number(e.target.value);
      updateTaskProgress({ tasks }, task.id, value);
      onProgressChange(task.id, value);
    });
    const valueLabel = document.createElement('span');
    valueLabel.textContent = `${task.progress}%`;
    input.addEventListener('input', (e) => {
      valueLabel.textContent = `${e.target.value}%`;
    });
    controls.appendChild(input);
    controls.appendChild(valueLabel);
    item.appendChild(label);
    item.appendChild(controls);
    listContainer.appendChild(item);
  });
}

export function renderTaskTable(tableBody, tasks, onDelete) {
  tableBody.innerHTML = '';
  tasks.forEach((task) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${task.name}</td>
      <td>${task.category || '-'}</td>
      <td>${task.plannedStart}</td>
      <td>${task.plannedEnd}</td>
      <td>${task.progress}%</td>
      <td>${task.status}</td>
      <td><button data-id="${task.id}" class="danger">Delete</button></td>
    `;
    row.querySelector('button').addEventListener('click', () => onDelete(task.id));
    tableBody.appendChild(row);
  });
}
