/**
 * js/state.js
 * 状態管理・永続化モジュール
 * AppState全体をlocalStorageで管理
 */

const STORAGE_KEY = 'ganttProgressAppState';

/**
 * 空の初期状態を返す
 */
export function getInitialState() {
  return {
    projects: [],
    tasks: [],
    workLogs: [],
    adhocTasks: [],
    uiPreferences: {
      taskTableColumnWidths: {},
      ganttZoomLevel: 'Day',
      theme: 'dark',
    },
  };
}

/**
 * 古い状態バージョンをアップグレード（必要に応じて）
 */
function migrateStateIfNeeded(state) {
  if (!state.uiPreferences) {
    state.uiPreferences = getInitialState().uiPreferences;
  }
  if (!state.projects) state.projects = [];
  if (!state.tasks) state.tasks = [];
  if (!state.workLogs) state.workLogs = [];
  if (!state.adhocTasks) state.adhocTasks = [];
  return state;
}

/**
 * localStorageからAppStateを読み込む
 */
export function loadState() {
  try {
    const json = localStorage.getItem(STORAGE_KEY);
    if (!json) return getInitialState();
    const state = JSON.parse(json);
    return migrateStateIfNeeded(state);
  } catch (e) {
    console.error('状態の読み込みに失敗', e);
    return getInitialState();
  }
}

/**
 * AppStateをlocalStorageに保存
 */
export function saveState(state) {
  try {
    const json = JSON.stringify(state);
    localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch (e) {
    console.error('状態の保存に失敗', e);
    return false;
  }
}

/**
 * UUID v4を生成
 */
export function generateId() {
  return crypto.randomUUID();
}

/**
 * デバウンス付き保存（自動保存用）
 */
let saveTimeout = null;
export function saveStateDebounced(state, delay = 1000) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveState(state);
    window.dispatchEvent(new CustomEvent('autosaved'));
  }, delay);
}
