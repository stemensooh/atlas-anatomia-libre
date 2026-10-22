# Registro de decisiones

Formato: una entrada corta por decisión, la más reciente arriba.

## 2026-10-21 · D-020 · Arranque ligero y render a demanda en dispositivos de bajo consumo (Fase 5B, etapa 3)
- **Contexto:** Al abrir el atlas se descargaban 6 sistemas (19,9 MB en el modelo masculino, 52 MB en el femenino) y el visor dibujaba 60 fotogramas por segundo con resolución de hasta 2× y antialias, incluso sin moverse nada. En un móvil eso supone datos, espera, calor y batería.
- **Decisión:**
  - **`web/src/data/devicePerf.ts`** calcula el perfil al cargar la página:
    - `LIGHT_START`: pantalla < 768 px, o ahorro de datos / 2G / 3G según `navigator.connection`.
    - `LOW_POWER`: pantalla < 1100 px o `pointer: coarse`.
  - **Arranque ligero:** solo el esqueleto. En móvil o con ahorro de datos, la lista de capas muestra el tamaño de cada sistema aún no descargado y un aviso que se puede cerrar. "Todos" pide confirmación si va a descargar más de 10 MB.
  - **Render ligero** (`LOW_POWER`): `dpr` [1, 1,5], sin antialias, `AdaptiveDpr` + `regress` en OrbitControls, y `frameloop="demand"`. Para que el render a demanda no se quede congelado, los efectos que modifican materiales o la cámara fuera de React llaman a `invalidate()`.
  - **Caché:** los `.glb` ya se cachean 7 días en producción con la configuración de Nginx (D-017). No se añade service worker.
- **Consecuencia:** Primera carga en móvil de unos 4,1 MB con gzip y 0 fotogramas en reposo. Comprobado con emulación: la selección, la activación de sistemas y los cambios de vista se dibujan correctamente. El escritorio con ratón no cambia.

## 2026-10-21 · D-019 · Interacción táctil: tocar frente a arrastrar y apertura de la ficha (Fase 5B, etapa 2)
- **Contexto:** Al girar el modelo con el dedo, el gesto terminaba sobre una malla y se seleccionaba. En el modo clic 3D del cuestionario, eso contaba como una respuesta. Con ratón pasaba lo mismo al soltar tras girar. Además, el hover se quedaba pegado con el dedo, y las ayudas hablaban de ratón y teclado.
- **Decisión:**
  - `onClick` de las mallas (sistemas y órganos HuBMAP) solo actúa si `event.delta` ≤ 8 px. La deselección al tocar el vacío ya la filtra R3F.
  - Sin hover con `pointerType === "touch"`. Gestos táctiles de OrbitControls explícitos: `ONE: ROTATE`, `TWO: DOLLY_PAN`.
  - El store cuenta las selecciones hechas en 3D (`pick3DSeq`). En móvil y tablet, con el panel cerrado, se abre la Ficha a media altura, o el cuestionario si es la pestaña activa.
  - `useCoarsePointer()`: ayudas táctiles en la Ficha y textos sin atajos de teclado. El control de ancho del panel lleva la clase `desktop-only`.
  - El resultado del cuestionario se desplaza a la vista cuando ya es visible: si el panel estaba cerrado, después de abrirse.
- **Consecuencia:** Se puede girar el modelo y responder el cuestionario con el dedo sin falsos positivos, y el escritorio gana el mismo filtro. Siguen las etapas 3 (peso y rendimiento), 4 (modales y tablas) y 5 (verificación en dispositivo real).

