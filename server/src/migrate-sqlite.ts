import fs from "node:fs";
import { DEFAULT_DB_PATH, openSqlite } from "./db.ts";
import { describeConnection, postgresSql } from "./sql.ts";
import { copySqliteToPostgres } from "./sqlite-to-postgres.ts";

// Copia todos los datos de la BD SQLite (server/data/atlas.db o ATLAS_DB) a PostgreSQL (DATABASE_URL).
// Uso: pnpm run migrate-sqlite
//   - El destino no debe tener usuarios: solo se admite migrar a una BD nueva. Los cuestionarios
//     iniciales que el servidor haya creado al arrancar se reemplazan por los de SQLite.
//   - Las sesiones no se copian: hay que volver a iniciar sesión.
//   - El archivo SQLite no se modifica: queda como copia de seguridad.

const sqlitePath = process.env.ATLAS_DB || DEFAULT_DB_PATH;
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Falta DATABASE_URL (la conexión a PostgreSQL). Configúrala en server/.env (ver .env.example).");
  process.exit(1);
}
if (!fs.existsSync(sqlitePath)) {
  console.error(`No existe la BD SQLite de origen: ${sqlitePath}`);
  process.exit(1);
}

console.log(`Origen:  SQLite ${sqlitePath}`);
console.log(`Destino: PostgreSQL ${describeConnection(url)}`);

// openSqlite aplica las migraciones pendientes de SQLite, para copiar siempre desde el esquema v4.
const source = openSqlite(sqlitePath);
const target = postgresSql(url);
try {
  await copySqliteToPostgres(source, target);
  console.log("Migración completada y verificada. Las sesiones no se copian: vuelve a iniciar sesión.");
  console.log("Para usar PostgreSQL, deja DATABASE_URL en server/.env (y DB_CLIENT=postgres o sin definir).");
} catch (err) {
  console.error(`Error: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  source.close();
  await target.close();
}
