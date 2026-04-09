import { appState } from '../../state.js';
import { getBoard } from '../../board-state.js';
import { createColumnElement } from './board-column.js';
import { showTaskModal } from './board-task-modal.js';
import { initBoardDnd, cleanupBoardDnd, isDragActive, setDragEndCallback } from './board-dnd.js';
import type { BoardColumn } from '../../../shared/types.js';

let boardEl: HTMLElement | null = null;
let dndInitialized = false;
let pendingRender = false;

export function initBoard(): void {
  appState.on('board-changed', () => {
    if (appState.activeProject?.layout.mode === 'board') renderBoard();
  });
  appState.on('project-changed', () => {
    if (appState.activeProject?.layout.mode === 'board') renderBoard();
  });
  appState.on('layout-changed', () => {
    if (appState.activeProject?.layout.mode === 'board') {
      renderBoard();
    } else {
      hideBoardView();
    }
  });
  setDragEndCallback(() => {
    if (pendingRender) renderBoard();
  });
}

export function createBoardView(): HTMLElement {
  const el = document.createElement('div');
  el.className = 'board-view';

  const header = document.createElement('div');
  header.className = 'board-header';

  const title = document.createElement('span');
  title.className = 'board-title';
  title.textContent = 'Board';

  const addBtn = document.createElement('button');
  addBtn.className = 'board-add-task';
  addBtn.textContent = '+ Add Task';
  addBtn.addEventListener('click', () => showTaskModal('create'));

  header.appendChild(title);
  header.appendChild(addBtn);

  const columnsContainer = document.createElement('div');
  columnsContainer.className = 'board-columns';

  el.appendChild(header);
  el.appendChild(columnsContainer);

  return el;
}

export function renderBoard(): void {
  if (isDragActive()) {
    pendingRender = true;
    return;
  }
  pendingRender = false;

  const board = getBoard();
  if (!board) return;

  const container = document.getElementById('terminal-container')!;

  if (!boardEl) {
    boardEl = createBoardView();
  }

  if (!container.contains(boardEl)) {
    container.appendChild(boardEl);
  }
  boardEl.style.display = '';

  const columnsContainer = boardEl.querySelector('.board-columns')!;
  columnsContainer.innerHTML = '';

  const sortedColumns = [...board.columns].sort((a, b) => a.order - b.order);
  const tasks = board.tasks;

  for (const column of sortedColumns) {
    const columnTasks = tasks
      .filter(t => t.columnId === column.id)
      .sort((a, b) => a.order - b.order);
    const colEl = createColumnElement(column, columnTasks);
    columnsContainer.appendChild(colEl);
  }

  if (!dndInitialized) {
    initBoardDnd();
    dndInitialized = true;
  }
}

export function hideBoardView(): void {
  if (boardEl) {
    boardEl.style.display = 'none';
  }
}

export function destroyBoardView(): void {
  if (boardEl) {
    boardEl.remove();
    boardEl = null;
  }
  if (dndInitialized) {
    cleanupBoardDnd();
    dndInitialized = false;
  }
}
