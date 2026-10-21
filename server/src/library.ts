import type { Db } from "./db.ts";
import type { QuizQuestion } from "./types.ts";

// Datos personales de estudio: vistas guardadas y notas por estructura (privados del usuario),
// y el informe de resultados de un cuestionario para su docente.

const NOW = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

export const MAX_VIEWS_PER_USER = 100;
export const MAX_NOTES_PER_USER = 2000;

export interface SavedView {
  id: number;
  name: string;
  state: unknown;
  createdAt: string;
  updatedAt: string;
}

interface ViewRow {
  id: number;
  name: string;
  state: string;
  created_at: string;
  updated_at: string;
}

const rowToView = (r: ViewRow): SavedView => ({
  id: r.id,
  name: r.name,
  state: JSON.parse(r.state),
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export function listViews(db: Db, userId: number): SavedView[] {
  const rows = db
    .prepare("SELECT * FROM saved_views WHERE user_id = ? ORDER BY updated_at DESC, id DESC")
    .all(userId) as unknown as ViewRow[];
  return rows.map(rowToView);
}

export function countViews(db: Db, userId: number): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM saved_views WHERE user_id = ?").get(userId) as { n: number }).n;
}

export function createView(db: Db, userId: number, name: string, state: unknown): SavedView {
  const { lastInsertRowid } = db
    .prepare("INSERT INTO saved_views (user_id, name, state) VALUES (?, ?, ?)")
    .run(userId, name, JSON.stringify(state));
  return getView(db, userId, Number(lastInsertRowid))!;
}

// Solo devuelve la vista si es del usuario: así las rutas no pueden tocar vistas ajenas.
export function getView(db: Db, userId: number, id: number): SavedView | null {
  const r = db.prepare("SELECT * FROM saved_views WHERE id = ? AND user_id = ?").get(id, userId) as
    | ViewRow
    | undefined;
  return r ? rowToView(r) : null;
}

export function updateView(
  db: Db,
  userId: number,
  id: number,
  patch: { name?: string; state?: unknown }
): SavedView | null {
  if (!getView(db, userId, id)) return null;
  if (patch.name !== undefined) {
    db.prepare(`UPDATE saved_views SET name = ?, updated_at = ${NOW} WHERE id = ?`).run(patch.name, id);
  }
  if (patch.state !== undefined) {
    db.prepare(`UPDATE saved_views SET state = ?, updated_at = ${NOW} WHERE id = ?`).run(
      JSON.stringify(patch.state),
      id
    );
  }
  return getView(db, userId, id);
}

export function deleteView(db: Db, userId: number, id: number): boolean {
  return db.prepare("DELETE FROM saved_views WHERE id = ? AND user_id = ?").run(id, userId).changes > 0;
}

// ---- Notas ----

export interface StructureNote {
  structureId: string;
  note: string;
  updatedAt: string;
}

export function listNotes(db: Db, userId: number): StructureNote[] {
  return db
    .prepare(
      `SELECT structure_id AS structureId, note, updated_at AS updatedAt
       FROM structure_notes WHERE user_id = ? ORDER BY updated_at DESC`
    )
    .all(userId) as unknown as StructureNote[];
}

export function countNotes(db: Db, userId: number): number {
  return (db.prepare("SELECT COUNT(*) AS n FROM structure_notes WHERE user_id = ?").get(userId) as { n: number }).n;
}

export function hasNote(db: Db, userId: number, structureId: string): boolean {
  return !!db.prepare("SELECT 1 FROM structure_notes WHERE user_id = ? AND structure_id = ?").get(userId, structureId);
}

// Guarda (o reemplaza) la nota; una nota vacía la borra. Devuelve null si quedó borrada.
export function saveNote(db: Db, userId: number, structureId: string, note: string): StructureNote | null {
  if (!note.trim()) {
    deleteNote(db, userId, structureId);
    return null;
  }
  db.prepare(
    `INSERT INTO structure_notes (user_id, structure_id, note) VALUES (?, ?, ?)
     ON CONFLICT (user_id, structure_id) DO UPDATE SET note = excluded.note, updated_at = ${NOW}`
  ).run(userId, structureId, note);
  return db
    .prepare(
      `SELECT structure_id AS structureId, note, updated_at AS updatedAt
       FROM structure_notes WHERE user_id = ? AND structure_id = ?`
    )
    .get(userId, structureId) as unknown as StructureNote;
}

export function deleteNote(db: Db, userId: number, structureId: string): boolean {
  return (
    db.prepare("DELETE FROM structure_notes WHERE user_id = ? AND structure_id = ?").run(userId, structureId)
      .changes > 0
  );
}

// ---- Resultados de un cuestionario (para su docente) ----

export interface StudentResult {
  userId: number;
  username: string;
  attempts: number;
  bestScore: number;
  lastScore: number;
  avgRatio: number;
  total: number;
  lastAt: string;
}

export interface QuestionResult {
  questionId: string;
  prompt: string;
  targetNameEs: string;
  answered: number;
  correct: number;
  revealed: number;
  // Respuestas equivocadas más frecuentes (opción elegida o estructura clicada).
  topWrong: Array<{ answer: string; count: number }>;
}

export interface QuizResults {
  quizId: string;
  attemptCount: number;
  studentCount: number;
  avgRatio: number | null;
  students: StudentResult[];
  questions: QuestionResult[];
  recent: Array<{ id: number; username: string; score: number; total: number; finishedAt: string }>;
}

interface ResultRow {
  id: number;
  user_id: number;
  username: string;
  score: number;
  total: number;
  answers: string;
  finished_at: string;
}

// Solo cuenta intentos de usuarios registrados (los anónimos no se guardan).
export function quizResults(db: Db, quizId: string, questions: QuizQuestion[]): QuizResults {
  const rows = db
    .prepare(
      `SELECT a.id, a.user_id, u.username, a.score, a.total, a.answers, a.finished_at
       FROM quiz_attempts a JOIN users u ON u.id = a.user_id
       WHERE a.quiz_id = ? ORDER BY a.finished_at DESC, a.id DESC`
    )
    .all(quizId) as unknown as ResultRow[];

  const byStudent = new Map<number, StudentResult & { ratioSum: number }>();
  const byQuestion = new Map<string, QuestionResult & { wrong: Map<string, number> }>(
    questions.map((q) => [
      q.id,
      {
        questionId: q.id,
        prompt: q.prompt,
        targetNameEs: q.targetNameEs,
        answered: 0,
        correct: 0,
        revealed: 0,
        topWrong: [],
        wrong: new Map(),
      },
    ])
  );

  for (const r of rows) {
    const ratio = r.total ? r.score / r.total : 0;
    const s = byStudent.get(r.user_id);
    if (!s) {
      // Las filas vienen de la más reciente a la más antigua: la primera es el último intento.
      byStudent.set(r.user_id, {
        userId: r.user_id,
        username: r.username,
        attempts: 1,
        bestScore: r.score,
        lastScore: r.score,
        avgRatio: 0,
        total: r.total,
        lastAt: r.finished_at,
        ratioSum: ratio,
      });
    } else {
      s.attempts++;
      s.bestScore = Math.max(s.bestScore, r.score);
      s.ratioSum += ratio;
    }
    for (const a of JSON.parse(r.answers) as Array<{ questionId: string; correct: boolean; answer: string | null; revealed: boolean }>) {
      const q = byQuestion.get(a.questionId);
      if (!q) continue; // pregunta borrada al editar el cuestionario
      q.answered++;
      if (a.correct) q.correct++;
      if (a.revealed) q.revealed++;
      if (!a.correct && a.answer) q.wrong.set(a.answer, (q.wrong.get(a.answer) ?? 0) + 1);
    }
  }

  const students = [...byStudent.values()]
    .map(({ ratioSum, ...s }) => ({ ...s, avgRatio: ratioSum / s.attempts }))
    .sort((a, b) => a.username.localeCompare(b.username, "es"));
  const ratioTotal = rows.reduce((sum, r) => sum + (r.total ? r.score / r.total : 0), 0);

  return {
    quizId,
    attemptCount: rows.length,
    studentCount: students.length,
    avgRatio: rows.length ? ratioTotal / rows.length : null,
    students,
    questions: [...byQuestion.values()].map(({ wrong, ...q }) => ({
      ...q,
      topWrong: [...wrong.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([answer, count]) => ({ answer, count })),
    })),
    recent: rows.slice(0, 20).map((r) => ({
      id: r.id,
      username: r.username,
      score: r.score,
      total: r.total,
      finishedAt: r.finished_at,
    })),
  };
}
