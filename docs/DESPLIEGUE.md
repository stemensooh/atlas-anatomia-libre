# Despliegue en VPS — atlas.stemensoft.com

Guía de la Fase 6 (decisión **D-017**). Pensada para un VPS pequeño con **Ubuntu 24.04, 1 vCPU, 1 GB de RAM, Nginx y PostgreSQL ya instalados en el host**.

```mermaid
flowchart LR
  U["Navegador"] -->|HTTPS 443| N["Nginx (host) + Let's Encrypt"]
  N -->|"/ (estático)"| D["/var/www/atlas/current"]
  N -->|"/api/ → 127.0.0.1:3001"| A["Docker: API Fastify (Node 24)"]
  A -->|127.0.0.1:5432| P["PostgreSQL (host)"]
```

| Pieza | Dónde corre | Cómo se actualiza |
|---|---|---|
| Visor (`web/`) | Archivos estáticos servidos por Nginx | Se **compila en tu PC** y se sube con `deploy/publicar-web.ps1` |
| API (`server/`) | Contenedor Docker (`deploy/docker-compose.yml`), red `host` | `git pull` + `docker compose up -d --build` en el VPS |
| PostgreSQL | Host, sin cambios | — |

> [!IMPORTANT]
> Las credenciales **solo** existen en el VPS, en `/etc/atlas/api.env` (permisos `600`). Nunca las subas al repositorio ni las pegues en un chat.

> [!NOTE]
> El visor no se compila en el VPS: `tsc -b` + `vite build` con Three.js puede superar 1 GB de RAM y tumbar el servidor (incluido PostgreSQL).

En los comandos, `usuario` es tu usuario de SSH en el VPS (no root).

---

## 1. DNS

En el panel de tu dominio, crea un registro **A**: `atlas` → IP pública del VPS (y **AAAA** si tiene IPv6). Comprueba desde tu PC:

```powershell
Resolve-DnsName atlas.stemensoft.com
```

## 2. Swap de 2 GB (una vez)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-swappiness.conf
sudo sysctl --system
free -h
```

## 3. Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable
sudo ufw status
```

PostgreSQL (5432) y la API (3001) **no** se abren: solo escuchan en `127.0.0.1`.

## 4. Docker Engine (repositorio oficial)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo docker run --rm hello-world
```

Usaremos `sudo docker …` (no hace falta añadir tu usuario al grupo `docker`, que equivale a dar acceso root).

## 5. Base de datos y usuario de la app

Si aún no existen, sigue el **paso 1 de [`POSTGRESQL.md`](POSTGRESQL.md)** en el VPS (`sudo -u postgres psql`): base `atlas`, usuario `atlas_app` con permisos mínimos. La API crea las tablas sola al arrancar.

Como el contenedor usa la red del host, PostgreSQL puede seguir con `listen_addresses = 'localhost'` y no hay que tocar `pg_hba.conf`.

## 6. Archivo de entorno de producción

```bash
sudo mkdir -p /etc/atlas
sudo nano /etc/atlas/api.env
```

Contenido (sustituye la contraseña **en el VPS**; caracteres especiales codificados, ver `POSTGRESQL.md`):

```ini
HOST=127.0.0.1
PORT=3001
COOKIE_SECURE=1
DB_CLIENT=postgres
DATABASE_URL=postgres://atlas_app:CONTRASEÑA@127.0.0.1:5432/atlas
```

```bash
sudo chown root:root /etc/atlas/api.env
sudo chmod 600 /etc/atlas/api.env
```

## 7. Código y arranque de la API

```bash
sudo mkdir -p /opt/atlas && sudo chown "$USER": /opt/atlas
git clone https://github.com/stemensooh/atlas-anatomia-libre.git /opt/atlas
cd /opt/atlas
sudo docker compose -f deploy/docker-compose.yml up -d --build
sudo docker compose -f deploy/docker-compose.yml logs -f api      # Ctrl+C para salir
curl -s http://127.0.0.1:3001/api/health                            # {"ok":true,"quizzes":…}
```

Al primer arranque la API crea el esquema y carga los cuestionarios iniciales.

> [!NOTE]
> Si el repositorio es privado, clónalo con una *deploy key* de solo lectura (GitHub → Settings → Deploy keys).

### Primer administrador

```bash
cd /opt/atlas
sudo docker compose -f deploy/docker-compose.yml run --rm -it api \
  node --disable-warning=ExperimentalWarning src/create-admin.ts TU_USUARIO
