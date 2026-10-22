import readline from "node:readline";
import { openDb } from "./db.ts";
import { createUser, deleteUserSessions, findUserByName, setPassword, updateUser } from "./users.ts";

// Crea un administrador, o asciende a admin a un usuario existente y le cambia la contraseña.
// Uso: pnpm run create-admin -- <usuario>
// La contraseña se pide por teclado sin mostrarla (o en ATLAS_ADMIN_PASSWORD, p. ej. en CI).

function askHidden(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const out = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
  let muted = false;
  out._writeToOutput = (s: string) => {
    if (!muted || s.includes("\n")) out.output.write(muted ? "\n" : s);
  };
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
    muted = true;
  });
}

// pnpm 12 reenvía el separador "--" al script (en PowerShell no llega): se ignora.
const username = process.argv.slice(2).find((a) => a !== "--");
if (!username || !/^[A-Za-z0-9._-]{3,32}$/.test(username)) {
  console.error("Uso: pnpm run create-admin -- <usuario>  (3-32 caracteres: letras, números, . _ -)");
  process.exit(1);
}

let password = process.env.ATLAS_ADMIN_PASSWORD ?? "";
if (!password) {
  password = await askHidden(`Contraseña para ${username} (mínimo 8 caracteres): `);
  const again = await askHidden("Repite la contraseña: ");
  if (password !== again) {
    console.error("Las contraseñas no coinciden.");
    process.exit(1);
  }
}
if (password.length < 8 || password.length > 128) {
  console.error("La contraseña debe tener entre 8 y 128 caracteres.");
  process.exit(1);
}

const db = await openDb();
console.log(`Base de datos: ${db.description}`);
const existing = await findUserByName(db, username);
if (existing) {
  await setPassword(db, existing.id, password);
  await updateUser(db, existing.id, { role: "admin", isActive: true });
  await deleteUserSessions(db, existing.id);
  console.log(`Usuario "${existing.username}" ahora es administrador (contraseña actualizada).`);
} else {
  await createUser(db, username, password, "admin");
  console.log(`Administrador "${username}" creado.`);
}
await db.close();
