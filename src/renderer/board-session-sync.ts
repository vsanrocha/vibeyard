import { appState } from './state.js';
import { onChange as onStatusChange, getStatus, hasSession } from './session-activity.js';
import { getTaskBySessionId, moveTask, updateTask, getColumnByBehavior } from './board-state.js';
import type { BoardTask } from '../shared/types.js';

function moveTaskToDone(task: BoardTask): void {
  const doneCol = getColumnByBehavior('terminal');
  if (doneCol && task.columnId !== doneCol.id) {
    moveTask(task.id, doneCol.id, 0);
  }
}

export function injectPrompt(sessionId: string, prompt: string): void {
  if (!prompt.trim()) return;

  const READY_TIMEOUT = 5000;
  let resolved = false;

  const readyStatuses = ['idle', 'waiting', 'prompt-waiting'];

  // Check current status immediately — but only if the session is already tracked
  // (a brand-new session won't have a PTY yet, so writing would silently fail)
  if (hasSession(sessionId)) {
    const currentStatus = getStatus(sessionId);
    if (readyStatuses.includes(currentStatus)) {
      window.vibeyard.pty.write(sessionId, prompt);
      return;
    }
  }

  const unsubscribe = onStatusChange((sid, status) => {
    if (sid !== sessionId || resolved) return;
    if (readyStatuses.includes(status)) {
      resolved = true;
      unsubscribe();
      window.vibeyard.pty.write(sessionId, prompt);
    }
  });

  setTimeout(() => {
    if (!resolved) {
      resolved = true;
      unsubscribe();
    }
  }, READY_TIMEOUT);
}

export function initBoardSessionSync(): void {
  onStatusChange((sessionId, status) => {
    if (status !== 'completed') return;
    const task = getTaskBySessionId(sessionId);
    if (task) moveTaskToDone(task);
  });

  appState.on('session-removed', (data) => {
    const { sessionId } = data as { projectId: string; sessionId: string };
    const task = getTaskBySessionId(sessionId);
    if (!task) return;

    moveTaskToDone(task);
    updateTask(task.id, { sessionId: undefined });
  });

  // When CLI session ID is assigned → persist it on the task
  appState.on('session-changed', () => {
    const project = appState.activeProject;
    if (!project?.board) return;

    for (const task of project.board.tasks) {
      if (!task.sessionId) continue;
      const session = project.sessions.find(s => s.id === task.sessionId);
      if (session?.cliSessionId && task.cliSessionId !== session.cliSessionId) {
        updateTask(task.id, { cliSessionId: session.cliSessionId });
      }
    }
  });
}
