import express from "express";
import fs from "fs";
import path from "path";
import session from "express-session";
import helmet from "helmet";
import bcrypt from "bcryptjs";
import SQLiteStoreFactory from "better-sqlite3-session-store";
import db from "./db.js";

const SQLiteStore = SQLiteStoreFactory(session);

const app = express();
const PORT = process.env.PORT || 3000;

const dataDir = path.resolve("./data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json());
app.use(
  session({
    store: new SQLiteStore({ client: db }),
    secret: process.env.SESSION_SECRET || "knva-dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true },
  })
);

app.use(express.static("public"));

const nowIso = () => new Date().toISOString();

const requireAuth = (req, res, next) => {
  if (!req.session.userId) return res.status(401).json({ error: "Non authentifié" });
  next();
};

const getUserId = (req) => req.session.userId;

app.post("/api/auth/register", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });
  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) return res.status(409).json({ error: "Email déjà utilisé" });
  const hash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare("INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)")
    .run(email, hash, nowIso());
  req.session.userId = info.lastInsertRowid;
  res.json({ id: info.lastInsertRowid, email });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email et mot de passe requis" });
  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!user) return res.status(401).json({ error: "Identifiants invalides" });
  const ok = bcrypt.compareSync(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: "Identifiants invalides" });
  req.session.userId = user.id;
  res.json({ id: user.id, email: user.email });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/me", (req, res) => {
  if (!req.session.userId) return res.json({ user: null });
  const user = db.prepare("SELECT id, email FROM users WHERE id = ?").get(req.session.userId);
  res.json({ user: user || null });
});

app.get("/api/modules", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM modules WHERE user_id = ? ORDER BY id DESC").all(getUserId(req));
  res.json(rows);
});

app.post("/api/modules", requireAuth, (req, res) => {
  const { name, description } = req.body || {};
  if (!name) return res.status(400).json({ error: "Nom requis" });
  const info = db
    .prepare("INSERT INTO modules (user_id, name, description, created_at) VALUES (?, ?, ?, ?)")
    .run(getUserId(req), name, description || "", nowIso());
  const row = db.prepare("SELECT * FROM modules WHERE id = ?").get(info.lastInsertRowid);
  res.json(row);
});

app.put("/api/modules/:id", requireAuth, (req, res) => {
  const { name, description } = req.body || {};
  db.prepare("UPDATE modules SET name = ?, description = ? WHERE id = ? AND user_id = ?")
    .run(name, description, req.params.id, getUserId(req));
  const row = db.prepare("SELECT * FROM modules WHERE id = ?").get(req.params.id);
  res.json(row);
});

app.delete("/api/modules/:id", requireAuth, (req, res) => {
  const inUse = db
    .prepare("SELECT COUNT(1) as cnt FROM canvases WHERE module_id = ? AND user_id = ?")
    .get(req.params.id, getUserId(req));
  if (inUse.cnt > 0) return res.status(409).json({ error: "Module utilisé dans un canevas" });
  db.prepare("DELETE FROM modules WHERE id = ? AND user_id = ?").run(req.params.id, getUserId(req));
  res.json({ ok: true });
});

app.get("/api/classes", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM classes WHERE user_id = ? ORDER BY id DESC").all(getUserId(req));
  res.json(rows);
});

app.post("/api/classes", requireAuth, (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: "Nom requis" });
  const info = db
    .prepare("INSERT INTO classes (user_id, name, created_at) VALUES (?, ?, ?)")
    .run(getUserId(req), name, nowIso());
  const row = db.prepare("SELECT * FROM classes WHERE id = ?").get(info.lastInsertRowid);
  res.json(row);
});

app.put("/api/classes/:id", requireAuth, (req, res) => {
  const { name } = req.body || {};
  db.prepare("UPDATE classes SET name = ? WHERE id = ? AND user_id = ?")
    .run(name, req.params.id, getUserId(req));
  const row = db.prepare("SELECT * FROM classes WHERE id = ?").get(req.params.id);
  res.json(row);
});

app.delete("/api/classes/:id", requireAuth, (req, res) => {
  const inUse = db
    .prepare("SELECT COUNT(1) as cnt FROM canvases WHERE class_id = ? AND user_id = ?")
    .get(req.params.id, getUserId(req));
  if (inUse.cnt > 0) return res.status(409).json({ error: "Classe utilisée dans un canevas" });
  db.prepare("DELETE FROM classes WHERE id = ? AND user_id = ?").run(req.params.id, getUserId(req));
  res.json({ ok: true });
});

