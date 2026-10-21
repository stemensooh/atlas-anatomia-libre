import fs from "node:fs";
import path from "node:path";
import * as store from "./db.ts";
import type { QuizInput } from "./types.ts";

// Los cuestionarios incluidos en la web son también los datos iniciales de la BD.
const SEED_PATH = path.resolve(import.meta.dirname, "../../web/src/data/defaultQuizzes.json");

// Inserta o reemplaza los cuestionarios iniciales; no toca los creados por el usuario
// (los intentos de un cuestionario reemplazado se pierden por el ON DELETE CASCADE).
export function seedQuizzes(db: store.Db, { replace = false } = {}): number {
  const quizzes = JSON.parse(fs.readFileSync(SEED_PATH, "utf8")) as QuizInput[];
  let n = 0;
  for (const quiz of quizzes) {
    const exists = store.getQuiz(db, quiz.id!);
    if (exists && !replace) continue;
    if (exists) store.updateQuiz(db, quiz.id!, quiz);
    else store.createQuiz(db, quiz, "seed");
    n++;
  }
  return n;
}

if (import.meta.main) {
  const db = store.openDb();
  const n = seedQuizzes(db, { replace: true });
  console.log(`Cuestionarios iniciales cargados: ${n}`);
  db.close();
}
