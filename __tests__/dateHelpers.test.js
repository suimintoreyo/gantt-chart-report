import { addDays, getDelayedTasks, getTasksInPeriod } from '../dateHelpers.js';

const tasks = [
  {
    id: 'a',
    plannedStart: '2024-01-01',
    plannedEnd: '2024-01-05',
    progress: 100,
  },
  {
    id: 'b',
    plannedStart: '2024-01-05',
    plannedEnd: '2024-01-10',
    progress: 30,
  },
  {
    id: 'c',
    plannedStart: '2024-01-11',
    plannedEnd: '2024-01-12',
    progress: 0,
  },
];

test('addDays shifts date forward', () => {
  expect(addDays('2024-01-01', 5)).toBe('2024-01-06');
});

test('getTasksInPeriod includes intersecting tasks', () => {
  const result = getTasksInPeriod(tasks, '2024-01-05', '2024-01-11');
  expect(result.map((t) => t.id)).toEqual(['a', 'b', 'c']);
});

test('getDelayedTasks finds overdue tasks', () => {
  const delayed = getDelayedTasks(tasks, '2024-01-11');
  expect(delayed.map((t) => t.id)).toEqual(['b']);
});
