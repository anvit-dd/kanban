import "server-only";

import { db } from "@/lib/db";
import { createStarterBoard, emptyBoard, statusOrder, type BoardState, type Task } from "@/lib/board";

type UserRow = {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
};

type ProjectRow = {
  id: number;
  user_id: number;
  name: string;
  position: number;
  created_at: string;
};

type TaskRow = {
  id: string;
  title: string;
  note: string;
  status: Task["status"];
  due_date: string | null;
  created_at: string;
};

export type UserRecord = {
  id: number;
  email: string;
  passwordHash: string;
  createdAt: string;
};

export type ProjectRecord = {
  id: number;
  userId: number;
  name: string;
  position: number;
  createdAt: string;
};

function mapUser(row: UserRow): UserRecord {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: row.created_at,
  };
}

function mapProject(row: ProjectRow): ProjectRecord {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    position: row.position,
    createdAt: row.created_at,
  };
}

function normalizeProjectName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function getUserByEmail(email: string) {
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function getUserById(id: number) {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function createUser(email: string, passwordHash: string) {
  const createdAt = new Date().toISOString();
  const result = db
    .prepare("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)")
    .run(email, passwordHash, createdAt);

  return {
    id: Number(result.lastInsertRowid),
    email,
    passwordHash,
    createdAt,
  } satisfies UserRecord;
}

export function listProjectsForUser(userId: number) {
  const rows = db
    .prepare("SELECT * FROM projects WHERE user_id = ? ORDER BY position ASC, id ASC")
    .all(userId) as ProjectRow[];

  return rows.map(mapProject);
}

export function getProjectForUser(userId: number, projectId: number) {
  const row = db
    .prepare("SELECT * FROM projects WHERE user_id = ? AND id = ?")
    .get(userId, projectId) as ProjectRow | undefined;

  return row ? mapProject(row) : null;
}

export function createProjectForUser(userId: number, name: string, useStarterBoard = true) {
  const normalizedName = normalizeProjectName(name);

  if (!normalizedName) {
    throw new Error("Project name is required.");
  }

  const existing = db
    .prepare("SELECT id FROM projects WHERE user_id = ? AND lower(name) = lower(?)")
    .get(userId, normalizedName) as { id: number } | undefined;

  if (existing) {
    throw new Error("Project already exists.");
  }

  const nextPositionRow = db
    .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM projects WHERE user_id = ?")
    .get(userId) as { next_position: number };

  const createdAt = new Date().toISOString();
  const result = db
    .prepare("INSERT INTO projects (user_id, name, position, created_at) VALUES (?, ?, ?, ?)")
    .run(userId, normalizedName, nextPositionRow.next_position, createdAt);

  const project = {
    id: Number(result.lastInsertRowid),
    userId,
    name: normalizedName,
    position: nextPositionRow.next_position,
    createdAt,
  } satisfies ProjectRecord;

  replaceBoardForProject(userId, project.id, useStarterBoard ? createStarterBoard() : emptyBoard());
  return project;
}

export function deleteProjectForUser(userId: number, projectId: number) {
  const project = getProjectForUser(userId, projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  const projects = listProjectsForUser(userId);

  if (projects.length <= 1) {
    throw new Error("Keep at least one project.");
  }

  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM tasks WHERE user_id = ? AND project_id = ?").run(userId, projectId);
    db.prepare("DELETE FROM projects WHERE user_id = ? AND id = ?").run(userId, projectId);

    const remainingProjects = db
      .prepare("SELECT id FROM projects WHERE user_id = ? ORDER BY position ASC, id ASC")
      .all(userId) as Array<{ id: number }>;

    const updatePosition = db.prepare("UPDATE projects SET position = ? WHERE id = ?");

    remainingProjects.forEach((remainingProject, index) => {
      updatePosition.run(index, remainingProject.id);
    });
  });

  transaction();
}

export function getBoardForProject(userId: number, projectId: number): BoardState {
  const project = getProjectForUser(userId, projectId);

  if (!project) {
    return emptyBoard();
  }

  const rows = db
    .prepare(
      `SELECT id, title, note, status, due_date, created_at
       FROM tasks
       WHERE user_id = ? AND project_id = ?
       ORDER BY CASE status
         WHEN 'todo' THEN 0
         WHEN 'working' THEN 1
         WHEN 'completed' THEN 2
       END, position ASC`
    )
    .all(userId, projectId) as TaskRow[];

  if (rows.length === 0) {
    return emptyBoard();
  }

  const board = emptyBoard();

  for (const row of rows) {
    board[row.status].push({
      id: row.id,
      title: row.title,
      note: row.note,
      status: row.status,
      dueDate: row.due_date,
      createdAt: row.created_at,
    });
  }

  return board;
}

export function replaceBoardForProject(userId: number, projectId: number, board: BoardState) {
  const project = getProjectForUser(userId, projectId);

  if (!project) {
    throw new Error("Project not found.");
  }

  const transaction = db.transaction((nextBoard: BoardState) => {
    db.prepare("DELETE FROM tasks WHERE user_id = ? AND project_id = ?").run(userId, projectId);

    const insertTask = db.prepare(
      `INSERT INTO tasks (id, user_id, project_id, title, note, status, position, due_date, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    for (const columnId of statusOrder) {
      nextBoard[columnId].forEach((task, index) => {
        insertTask.run(
          task.id,
          userId,
          projectId,
          task.title,
          task.note,
          columnId,
          index,
          task.dueDate,
          task.createdAt
        );
      });
    }
  });

  transaction(board);
}
