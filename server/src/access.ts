import type { Quiz, QuizPermissions, Role, Viewer } from "./types.ts";

// Reglas de acceso (D-013). Sin sesión: ver y jugar los públicos, sin guardar.
//   estudiante: + guardar intentos, generar (privados) y borrar los suyos.
//   docente:    + crear y editar a mano, publicar/ocultar los suyos.
//   admin:      todo, sobre cualquier cuestionario, y gestionar usuarios.

const RANK: Record<Role, number> = { estudiante: 1, docente: 2, admin: 3 };

export const hasRole = (viewer: Viewer | null, min: Role) => !!viewer && RANK[viewer.role] >= RANK[min];

const isOwner = (viewer: Viewer | null, quiz: Pick<Quiz, "userId">) =>
  !!viewer && quiz.userId !== null && quiz.userId === viewer.id;

export function quizPermissions(viewer: Viewer | null, quiz: Pick<Quiz, "userId">): QuizPermissions {
  if (viewer?.role === "admin") return { edit: true, delete: true, publish: true };
  const own = isOwner(viewer, quiz);
  const docente = hasRole(viewer, "docente");
  return { edit: own && docente, delete: own, publish: own && docente };
}

export const withPermissions = (viewer: Viewer | null, quiz: Quiz): Quiz => ({
  ...quiz,
  permissions: quizPermissions(viewer, quiz),
});

// Limitador de intentos de inicio de sesión en memoria: N fallos por IP y usuario en una ventana.
export class LoginLimiter {
  private failures = new Map<string, number[]>();
  private max: number;
  private windowMs: number;
  constructor(max = 5, windowMs = 15 * 60 * 1000) {
    this.max = max;
    this.windowMs = windowMs;
  }

  private recent(key: string) {
    const now = Date.now();
    const list = (this.failures.get(key) ?? []).filter((t) => now - t < this.windowMs);
    this.failures.set(key, list);
    return list;
  }

  // Segundos que faltan para poder reintentar (0 si no está bloqueado).
  retryAfter(key: string): number {
    const list = this.recent(key);
    if (list.length < this.max) return 0;
    return Math.ceil((list[0] + this.windowMs - Date.now()) / 1000);
  }

  fail(key: string) {
    this.recent(key).push(Date.now());
  }

  reset(key: string) {
    this.failures.delete(key);
  }
}
