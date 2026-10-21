import { buildApp, SESSION_COOKIE } from "../src/app.ts";
import { loadCatalog } from "../src/catalog.ts";
import { openDb } from "../src/db.ts";
import { seedQuizzes } from "../src/seed.ts";
import { createUser } from "../src/users.ts";
import type { Role } from "../src/types.ts";

export const catalog = loadCatalog();

export function setup() {
  const db = openDb(":memory:");
  seedQuizzes(db);
  const app = buildApp(db, catalog);

  // Crea un usuario con el rol pedido, inicia sesión y devuelve la cabecera Cookie.
  const loginAs = async (username: string, role: Role = "estudiante", password = "contraseña-segura") => {
    await createUser(db, username, password, role);
    const res = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username, password } });
    if (res.statusCode !== 200) throw new Error(`login ${username}: ${res.statusCode} ${res.body}`);
    return cookieFrom(res.headers["set-cookie"]);
  };

  return { db, app, loginAs };
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
