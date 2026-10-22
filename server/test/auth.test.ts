import assert from "node:assert/strict";
import { after, test } from "node:test";
import { hashPassword, verifyPassword } from "../src/users.ts";
import { cookieFrom, setup } from "./helpers.ts";

const { db, app, loginAs, count } = await setup();
after(async () => {
  await app.close();
  await db.close();
});

const register = (username: string, password = "contraseña-segura") =>
  app.inject({ method: "POST", url: "/api/auth/register", payload: { username, password } });

test("las contraseñas se guardan con scrypt y se verifican", async () => {
  const hash = await hashPassword("secreto-123");
  assert.match(hash, /^scrypt\$\d+\$8\$1\$/);
  assert.equal(await verifyPassword("secreto-123", hash), true);
  assert.equal(await verifyPassword("otro", hash), false);
  const rows = await db.query<{ password_hash: string }>("SELECT password_hash FROM users");
  assert.ok(rows.every((r) => r.password_hash.startsWith("scrypt$") && !r.password_hash.includes("contraseña")));
});

test("registro libre como estudiante con cookie de sesión segura", async () => {
  const res = await register("Nuevo.Usuario");
  assert.equal(res.statusCode, 201, res.body);
  assert.equal(res.json().user.role, "estudiante");
  const setCookie = String(res.headers["set-cookie"]);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Strict/);

  const me = await app.inject({ url: "/api/auth/me", headers: { cookie: cookieFrom(res.headers["set-cookie"]) } });
  assert.equal(me.json().user.username, "Nuevo.Usuario");

  // El nombre no distingue mayúsculas.
  assert.equal((await register("nuevo.usuario")).statusCode, 409);
  // Validación de formato y longitud, con mensajes en español.
  const spaces = await register("a b");
  assert.equal(spaces.statusCode, 400);
  assert.match(spaces.json().error, /^El usuario debe tener de 3 a 32 caracteres/);
  const short = await register("valido", "corta");
  assert.equal(short.statusCode, 400);
  assert.equal(short.json().error, "La contraseña debe tener al menos 8 caracteres.");
});

test("login correcto, incorrecto y cierre de sesión", async () => {
  await register("ana", "contraseña-de-ana");
  const bad = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "ana", password: "mala-clave" } });
  assert.equal(bad.statusCode, 401);
  // Una contraseña corta en el login es solo una contraseña incorrecta, no un error de formato.
  const shortPwd = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "ana", password: "123" } });
  assert.equal(shortPwd.statusCode, 401);
  const ghost = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "nadie", password: "mala-clave" } });
  assert.equal(ghost.statusCode, 401);
  assert.equal(ghost.json().error, bad.json().error, "no revela si el usuario existe");

  const ok = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "ANA", password: "contraseña-de-ana" } });
  assert.equal(ok.statusCode, 200);
  const cookie = cookieFrom(ok.headers["set-cookie"]);

  const out = await app.inject({ method: "POST", url: "/api/auth/logout", headers: { cookie } });
  assert.equal(out.statusCode, 204);
  assert.equal((await app.inject({ url: "/api/auth/me", headers: { cookie } })).json().user, null);
});

test("bloquea tras 5 intentos fallidos", async () => {
  await register("bruto", "contraseña-buena");
  for (let i = 0; i < 5; i++) {
    await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "bruto", password: `mala-${i}-xxx` } });
  }
  const blocked = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "bruto", password: "contraseña-buena" } });
  assert.equal(blocked.statusCode, 429);
  assert.ok(Number(blocked.headers["retry-after"]) > 0);
});

test("rechaza peticiones de otro origen (CSRF)", async () => {
  const cookie = await loginAs("victima");
  const res = await app.inject({
    method: "POST",
    url: "/api/quizzes/generate",
    headers: { cookie, origin: "https://sitio-malicioso.example", host: "localhost:5173" },
    payload: { bodySex: "male", systems: ["skeletal"], count: 3 },
  });
  assert.equal(res.statusCode, 403);
  const same = await app.inject({
    method: "POST",
    url: "/api/quizzes/generate",
    headers: { cookie, origin: "http://localhost:5173", host: "localhost:5173" },
    payload: { bodySex: "male", systems: ["skeletal"], count: 3 },
  });
  assert.equal(same.statusCode, 201);
  // Detrás de un proxy inverso: el host público llega en X-Forwarded-Host.
  const proxied = await app.inject({
    method: "POST",
    url: "/api/quizzes/generate",
    headers: { cookie, origin: "https://atlas.example", host: "127.0.0.1:3001", "x-forwarded-host": "atlas.example" },
    payload: { bodySex: "male", systems: ["skeletal"], count: 3 },
  });
  assert.equal(proxied.statusCode, 201);
});

