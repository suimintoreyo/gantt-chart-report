const { saveState, loadState, DEFAULT_STATE, STORAGE_KEY } = require('../main');

function createMockStorage() {
  const store = new Map();
  return {
    setItem: (k, v) => store.set(k, v),
    getItem: (k) => store.get(k) || null,
    removeItem: (k) => store.delete(k),
    store,
  };
}

describe('saveState / loadState', () => {
  test('saved AppState can be restored with same values', () => {
    const mock = createMockStorage();
    const state = {
      projects: [{ id: 'p1', name: 'P', startDate: '2024-01-01', endDate: '2024-01-10', status: 'active' }],
      tasks: [],
      workLogs: [],
      adhocTasks: [],
      uiPreferences: { ganttZoomLevel: 1 },
    };
    saveState(state, mock);
    const raw = mock.getItem(STORAGE_KEY);
    expect(raw).toBeTruthy();
    const loaded = loadState(mock);
    expect(loaded).toEqual(state);
  });

  test('when storage is empty, returns initial state clone', () => {
    const mock = createMockStorage();
    const loaded = loadState(mock);
    expect(loaded).toEqual(DEFAULT_STATE);
    expect(loaded).not.toBe(DEFAULT_STATE);
  });
});
