# Atribuciones y licencias

Registro de todos los recursos de terceros usados en el proyecto.
Regla: **ningún archivo entra a `data/` sin una fila aquí.**

> Las licencias de la columna "Licencia" son las esperadas según el plan.
> Cambia el estado a ✅ solo cuando hayas verificado la licencia en la página oficial.

## Recursos de modelos 3D

| ID | Recurso | Autor / Titular | URL | Licencia | Estado verificación | Fecha verif. | Archivo local | Modificaciones | Obligaciones |
|---|---|---|---|---|---|---|---|---|---|
| S01 | Z-Anatomy | Equipo Z-Anatomy | https://www.z-anatomy.com | CC BY-SA 4.0 (esperada) | ⏳ pendiente | | `data/raw/z-anatomy/` | | Atribución, indicar cambios, ShareAlike |
| S02 | BodyParts3D | DBCLS (Database Center for Life Science), Japón | https://lifesciencedb.jp/bp3d/ | CC BY-SA 2.1 JP (esperada) | ⏳ pendiente | | `data/raw/bodyparts3d/` | | Atribución, ShareAlike |
| S03 | HuBMAP 3D Reference Object Library | HuBMAP / Human Reference Atlas | https://humanatlas.io | CC BY 4.0 (esperada) | ⏳ pendiente | | `data/raw/hubmap/` | | Atribución |
| S04 | NIH 3D | Varios autores | https://3d.nih.gov | Varía por modelo | ⏳ pendiente | | | | Revisar cada modelo; evitar NC/ND |

## Ontologías y terminología

| ID | Recurso | URL | Licencia | Estado | Notas |
|---|---|---|---|---|---|
| O01 | FMA (Foundational Model of Anatomy) | https://bioportal.bioontology.org/ontologies/FMA | CC BY 3.0 (esperada) | ⏳ pendiente | IDs y jerarquía |
| O02 | UBERON | https://obophenotype.github.io/uberon/ | CC BY 3.0 (esperada) | ⏳ pendiente | Ontología de anatomía |

## Textos didácticos

| ID | Recurso | URL | Licencia | Estado | Notas |
|---|---|---|---|---|---|
| T01 | Wikipedia | https://es.wikipedia.org | CC BY-SA 4.0 | ⏳ pendiente | Cita título, autores (historial) y licencia |
| T02 | OpenStax Anatomy & Physiology | https://openstax.org | CC BY 4.0 (esperada) | ⏳ pendiente | |

## Datasets de imagen médica (solo Fase 7)

| ID | Recurso | URL | Licencia | Estado | Notas |
|---|---|---|---|---|---|
| D01 | TotalSegmentator dataset | https://zenodo.org | CC BY 4.0 (esperada) | ⏳ pendiente | |
| D02 | TCIA (colección por definir) | https://www.cancerimagingarchive.net | Varía por colección | ⏳ pendiente | Evitar colecciones NC |

## Software / dependencias principales

| Componente | Licencia |
|---|---|
| three.js, React, Vite, Zustand | MIT |
| Babylon.js, Draco | Apache-2.0 |
| glTF-Transform, meshoptimizer | MIT |
| Blender, MeshLab | GPL (los modelos exportados no heredan GPL) |
| 3D Slicer | Licencia estilo BSD |

## Plantilla de nueva entrada

```
ID:
Recurso:
Autor/Titular:
URL de origen:
Versión / fecha de descarga:
Licencia (nombre + URL del texto legal):
Copia del texto de licencia guardada en:
Hash SHA-256 de la descarga:
Modificaciones realizadas:
Obligaciones (atribución, ShareAlike, etc.):
Verificado por / fecha:
```

## Texto de atribución para mostrar en la UI (borrador)

> Modelos 3D basados en Z-Anatomy y BodyParts3D (DBCLS), con licencia CC BY-SA.
> Modificados para este proyecto (limpieza, nombrado y compresión).
> Este contenido derivado se distribuye bajo CC BY-SA 4.0.
