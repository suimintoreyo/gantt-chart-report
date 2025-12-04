import { generateReport } from '../report.js';

const baseState = {
  tasks: [
    {
      id: 'done',
      name: 'Complete task',
      plannedStart: '2024-01-01',
      plannedEnd: '2024-01-03',
      progress: 100,
      status: 'completed',
    },
    {
      id: 'doing',
      name: 'Ongoing task',
      plannedStart: '2024-01-02',
      plannedEnd: '2024-01-05',
      progress: 20,
      status: 'in_progress',
    },
    {
      id: 'late',
      name: 'Late task',
      plannedStart: '2023-12-28',
      plannedEnd: '2023-12-30',
      progress: 40,
      status: 'in_progress',
    },
  ],
  adhocTasks: [
    { id: 'adhoc1', date: '2024-01-04', title: 'Support call' },
  ],
  workLogs: [
    { id: 'log1', taskId: 'doing', date: '2024-01-03', workNote: 'Investigated issue', hours: 2 },
  ],
};

test('report separates task statuses', () => {
  const report = generateReport(baseState, { today: '2024-01-04', includeAdhoc: true });
  expect(report).toMatch(/Completed:/);
  expect(report).toMatch(/In Progress:/);
  expect(report).toMatch(/Delayed:/);
  expect(report).toMatch(/Ad-hoc:/);
});

test('delayed tasks appear only when overdue and incomplete', () => {
  const report = generateReport(baseState, { today: '2024-01-04' });
  expect(report).toMatch(/Late task/);
  expect(report).not.toMatch(/Complete task/);
});

test('work logs are included when requested', () => {
  const report = generateReport(baseState, { today: '2024-01-04', includeWorkLogs: true });
  expect(report).toMatch(/Investigated issue/);
});
