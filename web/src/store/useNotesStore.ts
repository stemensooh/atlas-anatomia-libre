import { create } from "zustand";
import { listNotes, saveNote, StructureNote } from "../data/libraryApi";

// Notas del usuario por estructura, cargadas una vez al iniciar sesión.
interface NotesState {
  byId: Record<string, StructureNote>;
  loadedFor: number | null; // id del usuario cuyas notas están cargadas
  load: (userId: number) => Promise<void>;
  save: (structureId: string, note: string) => Promise<void>;
  clear: () => void;
}

export const useNotesStore = create<NotesState>((set, get) => ({
  byId: {},
  loadedFor: null,

  load: async (userId) => {
    if (get().loadedFor === userId) return;
    const notes = await listNotes();
    set({ byId: Object.fromEntries(notes.map((n) => [n.structureId, n])), loadedFor: userId });
  },

  save: async (structureId, note) => {
    const saved = await saveNote(structureId, note);
    set((s) => {
      const byId = { ...s.byId };
      if (saved) byId[structureId] = saved;
      else delete byId[structureId];
      return { byId };
    });
  },

  clear: () => set({ byId: {}, loadedFor: null }),
}));
