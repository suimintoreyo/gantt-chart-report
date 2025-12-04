const { generateReport } = require('../main');

describe('report generation', () => {
  const baseState = {
    tasks: [
      { name: 'Done task', plannedStart: '2025-01-01', plannedEnd: '2025-01-03', progress: 100, status: 'completed' },
      { name: 'In flight', plannedStart: '2025-01-02', plannedEnd: '2025-01-05', progress: 40, status: 'in_progress' },
      { name: 'Late work', plannedStart: '2024-12-25', plannedEnd: '2024-12-30', progress: 30, status: 'in_progress' }
    ],
    adhocTasks: [
      { date: '2025-01-02', title: 'Support ticket' }
    ]
  };

  test('includes sections for completion, in-progress, delayed, and adhoc', () => {
    const output = generateReport(baseState, { includeAdhoc: true, today: '2025-01-06' });
    expect(output).toContain('Completed tasks:');
    expect(output).toContain('In-progress tasks:');
    expect(output).toContain('Delayed tasks:');
    expect(output).toContain('Ad-hoc tasks:');
    expect(output).toContain('Support ticket');
  });

  test('omits adhoc section when disabled', () => {
    const output = generateReport(baseState, { includeAdhoc: false, today: '2025-01-06' });
    expect(output).not.toContain('Ad-hoc tasks:');
  });
});
