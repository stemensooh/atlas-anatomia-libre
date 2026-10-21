import Fastify from "fastify";
import type { Catalog } from "./catalog.ts";
import * as store from "./db.ts";
import { generateQuiz, GenerateError } from "./generator.ts";
import type { GenerateQuizInput, QuizAttemptInput, QuizInput } from "./types.ts";
import { attemptInputSchema, checkQuiz, generateInputSchema, quizInputSchema } from "./validate.ts";

export function buildApp(db: store.Db, catalog: Catalog, opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ?? false });
  const idParams = {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", maxLength: 64 } },
  } as const;

  app.get("/api/health", async () => ({ ok: true, quizzes: store.countQuizzes(db) }));

  // ?full=1 devuelve los cuestionarios con sus preguntas (lo que usa la web).
  app.get<{ Querystring: { full?: string } }>("/api/quizzes", async (req) =>
    req.query.full === "1" ? store.listQuizzesFull(db) : store.listQuizzes(db)
  );

  app.get<{ Params: { id: string } }>("/api/quizzes/:id", { schema: { params: idParams } }, async (req, reply) => {
    const quiz = store.getQuiz(db, req.params.id);
    return quiz ?? reply.code(404).send({ error: "Cuestionario no encontrado." });
  });

  app.post<{ Body: QuizInput }>("/api/quizzes", { schema: { body: quizInputSchema } }, async (req, reply) => {
    const errors = checkQuiz(catalog, req.body);
    if (errors.length) return reply.code(400).send({ error: "Cuestionario no válido.", details: errors });
    if (req.body.id && store.getQuiz(db, req.body.id)) {
      return reply.code(409).send({ error: `Ya existe un cuestionario con id "${req.body.id}".` });
    }
    return reply.code(201).send(store.createQuiz(db, req.body, "manual"));
  });

  app.put<{ Params: { id: string }; Body: QuizInput }>(
    "/api/quizzes/:id",
    { schema: { params: idParams, body: quizInputSchema } },
    async (req, reply) => {
      const errors = checkQuiz(catalog, req.body);
      if (errors.length) return reply.code(400).send({ error: "Cuestionario no válido.", details: errors });
      const quiz = store.updateQuiz(db, req.params.id, req.body);
      return quiz ?? reply.code(404).send({ error: "Cuestionario no encontrado." });
    }
  );

  app.delete<{ Params: { id: string } }>("/api/quizzes/:id", { schema: { params: idParams } }, async (req, reply) => {
    if (!store.deleteQuiz(db, req.params.id)) return reply.code(404).send({ error: "Cuestionario no encontrado." });
    return reply.code(204).send();
  });

  app.post<{ Body: GenerateQuizInput }>(
    "/api/quizzes/generate",
    { schema: { body: generateInputSchema } },
    async (req, reply) => {
      try {
        const input = generateQuiz(catalog, req.body);
        return reply.code(201).send(store.createQuiz(db, input, "generated"));
      } catch (err) {
        if (err instanceof GenerateError) return reply.code(400).send({ error: err.message });
        throw err;
      }
    }
  );

  app.get<{ Params: { id: string } }>("/api/quizzes/:id/attempts", { schema: { params: idParams } }, async (req) =>
    store.listAttempts(db, req.params.id)
  );

  app.post<{ Params: { id: string }; Body: QuizAttemptInput }>(
    "/api/quizzes/:id/attempts",
    { schema: { params: idParams, body: attemptInputSchema } },
    async (req, reply) => {
      const { score, total, answers } = req.body;
      if (score > total) return reply.code(400).send({ error: "La puntuación no puede superar el total." });
      if (answers.filter((a) => a.correct).length !== score) {
        return reply.code(400).send({ error: "La puntuación no coincide con las respuestas correctas." });
      }
      const attempt = store.addAttempt(db, req.params.id, req.body);
      return attempt ? reply.code(201).send(attempt) : reply.code(404).send({ error: "Cuestionario no encontrado." });
    }
  );

  return app;
}
