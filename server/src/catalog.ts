import fs from "node:fs";
import path from "node:path";
import type { BodySex, CatalogStructure, SystemId } from "./types.ts";

// Catálogo de estructuras generado en la Fase 2 (contenido CC BY-SA 4.0; solo se lee).
const METADATA_PATH = path.resolve(import.meta.dirname, "../../data/processed/metadata.json");

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

export function loadCatalog(metadataPath = METADATA_PATH): Catalog {
  const doc = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
  const pick = (list: any[] = []): CatalogStructure[] =>
    list
      .filter((s) => s.id && s.nameEs)
      .map((s) => ({
        id: s.id,
        nameEs: s.nameEs,
        system: s.system,
        side: s.side,
        descriptionEs: s.descriptionEs || "",
      }));
  const male = pick(doc.structures);
  const female = pick(doc.femaleStructures);
  return {
    bySex: { male, female },
    byId: {
      male: new Map(male.map((s) => [s.id, s])),
      female: new Map(female.map((s) => [s.id, s])),
    },
  };
}
