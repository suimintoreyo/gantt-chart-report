const { addDays, getTasksInPeriod, getDelayedTasks } = require('../main');

describe('date helpers', () => {
  test('addDays offsets ISO dates', () => {
    expect(addDays('2025-01-01', 1)).toBe('2025-01-02');
    expect(addDays('2025-01-31', -1)).toBe('2025-01-30');
  });

  test('getTasksInPeriod returns intersecting tasks', () => {
    const tasks = [
      { plannedStart: '2025-01-01', plannedEnd: '2025-01-05' },
      { plannedStart: '2025-01-06', plannedEnd: '2025-01-10' },
      { plannedStart: '2025-01-10', plannedEnd: '2025-01-12' }
    ];
    const result = getTasksInPeriod(tasks, '2025-01-05', '2025-01-10');
    expect(result).toHaveLength(3);
  });

  test('getDelayedTasks flags tasks overdue and incomplete', () => {
    const tasks = [
      { plannedEnd: '2025-01-01', progress: 50 },
      { plannedEnd: '2025-01-02', progress: 100 },
      { plannedEnd: '2025-01-03', progress: 30 }
    ];
    const delayed = getDelayedTasks(tasks, '2025-01-02');
    expect(delayed).toEqual([{ plannedEnd: '2025-01-01', progress: 50 }]);
  });
});
