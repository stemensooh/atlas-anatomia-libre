import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { openDb } from "../src/db.ts";
import { catalog, findQuestion, setup } from "./helpers.ts";

const { db, app, loginAs } = setup();
let docente = "";
let estudiante = "";

before(async () => {
  docente = await loginAs("profe", "docente");
  estudiante = await loginAs("alumna");
});
after(async () => {
  await app.close();
  db.close();
});

test("lista los cuestionarios iniciales públicos sin iniciar sesión", async () => {
  const res = await app.inject({ url: "/api/quizzes" });
  assert.equal(res.statusCode, 200);
  const quizzes = res.json();
  assert.deepEqual(quizzes.map((q: any) => q.id), ["quiz-locomotor", "quiz-organos-vitales"]);
  assert.equal(quizzes[0].questions.length, 5);
  assert.equal(quizzes[0].source, "seed");
  assert.equal(quizzes[0].isPublic, true);
  assert.deepEqual(quizzes[0].permissions, { edit: false, delete: false, publish: false, results: false });
});

test("los cuestionarios iniciales pasan la validación del catálogo", async () => {
  const admin = await loginAs("jefa", "admin");
  const quizzes = (await app.inject({ url: "/api/quizzes" })).json();
  for (const quiz of quizzes) {
    const put = await app.inject({
      method: "PUT",
      url: `/api/quizzes/${quiz.id}`,
      headers: { cookie: admin },
      payload: { title: quiz.title, subtitle: quiz.subtitle, questions: quiz.questions },
    });
    assert.equal(put.statusCode, 200, put.body);
  }
});

test("genera un cuestionario mixto válido, privado y del usuario", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/quizzes/generate",
    headers: { cookie: estudiante },
    payload: { bodySex: "female", systems: ["skeletal", "digestive"], count: 6 },
  });
  assert.equal(res.statusCode, 201, res.body);
  const quiz = res.json();
  assert.equal(quiz.source, "generated");
  assert.equal(quiz.isPublic, false);
  assert.equal(quiz.ownerName, "alumna");
  assert.deepEqual(quiz.permissions, { edit: false, delete: true, publish: false, results: false });
  assert.equal(quiz.questions.length, 6);
  for (const q of quiz.questions) {
    assert.ok(catalog.byId.female.has(q.targetStructureId));
    if (q.type === "multipleChoice") {
      assert.equal(q.options.length, 4);
      assert.ok(q.options.includes(q.targetNameEs));
      assert.equal(new Set(q.options).size, 4);
    }
  }
  // Privado: los demás no lo ven.
  assert.equal((await app.inject({ url: `/api/quizzes/${quiz.id}` })).statusCode, 404);
  assert.equal((await app.inject({ url: `/api/quizzes/${quiz.id}`, headers: { cookie: docente } })).statusCode, 404);
  assert.equal((await app.inject({ url: `/api/quizzes/${quiz.id}`, headers: { cookie: estudiante } })).statusCode, 200);
});

test("rechaza generar más preguntas que estructuras disponibles", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/quizzes/generate",
    headers: { cookie: estudiante },
    payload: { bodySex: "male", systems: ["lymphatic"], count: 10 },
  });
  assert.equal(res.statusCode, 400);
});

test("el docente crea, edita, publica y borra su cuestionario manual", async () => {
  const created = await app.inject({
    method: "POST",
    url: "/api/quizzes",
    headers: { cookie: docente },
    payload: { title: "Mi quiz", questions: [findQuestion] },
  });
  assert.equal(created.statusCode, 201, created.body);
  const { id, isPublic, permissions } = created.json();
  assert.equal(isPublic, false);
  assert.deepEqual(permissions, { edit: true, delete: true, publish: true, results: true });

  const bad = await app.inject({
    method: "PUT",
    url: `/api/quizzes/${id}`,
    headers: { cookie: docente },
    payload: { title: "Mi quiz", questions: [{ ...findQuestion, targetStructureId: "FMA0" }] },
  });
  assert.equal(bad.statusCode, 400);

  const updated = await app.inject({
    method: "PUT",
    url: `/api/quizzes/${id}`,
    headers: { cookie: docente },
    payload: {
      title: "Mi quiz editado",
      questions: [findQuestion, { ...findQuestion, id: "q2", type: "find3d", options: undefined }],
    },
  });
  assert.equal(updated.statusCode, 200, updated.body);
  assert.equal(updated.json().questions.length, 2);
  assert.equal(updated.json().questions[1].options, undefined);

  const pub = await app.inject({
    method: "PATCH",
    url: `/api/quizzes/${id}/visibility`,
    headers: { cookie: docente },
    payload: { isPublic: true },
  });
  assert.equal(pub.statusCode, 200);
  // Publicado: lo ve cualquiera, pero solo su dueño (o un admin) lo edita.
  const seen = await app.inject({ url: `/api/quizzes/${id}`, headers: { cookie: estudiante } });
  assert.equal(seen.statusCode, 200);
  assert.deepEqual(seen.json().permissions, { edit: false, delete: false, publish: false, results: false });
  const foreignEdit = await app.inject({
    method: "PUT",
    url: `/api/quizzes/${id}`,
    headers: { cookie: estudiante },
    payload: { title: "Hackeado", questions: [findQuestion] },
  });
  assert.equal(foreignEdit.statusCode, 403);

  const del = await app.inject({ method: "DELETE", url: `/api/quizzes/${id}`, headers: { cookie: docente } });
  assert.equal(del.statusCode, 204);
  assert.equal((await app.inject({ url: `/api/quizzes/${id}` })).statusCode, 404);
});

