"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CalendarDays, FolderPlus, GripVertical, PencilLine, Plus, Trash2 } from "lucide-react";

import { createProjectAction, deleteProjectAction, getProjectDataAction, renameProjectAction, saveBoardAction } from "@/app/actions";
import { LogoutButton } from "@/components/logout-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  cloneBoard,
  columns,
  countTasks,
  isColumnId,
  statusOrder,
  type BoardState,
  type ColumnId,
  type Task,
} from "@/lib/board";
import { cn } from "@/lib/utils";

type ProjectSummary = {
  id: number;
  name: string;
};

type TaskLocation = {
  columnId: ColumnId;
  index: number;
  task: Task;
};

type SaveState = "idle" | "saving" | "saved" | "error";

type BoardClientProps = {
  initialBoard: BoardState;
  initialProjectId: number;
  initialProjects: ProjectSummary[];
  userEmail: string;
};

const shortDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function createTask(title: string, note: string, dueDate: string): Task {
  return {
    id: globalThis.crypto?.randomUUID?.() ?? `task-${Date.now()}`,
    title: title.trim(),
    note: note.trim(),
    status: "todo",
    createdAt: new Date().toISOString(),
    dueDate: dueDate || null,
  };
}

function getTaskLocation(board: BoardState, taskId: string): TaskLocation | null {
  for (const columnId of statusOrder) {
    const index = board[columnId].findIndex((task) => task.id === taskId);

    if (index !== -1) {
      return {
        columnId,
        index,
        task: board[columnId][index],
      };
    }
  }

  return null;
}

function moveTask(board: BoardState, taskId: string, targetColumn: ColumnId, targetIndex?: number) {
  const source = getTaskLocation(board, taskId);

  if (!source) {
    return board;
  }

  const nextBoard = cloneBoard(board);
  const [removedTask] = nextBoard[source.columnId].splice(source.index, 1);
  const updatedTask: Task = { ...removedTask, status: targetColumn };
  const destinationTasks = nextBoard[targetColumn];
  const desiredIndex = targetIndex ?? destinationTasks.length;
  const normalizedIndex =
    source.columnId === targetColumn && desiredIndex > source.index ? desiredIndex - 1 : desiredIndex;

  destinationTasks.splice(Math.max(0, Math.min(normalizedIndex, destinationTasks.length)), 0, updatedTask);
  return nextBoard;
}

function removeTask(board: BoardState, taskId: string) {
  const source = getTaskLocation(board, taskId);

  if (!source) {
    return board;
  }

  const nextBoard = cloneBoard(board);
  nextBoard[source.columnId] = nextBoard[source.columnId].filter((task) => task.id !== taskId);
  return nextBoard;
}

function updateTask(board: BoardState, taskId: string, updater: (task: Task) => Task) {
  const source = getTaskLocation(board, taskId);

  if (!source) {
    return board;
  }

  const nextBoard = cloneBoard(board);
  nextBoard[source.columnId][source.index] = updater(source.task);
  return nextBoard;
}

function formatShortDate(value: string) {
  return shortDateFormatter.format(new Date(`${value}T00:00:00`));
}

type TaskCardBodyProps = {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onMoveBack: (taskId: string) => void;
  onMoveNext: (taskId: string) => void;
  canMoveBack: boolean;
  canMoveNext: boolean;
  dragHandleProps?: Record<string, unknown>;
  isDragging?: boolean;
  isOverlay?: boolean;
};

