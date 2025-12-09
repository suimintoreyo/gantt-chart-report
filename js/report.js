/**
 * js/report.js
 * 進捗報告文生成モジュール
 */

import { getDelayedTasks, getTasksInPeriod, formatDate } from './dateHelpers.js';

/**
 * 進捗報告文を生成
 * @param {AppState} appState
 * @param {Object} options - { from, to, projectIds?, includeAdhoc? }
 */
export function generateReport(appState, options) {
  const { from, to, projectIds = [], includeAdhoc = true } = options;

  // プロジェクトIDでフィルタ（空配列なら全て対象）
  let targetTasks = appState.tasks;
  if (projectIds.length > 0) {
    targetTasks = targetTasks.filter(t => projectIds.includes(t.projectId));
  }

  // 期間内のタスクを取得
  const tasksInPeriod = getTasksInPeriod(targetTasks, from, to);

  // カテゴリ分け
  const completedTasks = tasksInPeriod.filter(t => t.status === 'completed');
  const inProgressTasks = tasksInPeriod.filter(t => t.status === 'in_progress');
  const delayedTasks = getDelayedTasks(tasksInPeriod, to);

  // 一時タスク
  let adhocTasksInPeriod = [];
  if (includeAdhoc) {
    adhocTasksInPeriod = appState.adhocTasks.filter(a => a.date >= from && a.date <= to);
  }

  // 作業ログ（進行中タスクの直近ログを取得するため）
  const workLogsInPeriod = appState.workLogs.filter(w => w.date >= from && w.date <= to);

  // プロジェクト名のマップ
  const projectMap = new Map(appState.projects.map(p => [p.id, p.name]));

  // 報告文生成
  const lines = [];

  // 概要
  const fromFormatted = formatDateJp(from);
  const toFormatted = formatDateJp(to);
  if (from === to) {
    lines.push(`## ${fromFormatted}の進捗報告`);
  } else {
    lines.push(`## ${fromFormatted}〜${toFormatted}の進捗報告`);
  }
  lines.push('');

  // 完了タスク
  lines.push('### 完了タスク');
  if (completedTasks.length === 0) {
    lines.push('- なし');
  } else {
    completedTasks.forEach(task => {
      const projectName = projectMap.get(task.projectId) || '未分類';
      lines.push(`- [${projectName}] ${task.name}`);
    });
  }
  lines.push('');

  // 進行中タスク
  lines.push('### 進行中タスク');
  if (inProgressTasks.length === 0) {
    lines.push('- なし');
  } else {
    inProgressTasks.forEach(task => {
      const projectName = projectMap.get(task.projectId) || '未分類';
      const recentLog = workLogsInPeriod
        .filter(w => w.taskId === task.id)
        .sort((a, b) => b.date.localeCompare(a.date))[0];
      let line = `- [${projectName}] ${task.name} (${task.progress}%)`;
      if (recentLog && recentLog.workNote) {
        line += ` - ${recentLog.workNote}`;
      }
      lines.push(line);
    });
  }
  lines.push('');

  // 遅延/リスクありタスク
  lines.push('### 遅延/リスクありタスク');
  if (delayedTasks.length === 0) {
    lines.push('- なし');
  } else {
    delayedTasks.forEach(task => {
      const projectName = projectMap.get(task.projectId) || '未分類';
      let line = `- [${projectName}] ${task.name} (${task.progress}%, 期限: ${task.plannedEnd})`;
      if (task.notes) {
        line += ` - ${task.notes}`;
      }
      lines.push(line);
    });
  }
  lines.push('');

  // 一時タスク
  if (includeAdhoc) {
    lines.push('### 一時タスク/その他');
    if (adhocTasksInPeriod.length === 0) {
      lines.push('- なし');
    } else {
      adhocTasksInPeriod.forEach(adhoc => {
        let line = `- ${adhoc.title}`;
        if (adhoc.hours) {
          line += ` (${adhoc.hours}h)`;
        }
        if (adhoc.detail) {
          line += ` - ${adhoc.detail}`;
        }
        lines.push(line);
      });
    }
    lines.push('');
  }

  // 次回報告までの予定
  lines.push('### 次回報告までの予定');
  const notCompletedTasks = inProgressTasks.filter(t => t.progress < 100);
  if (notCompletedTasks.length === 0) {
    lines.push('- 予定タスクなし');
  } else {
    notCompletedTasks.slice(0, 5).forEach(task => {
      const projectName = projectMap.get(task.projectId) || '未分類';
      const remaining = 100 - task.progress;
      lines.push(`- [${projectName}] ${task.name}の継続 (残${remaining}%)`);
    });
  }

  return lines.join('\n');
}

/**
 * 日付を日本語形式で表示（例: 12月9日）
 */
function formatDateJp(dateStr) {
  const date = new Date(dateStr);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}
