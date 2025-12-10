import { addDays, formatDate } from './dateHelpers.js';

const STORAGE_KEY = 'gantt-chart-state';
const memoryStore = { store: new Map() };

function getStorage() {
  if (typeof localStorage !== 'undefined') {
    return localStorage;
  }
  if (!globalThis.__memoryStorage) {
    globalThis.__memoryStorage = {
      getItem: (key) => memoryStore.store.get(key) ?? null,
      setItem: (key, value) => memoryStore.store.set(key, value),
      removeItem: (key) => memoryStore.store.delete(key),
    };
  }
  return globalThis.__memoryStorage;
}

export function getInitialState() {
  const today = formatDate(new Date());
  const nextWeek = addDays(today, 7);
  const defaultProject = {
    id: 'project-1',
    name: 'Sample Project',
    owner: 'You',
    startDate: today,
    endDate: addDays(today, 30),
    status: 'active',
  };

  return {
    projects: [defaultProject],
    tasks: [
      {
        id: 'task-1',
        projectId: defaultProject.id,
        name: 'Kickoff',
        category: 'Planning',
        plannedStart: today,
        plannedEnd: addDays(today, 2),
        progress: 100,
        status: 'completed',
        priority: 'high',
      },
      {
        id: 'task-2',
        projectId: defaultProject.id,
        name: 'Development Sprint',
        category: 'Execution',
        plannedStart: addDays(today, 1),
        plannedEnd: addDays(today, 10),
        progress: 45,
        status: 'in_progress',
        priority: 'medium',
      },
      {
        id: 'task-3',
        projectId: defaultProject.id,
        name: 'Testing',
        category: 'Validation',
        plannedStart: nextWeek,
        plannedEnd: addDays(nextWeek, 5),
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      },
    ],
    workLogs: [],
    adhocTasks: [],
  };
}

export function saveState(state) {
  const storage = getStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState() {
  const storage = getStorage();
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) {
    const initial = getInitialState();
    saveState(initial);
    return initial;
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    return getInitialState();
  }
}

export function clearState() {
  const storage = getStorage();
  storage.removeItem(STORAGE_KEY);
}

export function upsertTask(state, task) {
  const index = state.tasks.findIndex((t) => t.id === task.id);
  if (index >= 0) {
    state.tasks[index] = task;
  } else {
    state.tasks.push(task);
  }
}

export function removeTask(state, taskId) {
  state.tasks = state.tasks.filter((task) => task.id !== taskId);
}

export function updateTaskProgress(state, taskId, progress) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (task) {
    task.progress = Math.min(100, Math.max(0, progress));
    if (task.progress === 100) {
      task.status = 'completed';
    } else if (task.progress > 0) {
      task.status = 'in_progress';
    }
  }
}

export function addWorkLog(state, log) {
  state.workLogs.push(log);
}

export function addAdhocTask(state, task) {
  state.adhocTasks.push(task);
}

export function getProjectById(state, projectId) {
  return state.projects.find((p) => p.id === projectId);
}

export { STORAGE_KEY };
