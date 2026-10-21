# Registro de decisiones

Formato: una entrada corta por decisión, la más reciente arriba.

## 2026-10-21 · D-011 · Fase 5 (parcial): API de cuestionarios con Fastify + SQLite, sin cuentas
- **Contexto:** El usuario pidió empezar la Fase 5 solo con base de datos: guardar los cuestionarios en SQLite y poder generar nuevos. Las cuentas y la autenticación quedan fuera por ahora. Además, la revisión del quiz encontró que se podían sumar puntos sin acertar: "Mostrar respuesta" contaba como acierto, cualquier selección (buscador, árbol) contaba como clic 3D y se podía volver a contestar una pregunta. También había formas de ver la respuesta antes de contestar: la opción correcta siempre era la primera y las etiquetas de los pines 3D mostraban el nombre.
- **Decisión:**
  - Nuevo paquete `server/` (MIT): **Node 24 + Fastify 5** (MIT) y el módulo integrado **`node:sqlite`** (SQLite, dominio público). No necesita compilar módulos nativos ni instalar software global. Node ejecuta el TypeScript directamente, sin paso de compilación.
  - BD en `server/data/biodigital.db` (no se versiona). Tres tablas: `quizzes`, `questions` y `quiz_attempts`; el esquema se versiona con `PRAGMA user_version`. Si la BD está vacía, al arrancar se cargan los cuestionarios de `web/src/data/defaultQuizzes.json`, que la web también usa como respaldo sin servidor.
  - API REST bajo `/api` (Vite la reenvía al puerto 3001). Permite listar, crear, editar y borrar cuestionarios, generarlos y guardar y consultar intentos. Cada pregunta se valida contra `data/processed/metadata.json` y el servidor rechaza intentos cuya puntuación no cuadre con las respuestas.
  - **Generador:** elige N estructuras al azar de los sistemas y del sexo escogidos, sin nombres repetidos. Las preguntas pueden ser de clic 3D, de opción múltiple o mixtas, con 3 distractores del mismo sistema. La pista indica sistema y lado; la explicación sale de `descriptionEs`.
  - **Editor manual** en la web (`QuizEditor.tsx`) y nuevo panel `QuizPanel.tsx` separado de `InfoPanel.tsx`.
  - **Correcciones:** solo cuenta el clic directo en el modelo 3D (`pickStructure3D`); se guarda una respuesta por pregunta; las opciones se muestran desordenadas; los pines se ocultan durante el cuestionario.
- **Consecuencia:** Los cuestionarios y su historial de intentos se guardan en SQLite y la web sigue funcionando sin servidor. Para pasar a PostgreSQL o añadir cuentas basta con cambiar la capa `server/src/db.ts`.

## 2026-10-21 · D-010 · Subnodos jerárquicos multinivel en el árbol anatómico con cascada estricta de visibilidad
- **Contexto:** En el árbol anatómico, la navegación plana de cientos de estructuras por sistema resultaba poco didáctica. Se requería una jerarquía multinivel análoga a Z-Anatomy (`Sistema → Regiones/Subnodos → Subgrupos → Estructuras`), preservando la regla estricta de que un nodo padre desmarcado desmarca a todos sus descendientes, y que la selección de un hijo desmarcado aísla ese único elemento sin activar a sus hermanos.
- **Decisión:**
  - Crear el módulo `web/src/data/hierarchyData.ts` que clasifica automáticamente el 100 % de las estructuras anatómicas (masculinas y femeninas) en subregiones naturales (ej. esqueleto: Cráneo y cara, Columna vertebral, Caja torácica, Miembro superior [Hombro y brazo, Antebrazo, Mano y dedos], Pelvis y miembro inferior [Pelvis y muslo, Pierna, Pie y dedos]).
  - Implementar en `web/src/components/LayerPanel.tsx` un renderizado recursivo con subnodos colapsables, contadores visibles/totales, botones de alternancia `[Eye / EyeOff]` y controles independientes por nivel.
  - Aplicar la cascada estricta: si un nodo padre (sistema o subnodo) está desactivado, todos sus hijos se visualizan desmarcados (`EyeOff` y `.is-hidden`). Al hacer clic en un hijo u órgano desmarcado, se visualiza en 3D exclusivamente ese elemento (y su ruta de ancestros con su contador respectivo), manteniendo ocultos a todos los demás hermanos.
