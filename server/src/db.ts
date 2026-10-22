import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  Quiz,
  QuizAttempt,
  QuizAttemptInput,
  QuizInput,
  QuizQuestion,
  QuizSource,
  Viewer,
} from "./types.ts";

const DEFAULT_DB_PATH = path.resolve(import.meta.dirname, "../data/atlas.db");
// Nombre anterior del archivo (antes de renombrar el proyecto a atlas-anatomia-libre, D-015).
const LEGACY_DB_PATH = path.resolve(import.meta.dirname, "../data/biodigital.db");

// Si solo existe la BD con el nombre antiguo, se renombra (con sus archivos -wal y -shm).
function renameLegacyDb() {
  if (fs.existsSync(DEFAULT_DB_PATH) || !fs.existsSync(LEGACY_DB_PATH)) return;
  for (const suffix of ["", "-wal", "-shm"]) {
    if (fs.existsSync(LEGACY_DB_PATH + suffix)) fs.renameSync(LEGACY_DB_PATH + suffix, DEFAULT_DB_PATH + suffix);
  }
}

export type Db = DatabaseSync;

export function openDb(dbPath = process.env.ATLAS_DB || DEFAULT_DB_PATH): Db {
  if (dbPath === DEFAULT_DB_PATH) renameLegacyDb();
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  migrate(db);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

const NOW = "(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))";

// Migraciones en orden; PRAGMA user_version guarda cuántas se han aplicado.
// Nunca se edita una migración ya publicada: los cambios van en una nueva.
// SQL estándar en lo posible para facilitar una futura migración a PostgreSQL.
const MIGRATIONS: string[] = [
  // v1: cuestionarios, preguntas e intentos
  `
    CREATE TABLE IF NOT EXISTS quizzes (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      subtitle    TEXT NOT NULL DEFAULT '',
      source      TEXT NOT NULL CHECK (source IN ('seed', 'manual', 'generated')),
      created_at  TEXT NOT NULL DEFAULT ${NOW},
      updated_at  TEXT NOT NULL DEFAULT ${NOW}
    );

    CREATE TABLE IF NOT EXISTS questions (
      id                   TEXT NOT NULL,
      quiz_id              TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      position             INTEGER NOT NULL,
      type                 TEXT NOT NULL CHECK (type IN ('find3d', 'multipleChoice')),
      prompt               TEXT NOT NULL,
      hint                 TEXT NOT NULL DEFAULT '',
      body_sex             TEXT NOT NULL CHECK (body_sex IN ('male', 'female')),
      enabled_systems      TEXT NOT NULL,  -- JSON: SystemId[]
      target_structure_id  TEXT NOT NULL,
      target_name_es       TEXT NOT NULL,
      options              TEXT,           -- JSON: string[] (solo multipleChoice)
      explanation          TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (quiz_id, id)
    );
    CREATE INDEX IF NOT EXISTS idx_questions_quiz ON questions(quiz_id, position);

    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id      TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      score        INTEGER NOT NULL,
      total        INTEGER NOT NULL,
      answers      TEXT NOT NULL,          -- JSON: QuizAnswer[]
      finished_at  TEXT NOT NULL DEFAULT ${NOW}
    );
    CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON quiz_attempts(quiz_id, finished_at);
  `,
  // v2: propietario de cada cuestionario e intento, preparado para la autenticación.
  `
    ALTER TABLE quizzes ADD COLUMN user_id INTEGER;
    ALTER TABLE quiz_attempts ADD COLUMN user_id INTEGER;
    CREATE INDEX IF NOT EXISTS idx_quizzes_user ON quizzes(user_id);
    CREATE INDEX IF NOT EXISTS idx_attempts_user ON quiz_attempts(user_id, finished_at);
  `,
  // v3: cuentas y sesiones. user_id pasa a ser clave foránea (borrar una cuenta borra sus
  // cuestionarios e intentos) y los cuestionarios tienen visibilidad. SQLite no permite añadir
  // una clave foránea a una tabla existente: se reconstruyen quizzes y quiz_attempts.
  // Lo que existía antes de las cuentas no tiene dueño y queda público.
  `
    CREATE TABLE users (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      username       TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash  TEXT NOT NULL,
      role           TEXT NOT NULL DEFAULT 'estudiante' CHECK (role IN ('estudiante', 'docente', 'admin')),
      is_active      INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
      created_at     TEXT NOT NULL DEFAULT ${NOW},
      last_login_at  TEXT
    );

    -- Solo se guarda el hash SHA-256 del token: una copia de la BD no permite suplantar sesiones.
    CREATE TABLE sessions (
      token_hash  TEXT PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at  TEXT NOT NULL DEFAULT ${NOW},
      expires_at  TEXT NOT NULL
    );
    CREATE INDEX idx_sessions_user ON sessions(user_id);

    CREATE TABLE quizzes_v3 (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      subtitle    TEXT NOT NULL DEFAULT '',
      source      TEXT NOT NULL CHECK (source IN ('seed', 'manual', 'generated')),
      user_id     INTEGER REFERENCES users(id) ON DELETE CASCADE,
      is_public   INTEGER NOT NULL DEFAULT 0 CHECK (is_public IN (0, 1)),
      created_at  TEXT NOT NULL DEFAULT ${NOW},
      updated_at  TEXT NOT NULL DEFAULT ${NOW}
    );
    INSERT INTO quizzes_v3 (id, title, subtitle, source, user_id, is_public, created_at, updated_at)
      SELECT id, title, subtitle, source, NULL, 1, created_at, updated_at FROM quizzes;
    DROP TABLE quizzes;
    ALTER TABLE quizzes_v3 RENAME TO quizzes;
    CREATE INDEX idx_quizzes_user ON quizzes(user_id);

    CREATE TABLE quiz_attempts_v3 (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      quiz_id      TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      user_id      INTEGER REFERENCES users(id) ON DELETE CASCADE,
      score        INTEGER NOT NULL,
      total        INTEGER NOT NULL,
      answers      TEXT NOT NULL,
      finished_at  TEXT NOT NULL DEFAULT ${NOW}
    );
    INSERT INTO quiz_attempts_v3 (id, quiz_id, user_id, score, total, answers, finished_at)
      SELECT id, quiz_id, NULL, score, total, answers, finished_at FROM quiz_attempts;
    DROP TABLE quiz_attempts;
    ALTER TABLE quiz_attempts_v3 RENAME TO quiz_attempts;
    CREATE INDEX idx_attempts_quiz ON quiz_attempts(quiz_id, finished_at);
    CREATE INDEX idx_attempts_user ON quiz_attempts(user_id, finished_at);
  `,
  // v4: vistas guardadas y notas por estructura, privadas de cada usuario.
  `
    CREATE TABLE saved_views (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name        TEXT NOT NULL,
      state       TEXT NOT NULL,          -- JSON: cámara, modelo, capas, cortes, selección…
      created_at  TEXT NOT NULL DEFAULT ${NOW},
      updated_at  TEXT NOT NULL DEFAULT ${NOW}
    );
    CREATE INDEX idx_views_user ON saved_views(user_id, updated_at);

    -- Los ids de estructura son únicos entre modelos (FMA… masculino, VH_F_… femenino).
    CREATE TABLE structure_notes (
      user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      structure_id  TEXT NOT NULL,
      note          TEXT NOT NULL,
      updated_at    TEXT NOT NULL DEFAULT ${NOW},
      PRIMARY KEY (user_id, structure_id)
    );
  `,
];

// Se ejecuta con las claves foráneas desactivadas (necesario para reconstruir tablas sin
// borrados en cascada) y se comprueba la integridad al final.
function migrate(db: Db) {
  const { user_version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (user_version >= MIGRATIONS.length) return;
  db.exec("PRAGMA foreign_keys = OFF;");
  for (let v = user_version; v < MIGRATIONS.length; v++) {
    tx(db, () => {
      db.exec(MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
    });
  }
  const broken = db.prepare("PRAGMA foreign_key_check").all();
  if (broken.length) throw new Error(`Migración con claves foráneas rotas: ${JSON.stringify(broken)}`);
}

// Ejecuta fn dentro de una transacción; si lanza, se revierte.
export function tx<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

interface QuestionRow {
  id: string;
  type: QuizQuestion["type"];
  prompt: string;
  hint: string;
  body_sex: QuizQuestion["bodySex"];
  enabled_systems: string;
  target_structure_id: string;
  target_name_es: string;
  options: string | null;
  explanation: string;
}

function rowToQuestion(r: QuestionRow): QuizQuestion {
  return {
    id: r.id,
    type: r.type,
    prompt: r.prompt,
    hint: r.hint,
    bodySex: r.body_sex,
    enabledSystems: JSON.parse(r.enabled_systems),
    targetStructureId: r.target_structure_id,
    targetNameEs: r.target_name_es,
    ...(r.options ? { options: JSON.parse(r.options) } : {}),
    explanation: r.explanation,
  };
}

// Visible para quien mira: públicos, los suyos y, para el admin, todos.
const VISIBLE = `(q.is_public = 1 OR q.user_id = :viewerId OR :isAdmin = 1)`;

const QUIZ_COLUMNS = `q.id, q.title, q.subtitle, q.source, q.user_id AS userId, u.username AS ownerName,
  q.is_public AS isPublic, q.created_at AS createdAt, q.updated_at AS updatedAt`;

type QuizRow = Omit<Quiz, "questions" | "isPublic"> & { isPublic: number };

const viewerParams = (viewer: Viewer | null) => ({
  viewerId: viewer?.id ?? -1,
  isAdmin: viewer?.role === "admin" ? 1 : 0,
});

function withQuestions(db: Db, row: QuizRow): Quiz {
  const rows = db
    .prepare("SELECT * FROM questions WHERE quiz_id = ? ORDER BY position")
    .all(row.id) as unknown as QuestionRow[];
  return { ...row, isPublic: row.isPublic === 1, questions: rows.map(rowToQuestion) };
}

// Sin viewer devuelve el cuestionario sin filtrar (uso interno); con viewer, solo si lo puede ver.
export function getQuiz(db: Db, id: string, viewer?: Viewer | null): Quiz | null {
  const filter = viewer === undefined ? "" : `AND ${VISIBLE}`;
  const row = db
    .prepare(`SELECT ${QUIZ_COLUMNS} FROM quizzes q LEFT JOIN users u ON u.id = q.user_id WHERE q.id = :id ${filter}`)
    .get({ id, ...(viewer === undefined ? {} : viewerParams(viewer)) }) as QuizRow | undefined;
  return row ? withQuestions(db, row) : null;
}

export function listQuizzesFull(db: Db, viewer: Viewer | null): Quiz[] {
  const rows = db
    .prepare(
      `SELECT ${QUIZ_COLUMNS} FROM quizzes q LEFT JOIN users u ON u.id = q.user_id
       WHERE ${VISIBLE}
       ORDER BY CASE q.source WHEN 'seed' THEN 0 ELSE 1 END, q.created_at`
    )
    .all(viewerParams(viewer)) as unknown as QuizRow[];
  return rows.map((r) => withQuestions(db, r));
}

function insertQuestions(db: Db, quizId: string, questions: QuizQuestion[]) {
  const stmt = db.prepare(
    `INSERT INTO questions
       (id, quiz_id, position, type, prompt, hint, body_sex, enabled_systems,
        target_structure_id, target_name_es, options, explanation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  questions.forEach((q, i) => {
    stmt.run(
      q.id,
      quizId,
      i,
      q.type,
      q.prompt,
      q.hint ?? "",
      q.bodySex,
      JSON.stringify(q.enabledSystems),
      q.targetStructureId,
      q.targetNameEs,
      q.type === "multipleChoice" && q.options ? JSON.stringify(q.options) : null,
      q.explanation ?? ""
    );
  });
}

export function createQuiz(
  db: Db,
  input: QuizInput,
  source: QuizSource,
  owner: { userId: number | null; isPublic: boolean }
): Quiz {
  const id = input.id || `quiz-${crypto.randomUUID().slice(0, 8)}`;
  tx(db, () => {
    db.prepare(
      "INSERT INTO quizzes (id, title, subtitle, source, user_id, is_public) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, input.title, input.subtitle ?? "", source, owner.userId, owner.isPublic ? 1 : 0);
    insertQuestions(db, id, input.questions);
  });
  return getQuiz(db, id)!;
}

export function updateQuiz(db: Db, id: string, input: QuizInput): Quiz | null {
  const exists = db.prepare("SELECT 1 FROM quizzes WHERE id = ?").get(id);
  if (!exists) return null;
  tx(db, () => {
    db.prepare(
      `UPDATE quizzes SET title = ?, subtitle = ?, updated_at = ${NOW} WHERE id = ?`
    ).run(input.title, input.subtitle ?? "", id);
    db.prepare("DELETE FROM questions WHERE quiz_id = ?").run(id);
    insertQuestions(db, id, input.questions);
  });
  return getQuiz(db, id);
}

export function setQuizVisibility(db: Db, id: string, isPublic: boolean): Quiz | null {
  db.prepare(`UPDATE quizzes SET is_public = ?, updated_at = ${NOW} WHERE id = ?`).run(isPublic ? 1 : 0, id);
  return getQuiz(db, id);
}

export function deleteQuiz(db: Db, id: string): boolean {
  return db.prepare("DELETE FROM quizzes WHERE id = ?").run(id).changes > 0;
}

export function addAttempt(db: Db, quizId: string, input: QuizAttemptInput, userId: number): QuizAttempt {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO quiz_attempts (quiz_id, score, total, answers, user_id) VALUES (?, ?, ?, ?, ?)")
    .run(quizId, input.score, input.total, JSON.stringify(input.answers), userId);
  return getAttempt(db, Number(lastInsertRowid))!;
}

interface AttemptRow {
  id: number;
  quiz_id: string;
  quiz_title?: string;
  score: number;
  total: number;
  answers: string;
  finished_at: string;
  user_id: number | null;
}

function rowToAttempt(r: AttemptRow): QuizAttempt {
  return {
    id: r.id,
    quizId: r.quiz_id,
    ...(r.quiz_title !== undefined ? { quizTitle: r.quiz_title } : {}),
    score: r.score,
    total: r.total,
    answers: JSON.parse(r.answers),
    finishedAt: r.finished_at,
    userId: r.user_id,
  };
}

function getAttempt(db: Db, id: number): QuizAttempt | null {
  const r = db.prepare("SELECT * FROM quiz_attempts WHERE id = ?").get(id) as AttemptRow | undefined;
  return r ? rowToAttempt(r) : null;
}

// Intentos de un usuario: de un cuestionario concreto o de todos (historial del perfil).
export function listUserAttempts(db: Db, userId: number, quizId?: string, limit = 50): QuizAttempt[] {
  const rows = db
    .prepare(
      `SELECT a.*, q.title AS quiz_title FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
       WHERE a.user_id = :userId ${quizId ? "AND a.quiz_id = :quizId" : ""}
       ORDER BY a.finished_at DESC, a.id DESC LIMIT :limit`
    )
    .all({ userId, limit, ...(quizId ? { quizId } : {}) }) as unknown as AttemptRow[];
  return rows.map(rowToAttempt);
}

export function countQuizzes(db: Db): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM quizzes").get() as { n: number }).n;
}
