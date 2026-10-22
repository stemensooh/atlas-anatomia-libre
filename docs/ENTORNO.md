# Entorno de desarrollo

Detectado el 2026-10-20 (Windows, PowerShell).

| Herramienta | Estado | Versión | Uso |
|---|---|---|---|
| Node.js | Instalado | v24.14.1 | Frontend y scripts de optimización (Fases 2-3) |
| npm / pnpm | Instalados | pnpm 12.14.0 (2026-10-21, `npm install -g pnpm`; `corepack enable` falla sin permisos de administrador) | Gestor de paquetes elegido (`pnpm`) |
| SQLite | Integrado en Node 24 (`node:sqlite`) | - | BD de la API (`server/`), motor por defecto sin `DATABASE_URL` |
| PostgreSQL | Servidor propio del usuario (no se instala en este equipo) | - | BD de la API con `DB_CLIENT=postgres` + `DATABASE_URL` en `server/.env` (ver `docs/POSTGRESQL.md`, D-016) |
| Docker Desktop | Instalado (no se usa por ahora) | 29.4 | Opcional |
| Python | Instalado | 3.13.7 | Scripts de descarga, construcción GLB y catalogación |
| Git | Instalado | n/d | Control de versiones. Rama `main` |
| uv | **No instalado** | - | Opcional: gestor de entornos Python |
| Blender | **No instalado** | - | Opcional (solo Fase 7; la Fase 2 se resuelve con Python + `@gltf-transform`, ver D-006) |

Espacio libre en D: al momento de la revisión: unos 71 GB.

## Pendientes
- Ninguno para las Fases 2 y 3 (ya se usa `pnpm` con `@gltf-transform` y `meshoptimizer`).
