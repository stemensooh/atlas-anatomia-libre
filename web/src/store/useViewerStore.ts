import { create } from "zustand";
import { SYSTEM_META, SystemId } from "../data/types";

export type CameraPreset = "front" | "back" | "left" | "right" | "top" | "reset";

interface LayerState {
  enabled: boolean;
  opacity: number;
  loading: boolean;
  loaded: boolean;
}

export type BodySex = "male" | "female";

interface ViewerState {
  mode: "body" | "hubmap";
  bodySex: BodySex;
  activeHubmapOrganId: string | null;
  layers: Record<SystemId, LayerState>;
  selectedId: string | null;
  hoveredId: string | null;
  isolatedId: string | null;
  hiddenIds: Record<string, boolean>;
  searchQuery: string;
  cameraPreset: { preset: CameraPreset; seq: number };
  clipY: number | null; // Altura de plano de corte axial en metros (null = desactivado)
  creditsOpen: boolean;

  setMode: (mode: "body" | "hubmap", hubmapOrganId?: string | null) => void;
  setBodySex: (sex: BodySex) => void;
  toggleLayer: (sys: SystemId) => void;
  setLayerEnabled: (sys: SystemId, enabled: boolean) => void;
  setLayerOpacity: (sys: SystemId, opacity: number) => void;
  setLayerLoading: (sys: SystemId, loading: boolean, loaded?: boolean) => void;
  enableAllLayers: (enabled: boolean) => void;

  selectStructure: (id: string | null) => void;
  hoverStructure: (id: string | null) => void;
  toggleIsolate: (id: string) => void;
  toggleHide: (id: string) => void;
  resetVisibility: () => void;

  setSearchQuery: (q: string) => void;
  triggerCamera: (preset: CameraPreset) => void;
  setClipY: (y: number | null) => void;
  setCreditsOpen: (open: boolean) => void;
}

const initialLayers = Object.fromEntries(
  (Object.keys(SYSTEM_META) as SystemId[]).map((sys) => [
    sys,
    {
      enabled: SYSTEM_META[sys].defaultEnabled,
      opacity: SYSTEM_META[sys].defaultOpacity,
      loading: false,
      loaded: false,
    },
  ])
) as Record<SystemId, LayerState>;

export const useViewerStore = create<ViewerState>((set) => ({
  mode: "body",
  bodySex: "male",
  activeHubmapOrganId: null,
  layers: initialLayers,
  selectedId: null,
  hoveredId: null,
  isolatedId: null,
  hiddenIds: {},
  searchQuery: "",
  cameraPreset: { preset: "front", seq: 0 },
  clipY: null,
  creditsOpen: false,

  setMode: (mode, hubmapOrganId = null) =>
    set({
      mode,
      activeHubmapOrganId: hubmapOrganId,
      selectedId: null,
      isolatedId: null,
    }),

  setBodySex: (bodySex) =>
    set({
      mode: "body",
      bodySex,
      selectedId: null,
      hoveredId: null,
      isolatedId: null,
      hiddenIds: {},
    }),

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
      return { layers: next };
    }),

  selectStructure: (id) => set({ selectedId: id }),
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

  resetVisibility: () =>
    set({
      isolatedId: null,
      hiddenIds: {},
      selectedId: null,
      clipY: null,
    }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  triggerCamera: (preset) =>
    set((s) => ({
      cameraPreset: { preset, seq: s.cameraPreset.seq + 1 },
    })),

  setClipY: (clipY) => set({ clipY }),
  setCreditsOpen: (creditsOpen) => set({ creditsOpen }),
}));
