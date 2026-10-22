import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { findQuestion, setup } from "./helpers.ts";

const { db, app, loginAs, count } = await setup();
let ana = "";
let beto = "";
let profe = "";

before(async () => {
  ana = await loginAs("ana");
  beto = await loginAs("beto");
  profe = await loginAs("profe", "docente");
});
after(async () => {
  await app.close();
  await db.close();
});

const sampleState = {
  version: 1,
  bodySex: "male",
  camera: { position: [0, 1.2, 1.5], target: [0, 1, 0] },
  layers: { skeletal: { enabled: true, opacity: 1, depth: 1 } },
};

test("vistas: crear, listar, renombrar, actualizar y borrar solo las propias", async () => {
  assert.equal((await app.inject({ url: "/api/views" })).statusCode, 401);

  const created = await app.inject({
    method: "POST", url: "/api/views", headers: { cookie: ana },
    payload: { name: "  Tórax frontal  ", state: sampleState },
  });
  assert.equal(created.statusCode, 201, created.body);
  const view = created.json();
  assert.equal(view.name, "Tórax frontal");
  assert.deepEqual(view.state, sampleState);

  // Beto no ve ni toca la vista de Ana.
  assert.deepEqual((await app.inject({ url: "/api/views", headers: { cookie: beto } })).json(), []);
  const foreign = await app.inject({
    method: "PATCH", url: `/api/views/${view.id}`, headers: { cookie: beto }, payload: { name: "mía" },
  });
  assert.equal(foreign.statusCode, 404);
  assert.equal(
    (await app.inject({ method: "DELETE", url: `/api/views/${view.id}`, headers: { cookie: beto } })).statusCode,
    404
  );

  const renamed = await app.inject({
    method: "PATCH", url: `/api/views/${view.id}`, headers: { cookie: ana },
    payload: { name: "Tórax", state: { ...sampleState, bodySex: "female" } },
  });
  assert.equal(renamed.json().name, "Tórax");
  assert.equal(renamed.json().state.bodySex, "female");

  const huge = await app.inject({
    method: "POST", url: "/api/views", headers: { cookie: ana },
    payload: { name: "Enorme", state: { blob: "x".repeat(30_000) } },
  });
  assert.equal(huge.statusCode, 413);

  assert.equal(
    (await app.inject({ method: "DELETE", url: `/api/views/${view.id}`, headers: { cookie: ana } })).statusCode,
    204
  );
  assert.deepEqual((await app.inject({ url: "/api/views", headers: { cookie: ana } })).json(), []);
});

test("notas: una por estructura y usuario; vacía la borra; estructura inexistente → 404", async () => {
  const put = (cookie: string, id: string, note: string) =>
    app.inject({ method: "PUT", url: `/api/notes/${id}`, headers: { cookie }, payload: { note } });

  assert.equal((await put("", "FMA24474", "x")).statusCode, 401);
  const saved = await put(ana, "FMA24474", "Hueso más largo del cuerpo.");
  assert.equal(saved.statusCode, 200, saved.body);
  assert.equal(saved.json().note, "Hueso más largo del cuerpo.");

  // Reemplaza en lugar de duplicar; también admite estructuras femeninas.
  await put(ana, "FMA24474", "Fémur: cabeza, cuello y trocánteres.");
  await put(ana, "VH_F_sternum", "Esternón femenino.");
  const notes = (await app.inject({ url: "/api/notes", headers: { cookie: ana } })).json();
  assert.equal(notes.length, 2);
  assert.equal(notes.find((n: any) => n.structureId === "FMA24474").note, "Fémur: cabeza, cuello y trocánteres.");

  assert.deepEqual((await app.inject({ url: "/api/notes", headers: { cookie: beto } })).json(), []);
  assert.equal((await put(ana, "FMA0000000", "nada")).statusCode, 404);
  assert.equal((await put(ana, "FMA%20X", "nada")).statusCode, 400); // espacio: formato no válido

  assert.equal((await put(ana, "FMA24474", "   ")).statusCode, 204);
  assert.equal((await app.inject({ url: "/api/notes", headers: { cookie: ana } })).json().length, 1);
});

