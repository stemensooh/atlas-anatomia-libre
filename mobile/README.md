# Prototipo móvil Flutter

Prueba técnica móvil del Atlas Anatómico 3D Libre. No sustituye la PWA.

## Estado

- Renderer validado en Android: `model_viewer_plus` 1.10.0 (Apache-2.0), que integra Google `<model-viewer>` en un WebView.
- Modelo de prueba: derivado local sin compresión Meshopt de `data/processed/skeletal.glb` (BodyParts3D, CC BY 4.0); conserva las 281 estructuras.
- Validado el 2026-10-23 en Samsung Galaxy A52 / Android 14: carga, rotación y zoom del esqueleto completo (281 estructuras).

## Ejecutar

```powershell
cd mobile
flutter pub get
flutter run
```

Para crear un APK de depuración:

```powershell
flutter build apk --debug
```

## Funciones de esta prueba

- Rotación y zoom por gestos.
- Carga local del GLB completo, sin red.
- Fondo y controles táctiles del visor.

La selección por estructura, nombres españoles, selector de sistemas, métricas, soporte offline propio, API e iOS quedan para las fases posteriores de `docs/PLAN_FLUTTER.md`.
