const { generateReport } = require('../main');

describe('generateReport', () => {
  const state = {
    projects: [
      { id: 'p1', name: 'Project 1', startDate: '2024-01-01', endDate: '2024-02-01', status: 'active' },
    ],
    tasks: [
      { id: 't1', projectId: 'p1', name: '完了タスク', plannedStart: '2024-01-01', plannedEnd: '2024-01-02', progress: 100 },
      { id: 't2', projectId: 'p1', name: '進行中タスク', plannedStart: '2024-01-02', plannedEnd: '2024-01-10', progress: 60 },
      { id: 't3', projectId: 'p1', name: '遅延タスク', plannedStart: '2023-12-20', plannedEnd: '2023-12-25', progress: 20 },
    ],
    workLogs: [],
    adhocTasks: [
      { id: 'a1', date: '2024-01-05', title: '問い合わせ対応', detail: '', hours: 2, relatedProjectId: 'p1' },
    ],
    uiPreferences: {},
  };

  test('includes completed, in-progress, delayed sections', () => {
    const text = generateReport(state, { from: '2024-01-01', to: '2024-01-10', projectIds: ['p1'], includeAdhoc: false });
    expect(text).toContain('【完了タスク】');
    expect(text).toContain('完了タスク');
    expect(text).toContain('進行中タスク');
    expect(text).toContain('遅延タスク');
    expect(text).toContain('進行中タスク (60%)');
    expect(text).toContain('遅延懸念');
  });

  test('adhoc section appears only when includeAdhoc is true', () => {
    const without = generateReport(state, { from: '2024-01-01', to: '2024-01-10', projectIds: ['p1'], includeAdhoc: false });
    expect(without).not.toContain('一時タスク');

    const withAdhoc = generateReport(state, { from: '2024-01-01', to: '2024-01-10', projectIds: ['p1'], includeAdhoc: true });
    expect(withAdhoc).toContain('一時タスク');
    expect(withAdhoc).toContain('問い合わせ対応');
  });
});
