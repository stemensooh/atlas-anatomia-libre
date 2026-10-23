import { HubmapOrgan } from "./types";
import hubmapSizes from "./hubmapSizes.json";

// Órganos de referencia de HuBMAP (CC BY 4.0, D-023). Los modelos no se versionan ni se alojan:
// el visor los carga del CDN oficial, que permite CORS. La versión de cada órgano viene de
// metadata.json (la misma que se descargó y verificó en la Fase 1).
export const HUBMAP_CDN = "https://cdn.humanatlas.io/digital-objects/ref-organ";

// Conjuntos de cuerpo entero (357 y 230 MB): no son un órgano y duplican el visor por sistemas.
const EXCLUDED = new Set(["united-female", "united-male"]);

export const isHubmapOrganAvailable = (organ: HubmapOrgan) => !EXCLUDED.has(organ.organ);

export function hubmapGlbUrl(organ: HubmapOrgan): string {
  const file = organ.glbFile.split("/").pop();
  return `${HUBMAP_CDN}/${organ.organ}/${organ.version}/assets/${file}`;
}

// Tamaño del .glb en bytes, tomado de data/raw/hubmap/SOURCE.txt (generado en hubmapSizes.json).
export const hubmapGlbBytes = (organ: HubmapOrgan): number | undefined =>
  (hubmapSizes as Record<string, number>)[organ.organ];
