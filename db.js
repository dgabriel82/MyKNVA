import fs from "fs";
import path from "path";
import Database from "better-sqlite3";

const dataDir = path.resolve("./data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, "app.db"));

db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS modules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS classes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS canvases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    year INTEGER NOT NULL,
    module_id INTEGER NOT NULL,
    class_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    weekly_objectives TEXT NOT NULL,
    settings_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS canvas_dates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    canvas_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    extra_hour INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY(canvas_id) REFERENCES canvases(id)
  );

  CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    canvas_id INTEGER NOT NULL,
    day_id INTEGER,
    name TEXT NOT NULL,
    duration INTEGER NOT NULL,
    description TEXT NOT NULL,
    objective TEXT NOT NULL,
    material TEXT NOT NULL,
    comment TEXT NOT NULL,
    position INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY(canvas_id) REFERENCES canvases(id)
  );
`);

const ensureColumn = (table, column, type, defaultValue) => {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = columns.some((c) => c.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type} NOT NULL DEFAULT ${defaultValue}`);
  }
};

ensureColumn("activities", "material", "TEXT", "''");
ensureColumn("canvases", "weekly_objectives", "TEXT", "''");

export default db;