app.get("/api/years", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT DISTINCT year FROM canvases WHERE user_id = ? ORDER BY year DESC").all(getUserId(req));
  res.json(rows.map((r) => r.year));
});

app.get("/api/canvases", requireAuth, (req, res) => {
  const year = Number(req.query.year);
  const moduleId = Number(req.query.module_id);
  const classId = Number(req.query.class_id);
  const rows = db
    .prepare(
      "SELECT * FROM canvases WHERE user_id = ? AND (? IS NULL OR year = ?) AND (? IS NULL OR module_id = ?) AND (? IS NULL OR class_id = ?) ORDER BY id DESC"
    )
    .all(
      getUserId(req),
      year || null,
      year || null,
      moduleId || null,
      moduleId || null,
      classId || null,
      classId || null
    );
  res.json(rows.map((c) => ({ ...c, settings: JSON.parse(c.settings_json) })));
});

app.post("/api/canvases", requireAuth, (req, res) => {
  const { year, module_id, class_id, title, weekly_objectives, settings } = req.body || {};
  const info = db
    .prepare(
      "INSERT INTO canvases (user_id, year, module_id, class_id, title, weekly_objectives, settings_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      getUserId(req),
      year,
      module_id,
      class_id,
      title || "Canevas",
      weekly_objectives || "",
      JSON.stringify(settings || {}),
      nowIso()
    );
  const row = db.prepare("SELECT * FROM canvases WHERE id = ?").get(info.lastInsertRowid);
  res.json({ ...row, settings: JSON.parse(row.settings_json) });
});

app.put("/api/canvases/:id", requireAuth, (req, res) => {
  const { year, module_id, class_id, title, weekly_objectives, settings } = req.body || {};
  db.prepare(
    "UPDATE canvases SET year = ?, module_id = ?, class_id = ?, title = ?, weekly_objectives = ?, settings_json = ? WHERE id = ? AND user_id = ?"
  ).run(
    year,
    module_id,
    class_id,
    title,
    weekly_objectives || "",
    JSON.stringify(settings || {}),
    req.params.id,
    getUserId(req)
  );
  const row = db.prepare("SELECT * FROM canvases WHERE id = ?").get(req.params.id);
  res.json({ ...row, settings: JSON.parse(row.settings_json) });
});

app.delete("/api/canvases/:id", requireAuth, (req, res) => {
  const id = req.params.id;
  db.prepare("DELETE FROM activities WHERE canvas_id = ?").run(id);
  db.prepare("DELETE FROM canvas_dates WHERE canvas_id = ?").run(id);
  db.prepare("DELETE FROM canvases WHERE id = ? AND user_id = ?").run(id, getUserId(req));
  res.json({ ok: true });
});

app.get("/api/canvases/:id/dates", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM canvas_dates WHERE canvas_id = ? ORDER BY date").all(req.params.id);
  res.json(rows);
});

app.post("/api/canvases/:id/dates", requireAuth, (req, res) => {
  const { date, extra_hour } = req.body || {};
  const info = db
    .prepare("INSERT INTO canvas_dates (canvas_id, date, extra_hour) VALUES (?, ?, ?)")
    .run(req.params.id, date, extra_hour ? 1 : 0);
  const row = db.prepare("SELECT * FROM canvas_dates WHERE id = ?").get(info.lastInsertRowid);
  res.json(row);
});

app.put("/api/dates/:id", requireAuth, (req, res) => {
  const { date, extra_hour } = req.body || {};
  db.prepare("UPDATE canvas_dates SET date = ?, extra_hour = ? WHERE id = ?")
    .run(date, extra_hour ? 1 : 0, req.params.id);
  const row = db.prepare("SELECT * FROM canvas_dates WHERE id = ?").get(req.params.id);
  res.json(row);
});

app.delete("/api/dates/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM canvas_dates WHERE id = ?").run(req.params.id);
  db.prepare("UPDATE activities SET day_id = NULL WHERE day_id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.get("/api/canvases/:id/activities", requireAuth, (req, res) => {
  const rows = db
    .prepare("SELECT * FROM activities WHERE canvas_id = ? ORDER BY position ASC, id ASC")
    .all(req.params.id);
  res.json(rows);
});

