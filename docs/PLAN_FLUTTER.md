# Plan del prototipo móvil Flutter nativo

> Rama: `dev`  
> Objetivo: construir un ejemplo de aplicación móvil independiente para Android/iOS que reutilice la API, los metadatos y los modelos anatómicos del atlas actual.  
> Alcance inicial: prueba técnica; no sustituye todavía la PWA de producción.

## 1. Contexto para el agente ejecutor

El proyecto actual es un atlas anatómico 3D educativo:

- Frontend web actual: `web/`, React + Three.js + React Three Fiber + Vite.
- API: `server/`, Fastify, autenticación, cuestionarios, vistas y notas.
- Datos: `data/processed/metadata.json` y modelos GLB por sistema.
- Producción: frontend estático servido por Nginx y API detrás de Nginx/Docker.
- API pública esperada en producción: el mismo origen bajo `/api/`.

La aplicación Flutter debe ser independiente de la PWA. No se debe convertir la aplicación web en una WebView ni copiar la implementación React. El objetivo del prototipo es comprobar si un visor 3D Flutter puede cargar y manipular un modelo GLB con fluidez.

No solicitar ni escribir credenciales en el repositorio. Si se necesitan URLs o valores de desarrollo, usar un archivo local no versionado y documentar solo nombres de variables.

## 2. Estado conocido de la máquina actual

La máquina que prepara esta rama es Windows y no tiene Flutter, Dart, Android SDK, `adb` ni `sdkmanager`. El agente ejecutor trabajará en otra máquina preparada para Flutter.

Java 17 sí está instalado en la máquina original, pero no debe asumirse que existe en la máquina ejecutora.

## 3. Preparación del entorno ejecutor

Antes de modificar código:

1. Confirmar versiones con:

   ```bash
   flutter --version
   dart --version
   flutter doctor -v
   ```

2. Confirmar Android SDK, `adb`, emulador o dispositivo físico.
3. Confirmar que el proyecto puede compilar una aplicación Flutter vacía para Android.
4. Para iOS, confirmar macOS, Xcode, CocoaPods/Swift Package Manager según la versión de Flutter y un simulador o dispositivo.
5. No instalar dependencias globales adicionales sin documentarlas y sin autorización del propietario del proyecto.

## 4. Entregable técnico del prototipo

Crear una aplicación Flutter en una carpeta nueva, preferiblemente:

```text
mobile/
```

La aplicación debe tener una pantalla principal con:

- Un canvas 3D ocupando la mayor parte de la pantalla.
- Carga de `data/processed/skeletal.glb` o de una copia de desarrollo del modelo.
- Cámara orbital: rotar, zoom y desplazamiento.
- Selección de una estructura mediante toque.
- Resaltado visual de la estructura seleccionada.
- Nombre de la estructura usando `metadata.json`.
- Botón para restablecer la cámara.
- Indicador de carga y mensaje de error.
- Soporte vertical y horizontal.

El prototipo debe usar un renderer 3D real compatible con Flutter. No se acepta una WebView como resultado principal de esta prueba. Si el soporte de GLB, Meshopt o raycasting resulta insuficiente, documentar el bloqueo y conservar una prueba mínima reproducible.

## 5. Investigación 3D obligatoria

Antes de elegir un paquete, comparar al menos estas capacidades:

- GLB/glTF.
- Texturas y materiales básicos.
- Compresión `EXT_meshopt_compression`.
- Raycasting o picking por toque.
- Transparencia y cambio de opacidad.
- Planos de corte o clipping.
- Liberación de memoria al cambiar de modelo.
- Android e iOS.
- Licencia compatible con el proyecto MIT/CC BY-SA.

Registrar la decisión y la licencia del paquete elegido en `docs/DECISIONES.md` y `docs/ATTRIBUTIONS.md`. No añadir un paquete de terceros sin revisar antes su licencia y documentación oficial.

## 6. Reutilización del proyecto existente

Reutilizar sin modificar inicialmente:

- `data/processed/metadata.json`.
- Los modelos GLB procesados.
- `server/` y sus endpoints.
- El contrato de autenticación y sesiones.
- Los tipos conceptuales de estructuras, sistemas, cuestionarios y vistas.

Crear adaptadores Dart independientes para:

