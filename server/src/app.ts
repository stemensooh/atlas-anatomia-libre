import Fastify, { type FastifyError, type FastifyReply, type FastifyRequest } from "fastify";
import { hasRole, LoginLimiter, quizPermissions, withPermissions } from "./access.ts";
import type { Catalog } from "./catalog.ts";
import * as store from "./db.ts";
import { generateQuiz, GenerateError } from "./generator.ts";
import type { GenerateQuizInput, QuizAttemptInput, QuizInput, Role, Viewer } from "./types.ts";
import * as library from "./library.ts";
import * as users from "./users.ts";
import {
  adminPasswordSchema,
  attemptInputSchema,
  changePasswordSchema,
  checkQuiz,
  credentialsSchema,
  deleteAccountSchema,
  generateInputSchema,
  loginSchema,
  MAX_VIEW_STATE_BYTES,
  noteSchema,
  quizInputSchema,
  structureParams,
  updateUserSchema,
  validationMessageEs,
  viewPatchSchema,
  viewSchema,
  visibilitySchema,
} from "./validate.ts";

declare module "fastify" {
  interface FastifyRequest {
    viewer: Viewer | null;
    sessionToken: string | null;
  }
}

export const SESSION_COOKIE = "bd_session";

function readCookie(header: string | undefined, name: string): string | null {
  for (const part of header?.split(";") ?? []) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export interface AppOptions {
  logger?: boolean;
  // Cookie con atributo Secure (obligatorio al publicar con HTTPS).
  secureCookies?: boolean;
}

export function buildApp(db: store.Db, catalog: Catalog, opts: AppOptions = {}) {
  const app = Fastify({ logger: opts.logger ?? false });
  const limiter = new LoginLimiter();

  // Errores de validación en español y con el mismo formato que el resto ({ error }).
  app.setErrorHandler((err: FastifyError, req, reply) => {
    if (err.validation) {
      return reply.code(400).send({ error: validationMessageEs(err.validation as any) });
    }
    if ((err.statusCode ?? 500) < 500) {
      return reply.code(err.statusCode!).send({ error: err.message });
    }
    req.log.error(err);
    return reply.code(500).send({ error: "Error interno del servidor." });
  });

  app.decorateRequest("viewer", null);
  app.decorateRequest("sessionToken", null);

  // Sesión desde la cookie y protección CSRF: las peticiones que modifican datos deben venir
  // del mismo origen (además de la cookie SameSite=Strict).
  app.addHook("onRequest", async (req, reply) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const origin = req.headers.origin;
      // Detrás de un proxy inverso el host público llega en X-Forwarded-Host.
      const host = String(req.headers["x-forwarded-host"] ?? req.headers.host ?? "").split(",")[0].trim();
      if (origin && new URL(origin).host !== host) {
        return reply.code(403).send({ error: "Origen no permitido." });
      }
    }
    const token = readCookie(req.headers.cookie, SESSION_COOKIE);
    if (token) {
      req.viewer = await users.getSessionViewer(db, token);
      req.sessionToken = req.viewer ? token : null;
    }
  });

  const setSessionCookie = (reply: FastifyReply, token: string, maxAgeSec: number) => {
    const attrs = [
      `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Strict",
      `Max-Age=${maxAgeSec}`,
    ];
    if (opts.secureCookies) attrs.push("Secure");
    reply.header("Set-Cookie", attrs.join("; "));
  };

  const startSession = async (reply: FastifyReply, userId: number) => {
    const { token } = await users.createSession(db, userId);
    setSessionCookie(reply, token, users.SESSION_DAYS * 24 * 3600);
  };

  // Corta la petición si no hay sesión o el rol no alcanza; devuelve el usuario si pasa.
  const requireRole = (req: FastifyRequest, reply: FastifyReply, min: Role = "estudiante"): Viewer | null => {
    if (!req.viewer) {
      reply.code(401).send({ error: "Inicia sesión para continuar." });
      return null;
    }
    if (!hasRole(req.viewer, min)) {
      reply.code(403).send({ error: "No tienes permiso para esta acción." });
      return null;
    }
    return req.viewer;
  };

  const idParams = {
    type: "object",
    required: ["id"],
    properties: { id: { type: "string", maxLength: 64 } },
  } as const;
  const userIdParams = {
    type: "object",
    required: ["id"],
    properties: { id: { type: "integer", minimum: 1 } },
  } as const;

  app.get("/api/health", async () => ({ ok: true, quizzes: await store.countQuizzes(db) }));

  // ---------- Autenticación ----------

  app.get("/api/auth/me", async (req) => ({ user: req.viewer }));

  app.post<{ Body: { username: string; password: string } }>(
    "/api/auth/register",
    { schema: { body: credentialsSchema } },
    async (req, reply) => {
      const { username, password } = req.body;
      if (await users.findUserByName(db, username)) {
        return reply.code(409).send({ error: "Ese nombre de usuario ya está en uso." });
      }
      const user = await users.createUser(db, username, password);
      await startSession(reply, user.id);
      return reply.code(201).send({ user: { id: user.id, username: user.username, role: user.role } });
    }
  );

  app.post<{ Body: { username: string; password: string } }>(
    "/api/auth/login",
    { schema: { body: loginSchema } },
    async (req, reply) => {
      const { username, password } = req.body;
      const key = `${req.ip}|${username.toLowerCase()}`;
      const wait = limiter.retryAfter(key);
      if (wait > 0) {
        reply.header("Retry-After", String(wait));
        return reply
          .code(429)
          .send({ error: `Demasiados intentos. Vuelve a probar en ${Math.ceil(wait / 60)} min.` });
      }
      const user = await users.findUserByName(db, username);
      // Se verifica siempre una contraseña para no revelar por el tiempo si el usuario existe.
      const ok = await users.verifyPassword(password, user?.passwordHash ?? (await users.getDummyHash()));
      if (!user || !ok) {
        limiter.fail(key);
        return reply.code(401).send({ error: "Usuario o contraseña incorrectos." });
      }
      if (!user.isActive) {
        return reply.code(403).send({ error: "La cuenta está desactivada. Contacta con un administrador." });
      }
      limiter.reset(key);
      await startSession(reply, user.id);
      return { user: { id: user.id, username: user.username, role: user.role } };
    }
  );

  app.post("/api/auth/logout", async (req, reply) => {
    if (req.sessionToken) await users.deleteSession(db, req.sessionToken);
    setSessionCookie(reply, "", 0);
    return reply.code(204).send();
  });

  app.post<{ Body: { currentPassword: string; newPassword: string } }>(
    "/api/auth/password",
    { schema: { body: changePasswordSchema } },
    async (req, reply) => {
      const viewer = requireRole(req, reply);
      if (!viewer) return;
      const user = (await users.getUser(db, viewer.id))!;
      if (!(await users.verifyPassword(req.body.currentPassword, user.passwordHash))) {
        return reply.code(400).send({ error: "La contraseña actual no es correcta." });
      }
      await users.setPassword(db, viewer.id, req.body.newPassword);
      await users.deleteUserSessions(db, viewer.id, req.sessionToken!);
      return reply.code(204).send();
    }
  );

  // Borrar la propia cuenta y todos sus datos (cuestionarios e intentos).
  app.delete<{ Body: { password: string } }>(
    "/api/auth/me",
    { schema: { body: deleteAccountSchema } },
    async (req, reply) => {
      const viewer = requireRole(req, reply);
      if (!viewer) return;
      const user = (await users.getUser(db, viewer.id))!;
      if (!(await users.verifyPassword(req.body.password, user.passwordHash))) {
        return reply.code(400).send({ error: "La contraseña no es correcta." });
      }
      if (user.role === "admin" && await users.countActiveAdmins(db) <= 1) {
        return reply.code(409).send({ error: "Eres el único administrador: nombra otro antes de borrar tu cuenta." });
      }
      await users.deleteUser(db, viewer.id);
      setSessionCookie(reply, "", 0);
      return reply.code(204).send();
    }
  );

  app.get("/api/me/attempts", async (req, reply) => {
    const viewer = requireRole(req, reply);
    if (!viewer) return;
    return await store.listUserAttempts(db, viewer.id);
  });

  // ---------- Administración de usuarios ----------

  app.get("/api/admin/users", async (req, reply) => {
    if (!requireRole(req, reply, "admin")) return;
    return await users.listUsers(db);
  });

  app.patch<{ Params: { id: number }; Body: { role?: Role; isActive?: boolean } }>(
    "/api/admin/users/:id",
    { schema: { params: userIdParams, body: updateUserSchema } },
    async (req, reply) => {
      const viewer = requireRole(req, reply, "admin");
      if (!viewer) return;
      const target = await users.getUser(db, req.params.id);
      if (!target) return reply.code(404).send({ error: "Usuario no encontrado." });
      const losesAdmin =
        target.role === "admin" &&
        target.isActive &&
        ((req.body.role && req.body.role !== "admin") || req.body.isActive === false);
      if (losesAdmin && target.id === viewer.id) {
        return reply.code(409).send({ error: "No puedes quitarte a ti mismo el rol de administrador ni desactivarte." });
      }
      if (losesAdmin && await users.countActiveAdmins(db) <= 1) {
        return reply.code(409).send({ error: "Debe quedar al menos un administrador activo." });
      }
      await users.updateUser(db, target.id, req.body);
      return users.toPublicUser((await users.getUser(db, target.id))!);
    }
  );

  app.post<{ Params: { id: number }; Body: { newPassword: string } }>(
    "/api/admin/users/:id/password",
    { schema: { params: userIdParams, body: adminPasswordSchema } },
    async (req, reply) => {
      if (!requireRole(req, reply, "admin")) return;
      if (!await users.getUser(db, req.params.id)) return reply.code(404).send({ error: "Usuario no encontrado." });
      await users.setPassword(db, req.params.id, req.body.newPassword);
      await users.deleteUserSessions(db, req.params.id);
      return reply.code(204).send();
    }
  );

  app.delete<{ Params: { id: number } }>(
    "/api/admin/users/:id",
    { schema: { params: userIdParams } },
    async (req, reply) => {
      const viewer = requireRole(req, reply, "admin");
      if (!viewer) return;
      if (req.params.id === viewer.id) {
        return reply.code(409).send({ error: "Para borrar tu propia cuenta usa Mi perfil." });
      }
      if (!await users.deleteUser(db, req.params.id)) return reply.code(404).send({ error: "Usuario no encontrado." });
      return reply.code(204).send();
    }
  );

  // ---------- Vistas guardadas (privadas) ----------

  const viewTooBig = (state: unknown) => JSON.stringify(state).length > MAX_VIEW_STATE_BYTES;

  app.get("/api/views", async (req, reply) => {
    const viewer = requireRole(req, reply);
    if (!viewer) return;
    return await library.listViews(db, viewer.id);
  });

  app.post<{ Body: { name: string; state: unknown } }>(
    "/api/views",
    { schema: { body: viewSchema } },
    async (req, reply) => {
      const viewer = requireRole(req, reply);
      if (!viewer) return;
      if (viewTooBig(req.body.state)) return reply.code(413).send({ error: "La vista es demasiado grande." });
      if (await library.countViews(db, viewer.id) >= library.MAX_VIEWS_PER_USER) {
        return reply
          .code(409)
          .send({ error: `Has llegado al máximo de ${library.MAX_VIEWS_PER_USER} vistas: borra alguna antes.` });
      }
      return reply.code(201).send(await library.createView(db, viewer.id, req.body.name.trim(), req.body.state));
    }
  );

  app.patch<{ Params: { id: number }; Body: { name?: string; state?: unknown } }>(
    "/api/views/:id",
    { schema: { params: userIdParams, body: viewPatchSchema } },
    async (req, reply) => {
      const viewer = requireRole(req, reply);
      if (!viewer) return;
      if (req.body.state !== undefined && viewTooBig(req.body.state)) {
        return reply.code(413).send({ error: "La vista es demasiado grande." });
      }
      const view = await library.updateView(db, viewer.id, req.params.id, {
        ...req.body,
        name: req.body.name?.trim(),
      });
      return view ?? reply.code(404).send({ error: "Vista no encontrada." });
    }
  );

  app.delete<{ Params: { id: number } }>(
    "/api/views/:id",
    { schema: { params: userIdParams } },
    async (req, reply) => {
      const viewer = requireRole(req, reply);
      if (!viewer) return;
      if (!await library.deleteView(db, viewer.id, req.params.id)) return reply.code(404).send({ error: "Vista no encontrada." });
      return reply.code(204).send();
    }
  );

  // ---------- Notas por estructura (privadas) ----------

  const structureExists = (id: string) => catalog.byId.male.has(id) || catalog.byId.female.has(id);

  app.get("/api/notes", async (req, reply) => {
    const viewer = requireRole(req, reply);
    if (!viewer) return;
    return await library.listNotes(db, viewer.id);
  });

  // Guarda o reemplaza la nota; enviar una nota vacía la borra (204).
  app.put<{ Params: { structureId: string }; Body: { note: string } }>(
    "/api/notes/:structureId",
    { schema: { params: structureParams, body: noteSchema } },
    async (req, reply) => {
      const viewer = requireRole(req, reply);
      if (!viewer) return;
      const { structureId } = req.params;
      if (!structureExists(structureId)) return reply.code(404).send({ error: "Estructura no encontrada." });
      if (
        req.body.note.trim() &&
        !await library.hasNote(db, viewer.id, structureId) &&
        await library.countNotes(db, viewer.id) >= library.MAX_NOTES_PER_USER
      ) {
        return reply.code(409).send({ error: `Has llegado al máximo de ${library.MAX_NOTES_PER_USER} notas.` });
      }
      const note = await library.saveNote(db, viewer.id, structureId, req.body.note);
      return note ?? reply.code(204).send();
    }
  );

  app.delete<{ Params: { structureId: string } }>(
    "/api/notes/:structureId",
    { schema: { params: structureParams } },
    async (req, reply) => {
      const viewer = requireRole(req, reply);
      if (!viewer) return;
      await library.deleteNote(db, viewer.id, req.params.structureId);
      return reply.code(204).send();
    }
  );

  // ---------- Cuestionarios ----------

  // Devuelve los cuestionarios visibles con sus preguntas y permisos (?full=1 se acepta por compatibilidad).
  app.get("/api/quizzes", async (req) =>
    (await store.listQuizzesFull(db, req.viewer)).map((q) => withPermissions(req.viewer, q))
  );

  app.get<{ Params: { id: string } }>("/api/quizzes/:id", { schema: { params: idParams } }, async (req, reply) => {
    const quiz = await store.getQuiz(db, req.params.id, req.viewer);
    return quiz ? withPermissions(req.viewer, quiz) : reply.code(404).send({ error: "Cuestionario no encontrado." });
  });

  app.post<{ Body: QuizInput }>("/api/quizzes", { schema: { body: quizInputSchema } }, async (req, reply) => {
    const viewer = requireRole(req, reply, "docente");
    if (!viewer) return;
    const errors = checkQuiz(catalog, req.body);
    if (errors.length) return reply.code(400).send({ error: "Cuestionario no válido.", details: errors });
    if (req.body.id && await store.getQuiz(db, req.body.id)) {
      return reply.code(409).send({ error: `Ya existe un cuestionario con id "${req.body.id}".` });
    }
    const quiz = await store.createQuiz(db, req.body, "manual", { userId: viewer.id, isPublic: false });
    return reply.code(201).send(withPermissions(viewer, quiz));
  });

  // Para modificar o borrar hay que poder ver el cuestionario y tener el permiso concreto.
  const loadForAction = async (
    req: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
    action: "edit" | "delete" | "publish" | "results"
  ) => {
    const viewer = requireRole(req, reply);
    if (!viewer) return null;
    const quiz = await store.getQuiz(db, req.params.id, viewer);
    if (!quiz) {
      reply.code(404).send({ error: "Cuestionario no encontrado." });
      return null;
    }
    if (!quizPermissions(viewer, quiz)[action]) {
      reply.code(403).send({ error: "No tienes permiso para esta acción." });
      return null;
    }
    return { viewer, quiz };
  };

  app.put<{ Params: { id: string }; Body: QuizInput }>(
    "/api/quizzes/:id",
    { schema: { params: idParams, body: quizInputSchema } },
    async (req, reply) => {
      const ctx = await loadForAction(req, reply, "edit");
      if (!ctx) return;
      const errors = checkQuiz(catalog, req.body);
      if (errors.length) return reply.code(400).send({ error: "Cuestionario no válido.", details: errors });
      return withPermissions(ctx.viewer, (await store.updateQuiz(db, ctx.quiz.id, req.body))!);
    }
  );

  app.patch<{ Params: { id: string }; Body: { isPublic: boolean } }>(
    "/api/quizzes/:id/visibility",
    { schema: { params: idParams, body: visibilitySchema } },
    async (req, reply) => {
      const ctx = await loadForAction(req, reply, "publish");
      if (!ctx) return;
      return withPermissions(ctx.viewer, (await store.setQuizVisibility(db, ctx.quiz.id, req.body.isPublic))!);
    }
  );

  app.delete<{ Params: { id: string } }>("/api/quizzes/:id", { schema: { params: idParams } }, async (req, reply) => {
    const ctx = await loadForAction(req, reply, "delete");
    if (!ctx) return;
    await store.deleteQuiz(db, ctx.quiz.id);
    return reply.code(204).send();
  });

  app.post<{ Body: GenerateQuizInput }>(
    "/api/quizzes/generate",
    { schema: { body: generateInputSchema } },
    async (req, reply) => {
      const viewer = requireRole(req, reply);
      if (!viewer) return;
      try {
        const input = generateQuiz(catalog, req.body);
        const quiz = await store.createQuiz(db, input, "generated", { userId: viewer.id, isPublic: false });
        return reply.code(201).send(withPermissions(viewer, quiz));
      } catch (err) {
        if (err instanceof GenerateError) return reply.code(400).send({ error: err.message });
        throw err;
      }
    }
  );

  // Resultados de todos los usuarios: para el docente dueño del cuestionario y para el admin.
  app.get<{ Params: { id: string } }>(
    "/api/quizzes/:id/results",
    { schema: { params: idParams } },
    async (req, reply) => {
      const ctx = await loadForAction(req, reply, "results");
      if (!ctx) return;
      return await library.quizResults(db, ctx.quiz.id, ctx.quiz.questions);
    }
  );

  // Intentos propios de un cuestionario (sin sesión no hay historial).
  app.get<{ Params: { id: string } }>(
    "/api/quizzes/:id/attempts",
    { schema: { params: idParams } },
    async (req) => (req.viewer ? await store.listUserAttempts(db, req.viewer.id, req.params.id, 20) : [])
  );

  app.post<{ Params: { id: string }; Body: QuizAttemptInput }>(
    "/api/quizzes/:id/attempts",
    { schema: { params: idParams, body: attemptInputSchema } },
    async (req, reply) => {
      const viewer = requireRole(req, reply);
      if (!viewer) return;
      if (!await store.getQuiz(db, req.params.id, viewer)) {
        return reply.code(404).send({ error: "Cuestionario no encontrado." });
      }
      const { score, total, answers } = req.body;
      if (score > total) return reply.code(400).send({ error: "La puntuación no puede superar el total." });
      if (answers.filter((a) => a.correct).length !== score) {
        return reply.code(400).send({ error: "La puntuación no coincide con las respuestas correctas." });
      }
      return reply.code(201).send(await store.addAttempt(db, req.params.id, req.body, viewer.id));
    }
  );

  return app;
}