function TaskCardBody({
  task,
  onEdit,
  onDelete,
  onMoveBack,
  onMoveNext,
  canMoveBack,
  canMoveNext,
  dragHandleProps,
  isDragging = false,
  isOverlay = false,
}: TaskCardBodyProps) {
  return (
    <Card
      className={cn(
        "gap-0 rounded-[1.4rem] border-black/8 bg-white/90 py-0 shadow-none transition",
        isDragging && "shadow-[0_16px_36px_rgba(32,27,21,0.12)] ring-1 ring-black/6"
      )}
    >
      <CardContent className="px-4 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              className={cn(
                "inline-flex touch-none items-center gap-2 rounded-full px-2 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-stone-400 transition",
                !isOverlay && "cursor-grab active:cursor-grabbing"
              )}
              aria-label={`Drag ${task.title}`}
              {...dragHandleProps}
            >
              <GripVertical className="size-4" />
              Move
            </button>

            <h3 className="mt-3 text-base font-medium leading-6 text-stone-950">{task.title}</h3>
            {task.note ? <p className="mt-2 text-sm leading-6 text-stone-600">{task.note}</p> : null}
          </div>

          {!isOverlay ? (
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onEdit(task)}
                className="rounded-full text-stone-400 hover:bg-transparent hover:text-stone-950"
                aria-label={`Edit ${task.title}`}
              >
                <PencilLine className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onDelete(task.id)}
                className="rounded-full text-stone-400 hover:bg-transparent hover:text-stone-950"
                aria-label={`Delete ${task.title}`}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          ) : null}
        </div>

        {task.dueDate ? (
          <div className="mt-4 flex items-center gap-2 text-sm text-stone-500">
            <Badge
              variant="outline"
              className="rounded-full border-black/10 bg-stone-50 px-3 py-1 text-[0.68rem] uppercase tracking-[0.16em] text-stone-600"
            >
              <CalendarDays className="size-3.5" />
              Due {formatShortDate(task.dueDate)}
            </Badge>
          </div>
        ) : null}
      </CardContent>

      <CardFooter className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/8 px-4 py-3 text-sm text-stone-500">
        <span>Created {shortDateFormatter.format(new Date(task.createdAt))}</span>
        {!isOverlay ? (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onMoveBack(task.id)}
              disabled={!canMoveBack}
              className="rounded-full border-black/10 bg-transparent px-3 text-[0.68rem] uppercase tracking-[0.16em] text-stone-600 shadow-none hover:border-black/20 hover:bg-white/60 hover:text-stone-950"
            >
              Back
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onMoveNext(task.id)}
              disabled={!canMoveNext}
              className="rounded-full border-black/10 bg-transparent px-3 text-[0.68rem] uppercase tracking-[0.16em] text-stone-600 shadow-none hover:border-black/20 hover:bg-white/60 hover:text-stone-950"
            >
              Next
            </Button>
          </div>
        ) : null}
      </CardFooter>
    </Card>
  );
}

type SortableTaskCardProps = {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onMoveBack: (taskId: string) => void;
  onMoveNext: (taskId: string) => void;
};

function SortableTaskCard({ task, onEdit, onDelete, onMoveBack, onMoveNext }: SortableTaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: {
      type: "task",
      columnId: task.status,
    },
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn("will-change-transform", isDragging && "z-10 opacity-70")}
    >
      <TaskCardBody
        task={task}
        onEdit={onEdit}
        onDelete={onDelete}
        onMoveBack={onMoveBack}
        onMoveNext={onMoveNext}
        canMoveBack={statusOrder.indexOf(task.status) > 0}
        canMoveNext={statusOrder.indexOf(task.status) < statusOrder.length - 1}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

type ColumnCardProps = {
  columnId: ColumnId;
  label: string;
  hint: string;
  tasks: Task[];
  isActiveDropzone: boolean;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onMoveBack: (taskId: string) => void;
  onMoveNext: (taskId: string) => void;
};

function ColumnCard({
  columnId,
  label,
  hint,
  tasks,
  isActiveDropzone,
  onEdit,
  onDelete,
  onMoveBack,
  onMoveNext,
}: ColumnCardProps) {
  const { setNodeRef } = useDroppable({
    id: columnId,
    data: {
      type: "column",
      columnId,
    },
  });

  return (
    <div ref={setNodeRef}>
      <Card
        className={cn(
          "rounded-[2rem] bg-[rgba(251,248,241,0.88)] py-0 shadow-[0_10px_40px_rgba(32,27,21,0.05)] backdrop-blur transition",
          isActiveDropzone ? "border-stone-900/30" : "border-black/8"
        )}
      >
        <CardHeader className="grid-cols-[1fr_auto] gap-3 border-b border-black/8 px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-medium text-stone-950">
              <span className="h-2.5 w-2.5 rounded-full bg-stone-400" />
              {label}
            </CardTitle>
            <CardDescription className="mt-1 text-sm text-stone-500">{hint}</CardDescription>
          </div>
          <Badge
            variant="outline"
            className="rounded-full border-black/8 bg-white/70 px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-stone-500"
          >
            {tasks.length}
          </Badge>
        </CardHeader>

        <CardContent className="task-list mt-4 grid min-h-60 gap-3 px-4 pb-4 sm:px-5 sm:pb-5">
          <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
            {tasks.length > 0 ? (
              tasks.map((task) => (
                <SortableTaskCard
                  key={task.id}
                  task={task}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onMoveBack={onMoveBack}
                  onMoveNext={onMoveNext}
                />
              ))
            ) : (
              <Card className="min-h-56 justify-between gap-0 rounded-[1.4rem] border-dashed border-black/10 bg-white/40 py-0 shadow-none">
                <CardContent className="flex h-full min-h-56 items-end p-4 text-sm text-stone-400">
                  <p>{isActiveDropzone ? "Release to drop the task here." : "No tasks yet."}</p>
                </CardContent>
              </Card>
            )}
          </SortableContext>
        </CardContent>
      </Card>
    </div>
  );
}

