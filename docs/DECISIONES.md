# Registro de decisiones

Formato: una entrada corta por decisión, la más reciente arriba.

## 2026-10-20 · D-006 · Pipeline de Fase 2 directo con Python + glTF-Transform (sin Blender)
- **Contexto:** Al usar BodyParts3D (`.obj` con IDs FMA en cabecera) y HuBMAP (`.glb` con `crosswalk.csv`), no hace falta abrir un archivo `.blend` de Z-Anatomy.
- **Decisión:**
  - Construir los 10 archivos `.glb` por sistema anatómico (`skeletal`, `muscular`, `circulatory`, `nervous`, `digestive`, `respiratory`, `urinary`, `reproductive`, `lymphatic`, `integumentary`) mediante `scripts/fase2_construir_glb.py`, uniendo las 2.234 mallas elementales `FJ*.obj` en las **1.659 estructuras FMA únicas**, convirtiendo coordenadas de `mm Z-up` a `m Y-up` e inyectando créditos `CC BY 4.0` en `asset.copyright`.
  - Optimizar, cuantizar y comprimir con `EXT_meshopt_compression` y validar con `gltf-validator` en `scripts/optimize.mjs` (gestionado con `pnpm`).
  - Generar `data/processed/metadata.json` cruzando BodyParts3D + HuBMAP + traducciones de `TA2.csv`.
- **Consecuencia:** Pipeline 100 % reproducible por línea de comandos sin requerir instalación global de Blender.

## 2026-10-20 · D-005 · Confirmación de supuestos iniciales (Sección 0)
- **Contexto:** Revisión de los supuestos base de `docs/PLAN_PROYECTO.md` al iniciar la Fase 1.
- **Decisión:** Se confirman los supuestos de la sección 0: plataforma web (escritorio primero), stack TypeScript + React + Three.js (`react-three-fiber`) + Vite, sin backend inicial (sitio estático), UI en español con respaldo en latín/inglés y presupuesto \$0.
- **Consecuencia:** Se mantiene la arquitectura prevista para las Fases 2 y 3.

## 2026-10-20 · D-004 · Fuentes 3D base: BodyParts3D + HuBMAP (ambas CC BY 4.0); mallas de Z-Anatomy descartadas
- **Contexto:** Al verificar las licencias oficiales en la Fase 1:
  1. `License.txt` de Z-Anatomy declara CC BY-SA 4.0 global, pero incluye modelos adaptados bajo licencias **no comerciales** (*"Anatomy of the Inner Ear"* CC BY-NC-SA 4.0 y *"Kidney"* CC BY-NC 4.0) y otros sin licencia explícita (*"Brainder"* / *"White matter"*), lo que incumple la regla 3 del proyecto.
  2. El archivo oficial de BodyParts3D en NBDC/DBCLS actualizó su licencia el 2025-02-27 a **CC BY 4.0** (antes CC BY-SA 2.1 JP).
  3. La librería de órganos 3D de referencia de HuBMAP (masculinos y femeninos) está publicada directamente en `.glb` bajo **CC BY 4.0** con mapeos a UBERON/FMA (`crosswalk.csv`).
- **Decisión:**
  - Usar **BodyParts3D v4.0** (conjuntos `isa_BP3D_4.0_obj_99` y `partof_BP3D_4.0_obj_99`) y **HuBMAP 3D Reference Object Library** (órganos masculinos y femeninos) como únicas fuentes de mallas 3D.
  - Descargar de **Z-Anatomy** únicamente `TA2.csv`, `Readme.md` y `License.txt` como referencia de nomenclatura y traducción (sin usar sus mallas `.blend`/`.zip` ni redistribuir la tabla TA2 completa).
- **Consecuencia:** Todas las mallas fuente del proyecto son **CC BY 4.0** limpias (sin cláusulas NC ni ND), compatibles con nuestra licencia de contenido y además los órganos de HuBMAP ya vienen en formato `.glb`.

## 2026-10-20 · D-003 · Rama main, titular STEMENSOFT, remoto en Fase 6
- **Decisión:** rama principal `main`; copyright de código y contenido original a nombre de STEMENSOFT; el repositorio remoto se configura en la Fase 6.
- **Consecuencia:** no se hace push hasta entonces.

## 2026-10-20 · D-002 · Licencia del código: MIT
- **Contexto:** proyecto de aprendizaje, libre y no comercial.
- **Decisión:** el código usa MIT (`LICENSE-CODE`).
- **Consecuencia:** compatible con las dependencias MIT/BSD/Apache. El contenido tiene licencia aparte.

## 2026-10-20 · D-001 · Código y contenido con licencias separadas
- **Contexto:** Z-Anatomy y BodyParts3D usan CC BY-SA (ShareAlike).
- **Decisión:** el contenido derivado va bajo CC BY-SA 4.0 (`LICENSE-CONTENT`). El código no se mezcla con él.
- **Consecuencia:** el ShareAlike del contenido no afecta al código.
