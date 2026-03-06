import "server-only";

import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDirectory = process.env.DATA_DIRECTORY
  ? path.resolve(process.cwd(), process.env.DATA_DIRECTORY)
  : path.join(process.cwd(), "data");

if (!existsSync(dataDirectory)) {
  mkdirSync(dataDirectory, { recursive: true });
}

const databasePath = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.join(dataDirectory, "kanban.sqlite");

const databaseDirectory = path.dirname(databasePath);

if (!existsSync(databaseDirectory)) {
  mkdirSync(databaseDirectory, { recursive: true });
}

export const db = new Database(databasePath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    note TEXT NOT NULL,
    status TEXT NOT NULL,
    position INTEGER NOT NULL,
    due_date TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

const taskColumns = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>;

if (!taskColumns.some((column) => column.name === "project_id")) {
  db.exec("ALTER TABLE tasks ADD COLUMN project_id INTEGER");
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_projects_user_position
  ON projects(user_id, position);

  CREATE INDEX IF NOT EXISTS idx_tasks_user_status_position
  ON tasks(user_id, status, position);

  CREATE INDEX IF NOT EXISTS idx_tasks_project_status_position
  ON tasks(project_id, status, position);

  INSERT INTO projects (user_id, name, position, created_at)
  SELECT users.id, 'General', 0, datetime('now')
  FROM users
  WHERE NOT EXISTS (
    SELECT 1
    FROM projects
    WHERE projects.user_id = users.id
  );

  UPDATE tasks
  SET project_id = (
    SELECT projects.id
    FROM projects
    WHERE projects.user_id = tasks.user_id
    ORDER BY projects.position ASC, projects.id ASC
    LIMIT 1
  )
  WHERE project_id IS NULL;
`);
