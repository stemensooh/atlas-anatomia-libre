import { buildApp } from "./app.ts";
import { loadCatalog } from "./catalog.ts";
import { openDb } from "./db.ts";
import { seedQuizzes } from "./seed.ts";

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || "127.0.0.1";

const db = openDb();
const added = seedQuizzes(db);
const app = buildApp(db, loadCatalog(), { logger: true });

if (added) app.log.info(`Base de datos nueva: ${added} cuestionarios iniciales cargados.`);

const shutdown = async () => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: PORT, host: HOST });
