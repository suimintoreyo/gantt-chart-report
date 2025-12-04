import { getInitialState, loadState, resetState, saveState } from '../state.js';

describe('state persistence', () => {
  beforeEach(() => {
    resetState();
  });

  it('returns initial state when nothing saved', () => {
    const state = loadState();
    expect(state.projects.length).toBeGreaterThan(0);
    expect(state.tasks.length).toBeGreaterThan(0);
  });

  it('saves and loads state consistently', () => {
    const state = getInitialState();
    state.projects.push({
      id: 'p-new',
      name: 'Inserted',
      startDate: '2024-01-01',
      endDate: '2024-01-10',
      status: 'planned',
    });
    saveState(state);

    const loaded = loadState();
    expect(loaded.projects.find((p) => p.id === 'p-new')).toMatchObject({ name: 'Inserted' });
    expect(loaded.tasks.length).toBe(state.tasks.length);
  });
});
