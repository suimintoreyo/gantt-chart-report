import { clearState, getInitialState, loadState, saveState, STORAGE_KEY } from '../state.js';

beforeEach(() => {
  clearState();
});

test('saveState and loadState round trip', () => {
  const initial = getInitialState();
  initial.tasks.push({
    id: 'task-extra',
    projectId: 'project-1',
    name: 'Extra',
    plannedStart: '2024-01-01',
    plannedEnd: '2024-01-03',
    progress: 50,
    status: 'in_progress',
  });
  saveState(initial);
  const loaded = loadState();
  expect(loaded.tasks.find((t) => t.id === 'task-extra')).toBeTruthy();
});

test('loadState falls back to initial when missing', () => {
  const state = loadState();
  expect(state.tasks.length).toBeGreaterThan(0);
});

