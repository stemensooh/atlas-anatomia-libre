import { useEffect, useState } from "react";

// Disposición según el ancho de la ventana (docs/PLAN_MOVIL.md):
//   mobile  < 768 px   → visor a pantalla completa + panel deslizante desde abajo
//   tablet  768–1099 px → visor + panel lateral plegable
//   desktop ≥ 1100 px  → las tres columnas de siempre
export type Layout = "mobile" | "tablet" | "desktop";

export const MOBILE_MAX = 767;
export const TABLET_MAX = 1099;

function current(): Layout {
  if (typeof window === "undefined") return "desktop";
  if (window.matchMedia(`(max-width: ${MOBILE_MAX}px)`).matches) return "mobile";
  if (window.matchMedia(`(max-width: ${TABLET_MAX}px)`).matches) return "tablet";
  return "desktop";
}

export function useLayout(): Layout {
  const [layout, setLayout] = useState<Layout>(current);
  useEffect(() => {
    const queries = [`(max-width: ${MOBILE_MAX}px)`, `(max-width: ${TABLET_MAX}px)`].map((q) =>
      window.matchMedia(q)
    );
    const update = () => setLayout(current());
    queries.forEach((m) => m.addEventListener("change", update));
    return () => queries.forEach((m) => m.removeEventListener("change", update));
  }, []);
  return layout;
}

// ¿El puntero principal es el dedo? (independiente del ancho: hay tablets grandes y portátiles táctiles)
export function useCoarsePointer(): boolean {
  const query = "(pointer: coarse)";
  const [coarse, setCoarse] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const update = () => setCoarse(m.matches);
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  return coarse;
}
