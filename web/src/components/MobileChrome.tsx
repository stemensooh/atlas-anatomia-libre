import React, { useEffect, useRef, useState } from "react";
import {
  Bookmark,
  Compass,
  FileText,
  HelpCircle,
  Layers,
  MapPin,
  Menu,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sun,
  Route,
} from "lucide-react";
import { Layout } from "../hooks/useLayout";
import { useAuthStore } from "../store/useAuthStore";
import { CameraPreset, RightTab, SheetSize, useViewerStore } from "../store/useViewerStore";

// Controles que solo existen en móvil y tablet (docs/PLAN_MOVIL.md, etapa 1).

// Cierra un desplegable al tocar fuera de él.
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, close]);
  return ref;
}

type TabId = "layers" | RightTab;

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: "layers", label: "Capas", icon: <Layers size={20} /> },
  { id: "info", label: "Ficha", icon: <FileText size={20} /> },
  { id: "tours", label: "Tours", icon: <Route size={20} /> },
  { id: "quiz", label: "Quiz", icon: <HelpCircle size={20} /> },
];

// Barra de pestañas inferior. Tocar la pestaña activa pliega el panel.
export function MobileTabBar() {
  const sheet = useViewerStore((s) => s.sheet);
  const rightTab = useViewerStore((s) => s.rightTab);
  const openSheet = useViewerStore((s) => s.openSheet);
  const closeSheet = useViewerStore((s) => s.closeSheet);
  const setRightTab = useViewerStore((s) => s.setRightTab);

  const activeTab: TabId | null =
    sheet.panel === "layers" ? "layers" : sheet.panel === "info" ? rightTab : null;

  const select = (id: TabId) => {
    if (id === activeTab) return closeSheet();
    if (id === "layers") return openSheet("layers");
    setRightTab(id);
    openSheet("info");
  };

  return (
    <nav className="mobile-tabbar" aria-label="Paneles">
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`mobile-tab ${activeTab === t.id ? "active" : ""}`}
          aria-pressed={activeTab === t.id}
          onClick={() => select(t.id)}
        >
          {t.icon}
          <span>{t.label}</span>
        </button>
      ))}
    </nav>
  );
}

// Asa del panel deslizante: tocar alterna medio/completo; deslizar hacia arriba lo agranda y
// hacia abajo lo encoge o lo cierra. Mientras se arrastra, el panel sigue al dedo.
export function SheetHandle({ sheetRef }: { sheetRef: React.RefObject<HTMLDivElement> }) {
  const size = useViewerStore((s) => s.sheet.size);
  const setSheetSize = useViewerStore((s) => s.setSheetSize);
  const closeSheet = useViewerStore((s) => s.closeSheet);
  const start = useRef<number | null>(null);
  // Tras un toque, algunos navegadores emiten además eventos de ratón de compatibilidad, que
  // repetirían el gesto (ampliar y volver a encoger): se ignora lo que llegue justo después.
  const lastGesture = useRef(0);

  const setOffset = (dy: number) => {
    if (sheetRef.current) sheetRef.current.style.transform = dy ? `translateY(${Math.max(0, dy)}px)` : "";
  };

  const finish = (dy: number) => {
    setOffset(0);
    if (Math.abs(dy) < 8) return setSheetSize(size === "half" ? "full" : "half");
    if (dy < -50) return setSheetSize("full");
    if (dy > 50) return size === "full" ? setSheetSize("half") : closeSheet();
  };

  return (
    <div
      className="sheet-handle"
      role="button"
      tabIndex={0}
      aria-label={size === "half" ? "Ampliar panel" : "Reducir panel"}
      onPointerDown={(e) => {
        // Sin esto, tras el toque el navegador envía mousedown/mouseup de compatibilidad en el
        // mismo punto, y como el panel ya cambió de altura caerían sobre otro control (un slider).
        e.preventDefault();
        if (Date.now() - lastGesture.current < 400) return;
        start.current = e.clientY;
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (start.current !== null) setOffset(e.clientY - start.current);
      }}
      onPointerUp={(e) => {
        if (start.current === null) return;
        const dy = e.clientY - start.current;
        start.current = null;
        lastGesture.current = Date.now();
        finish(dy);
      }}
      onPointerCancel={() => {
        start.current = null;
        setOffset(0);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setSheetSize(size === "half" ? "full" : "half");
        } else if (e.key === "Escape") closeSheet();
      }}
    >
      <span className="sheet-grip" />
    </div>
  );
}

const CAMERA_PRESETS: Array<{ preset: CameraPreset; label: string }> = [
  { preset: "front", label: "Frontal" },
  { preset: "back", label: "Posterior" },
  { preset: "left", label: "Izquierda" },
  { preset: "right", label: "Derecha" },
  { preset: "top", label: "Superior" },
];

// Botón flotante de cámara sobre el visor (sustituye a la barra de cámara de escritorio).
export function CameraFab() {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const triggerCamera = useViewerStore((s) => s.triggerCamera);
  const resetVisibility = useViewerStore((s) => s.resetVisibility);
  const user = useAuthStore((s) => s.user);
  const openModal = useAuthStore((s) => s.openModal);

  const run = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <div className="camera-fab" ref={ref}>
      <button
        className="fab-btn"
        aria-label="Cámara y vistas"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Compass size={20} />
      </button>
      {open && (
        <div className="fab-menu" role="menu">
          {CAMERA_PRESETS.map((c) => (
            <button key={c.preset} role="menuitem" onClick={() => run(() => triggerCamera(c.preset))}>
              {c.label}
            </button>
          ))}
          <button
            role="menuitem"
            onClick={() =>
              run(() => {
                resetVisibility();
                triggerCamera("reset");
              })
            }
          >
            <RotateCcw size={15} /> Centrar
          </button>
          <button role="menuitem" onClick={() => run(() => openModal(user ? "views" : "login"))}>
            <Bookmark size={15} /> {user ? "Mis vistas" : "Vistas (inicia sesión)"}
          </button>
        </div>
      )}
    </div>
  );
}

// Menú ☰ de la barra superior compacta: pines, tema y créditos.
export function CompactMenu() {
  const [open, setOpen] = useState(false);
  const ref = useDismiss(open, () => setOpen(false));
  const showLabels3D = useViewerStore((s) => s.showLabels3D);
  const theme = useViewerStore((s) => s.theme);
  const toggleLabels3D = useViewerStore((s) => s.toggleLabels3D);
  const toggleTheme = useViewerStore((s) => s.toggleTheme);
  const setCreditsOpen = useViewerStore((s) => s.setCreditsOpen);

  const run = (fn: () => void) => {
    fn();
    setOpen(false);
  };

  return (
    <div className="compact-menu" ref={ref}>
      <button className="icon-btn touch-target" aria-label="Menú" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Menu size={20} />
      </button>
      {open && (
        <div className="user-dropdown" role="menu">
          <button role="menuitem" onClick={() => run(toggleLabels3D)}>
            <MapPin size={15} /> {showLabels3D ? "Ocultar pines 3D" : "Mostrar pines 3D"}
          </button>
          <button role="menuitem" onClick={() => run(toggleTheme)}>
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
            {theme === "dark" ? "Tema claro" : "Tema oscuro"}
          </button>
          <button role="menuitem" onClick={() => run(() => setCreditsOpen(true))}>
            <ShieldCheck size={15} /> Créditos y licencias
          </button>
        </div>
      )}
    </div>
  );
}

export const sheetClass = (layout: Layout, panel: string | null, size: SheetSize) =>
  layout === "desktop" ? "sheet" : `sheet sheet-${layout} ${panel ? `is-open sheet-${size}` : "is-closed"}`;