- `metadata.json`.
- Catálogo de sistemas.
- Cliente HTTP de `/api/`.
- Autenticación.
- Cuestionarios.

No duplicar ni cambiar la lógica del servidor salvo que una prueba demuestre una incompatibilidad real.

## 7. Fases de implementación

### Fase A: esqueleto

- [ ] Crear `mobile/` con Flutter.
- [ ] Añadir `.gitignore` de Flutter/Dart.
- [ ] Configurar Android y, si es posible, iOS.
- [ ] Ejecutar la aplicación vacía en un dispositivo o emulador.
- [ ] Documentar versiones y comandos de ejecución.

### Fase B: visor 3D mínimo

- [ ] Mostrar un canvas 3D.
- [ ] Cargar un modelo GLB.
- [ ] Implementar cámara orbital.
- [ ] Implementar toque y selección.
- [ ] Mostrar nombre y estado de carga.
- [ ] Medir FPS, memoria, tiempo de arranque y tiempo de carga.

### Fase C: catálogo anatómico

- [ ] Leer `metadata.json`.
- [ ] Asociar mesh, ID FMA/UBERON y nombre español.
- [ ] Añadir selector de sistema.
- [ ] Añadir masculino/femenino si el renderer lo permite sin problemas.
- [ ] Implementar visibilidad y opacidad por sistema.

### Fase D: datos offline

- [ ] Descargar un modelo bajo demanda.
- [ ] Guardarlo en almacenamiento local de la aplicación.
- [ ] Reabrirlo sin conexión.
- [ ] Mostrar espacio ocupado.
- [ ] Borrar modelos descargados.
- [ ] No guardar credenciales en cachés públicas.

### Fase E: API

- [ ] Consumir `/api/health`.
- [ ] Implementar login/logout.
- [ ] Cargar cuestionarios.
- [ ] Guardar un intento autenticado.
- [ ] Probar vistas y notas solo después de validar el flujo básico.

### Fase F: validación

- [ ] Android físico en gama media.
- [ ] Android en modo ahorro de datos.
- [ ] iPhone físico, si hay Mac disponible.
- [ ] Rotación vertical/horizontal.
- [ ] Cambio de aplicación y regreso.
- [ ] Descarga, apertura offline y borrado de un cuerpo.
- [ ] Modelo grande y cambio repetido entre sistemas.
- [ ] Verificar que no haya fugas de memoria ni cierres por falta de memoria.

## 8. Criterios de aceptación del ejemplo

El prototipo se considera válido si:

1. Arranca en Android sin WebView.
2. Carga el modelo óseo GLB.
3. Permite girar, ampliar y desplazar el modelo.
4. Permite tocar una estructura y mostrar su nombre.
5. Mantiene una interacción fluida en un dispositivo físico.
6. Puede abrir un modelo descargado sin conexión.
7. No necesita cambios en la API para la prueba inicial.
8. Incluye mediciones comparables con la PWA actual.
9. Documenta paquetes, licencias, limitaciones y modelo 3D elegido.
10. No rompe `web/`, `server/` ni la PWA de producción.

## 9. Comparación obligatoria con la PWA

Probar el mismo modelo y, en lo posible, el mismo dispositivo. Registrar:

| Métrica | PWA actual | Flutter | Observaciones |
|---|---:|---:|---|
| Arranque en frío | | | |
| Carga de `skeletal.glb` | | | |
| FPS durante rotación | | | |
| Memoria máxima | | | |
| Tiempo hasta primera interacción | | | |
| Tamaño inicial | | | |
| Tamaño descargado offline | | | |
| Consumo de batería aproximado | | | |

No decidir la migración completa solo por una impresión visual. La decisión debe basarse en estas mediciones y en la calidad del soporte 3D.

## 10. Resultado final que debe entregar el agente

- Código del prototipo en `mobile/`.
- `mobile/README.md` con instalación, ejecución y dispositivos probados.
- Tabla de comparación con la PWA.
- Actualización de `docs/DECISIONES.md`.
- Actualización de `docs/ATTRIBUTIONS.md` para paquetes y renderer 3D.
- Lista de limitaciones conocidas.
- No hacer merge a `main` ni sustituir la PWA hasta revisar los resultados.

