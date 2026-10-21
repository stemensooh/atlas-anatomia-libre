import { create } from "zustand";
import * as authApi from "../data/authApi";
import { SessionUser } from "../data/authApi";

export type AccountModal = "login" | "register" | "profile" | "admin" | "privacy" | null;

interface AuthState {
  user: SessionUser | null;
  // false hasta saber si hay sesión; null en serverOnline = aún no se sabe.
  ready: boolean;
  serverOnline: boolean | null;
  modal: AccountModal;

  loadSession: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  // Tras borrar la cuenta o si el servidor invalida la sesión.
  clearSession: () => void;
  openModal: (modal: AccountModal) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  ready: false,
  serverOnline: null,
  modal: null,

  loadSession: async () => {
    try {
      const { user } = await authApi.fetchMe();
      set({ user, ready: true, serverOnline: true });
    } catch {
      set({ user: null, ready: true, serverOnline: false });
    }
  },

  login: async (username, password) => {
    const { user } = await authApi.login(username, password);
    set({ user, modal: null, serverOnline: true });
  },

  register: async (username, password) => {
    const { user } = await authApi.register(username, password);
    set({ user, modal: null, serverOnline: true });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } finally {
      set({ user: null, modal: null });
    }
  },

  clearSession: () => set({ user: null }),
  openModal: (modal) => set({ modal }),
}));