## 2026-10-21 · D-018 · Móvil y tablet: panel deslizante y barra de pestañas sin cambiar el escritorio (Fase 5B, etapa 1)
- **Contexto:** La interfaz era una rejilla fija de 3 columnas sin reglas para pantallas pequeñas, y en un móvil el visor no cabía. Plan en `docs/PLAN_MOVIL.md`.
- **Decisión:**
  - **Tres disposiciones** con `useLayout()` (matchMedia): **móvil** (< 768 px), **tablet** (768–1099 px) y **escritorio** (≥ 1100 px, sin cambios).
  - **Sin duplicar componentes:** los dos paneles van dentro de un contenedor `.sheet`. En escritorio es `display: contents` y los paneles siguen siendo columnas de la rejilla, con posición explícita. En móvil es un panel que sube desde abajo (oculto, medio o completo); en tablet, un panel lateral de hasta 400 px que estrecha el visor. Los paneles siguen montados aunque no se vean, para conservar el progreso del quiz y del tour.
  - **Barra de pestañas inferior** (Capas · Ficha · Tours · Quiz), que sustituye a las pestañas internas del panel derecho. Al entrar en Tours se aplica el paso actual, ya sea desde su pestaña o desde la barra.
  - **Barra superior compacta:** marca recortada con "…", cuenta como icono y menú ☰ con Pines, Tema y Créditos. Botón flotante de **cámara** con las vistas, Centrar y Mis vistas.
  - **Asa del panel:** sigue al dedo; tocarla alterna medio y completo, y deslizarla amplía, reduce o cierra. Llama a `preventDefault` en `pointerdown` porque, si no, los eventos de ratón de compatibilidad caían sobre el control que quedaba bajo el dedo tras cambiar de altura. Esto se detectó en las pruebas: un slider se movía solo.
  - `100dvh`, `viewport-fit=cover`, márgenes `safe-area-inset-*` y objetivos táctiles de al menos 44 px.
  - **Verificación con capturas:** Edge sin ventana, controlado por el DevTools Protocol desde un script de Node sin dependencias, con emulación de dispositivo y toques.
- **Consecuencia:** En 375, 390 y 768 px la interfaz cabe sin desbordes y el escritorio no cambia. Siguen pendientes, en las etapas 2–5: distinguir tocar de arrastrar en el modelo, el peso de la primera carga, los modales y las tablas.

## 2026-10-21 · D-017 · Publicación en VPS propio: API en Docker, visor estático en Nginx
- **Contexto:** El usuario tiene un VPS (Ubuntu 24.04, 1 vCPU, 1 GB de RAM, 25 GB) con Nginx y PostgreSQL ya instalados, y el subdominio `atlas.stemensoft.com`. Sustituye al hosting estático gratuito previsto en la Fase 6, porque desde la Fase 5 hay API y base de datos.
- **Decisión:**
  - **API en Docker** (`server/Dockerfile`, `node:24-alpine`, usuario `node`, solo dependencias de producción). Node 24 ejecuta el TypeScript directamente: no hay paso de compilación. El contexto es la raíz del repositorio, porque la API lee `data/processed/metadata.json` y `web/src/data/defaultQuizzes.json`; `server/Dockerfile.dockerignore` deja pasar solo esos archivos y `server/src`.
  - **`deploy/docker-compose.yml`:** `network_mode: host` (API en `127.0.0.1:3001`; PostgreSQL sigue solo en `localhost`, sin tocar `pg_hba.conf` y sin que Docker abra puertos saltándose UFW), `mem_limit: 256m`, heap de 192 MB, sistema de archivos de solo lectura, healthcheck en `/api/health`, logs rotados.
  - **Credenciales** solo en el VPS, en `/etc/atlas/api.env` (`600`), pasadas con `env_file`; nunca dentro de la imagen.
  - **Visor sin Docker:** se compila en el PC del desarrollador (en 1 GB de RAM `tsc -b` + `vite build` puede tumbar el VPS) y `deploy/publicar-web.ps1` lo sube por `scp` a `/var/www/atlas/releases/<fecha>`, con enlace atómico `current` y las 3 últimas versiones.
  - **Nginx del host** (`deploy/nginx/atlas.stemensoft.com.conf`): estáticos con caché (un año para `/assets`, 7 días para los `.glb`), gzip, proxy de `/api/` con `Host` y `X-Forwarded-Host` (los usa la protección CSRF). HTTPS con `certbot --nginx`; la API corre con `COOKIE_SECURE=1`.
  - **PostgreSQL** se queda en el host. Swap de 2 GB y copia diaria con `pg_dump` (14 días).
- **Consecuencia:** Guía completa en `docs/DESPLIEGUE.md`. El agente no se conecta al VPS ni maneja credenciales: los pasos en el servidor los ejecuta el usuario. Pendiente: probar la imagen (Docker Desktop no estaba en marcha al crearla) y hacer el primer despliegue.

