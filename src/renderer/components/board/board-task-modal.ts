import type { BoardTask } from '../../../shared/types.js';
import { appState } from '../../state.js';
import { addTask, updateTask, getBoard } from '../../board-state.js';
import { showModal, closeModal, setModalError, type FieldDef } from '../modal.js';

export function showTaskModal(mode: 'create' | 'edit', task?: BoardTask, defaultColumnId?: string): void {
  const board = getBoard();
  if (!board) return;
  const project = appState.activeProject;
  if (!project) return;

  const columnOptions = [...board.columns]
    .sort((a, b) => a.order - b.order)
    .map(c => ({ value: c.id, label: c.title }));

  const fields: FieldDef[] = [
    {
      label: 'Title',
      id: 'taskTitle',
      placeholder: 'Task title',
      defaultValue: task?.title ?? '',
    },
    {
      label: 'Prompt',
      id: 'prompt',
      type: 'textarea',
      placeholder: 'Instructions for Claude...',
      defaultValue: task?.prompt ?? '',
      rows: 4,
    },
    {
      label: 'Notes',
      id: 'notes',
      type: 'textarea',
      placeholder: 'Context, reasoning, acceptance criteria...',
      defaultValue: task?.notes ?? '',
      rows: 3,
    },
    {
      label: 'Folder',
      id: 'cwd',
      placeholder: project.path,
      defaultValue: task?.cwd ?? project.path,
      buttonLabel: 'Browse',
      onButtonClick: async (input) => {
        const dir = await window.vibeyard.fs.browseDirectory();
        if (dir) input.value = dir;
      },
    },
  ];

  if (mode === 'edit') {
    fields.push({
      label: 'Column',
      id: 'columnId',
      type: 'select',
      options: columnOptions,
      defaultValue: task?.columnId ?? defaultColumnId ?? board.columns[0]?.id,
    });
  }

  const title = mode === 'create' ? 'New Task' : 'Edit Task';

  const confirmLabel = mode === 'create' ? 'Create' : 'Update';

  showModal(title, fields, (values) => {
    const prompt = values.prompt?.trim() ?? '';
    const taskTitle = values.taskTitle?.trim() ?? '';

    if (!taskTitle) {
      setModalError('taskTitle', 'Title is required');
      return;
    }

    const notes = values.notes?.trim() ?? '';

    if (mode === 'create') {
      const targetColumnId = defaultColumnId ?? board.columns.find(c => c.behavior === 'inbox')?.id ?? board.columns[0]?.id;
      addTask({
        title: taskTitle,
        prompt,
        notes: notes || undefined,
        cwd: values.cwd?.trim() || project.path,
        columnId: targetColumnId,
      });
    } else if (task) {
      updateTask(task.id, {
        title: taskTitle,
        prompt,
        notes: notes || undefined,
        cwd: values.cwd?.trim() || project.path,
        ...(values.columnId ? { columnId: values.columnId } : {}),
      });
    }

    closeModal();
  }, { confirmLabel });
}
