# Plan de app instalable (PWA) (Fase 5C)

> Objetivo: que el atlas se **instale** como una app (icono en la pantalla de inicio, pantalla
> completa, sin barra del navegador) y se pueda **usar sin conexión** con los modelos ya
> descargados, **sin tiendas de apps ni coste** y reutilizando todo el código actual.
> Rama de trabajo: `feat/pwa`. Decisiones: D-023 en adelante, en `docs/DECISIONES.md`.

## Por qué una PWA (y no una app de tienda)

| | PWA (este plan) | Capacitor (Google Play / App Store) |
|---|---|---|
| Código | El mismo, más manifiesto y *service worker* | El mismo, más un proyecto nativo por plataforma |
| Coste | **$0** | Google Play: unos 25 USD una vez; App Store: unos 99 USD al año + un Mac |
| Autenticación | Sin cambios (mismo origen, cookie `SameSite=Strict`) | Hay que añadir sesión por token (otro origen) |
| Publicación | Desplegar en el VPS con HTTPS | Revisión de cada tienda (Apple rechaza "webs envueltas") |
| Futuro | Se puede envolver después con Capacitor partiendo de esta base | — |

## Requisitos previos

- ✅ **HTTPS en producción** (confirmado por el usuario el 2026-10-22). Un *service worker* solo funciona
  en un origen seguro; en desarrollo vale `localhost`.
- **Adaptación a móvil (Fase 5B)** terminada y probada en un móvil real (`docs/PLAN_MOVIL.md`).
- ✅ **Modo de órganos HuBMAP resuelto (D-023):** carga los modelos del CDN oficial (`cdn.humanatlas.io`,
  CORS permitido). En la etapa 3 se pueden cachear como recurso de otro origen (*cache-first*,
  respuestas CORS); quedan fuera del botón "Descargar para usar sin conexión" por su tamaño (566 MB).

## Punto de partida (2026-10-22)

| Pieza | Estado |
|---|---|
| Manifiesto, iconos, *service worker* | No existen (`web/public/` no existe; `index.html` mínimo) |
| Tamaño de lo que habría que guardar | App (JS + CSS) unos 1,3 MB · `metadata.json` 5,2 MB (0,3 MB con gzip) · modelos: 35 MB del cuerpo masculino y 63 MB del femenino (98 MB en total) |
| Caché HTTP en producción (Nginx, D-017) | `/assets/` 1 año e inmutable · `.glb` y `data/processed/` 7 días · `index.html` sin caché |
| Funcionamiento sin servidor | La web ya funciona sin la API, con los cuestionarios incluidos (`defaultQuizzes.json`) |
| Móvil | Interfaz táctil y adaptable, arranque ligero (solo esqueleto) y render a demanda (D-018 a D-022) |

## Decisiones de diseño (confirmadas por el usuario el 2026-10-22)

1. **Herramienta:** `vite-plugin-pwa` (genera el manifiesto y el *service worker* con Workbox, ambos MIT;
   **licencias a verificar** antes de instalar y registrar en `docs/ATTRIBUTIONS.md`). Escribir el
   *service worker* a mano es posible, pero gestionar las versiones y las actualizaciones es más propenso a errores.
2. **Estrategias de caché:**

   | Recurso | Estrategia | Motivo |
   |---|---|---|
   | App (HTML, JS, CSS, iconos) | *Precache* con versión y aviso de "nueva versión" | Arranque sin red; actualizar sin romper una sesión abierta |
   | `metadata.json` | *Stale-while-revalidate* | Sirve la copia guardada al instante y se actualiza en segundo plano |
   | Modelos `.glb` | *Cache-first* con caducidad, solo los que ya se han descargado | Lo que no se ha descargado no se descarga solo (arranque ligero, D-020) |
   | `/api/*` | Solo red (*network-only*) | Sesiones y datos personales; nunca en caché compartida |

3. ✅ **Alcance sin conexión: B.** Se guarda lo que se ve y, además, hay un botón **"Descargar para
   usar sin conexión"** por cuerpo (35 o 63 MB), con progreso, espacio disponible y opción de borrar.
4. ✅ **Cuestionarios sin conexión: A.** Solo los incluidos (como ya pasa sin servidor). Guardar los
   intentos en el dispositivo y enviarlos al recuperar la conexión queda para más adelante; iOS no
   tiene *Background Sync*, así que el envío sería al volver a abrir la app.
5. ✅ **Icono: A**, diseño propio original en SVG (contenido CC BY-SA 4.0). Hace falta: 192 y 512 px,
   versión *maskable* (Android) y `apple-touch-icon` de 180 px (iOS).
6. **Iniciar sesión, cuentas, vistas, notas y resultados** siguen necesitando conexión. Sin red se
   indica claramente ("Sin conexión: los cambios no se guardan") en lugar de fallar en silencio.
7. **Privacidad:** la pantalla de Privacidad explicará qué se guarda en el dispositivo (la app y los
   modelos descargados; ningún dato personal en la caché) y cómo borrarlo.

## Etapas

### Etapa 1: Instalable ✅ (D-025)
- [x] Licencias verificadas en npm (MIT) y añadidos `vite-plugin-pwa` 2.0, `workbox-build` 7.4 y `workbox-window` 7.4.
- [x] Manifiesto: nombre, nombre corto, `start_url`, `scope`, `display: standalone`, colores de
      tema y fondo, `lang: es`, orientación libre, categorías `education` y `medical`.
