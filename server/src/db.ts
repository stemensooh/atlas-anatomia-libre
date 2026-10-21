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
  QuizSummary,
} from "./types.ts";

const DEFAULT_DB_PATH = path.resolve(import.meta.dirname, "../data/biodigital.db");

// Versión del esquema: si se añaden migraciones, se incrementa y se añade un bloque en migrate().
const SCHEMA_VERSION = 1;

export type Db = DatabaseSync;

export function openDb(dbPath = process.env.BIODIGITAL_DB || DEFAULT_DB_PATH): Db {
  if (dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
  migrate(db);
  return db;
}

function migrate(db: Db) {
  const { user_version } = db.prepare("PRAGMA user_version").get() as { user_version: number };
  if (user_version >= SCHEMA_VERSION) return;

  db.exec(`
    CREATE TABLE IF NOT EXISTS quizzes (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      subtitle    TEXT NOT NULL DEFAULT '',
      source      TEXT NOT NULL CHECK (source IN ('seed', 'manual', 'generated')),
      created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
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
      finished_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
    CREATE INDEX IF NOT EXISTS idx_attempts_quiz ON quiz_attempts(quiz_id, finished_at);

    PRAGMA user_version = ${SCHEMA_VERSION};
  `);
}

// Ejecuta fn dentro de una transacción; si lanza, se revierte.
function tx<T>(db: Db, fn: () => T): T {
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

export function listQuizzes(db: Db): QuizSummary[] {
  return db
    .prepare(
      `SELECT q.id, q.title, q.subtitle, q.source, q.created_at AS createdAt, q.updated_at AS updatedAt,
              (SELECT COUNT(*) FROM questions WHERE quiz_id = q.id) AS questionCount,
              (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_id = q.id) AS attemptCount,
              (SELECT MAX(CAST(score AS REAL) / total) FROM quiz_attempts WHERE quiz_id = q.id AND total > 0) AS bestRatio
       FROM quizzes q
       ORDER BY CASE q.source WHEN 'seed' THEN 0 ELSE 1 END, q.created_at`
    )
    .all() as unknown as QuizSummary[];
}

export function getQuiz(db: Db, id: string): Quiz | null {
  const quiz = db
    .prepare(
      `SELECT id, title, subtitle, source, created_at AS createdAt, updated_at AS updatedAt
       FROM quizzes WHERE id = ?`
    )
    .get(id) as Omit<Quiz, "questions"> | undefined;
  if (!quiz) return null;
  const rows = db
    .prepare("SELECT * FROM questions WHERE quiz_id = ? ORDER BY position")
    .all(id) as unknown as QuestionRow[];
  return { ...quiz, questions: rows.map(rowToQuestion) };
}

export function listQuizzesFull(db: Db): Quiz[] {
  return listQuizzes(db)
    .map((s) => getQuiz(db, s.id))
    .filter((q): q is Quiz => q !== null);
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

export function createQuiz(db: Db, input: QuizInput, source: QuizSource): Quiz {
  const id = input.id || `quiz-${crypto.randomUUID().slice(0, 8)}`;
  tx(db, () => {
    db.prepare("INSERT INTO quizzes (id, title, subtitle, source) VALUES (?, ?, ?, ?)").run(
      id,
      input.title,
      input.subtitle ?? "",
      source
    );
    insertQuestions(db, id, input.questions);
  });
  return getQuiz(db, id)!;
}

export function updateQuiz(db: Db, id: string, input: QuizInput): Quiz | null {
  const exists = db.prepare("SELECT 1 FROM quizzes WHERE id = ?").get(id);
  if (!exists) return null;
  tx(db, () => {
    db.prepare(
      `UPDATE quizzes SET title = ?, subtitle = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
       WHERE id = ?`
    ).run(input.title, input.subtitle ?? "", id);
    db.prepare("DELETE FROM questions WHERE quiz_id = ?").run(id);
    insertQuestions(db, id, input.questions);
  });
  return getQuiz(db, id);
}

export function deleteQuiz(db: Db, id: string): boolean {
  return db.prepare("DELETE FROM quizzes WHERE id = ?").run(id).changes > 0;
}

export function addAttempt(db: Db, quizId: string, input: QuizAttemptInput): QuizAttempt | null {
  const exists = db.prepare("SELECT 1 FROM quizzes WHERE id = ?").get(quizId);
  if (!exists) return null;
  const { lastInsertRowid } = db
    .prepare("INSERT INTO quiz_attempts (quiz_id, score, total, answers) VALUES (?, ?, ?, ?)")
    .run(quizId, input.score, input.total, JSON.stringify(input.answers));
  return getAttempt(db, Number(lastInsertRowid));
}

interface AttemptRow {
  id: number;
  quiz_id: string;
  score: number;
  total: number;
  answers: string;
  finished_at: string;
}

function rowToAttempt(r: AttemptRow): QuizAttempt {
  return {
    id: r.id,
    quizId: r.quiz_id,
    score: r.score,
    total: r.total,
    answers: JSON.parse(r.answers),
    finishedAt: r.finished_at,
  };
}

function getAttempt(db: Db, id: number): QuizAttempt | null {
  const r = db.prepare("SELECT * FROM quiz_attempts WHERE id = ?").get(id) as AttemptRow | undefined;
  return r ? rowToAttempt(r) : null;
}

export function listAttempts(db: Db, quizId: string, limit = 20): QuizAttempt[] {
  const rows = db
    .prepare("SELECT * FROM quiz_attempts WHERE quiz_id = ? ORDER BY finished_at DESC, id DESC LIMIT ?")
    .all(quizId, limit) as unknown as AttemptRow[];
  return rows.map(rowToAttempt);
}

export function countQuizzes(db: Db): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM quizzes").get() as { n: number }).n;
}