export function BoardClient({
  initialBoard,
  initialProjectId,
  initialProjects,
  userEmail,
}: BoardClientProps) {
  const [board, setBoard] = useState<BoardState>(initialBoard);
  const [projects, setProjects] = useState<ProjectSummary[]>(initialProjects);
  const [activeProjectId, setActiveProjectId] = useState(initialProjectId);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [newProjectName, setNewProjectName] = useState("");
  const [renameProjectName, setRenameProjectName] = useState("");
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectLoading, setProjectLoading] = useState<number | null>(null);
  const [isRenameProjectOpen, setIsRenameProjectOpen] = useState(false);
  const [isDeleteProjectOpen, setIsDeleteProjectOpen] = useState(false);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeDropColumn, setActiveDropColumn] = useState<ColumnId | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const didMountRef = useRef(false);
  const saveVersionRef = useRef(0);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    const version = ++saveVersionRef.current;
    const timeout = window.setTimeout(async () => {
      try {
        await saveBoardAction(activeProjectId, board);

        if (saveVersionRef.current === version) {
          setSaveState("saved");
        }
      } catch {
        if (saveVersionRef.current === version) {
          setSaveState("error");
        }
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [activeProjectId, board]);

  const totalTasks = countTasks(board);
  const workingCount = board.working.length;
  const progress = totalTasks === 0 ? 0 : Math.round((board.completed.length / totalTasks) * 100);
  const activeProjectName = projects.find((project) => project.id === activeProjectId)?.name ?? "Project";

  const activeTask = useMemo(
    () => (activeTaskId ? getTaskLocation(board, activeTaskId)?.task ?? null : null),
    [activeTaskId, board]
  );

  function applyBoardUpdate(updater: (currentBoard: BoardState) => BoardState) {
    setSaveState("saving");
    setBoard(updater);
  }

  function closeEditor() {
    setEditingTaskId(null);
    setEditTitle("");
    setEditNote("");
    setEditDueDate("");
  }

  async function handleProjectSwitch(projectId: number) {
    if (projectId === activeProjectId) {
      return;
    }

    setProjectError(null);
    setProjectLoading(projectId);

    try {
      const data = await getProjectDataAction(projectId);
      setActiveProjectId(data.activeProjectId);
      setBoard(data.board);
      setSaveState("idle");
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Could not open project.");
    } finally {
      setProjectLoading(null);
    }
  }

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newProjectName.trim()) {
      setProjectError("Project name is required.");
      return;
    }

    setProjectError(null);
    setProjectLoading(-1);

    try {
      const result = await createProjectAction(newProjectName);
      setProjects(result.projects);
      setActiveProjectId(result.activeProjectId);
      setBoard(result.board);
      setNewProjectName("");
      setSaveState("idle");
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Could not create project.");
    } finally {
      setProjectLoading(null);
    }
  }

  async function handleDeleteProject() {
    setProjectError(null);
    setProjectLoading(activeProjectId);

    try {
      const result = await deleteProjectAction(activeProjectId);
      setProjects(result.projects);
      setActiveProjectId(result.activeProjectId);
      setBoard(result.board);
      setSaveState("idle");
      setIsDeleteProjectOpen(false);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Could not delete project.");
    } finally {
      setProjectLoading(null);
    }
  }

  async function handleRenameProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!renameProjectName.trim()) {
      setProjectError("Project name is required.");
      return;
    }

    setProjectError(null);
    setProjectLoading(activeProjectId);

    try {
      const result = await renameProjectAction(activeProjectId, renameProjectName);
      setProjects(result.projects);
      setActiveProjectId(result.activeProjectId);
      setBoard(result.board);
      setSaveState("idle");
      setIsRenameProjectOpen(false);
    } catch (error) {
      setProjectError(error instanceof Error ? error.message : "Could not rename project.");
    } finally {
      setProjectLoading(null);
    }
  }

  function handleCreateTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    applyBoardUpdate((currentBoard) => ({
      ...currentBoard,
      todo: [createTask(title, note, dueDate), ...currentBoard.todo],
    }));
    setTitle("");
    setNote("");
    setDueDate("");
    setIsCreateTaskOpen(false);
  }

  function handleDeleteTask(taskId: string) {
    applyBoardUpdate((currentBoard) => removeTask(currentBoard, taskId));

    if (editingTaskId === taskId) {
      closeEditor();
    }
  }

  function handleClearCompleted() {
    applyBoardUpdate((currentBoard) => ({
      ...currentBoard,
      completed: [],
    }));
  }

  function openEditor(task: Task) {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditNote(task.note);
    setEditDueDate(task.dueDate ?? "");
  }

  function handleEditTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingTaskId || !editTitle.trim()) {
      return;
    }

    applyBoardUpdate((currentBoard) =>
      updateTask(currentBoard, editingTaskId, (task) => ({
        ...task,
        title: editTitle.trim(),
        note: editNote.trim(),
        dueDate: editDueDate || null,
      }))
    );

    closeEditor();
  }

  function handleShiftTask(taskId: string, direction: -1 | 1) {
    const source = getTaskLocation(board, taskId);

    if (!source) {
      return;
    }

    const nextColumn = statusOrder[statusOrder.indexOf(source.columnId) + direction];

    if (!nextColumn) {
      return;
    }

    applyBoardUpdate((currentBoard) => moveTask(currentBoard, taskId, nextColumn, 0));
  }

  function handleDragStart(event: DragStartEvent) {
    const taskId = String(event.active.id);
    const location = getTaskLocation(board, taskId);

    if (!location) {
      return;
    }

    setActiveTaskId(taskId);
    setActiveDropColumn(location.columnId);
  }

  function handleDragOver(event: DragOverEvent) {
    if (!event.over) {
      return;
    }

    const activeId = String(event.active.id);
    const overId = String(event.over.id);
    const activeLocation = getTaskLocation(board, activeId);

    if (!activeLocation) {
      return;
    }

    if (isColumnId(overId)) {
      setActiveDropColumn(overId);

      if (activeLocation.columnId !== overId) {
        applyBoardUpdate((currentBoard) => moveTask(currentBoard, activeId, overId));
      }

      return;
    }

    const overLocation = getTaskLocation(board, overId);

    if (!overLocation) {
      return;
    }

    setActiveDropColumn(overLocation.columnId);

    if (activeLocation.columnId !== overLocation.columnId) {
      applyBoardUpdate((currentBoard) =>
        moveTask(currentBoard, activeId, overLocation.columnId, overLocation.index)
      );
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTaskId(null);
    setActiveDropColumn(null);

    if (!event.over) {
      return;
    }

    const activeId = String(event.active.id);
    const overId = String(event.over.id);

    if (isColumnId(overId)) {
      applyBoardUpdate((currentBoard) => moveTask(currentBoard, activeId, overId));
      return;
    }

    applyBoardUpdate((currentBoard) => {
      const activeLocation = getTaskLocation(currentBoard, activeId);
      const overLocation = getTaskLocation(currentBoard, overId);

      if (!activeLocation || !overLocation) {
        return currentBoard;
      }

      if (activeLocation.columnId !== overLocation.columnId) {
        return moveTask(currentBoard, activeId, overLocation.columnId, overLocation.index);
      }

      if (activeLocation.index === overLocation.index) {
        return currentBoard;
      }

      const nextBoard = cloneBoard(currentBoard);
      nextBoard[activeLocation.columnId] = arrayMove(
        nextBoard[activeLocation.columnId],
        activeLocation.index,
        overLocation.index
      );

      return nextBoard;
    });
  }

  return (
    <>
      <main className="min-h-screen px-4 py-4 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:gap-5">
          <Card className="rounded-[1.5rem] border-black/8 bg-[rgba(252,249,243,0.82)] py-0 shadow-[0_12px_36px_rgba(32,27,21,0.07)] backdrop-blur">
            <CardContent className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    variant="outline"
                    className="rounded-full border-black/8 bg-white/65 px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-stone-500"
                  >
                    {userEmail}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-full border-black/8 bg-white/65 px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-stone-500"
                  >
                    {totalTasks} tasks
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-full border-black/8 bg-white/65 px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-stone-500"
                  >
                    {workingCount} working
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-full border-black/8 bg-white/65 px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-stone-500"
                  >
                    {progress}% done
                  </Badge>
                  <Badge
                    variant="outline"
                    className="rounded-full border-black/8 bg-white/65 px-3 py-1 text-[0.68rem] uppercase tracking-[0.18em] text-stone-500"
                  >
                    {saveState === "saving"
                      ? "Saving..."
                      : saveState === "saved"
                        ? "Saved"
                        : saveState === "error"
                          ? "Save failed"
                          : "Ready"}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-[family:var(--font-display)] text-2xl tracking-[-0.04em] text-stone-950 sm:text-3xl">
                    {activeProjectName}
                  </h1>
                  <Button
                    type="button"
                    onClick={() => setIsCreateTaskOpen(true)}
                    className="h-9 rounded-full bg-stone-950 px-4 text-sm font-medium text-stone-50 shadow-none hover:bg-stone-800"
                  >
                    <Plus className="size-4" />
                    Add task
                  </Button>
                  <Button
                    type="button"
                    onClick={handleClearCompleted}
                    variant="outline"
                    className="h-9 rounded-full border-black/10 bg-transparent px-4 text-stone-600 shadow-none hover:border-black/20 hover:bg-white/60 hover:text-stone-950"
                  >
                    Clear completed
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setRenameProjectName(activeProjectName);
                      setIsRenameProjectOpen(true);
                    }}
                    disabled={projectLoading !== null}
                    className="h-9 rounded-full border-black/10 bg-transparent px-4 text-stone-600 shadow-none hover:border-black/20 hover:bg-white/60 hover:text-stone-950"
                  >
                    Rename project
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDeleteProjectOpen(true)}
                    disabled={projects.length <= 1 || projectLoading !== null}
                    className="h-9 rounded-full border-black/10 bg-transparent px-4 text-stone-600 shadow-none hover:border-black/20 hover:bg-white/60 hover:text-stone-950"
                  >
                    Delete project
                  </Button>
                </div>

                <div className="grid gap-2 rounded-[1.2rem] border border-black/8 bg-white/72 p-2.5">
                  <div className="flex flex-wrap gap-2">
                    {projects.map((project) => (
                      <button
                        key={project.id}
                        type="button"
                        onClick={() => void handleProjectSwitch(project.id)}
                        disabled={projectLoading !== null}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-sm transition",
                          project.id === activeProjectId
                            ? "border-stone-950 bg-stone-950 text-stone-50"
                            : "border-black/10 bg-white/60 text-stone-600 hover:border-black/20 hover:text-stone-950"
                        )}
                      >
                        {projectLoading === project.id ? "Loading..." : project.name}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={(event) => void handleCreateProject(event)} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <Input
                      value={newProjectName}
                      onChange={(event) => setNewProjectName(event.target.value)}
                      placeholder="New project"
                      className="h-10 rounded-[1rem] border-black/10 bg-stone-50 px-4 text-base text-stone-950 shadow-none focus-visible:border-black/20 focus-visible:ring-0"
                    />
                    <Button
                      type="submit"
                      disabled={projectLoading !== null || !newProjectName.trim()}
                      variant="outline"
                      className="h-10 rounded-full border-black/10 bg-transparent px-4 text-stone-600 shadow-none hover:border-black/20 hover:bg-white/60 hover:text-stone-950"
                    >
                      <FolderPlus className="size-4" />
                      Add project
                    </Button>
                    <LogoutButton />
                  </form>

                  {projectError ? <p className="text-sm text-red-600">{projectError}</p> : null}
                </div>
              </div>
            </CardContent>
          </Card>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
              setActiveTaskId(null);
              setActiveDropColumn(null);
            }}
          >
            <section className="grid gap-4 xl:grid-cols-3">
              {columns.map((column) => (
                <ColumnCard
                  key={column.id}
                  columnId={column.id}
                  label={column.label}
                  hint={column.hint}
                  tasks={board[column.id]}
                  isActiveDropzone={activeTaskId !== null && activeDropColumn === column.id}
                  onEdit={openEditor}
                  onDelete={handleDeleteTask}
                  onMoveBack={(taskId) => handleShiftTask(taskId, -1)}
                  onMoveNext={(taskId) => handleShiftTask(taskId, 1)}
                />
              ))}
            </section>

            <DragOverlay>
              {activeTask ? (
                <div className="w-[min(100vw-2rem,24rem)]">
                  <TaskCardBody
                    task={activeTask}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    onMoveBack={() => {}}
                    onMoveNext={() => {}}
                    canMoveBack={false}
                    canMoveNext={false}
                    isDragging
                    isOverlay
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </main>

      <Dialog open={editingTaskId !== null} onOpenChange={(open) => (!open ? closeEditor() : undefined)}>
        <DialogContent className="rounded-[1.8rem] border-black/10 bg-[rgba(252,249,243,0.96)] p-0 shadow-[0_24px_80px_rgba(32,27,21,0.18)] sm:max-w-xl">
          <form onSubmit={handleEditTask} className="grid gap-0">
            <DialogHeader className="border-b border-black/8 px-6 py-5 text-left">
              <DialogTitle className="font-[family:var(--font-display)] text-3xl tracking-[-0.03em] text-stone-950">
                Edit task
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-stone-500">
                Adjust the title, note, or due date.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 px-6 py-5">
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-stone-500">Task title</span>
                <Input
                  value={editTitle}
                  onChange={(event) => setEditTitle(event.target.value)}
                  className="h-11 rounded-[1rem] border-black/10 bg-stone-50 px-4 text-base text-stone-950 shadow-none focus-visible:border-black/20 focus-visible:ring-0"
                  maxLength={80}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-stone-500">Note</span>
                <Textarea
                  value={editNote}
                  onChange={(event) => setEditNote(event.target.value)}
                  className="min-h-32 rounded-[1rem] border-black/10 bg-stone-50 px-4 py-3 text-base text-stone-950 shadow-none focus-visible:border-black/20 focus-visible:ring-0"
                  maxLength={220}
                />
              </label>

              <label className="grid gap-2 sm:max-w-[12rem]">
                <span className="text-xs uppercase tracking-[0.2em] text-stone-500">Due date</span>
                <Input
                  type="date"
                  value={editDueDate}
                  onChange={(event) => setEditDueDate(event.target.value)}
                  className="h-11 rounded-[1rem] border-black/10 bg-stone-50 px-4 text-base text-stone-950 shadow-none focus-visible:border-black/20 focus-visible:ring-0"
                />
              </label>
            </div>

            <DialogFooter className="border-t border-black/8 px-6 py-4 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={closeEditor}
                className="rounded-full border-black/10 bg-transparent px-4 text-stone-600 shadow-none hover:border-black/20 hover:bg-white/60 hover:text-stone-950"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!editTitle.trim()}
                className="rounded-full bg-stone-950 px-5 text-sm font-medium text-stone-50 shadow-none hover:bg-stone-800"
              >
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
        <DialogContent className="rounded-[1.8rem] border-black/10 bg-[rgba(252,249,243,0.96)] p-0 shadow-[0_24px_80px_rgba(32,27,21,0.18)] sm:max-w-xl">
          <form onSubmit={handleCreateTask} className="grid gap-0">
            <DialogHeader className="border-b border-black/8 px-6 py-5 text-left">
              <DialogTitle className="font-[family:var(--font-display)] text-3xl tracking-[-0.03em] text-stone-950">
                Add task
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-stone-500">
                Add a task to {activeProjectName}.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 px-6 py-5">
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-stone-500">Task title</span>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Prepare sprint notes"
                  className="h-11 rounded-[1rem] border-black/10 bg-stone-50 px-4 text-base text-stone-950 shadow-none focus-visible:border-black/20 focus-visible:ring-0"
                  maxLength={80}
                />
              </label>

              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-stone-500">Note</span>
                <Textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Optional note"
                  className="min-h-28 rounded-[1rem] border-black/10 bg-stone-50 px-4 py-3 text-base text-stone-950 shadow-none focus-visible:border-black/20 focus-visible:ring-0"
                  maxLength={220}
                />
              </label>

              <label className="grid gap-2 sm:max-w-[12rem]">
                <span className="text-xs uppercase tracking-[0.2em] text-stone-500">Due date</span>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="h-11 rounded-[1rem] border-black/10 bg-stone-50 px-4 text-base text-stone-950 shadow-none focus-visible:border-black/20 focus-visible:ring-0"
                />
              </label>
            </div>

            <DialogFooter className="border-t border-black/8 px-6 py-4 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateTaskOpen(false)}
                className="rounded-full border-black/10 bg-transparent px-4 text-stone-600 shadow-none hover:border-black/20 hover:bg-white/60 hover:text-stone-950"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!title.trim()}
                className="rounded-full bg-stone-950 px-5 text-sm font-medium text-stone-50 shadow-none hover:bg-stone-800"
              >
                Add task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteProjectOpen} onOpenChange={setIsDeleteProjectOpen}>
        <DialogContent className="rounded-[1.8rem] border-black/10 bg-[rgba(252,249,243,0.96)] p-0 shadow-[0_24px_80px_rgba(32,27,21,0.18)] sm:max-w-lg">
          <div className="grid gap-0">
            <DialogHeader className="border-b border-black/8 px-6 py-5 text-left">
              <DialogTitle className="font-[family:var(--font-display)] text-3xl tracking-[-0.03em] text-stone-950">
                Delete project
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-stone-500">
                Delete {activeProjectName} and all of its tasks.
              </DialogDescription>
            </DialogHeader>

            <DialogFooter className="border-t border-black/8 px-6 py-4 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDeleteProjectOpen(false)}
                className="rounded-full border-black/10 bg-transparent px-4 text-stone-600 shadow-none hover:border-black/20 hover:bg-white/60 hover:text-stone-950"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={() => void handleDeleteProject()}
                className="rounded-full bg-stone-950 px-5 text-sm font-medium text-stone-50 shadow-none hover:bg-stone-800"
              >
                Delete
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isRenameProjectOpen} onOpenChange={setIsRenameProjectOpen}>
        <DialogContent className="rounded-[1.8rem] border-black/10 bg-[rgba(252,249,243,0.96)] p-0 shadow-[0_24px_80px_rgba(32,27,21,0.18)] sm:max-w-lg">
          <form onSubmit={handleRenameProject} className="grid gap-0">
            <DialogHeader className="border-b border-black/8 px-6 py-5 text-left">
              <DialogTitle className="font-[family:var(--font-display)] text-3xl tracking-[-0.03em] text-stone-950">
                Rename project
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-stone-500">
                Update the project name.
              </DialogDescription>
            </DialogHeader>

            <div className="px-6 py-5">
              <label className="grid gap-2">
                <span className="text-xs uppercase tracking-[0.2em] text-stone-500">Project name</span>
                <Input
                  value={renameProjectName}
                  onChange={(event) => setRenameProjectName(event.target.value)}
                  className="h-11 rounded-[1rem] border-black/10 bg-stone-50 px-4 text-base text-stone-950 shadow-none focus-visible:border-black/20 focus-visible:ring-0"
                  maxLength={60}
                />
              </label>
            </div>

            <DialogFooter className="border-t border-black/8 px-6 py-4 sm:justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRenameProjectOpen(false)}
                className="rounded-full border-black/10 bg-transparent px-4 text-stone-600 shadow-none hover:border-black/20 hover:bg-white/60 hover:text-stone-950"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!renameProjectName.trim() || projectLoading !== null}
                className="rounded-full bg-stone-950 px-5 text-sm font-medium text-stone-50 shadow-none hover:bg-stone-800"
              >
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