test("permisos por rol: sin sesión y estudiante no crean ni editan", async () => {
  const anon = await app.inject({ method: "POST", url: "/api/quizzes", payload: { title: "x", questions: [findQuestion] } });
  assert.equal(anon.statusCode, 401);
  const student = await app.inject({
    method: "POST",
    url: "/api/quizzes",
    headers: { cookie: estudiante },
    payload: { title: "x", questions: [findQuestion] },
  });
  assert.equal(student.statusCode, 403);
  const anonGen = await app.inject({
    method: "POST",
    url: "/api/quizzes/generate",
    payload: { bodySex: "male", systems: ["skeletal"], count: 3 },
  });
  assert.equal(anonGen.statusCode, 401);
  const seedEdit = await app.inject({
    method: "PUT",
    url: "/api/quizzes/quiz-locomotor",
    headers: { cookie: docente },
    payload: { title: "x", questions: [findQuestion] },
  });
  assert.equal(seedEdit.statusCode, 403);
});

test("guarda intentos del usuario y rechaza puntuaciones incoherentes", async () => {
  const url = "/api/quizzes/quiz-locomotor/attempts";
  const answers = [
    { questionId: "q-loc-1", correct: true, answer: "Hueso Fémur derecho", revealed: false },
    { questionId: "q-loc-2", correct: false, answer: "Hueso sacro", revealed: false },
  ];
  assert.equal((await app.inject({ method: "POST", url, payload: { score: 1, total: 5, answers } })).statusCode, 401);

  const ok = await app.inject({ method: "POST", url, headers: { cookie: estudiante }, payload: { score: 1, total: 5, answers } });
  assert.equal(ok.statusCode, 201, ok.body);

  const inflated = await app.inject({ method: "POST", url, headers: { cookie: estudiante }, payload: { score: 2, total: 5, answers } });
  assert.equal(inflated.statusCode, 400);

  const mine = (await app.inject({ url, headers: { cookie: estudiante } })).json();
  assert.equal(mine.length, 1);
  assert.equal(mine[0].score, 1);
  // Cada uno ve solo su historial.
  assert.equal((await app.inject({ url, headers: { cookie: docente } })).json().length, 0);
  const history = (await app.inject({ url: "/api/me/attempts", headers: { cookie: estudiante } })).json();
  assert.equal(history[0].quizTitle.startsWith("Cuestionario 1"), true);
});

test("el catálogo calcula tamaño, región y marca los grupos sin malla", () => {
  const femur = catalog.byId.male.get("FMA24474")!;
  assert.equal(femur.hasMesh, true);
  assert.equal(femur.region, "miembro inferior");
  assert.ok(femur.sizeCm > 40 && femur.sizeCm < 55, `fémur: ${femur.sizeCm} cm`);
  assert.equal(catalog.byId.male.get("FMA67944")!.region, "cabeza y cuello");
  assert.equal(catalog.byId.male.get("FMA7148")!.region, "abdomen");
  // El fémur femenino de HuBMAP es un grupo de piezas (cóndilos, etc.) sin malla propia.
  assert.equal(catalog.byId.female.get("VH_F_femur_L")!.hasMesh, false);
});

