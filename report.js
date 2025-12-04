import { getDelayedTasks } from './dateHelpers.js';

function formatTasks(tasks) {
  return tasks
    .map((t) => `- ${t.name} (${t.plannedStart} → ${t.plannedEnd}) [${t.progress}%]`)
    .join('\n');
}

export function generateReport(state, options = { includeAdhoc: true }) {
  const lines = [];
  lines.push(`# Weekly progress report`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('');

  lines.push('## Projects');
  state.projects.forEach((p) => {
    lines.push(`- ${p.name} (${p.status}) ${p.startDate} → ${p.endDate}`);
  });
  lines.push('');

  lines.push('## Completed tasks');
  const completed = state.tasks.filter((t) => t.progress >= 100);
  lines.push(completed.length ? formatTasks(completed) : '- None');
  lines.push('');

  lines.push('## In progress');
  const inProgress = state.tasks.filter((t) => t.progress > 0 && t.progress < 100);
  lines.push(inProgress.length ? formatTasks(inProgress) : '- None');
  lines.push('');

  lines.push('## Delayed');
  const delayed = getDelayedTasks(state.tasks, new Date().toISOString().slice(0, 10));
  lines.push(delayed.length ? formatTasks(delayed) : '- None');
  lines.push('');

  lines.push('## Work logs');
  if (state.workLogs.length) {
    state.workLogs.forEach((log) => {
      const task = state.tasks.find((t) => t.id === log.taskId);
      lines.push(`- ${log.date}: ${task ? task.name : log.taskId} – ${log.workNote} (${log.hours || 0}h, after ${log.progressAfter || task?.progress || 0}%)`);
    });
  } else {
    lines.push('- None');
  }

  if (options.includeAdhoc) {
    lines.push('');
    lines.push('## Ad-hoc tasks');
    if (state.adhocTasks.length) {
      state.adhocTasks.forEach((a) => {
        lines.push(`- ${a.date}: ${a.title} (${a.hours || 0}h) ${a.detail ? '- ' + a.detail : ''}`);
      });
    } else {
      lines.push('- None');
    }
  }

  return lines.join('\n');
}
