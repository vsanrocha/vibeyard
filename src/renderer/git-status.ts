import { appState } from './state.js';
import { onChange as onStatusChange } from './session-activity.js';

export interface GitStatus {
  isGitRepo: boolean;
  branch: string | null;
  ahead: number;
  behind: number;
  staged: number;
  modified: number;
  untracked: number;
  conflicted: number;
}

type GitStatusCallback = (projectId: string, status: GitStatus) => void;

const cache = new Map<string, GitStatus>();
const listeners: GitStatusCallback[] = [];
let pollTimer: ReturnType<typeof setInterval> | null = null;
let polling = false;

async function poll(): Promise<void> {
  const project = appState.activeProject;
  if (!project || polling) return;

  polling = true;
  try {
    const status = await window.claudeIde.git.getStatus(project.path) as GitStatus;
    const prev = cache.get(project.id);
    cache.set(project.id, status);

    if (!prev || JSON.stringify(prev) !== JSON.stringify(status)) {
      for (const cb of listeners) cb(project.id, status);
    }
  } catch {
    // Ignore errors
  } finally {
    polling = false;
  }
}

export function getGitStatus(projectId: string): GitStatus | null {
  return cache.get(projectId) ?? null;
}

export function onChange(callback: GitStatusCallback): void {
  listeners.push(callback);
}

export function startPolling(): void {
  // Poll immediately, then every 10s
  poll();
  pollTimer = setInterval(poll, 10_000);

  // Immediate poll on project/session changes
  appState.on('project-changed', () => poll());
  appState.on('session-added', () => poll());

  // Poll when a session transitions from working → waiting/completed
  onStatusChange((_sessionId, status) => {
    if (status === 'waiting' || status === 'completed') {
      poll();
    }
  });
}

export function stopPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}
