const { shiftTaskDates, resizeTaskStart, resizeTaskEnd, resolveDragDates } = require('../main');

describe('task date adjustments', () => {
  const base = { id: 't', plannedStart: '2024-01-05', plannedEnd: '2024-01-10' };

  test('shiftTaskDates moves both start and end', () => {
    const moved = shiftTaskDates(base, 2);
    expect(moved.plannedStart).toBe('2024-01-07');
    expect(moved.plannedEnd).toBe('2024-01-12');

    const movedBack = shiftTaskDates(base, -3);
    expect(movedBack.plannedStart).toBe('2024-01-02');
    expect(movedBack.plannedEnd).toBe('2024-01-07');
  });

  test('resizeTaskStart never crosses end date', () => {
    const shorter = resizeTaskStart(base, 2);
    expect(shorter.plannedStart).toBe('2024-01-07');
    const over = resizeTaskStart(base, 20);
    expect(over.plannedStart).toBe(base.plannedEnd);
  });

  test('resizeTaskEnd never goes before start date', () => {
    const longer = resizeTaskEnd(base, 3);
    expect(longer.plannedEnd).toBe('2024-01-13');
    const before = resizeTaskEnd(base, -20);
    expect(before.plannedEnd).toBe(base.plannedStart);
  });

  describe('resolveDragDates', () => {
    test('moving the bar shifts both dates', () => {
      const draft = resolveDragDates(base, 2, 'move');
      expect(draft).toEqual({ start: '2024-01-07', end: '2024-01-12' });
    });

    test('resizing start later does not alter plannedEnd', () => {
      const draft = resolveDragDates(base, 2, 'start');
      expect(draft).toEqual({ start: '2024-01-07', end: base.plannedEnd });
    });

    test('resizing end earlier does not alter plannedStart', () => {
      const draft = resolveDragDates(base, -2, 'end');
      expect(draft).toEqual({ start: base.plannedStart, end: '2024-01-08' });
    });
  });
});