test("resultados: el docente ve los de su cuestionario; los demás no", async () => {
  const quiz = (await app.inject({
    method: "POST", url: "/api/quizzes", headers: { cookie: profe },
    payload: {
      title: "Examen fémur",
      questions: [findQuestion, { ...findQuestion, id: "q2", type: "find3d", options: undefined }],
    },
  })).json();
  assert.equal(quiz.permissions.results, true);
  await app.inject({
    method: "PATCH", url: `/api/quizzes/${quiz.id}/visibility`, headers: { cookie: profe }, payload: { isPublic: true },
  });

  const attempt = (cookie: string, q1: boolean, q2: boolean, wrong = "Hueso sacro") =>
    app.inject({
      method: "POST", url: `/api/quizzes/${quiz.id}/attempts`, headers: { cookie },
      payload: {
        score: Number(q1) + Number(q2),
        total: 2,
        answers: [
          { questionId: "q1", correct: q1, answer: q1 ? "Hueso Fémur derecho" : wrong, revealed: false },
          { questionId: "q2", correct: q2, answer: null, revealed: !q2 },
        ],
      },
    });
  await attempt(ana, false, false);
  await attempt(ana, true, true);
  await attempt(beto, false, true);

  const res = await app.inject({ url: `/api/quizzes/${quiz.id}/results`, headers: { cookie: profe } });
  assert.equal(res.statusCode, 200, res.body);
  const r = res.json();
  assert.equal(r.attemptCount, 3);
  assert.equal(r.studentCount, 2);
  const anaRow = r.students.find((s: any) => s.username === "ana");
  assert.deepEqual(
    { attempts: anaRow.attempts, best: anaRow.bestScore, last: anaRow.lastScore, avg: anaRow.avgRatio },
    { attempts: 2, best: 2, last: 2, avg: 0.5 }
  );
  const q1 = r.questions.find((q: any) => q.questionId === "q1");
  assert.deepEqual({ answered: q1.answered, correct: q1.correct }, { answered: 3, correct: 1 });
  assert.deepEqual(q1.topWrong, [{ answer: "Hueso sacro", count: 2 }]);
  assert.equal(r.questions.find((q: any) => q.questionId === "q2").revealed, 1);

  // Un alumno, otro docente o alguien sin sesión no pueden verlos.
  assert.equal((await app.inject({ url: `/api/quizzes/${quiz.id}/results`, headers: { cookie: ana } })).statusCode, 403);
  const otro = await loginAs("otro-profe", "docente");
  assert.equal((await app.inject({ url: `/api/quizzes/${quiz.id}/results`, headers: { cookie: otro } })).statusCode, 403);
  assert.equal((await app.inject({ url: `/api/quizzes/${quiz.id}/results` })).statusCode, 401);
  // El admin sí, también en los cuestionarios incluidos.
  const admin = await loginAs("jefe", "admin");
  assert.equal((await app.inject({ url: `/api/quizzes/${quiz.id}/results`, headers: { cookie: admin } })).statusCode, 200);
  assert.equal((await app.inject({ url: "/api/quizzes/quiz-locomotor/results", headers: { cookie: admin } })).statusCode, 200);
});

test("borrar la cuenta borra también sus vistas y notas", async () => {
  const cookie = await loginAs("temporal");
  await app.inject({ method: "POST", url: "/api/views", headers: { cookie }, payload: { name: "v", state: sampleState } });
  await app.inject({ method: "PUT", url: "/api/notes/FMA24474", headers: { cookie }, payload: { note: "n" } });
  await app.inject({ method: "DELETE", url: "/api/auth/me", headers: { cookie }, payload: { password: "contraseña-segura" } });
  assert.equal(await count("saved_views", "name = 'v'"), 0);
  assert.equal(await count("structure_notes", "note = 'n'"), 0);
});
