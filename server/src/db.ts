import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { POSTGRES_MIGRATIONS } from "./schema-postgres.ts";
import { SQLITE_MIGRATIONS } from "./schema-sqlite.ts";
import { asBool, describeConnection, fromJson, nowIso, postgresSql, sqliteSql, type Sql } from "./sql.ts";
import type {
  Quiz,
  QuizAttempt,
  QuizAttemptInput,
  QuizInput,
  QuizQuestion,
  QuizSource,
  Viewer,
} from "./types.ts";

export type Db = Sql;

export const DEFAULT_DB_PATH = path.resolve(import.meta.dirname, "../data/atlas.db");
// Nombre anterior del archivo (antes de renombrar el proyecto a atlas-anatomia-libre, D-015).
const LEGACY_DB_PATH = path.resolve(import.meta.dirname, "../data/biodigital.db");

// Si solo existe la BD con el nombre antiguo, se renombra (con sus archivos -wal y -shm).
function renameLegacyDb() {
  if (fs.existsSync(DEFAULT_DB_PATH) || !fs.existsSync(LEGACY_DB_PATH)) return;
  for (const suffix of ["", "-wal", "-shm"]) {
    if (fs.existsSync(LEGACY_DB_PATH + suffix)) fs.renameSync(LEGACY_DB_PATH + suffix, DEFAULT_DB_PATH + suffix);
  }
}

// ---------- Apertura y migraciones ----------

export function openSqlite(dbPath = process.env.ATLAS_DB || DEFAULT_DB_PATH): DatabaseSync {
  if (dbPath === DEFAULT_DB_PATH) renameLegacyDb();
  if (dbPath !== ":memory:") fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  migrateSqlite(db);
  db.exec("PRAGMA foreign_keys = ON;");
  return db;
}

