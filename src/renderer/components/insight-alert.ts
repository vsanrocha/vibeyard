import { onAlert, dismissInsight } from '../session-insights.js';
import { appState } from '../state.js';
import type { InsightResult } from '../insights/types.js';

let currentBanner: HTMLElement | null = null;
let bannerSessionId: string | null = null;
let pendingActionTimer: ReturnType<typeof setTimeout> | null = null;

export function initInsightAlert(): void {
  onAlert((projectId, results) => {
    // Show only the first (most important) insight
    const result = results[0];
    if (!result) return;
    // Defer briefly so terminal pane DOM is ready when cost data arrives early
    requestAnimationFrame(() => showBanner(projectId, result));
  });

  // Auto-remove banner only when the active session actually changes
  appState.on('session-changed', () => {
    if (bannerSessionId && appState.activeSession?.id !== bannerSessionId) {
      removeBanner();
    }
  });

  // Cancel pending prompt write if the target session is removed
  appState.on('session-removed', () => {
    clearPendingAction();
  });
}

function clearPendingAction(): void {
  if (pendingActionTimer !== null) {
    clearTimeout(pendingActionTimer);
    pendingActionTimer = null;
  }
}

function handleInsightAction(result: InsightResult): void {
  if (!result.action) return;

  const project = appState.activeProject;
  if (!project) return;

  const prompt = result.action.prompt;
  const session = appState.addSession(project.id, 'Fix Pre-Context');
  if (!session) return;

  removeBanner();

  // Wait for CLI to initialize, then write the prompt
  clearPendingAction();
  pendingActionTimer = setTimeout(() => {
    pendingActionTimer = null;
    window.claudeIde.pty.write(session.id, prompt + '\r');
  }, 2000);
}

function showBanner(projectId: string, result: InsightResult): void {
  removeBanner();

  const activeSession = appState.activeSession;
  if (!activeSession) return;

  const pane = document.querySelector(`.terminal-pane[data-session-id="${activeSession.id}"]`);
  if (!pane) return;
  bannerSessionId = activeSession.id;

  const banner = document.createElement('div');
  banner.className = 'insight-alert';

  const icon = document.createElement('span');
  icon.className = 'insight-alert-icon';
  icon.textContent = '\u26A0';

  const message = document.createElement('span');
  message.className = 'insight-alert-message';
  message.textContent = result.description;

  banner.appendChild(icon);
  banner.appendChild(message);

  if (result.action) {
    const ctaBtn = document.createElement('button');
    ctaBtn.className = 'insight-alert-cta';
    ctaBtn.textContent = result.action.label;
    ctaBtn.addEventListener('click', () => {
      handleInsightAction(result);
    });
    banner.appendChild(ctaBtn);
  }

  const dismissBtn = document.createElement('button');
  dismissBtn.className = 'insight-alert-dismiss';
  dismissBtn.textContent = "Don\u2019t show again";
  dismissBtn.addEventListener('click', () => {
    dismissInsight(projectId, result.id);
    removeBanner();
  });

  const closeBtn = document.createElement('button');
  closeBtn.className = 'insight-alert-close';
  closeBtn.textContent = '\u00D7';
  closeBtn.addEventListener('click', () => {
    removeBanner();
  });

  banner.appendChild(dismissBtn);
  banner.appendChild(closeBtn);

  // Prepend before .xterm-wrap
  const xtermWrap = pane.querySelector('.xterm-wrap');
  if (xtermWrap) {
    pane.insertBefore(banner, xtermWrap);
  } else {
    pane.prepend(banner);
  }

  currentBanner = banner;
}

function removeBanner(): void {
  if (currentBanner) {
    currentBanner.remove();
    currentBanner = null;
    bannerSessionId = null;
  }
}
