# Gantt Chart Progress & Report

A lightweight, vanilla JS Gantt chart app that supports drag-to-move/resize task bars, local persistence, and progress report generation.

## Running the app

Open `index.html` in a modern desktop browser (Chrome/Edge). All data is stored in `localStorage`.

### Key features

- Project, task, work-log, and ad-hoc task entry forms.
- Interactive Gantt chart with draggable/resizable bars that update task dates.
- Progress report generation with copy-to-clipboard and optional ad-hoc section.
- Sample data loaded on first launch to demonstrate behavior.

## Development

Install dependencies and run tests:

```bash
npm install
npm test
```

The project uses vanilla JS modules; no bundler is required.
