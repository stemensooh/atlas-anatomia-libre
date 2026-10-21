# Guía para agentes (traspaso de contexto)

Si eres un agente que continúa este proyecto, lee esto primero y luego `docs/PLAN_PROYECTO.md`.

## Qué es
Visor anatómico 3D libre, web, no comercial, hecho por STEMENSOFT para aprender. Stack previsto: TypeScript + React + Three.js (react-three-fiber) + Vite. Idioma de documentación y UI: español.

## Estado
- **Fase 0: cerrada.** Estructura, licencias y registro de atribuciones.
- **Fase 1: cerrada.** Licencias verificadas, modelos descargados en `data/raw/` (BodyParts3D v4.0 + HuBMAP 3D Reference Organs, ambos CC BY 4.0; `TA2.csv` de Z-Anatomy como referencia) y catalogados en `data/metadata/sources.csv`.
- **Fase 2: cerrada.** 10 archivos `.glb` masculinos y 10 femeninos optimizados con `meshopt` y validados en `data/processed/` + `data/processed/metadata.json` con 1.658 estructuras FMA masculinas, 956 estructuras femeninas y 87 órganos de HuBMAP (100 % traducidos al español).
- **Fase 3: cerrada** (despliegue pospuesto a la Fase 6 por D-009). Visor 3D en `web/` con capas por sistema, conmutador masculino/femenino, selección por raycasting, buscador y modal de atribuciones.
- **Fase 4: cerrada.** Funciones didácticas completas: 115+ descripciones anatómicas clave con `descriptionSource`, cortes en 3 ejes (Axial Y, Sagital X, Coronal Z), árbol anatómico jerárquico, pines 3D flotantes, 4 tours guiados, 2 cuestionarios interactivos (clic 3D + opción múltiple), modo claro/oscuro y atajos de teclado.
- **Fase 5: en curso (solo BD, D-011).** API `server/` (Fastify + SQLite `node:sqlite`) con cuestionarios en BD, generador por niveles (sin IA, D-012), editor manual e historial de intentos. Esquema v2 con `user_id` preparado para las cuentas. Faltan cuentas, vistas, notas y privacidad. **Se sigue con SQLite; no tocar PostgreSQL hasta que el usuario lo pida.**
- **Siguiente:** completar la Fase 5 (cuentas) o pasar a la Fase 6 (publicación y hosting). Ver `docs/PLAN_PROYECTO.md`.
- Rama `main` conectada a `origin` (`https://github.com/stemensooh/biodigital.git`).

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
Windows + PowerShell. Node 24, Python 3.13, pnpm 12. Ejecutar: `pnpm run dev` en `server/` (API, :3001) y en `web/` (visor, :5173). Blender y uv no están instalados. Ver `docs/ENTORNO.md`.

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
| `docs/COMO_AGREGAR_MODELOS_Y_TRADUCCIONES.md` | Guía para añadir nuevos modelos `.glb` y personalizar traducciones/definiciones en español |
| `CONTRIBUTING.md` | Reglas de aportes |
