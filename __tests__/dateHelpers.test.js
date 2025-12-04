import { addDays, getDelayedTasks, getTasksInPeriod } from '../dateHelpers.js';

describe('date helpers', () => {
  it('adds days correctly', () => {
    expect(addDays('2024-01-01', 5)).toBe('2024-01-06');
    expect(addDays('2024-01-31', 1)).toBe('2024-02-01');
  });

  it('filters tasks in period', () => {
    const tasks = [
      { id: '1', plannedStart: '2024-01-01', plannedEnd: '2024-01-05' },
      { id: '2', plannedStart: '2024-02-01', plannedEnd: '2024-02-10' },
      { id: '3', plannedStart: '2024-01-05', plannedEnd: '2024-01-05' },
    ];
    const filtered = getTasksInPeriod(tasks, '2024-01-05', '2024-01-31');
    expect(filtered.map((t) => t.id)).toEqual(['1', '3']);
  });

  it('detects delayed tasks', () => {
    const today = '2024-03-01';
    const tasks = [
      { id: '1', plannedEnd: '2024-02-20', progress: 50 },
      { id: '2', plannedEnd: '2024-03-01', progress: 20 },
      { id: '3', plannedEnd: '2024-02-28', progress: 100 },
    ];
    const delayed = getDelayedTasks(tasks, today);
    expect(delayed.map((t) => t.id)).toEqual(['1']);
  });
});