## 2026-10-21 · D-016 · PostgreSQL además de SQLite, con el mismo código
- **Contexto:** El usuario pidió empezar la migración a PostgreSQL (que D-012 había pospuesto), mantener también SQLite y configurar él mismo las credenciales de su servidor. No las comparte ni se versionan.
- **Decisión:**
  - **Driver** `pg` (node-postgres, MIT). Para los tests, **PGlite** (`@electric-sql/pglite`, Apache-2.0): un PostgreSQL real que corre dentro de Node, sin servidor ni credenciales.
  - **Capa `server/src/sql.ts`** con una interfaz común (`query`, `one`, `execute`, `exec`, `tx`) para SQLite, pg y PGlite. El SQL de la app se escribe una vez, con marcadores `$n` (en SQLite pasan a `?n`) y reglas comunes:
    - fechas como texto ISO;
    - `TRUE`/`FALSE`;
    - JSON serializado;
    - `CAST(COUNT(*) AS INTEGER)`;
    - `RETURNING`;
    - `lower(username)` para que el nombre no distinga mayúsculas.
  - Toda la capa de datos (`db.ts`, `users.ts`, `library.ts`) pasa a ser asíncrona. En SQLite, un cerrojo impide que otra petición se cuele en una transacción abierta.
  - **Esquemas separados:**
    - `schema-sqlite.ts`: las migraciones v1–v4, sin cambios.
    - `schema-postgres.ts`: v1 equivalente a la v4 de SQLite, con `timestamptz`, `jsonb`, `boolean` e `identity`. Se registra en la tabla `schema_migrations` y se aplica bajo un bloqueo consultivo.
  - **Selección del motor:** `DB_CLIENT=sqlite|postgres`; por defecto, PostgreSQL si existe `DATABASE_URL`. Los scripts leen `server/.env` con `node --env-file-if-exists`, sin dependencias nuevas. En los logs, la conexión se muestra sin la contraseña.
  - **`pnpm run migrate-sqlite`** copia los datos de SQLite a un PostgreSQL sin usuarios, conserva ids y hashes, ajusta las secuencias y verifica los recuentos. No copia las sesiones ni modifica el archivo SQLite.
  - **`pnpm test`** ejecuta toda la batería con los dos motores (`test/run.ts`).
  - **Guía `docs/POSTGRESQL.md`:** usuario `atlas_app` con permisos mínimos, `.env`, TLS (`sslmode=require`) y qué hacer si se filtra la contraseña. `.gitignore` excluye `.env.*` salvo `.env.example`.
- **Consecuencia:** El mismo servidor funciona con los dos motores y los tests cubren ambos. El hosting podrá usar cualquiera de los dos.

## 2026-10-21 · D-015 · Renombrado a atlas-anatomia-libre, historial sin datos corporativos y atribución de Z-Anatomy corregida
- **Contexto:** Antes de hacer público el repositorio (Fase 6) se revisaron los riesgos legales. "biodigital" coincide con la marca de BioDigital, Inc., que tiene un visor anatómico 3D comercial (BioDigital Human); usarla en el mismo campo puede crear confusión de marca. Además, 5 commits tenían el nombre y el correo corporativos del autor. Por último, `ATTRIBUTIONS.md` decía que de Z-Anatomy solo se "consultaban" términos, pero `metadata.json` incluye nombres derivados de `TA2.csv` (D-006).
- **Decisión:**
  - **Nombre nuevo:** `atlas-anatomia-libre`, coherente con el título visible "Atlas Anatómico 3D Libre".
    - En el código: `server/data/atlas.db`, con renombrado automático del `biodigital.db` anterior y sus `-wal` y `-shm`.
    - Variables `ATLAS_DB` y `ATLAS_ADMIN_PASSWORD`.
    - Clave `atlas_left_width` en el navegador, leyendo también la anterior.
    - Se conservan las menciones a BioDigital que dicen que **no** se usan sus recursos.
  - **Historial:** se reescribió con `git filter-branch` (autor y committer `stemensooh <stemensooh@gmail.com>`) y se subió con `push --force-with-lease`. Este repositorio tiene esa identidad en su `.git/config`; la configuración global del equipo no se toca.
  - **Z-Anatomy:** `ATTRIBUTIONS.md` y el modal de Créditos indican que sus términos se usaron para `nameLa`/`nameEs` y que `metadata.json` va bajo CC BY-SA 4.0 (ShareAlike).
