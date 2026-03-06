export type ColumnId = "todo" | "working" | "completed";

export type Task = {
  id: string;
  title: string;
  note: string;
  status: ColumnId;
  createdAt: string;
  dueDate: string | null;
};

export type BoardState = Record<ColumnId, Task[]>;

export const statusOrder: ColumnId[] = ["todo", "working", "completed"];

export const columns = [
  { id: "todo", label: "Todo", hint: "Ideas and next actions" },
  { id: "working", label: "Working", hint: "Tasks currently in motion" },
  { id: "completed", label: "Completed", hint: "Finished and ready to archive" },
] as const satisfies ReadonlyArray<{
  id: ColumnId;
  label: string;
  hint: string;
}>;

export function emptyBoard(): BoardState {
  return {
    todo: [],
    working: [],
    completed: [],
  };
}

export function createStarterBoard(): BoardState {
  return {
    todo: [
      {
        id: "starter-1",
        title: "Add your first task",
        note: "Keep it small and move it once it starts.",
        status: "todo",
        createdAt: new Date().toISOString(),
        dueDate: null,
      },
    ],
    working: [
      {
        id: "starter-2",
        title: "Try dragging this card",
        note: "Reorder it or move it across columns.",
        status: "working",
        createdAt: new Date().toISOString(),
        dueDate: null,
      },
    ],
    completed: [],
  };
}

export function cloneBoard(board: BoardState): BoardState {
  return {
    todo: [...board.todo],
    working: [...board.working],
    completed: [...board.completed],
  };
}

export function isColumnId(value: string): value is ColumnId {
  return statusOrder.includes(value as ColumnId);
}

export function isTask(candidate: unknown): candidate is Task {
  if (!candidate || typeof candidate !== "object") {
    return false;
  }

  const value = candidate as Record<string, unknown>;

  return (
    typeof value.id === "string" &&
    typeof value.title === "string" &&
    typeof value.note === "string" &&
    typeof value.createdAt === "string" &&
    (typeof value.dueDate === "string" || value.dueDate === null) &&
    typeof value.status === "string" &&
    isColumnId(value.status)
  );
}

export function isBoardState(value: unknown): value is BoardState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return statusOrder.every(
    (columnId) => Array.isArray(candidate[columnId]) && candidate[columnId].every(isTask)
  );
}

export function countTasks(board: BoardState) {
  return board.todo.length + board.working.length + board.completed.length;
}
