import { buildApp } from "./app.ts";
import { loadCatalog } from "./catalog.ts";
import { openDb } from "./db.ts";
import { seedQuizzes } from "./seed.ts";
import { countActiveAdmins } from "./users.ts";

// La configuración se lee del entorno; en local, de server/.env (ver .env.example).
const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "127.0.0.1";

const db = await openDb();
const added = await seedQuizzes(db);
const app = buildApp(db, loadCatalog(), {
  logger: true,
  secureCookies: process.env.COOKIE_SECURE === "1",
});

app.log.info(`Base de datos: ${db.description}`);
if (added) app.log.info(`Base de datos nueva: ${added} cuestionarios iniciales cargados.`);
if ((await countActiveAdmins(db)) === 0) {
  app.log.warn("No hay ningún administrador. Crea uno con: pnpm run create-admin -- <usuario>");
}

const shutdown = async () => {
  await app.close();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: PORT, host: HOST });