- [x] Iconos (192, 512, *maskable*, `apple-touch-icon`) en `web/public/icons/`, y *favicon* (D-024).
- [x] Metadatos para iOS: `apple-mobile-web-app-capable`, título, estilo de la barra de estado y `theme-color` claro/oscuro.
- [x] Nginx (`deploy/nginx/…`): `sw.js`, `registerSW.js` y `manifest.webmanifest` **sin caché**, con el tipo MIME correcto.
- [x] *Service worker* con *precache* solo de la app (13 archivos, 1,49 MB, sin duplicados); `data/` y `/api/` excluidos; desactivado en desarrollo.
- [x] Verificado con `vite preview` y DevTools Protocol: manifiesto sin errores, **criterios de instalación cumplidos**, *service worker* activo con 13 archivos en caché, nada de `data/` y sin errores en consola.
- **Hecho cuando:** el navegador ofrece instalarla (Android/Chrome/Edge) y el manifiesto no da errores.

### Etapa 2: Arranque sin conexión y actualizaciones ✅ (D-026)
- [x] *Precache* de la app y *stale-while-revalidate* de `metadata.json`.
- [x] *Cache-first* de los modelos ya cargados (`atlas-modelos`, 60 días) y de los órganos HuBMAP del
      CDN (`atlas-hubmap`, 30 días); se adelanta aquí de la etapa 3 para que el esqueleto funcione sin red.
- [x] Primera visita: `clientsClaim` y recarga desde la caché HTTP de lo ya pedido, para que el
      esqueleto y los metadatos queden guardados sin esperar a una segunda visita.
- [x] *Service worker* desactivado en desarrollo (`pnpm run dev`); se prueba con `vite build && vite preview`.
- [x] Aviso "Hay una versión nueva del atlas · Actualizar / Más tarde" (sin recargar a la fuerza) y
      comprobación de versiones cada hora.
- [x] Aviso **"Sin conexión"** (se puede cerrar) y textos claros en cuenta y cuestionarios. La sesión se
      comprueba también sin red, para pasar enseguida al modo sin servidor.
- [x] Verificado con un perfil limpio y la caché HTTP desactivada: primera visita → caché; sin red → app,
      esqueleto y cuestionarios incluidos; versión nueva → aviso y actualización.

### Etapa 3: Modelos sin conexión ✅ (D-027)
- [x] *Cache-first* para los `.glb` ya cargados, con caducidad y límite (adelantado en la etapa 2).
- [x] Tarjeta **"Uso sin conexión"** en Capas, para el cuerpo que se está viendo: sistemas guardados y lo que ocupan, botón **"Descargar / Completar cuerpo …"** con su tamaño, barra de progreso con **Cancelar**, y **"Liberar espacio"**.
- [x] Antes de descargar: espacio libre (`navigator.storage.estimate()`), almacenamiento persistente (`navigator.storage.persist()`) y confirmación con datos móviles o ahorro de datos. También se guarda `metadata.json`.
- [x] Marca **"sin red ✓"** por sistema en la lista de capas (también para los guardados al verlos).
- [x] Solo se muestra con un *service worker* controlando la página (en desarrollo no se usaría).
- [x] Verificado: descargar el cuerpo masculino (30 MB pendientes, progreso visible) → 10 de 10; **sin red, "Todos" carga los 10 sistemas** sin errores; liberar espacio → caché vacía.

### Etapa 4: Instalación y experiencia de app
- [ ] Botón **"Instalar app"** (evento `beforeinstallprompt` en Android, Chrome y Edge) en el menú ☰.
- [ ] En iOS (no hay evento): instrucciones breves "Compartir → Añadir a pantalla de inicio".
- [ ] En modo instalado (`display-mode: standalone`): sin enlaces que saquen de la app sin avisar y
      con atrás/cerrar coherentes en los paneles.
- [ ] Privacidad: datos guardados en el dispositivo y cómo borrarlos.

### Etapa 5: Verificación
- [ ] Automática (DevTools Protocol, como en la Fase 5B): manifiesto sin errores
      (`Page.getAppManifest`), *service worker* activo, arranque con la red cortada y actualización a una versión nueva.
- [ ] Auditoría de Lighthouse (PWA, rendimiento y accesibilidad) en móvil.
- [ ] Dispositivos reales: **Android (Chrome)** e **iPhone (Safari)**. En cada uno: instalar,
      abrir sin red, descargar un cuerpo, actualizar y desinstalar.
- [ ] Regresión: escritorio y navegador normal sin cambios de comportamiento.

## Riesgos y limitaciones conocidas

| Riesgo | Mitigación |
|---|---|
| **iOS** borra el almacenamiento de webs no usadas en unos días (las instaladas son más estables) y tiene cuotas menores | `storage.persist()`, aviso del tamaño y volver a descargar si falta algo |
| **Versiones viejas** en caché tras publicar | Aviso de actualización, `sw.js` sin caché en Nginx y nombres con *hash* en `/assets/` (ya existe) |
| **Datos móviles:** descargar 63 MB sin querer | Nunca se descarga en segundo plano sin confirmación; respeta el ahorro de datos (D-020) |
| **Cachear datos personales** | `/api/*` siempre *network-only*; nada de la API en la caché del *service worker* |
| El modo HuBMAP no tiene sus modelos publicados | Resolverlo antes o excluirlo del modo sin conexión |

## Criterio de salida
En Android e iPhone se puede instalar el atlas desde el navegador. Una vez instalado y con un cuerpo
descargado, **con el modo avión activado** se abre la app, se exploran todos los sistemas de ese cuerpo
y se hace un cuestionario incluido. Al publicar una versión nueva, la app lo avisa y se actualiza
sin perder lo que se estaba haciendo.
