import {
  addAdhocTask,
  addWorkLog,
  getInitialState,
  loadState,
  removeTask,
  saveState,
  upsertTask,
} from './state.js';
import { addDays, formatDate } from './dateHelpers.js';
import { renderGantt, renderProgressList, renderTaskTable } from './gantt.js';
import { generateReport } from './report.js';

let appState = loadState();

function persist() {
  saveState(appState);
}

function render() {
  const ganttContainer = document.getElementById('gantt');
  renderGantt(ganttContainer, appState.tasks, (task) => {
    upsertTask(appState, { ...task });
    persist();
    return appState;
  });

  const progressList = document.getElementById('progress-list');
  renderProgressList(progressList, appState.tasks, (taskId, progress) => {
    const task = appState.tasks.find((t) => t.id === taskId);
    if (task) {
      task.progress = progress;
      if (progress === 100) {
        task.status = 'completed';
      } else if (progress > 0) {
        task.status = 'in_progress';
      }
      persist();
      render();
    }
  });

  const tableBody = document.querySelector('#task-table tbody');
  renderTaskTable(tableBody, appState.tasks, (taskId) => {
    removeTask(appState, taskId);
    persist();
    render();
  });

  populateTaskSelects();
}

function setupTaskForm() {
  const form = document.getElementById('task-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const projectId = data.get('projectId') || appState.projects[0]?.id;
    const name = data.get('name');
    const category = data.get('category');
    const start = data.get('plannedStart');
    const end = data.get('plannedEnd');
    const priority = data.get('priority');
    const task = {
      id: `task-${Date.now()}`,
      projectId,
      name,
      category,
      plannedStart: start,
      plannedEnd: end,
      progress: 0,
      status: 'not_started',
      priority,
    };
    upsertTask(appState, task);
    persist();
    form.reset();
    render();
  });

  const startInput = form.querySelector('input[name="plannedStart"]');
  const endInput = form.querySelector('input[name="plannedEnd"]');
  const today = formatDate(new Date());
  startInput.value = today;
  endInput.value = addDays(today, 3);
}

function setupProjectDisplay() {
  const projectInfo = document.getElementById('project-info');
  const project = appState.projects[0];
  if (project) {
    projectInfo.textContent = `${project.name} (${project.startDate} → ${project.endDate})`;
  }
}

function setupWorkLogForm() {
  const form = document.getElementById('worklog-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const log = {
      id: `log-${Date.now()}`,
      taskId: data.get('taskId'),
      date: data.get('date'),
      workNote: data.get('workNote'),
      hours: Number(data.get('hours')) || undefined,
      progressAfter: Number(data.get('progressAfter')) || undefined,
    };
    addWorkLog(appState, log);
    if (log.progressAfter != null) {
      const task = appState.tasks.find((t) => t.id === log.taskId);
      if (task) {
        task.progress = log.progressAfter;
      }
    }
    persist();
    form.reset();
    render();
  });
}

function setupAdhocForm() {
  const form = document.getElementById('adhoc-form');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const task = {
      id: `adhoc-${Date.now()}`,
      date: data.get('date'),
      title: data.get('title'),
      detail: data.get('detail'),
      hours: Number(data.get('hours')) || undefined,
      relatedProjectId: data.get('relatedProjectId') || undefined,
    };
    addAdhocTask(appState, task);
    persist();
    form.reset();
  });
}

function setupReportModal() {
  const modal = document.getElementById('report-modal');
  const overlay = modal.querySelector('.modal-overlay');
  const closeBtn = modal.querySelector('.close-modal');
  const copyBtn = modal.querySelector('#copy-report');

  const close = () => modal.classList.remove('open');
  overlay.addEventListener('click', close);
  closeBtn.addEventListener('click', close);

  copyBtn.addEventListener('click', () => {
    const text = document.getElementById('report-content').value;
    navigator.clipboard?.writeText(text);
    copyBtn.textContent = 'Copied!';
    setTimeout(() => (copyBtn.textContent = 'Copy to clipboard'), 1200);
  });
}

function setupGenerateReport() {
  const form = document.getElementById('report-options');
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const includeAdhoc = data.get('includeAdhoc') === 'on';
    const includeWorkLogs = data.get('includeWorkLogs') === 'on';
    const content = generateReport(appState, { includeAdhoc, includeWorkLogs });
    const textarea = document.getElementById('report-content');
    textarea.value = content;
    document.getElementById('report-modal').classList.add('open');
  });
}

function setupResetButton() {
  const button = document.getElementById('reset-state');
  button.addEventListener('click', () => {
    if (confirm('Reset to initial sample data?')) {
      appState = getInitialState();
      saveState(appState);
      render();
    }
  });
}

function populateTaskSelects() {
  const selects = document.querySelectorAll('[data-task-select]');
  selects.forEach((select) => {
    select.innerHTML = '';
    appState.tasks.forEach((task) => {
      const option = document.createElement('option');
      option.value = task.id;
      option.textContent = task.name;
      select.appendChild(option);
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setupProjectDisplay();
  setupTaskForm();
  setupWorkLogForm();
  setupAdhocForm();
  setupReportModal();
  setupGenerateReport();
  setupResetButton();
  populateTaskSelects();
  render();
});

window.appDebug = {
  getState: () => ({ ...appState }),
  reset: () => {
    appState = getInitialState();
    saveState(appState);
    render();
  },
};