- **Consecuencia:** Los hashes de todos los commits cambiaron y cualquier copia anterior debe volver a clonarse. **Pendiente del usuario:** confirmar con su empleador la titularidad del código antes de publicarlo, porque se desarrolló en un equipo corporativo.

## 2026-10-21 · D-014 · Vistas guardadas, notas por estructura y resultados para el docente (cierre de la Fase 5)
- **Contexto:** Faltaban, de la Fase 5: guardar vistas, notas por estructura y que un docente vea los resultados de sus alumnos.
- **Decisión:**
  - **Migración v4.**
    - `saved_views` (id, user_id, nombre, `state` JSON y fechas).
    - `structure_notes` (clave primaria `(user_id, structure_id)`; los ids de estructura no se repiten entre los dos modelos).
    - Ambas con `ON DELETE CASCADE` hacia `users`, así que borrar la cuenta borra también vistas y notas.
  - **Vistas:**
    - El estado lo define la web (`web/src/data/viewState.ts`, `version: 1`): modo, sexo del modelo, órgano HuBMAP, capas (activa, opacidad y profundidad), modo de los sliders, selección, aislado, ocultos, cortes, pines, y posición y punto de mira de la cámara.
    - La cámara se lee desde fuera del Canvas con un puente (`cameraBridge`) y se aplica con `cameraView` en el store.
    - El servidor solo limita el tamaño (20 KB) y el número (100 por usuario).
    - Las vistas son privadas: las consultas filtran siempre por `user_id`.
  - **Notas:**
    - Una por estructura y usuario (máximo 5.000 caracteres y 2.000 notas). Una nota vacía se borra.
    - El servidor comprueba que la estructura exista en el catálogo.
    - Se editan en la Ficha y se listan en Mi perfil, desde donde se puede saltar a la estructura.
  - **Resultados:**
    - Nuevo permiso `results`: el docente dueño del cuestionario o un admin.
    - `GET /api/quizzes/:id/results` devuelve el resumen, una fila por alumno (intentos, mejor, último y media) y el porcentaje de aciertos por pregunta con los 3 errores más comunes.
    - Solo cuenta intentos de usuarios registrados.
    - Se actualiza la pantalla de Privacidad para explicar que el docente ve los resultados en sus cuestionarios.
- **Consecuencia:** Se cumple el criterio de salida de la Fase 5. La migración a PostgreSQL sigue pospuesta hasta que el usuario lo indique (D-012).

## 2026-10-21 · D-013 · Autenticación propia con sesiones en SQLite, tres roles y cuestionarios privados
- **Contexto:** Fase 5. El usuario eligió: roles admin, docente y estudiante; sin sesión se puede ver y jugar pero no guardar; registro libre solo con usuario y contraseña; los cuestionarios de los usuarios son privados hasta que un docente o admin los publica. Se sigue con SQLite (D-012).
- **Decisión:**
  - **Sin dependencias nuevas.** Contraseñas con `scrypt` de `node:crypto` (N=2^15, r=8, p=1, sal de 16 bytes; los parámetros se guardan en el hash). Sesiones con un token aleatorio de 32 bytes en una cookie `bd_session` `HttpOnly` + `SameSite=Strict` (+ `Secure` con `COOKIE_SECURE=1`), de 30 días. En la BD solo se guarda el SHA-256 del token.
  - **Migración v3:** tablas `users` (nombre sin distinguir mayúsculas, rol, activo, alta y último acceso) y `sessions`. `quizzes` y `quiz_attempts` se reconstruyen para que `user_id` sea clave foránea con `ON DELETE CASCADE` (borrar una cuenta borra sus datos), y se añade `is_public`. Lo anterior a las cuentas queda sin dueño y público. Las migraciones se ejecutan con las claves foráneas desactivadas y `PRAGMA foreign_key_check` al final.
  - **Accesos** (`server/src/access.ts`):
    - **Sin sesión:** ve y juega los cuestionarios públicos.
    - **Estudiante:** además guarda intentos, genera cuestionarios privados y borra los suyos.
    - **Docente:** además crea y edita a mano, y publica u oculta los suyos.
    - **Admin:** todo sobre cualquier cuestionario y gestión de usuarios.
    - El servidor envía `permissions` en cada cuestionario y la web solo muestra lo permitido. Cada usuario ve solo su historial.
  - **Seguridad:**
    - Bloqueo tras 5 fallos de login por IP y usuario en 15 min.
    - Se verifica siempre un hash, aunque el usuario no exista, para que el tiempo de respuesta no lo delate.
    - **CSRF:** las peticiones que cambian datos deben traer un `Origin` igual al host (o a `X-Forwarded-Host` detrás de un proxy). El proxy de Vite usa `changeOrigin: false` para conservar el `Host`.
    - Cambiar o restablecer la contraseña cierra las otras sesiones.
    - Nunca se queda el sistema sin un admin activo.
  - **Primer administrador:** `pnpm run create-admin -- <usuario>` pide la contraseña sin mostrarla (o la lee de `ATLAS_ADMIN_PASSWORD`).
  - **Pantallas:**
    - Iniciar sesión / Crear cuenta.
    - Menú de usuario en la barra superior.
    - Mi perfil: historial, cambiar contraseña y borrar la cuenta.
    - Administración de usuarios: rol, activar/desactivar, restablecer contraseña y borrar.
    - Privacidad: qué se guarda y qué no.
  - Sin recuperación por correo (no se pide email): la contraseña la restablece un admin.
