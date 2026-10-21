import React, { useMemo } from "react";
import {
  Search,
  Crosshair,
  EyeOff,
  RotateCcw,
  BookOpen,
  ExternalLink,
} from "lucide-react";
import {
  AnatomyStructure,
  HubmapOrgan,
  SYSTEM_META,
} from "../data/types";
import { useViewerStore } from "../store/useViewerStore";

export function InfoPanel({
  structures,
  structureById,
  hubmapById,
}: {
  structures: AnatomyStructure[];
  structureById: Map<string, AnatomyStructure>;
  hubmapById: Map<string, HubmapOrgan>;
}) {
  const mode = useViewerStore((s) => s.mode);
  const activeHubmapOrganId = useViewerStore((s) => s.activeHubmapOrganId);
  const selectedId = useViewerStore((s) => s.selectedId);
  const hoveredId = useViewerStore((s) => s.hoveredId);
  const isolatedId = useViewerStore((s) => s.isolatedId);
  const hiddenIds = useViewerStore((s) => s.hiddenIds);
  const searchQuery = useViewerStore((s) => s.searchQuery);

  const selectStructure = useViewerStore((s) => s.selectStructure);
  const setLayerEnabled = useViewerStore((s) => s.setLayerEnabled);
  const toggleIsolate = useViewerStore((s) => s.toggleIsolate);
  const toggleHide = useViewerStore((s) => s.toggleHide);
  const resetVisibility = useViewerStore((s) => s.resetVisibility);
  const setSearchQuery = useViewerStore((s) => s.setSearchQuery);

  const selectedStructure = selectedId ? structureById.get(selectedId) : null;
  const hoveredStructure = hoveredId ? structureById.get(hoveredId) : null;
  const parentStructure =
    selectedStructure?.parentId
      ? structureById.get(selectedStructure.parentId)
      : null;

  const activeHubmap = activeHubmapOrganId
    ? hubmapById.get(activeHubmapOrganId)
    : null;

  const filteredStructures = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return structures
      .filter(
        (s) =>
          s.nameEs.toLowerCase().includes(q) ||
          s.nameLa.toLowerCase().includes(q) ||
          s.nameEn.toLowerCase().includes(q) ||
          s.id.toLowerCase().includes(q)
      )
      .slice(0, 25);
  }, [structures, searchQuery]);

  const hiddenCount = Object.keys(hiddenIds).length;

  return (
    <aside className="panel panel-right">
      {mode === "body" && (
        <div className="search-box">
          <div className="search-input-wrap">
            <Search size={15} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar hueso, músculo, arteria, FMA…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="clear-btn"
                onClick={() => setSearchQuery("")}
                title="Limpiar búsqueda"
              >
                ×
              </button>
            )}
          </div>

          {filteredStructures.length > 0 && (
            <div className="search-results">
              {filteredStructures.map((st) => (
                <button
                  key={st.id}
                  className={`search-result-item ${
                    selectedId === st.id ? "selected" : ""
                  }`}
                  onClick={() => {
                    setLayerEnabled(st.system, true);
                    selectStructure(st.id);
                    setSearchQuery("");
                  }}
                >
                  <span
                    className="color-dot"
                    style={{
                      backgroundColor: SYSTEM_META[st.system].colorHex,
                    }}
                  />
                  <div className="search-result-text">
                    <strong>{st.nameEs}</strong>
                    <small>
                      {st.nameLa} · {st.id}
                    </small>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {(isolatedId || hiddenCount > 0) && (
        <div className="visibility-banner">
          <span>
            {isolatedId ? "1 estructura aislada" : ""}
            {isolatedId && hiddenCount > 0 ? " · " : ""}
            {hiddenCount > 0 ? `${hiddenCount} ocultas` : ""}
          </span>
          <button className="btn-xs" onClick={resetVisibility}>
            <RotateCcw size={13} /> Restablecer
          </button>
        </div>
      )}

      {hoveredStructure && !selectedStructure && (
        <div className="hover-preview">
          <span className="hover-badge">Apuntando</span>
          <strong>{hoveredStructure.nameEs}</strong>
          <small>
            {hoveredStructure.nameLa} ({hoveredStructure.id})
          </small>
        </div>
      )}

      {mode === "body" ? (
        selectedStructure ? (
          <div className="structure-card">
            <div className="structure-header">
              <span
                className="system-pill"
                style={{
                  borderColor: SYSTEM_META[selectedStructure.system].colorHex,
                }}
              >
                <span
                  className="color-dot"
                  style={{
                    backgroundColor:
                      SYSTEM_META[selectedStructure.system].colorHex,
                  }}
                />
                {SYSTEM_META[selectedStructure.system].labelEs}
              </span>
              <span className="fma-id">{selectedStructure.id}</span>
            </div>

            <h2 className="structure-title">{selectedStructure.nameEs}</h2>

            {selectedStructure.descriptionEs && (
              <p className="structure-description">
                {selectedStructure.descriptionEs}
              </p>
            )}

            <dl className="meta-grid">
              <div>
                <dt>Latín (TA2)</dt>
                <dd>{selectedStructure.nameLa}</dd>
              </div>
              <div>
                <dt>Término técnico internacional (FMA/UBERON)</dt>
                <dd>
                  {selectedStructure.nameEn}{" "}
                  {selectedStructure.ontologyId
                    ? `(${selectedStructure.ontologyId})`
                    : ""}
                </dd>
              </div>
              <div>
                <dt>Lateralidad</dt>
                <dd>
                  {selectedStructure.side === "left"
                    ? "Izquierda (sinister)"
                    : selectedStructure.side === "right"
                    ? "Derecha (dexter)"
                    : "Mediana / impar"}
                </dd>
              </div>
              {selectedStructure.parentId && (
                <div>
                  <dt>Estructura padre</dt>
                  <dd>
                    {parentStructure ? (
                      <button
                        className="link-inline"
                        onClick={() => selectStructure(parentStructure.id)}
                      >
                        {parentStructure.nameEs} ({parentStructure.id})
                      </button>
                    ) : (
                      selectedStructure.parentId
                    )}
                  </dd>
                </div>
              )}
            </dl>

            <div className="action-buttons">
              <button
                className={`btn-action ${
                  isolatedId === selectedStructure.id ? "active" : ""
                }`}
                onClick={() => toggleIsolate(selectedStructure.id)}
              >
                <Crosshair size={15} />
                <span>
                  {isolatedId === selectedStructure.id
                    ? "Salir de aislar"
                    : "Aislar"}
                </span>
              </button>
              <button
                className={`btn-action ${
                  hiddenIds[selectedStructure.id] ? "active" : ""
                }`}
                onClick={() => toggleHide(selectedStructure.id)}
              >
                <EyeOff size={15} />
                <span>
                  {hiddenIds[selectedStructure.id] ? "Mostrar" : "Ocultar"}
                </span>
              </button>
              <button className="btn-action" onClick={resetVisibility}>
                <RotateCcw size={15} />
                <span>Restablecer</span>
              </button>
            </div>

            <div className="attribution-mini">
              <BookOpen size={14} />
              <div>
                {selectedStructure.source === "hubmap" ? (
                  <>
                    <strong>Fuente:</strong> HuBMAP CCF 3D Reference Object
                    Library (Visible Human Female) · Licencia{" "}
                    <a
                      href="https://creativecommons.org/licenses/by/4.0/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      CC BY 4.0 <ExternalLink size={11} />
                    </a>
                  </>
                ) : (
                  <>
                    <strong>Fuente:</strong> BodyParts3D v4.0 (© The Database
                    Center for Life Science) · Licencia{" "}
                    <a
                      href="https://creativecommons.org/licenses/by/4.0/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      CC BY 4.0 <ExternalLink size={11} />
                    </a>
                    <br />
                    <small>
                      Mallas elementales:{" "}
                      {selectedStructure.elementFiles?.join(", ") || "N/D"}
                    </small>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <h3>Selecciona una estructura 3D</h3>
            <p>
              Haz clic sobre cualquier hueso, músculo, vaso sanguíneo u órgano
              en el visor para inspeccionar su ficha anatómica (nombres en
              español, latín e inglés, ID FMA y atribución).
            </p>
            <ul className="tips-list">
              <li>
                <strong>Clic izquierdo + arrastrar:</strong> rotar cámara
              </li>
              <li>
                <strong>Rueda del ratón:</strong> acercar / alejar (zoom)
              </li>
              <li>
                <strong>Clic derecho + arrastrar:</strong> desplazar vista
              </li>
            </ul>
          </div>
        )
      ) : activeHubmap ? (
        <div className="structure-card">
          <div className="structure-header">
            <span className="system-pill">
              {SYSTEM_META[activeHubmap.system]?.labelEs || activeHubmap.system}
            </span>
            <span className="fma-id">{activeHubmap.version}</span>
          </div>
          <h2 className="structure-title">
            {activeHubmap.nameEs || activeHubmap.organ}
          </h2>
          <p className="hubmap-meta-line">
            Sexo:{" "}
            <strong>
              {activeHubmap.sex === "female"
                ? "Femenino (♀)"
                : activeHubmap.sex === "male"
                ? "Masculino (♂)"
                : "No especificado"}
            </strong>{" "}
            · Subestructura:{" "}
            <strong>
              {activeHubmap.nodes.find((n) => n.nodeName === selectedId)
                ?.nameEs ||
                selectedId ||
                "ninguna"}
            </strong>
          </p>
          {selectedId &&
            activeHubmap.nodes.find((n) => n.nodeName === selectedId)
              ?.descriptionEs && (
              <p className="structure-description">
                {
                  activeHubmap.nodes.find((n) => n.nodeName === selectedId)
                    ?.descriptionEs
                }
              </p>
            )}

          <div className="nodes-sublist">
            <h4>Subestructuras mapeadas ({activeHubmap.nodes.length})</h4>
            <div className="nodes-scroll">
              {activeHubmap.nodes.map((n, i) => (
                <button
                  key={`${n.nodeName}-${i}`}
                  className={`node-row ${
                    selectedId === n.nodeName ? "active" : ""
                  }`}
                  onClick={() => selectStructure(n.nodeName)}
                >
                  <div>
                    <strong>{n.nameEs}</strong>
                    <small>{n.nodeName}</small>
                  </div>
                  <span className="ont-tag">{n.ontologyId}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="attribution-mini">
            <BookOpen size={14} />
            <div>
              <strong>Fuente:</strong> HuBMAP CCF 3D Reference Object Library ·{" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noreferrer"
              >
                CC BY 4.0 <ExternalLink size={11} />
              </a>
              <p className="citation-text">{activeHubmap.citation}</p>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
