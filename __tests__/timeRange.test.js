const { calculateTaskDelay, getDelayedTasks, getTasksInPeriod } = require('../main');

describe('delay detection', () => {
  const baseTask = {
    id: 't1',
    projectId: 'p',
    name: 'sample',
    plannedStart: '2024-01-01',
    plannedEnd: '2024-01-05',
    progress: 50,
    status: 'in_progress',
  };

  test('returns overdue days when plannedEnd is before today and progress < 100', () => {
    const delay = calculateTaskDelay(baseTask, '2024-01-10');
    expect(delay).toBe(5);
  });

  test('returns null when plannedEnd is today or progress 100', () => {
    expect(calculateTaskDelay(baseTask, '2024-01-05')).toBeNull();
    expect(calculateTaskDelay({ ...baseTask, progress: 100 }, '2024-01-10')).toBeNull();
  });

  test('getDelayedTasks filters only delayed items', () => {
    const tasks = [
      baseTask,
      { ...baseTask, id: 't2', plannedEnd: '2024-01-10', progress: 20 },
      { ...baseTask, id: 't3', progress: 100 },
    ];
    const delayed = getDelayedTasks(tasks, '2024-01-08');
    expect(delayed.map((t) => t.id)).toEqual(['t1']);
  });
});

describe('period filter', () => {
  const tasks = [
    { id: 'a', projectId: 'p', plannedStart: '2024-01-01', plannedEnd: '2024-01-03' },
    { id: 'b', projectId: 'p', plannedStart: '2024-01-03', plannedEnd: '2024-01-05' },
    { id: 'c', projectId: 'p', plannedStart: '2024-02-01', plannedEnd: '2024-02-03' },
  ];

  test('returns tasks that intersect the period', () => {
    const res = getTasksInPeriod(tasks, '2024-01-02', '2024-01-04');
    expect(res.map((t) => t.id)).toEqual(['a', 'b']);
  });

  test('includes boundary dates', () => {
    const res = getTasksInPeriod(tasks, '2024-01-03', '2024-01-03');
    expect(res.map((t) => t.id)).toEqual(['a', 'b']);
  });
});
