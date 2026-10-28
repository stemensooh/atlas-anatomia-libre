import { create } from "zustand";
import { SYSTEM_META, SystemId } from "../data/types";
import type { Vec3, ViewStateV1 } from "../data/viewState";
import { LIGHT_START, LIGHT_START_SYSTEMS } from "../data/devicePerf";

export type CameraPreset = "front" | "back" | "left" | "right" | "top" | "reset";
export type BodySex = "male" | "female";
export type LeftTab = "body" | "tree" | "hubmap";
export type RightTab = "info" | "tours" | "quiz";
export type SliderMode = "dissection" | "opacity";
// Panel deslizante de móvil y tablet: qué panel se ve y a qué altura (en tablet solo abierto/cerrado).
export type SheetPanel = "layers" | "info";
export type SheetSize = "half" | "full";

interface LayerState {
  enabled: boolean;
  opacity: number;
  depth: number;
  loading: boolean;
  loaded: boolean;
}

export interface ClipPlanesState {
  axialY: number | null;     // [0.05 .. 1.75] m
  invertY: boolean;
  sagittalX: number | null;  // [-0.35 .. 0.35] m
  invertX: boolean;
  coronalZ: number | null;   // [-0.25 .. 0.25] m
  invertZ: boolean;
}

interface ViewerState {
  mode: LeftTab;
  rightTab: RightTab;
  bodySex: BodySex;
  activeHubmapOrganId: string | null;
  layers: Record<SystemId, LayerState>;
  selectedId: string | null;
  hoveredId: string | null;
  isolatedId: string | null;
  hiddenIds: Record<string, boolean>;
  searchQuery: string;
  cameraPreset: { preset: CameraPreset; seq: number };
  // Posición de cámara concreta pedida al abrir una vista guardada (seq para repetirla).
  cameraView: { position: Vec3; target: Vec3; seq: number } | null;
  clip: ClipPlanesState;
  showLabels3D: boolean;
  theme: "dark" | "light";
  sliderMode: SliderMode;
  // Barra del órgano HuBMAP abierto (equivale a la de un sistema): profundidad y opacidad.
  hubmapLayer: { depth: number; opacity: number };
  // Opcional: al seleccionar una subestructura, el resto del órgano se vuelve translúcido.
  hubmapGhostOthers: boolean;
  // Colores didácticos por tipo de pieza (D-030) o el color original del GLB.
  hubmapPartColors: boolean;
  creditsOpen: boolean;
  leftPanelWidth: number;
  sheet: { panel: SheetPanel | null; size: SheetSize };
  // Cuenta las selecciones hechas tocando el modelo 3D (para abrir la Ficha en móvil).
  pick3DSeq: number;

  // Callback opcional cuando hay una pregunta "find3d" activa en el cuestionario
  quizClickHandler: ((clickedStructureId: string) => void) | null;

  setMode: (mode: LeftTab, hubmapOrganId?: string | null) => void;
  setRightTab: (tab: RightTab) => void;
  setBodySex: (sex: BodySex) => void;
  setSliderMode: (mode: SliderMode) => void;
  setLeftPanelWidth: (width: number) => void;
  openSheet: (panel: SheetPanel, size?: SheetSize) => void;
  setSheetSize: (size: SheetSize) => void;
  closeSheet: () => void;
  toggleLayer: (sys: SystemId) => void;
  setLayerEnabled: (sys: SystemId, enabled: boolean) => void;
  setLayerOpacity: (sys: SystemId, opacity: number) => void;
  setLayerDepth: (sys: SystemId, depth: number) => void;
  setLayerSliderValue: (sys: SystemId, val: number) => void;
  setHubmapSliderValue: (val: number) => void;
  toggleHubmapGhostOthers: () => void;
  toggleHubmapPartColors: () => void;
  setLayerLoading: (sys: SystemId, loading: boolean, loaded?: boolean) => void;
  enableAllLayers: (enabled: boolean) => void;

  selectStructure: (id: string | null) => void;
  // Selección hecha con clic directo en el modelo 3D: además avisa al cuestionario activo.
  pickStructure3D: (id: string) => void;
  hoverStructure: (id: string | null) => void;
  toggleIsolate: (id: string) => void;
  toggleHide: (id: string) => void;
  setStructuresHidden: (ids: string[], hidden: boolean) => void;
  resetVisibility: () => void;

  setSearchQuery: (q: string) => void;
  triggerCamera: (preset: CameraPreset) => void;
  setClipPlane: (patch: Partial<ClipPlanesState>) => void;
  resetClipPlanes: () => void;
  toggleLabels3D: () => void;
  toggleTheme: () => void;
  setCreditsOpen: (open: boolean) => void;
  setQuizClickHandler: (fn: ((id: string) => void) | null) => void;

  applySavedView: (view: ViewStateV1) => void;

  applySceneConfig: (cfg: {
    bodySex: BodySex;
    enabledSystems: SystemId[];
    systemOpacities?: Partial<Record<SystemId, number>>;
    selectedId?: string | null;
    cameraPreset?: CameraPreset;
    isolate?: boolean;
  }) => void;
}

