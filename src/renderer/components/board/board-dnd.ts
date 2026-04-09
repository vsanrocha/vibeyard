import { moveTask } from '../../board-state.js';

let isDragging = false;
let dragTaskId: string | null = null;
let dragSourceColumnId: string | null = null;
let dragSourceOrder: number = -1;
let ghostEl: HTMLElement | null = null;
let startX = 0;
let startY = 0;
const DRAG_THRESHOLD = 5;
let pointerStarted = false;
let capturedPointerId: number | null = null;
let onDragEnd: (() => void) | null = null;

const container = () => document.querySelector('.board-columns') as HTMLElement | null;

export function initBoardDnd(): void {
  document.addEventListener('pointerdown', onPointerDown);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerCancel);
}

export function cleanupBoardDnd(): void {
  document.removeEventListener('pointerdown', onPointerDown);
  document.removeEventListener('pointermove', onPointerMove);
  document.removeEventListener('pointerup', onPointerUp);
  document.removeEventListener('pointercancel', onPointerCancel);
  cancelDrag();
}

export function isDragActive(): boolean {
  return isDragging;
}

export function setDragEndCallback(cb: () => void): void {
  onDragEnd = cb;
}

function onPointerDown(e: PointerEvent): void {
  const card = (e.target as HTMLElement).closest('.board-card') as HTMLElement | null;
  if (!card || !card.dataset.taskId) return;

  // Don't drag if clicking a button or input
  if ((e.target as HTMLElement).closest('button, input, textarea')) return;

  dragTaskId = card.dataset.taskId;
  startX = e.clientX;
  startY = e.clientY;
  pointerStarted = true;

  // Record source position for same-column reorder
  const cardsArea = card.closest('.board-column-cards') as HTMLElement | null;
  dragSourceColumnId = cardsArea?.dataset.columnId ?? null;
  const siblings = cardsArea ? Array.from(cardsArea.querySelectorAll('.board-card')) : [];
  dragSourceOrder = siblings.indexOf(card);
}

function onPointerMove(e: PointerEvent): void {
  if (!pointerStarted || !dragTaskId) return;

  if (!isDragging) {
    const dx = Math.abs(e.clientX - startX);
    const dy = Math.abs(e.clientY - startY);
    if (dx + dy < DRAG_THRESHOLD) return;

    // Start drag
    isDragging = true;
    capturedPointerId = e.pointerId;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const card = document.querySelector(`.board-card[data-task-id="${dragTaskId}"]`) as HTMLElement;
    if (!card) { cancelDrag(); return; }

    card.classList.add('dragging');

    // Create ghost
    ghostEl = card.cloneNode(true) as HTMLElement;
    ghostEl.classList.remove('dragging');
    ghostEl.classList.add('board-card-ghost');
    ghostEl.style.width = card.offsetWidth + 'px';
    document.body.appendChild(ghostEl);
  }

  if (ghostEl) {
    ghostEl.style.left = e.clientX - 20 + 'px';
    ghostEl.style.top = e.clientY - 10 + 'px';
  }

  // Find drop target
  updateDropIndicator(e.clientX, e.clientY);
}

function onPointerUp(e: PointerEvent): void {
  if (!isDragging || !dragTaskId) {
    cancelDrag();
    return;
  }

  const drop = findDropTarget(e.clientX, e.clientY);
  if (drop) {
    moveTask(dragTaskId, drop.columnId, drop.order);
  }

  cancelDrag();
  if (onDragEnd) onDragEnd();
}

function onPointerCancel(): void {
  cancelDrag();
  if (onDragEnd) onDragEnd();
}

function cancelDrag(): void {
  if (ghostEl) {
    ghostEl.remove();
    ghostEl = null;
  }

  if (capturedPointerId !== null) {
    try {
      document.releasePointerCapture(capturedPointerId);
    } catch { /* already released */ }
    capturedPointerId = null;
  }

  document.querySelectorAll('.board-card.dragging').forEach(el => el.classList.remove('dragging'));
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  document.querySelectorAll('.drop-before').forEach(el => el.classList.remove('drop-before'));
  document.querySelectorAll('.drop-after-last').forEach(el => el.classList.remove('drop-after-last'));

  isDragging = false;
  dragTaskId = null;
  dragSourceColumnId = null;
  dragSourceOrder = -1;
  pointerStarted = false;
}

function findColumnCardsAt(x: number, y: number): HTMLElement | null {
  const boardColumns = container();
  if (!boardColumns) return null;

  // Use the full .board-column element for X hit detection (wider target)
  const columns = boardColumns.querySelectorAll('.board-column');
  for (const col of columns) {
    const colRect = col.getBoundingClientRect();
    if (x >= colRect.left && x <= colRect.right) {
      return col.querySelector('.board-column-cards') as HTMLElement | null;
    }
  }
  return null;
}

function updateDropIndicator(x: number, y: number): void {
  // Clear previous indicators
  document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  document.querySelectorAll('.drop-before').forEach(el => el.classList.remove('drop-before'));
  document.querySelectorAll('.drop-after-last').forEach(el => el.classList.remove('drop-after-last'));

  const colCards = findColumnCardsAt(x, y);
  if (!colCards) return;

  colCards.classList.add('drag-over');

  // Find insertion point by comparing Y with card midpoints
  const cards = colCards.querySelectorAll('.board-card:not(.dragging)');
  let found = false;
  for (const card of cards) {
    const cardRect = card.getBoundingClientRect();
    const midY = cardRect.top + cardRect.height / 2;
    if (y < midY) {
      card.classList.add('drop-before');
      found = true;
      break;
    }
  }

  // If cursor is below all cards, show indicator after the last card
  if (!found && cards.length > 0) {
    cards[cards.length - 1].classList.add('drop-after-last');
  }
}

function findDropTarget(x: number, y: number): { columnId: string; order: number } | null {
  const colCards = findColumnCardsAt(x, y);
  if (!colCards) return null;

  const columnId = colCards.dataset.columnId;
  if (!columnId) return null;

  const cards = colCards.querySelectorAll('.board-card:not(.dragging)');
  let order = cards.length;

  for (let i = 0; i < cards.length; i++) {
    const cardRect = cards[i].getBoundingClientRect();
    const midY = cardRect.top + cardRect.height / 2;
    if (y < midY) {
      order = i;
      break;
    }
  }

  return { columnId, order };
}
