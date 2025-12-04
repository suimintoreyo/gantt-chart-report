export const DAY_MS = 24 * 60 * 60 * 1000;

export function toDate(dateStr) {
  return new Date(`${dateStr}T00:00:00`);
}

export function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(dateStr, n) {
  const base = toDate(dateStr);
  const shifted = new Date(base.getTime() + n * DAY_MS);
  return formatDate(shifted);
}

export function dateDiffInDays(from, to) {
  const fromDate = toDate(from);
  const toDate = toDate(to);
  return Math.round((toDate - fromDate) / DAY_MS);
}

export function getTasksInPeriod(tasks, from, to) {
  const fromDate = toDate(from);
  const toDateVal = toDate(to);
  return tasks.filter((task) => {
    const start = toDate(task.plannedStart);
    const end = toDate(task.plannedEnd);
    return start <= toDateVal && end >= fromDate;
  });
}

export function getDelayedTasks(tasks, today) {
  const todayDate = toDate(today);
  return tasks.filter((task) => {
    const end = toDate(task.plannedEnd);
    return end < todayDate && task.progress < 100;
  });
}

export function clampDate(dateStr, minStr) {
  const dateVal = toDate(dateStr);
  const minVal = toDate(minStr);
  return dateVal < minVal ? minStr : dateStr;
}
