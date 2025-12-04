# Gantt Chart Progress & Report

A lightweight, framework-free Gantt chart app that supports direct mouse editing, local persistence, and one-click progress report generation.

## Getting started
1. Open `index.html` in a modern desktop browser.
2. Use the form on the left to add tasks. The Gantt chart shows each task as a bar you can drag to move or resize.
3. Click **Generate Report** to open the modal and copy the latest status summary.
4. Use **Reset to Sample Data** to reload the built-in demo state.

## Features
- **Direct manipulation**: drag a task bar to move the schedule, or drag either edge to change start/end dates. Dates are updated and saved immediately.
- **Local persistence**: tasks, projects, logs, and ad-hoc items are stored in `localStorage` with `saveState`/`loadState` helpers.
- **Report generation**: `generateReport` builds a text summary that highlights completed, in-progress, delayed, and ad-hoc work.
- **Vanilla stack**: pure HTML/CSS/JS—no build step required.

## Testing
Jest tests cover persistence, date helpers, and report generation.

```bash
npm install
npm test
```

If your environment cannot reach the npm registry, install Jest offline or use an existing cache before running `npm test`.
