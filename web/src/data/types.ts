export type SystemId =
  | "skeletal"
  | "muscular"
  | "circulatory"
  | "nervous"
  | "digestive"
  | "respiratory"
  | "urinary"
  | "reproductive"
  | "lymphatic"
  | "integumentary";

export interface SystemInfo {
  id: SystemId;
  glbFile: string;
  structuresCount: number;
  vertices: number;
  triangles: number;
  rawBytes?: number;
  optimizedBytes?: number;
}

export interface AnatomyStructure {
  id: string;
  ontologyId?: string;
  meshName: string;
  nameLa: string;
  nameEs: string;
  nameEn: string;
  system: SystemId;
  parentId: string;
  side: "left" | "right" | "median";
  source: string;
  license: string;
  elementFiles?: string[];
  descriptionEs: string;
  descriptionSource?: string;
}

export interface HubmapNode {
  nodeName: string;
  ontologyId: string;
  nameEn: string;
  nameLa: string;
  nameEs: string;
  descriptionEs?: string;
}

export interface HubmapOrgan {
  id: string;
  organ: string;
  nameEs?: string;
  version: string;
  sex: "male" | "female" | "unspecified";
  system: SystemId;
  glbFile: string;
  source: string;
  license: string;
  citation: string;
  doi: string;
  nodesCount: number;
  nodes: HubmapNode[];
}

export interface MetadataDoc {
  version: string;
  generatedAt: string;
  contentLicense: string;
  sources: Record<
    string,
    {
      name: string;
      author: string;
      license: string;
      url: string;
      attribution: string;
    }
  >;
  systems: SystemInfo[];
  femaleSystems?: SystemInfo[];
  structuresCount: number;
  structures: AnatomyStructure[];
  femaleStructuresCount?: number;
  femaleStructures?: AnatomyStructure[];
  hubmapReferenceOrgansCount: number;
  hubmapReferenceOrgans: HubmapOrgan[];
}

export const SYSTEM_META: Record<
  SystemId,
  { labelEs: string; colorHex: string; defaultEnabled: boolean; defaultOpacity: number }
> = {
  skeletal: {
    labelEs: "Sistema esquelético",
    colorHex: "#e8e0c9",
    defaultEnabled: true,
    defaultOpacity: 1.0,
  },
  muscular: {
    labelEs: "Sistema muscular",
    colorHex: "#c94a48",
    defaultEnabled: false,
    defaultOpacity: 0.85,
  },
  circulatory: {
    labelEs: "Sistema circulatorio",
    colorHex: "#e02430",
    defaultEnabled: true,
    defaultOpacity: 1.0,
  },
  nervous: {
    labelEs: "Sistema nervioso y sensorial",
    colorHex: "#f0d264",
    defaultEnabled: true,
    defaultOpacity: 1.0,
  },
  respiratory: {
    labelEs: "Sistema respiratorio",
    colorHex: "#e694a4",
    defaultEnabled: true,
    defaultOpacity: 1.0,
  },
  digestive: {
    labelEs: "Sistema digestivo",
    colorHex: "#d98b6c",
    defaultEnabled: true,
    defaultOpacity: 1.0,
  },
  urinary: {
    labelEs: "Sistema urinario",
    colorHex: "#b5634b",
    defaultEnabled: true,
    defaultOpacity: 1.0,
  },
  reproductive: {
    labelEs: "Sistema reproductor",
    colorHex: "#d47c96",
    defaultEnabled: false,
    defaultOpacity: 1.0,
  },
  lymphatic: {
    labelEs: "Sistema linfático",
    colorHex: "#6bbf76",
    defaultEnabled: false,
    defaultOpacity: 1.0,
  },
  integumentary: {
    labelEs: "Sistema tegumentario (piel)",
    colorHex: "#ebbfa3",
    defaultEnabled: false,
    defaultOpacity: 0.35,
  },
};
