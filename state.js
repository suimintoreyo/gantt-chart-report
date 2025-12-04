import { addDays, formatDate } from './dateHelpers.js';

const STORAGE_KEY = 'gantt-app-state';

const memoryStore = (() => {
  let store = {};
  return {
    getItem: (key) => store[key],
    setItem: (key, value) => {
      store[key] = value;
    },
    removeItem: (key) => {
      delete store[key];
    },
  };
})();

const storage = typeof localStorage !== 'undefined' ? localStorage : memoryStore;

const sampleProjectId = 'p1';

export function getInitialState() {
  const today = formatDate(new Date());
  return {
    projects: [
      {
        id: sampleProjectId,
        name: 'Sample project',
        startDate: today,
        endDate: addDays(today, 30),
        status: 'active',
        owner: 'Owner',
      },
    ],
    tasks: [
      {
        id: 't1',
        projectId: sampleProjectId,
        name: 'Design UX',
        plannedStart: today,
        plannedEnd: addDays(today, 5),
        progress: 40,
        status: 'in_progress',
        priority: 'high',
        notes: 'Gather user journeys',
      },
      {
        id: 't2',
        projectId: sampleProjectId,
        name: 'Build prototype',
        plannedStart: addDays(today, 6),
        plannedEnd: addDays(today, 15),
        progress: 10,
        status: 'not_started',
        priority: 'medium',
      },
      {
        id: 't3',
        projectId: sampleProjectId,
        name: 'QA and fixes',
        plannedStart: addDays(today, 16),
        plannedEnd: addDays(today, 25),
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      },
    ],
    workLogs: [],
    adhocTasks: [],
  };
}

export function loadState() {
  const data = storage.getItem(STORAGE_KEY);
  if (!data) return getInitialState();
  try {
    return JSON.parse(data);
  } catch (e) {
    console.warn('Failed to parse saved state, resetting.', e);
    return getInitialState();
  }
}

export function saveState(state) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function upsertProject(state, project) {
  const idx = state.projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) {
    state.projects[idx] = project;
  } else {
    state.projects.push(project);
  }
  return state;
}

export function upsertTask(state, task) {
  const idx = state.tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    state.tasks[idx] = task;
  } else {
    state.tasks.push(task);
  }
  return state;
}

export function addWorkLog(state, log) {
  state.workLogs.push(log);
  return state;
}

export function addAdhocTask(state, adhoc) {
  state.adhocTasks.push(adhoc);
  return state;
}

export function resetState() {
  storage.removeItem(STORAGE_KEY);
  return getInitialState();
}
