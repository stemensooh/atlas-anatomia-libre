import React from "react";
import { Eye, EyeOff, Layers, Scissors, Box, User } from "lucide-react";
import { SYSTEM_META, SystemId, SystemInfo, HubmapOrgan } from "../data/types";
import { useViewerStore } from "../store/useViewerStore";

export function LayerPanel({
  systemsInfo,
  hubmapOrgans,
}: {
  systemsInfo: SystemInfo[];
  hubmapOrgans: HubmapOrgan[];
}) {
  const mode = useViewerStore((s) => s.mode);
  const bodySex = useViewerStore((s) => s.bodySex);
  const activeHubmapOrganId = useViewerStore((s) => s.activeHubmapOrganId);
  const layers = useViewerStore((s) => s.layers);
  const clipY = useViewerStore((s) => s.clipY);
  const setMode = useViewerStore((s) => s.setMode);
  const setBodySex = useViewerStore((s) => s.setBodySex);
  const toggleLayer = useViewerStore((s) => s.toggleLayer);
  const setLayerOpacity = useViewerStore((s) => s.setLayerOpacity);
  const enableAllLayers = useViewerStore((s) => s.enableAllLayers);
  const setClipY = useViewerStore((s) => s.setClipY);

  const infoMap = new Map(systemsInfo.map((s) => [s.id, s]));

  return (
    <aside className="panel panel-left">
      <div className="mode-tabs">
        <button
          className={`mode-tab ${mode === "body" ? "active" : ""}`}
          onClick={() => setMode("body", null)}
        >
          <User size={15} />
          <span>Cuerpo 3D (10 sistemas)</span>
        </button>
        <button
          className={`mode-tab ${mode === "hubmap" ? "active" : ""}`}
          onClick={() =>
            setMode("hubmap", activeHubmapOrganId || hubmapOrgans[0]?.id || null)
          }
        >
          <Box size={15} />
          <span>Órganos HuBMAP ({hubmapOrgans.length})</span>
        </button>
      </div>

      {mode === "body" && (
        <div className="sex-switch" role="group" aria-label="Modelo anatómico">
          <button
            className={`sex-switch-btn ${bodySex === "male" ? "active male" : ""}`}
            onClick={() => setBodySex("male")}
          >
            <span>♂ Cuerpo Masculino</span>
          </button>
          <button
            className={`sex-switch-btn ${
              bodySex === "female" ? "active female" : ""
            }`}
            onClick={() => setBodySex("female")}
          >
            <span>♀ Cuerpo Femenino</span>
          </button>
        </div>
      )}

      {mode === "body" ? (
        <>
          <div className="panel-section-header">
            <div className="section-title">
              <Layers size={16} />
              <span>Capas por sistema</span>
            </div>
            <div className="mini-actions">
              <button className="btn-xs" onClick={() => enableAllLayers(true)}>
                Todos
              </button>
              <button className="btn-xs" onClick={() => enableAllLayers(false)}>
                Ninguno
              </button>
            </div>
          </div>

          <div className="layers-list">
            {(Object.keys(SYSTEM_META) as SystemId[]).map((sys) => {
              const meta = SYSTEM_META[sys];
              const st = layers[sys];
              const info = infoMap.get(sys);
              const mb = info?.optimizedBytes
                ? `${(info.optimizedBytes / 1e6).toFixed(2)} MB`
                : "";

              return (
                <div
                  key={sys}
                  className={`layer-card ${st.enabled ? "enabled" : "disabled"}`}
                >
                  <div className="layer-row">
                    <button
                      className="layer-toggle"
                      onClick={() => toggleLayer(sys)}
                      title={st.enabled ? "Ocultar sistema" : "Mostrar sistema"}
                    >
                      <span
                        className="color-dot"
                        style={{ backgroundColor: meta.colorHex }}
                      />
                      <span className="layer-name">{meta.labelEs}</span>
                    </button>
                    <div className="layer-badges">
                      {st.loading && <span className="badge-loading">cargando…</span>}
                      {info && (
                        <span className="badge-count" title={mb}>
                          {info.structuresCount}
                        </span>
                      )}
                      <button
                        className="icon-btn"
                        onClick={() => toggleLayer(sys)}
                        aria-label={`Alternar ${meta.labelEs}`}
                      >
                        {st.enabled ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                    </div>
                  </div>

                  {st.enabled && (
                    <div className="opacity-row">
                      <span className="opacity-label">Opacidad</span>
                      <input
                        type="range"
                        min={0.1}
                        max={1}
                        step={0.05}
                        value={st.opacity}
                        onChange={(e) =>
                          setLayerOpacity(sys, parseFloat(e.target.value))
                        }
                      />
                      <span className="opacity-val">
                        {Math.round(st.opacity * 100)}%
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="hubmap-list-section">
          <div className="panel-section-header">
            <div className="section-title">
              <Box size={16} />
              <span>Órganos de referencia (M/F)</span>
            </div>
          </div>
          <div className="hubmap-list">
            {hubmapOrgans.map((org) => (
              <button
                key={org.id}
                className={`hubmap-item ${
                  activeHubmapOrganId === org.id ? "active" : ""
                }`}
                onClick={() => setMode("hubmap", org.id)}
              >
                <div className="hubmap-item-top">
                  <span className="hubmap-name">{org.organ}</span>
                  <span className={`sex-badge ${org.sex}`}>
                    {org.sex === "female" ? "♀" : org.sex === "male" ? "♂" : "•"}
                  </span>
                </div>
                <div className="hubmap-item-sub">
                  <span>{SYSTEM_META[org.system]?.labelEs || org.system}</span>
                  <span>{org.nodesCount} subestructuras</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="clip-section">
        <div className="panel-section-header">
          <div className="section-title">
            <Scissors size={15} />
            <span>Corte axial (plano Y)</span>
          </div>
          <button
            className="btn-xs"
            onClick={() => setClipY(clipY === null ? 1.25 : null)}
          >
            {clipY === null ? "Activar" : "Quitar"}
          </button>
        </div>
        {clipY !== null && (
          <div className="opacity-row">
            <span className="opacity-label">Altura</span>
            <input
              type="range"
              min={0.05}
              max={1.75}
              step={0.01}
              value={clipY}
              onChange={(e) => setClipY(parseFloat(e.target.value))}
            />
            <span className="opacity-val">{clipY.toFixed(2)} m</span>
          </div>
        )}
      </div>
    </aside>
  );
}
