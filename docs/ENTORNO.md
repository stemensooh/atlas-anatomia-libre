# Entorno de desarrollo

Detectado el 2026-10-20 (Windows, PowerShell).

| Herramienta | Estado | Versión | Uso |
|---|---|---|---|
| Node.js | Instalado | v24.14.1 | Frontend y scripts de optimización (Fases 2-3) |
| npm / pnpm | Instalados | pnpm 11.17.0 | Gestor de paquetes elegido (`pnpm`) |
| Python | Instalado | 3.13.7 | Scripts de descarga, construcción GLB y catalogación |
| Git | Instalado | n/d | Control de versiones. Rama `main` |
| uv | **No instalado** | - | Opcional: gestor de entornos Python |
| Blender | **No instalado** | - | Opcional (solo Fase 7; la Fase 2 se resuelve con Python + `@gltf-transform`, ver D-006) |

Espacio libre en D: al momento de la revisión: unos 71 GB.

## Pendientes
- Ninguno para las Fases 2 y 3 (ya se usa `pnpm` con `@gltf-transform` y `meshoptimizer`).
