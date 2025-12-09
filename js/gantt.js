/**
 * js/gantt.js
 * Frappe Ganttのラッパー・操作モジュール
 */

import { formatDate } from './dateHelpers.js';

let ganttInstance = null;
let onTaskUpdate = null;
let onTaskClick = null;

/**
 * ガントチャートを初期化
 * @param {string} selector - ガントチャートを描画する要素のセレクタ
 * @param {Task[]} tasks - タスク配列
 * @param {Object} callbacks - { onDateChange, onClick, onProgressChange }
 */
export function initGantt(selector, tasks, callbacks = {}) {
  onTaskUpdate = callbacks.onDateChange;
  onTaskClick = callbacks.onClick;

  const ganttTasks = tasks.map(taskToGanttFormat);

  // Frappe Ganttが読み込まれているか確認
  if (typeof Gantt === 'undefined') {
    console.error('Frappe Gantt is not loaded');
    return null;
  }

  ganttInstance = new Gantt(selector, ganttTasks, {
    view_mode: 'Day',
    date_format: 'YYYY-MM-DD',
    language: 'ja',
    on_click: (task) => {
      if (onTaskClick) {
        onTaskClick(task.id);
      }
    },
    on_date_change: (task, start, end) => {
      if (onTaskUpdate) {
        onTaskUpdate(task.id, formatDate(start), formatDate(end));
      }
    },
    on_progress_change: (task, progress) => {
      if (callbacks.onProgressChange) {
        callbacks.onProgressChange(task.id, progress);
      }
    },
    custom_popup_html: (task) => {
      return `
        <div class="gantt-popup">
          <h4>${task.name}</h4>
          <p>進捗: ${task.progress}%</p>
          <p>${formatDate(task._start)} 〜 ${formatDate(task._end)}</p>
        </div>
      `;
    },
  });

  return ganttInstance;
}

/**
 * AppStateのTaskをFrappe Gantt形式に変換
 */
function taskToGanttFormat(task) {
  let customClass = '';

  // 優先度による色分け
  if (task.priority === 'high') {
    customClass = 'gantt-bar-high';
  } else if (task.priority === 'medium') {
    customClass = 'gantt-bar-medium';
  } else if (task.priority === 'low') {
    customClass = 'gantt-bar-low';
  }

  // 遅延チェック
  const today = formatDate(new Date());
  if (task.plannedEnd < today && task.progress < 100) {
    customClass += ' gantt-bar-delayed';
  }

  return {
    id: task.id,
    name: task.name,
    start: task.plannedStart,
    end: task.plannedEnd,
    progress: task.progress || 0,
    custom_class: customClass.trim(),
    dependencies: task.dependsOn ? task.dependsOn.join(',') : '',
  };
}

/**
 * ガントチャートを更新
 */
export function updateGantt(tasks) {
  if (!ganttInstance) return;
  const ganttTasks = tasks.map(taskToGanttFormat);
  ganttInstance.refresh(ganttTasks);
}

/**
 * 表示モードを変更
 * @param {'Day' | 'Week' | 'Month'} mode
 */
export function changeViewMode(mode) {
  if (!ganttInstance) return;
  ganttInstance.change_view_mode(mode);
}

/**
 * 特定のタスクをハイライト
 */
export function highlightTask(taskId) {
  // 既存のハイライトを削除
  document.querySelectorAll('.gantt-bar-wrapper.highlighted').forEach(el => {
    el.classList.remove('highlighted');
  });

  if (taskId) {
    const bar = document.querySelector(`[data-id="${taskId}"]`);
    if (bar) {
      bar.closest('.gantt-bar-wrapper')?.classList.add('highlighted');
    }
  }
}

/**
 * ガントチャートインスタンスを取得
 */
export function getGanttInstance() {
  return ganttInstance;
}
