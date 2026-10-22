import { DatabaseSync } from "node:sqlite";
import pg from "pg";

// Capa mínima sobre los dos motores admitidos (D-016): SQLite (node:sqlite) y PostgreSQL (pg).
// El SQL de la app se escribe una vez, con marcadores $1, $2… y SQL común a ambos:
//   - fechas: se pasan como texto ISO 8601 y se leen siempre como texto ISO (…Z);
//   - booleanos: TRUE/FALSE en SQL; en SQLite se guardan como 1/0 (usar asBool al leer);
//   - JSON: se envía con JSON.stringify y se lee con fromJson (texto en SQLite, jsonb en PostgreSQL);
//   - recuentos: CAST(COUNT(*) AS INTEGER), para que PostgreSQL no devuelva bigint como texto;
//   - ids nuevos: INSERT … RETURNING id.

export type Dialect = "sqlite" | "postgres";

export interface Sql {
  readonly dialect: Dialect;
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  one<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | undefined>;
  // Devuelve el número de filas afectadas.
  execute(text: string, params?: unknown[]): Promise<number>;
  // Script de varias sentencias sin parámetros (migraciones).
  exec(text: string): Promise<void>;
  // Ejecuta fn en una transacción; dentro hay que usar el Sql que recibe.
  tx<T>(fn: (sql: Sql) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

export const asBool = (v: unknown) => v === true || v === 1 || v === "1" || v === "t";

export const fromJson = <T = unknown>(v: unknown): T =>
  (typeof v === "string" ? JSON.parse(v) : v) as T;

export const nowIso = () => new Date().toISOString();

// ---------- SQLite ----------

// SQLite no admite booleanos ni undefined como parámetros.
const sqliteParam = (v: unknown) => (v === true ? 1 : v === false ? 0 : v === undefined ? null : v);

// $1 → ?1: en SQLite ?NNN es un parámetro numerado (se puede repetir, como $1 en PostgreSQL).
const toSqlite = (text: string) => text.replace(/\$(\d+)/g, "?$1");

type SqliteParam = null | number | bigint | string | Uint8Array;

export function sqliteSql(db: DatabaseSync): Sql {
  // node:sqlite es síncrono, pero las funciones de la app son async: entre dos await de una
  // transacción podría colarse otra petición en la misma conexión. Un cerrojo hace que todo
  // lo que llegue durante una transacción espere a que termine.
  let lock: Promise<unknown> = Promise.resolve();

  const make = (inTx: boolean): Sql => {
    const wait = async () => {
      if (!inTx) await lock;
    };
    const prepare = (text: string) => db.prepare(toSqlite(text));
    const bind = (params: unknown[]) => params.map(sqliteParam) as SqliteParam[];
    return {
      dialect: "sqlite",
      async query<T>(text: string, params: unknown[] = []) {
        await wait();
        return prepare(text).all(...bind(params)) as T[];
      },
      async one<T>(text: string, params: unknown[] = []) {
        await wait();
        return prepare(text).get(...bind(params)) as T | undefined;
      },
      async execute(text: string, params: unknown[] = []) {
        await wait();
        return Number(prepare(text).run(...bind(params)).changes);
      },
      async exec(text: string) {
        await wait();
        db.exec(text);
      },
      async tx<T>(fn: (sql: Sql) => Promise<T>) {
        if (inTx) return fn(this);
        const run = async () => {
          db.exec("BEGIN");
          try {
            const out = await fn(make(true));
            db.exec("COMMIT");
            return out;
          } catch (err) {
            db.exec("ROLLBACK");
            throw err;
          }
        };
        const result = lock.then(run, run);
        lock = result.catch(() => undefined);
        return result;
      },
      async close() {
        db.close();
      },
    };
  };
  return make(false);
}

// ---------- PostgreSQL (pg) ----------

// Fechas como texto ISO en UTC, igual que en SQLite (timestamptz = 1184, timestamp = 1114).
pg.types.setTypeParser(1184, (v) => new Date(v).toISOString());
pg.types.setTypeParser(1114, (v) => new Date(`${v}Z`).toISOString());

type Queryable = Pick<pg.Pool, "query">;

function pgOn(client: Queryable, onTx: <T>(fn: (sql: Sql) => Promise<T>) => Promise<T>, close: () => Promise<void>): Sql {
  return {
    dialect: "postgres",
    async query<T>(text: string, params: unknown[] = []) {
      return (await client.query(text, params)).rows as T[];
    },
    async one<T>(text: string, params: unknown[] = []) {
      return (await client.query(text, params)).rows[0] as T | undefined;
    },
    async execute(text: string, params: unknown[] = []) {
      return (await client.query(text, params)).rowCount ?? 0;
    },
    async exec(text: string) {
      // Sin parámetros, pg usa el protocolo simple, que admite varias sentencias.
      await client.query(text);
    },
    tx: onTx,
    close,
  };
}

export function postgresSql(connectionString: string): Sql {
  const pool = new pg.Pool({ connectionString, max: 10 });
  // Un error en una conexión inactiva (p. ej. el servidor se reinicia) no debe tumbar la API.
  pool.on("error", (err) => console.error("PostgreSQL:", err.message));

  return pgOn(
    pool,
    async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const inner: Sql = pgOn(client, (f) => f(inner), async () => {});
        const out = await fn(inner);
        await client.query("COMMIT");
        return out;
      } catch (err) {
        await client.query("ROLLBACK").catch(() => {});
        throw err;
      } finally {
        client.release();
      }
    },
    () => pool.end()
  );
}

// ---------- PostgreSQL embebido (PGlite, solo tests) ----------

// Se recibe la instancia ya creada para no importar PGlite (dependencia de desarrollo) en producción.
export interface PgliteLike {
  query<T>(text: string, params?: unknown[], options?: unknown): Promise<{ rows: T[]; affectedRows?: number }>;
  exec(text: string): Promise<unknown>;
  transaction<T>(fn: (tx: PgliteLike) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

const PGLITE_PARSERS = {
  parsers: {
    1184: (v: string) => new Date(v).toISOString(),
    1114: (v: string) => new Date(`${v}Z`).toISOString(),
  },
};

export function pgliteSql(db: PgliteLike, inTx = false): Sql {
  return {
    dialect: "postgres",
    async query<T>(text: string, params: unknown[] = []) {
      return (await db.query<T>(text, params, PGLITE_PARSERS)).rows;
    },
    async one<T>(text: string, params: unknown[] = []) {
      return (await db.query<T>(text, params, PGLITE_PARSERS)).rows[0];
    },
    async execute(text: string, params: unknown[] = []) {
      return (await db.query(text, params, PGLITE_PARSERS)).affectedRows ?? 0;
    },
    async exec(text: string) {
      await db.exec(text);
    },
    async tx<T>(fn: (sql: Sql) => Promise<T>) {
      if (inTx) return fn(this);
      return db.transaction((t) => fn(pgliteSql(t, true)));
    },
    async close() {
      if (!inTx) await db.close();
    },
  };
}

// Descripción de la conexión para los logs, sin la contraseña.
export function describeConnection(url: string): string {
  try {
    const u = new URL(url);
    return `${u.pathname.replace(/^\//, "") || "(sin base)"} en ${u.hostname}:${u.port || 5432} como ${decodeURIComponent(u.username)}`;
  } catch {
    return "(DATABASE_URL no válida)";
  }
}
