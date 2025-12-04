export const DATE_FORMAT = 'YYYY-MM-DD';

const pad = (n) => String(n).padStart(2, '0');

export function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return formatDate(d);
}

export function daysBetween(start, end) {
  const ms = new Date(end) - new Date(start);
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

export function getRange(start, end) {
  const days = daysBetween(start, end);
  return Array.from({ length: days + 1 }, (_, i) => addDays(start, i));
}

export function getTasksInPeriod(tasks, from, to) {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  return tasks.filter((task) => {
    const start = new Date(task.plannedStart);
    const end = new Date(task.plannedEnd);
    return start <= toDate && end >= fromDate;
  });
}

export function getDelayedTasks(tasks, today) {
  const now = new Date(today);
  return tasks.filter((t) => new Date(t.plannedEnd) < now && t.progress < 100);
}
