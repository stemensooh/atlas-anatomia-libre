import React, { useEffect, useMemo, useState } from "react";
import {
  Compass,
  Info,
  MapPin,
  Moon,
  RotateCcw,
  ShieldCheck,
  Sun,
} from "lucide-react";
import {
  AnatomyStructure,
  HubmapOrgan,
  MetadataDoc,
} from "./data/types";
import { useViewerStore } from "./store/useViewerStore";
import { AnatomyCanvas } from "./three/AnatomyCanvas";
import { LayerPanel } from "./components/LayerPanel";
import { InfoPanel } from "./components/InfoPanel";
import { CreditsModal } from "./components/CreditsModal";

export function App() {
  const [metadata, setMetadata] = useState<MetadataDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  const bodySex = useViewerStore((s) => s.bodySex);
  const selectedId = useViewerStore((s) => s.selectedId);
  const showLabels3D = useViewerStore((s) => s.showLabels3D);
  const theme = useViewerStore((s) => s.theme);
  const triggerCamera = useViewerStore((s) => s.triggerCamera);
  const resetVisibility = useViewerStore((s) => s.resetVisibility);
  const toggleIsolate = useViewerStore((s) => s.toggleIsolate);
  const toggleHide = useViewerStore((s) => s.toggleHide);
  const selectStructure = useViewerStore((s) => s.selectStructure);
  const toggleLabels3D = useViewerStore((s) => s.toggleLabels3D);
  const toggleTheme = useViewerStore((s) => s.toggleTheme);
  const setCreditsOpen = useViewerStore((s) => s.setCreditsOpen);

  useEffect(() => {
    fetch("/data/processed/metadata.json")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((doc: MetadataDoc) => setMetadata(doc))
      .catch((err) => setError(err.message));
  }, []);

  // Aplicar tema claro/oscuro en el elemento raíz
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Atajos de teclado globales (R, I, H, L, Escape)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const key = e.key.toLowerCase();
      if (key === "r") {
        e.preventDefault();
        resetVisibility();
        triggerCamera("reset");
      } else if (key === "i" && selectedId) {
        e.preventDefault();
        toggleIsolate(selectedId);
      } else if (key === "h" && selectedId) {
        e.preventDefault();
        toggleHide(selectedId);
      } else if (key === "l") {
        e.preventDefault();
        toggleLabels3D();
      } else if (e.key === "Escape") {
        selectStructure(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    selectedId,
    resetVisibility,
    triggerCamera,
    toggleIsolate,
    toggleHide,
    toggleLabels3D,
    selectStructure,
  ]);

  const {
    activeStructures,
    activeSystemsInfo,
    structureById,
    structureByMeshName,
    hubmapById,
  } = useMemo(() => {
    const byId = new Map<string, AnatomyStructure>();
    const byMesh = new Map<string, AnatomyStructure>();
    const byHubmap = new Map<string, HubmapOrgan>();

    const list =
      bodySex === "female" && metadata?.femaleStructures?.length
        ? metadata.femaleStructures
        : metadata?.structures || [];

    const sysList =
      bodySex === "female" && metadata?.femaleSystems?.length
        ? metadata.femaleSystems
        : metadata?.systems || [];

    if (metadata) {
      for (const st of metadata.structures) {
        byId.set(st.id, st);
        byMesh.set(st.meshName, st);
      }
      for (const st of metadata.femaleStructures || []) {
        byId.set(st.id, st);
        byMesh.set(st.meshName, st);
      }
      for (const hb of metadata.hubmapReferenceOrgans || []) {
        byHubmap.set(hb.id, hb);
      }
    }
    return {
      activeStructures: list,
      activeSystemsInfo: sysList,
      structureById: byId,
      structureByMeshName: byMesh,
      hubmapById: byHubmap,
    };
  }, [metadata, bodySex]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-dot" />
          <div>
            <h1>Atlas Anatómico 3D Libre</h1>
            <span className="subtitle">
              STEMENSOFT ·{" "}
              {metadata
                ? `${metadata.structuresCount.toLocaleString(
                    "es"
                  )} estructuras FMA + ${
                    metadata.femaleStructuresCount?.toLocaleString("es") || 0
                  } femeninas + ${
                    metadata.hubmapReferenceOrgansCount
                  } órganos HuBMAP`
                : "Cargando catálogo…"}
            </span>
          </div>
        </div>

        <div className="camera-toolbar" aria-label="Vistas de cámara">
          <Compass size={15} className="toolbar-icon" />
          <button className="btn-cam" onClick={() => triggerCamera("front")}>
            Frontal
          </button>
          <button className="btn-cam" onClick={() => triggerCamera("back")}>
            Posterior
          </button>
          <button className="btn-cam" onClick={() => triggerCamera("left")}>
            Izquierda
          </button>
          <button className="btn-cam" onClick={() => triggerCamera("right")}>
            Derecha
          </button>
          <button className="btn-cam" onClick={() => triggerCamera("top")}>
            Superior
          </button>
          <button
            className="btn-cam"
            onClick={() => {
              resetVisibility();
              triggerCamera("reset");
            }}
            title="Restablecer vista y filtros (Tecla R)"
          >
            <RotateCcw size={13} /> Centrar
          </button>
        </div>

        <div className="topbar-right">
          <button
            className={`btn-cam ${showLabels3D ? "active" : ""}`}
            onClick={toggleLabels3D}
            title="Mostrar/ocultar etiquetas y pines 3D sobre puntos anatómicos clave (Tecla L)"
          >
            <MapPin size={14} />
            <span>Pines 3D</span>
          </button>
          <button
            className="btn-cam"
            onClick={toggleTheme}
            title="Alternar tema oscuro / claro"
          >
            {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            <span>{theme === "dark" ? "Claro" : "Oscuro"}</span>
          </button>
          <button
            className="btn-credits"
            onClick={() => setCreditsOpen(true)}
          >
            <ShieldCheck size={15} />
            <span>Créditos y Licencias</span>
          </button>
        </div>
      </header>

      <main className="workspace">
        {metadata && (
          <LayerPanel
            systemsInfo={activeSystemsInfo}
            structures={activeStructures}
            hubmapOrgans={metadata.hubmapReferenceOrgans}
          />
        )}

        <section className="canvas-stage">
          {error ? (
            <div className="error-banner">
              Error cargando metadata.json: {error}
            </div>
          ) : (
            <AnatomyCanvas
              structureById={structureById}
              structureByMeshName={structureByMeshName}
              hubmapById={hubmapById}
            />
          )}

          <footer className="stage-footer">
            <span>
              <Info size={13} /> Uso exclusivamente educativo (no médico).
            </span>
            <span>
              Modelos: BodyParts3D (© DBCLS, CC BY 4.0) + HuBMAP (CC BY 4.0) ·
              Derivado CC BY-SA 4.0
            </span>
            <button
              className="link-inline"
              onClick={() => setCreditsOpen(true)}
            >
              Ver atribuciones completas
            </button>
          </footer>
        </section>

        {metadata && (
          <InfoPanel
            structures={activeStructures}
            structureById={structureById}
            hubmapById={hubmapById}
          />
        )}
      </main>

      <CreditsModal />
    </div>
  );
}
