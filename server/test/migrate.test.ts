import assert from "node:assert/strict";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { createQuiz, openSqlite, resolveDbConfig } from "../src/db.ts";
import { createView, saveNote } from "../src/library.ts";
import { seedQuizzes } from "../src/seed.ts";
import { pgliteSql, sqliteSql, type PgliteLike } from "../src/sql.ts";
import { copySqliteToPostgres } from "../src/sqlite-to-postgres.ts";
import { createSession, createUser, findUserByName, verifyPassword } from "../src/users.ts";
import type { QuizQuestion } from "../src/types.ts";
import { findQuestion, TEST_ENGINE } from "./helpers.ts";

test("elige el motor según el entorno", () => {
  assert.equal(resolveDbConfig({}).client, "sqlite");
  const pg = resolveDbConfig({ DATABASE_URL: "postgres://atlas_app:secreta@db.example:5433/atlas" });
  assert.equal(pg.client, "postgres");
  assert.equal(pg.description, "PostgreSQL: atlas en db.example:5433 como atlas_app");
  assert.ok(!pg.description.includes("secreta"), "la descripción nunca muestra la contraseña");
  assert.equal(resolveDbConfig({ DB_CLIENT: "sqlite", DATABASE_URL: "postgres://x@y/z" }).client, "sqlite");
  assert.throws(() => resolveDbConfig({ DB_CLIENT: "postgres" }), /DATABASE_URL/);
  assert.throws(() => resolveDbConfig({ DB_CLIENT: "mysql" }), /DB_CLIENT/);
});

// Se ejecuta una sola vez (en la pasada de PostgreSQL): usa los dos motores a la vez.
test(
  "copia todos los datos de SQLite a PostgreSQL y conserva contraseñas, ids y JSON",
  { skip: TEST_ENGINE !== "postgres" },
  async () => {
    const rawSqlite = openSqlite(":memory:");
    const source = sqliteSql(rawSqlite);
    await seedQuizzes(source);
    const ana = await createUser(source, "Ana", "contraseña-de-ana", "docente");
    await createSession(source, ana.id);
    const quiz = await createQuiz(source, { title: "Privado", questions: [findQuestion as QuizQuestion] }, "manual", {
      userId: ana.id,
      isPublic: false,
    });
    await source.execute(
      "INSERT INTO quiz_attempts (quiz_id, user_id, score, total, answers) VALUES ($1, $2, 1, 1, $3)",
      [quiz.id, ana.id, JSON.stringify([{ questionId: "q1", correct: true, answer: "x", revealed: false }])]
    );
    await createView(source, ana.id, "Tórax", { version: 1, camera: { position: [0, 1, 2] } });
    await saveNote(source, ana.id, "FMA24474", "Hueso largo");

    // El destino ya tiene los cuestionarios iniciales (como si el servidor hubiera arrancado antes).
    const target = pgliteSql((await PGlite.create()) as unknown as PgliteLike);
    const { migratePostgres } = await import("../src/db.ts");
    await migratePostgres(target);
    await seedQuizzes(target);

    const log: string[] = [];
    await copySqliteToPostgres(rawSqlite, target, (m) => log.push(m));
    assert.ok(log.some((l) => l.includes("users: 1")));

    const user = await findUserByName(target, "ana");
    assert.equal(user?.id, ana.id);
    assert.equal(user?.role, "docente");
    assert.equal(await verifyPassword("contraseña-de-ana", user!.passwordHash), true);

    const copied = await target.one<{ is_public: boolean; user_id: number }>(
      "SELECT is_public, user_id FROM quizzes WHERE id = $1",
      [quiz.id]
    );
    assert.deepEqual({ ...copied }, { is_public: false, user_id: ana.id });
    const view = await target.one<{ state: any }>("SELECT state FROM saved_views");
    assert.deepEqual(view!.state.camera.position, [0, 1, 2]);
    // Las sesiones no se copian.
    assert.equal((await target.one<{ n: number }>("SELECT CAST(COUNT(*) AS INTEGER) AS n FROM sessions"))!.n, 0);

    // Las secuencias avanzan: el siguiente usuario no choca con los ids copiados.
    const next = await createUser(target, "beto", "contraseña-de-beto");
    assert.ok(next.id > ana.id);

    // Segunda ejecución: el destino ya tiene usuarios y se rechaza.
    await assert.rejects(copySqliteToPostgres(rawSqlite, target, () => {}), /ya tiene usuarios/);
    rawSqlite.close();
    await target.close();
  }
);
