# Plan de adaptación a móvil (Fase 5B)

> Objetivo: que el atlas se use con comodidad en móviles y tablets **sin cambiar la experiencia de
> escritorio**. Va antes de la publicación (Fase 6), cuyo despliegue en el VPS queda en pausa.
> Registro de decisiones: D-018 en adelante, en `docs/DECISIONES.md`.

## Diagnóstico inicial (2026-10-21)

| Problema | Dónde | Efecto en móvil |
|---|---|---|
| Rejilla fija de 3 columnas (380 px + visor + 330 px), sin ninguna `@media` | `web/src/styles.css` (`.workspace`), `App.tsx` | Los paneles tapan el visor; en unos 390 px no cabe |
| Barra superior con unos 12 controles en una fila | `App.tsx` | Se desborda |
| `height: 100vh` | `.app-shell` | La barra del navegador móvil corta la parte inferior |
| Descarga inicial de 19,9 MB (masculino) o 52 MB (femenino) | `defaultEnabled` en `types.ts` | Datos, espera y riesgo de que el navegador se cierre por falta de memoria |
| Render hasta 2× de resolución | `<Canvas>` | GPU y batería |
| Girar el modelo con el dedo selecciona estructuras | `onClick` de las mallas | Falsos positivos, también en el modo clic 3D del quiz |
| Funciones solo para ratón: redimensionar el panel arrastrando, atajos de teclado, ayudas en `title` | `LayerPanel.tsx`, `App.tsx` | No funcionan o no se descubren en táctil |
| Modales y tablas anchas | Administración, Resultados | Se cortan |
| Campos con letra de menos de 16 px | Formularios | iOS hace zoom solo al tocarlos |

## Puntos de corte

| Ancho | Disposición |
|---|---|
| **< 768 px** (móvil) | Visor a pantalla completa, **barra de pestañas abajo** y **panel deslizante desde abajo** (oculto, medio o completo) |
| **768–1099 px** (tablet) | Visor más **un panel lateral plegable** a la derecha, con las mismas pestañas |
| **≥ 1100 px** (escritorio) | Igual que ahora, sin cambios |

## Etapas

### Etapa 1: Estructura adaptable ✅ (D-018)
- [x] `useMediaQuery`: los modos compacto y móvil se calculan en un solo sitio.
- [x] En móvil y tablet, los paneles pasan a un **panel deslizante** con asa (tocar o arrastrar cambia entre oculto, medio y completo). En tablet es un panel lateral.
- [x] **Barra de pestañas:** Capas · Ficha · Tours · Quiz. Tocar la pestaña activa pliega el panel.
- [x] Los paneles siguen montados aunque no se vean, para no perder el progreso del quiz ni el del tour.
- [x] Barra superior compacta: marca corta, cuenta como icono y menú ☰ con Pines, Tema y Créditos.
- [x] Botón flotante de **cámara** sobre el visor (vistas, Centrar y Mis vistas), en lugar de la barra de cámara.
- [x] `100dvh`, `viewport-fit=cover` y márgenes `safe-area-inset-*`; objetivos táctiles de al menos 44 px.
- [x] Sin el tirador para redimensionar el panel en móvil y tablet.
- [x] El escritorio no cambia (se comprueba a 1280 px y más).
- [x] Comprobado con emulación de dispositivo (Edge vía DevTools Protocol): sin desbordes a 375 y 390 px; asa probada con toques y deslizamientos táctiles; panel lateral en 768 px; escritorio sin cambios a 1280 px.

### Etapa 2: Interacción táctil ✅ (D-019)
- [x] Distinguir tocar de arrastrar: solo se selecciona si el puntero se movió 8 px o menos (`event.delta` de R3F). Corrige el quiz y también el escritorio con ratón.
- [x] Gestos de OrbitControls explícitos: un dedo gira; dos dedos hacen zoom y desplazan.
- [x] Sin hover con el dedo (el resaltado podía quedarse pegado).
- [x] Ayudas táctiles en la Ficha según `(pointer: coarse)`; sin atajos de teclado en los textos y sin el control de ancho del panel. Las acciones ya tienen texto visible (los iconos de ojo son estándar), así que no hace falta la pulsación larga.
- [x] Al tocar una estructura con el panel cerrado se abre la Ficha a media altura; durante un cuestionario se abre el cuestionario.
- [x] El resultado del quiz se desplaza a la vista al responder (también en escritorio).
- [x] Comprobado con toques y arrastres emulados (DevTools Protocol) en 390 px y con ratón en 1280 px.

### Etapa 3: Rendimiento y datos
- [ ] En móvil, arrancar solo con el esqueleto; los demás sistemas se cargan al activarlos y se avisa del tamaño.
- [ ] `dpr` limitado a 1,5, sin antialias en móvil y menos resolución durante la interacción.
- [ ] Respetar el ahorro de datos (`navigator.connection.saveData`) y las conexiones lentas.
- [ ] Caché de los `.glb` entre visitas.

### Etapa 4: Pantallas secundarias
- [ ] Modales a pantalla completa en móvil.
- [ ] Tablas de Administración y Resultados como tarjetas.
- [ ] Formularios con letra de 16 px, `inputmode` adecuado y botones grandes.
- [ ] El quiz, los tours y la ficha no tapan la pieza que se está viendo o preguntando.

### Etapa 5: Verificación
- [ ] Emulación en Chrome: iPhone SE (375 px), iPhone 14 (390 px), Pixel (412 px), iPad (768 y 1024 px), en vertical y horizontal.
- [ ] Prueba en un móvil real por la red local (`vite --host`).
- [ ] Regresión en escritorio.

## Criterio de salida
En un móvil de 375 px se puede, sin hacer zoom ni ver desbordes: abrir el atlas, activar sistemas,
seleccionar una estructura y leer su ficha, hacer un tour y un cuestionario completo, iniciar sesión
y guardar una vista. La primera carga en móvil no pasa de unos 10 MB.