app.post("/api/canvases/:id/activities", requireAuth, (req, res) => {
  const { day_id, name, duration, description, objective, material, comment } = req.body || {};
  const posRow = db
    .prepare("SELECT COALESCE(MAX(position), 0) + 1 AS pos FROM activities WHERE canvas_id = ?")
    .get(req.params.id);
  const info = db
    .prepare(
      "INSERT INTO activities (canvas_id, day_id, name, duration, description, objective, material, comment, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      req.params.id,
      day_id || null,
      name || "Nouvelle activité",
      Number(duration || 30),
      description || "",
      objective || "",
      material || "",
      comment || "",
      posRow.pos,
      nowIso()
    );
  const row = db.prepare("SELECT * FROM activities WHERE id = ?").get(info.lastInsertRowid);
  res.json(row);
});

app.put("/api/activities/:id", requireAuth, (req, res) => {
  const { day_id, name, duration, description, objective, material, comment } = req.body || {};
  db.prepare(
    "UPDATE activities SET day_id = ?, name = ?, duration = ?, description = ?, objective = ?, material = ?, comment = ? WHERE id = ?"
  ).run(day_id || null, name, Number(duration || 0), description, objective, material || "", comment, req.params.id);
  const row = db.prepare("SELECT * FROM activities WHERE id = ?").get(req.params.id);
  res.json(row);
});

app.delete("/api/activities/:id", requireAuth, (req, res) => {
  db.prepare("DELETE FROM activities WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

app.post("/api/activities/reorder", requireAuth, (req, res) => {
  const { ids } = req.body || {};
  if (!Array.isArray(ids)) return res.status(400).json({ error: "ids requis" });
  const stmt = db.prepare("UPDATE activities SET position = ? WHERE id = ?");
  const tx = db.transaction((items) => {
    items.forEach((id, index) => stmt.run(index + 1, id));
  });
  tx(ids);
  res.json({ ok: true });
});

app.post("/api/canvases/duplicate-prev", requireAuth, (req, res) => {
  const { year } = req.body || {};
  const currentYear = Number(year);
  const prev = db
    .prepare("SELECT DISTINCT year FROM canvases WHERE user_id = ? AND year < ? ORDER BY year DESC LIMIT 1")
    .get(getUserId(req), currentYear);
  if (!prev) return res.status(404).json({ error: "Aucune année précédente" });
  const prevCanvases = db
    .prepare("SELECT * FROM canvases WHERE user_id = ? AND year = ?")
    .all(getUserId(req), prev.year);

  const insertCanvas = db.prepare(
    "INSERT INTO canvases (user_id, year, module_id, class_id, title, weekly_objectives, settings_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insertDate = db.prepare("INSERT INTO canvas_dates (canvas_id, date, extra_hour) VALUES (?, ?, ?)");
  const insertActivity = db.prepare(
    "INSERT INTO activities (canvas_id, day_id, name, duration, description, objective, material, comment, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  const tx = db.transaction(() => {
    prevCanvases.forEach((c) => {
      const canvasInfo = insertCanvas.run(
        getUserId(req),
        currentYear,
        c.module_id,
        c.class_id,
        `${c.title} (copie ${currentYear})`,
        c.weekly_objectives || "",
        c.settings_json,
        nowIso()
      );
      const newCanvasId = canvasInfo.lastInsertRowid;
      const dates = db.prepare("SELECT * FROM canvas_dates WHERE canvas_id = ?").all(c.id);
      const dateMap = new Map();
      dates.forEach((d) => {
        const shifted = shiftDateYear(d.date, currentYear);
        const dateInfo = insertDate.run(newCanvasId, shifted, d.extra_hour);
        dateMap.set(d.id, dateInfo.lastInsertRowid);
      });
      const activities = db.prepare("SELECT * FROM activities WHERE canvas_id = ?").all(c.id);
      activities.forEach((a) => {
        insertActivity.run(
          newCanvasId,
          a.day_id ? dateMap.get(a.day_id) || null : null,
          a.name,
          a.duration,
          a.description,
          a.objective,
          a.material,
          a.comment,
          a.position,
          nowIso()
        );
      });
    });
  });

  tx();
  res.json({ ok: true, fromYear: prev.year, toYear: currentYear });
});

const shiftDateYear = (dateStr, newYear) => {
  if (!dateStr || !dateStr.includes("-")) return dateStr;
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  parts[0] = String(newYear);
  return parts.join("-");
};

app.listen(PORT, () => {
  console.log(`MyKNVA server listening on ${PORT}`);
});
