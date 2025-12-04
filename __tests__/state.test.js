const { saveState, loadState, getInitialState, STORAGE_KEY } = require('../main');

describe('state persistence', () => {
  beforeEach(() => {
    global.localStorage = (() => {
      let store = {};
      return {
        getItem: (k) => store[k] || null,
        setItem: (k, v) => {
          store[k] = String(v);
        },
        clear: () => {
          store = {};
        }
      };
    })();
  });

  test('saveState then loadState restores data', () => {
    const state = getInitialState();
    state.tasks.push({ id: 'x', projectId: 'proj-1', name: 'extra', plannedStart: '2025-01-01', plannedEnd: '2025-01-02', progress: 0, status: 'not_started' });
    saveState(state);
    const loaded = loadState();
    expect(loaded).toEqual(state);
  });

  test('loadState returns initial when storage empty', () => {
    const loaded = loadState();
    expect(loaded).toEqual(getInitialState());
  });
});
