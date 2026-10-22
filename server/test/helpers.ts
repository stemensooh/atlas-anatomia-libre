import { PGlite } from "@electric-sql/pglite";
import { buildApp, SESSION_COOKIE } from "../src/app.ts";
import { loadCatalog } from "../src/catalog.ts";
import { migratePostgres, openSqlite, type Db } from "../src/db.ts";
import { seedQuizzes } from "../src/seed.ts";
import { pgliteSql, sqliteSql, type PgliteLike } from "../src/sql.ts";
import { createUser } from "../src/users.ts";
import type { Role } from "../src/types.ts";

export const catalog = loadCatalog();

// Motor de los tests: TEST_DB=sqlite (en memoria) o TEST_DB=postgres (PGlite en memoria).
// test/run.ts ejecuta toda la batería con los dos.
export const TEST_ENGINE = process.env.TEST_DB === "postgres" ? "postgres" : "sqlite";

export async function openTestDb(): Promise<Db> {
  if (TEST_ENGINE === "postgres") {
    const sql = pgliteSql((await PGlite.create()) as unknown as PgliteLike);
    await migratePostgres(sql);
    return sql;
  }
  return sqliteSql(openSqlite(":memory:"));
}

export async function setup() {
  const db = await openTestDb();
  await seedQuizzes(db);
  const app = buildApp(db, catalog);

  // Crea un usuario con el rol pedido, inicia sesión y devuelve la cabecera Cookie.
  const loginAs = async (username: string, role: Role = "estudiante", password = "contraseña-segura") => {
    await createUser(db, username, password, role);
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password } });
    if (res.statusCode !== 200) throw new Error(`login ${username}: ${res.statusCode} ${res.body}`);
    return cookieFrom(res.headers["set-cookie"]);
  };

  // Recuento rápido para comprobar el contenido de la BD desde los tests.
  const count = async (table: string, where = "TRUE", params: unknown[] = []) =>
    (await db.one<{ n: number }>(`SELECT CAST(COUNT(*) AS INTEGER) AS n FROM ${table} WHERE ${where}`, params))!.n;

  return { db, app, loginAs, count };
}

export function cookieFrom(header: string | string[] | number | undefined): string {
  const raw = Array.isArray(header) ? header[0] : String(header ?? "");
  const value = raw.split(";")[0];
  if (!value.startsWith(`${SESSION_COOKIE}=`)) throw new Error(`sin cookie de sesión: ${raw}`);
  return value;
}

export const findQuestion = {
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
