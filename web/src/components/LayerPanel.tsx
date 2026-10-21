import React, { useMemo, useState, useEffect } from "react";
import {
  Eye,
  EyeOff,
  Layers,
  Scissors,
  Box,
  User,
  GitBranch,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FlipHorizontal,
  RotateCcw,
  SlidersHorizontal,
  Minimize2,
  Maximize2,
} from "lucide-react";
import {
  AnatomyStructure,
  SYSTEM_META,
  SystemId,
  SystemInfo,
  HubmapOrgan,
} from "../data/types";
import { useViewerStore } from "../store/useViewerStore";

export function LayerPanel({
  systemsInfo,
  structures,
  hubmapOrgans,
}: {
  systemsInfo: SystemInfo[];
  structures: AnatomyStructure[];
  hubmapOrgans: HubmapOrgan[];
}) {
  const mode = useViewerStore((s) => s.mode);
  const bodySex = useViewerStore((s) => s.bodySex);
  const activeHubmapOrganId = useViewerStore((s) => s.activeHubmapOrganId);
  const layers = useViewerStore((s) => s.layers);
  const selectedId = useViewerStore((s) => s.selectedId);
  const hiddenIds = useViewerStore((s) => s.hiddenIds);
  const clip = useViewerStore((s) => s.clip);

  const setMode = useViewerStore((s) => s.setMode);
  const setBodySex = useViewerStore((s) => s.setBodySex);
  const toggleLayer = useViewerStore((s) => s.toggleLayer);
  const setLayerEnabled = useViewerStore((s) => s.setLayerEnabled);
  const setLayerOpacity = useViewerStore((s) => s.setLayerOpacity);
  const enableAllLayers = useViewerStore((s) => s.enableAllLayers);
  const selectStructure = useViewerStore((s) => s.selectStructure);
  const toggleHide = useViewerStore((s) => s.toggleHide);
  const setStructuresHidden = useViewerStore((s) => s.setStructuresHidden);
  const setClipPlane = useViewerStore((s) => s.setClipPlane);
  const resetClipPlanes = useViewerStore((s) => s.resetClipPlanes);

  // Estados del árbol: sistema abierto, modo acordeón (1 a la vez por defecto para vista limpia), filtro
  const [expandedSystems, setExpandedSystems] = useState<
    Partial<Record<SystemId, boolean>>
  >({
    skeletal: true,
  });
  const [accordionMode, setAccordionMode] = useState<boolean>(true);
  const [treeFilter, setTreeFilter] = useState<string>("");

  // Estado del panel de cortes: colapsable para dar máximo espacio vertical al árbol
  const [clipOpen, setClipOpen] = useState<boolean>(false);

  const infoMap = new Map(systemsInfo.map((s) => [s.id, s]));

  const hasAnyClip =
    clip.axialY !== null || clip.sagittalX !== null || clip.coronalZ !== null;

  // Si se activa algún plano de corte, asegurar que el usuario vea los controles
  useEffect(() => {
    if (hasAnyClip) {
      setClipOpen(true);
    }
  }, [hasAnyClip]);

  // Si se selecciona una estructura en 3D o búsqueda, auto-expandir su sistema en el árbol
  useEffect(() => {
    if (selectedId && mode === "tree") {
      const st = structures.find((s) => s.id === selectedId);
      if (st) {
        setExpandedSystems((prev) =>
          accordionMode ? { [st.system]: true } : { ...prev, [st.system]: true }
        );
      }
    }
  }, [selectedId, mode, structures, accordionMode]);

  // Agrupar estructuras por sistema y ordenarlas alfabéticamente en español
  const groupedBySystem = useMemo(() => {
    const map = new Map<SystemId, AnatomyStructure[]>();
    for (const sys of Object.keys(SYSTEM_META) as SystemId[]) {
      map.set(sys, []);
    }
    const q = treeFilter.trim().toLowerCase();
    for (const st of structures) {
      if (
        q &&
        !st.nameEs.toLowerCase().includes(q) &&
        !st.nameLa.toLowerCase().includes(q) &&
        !st.id.toLowerCase().includes(q)
      ) {
        continue;
      }
      map.get(st.system)?.push(st);
    }
    for (const [, arr] of map) {
      arr.sort((a, b) => a.nameEs.localeCompare(b.nameEs, "es"));
    }
    return map;
  }, [structures, treeFilter]);

  const toggleSystemExpand = (sys: SystemId) => {
    setExpandedSystems((prev) => {
      const isCurrentlyOpen = Boolean(prev[sys]);
      if (accordionMode) {
        return isCurrentlyOpen ? {} : { [sys]: true };
      } else {
        return { ...prev, [sys]: !isCurrentlyOpen };
      }
    });
  };

  const collapseAllSystems = () => {
    setExpandedSystems({});
  };

  const expandAllSystems = () => {
    const all: Partial<Record<SystemId, boolean>> = {};
    for (const sys of Object.keys(SYSTEM_META) as SystemId[]) {
      all[sys] = true;
    }
    setExpandedSystems(all);
  };

  const handleToggleSystem = (sys: SystemId) => {
    const sysItems = groupedBySystem.get(sys) || [];
    const visibleCount = layers[sys].enabled
      ? sysItems.filter((i) => !hiddenIds[i.id]).length
      : 0;

    if (visibleCount > 0) {
      // Si tiene alguna estructura visible, al pulsar el nodo padre lo apagamos todo
      setLayerEnabled(sys, false);
      const hiddenInSys = sysItems
        .map((i) => i.id)
        .filter((id) => hiddenIds[id]);
      if (hiddenInSys.length > 0) {
        setStructuresHidden(hiddenInSys, false);
      }
    } else {
      // Si está completamente apagado, al pulsar el nodo padre lo encendemos todo
      const hiddenInSys = sysItems
        .map((i) => i.id)
        .filter((id) => hiddenIds[id]);
      if (hiddenInSys.length > 0) {
        setStructuresHidden(hiddenInSys, false);
      }
      setLayerEnabled(sys, true);
    }
  };

  const handleToggleChild = (st: AnatomyStructure) => {
    const isSysEnabled = layers[st.system]?.enabled;
    const isExplicitlyHidden = Boolean(hiddenIds[st.id]);
    const isCurrentlyVisible = isSysEnabled && !isExplicitlyHidden;

    if (isCurrentlyVisible) {
      // Estaba visible -> lo ocultamos
      toggleHide(st.id);
      // Si era la última estructura visible de este sistema, desactivamos la capa
      const sysItems = groupedBySystem.get(st.system) || [];
      const remainingVisible = sysItems.filter(
        (i) => i.id !== st.id && !hiddenIds[i.id]
      ).length;
      if (remainingVisible === 0) {
        setLayerEnabled(st.system, false);
      }
    } else {
      // Estaba oculta -> la queremos mostrar
      if (!isSysEnabled) {
        // EL CASO CLAVE: Si el sistema estaba apagado y se hace clic en un hijo:
        // Se activa el sistema en 3D pero ocultando TODOS los demás hermanos
        // para que ÚNICAMENTE se muestre este nodo hijo en 3D
        const sysItems = groupedBySystem.get(st.system) || [];
        const otherIds = sysItems
          .map((i) => i.id)
          .filter((id) => id !== st.id);
        setStructuresHidden(otherIds, true);
        if (isExplicitlyHidden) {
          setStructuresHidden([st.id], false);
        }
        setLayerEnabled(st.system, true);
      } else {
        // El sistema ya estaba prendido, simplemente quitamos la marca de oculto de este hijo
        toggleHide(st.id);
      }
    }
  };

  const handleSelectChild = (st: AnatomyStructure) => {
    if (!layers[st.system]?.enabled) {
      // Si el sistema estaba apagado y el usuario selecciona el nodo en el árbol:
      // Mostramos ÚNICAMENTE este hijo
      const sysItems = groupedBySystem.get(st.system) || [];
      const otherIds = sysItems
        .map((i) => i.id)
        .filter((id) => id !== st.id);
      setStructuresHidden(otherIds, true);
      if (hiddenIds[st.id]) {
        setStructuresHidden([st.id], false);
      }
      setLayerEnabled(st.system, true);
    } else {
      if (hiddenIds[st.id]) {
        toggleHide(st.id);
      }
    }
    selectStructure(st.id);
  };

  return (
    <aside className="panel panel-left">
      {/* 1. Cabecera fija superior: Selector de modo (Sistemas, Árbol, HuBMAP) y sexo */}
      <div className="panel-fixed-header">
        <div className="mode-tabs mode-tabs-3">
          <button
            className={`mode-tab ${mode === "body" ? "active" : ""}`}
            onClick={() => setMode("body", null)}
            title="Capas por sistema anatómico"
          >
            <User size={14} />
            <span>Sistemas</span>
          </button>
          <button
            className={`mode-tab ${mode === "tree" ? "active" : ""}`}
            onClick={() => setMode("tree", null)}
            title="Árbol anatómico jerárquico"
          >
            <GitBranch size={14} />
            <span>Árbol</span>
          </button>
          <button
            className={`mode-tab ${mode === "hubmap" ? "active" : ""}`}
            onClick={() =>
              setMode(
                "hubmap",
                activeHubmapOrganId || hubmapOrgans[0]?.id || null
              )
            }
            title="Órganos de referencia HuBMAP"
          >
            <Box size={14} />
            <span>HuBMAP ({hubmapOrgans.length})</span>
          </button>
        </div>

        {mode !== "hubmap" && (
          <div className="sex-switch" role="group" aria-label="Modelo anatómico">
            <button
              className={`sex-switch-btn ${
                bodySex === "male" ? "active male" : ""
              }`}
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
      </div>

      {/* 2. Cuerpo central con un único scrollbar fluido */}
      <div className="panel-scroll-body">
        {mode === "body" ? (
          <div className="layers-section">
            <div className="panel-section-header">
              <div className="section-title">
                <Layers size={16} />
                <span>Capas por sistema</span>
              </div>
              <div className="mini-actions">
                <button
                  className="btn-xs"
                  onClick={() => enableAllLayers(true)}
                >
                  Todos
                </button>
                <button
                  className="btn-xs"
                  onClick={() => enableAllLayers(false)}
                >
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
                    className={`layer-card ${
                      st.enabled ? "enabled" : "disabled"
                    }`}
                  >
                    <div className="layer-row">
                      <button
                        className="layer-toggle"
                        onClick={() => toggleLayer(sys)}
                        title={
                          st.enabled ? "Ocultar sistema" : "Mostrar sistema"
                        }
                      >
                        <span
                          className="color-dot"
                          style={{ backgroundColor: meta.colorHex }}
                        />
                        <span className="layer-name">{meta.labelEs}</span>
                      </button>
                      <div className="layer-badges">
                        {st.loading && (
                          <span className="badge-loading">cargando…</span>
                        )}
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
                          {st.enabled ? (
                            <Eye size={15} />
                          ) : (
                            <EyeOff size={15} />
                          )}
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
          </div>
        ) : mode === "tree" ? (
          <div className="tree-section">
            {/* Cabecera y controles del árbol fijos */}
            <div className="tree-header-controls">
              <div className="panel-section-header">
                <div className="section-title">
                  <GitBranch size={15} />
                  <span>Árbol anatómico ({structures.length})</span>
                </div>
                <div className="mini-actions">
                  <button
                    className="btn-xs"
                    onClick={() => enableAllLayers(true)}
                    title="Activar todos los sistemas y mostrar estructuras"
                  >
                    Todos
                  </button>
                  <button
                    className="btn-xs"
                    onClick={() => enableAllLayers(false)}
                    title="Desactivar todos los sistemas"
                  >
                    Ninguno
                  </button>
                </div>
              </div>

              <input
                type="text"
                className="tree-filter-input"
                placeholder="Filtrar estructuras en el árbol…"
                value={treeFilter}
                onChange={(e) => setTreeFilter(e.target.value)}
              />

              {/* Barra de herramientas para controlar la vista del árbol */}
              <div className="tree-toolbar">
                <button
                  className={`btn-xs ${accordionMode ? "active" : ""}`}
                  onClick={() => setAccordionMode(!accordionMode)}
                  title={
                    accordionMode
                      ? "Modo Acordeón activado (abre 1 sistema a la vez para mantener la vista limpia)"
                      : "Modo Múltiples activado (permite abrir varios sistemas simultáneamente)"
                  }
                >
                  <SlidersHorizontal size={12} />
                  <span>{accordionMode ? "1 a la vez" : "Múltiples"}</span>
                </button>
                <div className="tree-toolbar-group">
                  <button
                    className="btn-xs"
                    onClick={collapseAllSystems}
                    title="Cerrar todos los sistemas del árbol"
                  >
                    <Minimize2 size={12} />
                    <span>Cerrar</span>
                  </button>
                  <button
                    className="btn-xs"
                    onClick={expandAllSystems}
                    title="Abrir todos los sistemas del árbol"
                  >
                    <Maximize2 size={12} />
                    <span>Abrir</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Lista del árbol con un único contenedor scrollable y encabezados sticky */}
            <div className="tree-scroll">
              {(Object.keys(SYSTEM_META) as SystemId[]).map((sys) => {
                const meta = SYSTEM_META[sys];
                const items = groupedBySystem.get(sys) || [];
                const isExpanded =
                  Boolean(treeFilter.trim()) || Boolean(expandedSystems[sys]);
                const visibleCount = layers[sys].enabled
                  ? items.filter((i) => !hiddenIds[i.id]).length
                  : 0;
                const isSysVisible = visibleCount > 0;

                return (
                  <div key={sys} className="tree-group">
                    <div className="tree-group-header">
                      <button
                        className="tree-expand-btn"
                        onClick={() => toggleSystemExpand(sys)}
                        title={
                          isExpanded
                            ? "Colapsar sistema"
                            : "Expandir sistema"
                        }
                      >
                        {isExpanded ? (
                          <ChevronDown size={14} />
                        ) : (
                          <ChevronRight size={14} />
                        )}
                        <span
                          className="color-dot"
                          style={{ backgroundColor: meta.colorHex }}
                        />
                        <span className="tree-sys-label">{meta.labelEs}</span>
                      </button>
                      <div className="layer-badges">
                        <span
                          className="badge-count"
                          title={`${visibleCount} de ${items.length} estructuras visibles`}
                        >
                          {visibleCount > 0 && visibleCount < items.length
                            ? `${visibleCount}/${items.length}`
                            : items.length}
                        </span>
                        <button
                          className="icon-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleSystem(sys);
                          }}
                          title={
                            isSysVisible
                              ? "Ocultar todas las estructuras de este sistema"
                              : "Mostrar todas las estructuras de este sistema"
                          }
                        >
                          {isSysVisible ? (
                            <Eye size={14} />
                          ) : (
                            <EyeOff size={14} />
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && items.length > 0 && (
                      <div className="tree-children">
                        {items.map((st) => {
                          const isSysEnabled = layers[st.system]?.enabled;
                          const isExplicitlyHidden = Boolean(hiddenIds[st.id]);
                          const isHidden = !isSysEnabled || isExplicitlyHidden;

                          return (
                            <div
                              key={st.id}
                              className={`tree-node-row ${
                                selectedId === st.id ? "selected" : ""
                              } ${isHidden ? "is-hidden" : ""}`}
                            >
                              <button
                                className="tree-node-select"
                                onClick={() => handleSelectChild(st)}
                              >
                                <span className="tree-node-name">
                                  {st.nameEs}
                                </span>
                                <small className="tree-node-id">
                                  {st.id}
                                </small>
                              </button>
                              <button
                                className="icon-btn"
                                onClick={() => handleToggleChild(st)}
                                title={
                                  isHidden
                                    ? "Mostrar solamente esta estructura"
                                    : "Ocultar esta estructura"
                                }
                              >
                                {isHidden ? (
                                  <EyeOff size={13} />
                                ) : (
                                  <Eye size={13} />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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
                    <span className="hubmap-name">
                      {org.nameEs || org.organ}
                    </span>
                    <span className={`sex-badge ${org.sex}`}>
                      {org.sex === "female"
                        ? "♀"
                        : org.sex === "male"
                        ? "♂"
                        : "•"}
                    </span>
                  </div>
                  <div className="hubmap-item-sub">
                    <span>
                      {SYSTEM_META[org.system]?.labelEs || org.system}
                    </span>
                    <span>{org.nodesCount} subestructuras</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 3. Panel de cortes inferior colapsable (anclado abajo, no empuja ni oculta el árbol) */}
      <div className="clip-section">
        <div className="panel-section-header">
          <button
            className="clip-header-btn"
            onClick={() => setClipOpen(!clipOpen)}
            title={clipOpen ? "Plegar cortes" : "Desplegar cortes"}
          >
            <Scissors size={15} />
            <span>Planos de corte (3 ejes)</span>
            {hasAnyClip && <span className="clip-active-badge">Activo</span>}
            {clipOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>

          {hasAnyClip && (
            <button
              className="btn-xs"
              onClick={resetClipPlanes}
              title="Restablecer los 3 planos de corte"
            >
              <RotateCcw size={12} /> Quitar
            </button>
          )}
        </div>

        {clipOpen && (
          <div className="clip-body">
            {/* Plano Axial (Y) */}
            <div className="clip-plane-box">
              <div className="clip-plane-row">
                <span className="clip-plane-label">Axial (Y · Altura)</span>
                <div className="mini-actions">
                  {clip.axialY !== null && (
                    <button
                      className={`btn-xs ${clip.invertY ? "active" : ""}`}
                      onClick={() => setClipPlane({ invertY: !clip.invertY })}
                      title="Invertir lado cortado"
                    >
                      <FlipHorizontal size={11} /> Invertir
                    </button>
                  )}
                  <button
                    className="btn-xs"
                    onClick={() =>
                      setClipPlane({
                        axialY: clip.axialY === null ? 1.25 : null,
                      })
                    }
                  >
                    {clip.axialY === null ? "Activar" : "Off"}
                  </button>
                </div>
              </div>
              {clip.axialY !== null && (
                <div className="opacity-row">
                  <input
                    type="range"
                    min={0.05}
                    max={1.75}
                    step={0.01}
                    value={clip.axialY}
                    onChange={(e) =>
                      setClipPlane({ axialY: parseFloat(e.target.value) })
                    }
                  />
                  <span className="opacity-val">
                    {clip.axialY.toFixed(2)} m
                  </span>
                </div>
              )}
            </div>

            {/* Plano Sagital (X) */}
            <div className="clip-plane-box">
              <div className="clip-plane-row">
                <span className="clip-plane-label">Sagital (X · Izq/Der)</span>
                <div className="mini-actions">
                  {clip.sagittalX !== null && (
                    <button
                      className={`btn-xs ${clip.invertX ? "active" : ""}`}
                      onClick={() => setClipPlane({ invertX: !clip.invertX })}
                      title="Invertir hemicuerpo cortado"
                    >
                      <FlipHorizontal size={11} /> Invertir
                    </button>
                  )}
                  <button
                    className="btn-xs"
                    onClick={() =>
                      setClipPlane({
                        sagittalX: clip.sagittalX === null ? 0.0 : null,
                      })
                    }
                  >
                    {clip.sagittalX === null ? "Activar" : "Off"}
                  </button>
                </div>
              </div>
              {clip.sagittalX !== null && (
                <div className="opacity-row">
                  <input
                    type="range"
                    min={-0.35}
                    max={0.35}
                    step={0.01}
                    value={clip.sagittalX}
                    onChange={(e) =>
                      setClipPlane({
                        sagittalX: parseFloat(e.target.value),
                      })
                    }
                  />
                  <span className="opacity-val">
                    {clip.sagittalX.toFixed(2)} m
                  </span>
                </div>
              )}
            </div>

            {/* Plano Coronal (Z) */}
            <div className="clip-plane-box">
              <div className="clip-plane-row">
                <span className="clip-plane-label">
                  Coronal (Z · Ant/Post)
                </span>
                <div className="mini-actions">
                  {clip.coronalZ !== null && (
                    <button
                      className={`btn-xs ${clip.invertZ ? "active" : ""}`}
                      onClick={() => setClipPlane({ invertZ: !clip.invertZ })}
                      title="Invertir mitad anterior/posterior"
                    >
                      <FlipHorizontal size={11} /> Invertir
                    </button>
                  )}
                  <button
                    className="btn-xs"
                    onClick={() =>
                      setClipPlane({
                        coronalZ: clip.coronalZ === null ? 0.0 : null,
                      })
                    }
                  >
                    {clip.coronalZ === null ? "Activar" : "Off"}
                  </button>
                </div>
              </div>
              {clip.coronalZ !== null && (
                <div className="opacity-row">
                  <input
                    type="range"
                    min={-0.25}
                    max={0.25}
                    step={0.01}
                    value={clip.coronalZ}
                    onChange={(e) =>
                      setClipPlane({
                        coronalZ: parseFloat(e.target.value),
                      })
                    }
                  />
                  <span className="opacity-val">
                    {clip.coronalZ.toFixed(2)} m
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
