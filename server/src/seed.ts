import fs from "node:fs";
import path from "node:path";
import * as store from "./db.ts";
import type { QuizInput } from "./types.ts";

// Los cuestionarios incluidos en la web son también los datos iniciales de la BD.
const SEED_PATH = path.resolve(import.meta.dirname, "../../web/src/data/defaultQuizzes.json");

// Inserta o reemplaza los cuestionarios iniciales; no toca los creados por el usuario
// (los intentos se conservan: solo se reemplazan título y preguntas).
export async function seedQuizzes(db: store.Db, { replace = false } = {}): Promise<number> {
  const quizzes = JSON.parse(fs.readFileSync(SEED_PATH, "utf8")) as QuizInput[];
  let n = 0;
  for (const quiz of quizzes) {
    const exists = await store.getQuiz(db, quiz.id!);
    if (exists && !replace) continue;
    if (exists) await store.updateQuiz(db, quiz.id!, quiz);
    else await store.createQuiz(db, quiz, "seed", { userId: null, isPublic: true });
    n++;
  }
  return n;
}

if (import.meta.main) {
  const db = await store.openDb();
  const n = await seedQuizzes(db, { replace: true });
  console.log(`Cuestionarios iniciales cargados: ${n}`);
  await db.close();
}