```

Pide la contraseña sin mostrarla.

## 8. Carpeta del visor

```bash
sudo mkdir -p /var/www/atlas/releases
sudo chown -R "$USER": /var/www/atlas
```

Desde **tu PC**, en la raíz del repositorio (usa tu clave SSH):

```powershell
.\deploy\publicar-web.ps1 -Servidor usuario@IP_DEL_VPS
```

Compila `web/`, sube el paquete (~100 MB), lo activa en `/var/www/atlas/current` y conserva las 3 últimas versiones.

## 9. Nginx y HTTPS

```bash
cd /opt/atlas
sudo cp deploy/nginx/atlas.stemensoft.com.conf /etc/nginx/sites-available/atlas.stemensoft.com
sudo ln -s /etc/nginx/sites-available/atlas.stemensoft.com /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d atlas.stemensoft.com --redirect
sudo certbot renew --dry-run
```

Certbot añade el bloque HTTPS al mismo archivo y programa la renovación.

## 10. Verificación

- `https://atlas.stemensoft.com` carga el visor y los modelos.
- `https://atlas.stemensoft.com/api/health` devuelve `{"ok":true,…}`.
- Registrarse e iniciar sesión funciona (la cookie lleva `Secure`).
- `free -h` y `sudo docker stats --no-stream` muestran memoria holgada.

---

## Actualizar

| Cambió… | Dónde | Comando |
|---|---|---|
| API (`server/`) o `metadata.json` / cuestionarios iniciales | VPS | `cd /opt/atlas && git pull && sudo docker compose -f deploy/docker-compose.yml up -d --build && sudo docker image prune -f` |
| Visor (`web/`) o modelos `.glb` | Tu PC | `.\deploy\publicar-web.ps1 -Servidor usuario@IP_DEL_VPS` |
| Configuración de Nginx | VPS | Copiar el archivo de nuevo **sin** pisar lo que añadió certbot (o editar a mano), `sudo nginx -t && sudo systemctl reload nginx` |

**Volver a la versión anterior del visor:** `ln -sfn /var/www/atlas/releases/<versión-anterior> /var/www/atlas/current`.

## Copias de seguridad de PostgreSQL

```bash
sudo mkdir -p /var/backups/atlas
sudo tee /etc/cron.daily/atlas-pg-backup > /dev/null <<'EOF'
#!/bin/sh
set -e
sudo -u postgres pg_dump -Fc atlas > /var/backups/atlas/atlas-$(date +%F).dump
find /var/backups/atlas -name 'atlas-*.dump' -mtime +14 -delete
EOF
sudo chmod 700 /etc/cron.daily/atlas-pg-backup
sudo /etc/cron.daily/atlas-pg-backup && ls -lh /var/backups/atlas
```

Restaurar: `sudo -u postgres pg_restore --clean -d atlas /var/backups/atlas/atlas-AAAA-MM-DD.dump`. Copia también los `.dump` fuera del VPS de vez en cuando.

## Problemas frecuentes

| Síntoma | Causa probable | Solución |
|---|---|---|
| `502 Bad Gateway` en `/api/` | La API no está en marcha | `sudo docker compose -f deploy/docker-compose.yml ps` y `logs api` |
| `ECONNREFUSED 127.0.0.1:5432` | PostgreSQL parado | `sudo systemctl status postgresql` |
| `password authentication failed` | `DATABASE_URL` incorrecta | Revisa `/etc/atlas/api.env` (caracteres especiales codificados) y reinicia: `… up -d` |
| `403` al iniciar sesión | `Origin` ≠ host | Comprueba que Nginx envía `Host`/`X-Forwarded-Host` y que entras por `https://atlas.stemensoft.com` |
| La sesión no se mantiene | `COOKIE_SECURE=1` sin HTTPS | Termina el paso 9 (certbot) |
| El contenedor se reinicia (`OOMKilled`) | Memoria insuficiente | `sudo docker inspect atlas-api-1 --format '{{.State.OOMKilled}}'`; sube `mem_limit` en el compose |
