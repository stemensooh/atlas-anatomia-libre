import { create } from "zustand";

// Instalación de la app (docs/PLAN_PWA.md, etapa 4). Chrome, Edge y Android emiten
// "beforeinstallprompt" una vez, a menudo antes de que React monte la interfaz: se captura al
// importar este módulo (desde main.tsx) y se guarda para usarlo cuando el usuario pulse "Instalar".

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallPlatform = "native" | "ios" | "other";

interface InstallState {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
}

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true);

// iPhone y iPad (también iPadOS, que se presenta como Mac con pantalla táctil).
const isIOS = () =>
  typeof navigator !== "undefined" &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

export const useInstallStore = create<InstallState>(() => ({
  deferred: null,
  installed: isStandalone(),
}));

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // Se evita el aviso automático del navegador: la app ofrece su propio botón.
    e.preventDefault();
    useInstallStore.setState({ deferred: e as BeforeInstallPromptEvent });
  });
  window.addEventListener("appinstalled", () => useInstallStore.setState({ deferred: null, installed: true }));
}

// Cómo se puede instalar aquí: con el diálogo del navegador, con instrucciones (iOS) o desde el menú
// del navegador (otros). null si ya está instalada.
export function installPlatform(state: InstallState): InstallPlatform | null {
  if (state.installed || isStandalone()) return null;
  if (state.deferred) return "native";
  return isIOS() ? "ios" : "other";
}

export async function promptInstall(): Promise<boolean> {
  const { deferred } = useInstallStore.getState();
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  // El evento solo se puede usar una vez.
  useInstallStore.setState({ deferred: null, installed: outcome === "accepted" });
  return outcome === "accepted";
}