test("cambiar contraseña cierra las demás sesiones", async () => {
  const s1 = await loginAs("cambia", "estudiante", "contraseña-vieja");
  const s2 = cookieFrom(
    (await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "cambia", password: "contraseña-vieja" } }))
      .headers["set-cookie"]
  );
  const wrong = await app.inject({
    method: "POST", url: "/api/auth/password", headers: { cookie: s1 },
    payload: { currentPassword: "no-es-esta", newPassword: "contraseña-nueva" },
  });
  assert.equal(wrong.statusCode, 400);
  const ok = await app.inject({
    method: "POST", url: "/api/auth/password", headers: { cookie: s1 },
    payload: { currentPassword: "contraseña-vieja", newPassword: "contraseña-nueva" },
  });
  assert.equal(ok.statusCode, 204);
  assert.equal((await app.inject({ url: "/api/auth/me", headers: { cookie: s1 } })).json().user.username, "cambia");
  assert.equal((await app.inject({ url: "/api/auth/me", headers: { cookie: s2 } })).json().user, null);
});

test("borrar la cuenta elimina sus cuestionarios e intentos", async () => {
  const cookie = await loginAs("se-va");
  const quiz = (await app.inject({
    method: "POST", url: "/api/quizzes/generate", headers: { cookie },
    payload: { bodySex: "male", systems: ["skeletal"], count: 3 },
  })).json();
  await app.inject({
    method: "POST", url: `/api/quizzes/${quiz.id}/attempts`, headers: { cookie },
    payload: { score: 0, total: 3, answers: [] },
  });
  const wrong = await app.inject({ method: "DELETE", url: "/api/auth/me", headers: { cookie }, payload: { password: "mala-clave" } });
  assert.equal(wrong.statusCode, 400);
  const ok = await app.inject({ method: "DELETE", url: "/api/auth/me", headers: { cookie }, payload: { password: "contraseña-segura" } });
  assert.equal(ok.statusCode, 204);
  assert.equal(await count("quizzes", "id = $1", [quiz.id]), 0);
  assert.equal(await count("quiz_attempts", "quiz_id = $1", [quiz.id]), 0);
  assert.equal((await app.inject({ url: "/api/auth/me", headers: { cookie } })).json().user, null);
});

test("administración de usuarios: solo admin y sin dejar el sistema sin administradores", async () => {
  const admin = await loginAs("admin1", "admin");
  const student = await loginAs("estu");
  assert.equal((await app.inject({ url: "/api/admin/users", headers: { cookie: student } })).statusCode, 403);
  assert.equal((await app.inject({ url: "/api/admin/users" })).statusCode, 401);

  const list = (await app.inject({ url: "/api/admin/users", headers: { cookie: admin } })).json();
  const estu = list.find((u: any) => u.username === "estu");
  assert.equal(estu.passwordHash, undefined, "nunca se envía el hash");
  const me = list.find((u: any) => u.username === "admin1");

  // Ascender a docente.
  const promoted = await app.inject({
    method: "PATCH", url: `/api/admin/users/${estu.id}`, headers: { cookie: admin }, payload: { role: "docente" },
  });
  assert.equal(promoted.json().role, "docente");
  assert.equal((await app.inject({ url: "/api/auth/me", headers: { cookie: student } })).json().user.role, "docente");

  // No puede degradarse a sí mismo.
  const self = await app.inject({
    method: "PATCH", url: `/api/admin/users/${me.id}`, headers: { cookie: admin }, payload: { role: "estudiante" },
  });
  assert.equal(self.statusCode, 409);

  // Restablecer contraseña cierra sus sesiones.
  const reset = await app.inject({
    method: "POST", url: `/api/admin/users/${estu.id}/password`, headers: { cookie: admin },
    payload: { newPassword: "temporal-1234" },
  });
  assert.equal(reset.statusCode, 204);
  assert.equal((await app.inject({ url: "/api/auth/me", headers: { cookie: student } })).json().user, null);

  // Desactivar impide iniciar sesión.
  await app.inject({ method: "PATCH", url: `/api/admin/users/${estu.id}`, headers: { cookie: admin }, payload: { isActive: false } });
  const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: { username: "estu", password: "temporal-1234" } });
  assert.equal(login.statusCode, 403);

  const del = await app.inject({ method: "DELETE", url: `/api/admin/users/${estu.id}`, headers: { cookie: admin } });
  assert.equal(del.statusCode, 204);
});
