# Visor anatómico 3D libre

Proyecto de aprendizaje para crear un visor de anatomía humana en 3D, abierto y no comercial.

> Solo con fines educativos. No sustituye consejo, diagnóstico ni tratamiento médico.

## Estado
- **Fase 0, Fase 1 y Fase 2:** cerradas.
- **Fase 3 (Visor MVP):** funcional en `web/` con el cuerpo masculino (1.658 estructuras FMA), el cuerpo femenino (956 estructuras HuBMAP) divididos en 10 sistemas anatómicos y 87 órganos individuales detallados, todo traducido al español.
- Ver el plan completo en [docs/PLAN_PROYECTO.md](docs/PLAN_PROYECTO.md) y la guía para ampliar contenido en [docs/COMO_AGREGAR_MODELOS_Y_TRADUCCIONES.md](docs/COMO_AGREGAR_MODELOS_Y_TRADUCCIONES.md).

## Cómo ejecutar el visor en local
La primera vez, instala las dependencias (`pnpm install` en `web/` y en `server/`). Después, en dos terminales:

```powershell
# Terminal 1: API de cuestionarios con SQLite (puerto 3001)
cd server
pnpm run dev

# Terminal 2: visor web (puerto 5173)
cd web
pnpm run dev
```
Abre `http://localhost:5173` en el navegador. Si la API no está en marcha, el visor funciona igual con los cuestionarios incluidos, pero no guarda resultados ni permite crear o generar cuestionarios.

- Base de datos: SQLite en `server/data/atlas.db` (se crea solo) o **PostgreSQL** con `DATABASE_URL` en `server/.env`. Ver [docs/POSTGRESQL.md](docs/POSTGRESQL.md) (credenciales, migración de datos con `pnpm run migrate-sqlite`). `pnpm run seed` en `server/` restaura los cuestionarios iniciales.
- Tests de la API: `pnpm test` en `server/`.
- Primer administrador: `pnpm run create-admin -- <usuario>` en `server/` (pide la contraseña). El resto de cuentas se registran desde la web como estudiantes, y el administrador les cambia el rol en **Administración**.


## Despliegue en producción (VPS con Docker y Nginx)

El proyecto está diseñado para desplegarse fácilmente en un VPS modesto (incluso con 1 vCPU y 1 GB de RAM como Ubuntu 24.04):
- **API (Fastify + Node 24):** Corre en un contenedor Docker (
ode:24-alpine) con PostgreSQL o SQLite.
- **Visor (React + Three.js):** Se compila en tu máquina local y se sirve como archivos estáticos con **Nginx** (evitando consumir la RAM del VPS en la compilación).
- **HTTPS:** Automatizado con Let's Encrypt (Certbot).

### 1. En el VPS
1. **Configurar el entorno (/etc/atlas/api.env):**
   `ini
   HOST=127.0.0.1
   PORT=3001
   COOKIE_SECURE=1
   DB_CLIENT=postgres
   DATABASE_URL=postgres://usuario:contraseña@127.0.0.1:5432/atlas_db
   `
2. **Clonar y levantar la API con Docker:**
   `ash
   git clone https://github.com/stemensooh/atlas-anatomia-libre.git /opt/atlas
   cd /opt/atlas
   docker compose -f deploy/docker-compose.yml up -d --build
   `
3. **Crear el usuario administrador inicial:**
   `ash
   docker compose -f deploy/docker-compose.yml run --rm -it api \
     node --disable-warning=ExperimentalWarning src/create-admin.ts admin
   `
4. **Configurar Nginx y HTTPS:**
   `ash
   mkdir -p /var/www/atlas/releases
   cp deploy/nginx/atlas.stemensoft.com.conf /etc/nginx/sites-available/atlas.stemensoft.com
   ln -s /etc/nginx/sites-available/atlas.stemensoft.com /etc/nginx/sites-enabled/
   nginx -t && systemctl reload nginx
   certbot --nginx -d tu-dominio.com
   `

### 2. Desde tu máquina local (subir el visor web)
En la raíz de este repositorio, ejecuta el script de publicación:
`powershell
.\deploy\publicar-web.ps1 -Servidor root@TU_IP_DEL_VPS
`
Compila el frontend con Vite, empaqueta los assets 3D y los sube por SSH de forma atómica.

> Guía detallada con swap, respaldos automáticos de PostgreSQL con cron y solución de problemas en [docs/DESPLIEGUE.md](docs/DESPLIEGUE.md).

## Estructura
```
docs/        planificación, atribuciones y decisiones
data/raw/    descargas originales (no se editan; no se versionan)
data/processed/  modelos procesados (GLB)
data/metadata/   metadatos de estructuras
scripts/     automatización
web/         aplicación frontend
```

## Licencias
- Código: [MIT](LICENSE-CODE)
- Contenido (modelos, textos, documentación): [CC BY-SA 4.0](LICENSE-CONTENT)
- Recursos de terceros: ver [docs/ATTRIBUTIONS.md](docs/ATTRIBUTIONS.md)
