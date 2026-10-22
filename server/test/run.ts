import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// Ejecuta toda la batería de tests con los dos motores de BD (D-016): SQLite y PostgreSQL (PGlite).
// Uso: pnpm test            → ambos
//      pnpm test sqlite     → solo uno (sqlite | postgres)

const dir = import.meta.dirname;
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".test.ts"))
  .map((f) => path.join(dir, f));
const engines = process.argv[2] ? [process.argv[2]] : ["sqlite", "postgres"];

let failed = false;
for (const engine of engines) {
  console.log(`\n=== Tests con ${engine === "postgres" ? "PostgreSQL (PGlite)" : "SQLite"} ===`);
  const res = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", "--test", ...files], {
    stdio: "inherit",
    env: { ...process.env, TEST_DB: engine },
  });
  if (res.status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
