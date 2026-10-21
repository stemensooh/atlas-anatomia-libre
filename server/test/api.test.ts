import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { buildApp } from "../src/app.ts";
import { loadCatalog } from "../src/catalog.ts";
import { openDb } from "../src/db.ts";
import { seedQuizzes } from "../src/seed.ts";

const db = openDb(":memory:");
const catalog = loadCatalog();
const app = buildApp(db, catalog);

before(() => seedQuizzes(db));
after(async () => {
  await app.close();
  db.close();
});

test("lista los cuestionarios iniciales con sus preguntas", async () => {
  const res = await app.inject({ url: "/api/quizzes?full=1" });
  assert.equal(res.statusCode, 200);
  const quizzes = res.json();
  assert.deepEqual(
    quizzes.map((q: any) => q.id),
    ["quiz-locomotor", "quiz-organos-vitales"]
  );
  assert.equal(quizzes[0].questions.length, 5);
  assert.equal(quizzes[0].source, "seed");
});

test("los cuestionarios iniciales pasan la validación del catálogo", async () => {
  const res = await app.inject({ url: "/api/quizzes?full=1" });
  for (const quiz of res.json()) {
    const put = await app.inject({ method: "PUT", url: `/api/quizzes/${quiz.id}`, payload: {
      title: quiz.title, subtitle: quiz.subtitle, questions: quiz.questions,
    } });
    assert.equal(put.statusCode, 200, put.body);
  }
});

test("genera un cuestionario mixto válido y lo guarda", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/quizzes/generate",
    payload: { bodySex: "female", systems: ["skeletal", "digestive"], count: 6 },
  });
  assert.equal(res.statusCode, 201, res.body);
  const quiz = res.json();
  assert.equal(quiz.source, "generated");
  assert.equal(quiz.questions.length, 6);
  for (const q of quiz.questions) {
    assert.ok(catalog.byId.female.has(q.targetStructureId));
    if (q.type === "multipleChoice") {
      assert.equal(q.options.length, 4);
      assert.ok(q.options.includes(q.targetNameEs));
      assert.equal(new Set(q.options).size, 4);
    }
  }
  const get = await app.inject({ url: `/api/quizzes/${quiz.id}` });
  assert.deepEqual(get.json().questions, quiz.questions);
});

test("rechaza generar más preguntas que estructuras disponibles", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/quizzes/generate",
    payload: { bodySex: "male", systems: ["lymphatic"], count: 10 },
  });
  assert.equal(res.statusCode, 400);
});

test("crea, edita y borra un cuestionario manual", async () => {
  const question = {
    id: "q1",
    type: "multipleChoice",
    prompt: "¿Qué hueso está resaltado?",
    hint: "",
    bodySex: "male",
    enabledSystems: ["skeletal"],
    targetStructureId: "FMA24474",
    targetNameEs: "Hueso Fémur derecho",
    options: ["Hueso Fémur derecho", "Hueso sacro"],
    explanation: "",
  };
  const created = await app.inject({
    method: "POST",
    url: "/api/quizzes",
    payload: { title: "Mi quiz", questions: [question] },
  });
  assert.equal(created.statusCode, 201, created.body);
  const { id } = created.json();

  const bad = await app.inject({
    method: "PUT",
    url: `/api/quizzes/${id}`,
    payload: { title: "Mi quiz", questions: [{ ...question, targetStructureId: "FMA0" }] },
  });
  assert.equal(bad.statusCode, 400);

  const updated = await app.inject({
    method: "PUT",
    url: `/api/quizzes/${id}`,
    payload: { title: "Mi quiz editado", questions: [question, { ...question, id: "q2", type: "find3d", options: undefined }] },
  });
  assert.equal(updated.statusCode, 200, updated.body);
  assert.equal(updated.json().questions.length, 2);
  assert.equal(updated.json().questions[1].options, undefined);

  const del = await app.inject({ method: "DELETE", url: `/api/quizzes/${id}` });
  assert.equal(del.statusCode, 204);
  assert.equal((await app.inject({ url: `/api/quizzes/${id}` })).statusCode, 404);
});

test("guarda intentos y rechaza puntuaciones incoherentes", async () => {
  const url = "/api/quizzes/quiz-locomotor/attempts";
  const answers = [
    { questionId: "q-loc-1", correct: true, answer: "Hueso Fémur derecho", revealed: false },
    { questionId: "q-loc-2", correct: false, answer: "Hueso sacro", revealed: false },
  ];
  const ok = await app.inject({ method: "POST", url, payload: { score: 1, total: 5, answers } });
  assert.equal(ok.statusCode, 201, ok.body);

  const inflated = await app.inject({ method: "POST", url, payload: { score: 2, total: 5, answers } });
  assert.equal(inflated.statusCode, 400);

  const list = await app.inject({ url });
  assert.equal(list.json().length, 1);
  assert.equal(list.json()[0].score, 1);

  const summary = (await app.inject({ url: "/api/quizzes" })).json();
  const loc = summary.find((q: any) => q.id === "quiz-locomotor");
  assert.equal(loc.attemptCount, 1);
  assert.equal(loc.bestRatio, 0.2);
});
