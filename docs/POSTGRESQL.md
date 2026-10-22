# Configurar PostgreSQL

El servidor (`server/`) funciona con **SQLite** o **PostgreSQL** (D-016). El motor se elige con
variables de entorno en `server/.env`, un archivo que **no se versiona**. Las credenciales nunca
se escriben en el código ni en ningún archivo del repositorio.

## 1. Crear la base de datos y un usuario solo para la app

Conéctate a tu servidor con un usuario administrador (por ejemplo `postgres`) usando `psql`,
pgAdmin o DBeaver, y ejecuta lo siguiente, cambiando la contraseña por una larga y aleatoria:

```sql
-- Usuario de la aplicación: sin permisos de superusuario ni para crear bases o roles.
CREATE ROLE atlas_app LOGIN PASSWORD 'una-contraseña-larga-y-aleatoria'
  NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- Base de datos propiedad de ese usuario.
CREATE DATABASE atlas OWNER atlas_app ENCODING 'UTF8';

-- Nadie más puede conectarse a ella (salvo los superusuarios).
REVOKE ALL ON DATABASE atlas FROM PUBLIC;
```

Después, conectado a la base `atlas`:

```sql
-- El esquema public solo lo usa la app (en PostgreSQL < 15 cualquiera podía crear tablas en él).
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO atlas_app;
```

Las tablas las crea el servidor solo al arrancar: aplica las migraciones de
`server/src/schema-postgres.ts` y registra cada una en la tabla `schema_migrations`.

Para generar una contraseña aleatoria segura (solo letras y números) en PowerShell:

```powershell
$b = New-Object byte[] 24; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); [Convert]::ToBase64String($b) -replace '[+/=]', ''
```

## 2. Poner la conexión en `server/.env`

```powershell
cd C:\IOS\biodigital\server
Copy-Item .env.example .env
notepad .env
```

En `.env`, ajusta:

```ini
DB_CLIENT=postgres
DATABASE_URL=postgres://atlas_app:TU_CONTRASEÑA@HOST:5432/atlas
```

- **HOST:** `127.0.0.1` si PostgreSQL está en tu equipo, o el nombre o la IP del servidor.
- **Caracteres especiales** en la contraseña: `@` → `%40`, `:` → `%3A`, `/` → `%2F`, `#` → `%23`,
  `%` → `%25`, `?` → `%3F`, `&` → `%26`. Una contraseña solo con letras y números evita el problema.
- **Servidor remoto o en la nube:** añade `?sslmode=require` al final para cifrar la conexión.

Comprueba que git no lo va a subir. Debe responder con la regla de `.gitignore`:

```powershell
git check-ignore -v .env
```

## 3. Copiar tus datos actuales de SQLite (una sola vez)

Copia usuarios (con sus contraseñas cifradas), cuestionarios, intentos, vistas y notas. Solo
funciona con una base PostgreSQL sin usuarios, y no modifica `server/data/atlas.db`, que queda
como copia de seguridad. Las sesiones no se copian, así que hay que volver a iniciar sesión.

```powershell
cd C:\IOS\biodigital\server
pnpm run migrate-sqlite
```

Al terminar muestra cuántas filas copió de cada tabla y comprueba que coinciden con el origen.

## 4. Arrancar

```powershell
pnpm run dev
```

En el registro de arranque aparece el motor en uso, sin la contraseña:
`Base de datos: PostgreSQL: atlas en 127.0.0.1:5432 como atlas_app`.

Para volver a SQLite basta con `DB_CLIENT=sqlite` en `.env`.

## Buenas prácticas

- **No compartas la contraseña** por chat ni correo, y nunca la pongas en el código, en issues ni en commits.
- **Producción:** las variables van en la configuración del hosting o en un `.env` con permisos
  restringidos (`chmod 600`), nunca en git.
- **CI (GitHub Actions):** en *Settings → Secrets and variables → Actions*. Los tests no necesitan
  PostgreSQL: usan PGlite, un PostgreSQL embebido.
- **Red:** que PostgreSQL no sea accesible desde internet. Ciérralo con firewall o haz que escuche
  solo en `localhost` o en la red privada.
- **Activa en GitHub** *Secret scanning* y *Push protection* (*Settings → Code security*): bloquean
  un push que contenga credenciales.
- **Si una contraseña se filtra:** cámbiala de inmediato
  (`ALTER ROLE atlas_app PASSWORD '…';`) y actualiza `.env`. Borrarla del historial de git no basta.
