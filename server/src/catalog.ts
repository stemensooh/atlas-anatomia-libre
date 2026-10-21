import fs from "node:fs";
import path from "node:path";
import type { BodySex, CatalogStructure, SystemId } from "./types.ts";

// Catálogo de estructuras generado en la Fase 2 (contenido CC BY-SA 4.0; solo se lee).
const PROCESSED_DIR = path.resolve(import.meta.dirname, "../../data/processed");

export const SYSTEM_LABEL_ES: Record<SystemId, string> = {
  skeletal: "sistema esquelético",
  muscular: "sistema muscular",
  circulatory: "sistema circulatorio",
  nervous: "sistema nervioso y sensorial",
  digestive: "sistema digestivo",
  respiratory: "sistema respiratorio",
  urinary: "sistema urinario",
  reproductive: "sistema reproductor",
  lymphatic: "sistema linfático",
  integumentary: "sistema tegumentario",
};

export interface Catalog {
  bySex: Record<BodySex, CatalogStructure[]>;
  byId: Record<BodySex, Map<string, CatalogStructure>>;
}

interface MeshInfo {
  maxCm: number;
  midCm: number;
  center: [number, number, number];
}

// Lee solo el bloque JSON de un .glb (cabecera de 12 bytes + cabecera de chunk de 8).
function readGltfJson(file: string): any {
  const fd = fs.openSync(file, "r");
  try {
    const header = Buffer.alloc(20);
    fs.readSync(fd, header, 0, 20, 0);
    const json = Buffer.alloc(header.readUInt32LE(12));
    fs.readSync(fd, json, 0, json.length, 20);
    return JSON.parse(json.toString("utf8"));
  } finally {
    fs.closeSync(fd);
  }
}

const NORMALIZED_MAX: Record<number, number> = { 5120: 127, 5121: 255, 5122: 32767, 5123: 65535 };

// Tamaño y posición de cada estructura con malla propia, a partir de los min/max de los
// accessors POSITION (obligatorios en glTF), sin descomprimir la geometría meshopt.
// Las rotaciones de nodo se ignoran: en estos modelos no afectan a la jerarquía.
function loadMeshInfo(processedDir: string, sex: BodySex): Map<string, MeshInfo> {
  const out = new Map<string, MeshInfo>();
  const files = fs
    .readdirSync(processedDir)
    .filter((f) => f.endsWith(".glb") && f.startsWith("female_") === (sex === "female"));

  for (const file of files) {
    const doc = readGltfJson(path.join(processedDir, file));
    const walk = (index: number, parentT: number[], parentS: number) => {
      const node = doc.nodes[index];
      const s = (node.scale?.[0] ?? 1) * parentS;
      const t = (node.translation ?? [0, 0, 0]).map((v: number, d: number) => parentT[d] + parentS * v);
      if (node.mesh !== undefined) {
        const lo = [Infinity, Infinity, Infinity];
        const hi = [-Infinity, -Infinity, -Infinity];
        for (const prim of doc.meshes[node.mesh].primitives) {
          const acc = doc.accessors[prim.attributes.POSITION];
          const k = acc.normalized ? NORMALIZED_MAX[acc.componentType] ?? 1 : 1;
          for (let d = 0; d < 3; d++) {
            lo[d] = Math.min(lo[d], acc.min[d] / k);
            hi[d] = Math.max(hi[d], acc.max[d] / k);
          }
        }
        const ext = hi.map((h, d) => (h - lo[d]) * s * 100).sort((a, b) => a - b);
        const center = lo.map((l, d) => t[d] + (s * (l + hi[d])) / 2) as MeshInfo["center"];
        const id = node.extras?.id ?? node.name;
        out.set(id, { maxCm: ext[2], midCm: ext[1], center });
      }
      for (const child of node.children ?? []) walk(child, t, s);
    };
    for (const root of doc.scenes[doc.scene ?? 0].nodes) walk(root, [0, 0, 0], 1);
  }
  return out;
}

// Región corporal según el centro de la estructura (metros, Y arriba; ambos modelos miden ~1,7 m).
function regionOf([x, y]: [number, number, number]): string {
  if (y >= 1.42) return "cabeza y cuello";
  if (Math.abs(x) >= 0.19 && y >= 0.75) return "miembro superior";
  if (y >= 1.15) return "tórax";
  if (y >= 0.95) return "abdomen";
  if (y >= 0.78) return "pelvis";
  return "miembro inferior";
}

export function loadCatalog(processedDir = PROCESSED_DIR): Catalog {
  const doc = JSON.parse(fs.readFileSync(path.join(processedDir, "metadata.json"), "utf8"));
  const pick = (list: any[] = [], sex: BodySex): CatalogStructure[] => {
    const meshes = loadMeshInfo(processedDir, sex);
    return list
      .filter((s) => s.id && s.nameEs)
      .map((s) => {
        const mesh = meshes.get(s.id);
        return {
          id: s.id,
          nameEs: s.nameEs,
          system: s.system,
          side: s.side,
          parentId: s.parentId || "",
          descriptionEs: s.descriptionEs || "",
          hasMesh: Boolean(mesh),
          sizeCm: mesh ? Math.round(mesh.maxCm * 10) / 10 : 0,
          clickSizeCm: mesh ? Math.round(mesh.midCm * 10) / 10 : 0,
          region: mesh ? regionOf(mesh.center) : "",
        };
      });
  };
  const male = pick(doc.structures, "male");
  const female = pick(doc.femaleStructures, "female");
  return {
    bySex: { male, female },
    byId: {
      male: new Map(male.map((s) => [s.id, s])),
      female: new Map(female.map((s) => [s.id, s])),
    },
  };
}
