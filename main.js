import { renderGantt } from './gantt.js';
import {
  addAdhocTask,
  addWorkLog,
  loadState,
  resetState,
  saveState,
  upsertProject,
  upsertTask,
} from './state.js';
import { generateReport } from './report.js';

let state = loadState();

const projectForm = document.getElementById('projectForm');
const taskForm = document.getElementById('taskForm');
const logForm = document.getElementById('logForm');
const adhocForm = document.getElementById('adhocForm');
const projectList = document.getElementById('projectList');
const taskList = document.getElementById('taskList');
const logList = document.getElementById('logList');
const adhocList = document.getElementById('adhocList');
const ganttContainer = document.getElementById('ganttContainer');
const reportOutput = document.getElementById('reportOutput');
const includeAdhoc = document.getElementById('includeAdhoc');

const taskProject = document.getElementById('taskProject');
const logTask = document.getElementById('logTask');

function uid(prefix) {
  return `${prefix}-${Math.random().toString(16).slice(2, 8)}`;
}

function syncSelectOptions() {
  taskProject.innerHTML = '';
  logTask.innerHTML = '';
  state.projects.forEach((p) => {
    const opt = new Option(p.name, p.id);
    taskProject.appendChild(opt.cloneNode(true));
    logTask.appendChild(opt);
  });
}

function renderLists() {
  projectList.innerHTML = state.projects
    .map((p) => `<li><strong>${p.name}</strong> (${p.status}) ${p.startDate} → ${p.endDate}</li>`)
    .join('');

  taskList.innerHTML = state.tasks
    .map(
      (t) =>
        `<li><strong>${t.name}</strong> (${t.progress}% · ${t.status})<div class="badge">${t.plannedStart} → ${t.plannedEnd}</div></li>`
    )
    .join('');

  logList.innerHTML = state.workLogs
    .map((l) => `<li><strong>${l.date}</strong> ${l.workNote} (${l.hours || 0}h)</li>`)
    .join('');

  adhocList.innerHTML = state.adhocTasks
    .map((a) => `<li><strong>${a.date}</strong> ${a.title} (${a.hours || 0}h)</li>`)
    .join('');
}

function showToast(message) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 1800);
}

function persist() {
  saveState(state);
  render();
}

function renderReport() {
  reportOutput.value = generateReport(state, { includeAdhoc: includeAdhoc.checked });
}

function render() {
  syncSelectOptions();
  renderLists();
  renderGantt(ganttContainer, state, (updatedTask) => {
    state = upsertTask(state, updatedTask);
    persist();
  });
  renderReport();
}

projectForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(projectForm);
  const project = {
    id: uid('p'),
    name: data.get('name'),
    startDate: data.get('startDate'),
    endDate: data.get('endDate'),
    status: data.get('status'),
  };
  state = upsertProject(state, project);
  projectForm.reset();
  persist();
});

taskForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(taskForm);
  const task = {
    id: uid('t'),
    projectId: data.get('projectId'),
    name: data.get('name'),
    plannedStart: data.get('plannedStart'),
    plannedEnd: data.get('plannedEnd'),
    progress: Number(data.get('progress') || 0),
    status: data.get('status'),
    priority: data.get('priority'),
    notes: data.get('notes'),
  };
  state = upsertTask(state, task);
  taskForm.reset();
  persist();
});

logForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(logForm);
  const log = {
    id: uid('log'),
    taskId: data.get('taskId'),
    date: data.get('date'),
    workNote: data.get('workNote'),
    hours: Number(data.get('hours') || 0),
    progressAfter: Number(data.get('progressAfter') || 0),
  };
  state = addWorkLog(state, log);
  logForm.reset();
  persist();
});

adhocForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = new FormData(adhocForm);
  const adhoc = {
    id: uid('adhoc'),
    date: data.get('date'),
    title: data.get('title'),
    detail: data.get('detail'),
    hours: Number(data.get('hours') || 0),
  };
  state = addAdhocTask(state, adhoc);
  adhocForm.reset();
  persist();
});

includeAdhoc.addEventListener('change', renderReport);

document.getElementById('generateReport').addEventListener('click', renderReport);
document.getElementById('copyReport').addEventListener('click', async () => {
  await navigator.clipboard.writeText(reportOutput.value);
  showToast('Report copied to clipboard');
});
document.getElementById('clearStorage').addEventListener('click', () => {
  state = resetState();
  persist();
  showToast('Data cleared');
});

render();
