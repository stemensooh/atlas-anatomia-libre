# Cómo agregar nuevos modelos 3D y personalizar traducciones en español

Esta guía explica el flujo paso a paso para incorporar nuevos modelos 3D al visor y cómo traducir o editar los nombres y definiciones anatómicas en español.

---

## Parte 1: Cómo agregar nuevos modelos 3D

### Paso 1. Verificar la licencia (obligatorio antes de descargar)
Sigue siempre [`docs/ATTRIBUTION_HOWTO.md`](ATTRIBUTION_HOWTO.md):
1. Comprueba en la página oficial del recurso que la licencia sea **CC0, Dominio Público, CC BY o CC BY-SA**.
2. **Prohibido** usar modelos con cláusulas **NC** (No Comercial), **ND** (Sin Derivadas), sin licencia explícita o extraídos de plataformas comerciales (BioDigital, Visible Body, Complete Anatomy, etc.).
3. Guarda el archivo descargado sin modificar en `data/raw/<fuente>/`, crea su archivo `SOURCE.txt` (usando `data/raw/SOURCE.template.txt`) con URL, versión, fecha y hash `SHA-256`, guarda copia del texto de licencia en `LICENSE*` y añade una fila en [`docs/ATTRIBUTIONS.md`](ATTRIBUTIONS.md).

```powershell
Get-FileHash -Algorithm SHA256 .\data\raw\<fuente>\<archivo.glb>
```

---

### Paso 2. Optimizar y comprimir el archivo `.glb` con `meshopt`
El visor utiliza `GLTFLoader` + `MeshoptDecoder` para cargar rápido los modelos comprimidos con `EXT_meshopt_compression` y `KHR_mesh_quantization`.

Para optimizar un `.glb` nuevo y guardarlo en `data/processed/`:

```powershell
node -e "
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, reorder, quantize, meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';

await MeshoptEncoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder });

const doc = await io.read('data/raw/<fuente>/<archivo_original>.glb');
doc.getRoot().getAsset().copyright = 'Autor / Fuente (CC BY 4.0) — Procesado por STEMENSOFT (CC BY-SA 4.0)';

await doc.transform(
  dedup(),
  prune({ keepExtras: true }),
  reorder({ encoder: MeshoptEncoder, target: 'performance' }),
  quantize({ quantizePosition: 14, quantizeNormal: 10 }),
  meshopt({ encoder: MeshoptEncoder, level: 'high' })
);

await io.write('data/processed/<nuevo_modelo>.glb', doc);
"
```

---

### Paso 3. Registrar el modelo en el visor (`data/processed/metadata.json`)

Tienes dos formas de mostrar un modelo en el visor:

#### Opción A — Como órgano/modelo individual en la pestaña «Órganos HuBMAP / Catálogo»
Añade un objeto dentro del arreglo `"hubmapReferenceOrgans"` de `data/processed/metadata.json`:

```json
{
  "id": "CUSTOM_corazon_detallado",
  "organ": "corazon-detallado",
  "nameEs": "Corazón detallado (personalizado)",
  "version": "v1.0",
  "sex": "unspecified",
  "system": "circulatory",
  "glbFile": "data/processed/<nuevo_modelo>.glb",
  "source": "nih3d",
  "license": "CC BY 4.0",
  "citation": "Autor, Año. Título del modelo. URL / DOI.",
  "doi": "",
  "nodesCount": 1,
  "nodes": [
    {
      "nodeName": "NombreDelNodoEnElGLB",
      "ontologyId": "FMA7088",
      "nameEn": "Heart",
      "nameLa": "Cor",
      "nameEs": "Corazón",
      "descriptionEs": "Órgano muscular hueco principal del sistema cardiovascular."
    }
  ]
}
```
> El servidor de Vite ya sirve automáticamente cualquier ruta bajo `/data/processed/*` y `/data/raw/hubmap/*`.

#### Opción B — Integrado dentro de los 10 sistemas del cuerpo completo
- **Cuerpo masculino (`data/processed/<sistema>.glb`):** edita [`scripts/fase2_construir_glb.py`](../scripts/fase2_construir_glb.py) y ejecuta `pnpm run fase2:build`.
- **Cuerpo femenino (`data/processed/female_<sistema>.glb`):** edita [`scripts/procesar_femenino.mjs`](../scripts/procesar_femenino.mjs) y ejecuta `node scripts/procesar_femenino.mjs`.

---

## Parte 2: Cómo traducir o personalizar nombres y definiciones en español

Toda la traducción al español y la generación de definiciones educativas (`descriptionEs`) está centralizada en dos scripts de Python:

1. **[`scripts/traductor_es.py`](../scripts/traductor_es.py):**
   - Contiene el diccionario `FRASES_EXACTAS` (términos completos inglés → español), la tabla de reglas léxicas `SINTAGMAS_ES`, la inversión gramatical de sintagmas con `of` (por ejemplo, *"Posterior vein of left ventricle"* → *"Vena posterior del Ventrículo izquierdo"*) y la función `generar_descripcion_es(...)`.
   - También cruza automáticamente contra las 7.315 entradas de `data/raw/z-anatomy/TA2.csv`.
2. **[`scripts/actualizar_metadata_es.py`](../scripts/actualizar_metadata_es.py):**
   - Recorre las **1.658 estructuras masculinas**, las **956 estructuras femeninas** y las subestructuras de los **87 órganos de HuBMAP**, actualiza sus campos `nameEs`, `nameLa`, `side` y `descriptionEs`, y guarda el resultado en `data/processed/metadata.json`.

### ¿Cómo cambiar un nombre o definición concreta?
1. Abre [`scripts/traductor_es.py`](../scripts/traductor_es.py) y añade o modifica la entrada en `FRASES_EXACTAS`:
   ```python
   FRASES_EXACTAS = {
       "right ventricle": "Ventrículo derecho",
       "left ventricle": "Ventrículo izquierdo",
       # Añade aquí tus términos personalizados en minúsculas:
       "nombre en ingles": "Nombre exacto en español",
   }
   ```
2. Ejecuta el actualizador desde la raíz del proyecto:
   ```powershell
   python scripts/actualizar_metadata_es.py
   ```
3. Recarga el navegador (`http://localhost:5173`): el buscador y las fichas anatómicas mostrarán los nuevos textos al instante.
