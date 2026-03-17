import { appState } from './state.js';
import { initSidebar } from './components/sidebar.js';
import { initTabBar } from './components/tab-bar.js';
import { initSplitLayout } from './components/split-layout.js';
import { initKeybindings } from './keybindings.js';
import { handlePtyData, handlePtyExit, updateCostDisplay, updateContextDisplay } from './components/terminal-pane.js';
import { setIdle, setHookStatus } from './session-activity.js';
import { parseCost, setCostData, onChange as onCostChange } from './session-cost.js';
import { setContextData, onChange as onContextChange } from './session-context.js';
import { initConfigSections } from './components/config-sections.js';
import { initNotificationSound } from './notification-sound.js';
import { initProjectTerminal, handleShellPtyData, handleShellPtyExit, isShellSessionId } from './components/project-terminal.js';
import { startPolling as startGitPolling } from './git-status.js';

async function main(): Promise<void> {
  // Wire PTY data/exit events from main process
  window.claudeIde.pty.onData((sessionId, data) => {
    if (isShellSessionId(sessionId)) {
      handleShellPtyData(sessionId, data);
    } else {
      handlePtyData(sessionId, data);
      parseCost(sessionId, data);
    }
  });

  window.claudeIde.session.onCostData((sessionId, costData) => {
    setCostData(sessionId, costData);
    setContextData(sessionId, costData.context_window);
  });

  onCostChange((sessionId, cost) => {
    updateCostDisplay(sessionId, cost);
  });

  onContextChange((sessionId, info) => {
    updateContextDisplay(sessionId, info);
  });

  window.claudeIde.session.onHookStatus((sessionId, status) => {
    setHookStatus(sessionId, status);
  });

  window.claudeIde.session.onClaudeSessionId((sessionId, claudeSessionId) => {
    // Find the project containing this session and persist the Claude session ID
    const project = appState.projects.find(p => p.sessions.some(s => s.id === sessionId));
    if (project) {
      appState.updateSessionClaudeId(project.id, sessionId, claudeSessionId);
    }
  });

  window.claudeIde.pty.onExit((sessionId, exitCode) => {
    if (isShellSessionId(sessionId)) {
      handleShellPtyExit(sessionId, exitCode);
    } else {
      handlePtyExit(sessionId, exitCode);
      setIdle(sessionId);
    }
  });

  // Initialize components
  initSidebar();
  initTabBar();
  initSplitLayout();
  initKeybindings();
  initConfigSections();
  initNotificationSound();
  initProjectTerminal();
  startGitPolling();

  // Load persisted state
  await appState.load();
}

main().catch(console.error);