const initialLayers = Object.fromEntries(
  (Object.keys(SYSTEM_META) as SystemId[]).map((sys) => [
    sys,
    {
      // En arranque ligero (móvil o ahorro de datos) solo se descarga el esqueleto al abrir.
      enabled: LIGHT_START
        ? (LIGHT_START_SYSTEMS as readonly SystemId[]).includes(sys)
        : SYSTEM_META[sys].defaultEnabled,
      opacity: SYSTEM_META[sys].defaultOpacity,
      depth: 1.0,
      loading: false,
      loaded: false,
    },
  ])
) as Record<SystemId, LayerState>;

const initialClip: ClipPlanesState = {
  axialY: null,
  invertY: false,
  sagittalX: null,
  invertX: false,
  coronalZ: null,
  invertZ: false,
};

function getStoredLeftWidth(): number {
  try {
    // Se lee también la clave anterior al cambio de nombre del proyecto (D-015).
    const val =
      localStorage.getItem("atlas_left_width") ?? localStorage.getItem("biodigital_left_width");
    if (val) {
      const n = parseInt(val, 10);
      if (!isNaN(n) && n >= 280 && n <= 700) return n;
    }
  } catch {}
  return 380;
}

export const useViewerStore = create<ViewerState>((set, get) => ({
  mode: "body",
  rightTab: "info",
  bodySex: "male",
  activeHubmapOrganId: null,
  layers: initialLayers,
  selectedId: null,
  hoveredId: null,
  isolatedId: null,
  hiddenIds: {},
  searchQuery: "",
  cameraPreset: { preset: "front", seq: 0 },
  cameraView: null,
  clip: initialClip,
  showLabels3D: false,
  theme: "dark",
  sliderMode: "dissection",
  hubmapLayer: { depth: 1.0, opacity: 1.0 },
  hubmapGhostOthers: false,
  hubmapPartColors: true,
  creditsOpen: false,
  quizClickHandler: null,
  leftPanelWidth: getStoredLeftWidth(),
  sheet: { panel: null, size: "half" },
  pick3DSeq: 0,

  setMode: (mode, hubmapOrganId = null) =>
    set((s) => {
      const organId = hubmapOrganId ?? s.activeHubmapOrganId;
      // Ocultos y aislados usan los ids de cada modelo (FMA o nodos de HuBMAP): al entrar o
      // salir de HuBMAP, o al cambiar de órgano, no deben arrastrarse al modelo siguiente.
      const changesModel =
        (mode === "hubmap") !== (s.mode === "hubmap") ||
        (mode === "hubmap" && organId !== s.activeHubmapOrganId);
      return {
        mode,
        activeHubmapOrganId: organId,
        selectedId: mode === "hubmap" ? null : s.selectedId,
        isolatedId: mode === "hubmap" || changesModel ? null : s.isolatedId,
        ...(changesModel
          ? { hiddenIds: {}, hoveredId: null, hubmapLayer: { depth: 1.0, opacity: 1.0 } }
          : {}),
      };
    }),

  setRightTab: (rightTab) => set({ rightTab }),

  setBodySex: (bodySex) =>
    set((s) => ({
      mode: s.mode === "hubmap" ? "body" : s.mode,
      bodySex,
      selectedId: null,
      hoveredId: null,
      isolatedId: null,
      hiddenIds: {},
    })),

  setSliderMode: (sliderMode) => set({ sliderMode }),

  setLeftPanelWidth: (width) => {
    const clamped = Math.max(280, Math.min(700, Math.round(width)));
    try {
      localStorage.setItem("atlas_left_width", String(clamped));
    } catch {}
    set({ leftPanelWidth: clamped });
  },

  openSheet: (panel, size) => set((s) => ({ sheet: { panel, size: size ?? s.sheet.size } })),
  setSheetSize: (size) => set((s) => ({ sheet: { ...s.sheet, size } })),
  closeSheet: () => set((s) => ({ sheet: { ...s.sheet, panel: null } })),

  toggleLayer: (sys) =>
    set((s) => ({
      layers: {
        ...s.layers,
        [sys]: { ...s.layers[sys], enabled: !s.layers[sys].enabled },
      },
    })),

  setLayerEnabled: (sys, enabled) =>
    set((s) => ({
      layers: {
        ...s.layers,
        [sys]: { ...s.layers[sys], enabled },
      },
    })),

  setLayerOpacity: (sys, opacity) =>
    set((s) => ({
      layers: {
        ...s.layers,
        [sys]: { ...s.layers[sys], opacity },
      },
    })),

  setLayerDepth: (sys, depth) =>
    set((s) => ({
      layers: {
        ...s.layers,
        [sys]: { ...s.layers[sys], depth },
      },
    })),

  setLayerSliderValue: (sys, val) =>
    set((s) => {
      if (s.sliderMode === "dissection") {
        return {
          layers: {
            ...s.layers,
            [sys]: { ...s.layers[sys], depth: val },
          },
        };
      } else {
        return {
          layers: {
            ...s.layers,
            [sys]: { ...s.layers[sys], opacity: val },
          },
        };
      }
    }),

  setHubmapSliderValue: (val) =>
    set((s) => ({
      hubmapLayer:
        s.sliderMode === "dissection"
          ? { ...s.hubmapLayer, depth: val }
          : { ...s.hubmapLayer, opacity: val },
    })),

  toggleHubmapGhostOthers: () => set((s) => ({ hubmapGhostOthers: !s.hubmapGhostOthers })),
  toggleHubmapPartColors: () => set((s) => ({ hubmapPartColors: !s.hubmapPartColors })),

  setLayerLoading: (sys, loading, loaded) =>
    set((s) => ({
      layers: {
        ...s.layers,
        [sys]: {
          ...s.layers[sys],
          loading,
          loaded: loaded ?? s.layers[sys].loaded,
        },
      },
    })),

  enableAllLayers: (enabled) =>
    set((s) => {
      const next = { ...s.layers };
      for (const k of Object.keys(next) as SystemId[]) {
        next[k] = { ...next[k], enabled };
      }
      return {
        layers: next,
        hiddenIds: enabled ? {} : s.hiddenIds,
        isolatedId: enabled ? null : s.isolatedId,
      };
    }),

  selectStructure: (id) => set({ selectedId: id }),

  pickStructure3D: (id) => {
    set((s) => ({ selectedId: id, pick3DSeq: s.pick3DSeq + 1 }));
    get().quizClickHandler?.(id);
  },

  hoverStructure: (id) => set({ hoveredId: id }),

  toggleIsolate: (id) =>
    set((s) => ({
      isolatedId: s.isolatedId === id ? null : id,
    })),

  toggleHide: (id) =>
    set((s) => {
      const next = { ...s.hiddenIds };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
      }
      return { hiddenIds: next };
    }),

  setStructuresHidden: (ids, hidden) =>
    set((s) => {
      const next = { ...s.hiddenIds };
      for (const id of ids) {
        if (hidden) {
          next[id] = true;
        } else {
          delete next[id];
        }
      }
      return { hiddenIds: next };
    }),

  resetVisibility: () =>
    set({
      isolatedId: null,
      hiddenIds: {},
      selectedId: null,
      clip: initialClip,
    }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  triggerCamera: (preset) =>
    set((s) => ({
      cameraPreset: { preset, seq: s.cameraPreset.seq + 1 },
    })),

  setClipPlane: (patch) =>
    set((s) => ({
      clip: { ...s.clip, ...patch },
    })),

  resetClipPlanes: () => set({ clip: initialClip }),

  toggleLabels3D: () => set((s) => ({ showLabels3D: !s.showLabels3D })),

  toggleTheme: () =>
    set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),

  setCreditsOpen: (creditsOpen) => set({ creditsOpen }),

  setQuizClickHandler: (quizClickHandler) => set({ quizClickHandler }),

  applySavedView: (view) =>
    set((s) => {
      const layers = { ...s.layers };
      for (const sys of Object.keys(layers) as SystemId[]) {
        const saved = view.layers[sys];
        layers[sys] = saved
          ? { ...layers[sys], enabled: saved.enabled, opacity: saved.opacity, depth: saved.depth }
          : { ...layers[sys], enabled: false };
      }
      return {
        mode: view.mode,
        bodySex: view.bodySex,
        activeHubmapOrganId: view.activeHubmapOrganId,
        layers,
        sliderMode: view.sliderMode,
        selectedId: view.selectedId,
        isolatedId: view.isolatedId,
        hiddenIds: Object.fromEntries(view.hiddenIds.map((id) => [id, true])),
        clip: { ...initialClip, ...view.clip },
        showLabels3D: view.showLabels3D,
        hoveredId: null,
        cameraView: view.camera
          ? { ...view.camera, seq: (s.cameraView?.seq ?? 0) + 1 }
          : s.cameraView,
        cameraPreset: view.camera
          ? s.cameraPreset
          : { preset: "front", seq: s.cameraPreset.seq + 1 },
      };
    }),

  applySceneConfig: (cfg) =>
    set((s) => {
      const nextLayers = { ...s.layers };
      for (const sys of Object.keys(nextLayers) as SystemId[]) {
        const isEnabled = cfg.enabledSystems.includes(sys);
        const op = cfg.systemOpacities?.[sys] ?? 1.0;
        nextLayers[sys] = {
          ...nextLayers[sys],
          enabled: isEnabled,
          opacity: op,
        };
      }
      return {
        mode: "body",
        bodySex: cfg.bodySex,
        layers: nextLayers,
        selectedId: cfg.selectedId ?? null,
        isolatedId: cfg.isolate && cfg.selectedId ? cfg.selectedId : null,
        hiddenIds: {},
        cameraPreset: cfg.cameraPreset
          ? { preset: cfg.cameraPreset, seq: s.cameraPreset.seq + 1 }
          : s.cameraPreset,
      };
    }),
}));
