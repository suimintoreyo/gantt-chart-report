/**
 * js/dateHelpers.js
 * 日付操作のヘルパー関数群
 */

/**
 * YYYY-MM-DD形式の日付文字列にn日を加算
 */
export function addDays(dateStr, n) {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + n);
  return formatDate(date);
}

/**
 * DateオブジェクトをYYYY-MM-DD形式に変換
 */
export function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 今日の日付をYYYY-MM-DD形式で取得
 */
export function getToday() {
  return formatDate(new Date());
}

/**
 * 今週の開始日（月曜）と終了日（日曜）を取得
 */
export function getThisWeekRange() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: formatDate(monday), to: formatDate(sunday) };
}

/**
 * 今月の開始日と終了日を取得
 */
export function getThisMonthRange() {
  const today = new Date();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { from: formatDate(firstDay), to: formatDate(lastDay) };
}

/**
 * 指定期間内のタスクを取得（期間と交差するタスク）
 */
export function getTasksInPeriod(tasks, from, to) {
  return tasks.filter((task) => {
    return task.plannedStart <= to && task.plannedEnd >= from;
  });
}

/**
 * 遅延タスクを取得（終了予定日が過ぎているが未完了）
 */
export function getDelayedTasks(tasks, today = getToday()) {
  return tasks.filter((task) => {
    return task.plannedEnd < today && task.progress < 100;
  });
}

/**
 * 日付間の日数を計算
 */
export function daysBetween(startStr, endStr) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diffTime = end - start;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