- **Consecuencia:** Se cumple el criterio de salida de la Fase 5 salvo "guardar una vista": un usuario puede registrarse y recuperar sus resultados. Pendiente: vistas y notas por estructura, y que un docente vea los resultados de sus alumnos.

## 2026-10-21 · D-012 · Generador por niveles calculados desde los GLB, columna user_id y SQLite como única BD
- **Contexto:** El generador de D-011 elegía estructuras al azar con una sola plantilla. Podía tocar piezas diminutas o **grupos sin malla propia**, como los 22 grupos femeninos de HuBMAP (por ejemplo `VH_F_femur_L`), imposibles de acertar con un clic. El usuario pidió mejorarlo sin IA y preparar los cuestionarios para la autenticación. Indicó también que se siga con SQLite y que no se haga nada con PostgreSQL hasta que lo pida.
- **Decisión:**
  - `server/src/catalog.ts` lee solo el bloque JSON de cada `.glb`, sin descomprimir la geometría meshopt. Con los `min/max` de los accessors y la escala y traslación de cada nodo calcula, para cada estructura, si tiene malla, su dimensión mayor, su **dimensión intermedia** (lo fácil que es acertar con un clic) y su **región** corporal (según la altura del centro).
  - Tres niveles de dificultad:
    - **básico:** dimensión intermedia de 3 cm o más, sin los "Conjunto de…" y sin repetir la estructura simétrica.
    - **intermedio:** 1 cm o más.
    - **avanzado:** todas, con distractores parecidos (mismo padre, palabras o región en común).
  - Varias plantillas de enunciado (5 de clic 3D y 4 de opción múltiple). Las pistas combinan sistema, tamaño, región, lado y estructura padre; en opción múltiple dan la inicial del nombre en lugar de la ubicación.
  - La validación rechaza preguntas manuales sobre grupos sin malla.
  - **Migración v2:** columna `user_id INTEGER` (admite NULL) en `quizzes` y `quiz_attempts`, con índices. NULL significa "sin dueño": los cuestionarios incluidos y los datos anteriores a las cuentas. La tabla `users` y la clave foránea se añadirán con la autenticación. Las migraciones van en una lista versionada con `PRAGMA user_version`.
  - **SQLite sigue siendo la única BD.** No se añade nada de PostgreSQL; el SQL se mantiene estándar en lo posible para facilitar una futura migración.
- **Consecuencia:** Los cuestionarios generados son jugables y tienen dificultad controlada, y las tablas quedan listas para asociar cuestionarios e intentos a usuarios. Limitaciones conocidas:
  - La región se calcula desde el centro de la caja, así que las estructuras alargadas o en el límite entre regiones pueden recibir una región aproximada (por ejemplo, cartílagos costales bajos → "abdomen").
  - Algunos nombres del catálogo siguen sin traducir del todo.

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