- **Consecuencia:** La exploración anatómica en el árbol es limpia, jerárquica y 100 % fiel a la pedagogía de Z-Anatomy.

## 2026-10-20 · D-009 · Cierre de Fase 4 (Funciones didácticas) y aplazamiento del hosting a Fase 6
- **Contexto:** Antes de desplegar en un hosting público es necesario ajustar de dónde se servirán los archivos pesados (`data/processed/` y `data/raw/hubmap/`). Mientras tanto se priorizó completar todas las herramientas didácticas de la Fase 4.
- **Decisión:**
  - Posponer el despliegue en hosting gratuito hasta la Fase 6.
  - Incorporar en `scripts/traductor_es.py` y `data/processed/metadata.json` más de 115 descripciones fisiológicas y morfológicas detalladas de redacción propia (`STEMENSOFT, CC BY-SA 4.0`) con el campo `descriptionSource`.
  - Implementar en el visor (`web/src/`): 3 planos de corte anatómico (`Axial Y`, `Sagital X`, `Coronal Z` con inversión), árbol jerárquico por sistema, pines 3D flotantes (`@react-three/drei`), 4 tours guiados interactivos, 2 cuestionarios (combinando búsqueda por clic directo en el modelo 3D y opción múltiple), tema claro/oscuro y atajos de teclado (`R`, `I`, `H`, `L`, `Esc`).
- **Consecuencia:** El visor cuenta ya con todas las funciones de estudio de la Fase 4 listas en local.

## 2026-10-20 · D-008 · Incorporación del cuerpo femenino por sistemas y traducción íntegra al español
- **Contexto:** Algunas estructuras compuestas de FMA/UBERON conservaban términos en inglés (como `ventricle` o conectores `of`) cuando no tenían coincidencia literal en `TA2.csv`, y se requería además contar con el cuerpo femenino completo por capas en el visor principal.
- **Decisión:**
  - Crear `scripts/traductor_es.py` y `scripts/actualizar_metadata_es.py` para traducir el 100 % de los nombres (`nameEs`) y generar definiciones anatómicas educativas en español (`descriptionEs`) para todas las estructuras masculinas, femeninas y de HuBMAP.
  - Extraer de `data/raw/hubmap/united-female/3d-vh-f-united.glb` los 10 sistemas anatómicos femeninos (`data/processed/female_<system>.glb`, 956 estructuras) mediante `scripts/procesar_femenino.mjs`, alineados en `y = 0` y comprimidos con `meshopt`.
  - Documentar el flujo en `docs/COMO_AGREGAR_MODELOS_Y_TRADUCCIONES.md`.
- **Consecuencia:** El visor permite alternar entre **♂ Cuerpo Masculino** y **♀ Cuerpo Femenino** con las mismas 10 capas, buscador y fichas 100 % en español.

## 2026-10-20 · D-007 · Visor MVP (Fase 3) en `web/` sirviendo `data/processed/` sin duplicar modelos
- **Contexto:** Para cumplir la separación estricta entre código (`MIT` en `web/`) y contenido (`CC BY-SA 4.0` en `data/processed/`), los `.glb` no deben mezclarse con el código fuente.
- **Decisión:** Configurar un plugin en `web/vite.config.ts` que sirve `/data/processed/*` y `/data/raw/hubmap/*` en desarrollo directamente desde `../data/` y copia `data/processed/` a `dist/data/processed/` en el build de producción. Se usa `GLTFLoader` + `MeshoptDecoder` para descomprimir en cliente los `.glb` optimizados en la Fase 2.
- **Consecuencia:** Se evita duplicar los 34,65 MB de `.glb` dentro de `web/` y el visor carga por sistema bajo demanda.

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
