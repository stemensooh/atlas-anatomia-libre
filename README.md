# Visor anatómico 3D libre

Proyecto de aprendizaje para crear un visor de anatomía humana en 3D, abierto y no comercial.

> Solo con fines educativos. No sustituye consejo, diagnóstico ni tratamiento médico.

## Estado
- **Fase 0, Fase 1 y Fase 2:** cerradas.
- **Fase 3 (Visor MVP):** funcional en `web/` con el cuerpo masculino (1.658 estructuras FMA), el cuerpo femenino (956 estructuras HuBMAP) divididos en 10 sistemas anatómicos y 87 órganos individuales detallados, todo traducido al español.
- Ver el plan completo en [docs/PLAN_PROYECTO.md](docs/PLAN_PROYECTO.md) y la guía para ampliar contenido en [docs/COMO_AGREGAR_MODELOS_Y_TRADUCCIONES.md](docs/COMO_AGREGAR_MODELOS_Y_TRADUCCIONES.md).

## Cómo ejecutar el visor en local
La primera vez, instala las dependencias (`pnpm install` en `web/` y en `server/`). Después, en dos terminales:

```powershell
# Terminal 1: API de cuestionarios con SQLite (puerto 3001)
cd server
pnpm run dev

# Terminal 2: visor web (puerto 5173)
cd web
pnpm run dev
```
Abre `http://localhost:5173` en el navegador. Si la API no está en marcha, el visor funciona igual con los cuestionarios incluidos, pero no guarda resultados ni permite crear o generar cuestionarios.

- Base de datos: `server/data/biodigital.db` (se crea sola). `pnpm run seed` en `server/` restaura los cuestionarios iniciales.
- Tests de la API: `pnpm test` en `server/`.

## Estructura
```
docs/        planificación, atribuciones y decisiones
data/raw/    descargas originales (no se editan; no se versionan)
data/processed/  modelos procesados (GLB)
data/metadata/   metadatos de estructuras
scripts/     automatización
web/         aplicación frontend
```

## Licencias
- Código: [MIT](LICENSE-CODE)
- Contenido (modelos, textos, documentación): [CC BY-SA 4.0](LICENSE-CONTENT)
- Recursos de terceros: ver [docs/ATTRIBUTIONS.md](docs/ATTRIBUTIONS.md)
