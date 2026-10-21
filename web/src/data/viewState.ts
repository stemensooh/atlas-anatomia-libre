import { SYSTEM_META, SystemId } from "./types";
import { BodySex, ClipPlanesState, LeftTab, SliderMode, useViewerStore } from "../store/useViewerStore";

// Estado de una "vista guardada": lo necesario para reconstruir la escena tal como estaba.
// Se guarda como JSON en el servidor; `version` permite cambiar el formato más adelante.

export type Vec3 = [number, number, number];

export interface ViewStateV1 {
  version: 1;
  mode: LeftTab;
  bodySex: BodySex;
  activeHubmapOrganId: string | null;
  layers: Partial<Record<SystemId, { enabled: boolean; opacity: number; depth: number }>>;
  sliderMode: SliderMode;
  selectedId: string | null;
  isolatedId: string | null;
  hiddenIds: string[];
  clip: ClipPlanesState;
  showLabels3D: boolean;
  camera: { position: Vec3; target: Vec3 } | null;
}

// Lo rellena CameraController (dentro del <Canvas>) para que se pueda leer la cámara desde fuera.
export const cameraBridge: { read: (() => { position: Vec3; target: Vec3 }) | null } = {
  read: null,
};

export function captureViewState(): ViewStateV1 {
  const s = useViewerStore.getState();
  const layers: ViewStateV1["layers"] = {};
  for (const sys of Object.keys(s.layers) as SystemId[]) {
    const { enabled, opacity, depth } = s.layers[sys];
    layers[sys] = { enabled, opacity, depth };
  }
  return {
    version: 1,
    mode: s.mode,
    bodySex: s.bodySex,
    activeHubmapOrganId: s.activeHubmapOrganId,
    layers,
    sliderMode: s.sliderMode,
    selectedId: s.selectedId,
    isolatedId: s.isolatedId,
    hiddenIds: Object.keys(s.hiddenIds),
    clip: { ...s.clip },
    showLabels3D: s.showLabels3D,
    camera: cameraBridge.read?.() ?? null,
  };
}

const isVec3 = (v: unknown): v is Vec3 =>
  Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === "number" && Number.isFinite(n));

// Comprueba lo mínimo de una vista que viene del servidor antes de aplicarla.
export function parseViewState(raw: unknown): ViewStateV1 | null {
  const v = raw as Partial<ViewStateV1> | null;
  if (!v || v.version !== 1 || (v.bodySex !== "male" && v.bodySex !== "female")) return null;
  const layers: ViewStateV1["layers"] = {};
  for (const [sys, l] of Object.entries(v.layers ?? {})) {
    if (sys in SYSTEM_META && l) layers[sys as SystemId] = l;
  }
  return {
    ...(v as ViewStateV1),
    layers,
    hiddenIds: Array.isArray(v.hiddenIds) ? v.hiddenIds.filter((x) => typeof x === "string") : [],
    camera:
      v.camera && isVec3(v.camera.position) && isVec3(v.camera.target) ? v.camera : null,
  };
}
