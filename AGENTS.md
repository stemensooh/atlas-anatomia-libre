# Guía para agentes (traspaso de contexto)

Si eres un agente que continúa este proyecto, lee esto primero y luego `docs/PLAN_PROYECTO.md`.

## Qué es
Visor anatómico 3D libre, web, no comercial, hecho por STEMENSOFT para aprender. Stack previsto: TypeScript + React + Three.js (react-three-fiber) + Vite. Idioma de documentación y UI: español.

## Estado
- **Fase 0: cerrada.** Estructura, licencias y registro de atribuciones.
- **Fase 1: cerrada.** Licencias verificadas, modelos descargados en `data/raw/` (BodyParts3D v4.0 + HuBMAP 3D Reference Organs, ambos CC BY 4.0; `TA2.csv` de Z-Anatomy como referencia) y catalogados en `data/metadata/sources.csv`.
- **Siguiente: Fase 2** (procesamiento de modelos, agrupación por sistemas y generación de `metadata.json`). Ver `docs/PLAN_PROYECTO.md`.
- Rama `main`. No hay remoto; se configura en la Fase 6. No hagas push.

## Reglas obligatorias
1. **Licencias separadas:** código = MIT (`LICENSE-CODE`); contenido = CC BY-SA 4.0 (`LICENSE-CONTENT`). No mezcles carpetas.
2. **Antes de descargar o usar cualquier recurso de terceros:** verifica su licencia en la página oficial y regístralo en `docs/ATTRIBUTIONS.md`. Sigue `docs/ATTRIBUTION_HOWTO.md`.
3. **Prohibido:** recursos NC, ND, sin licencia explícita o propietarios (BioDigital, Visible Body, Complete Anatomy, etc.). No extraigas modelos de sitios comerciales.
4. Las licencias del plan están escritas de memoria y marcadas "a verificar". **No las des por válidas** sin confirmarlas.
5. `data/raw/` no se edita ni se versiona (solo `SOURCE.txt` y licencias). Cada descarga lleva `SOURCE.txt` con URL, fecha y SHA-256.
6. Las decisiones técnicas se anotan en `docs/DECISIONES.md`.
7. No instales software global (Blender, uv...) sin pedir permiso al usuario.
8. No uses licencias comerciales: el proyecto es de aprendizaje y libre.

## Entorno
Windows + PowerShell. Node 24, Python 3.13, pnpm. Blender y uv no están instalados. Ver `docs/ENTORNO.md`.

## Cómo trabajar con el usuario
- Responder en español, de forma concisa.
- Para tareas grandes: planificar primero y pedir aprobación.
- Al terminar cada fase: actualizar `docs/PLAN_PROYECTO.md` (casillas `[x]`), `docs/ATTRIBUTIONS.md` y `docs/DECISIONES.md`.

## Mapa de archivos clave
| Archivo | Para qué |
|---|---|
| `docs/PLAN_PROYECTO.md` | Plan por fases (fuente de verdad) |
| `docs/ATTRIBUTIONS.md` | Registro de fuentes y licencias |
| `docs/ATTRIBUTION_HOWTO.md` | Procedimiento de verificación |
| `docs/DECISIONES.md` | Registro de decisiones |
| `docs/ENTORNO.md` | Herramientas instaladas y pendientes |
| `CONTRIBUTING.md` | Reglas de aportes |