for (const difficulty of ["basico", "intermedio", "avanzado"] as const) {
  test(`genera cuestionarios de nivel ${difficulty} solo con estructuras seleccionables`, async () => {
    for (const bodySex of ["male", "female"] as const) {
      const res = await app.inject({
        method: "POST",
        url: "/api/quizzes/generate",
        headers: { cookie: estudiante },
        payload: { bodySex, systems: ["skeletal", "digestive"], count: 8, difficulty },
      });
      assert.equal(res.statusCode, 201, res.body);
      const quiz = res.json();
      assert.match(quiz.subtitle, /nivel/);
      for (const q of quiz.questions) {
        const st = catalog.byId[bodySex].get(q.targetStructureId)!;
        assert.ok(st.hasMesh, `${st.id} no tiene malla`);
        if (difficulty === "basico") assert.ok(st.clickSizeCm >= 3, `${st.nameEs}: ${st.clickSizeCm} cm`);
        assert.ok(q.hint.startsWith("Pertenece al"));
        if (q.type === "multipleChoice") {
          assert.equal(q.options.length, 4);
          assert.equal(new Set(q.options).size, 4);
          assert.ok(q.options.includes(q.targetNameEs));
        }
      }
      await app.inject({ method: "DELETE", url: `/api/quizzes/${quiz.id}`, headers: { cookie: estudiante } });
    }
  });
}

test("rechaza preguntas manuales sobre grupos sin malla", async () => {
  const res = await app.inject({
    method: "POST",
    url: "/api/quizzes",
    headers: { cookie: docente },
    payload: {
      title: "Grupo",
      questions: [{
        id: "q1", type: "find3d", prompt: "Fémur", hint: "", bodySex: "female",
        enabledSystems: ["skeletal"], targetStructureId: "VH_F_femur_L",
        targetNameEs: catalog.byId.female.get("VH_F_femur_L")!.nameEs, explanation: "",
      }],
    },
  });
  assert.equal(res.statusCode, 400);
  assert.match(res.json().details[0], /sin malla propia/);
});

test("migra una base de datos v1 existente hasta la última versión sin perder datos", async () => {
  const { DatabaseSync } = await import("node:sqlite");
  const fs = await import("node:fs");
  const os = await import("node:os");
  const path = await import("node:path");
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "biodigital-")), "v1.db");
  const v1 = new DatabaseSync(file);
  v1.exec(`
    CREATE TABLE quizzes (id TEXT PRIMARY KEY, title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT '', updated_at TEXT NOT NULL DEFAULT '');
    CREATE TABLE questions (id TEXT NOT NULL, quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      position INTEGER NOT NULL, type TEXT NOT NULL, prompt TEXT NOT NULL, hint TEXT NOT NULL DEFAULT '',
      body_sex TEXT NOT NULL, enabled_systems TEXT NOT NULL, target_structure_id TEXT NOT NULL,
      target_name_es TEXT NOT NULL, options TEXT, explanation TEXT NOT NULL DEFAULT '', PRIMARY KEY (quiz_id, id));
    CREATE TABLE quiz_attempts (id INTEGER PRIMARY KEY AUTOINCREMENT, quiz_id TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
      score INTEGER NOT NULL, total INTEGER NOT NULL, answers TEXT NOT NULL, finished_at TEXT NOT NULL DEFAULT '');
    INSERT INTO quizzes (id, title, source) VALUES ('viejo', 'Quiz v1', 'manual');
    INSERT INTO questions (id, quiz_id, position, type, prompt, body_sex, enabled_systems, target_structure_id, target_name_es)
      VALUES ('q1', 'viejo', 0, 'find3d', 'Fémur', 'male', '["skeletal"]', 'FMA24474', 'Hueso Fémur derecho');
    INSERT INTO quiz_attempts (quiz_id, score, total, answers) VALUES ('viejo', 1, 1, '[]');
    PRAGMA user_version = 1;
  `);
  v1.close();

  const migrated = openDb(file);
  const version = migrated.prepare("PRAGMA user_version").get() as { user_version: number };
  assert.equal(version.user_version, 4);
  const row = migrated.prepare("SELECT title, user_id, is_public FROM quizzes WHERE id = 'viejo'").get() as any;
  assert.deepEqual({ ...row }, { title: "Quiz v1", user_id: null, is_public: 1 });
  // La reconstrucción de tablas no debe haber borrado preguntas ni intentos en cascada.
  assert.equal((migrated.prepare("SELECT COUNT(*) AS n FROM questions").get() as any).n, 1);
  assert.equal((migrated.prepare("SELECT COUNT(*) AS n FROM quiz_attempts").get() as any).n, 1);
  // Y las claves foráneas siguen activas tras migrar.
  assert.equal((migrated.prepare("PRAGMA foreign_keys").get() as any).foreign_keys, 1);
  migrated.prepare("DELETE FROM quizzes WHERE id = 'viejo'").run();
  assert.equal((migrated.prepare("SELECT COUNT(*) AS n FROM questions").get() as any).n, 0);
  migrated.close();
});
