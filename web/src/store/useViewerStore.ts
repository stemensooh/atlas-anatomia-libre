import { create } from "zustand";
import { SYSTEM_META, SystemId } from "../data/types";

export type CameraPreset = "front" | "back" | "left" | "right" | "top" | "reset";
export type BodySex = "male" | "female";
export type LeftTab = "body" | "tree" | "hubmap";
export type RightTab = "info" | "tours" | "quiz";
export type SliderMode = "dissection" | "opacity";

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
  clip: ClipPlanesState;
  showLabels3D: boolean;
  theme: "dark" | "light";
  sliderMode: SliderMode;
  creditsOpen: boolean;

  // Callback opcional cuando hay una pregunta "find3d" activa en el cuestionario
  quizClickHandler: ((clickedStructureId: string) => void) | null;

  setMode: (mode: LeftTab, hubmapOrganId?: string | null) => void;
  setRightTab: (tab: RightTab) => void;
  setBodySex: (sex: BodySex) => void;
  setSliderMode: (mode: SliderMode) => void;
  toggleLayer: (sys: SystemId) => void;
  setLayerEnabled: (sys: SystemId, enabled: boolean) => void;
  setLayerOpacity: (sys: SystemId, opacity: number) => void;
  setLayerDepth: (sys: SystemId, depth: number) => void;
  setLayerSliderValue: (sys: SystemId, val: number) => void;
  setLayerLoading: (sys: SystemId, loading: boolean, loaded?: boolean) => void;
  enableAllLayers: (enabled: boolean) => void;

  selectStructure: (id: string | null) => void;
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
      enabled: SYSTEM_META[sys].defaultEnabled,
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

export const useViewerStore = create<ViewerState>((set) => ({
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
  clip: initialClip,
  showLabels3D: false,
  theme: "dark",
  sliderMode: "dissection",
  creditsOpen: false,
  quizClickHandler: null,

  setMode: (mode, hubmapOrganId = null) =>
    set((s) => ({
      mode,
      activeHubmapOrganId: hubmapOrganId ?? s.activeHubmapOrganId,
      selectedId: mode === "hubmap" ? null : s.selectedId,
      isolatedId: mode === "hubmap" ? null : s.isolatedId,
    })),

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

  selectStructure: (id) =>
    set((s) => {
      if (id && s.quizClickHandler) {
        s.quizClickHandler(id);
      }
      return { selectedId: id };
    }),

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
