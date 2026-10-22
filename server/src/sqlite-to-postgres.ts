import type { DatabaseSync } from "node:sqlite";
import { migratePostgres } from "./db.ts";
import type { Sql } from "./sql.ts";

// Copia de los datos de SQLite (esquema v4) a PostgreSQL. La usa el script migrate-sqlite.ts
// y los tests (con PGlite). Ver las condiciones en migrate-sqlite.ts.

// Tablas en orden de dependencias, con sus columnas y cómo convertir los valores de SQLite.
const BOOL = (v: unknown) => v === 1 || v === true;
const TABLES: Array<{ name: string; columns: string[]; convert?: Record<string, (v: unknown) => unknown> }> = [
  {
    name: "users",
    columns: ["id", "username", "password_hash", "role", "is_active", "created_at", "last_login_at"],
    convert: { is_active: BOOL },
  },
  {
    name: "quizzes",
    columns: ["id", "title", "subtitle", "source", "user_id", "is_public", "created_at", "updated_at"],
    convert: { is_public: BOOL },
  },
  {
    name: "questions",
    columns: [
      "id", "quiz_id", "position", "type", "prompt", "hint", "body_sex", "enabled_systems",
      "target_structure_id", "target_name_es", "options", "explanation",
    ],
  },
  { name: "quiz_attempts", columns: ["id", "quiz_id", "user_id", "score", "total", "answers", "finished_at"] },
  { name: "saved_views", columns: ["id", "user_id", "name", "state", "created_at", "updated_at"] },
  { name: "structure_notes", columns: ["user_id", "structure_id", "note", "updated_at"] },
];

// Tablas con id autonumérico: tras copiar ids explícitos hay que avanzar su secuencia.
const IDENTITY_TABLES = ["users", "quiz_attempts", "saved_views"];

const count = async (sql: Sql, table: string) =>
  (await sql.one<{ n: number }>(`SELECT CAST(COUNT(*) AS INTEGER) AS n FROM ${table}`))!.n;

export async function copySqliteToPostgres(source: DatabaseSync, target: Sql, log: (msg: string) => void = console.log) {
  await migratePostgres(target);
  if ((await count(target, "users")) > 0) {
    throw new Error("El destino ya tiene usuarios: solo se migra a una BD PostgreSQL nueva (sin cuentas).");
  }

  await target.tx(async (t) => {
    // Solo puede haber cuestionarios iniciales (sin usuarios no hay otros): se sustituyen.
    await t.execute("DELETE FROM quizzes");
    for (const table of TABLES) {
      const rows = source.prepare(`SELECT ${table.columns.join(", ")} FROM ${table.name}`).all() as Array<
        Record<string, unknown>
      >;
      const placeholders = table.columns.map((_, i) => `$${i + 1}`).join(", ");
      const insert = `INSERT INTO ${table.name} (${table.columns.join(", ")}) VALUES (${placeholders})`;
      for (const row of rows) {
        await t.execute(
          insert,
          table.columns.map((c) => (table.convert?.[c] ? table.convert[c](row[c]) : row[c]))
        );
      }
      log(`  ${table.name}: ${rows.length}`);
    }
    for (const table of IDENTITY_TABLES) {
      await t.execute(
        `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 0) + 1, false)`
      );
    }
  });

  // Comprobación: mismo número de filas en origen y destino.
  const mismatches: string[] = [];
  for (const table of TABLES) {
    const src = (source.prepare(`SELECT COUNT(*) AS n FROM ${table.name}`).get() as { n: number }).n;
    const dst = await count(target, table.name);
    if (src !== dst) mismatches.push(`${table.name}: SQLite ${src} ≠ PostgreSQL ${dst}`);
  }
  if (mismatches.length) throw new Error(`Los recuentos no coinciden: ${mismatches.join("; ")}`);
}
