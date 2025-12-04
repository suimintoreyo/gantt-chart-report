import { getDelayedTasks } from './dateHelpers.js';

function renderTasks(label, tasks) {
  if (!tasks.length) return `${label}: none`;
  const lines = tasks.map((task) => {
    const progress = task.progress != null ? `${task.progress}%` : 'n/a';
    return `- ${task.name} (${progress}) [${task.plannedStart} → ${task.plannedEnd}]`;
  });
  return `${label}:\n${lines.join('\n')}`;
}

export function generateReport(appState, options = {}) {
  const today = options.today ?? new Date().toISOString().slice(0, 10);
  const delayed = getDelayedTasks(appState.tasks, today);
  const completed = appState.tasks.filter((t) => t.progress === 100);
  const inProgress = appState.tasks.filter((t) => t.progress > 0 && t.progress < 100);

  const sections = [];
  sections.push(`Progress Report (${today})`);
  sections.push(renderTasks('Completed', completed));
  sections.push(renderTasks('In Progress', inProgress));
  sections.push(renderTasks('Delayed', delayed));

  if (options.includeAdhoc) {
    if (appState.adhocTasks.length === 0) {
      sections.push('Ad-hoc: none');
    } else {
      const adhocLines = appState.adhocTasks.map((task) => {
        const detail = task.detail ? ` - ${task.detail}` : '';
        return `- ${task.date}: ${task.title}${detail}`;
      });
      sections.push(`Ad-hoc:\n${adhocLines.join('\n')}`);
    }
  }

  if (options.includeWorkLogs) {
    if (!appState.workLogs.length) {
      sections.push('Work logs: none');
    } else {
      const logLines = appState.workLogs.map((log) => {
        const task = appState.tasks.find((t) => t.id === log.taskId);
        const name = task ? task.name : 'Unknown task';
        const hours = log.hours != null ? ` (${log.hours}h)` : '';
        const progress = log.progressAfter != null ? ` → ${log.progressAfter}%` : '';
        return `- ${log.date}: ${name}${hours}${progress} - ${log.workNote}`;
      });
      sections.push(`Work logs:\n${logLines.join('\n')}`);
    }
  }

  return sections.join('\n\n');
}
