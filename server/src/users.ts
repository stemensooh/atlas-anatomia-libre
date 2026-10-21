import crypto from "node:crypto";
import { promisify } from "node:util";
import { tx, type Db } from "./db.ts";
import type { Role, User, Viewer } from "./types.ts";

const scrypt = promisify(crypto.scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: crypto.ScryptOptions
) => Promise<Buffer>;

// Parámetros de scrypt recomendados por OWASP (N=2^17 necesitaría más memoria de la que da Node
// por defecto). Se guardan en el propio hash para poder subirlos más adelante.
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

export const SESSION_DAYS = 30;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.keylen, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, n, r, p, salt, hash] = stored.split("$");
  if (algo !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scrypt(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: SCRYPT.maxmem,
  });
  return crypto.timingSafeEqual(key, expected);
}

// Hash de referencia para comparar aunque el usuario no exista (mismo tiempo de respuesta).
let dummyHash: Promise<string> | null = null;
export const getDummyHash = () => (dummyHash ??= hashPassword("contraseña-inexistente"));

interface UserRow {
  id: number;
  username: string;
  password_hash: string;
  role: Role;
  is_active: number;
  created_at: string;
  last_login_at: string | null;
}

const rowToUser = (r: UserRow): User => ({
  id: r.id,
  username: r.username,
  role: r.role,
  isActive: r.is_active === 1,
  createdAt: r.created_at,
  lastLoginAt: r.last_login_at,
});

export function findUserByName(db: Db, username: string): (User & { passwordHash: string }) | null {
  const r = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as UserRow | undefined;
  return r ? { ...rowToUser(r), passwordHash: r.password_hash } : null;
}

export function getUser(db: Db, id: number): (User & { passwordHash: string }) | null {
  const r = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
  return r ? { ...rowToUser(r), passwordHash: r.password_hash } : null;
}

export const toPublicUser = ({ passwordHash: _omit, ...user }: User & { passwordHash?: string }): User => user;

export async function createUser(db: Db, username: string, password: string, role: Role = "estudiante"): Promise<User> {
  const hash = await hashPassword(password);
  const { lastInsertRowid } = db
    .prepare("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)")
    .run(username, hash, role);
  return toPublicUser(getUser(db, Number(lastInsertRowid))!);
}

export async function setPassword(db: Db, userId: number, password: string) {
  const hash = await hashPassword(password);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, userId);
}

export interface UserWithStats extends User {
  quizCount: number;
  attemptCount: number;
}

export function listUsers(db: Db): UserWithStats[] {
  const rows = db
    .prepare(
      `SELECT u.*,
              (SELECT COUNT(*) FROM quizzes WHERE user_id = u.id) AS quiz_count,
              (SELECT COUNT(*) FROM quiz_attempts WHERE user_id = u.id) AS attempt_count
       FROM users u ORDER BY u.created_at`
    )
    .all() as unknown as Array<UserRow & { quiz_count: number; attempt_count: number }>;
  return rows.map((r) => ({ ...rowToUser(r), quizCount: r.quiz_count, attemptCount: r.attempt_count }));
}

export function updateUser(db: Db, id: number, patch: { role?: Role; isActive?: boolean }) {
  if (patch.role) db.prepare("UPDATE users SET role = ? WHERE id = ?").run(patch.role, id);
  if (patch.isActive !== undefined) {
    db.prepare("UPDATE users SET is_active = ? WHERE id = ?").run(patch.isActive ? 1 : 0, id);
    if (!patch.isActive) deleteUserSessions(db, id);
  }
}

// Borra la cuenta y, por ON DELETE CASCADE, sus sesiones, cuestionarios e intentos.
export function deleteUser(db: Db, id: number): boolean {
  return db.prepare("DELETE FROM users WHERE id = ?").run(id).changes > 0;
}

export function countActiveAdmins(db: Db): number {
  return (
    db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND is_active = 1").get() as { n: number }
  ).n;
}

// ---- Sesiones ----

const sha256 = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export function createSession(db: Db, userId: number): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  tx(db, () => {
    db.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").run(
      sha256(token),
      userId,
      expiresAt.toISOString()
    );
    db.prepare("UPDATE users SET last_login_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?").run(userId);
    // Limpieza oportunista de sesiones caducadas.
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(new Date().toISOString());
  });
  return { token, expiresAt };
}

export function getSessionViewer(db: Db, token: string): Viewer | null {
  const r = db
    .prepare(
      `SELECT u.id, u.username, u.role FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ? AND u.is_active = 1`
    )
    .get(sha256(token), new Date().toISOString()) as Viewer | undefined;
  return r ? { id: r.id, username: r.username, role: r.role } : null;
}

export function deleteSession(db: Db, token: string) {
  db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
}

// Cierra todas las sesiones del usuario salvo, opcionalmente, la actual.
export function deleteUserSessions(db: Db, userId: number, exceptToken?: string) {
  if (exceptToken) {
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash <> ?").run(userId, sha256(exceptToken));
  } else {
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
  }
}
