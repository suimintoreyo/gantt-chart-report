import { generateReport } from '../report.js';

const baseState = {
  projects: [
    { id: 'p1', name: 'Proj', startDate: '2024-01-01', endDate: '2024-02-01', status: 'active' },
  ],
  tasks: [
    { id: 't1', name: 'Done', plannedStart: '2024-01-01', plannedEnd: '2024-01-05', progress: 100, status: 'completed' },
    { id: 't2', name: 'Doing', plannedStart: '2024-01-06', plannedEnd: '2024-01-20', progress: 50, status: 'in_progress' },
    { id: 't3', name: 'Late', plannedStart: '2024-01-01', plannedEnd: '2024-01-10', progress: 20, status: 'in_progress' },
  ],
  workLogs: [
    { id: 'log1', taskId: 't2', date: '2024-01-10', workNote: 'Halfway there', hours: 4, progressAfter: 50 },
  ],
  adhocTasks: [
    { id: 'a1', date: '2024-01-15', title: 'Support', hours: 2 },
  ],
};

describe('report generation', () => {
  it('includes tasks by status', () => {
    const report = generateReport(baseState, { includeAdhoc: true });
    expect(report).toContain('Completed tasks');
    expect(report).toContain('Done');
    expect(report).toContain('In progress');
    expect(report).toContain('Doing');
    expect(report).toContain('Delayed');
    expect(report).toContain('Late');
    expect(report).toContain('Ad-hoc tasks');
    expect(report).toContain('Support');
  });

  it('omits ad-hoc section when disabled', () => {
    const report = generateReport(baseState, { includeAdhoc: false });
    expect(report).not.toContain('Ad-hoc tasks');
  });
});
