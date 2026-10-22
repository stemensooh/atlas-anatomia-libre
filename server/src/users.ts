import crypto from "node:crypto";
import { promisify } from "node:util";
import type { Db } from "./db.ts";
import { asBool, nowIso } from "./sql.ts";
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
  is_active: unknown;
  created_at: string;
  last_login_at: string | null;
}

const rowToUser = (r: UserRow): User => ({
  id: r.id,
  username: r.username,
  role: r.role,
  isActive: asBool(r.is_active),
  createdAt: r.created_at,
  lastLoginAt: r.last_login_at,
});

type UserWithHash = User & { passwordHash: string };

const withHash = (r: UserRow | undefined): UserWithHash | null =>
  r ? { ...rowToUser(r), passwordHash: r.password_hash } : null;

// El nombre de usuario no distingue mayúsculas (índice único sobre lower(username)).
export async function findUserByName(db: Db, username: string): Promise<UserWithHash | null> {
  return withHash(await db.one<UserRow>("SELECT * FROM users WHERE lower(username) = lower($1)", [username]));
}

export async function getUser(db: Db, id: number): Promise<UserWithHash | null> {
  return withHash(await db.one<UserRow>("SELECT * FROM users WHERE id = $1", [id]));
}

export const toPublicUser = ({ passwordHash: _omit, ...user }: User & { passwordHash?: string }): User => user;

export async function createUser(db: Db, username: string, password: string, role: Role = "estudiante"): Promise<User> {
  const hash = await hashPassword(password);
  const row = await db.one<UserRow>(
    "INSERT INTO users (username, password_hash, role, created_at) VALUES ($1, $2, $3, $4) RETURNING *",
    [username, hash, role, nowIso()]
  );
  return rowToUser(row!);
}

export async function setPassword(db: Db, userId: number, password: string) {
  const hash = await hashPassword(password);
  await db.execute("UPDATE users SET password_hash = $1 WHERE id = $2", [hash, userId]);
}

export interface UserWithStats extends User {
  quizCount: number;
  attemptCount: number;
}

export async function listUsers(db: Db): Promise<UserWithStats[]> {
  const rows = await db.query<UserRow & { quiz_count: number; attempt_count: number }>(
    `SELECT u.*,
            (SELECT CAST(COUNT(*) AS INTEGER) FROM quizzes WHERE user_id = u.id) AS quiz_count,
            (SELECT CAST(COUNT(*) AS INTEGER) FROM quiz_attempts WHERE user_id = u.id) AS attempt_count
     FROM users u ORDER BY u.created_at, u.id`
  );
  return rows.map((r) => ({ ...rowToUser(r), quizCount: r.quiz_count, attemptCount: r.attempt_count }));
}

export async function updateUser(db: Db, id: number, patch: { role?: Role; isActive?: boolean }) {
  if (patch.role) await db.execute("UPDATE users SET role = $1 WHERE id = $2", [patch.role, id]);
  if (patch.isActive !== undefined) {
    await db.execute("UPDATE users SET is_active = $1 WHERE id = $2", [patch.isActive, id]);
    if (!patch.isActive) await deleteUserSessions(db, id);
  }
}

// Borra la cuenta y, por ON DELETE CASCADE, sus sesiones, cuestionarios, intentos, vistas y notas.
export async function deleteUser(db: Db, id: number): Promise<boolean> {
  return (await db.execute("DELETE FROM users WHERE id = $1", [id])) > 0;
}

export async function countActiveAdmins(db: Db): Promise<number> {
  const row = await db.one<{ n: number }>(
    "SELECT CAST(COUNT(*) AS INTEGER) AS n FROM users WHERE role = 'admin' AND is_active = TRUE"
  );
  return row!.n;
}

// ---- Sesiones ----

const sha256 = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

export async function createSession(db: Db, userId: number): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  const now = nowIso();
  await db.tx(async (t) => {
    await t.execute("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES ($1, $2, $3, $4)", [
      sha256(token),
      userId,
      now,
      expiresAt.toISOString(),
    ]);
    await t.execute("UPDATE users SET last_login_at = $1 WHERE id = $2", [now, userId]);
    // Limpieza oportunista de sesiones caducadas.
    await t.execute("DELETE FROM sessions WHERE expires_at < $1", [now]);
  });
  return { token, expiresAt };
}

export async function getSessionViewer(db: Db, token: string): Promise<Viewer | null> {
  const r = await db.one<Viewer>(
    `SELECT u.id, u.username, u.role FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > $2 AND u.is_active = TRUE`,
    [sha256(token), nowIso()]
  );
  return r ? { id: r.id, username: r.username, role: r.role } : null;
}

export async function deleteSession(db: Db, token: string) {
  await db.execute("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
}

// Cierra todas las sesiones del usuario salvo, opcionalmente, la actual.
export async function deleteUserSessions(db: Db, userId: number, exceptToken?: string) {
  if (exceptToken) {
    await db.execute("DELETE FROM sessions WHERE user_id = $1 AND token_hash <> $2", [userId, sha256(exceptToken)]);
  } else {
    await db.execute("DELETE FROM sessions WHERE user_id = $1", [userId]);
  }
}