// Se ejecuta con las claves foráneas desactivadas (necesario para reconstruir tablas sin
// borrados en cascada) y se comprueba la integridad al final.
function migrateSqlite(db: DatabaseSync) {
  const { user_version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (user_version >= SQLITE_MIGRATIONS.length) return;
  db.exec("PRAGMA foreign_keys = OFF;");
  for (let v = user_version; v < SQLITE_MIGRATIONS.length; v++) {
    db.exec("BEGIN");
    try {
      db.exec(SQLITE_MIGRATIONS[v]);
      db.exec(`PRAGMA user_version = ${v + 1}`);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
  const broken = db.prepare("PRAGMA foreign_key_check").all();
  if (broken.length) throw new Error(`Migración con claves foráneas rotas: ${JSON.stringify(broken)}`);
}

// Aplica las migraciones pendientes de PostgreSQL. El bloqueo consultivo evita que dos
// procesos migren a la vez (p. ej. dos instancias arrancando juntas).
export async function migratePostgres(sql: Sql) {
  await sql.tx(async (t) => {
    await t.execute("SELECT pg_advisory_xact_lock(724001)");
    await t.execute(
      "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())"
    );
    const row = await t.one<{ v: number | null }>("SELECT MAX(version) AS v FROM schema_migrations");
    for (let v = row?.v ?? 0; v < POSTGRES_MIGRATIONS.length; v++) {
      await t.exec(POSTGRES_MIGRATIONS[v]);
      await t.execute("INSERT INTO schema_migrations (version) VALUES ($1)", [v + 1]);
    }
  });
}

export interface DbConfig {
  client: "sqlite" | "postgres";
  description: string;
}

// Motor según el entorno: DB_CLIENT=sqlite|postgres. Si no se indica, PostgreSQL cuando hay
// DATABASE_URL y SQLite (server/data/atlas.db) en otro caso.
export function resolveDbConfig(env = process.env): DbConfig & { url?: string; file?: string } {
  const explicit = env.DB_CLIENT?.trim().toLowerCase();
  if (explicit && explicit !== "sqlite" && explicit !== "postgres") {
    throw new Error(`DB_CLIENT debe ser "sqlite" o "postgres" (recibido "${env.DB_CLIENT}").`);
  }
  const client = (explicit as DbConfig["client"]) || (env.DATABASE_URL ? "postgres" : "sqlite");
  if (client === "postgres") {
    if (!env.DATABASE_URL) throw new Error("DB_CLIENT=postgres necesita DATABASE_URL (ver server/.env.example).");
    return { client, url: env.DATABASE_URL, description: `PostgreSQL: ${describeConnection(env.DATABASE_URL)}` };
  }
  const file = env.ATLAS_DB || DEFAULT_DB_PATH;
  return { client, file, description: `SQLite: ${file}` };
}

export async function openDb(env = process.env): Promise<Db & { description: string }> {
  const config = resolveDbConfig(env);
  if (config.client === "postgres") {
    const sql = postgresSql(config.url!);
    await migratePostgres(sql);
    return Object.assign(sql, { description: config.description });
  }
  return Object.assign(sqliteSql(openSqlite(config.file)), { description: config.description });
}

// ---------- Cuestionarios ----------

interface QuestionRow {
  id: string;
  type: QuizQuestion["type"];
  prompt: string;
  hint: string;
  body_sex: QuizQuestion["bodySex"];
  enabled_systems: unknown;
  target_structure_id: string;
  target_name_es: string;
  options: unknown;
  explanation: string;
}

function rowToQuestion(r: QuestionRow): QuizQuestion {
  const options = r.options === null ? null : fromJson<string[]>(r.options);
  return {
    id: r.id,
    type: r.type,
    prompt: r.prompt,
    hint: r.hint,
    bodySex: r.body_sex,
    enabledSystems: fromJson(r.enabled_systems),
    targetStructureId: r.target_structure_id,
    targetNameEs: r.target_name_es,
    ...(options ? { options } : {}),
    explanation: r.explanation,
  };
}

// Visible para quien mira: públicos, los suyos y, para el admin, todos.
// $1 = id del usuario (-1 sin sesión), $2 = ¿es admin?
const VISIBLE = `(q.is_public = TRUE OR q.user_id = $1 OR $2 = TRUE)`;

const QUIZ_COLUMNS = `q.id, q.title, q.subtitle, q.source, q.user_id AS "userId", u.username AS "ownerName",
  q.is_public AS "isPublic", q.created_at AS "createdAt", q.updated_at AS "updatedAt"`;

type QuizRow = Omit<Quiz, "questions" | "isPublic"> & { isPublic: unknown };

const viewerParams = (viewer: Viewer | null) => [viewer?.id ?? -1, viewer?.role === "admin"];

async function withQuestions(db: Db, row: QuizRow): Promise<Quiz> {
  const rows = await db.query<QuestionRow>("SELECT * FROM questions WHERE quiz_id = $1 ORDER BY position", [row.id]);
  return { ...row, isPublic: asBool(row.isPublic), questions: rows.map(rowToQuestion) };
}

// Sin viewer devuelve el cuestionario sin filtrar (uso interno); con viewer, solo si lo puede ver.
export async function getQuiz(db: Db, id: string, viewer?: Viewer | null): Promise<Quiz | null> {
  const row =
    viewer === undefined
      ? await db.one<QuizRow>(
          `SELECT ${QUIZ_COLUMNS} FROM quizzes q LEFT JOIN users u ON u.id = q.user_id WHERE q.id = $1`,
          [id]
        )
      : await db.one<QuizRow>(
          `SELECT ${QUIZ_COLUMNS} FROM quizzes q LEFT JOIN users u ON u.id = q.user_id WHERE ${VISIBLE} AND q.id = $3`,
          [...viewerParams(viewer), id]
        );
  return row ? withQuestions(db, row) : null;
}

export async function listQuizzesFull(db: Db, viewer: Viewer | null): Promise<Quiz[]> {
  const rows = await db.query<QuizRow>(
    `SELECT ${QUIZ_COLUMNS} FROM quizzes q LEFT JOIN users u ON u.id = q.user_id
     WHERE ${VISIBLE}
     ORDER BY CASE q.source WHEN 'seed' THEN 0 ELSE 1 END, q.created_at`,
    viewerParams(viewer)
  );
  return Promise.all(rows.map((r) => withQuestions(db, r)));
}

async function insertQuestions(db: Db, quizId: string, questions: QuizQuestion[]) {
  for (const [i, q] of questions.entries()) {
    await db.execute(
      `INSERT INTO questions
         (id, quiz_id, position, type, prompt, hint, body_sex, enabled_systems,
          target_structure_id, target_name_es, options, explanation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
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
        q.explanation ?? "",
      ]
    );
  }
}

export async function createQuiz(
  db: Db,
  input: QuizInput,
  source: QuizSource,
  owner: { userId: number | null; isPublic: boolean }
): Promise<Quiz> {
  const id = input.id || `quiz-${crypto.randomUUID().slice(0, 8)}`;
  const now = nowIso();
  await db.tx(async (t) => {
    await t.execute(
      `INSERT INTO quizzes (id, title, subtitle, source, user_id, is_public, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
      [id, input.title, input.subtitle ?? "", source, owner.userId, owner.isPublic, now]
    );
    await insertQuestions(t, id, input.questions);
  });
  return (await getQuiz(db, id))!;
}

export async function updateQuiz(db: Db, id: string, input: QuizInput): Promise<Quiz | null> {
  const done = await db.tx(async (t) => {
    const changed = await t.execute("UPDATE quizzes SET title = $1, subtitle = $2, updated_at = $3 WHERE id = $4", [
      input.title,
      input.subtitle ?? "",
      nowIso(),
      id,
    ]);
    if (!changed) return false;
    await t.execute("DELETE FROM questions WHERE quiz_id = $1", [id]);
    await insertQuestions(t, id, input.questions);
    return true;
  });
  return done ? getQuiz(db, id) : null;
}

export async function setQuizVisibility(db: Db, id: string, isPublic: boolean): Promise<Quiz | null> {
  await db.execute("UPDATE quizzes SET is_public = $1, updated_at = $2 WHERE id = $3", [isPublic, nowIso(), id]);
  return getQuiz(db, id);
}

export async function deleteQuiz(db: Db, id: string): Promise<boolean> {
  return (await db.execute("DELETE FROM quizzes WHERE id = $1", [id])) > 0;
}

// ---------- Intentos ----------

interface AttemptRow {
  id: number;
  quiz_id: string;
  quiz_title?: string;
  score: number;
  total: number;
  answers: unknown;
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
    answers: fromJson(r.answers),
    finishedAt: r.finished_at,
    userId: r.user_id,
  };
}

export async function addAttempt(db: Db, quizId: string, input: QuizAttemptInput, userId: number): Promise<QuizAttempt> {
  const row = await db.one<AttemptRow>(
    `INSERT INTO quiz_attempts (quiz_id, score, total, answers, user_id, finished_at)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [quizId, input.score, input.total, JSON.stringify(input.answers), userId, nowIso()]
  );
  return rowToAttempt(row!);
}

// Intentos de un usuario: de un cuestionario concreto o de todos (historial del perfil).
export async function listUserAttempts(db: Db, userId: number, quizId?: string, limit = 50): Promise<QuizAttempt[]> {
  const rows = await db.query<AttemptRow>(
    `SELECT a.*, q.title AS quiz_title FROM quiz_attempts a JOIN quizzes q ON q.id = a.quiz_id
     WHERE a.user_id = $1 ${quizId ? "AND a.quiz_id = $3" : ""}
     ORDER BY a.finished_at DESC, a.id DESC LIMIT $2`,
    quizId ? [userId, limit, quizId] : [userId, limit]
  );
  return rows.map(rowToAttempt);
}

export async function countQuizzes(db: Db): Promise<number> {
  return (await db.one<{ n: number }>("SELECT CAST(COUNT(*) AS INTEGER) AS n FROM quizzes"))!.n;
}
