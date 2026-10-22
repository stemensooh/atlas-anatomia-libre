import { MOBILE_MAX, TABLET_MAX } from "../hooks/useLayout";

// Perfil del dispositivo al cargar la página (docs/PLAN_MOVIL.md, etapa 3). Se calcula una vez:
// decide con qué sistemas se arranca y cómo se configura el render, que no se puede cambiar
// después sin recrear el lienzo WebGL.

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

const hasWindow = typeof window !== "undefined";
const media = (q: string) => hasWindow && window.matchMedia(q).matches;
const connection: NetworkInformationLike | undefined = hasWindow
  ? (navigator as Navigator & { connection?: NetworkInformationLike }).connection
  : undefined;

// El usuario pidió ahorrar datos, o la conexión es lenta (solo lo informan algunos navegadores).
export const SAVE_DATA =
  !!connection?.saveData || ["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "");

// Un móvil en horizontal mide más de 768 px de ancho: se reconoce por el lado corto de la
// pantalla física y el puntero táctil, sea cual sea la orientación al abrir.
const PHONE_IN_ANY_ORIENTATION =
  hasWindow && media("(pointer: coarse)") && Math.min(screen.width, screen.height) <= MOBILE_MAX;

// Arranque ligero: solo el esqueleto. En móvil (pantalla estrecha o móvil girado) o con ahorro de datos.
export const LIGHT_START = media(`(max-width: ${MOBILE_MAX}px)`) || PHONE_IN_ANY_ORIENTATION || SAVE_DATA;

// Render ligero: móvil, tablet o puntero táctil (GPU modesta y batería).
export const LOW_POWER = media(`(max-width: ${TABLET_MAX}px)`) || media("(pointer: coarse)");

// Sistema con el que se arranca en modo ligero.
export const LIGHT_START_SYSTEMS = ["skeletal"] as const;
