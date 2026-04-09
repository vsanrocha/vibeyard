import type { BoardTask } from '../../../shared/types.js';
import { appState } from '../../state.js';
import { getColumnByBehavior, updateTask, moveTask, deleteTask } from '../../board-state.js';
import { getStatus, type SessionStatus } from '../../session-activity.js';
import { showTaskModal } from './board-task-modal.js';
import { showContextMenu } from './board-context-menu.js';
import { showConfirmModal } from '../modal.js';
import { injectPrompt } from '../../board-session-sync.js';

export function createCardElement(task: BoardTask): HTMLElement {
  const el = document.createElement('div');
  el.className = 'board-card';
  el.dataset.taskId = task.id;
  el.draggable = true;

  // Title
  const titleEl = document.createElement('div');
  titleEl.className = 'board-card-title';
  titleEl.textContent = task.title || truncate(task.prompt, 60) || 'Untitled';

  // Meta
  const metaEl = document.createElement('div');
  metaEl.className = 'board-card-meta';
  const folderSpan = document.createElement('span');
  folderSpan.className = 'card-folder';
  folderSpan.textContent = shortenPath(task.cwd);
  metaEl.appendChild(folderSpan);

  el.appendChild(titleEl);
  el.appendChild(metaEl);

  // Status section (only when task has an active session)
  if (task.sessionId) {
    const status = getStatus(task.sessionId);
    if (status) {
      const statusEl = createStatusElement(status, task.sessionId);
      el.appendChild(statusEl);
    }
  }

  // Actions
  const actionsEl = document.createElement('div');
  actionsEl.className = 'board-card-actions';

  const runBtn = document.createElement('button');
  runBtn.className = 'card-run-btn';
  const hasActiveSession = !!task.sessionId;
  const canResume = !hasActiveSession && !!task.cliSessionId;
  runBtn.title = hasActiveSession ? 'Focus session' : canResume ? 'Resume' : 'Run';
  runBtn.textContent = hasActiveSession ? '>>>' : canResume ? '\u21BB' : '\u25B6';
  runBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    runTask(task);
  });
  actionsEl.appendChild(runBtn);

  el.appendChild(actionsEl);

  // Click card body → edit modal
  el.addEventListener('click', (e) => {
    // Don't trigger if clicking a button
    if ((e.target as HTMLElement).closest('button')) return;
    showTaskModal('edit', task);
  });

  // Right-click → context menu
  el.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e.clientX, e.clientY, [
      { label: 'Edit', action: () => showTaskModal('edit', task) },
      { label: 'Delete', danger: true, action: () => confirmDeleteTask(task) },
    ]);
  });

  return el;
}

function confirmDeleteTask(task: BoardTask): void {
  const label = task.title || task.prompt.slice(0, 40) || 'this task';
  showConfirmModal(
    'Delete Task',
    `Are you sure you want to delete "${label}"? This cannot be undone.`,
    () => deleteTask(task.id),
  );
}

function createStatusElement(status: SessionStatus, sessionId: string): HTMLElement {
  const statusEl = document.createElement('div');
  statusEl.className = 'board-card-status';

  const dot = document.createElement('span');
  dot.className = `card-status-dot ${status}`;

  const label = document.createElement('span');
  const statusLabels: Record<string, string> = {
    working: 'Working',
    waiting: 'Waiting for input',
    'prompt-waiting': 'Waiting for input',
    idle: 'Idle',
    completed: 'Completed',
    input: 'Input',
  };
  label.textContent = statusLabels[status] ?? status;

  statusEl.appendChild(dot);
  statusEl.appendChild(label);
  return statusEl;
}

export function runTask(task: BoardTask): void {
  const project = appState.activeProject;
  if (!project) return;

  // If task has active session, just focus it
  if (task.sessionId) {
    focusTaskSession(task);
    return;
  }

  let resumed = false;

  // Try to resume from cliSessionId
  if (task.cliSessionId) {
    const existingSession = project.sessions.find(s => s.cliSessionId === task.cliSessionId);
    if (existingSession) {
      appState.setActiveSession(project.id, existingSession.id);
      updateTask(task.id, { sessionId: existingSession.id });
      resumed = true;
    } else {
      const archived = project.sessionHistory?.find(a => a.cliSessionId === task.cliSessionId);
      if (archived) {
        const session = appState.resumeFromHistory(project.id, archived.id);
        if (session) {
          updateTask(task.id, { sessionId: session.id });
          resumed = true;
        }
      }
    }
  }

  // Fallback: spawn a fresh session
  if (!resumed) {
    if (!task.prompt.trim()) {
      showTaskModal('edit', task);
      return;
    }
    const sessionName = task.title || task.prompt.slice(0, 40);
    const session = appState.addSession(project.id, sessionName);
    if (session) {
      updateTask(task.id, { sessionId: session.id });
      const activeCol = getColumnByBehavior('active');
      if (activeCol && task.columnId !== activeCol.id) {
        moveTask(task.id, activeCol.id, 0);
      }
      // Inject prompt into the new session (paste, don't submit)
      if (task.prompt.trim()) {
        injectPrompt(session.id, task.prompt);
      }
    }
  }

  // Switch to tabs view to see the terminal
  if (project.layout.mode === 'board') {
    appState.toggleBoard();
  }
}

export function focusTaskSession(task: BoardTask): void {
  const project = appState.activeProject;
  if (!project || !task.sessionId) return;

  if (project.layout.mode === 'board') {
    appState.toggleBoard();
  }
  appState.setActiveSession(project.id, task.sessionId);
}

function truncate(str: string, len: number): string {
  if (!str) return '';
  const firstLine = str.split('\n')[0];
  return firstLine.length > len ? firstLine.slice(0, len) + '...' : firstLine;
}

const HOME_RE_UNIX = /^\/Users\/[^/]+/;
const HOME_RE_WIN = /^[A-Z]:\\Users\\[^\\]+/i;

function shortenPath(path: string): string {
  if (!path) return '';
  const sep = path.includes('\\') ? '\\' : '/';
  const home = path.replace(HOME_RE_UNIX, '~').replace(HOME_RE_WIN, '~');
  const parts = home.split(sep);
  if (parts.length > 3) {
    return parts.slice(0, 1).concat('...', parts.slice(-2)).join(sep);
  }
  return home;
}
