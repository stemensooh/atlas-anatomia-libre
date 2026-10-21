# Atribuciones y licencias

Registro de todos los recursos de terceros usados en el proyecto.
Regla: **ningún archivo entra a `data/` sin una fila aquí.**

> Las licencias de la columna "Licencia" son las esperadas según el plan.
> Cambia el estado a ✅ solo cuando hayas verificado la licencia en la página oficial.

## Recursos de modelos 3D

| ID | Recurso | Autor / Titular | URL | Licencia | Estado verificación | Fecha verif. | Archivo local | Modificaciones | Obligaciones |
|---|---|---|---|---|---|---|---|---|---|
| S01 | Z-Anatomy (solo `TA2.csv`, sin mallas) | Equipo Z-Anatomy (Gauthier Kervyn et al.) | https://github.com/Z-Anatomy/Models-of-human-anatomy | CC BY-SA 4.0 | ✅ verificado (mallas descartadas por incluir partes NC) | 2026-10-20 | `data/raw/z-anatomy/` | Ninguna (solo consulta de términos; no se redistribuyen sus mallas ni la tabla TA2 completa) | Atribución, indicar cambios, ShareAlike (si se reutiliza contenido) |
| S02 | BodyParts3D (v4.0, IS-A y PART-OF 99%) | DBCLS (Database Center for Life Science), Japón | https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html | CC BY 4.0 (actualizada 2025-02-27) | ✅ verificado | 2026-10-20 | `data/raw/bodyparts3d/` | Unión de sub-mallas `FJ*.obj` por `Concept ID` FMA (1.658 estructuras), conversión `mm Z-up` a `m Y-up`, agrupación en 10 `.glb` por sistema, cuantización y compresión `EXT_meshopt_compression` (`data/processed/*.glb`) | Atribuir: *"BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International"* e indicar cambios |
| S03 | HuBMAP 3D Reference Object Library | HuBMAP / Human Reference Atlas (Katy Börner, Kristen Browne et al.) | https://lod.humanatlas.io/ref-organ | CC BY 4.0 | ✅ verificado | 2026-10-20 | `data/raw/hubmap/` | Extracción de nodos y ontologías (`crosswalk.csv`) e integración en `data/processed/metadata.json` con traducción de etiquetas ES/LA | Atribución a HuBMAP CCF 3D Reference Object Library + cita/DOI por órgano e indicar cambios |
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

> Modelos 3D basados en **BodyParts3D** (© The Database Center for Life Science, CC BY 4.0) y **HuBMAP CCF 3D Reference Object Library** (CC BY 4.0).
> Modificados para este proyecto (limpieza, nombrado y compresión).
> Este contenido derivado se distribuye bajo CC BY-SA 4.0.
