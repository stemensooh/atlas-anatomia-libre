import React, { useEffect, useMemo, useState } from "react";
import {
  Compass,
  Info,
  RotateCcw,
  ShieldCheck,
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
  const triggerCamera = useViewerStore((s) => s.triggerCamera);
  const resetVisibility = useViewerStore((s) => s.resetVisibility);
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
              STEMENSOFT · {metadata ? `${metadata.structuresCount.toLocaleString("es")} estructuras FMA + ${metadata.hubmapReferenceOrgansCount} órganos HuBMAP` : "Cargando catálogo…"}
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
            title="Restablecer vista y filtros"
          >
            <RotateCcw size={13} /> Centrar
          </button>
        </div>

        <div className="topbar-right">
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
