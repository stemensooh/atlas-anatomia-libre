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
  MoveHorizontal,
  Crosshair,
} from "lucide-react";
import {
  AnatomyStructure,
  SYSTEM_META,
  SystemId,
  SystemInfo,
  HubmapOrgan,
} from "../data/types";
import {
  buildSystemHierarchy,
  TreeNodeItem,
  TreeBranchNode,
  getStructureHierarchyPath,
} from "../data/hierarchyData";
import { useViewerStore } from "../store/useViewerStore";
import { useLayout } from "../hooks/useLayout";
import { LIGHT_START, SAVE_DATA } from "../data/devicePerf";
import { hubmapGlbBytes } from "../data/hubmap";
import { OfflinePanel, useOfflineSystems } from "./OfflinePanel";

const formatMB = (bytes: number) => `${(bytes / 1e6).toFixed(bytes < 1e6 ? 1 : 0)} MB`;

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
  const sliderMode = useViewerStore((s) => s.sliderMode);
  const setSliderMode = useViewerStore((s) => s.setSliderMode);
  const setLayerSliderValue = useViewerStore((s) => s.setLayerSliderValue);
  const toggleLayer = useViewerStore((s) => s.toggleLayer);
  const setLayerEnabled = useViewerStore((s) => s.setLayerEnabled);
  const setLayerOpacity = useViewerStore((s) => s.setLayerOpacity);
  const enableAllLayers = useViewerStore((s) => s.enableAllLayers);
  const selectStructure = useViewerStore((s) => s.selectStructure);
  const toggleHide = useViewerStore((s) => s.toggleHide);
  const isolatedId = useViewerStore((s) => s.isolatedId);
  const toggleIsolate = useViewerStore((s) => s.toggleIsolate);
  const showAllStructures = useViewerStore((s) => s.showAllStructures);
  const hubmapLayer = useViewerStore((s) => s.hubmapLayer);
  const setHubmapSliderValue = useViewerStore((s) => s.setHubmapSliderValue);
  const hubmapGhostOthers = useViewerStore((s) => s.hubmapGhostOthers);
  const toggleHubmapGhostOthers = useViewerStore((s) => s.toggleHubmapGhostOthers);
  const hubmapPartColors = useViewerStore((s) => s.hubmapPartColors);
  const toggleHubmapPartColors = useViewerStore((s) => s.toggleHubmapPartColors);
  const activeOrgan =
    mode === "hubmap" ? hubmapOrgans.find((o) => o.id === activeHubmapOrganId) : undefined;
  const setStructuresHidden = useViewerStore((s) => s.setStructuresHidden);
  const setClipPlane = useViewerStore((s) => s.setClipPlane);
  const resetClipPlanes = useViewerStore((s) => s.resetClipPlanes);
  const leftPanelWidth = useViewerStore((s) => s.leftPanelWidth);
  const setLeftPanelWidth = useViewerStore((s) => s.setLeftPanelWidth);

  // Móvil, tablet o ahorro de datos: se muestra cuánto pesa cada sistema antes de descargarlo.
  const layout = useLayout();
  const showSizes = layout !== "desktop" || LIGHT_START;
  const [lightNoticeOpen, setLightNoticeOpen] = useState(LIGHT_START);

  // PWA: sistemas guardados para usar sin conexión (se refresca cuando termina de cargar uno).
  const loadedKey = (Object.keys(layers) as SystemId[]).map((k) => (layers[k].loaded ? 1 : 0)).join("");
  const { cached: offlineCached, refresh: refreshOffline } = useOfflineSystems(bodySex, systemsInfo, loadedKey);

  // Redimensionamiento interactivo arrastrando el borde derecho
  const [isDragging, setIsDragging] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const onMouseMove = (moveEvent: MouseEvent) => {
      moveEvent.preventDefault();
      const newWidth = Math.max(
        280,
        Math.min(window.innerWidth * 0.65, moveEvent.clientX)
      );
      setLeftPanelWidth(newWidth);
    };

    const onMouseUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  };

  // Estados del árbol: sistema abierto, modo acordeón (1 a la vez por defecto para vista limpia), filtro
  const [expandedSystems, setExpandedSystems] = useState<
    Partial<Record<SystemId, boolean>>
  >({
    skeletal: true,
  });
  const [expandedSubnodes, setExpandedSubnodes] = useState<
    Record<string, boolean>
  >({});
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

  // Si se selecciona una estructura en 3D o búsqueda, auto-expandir su sistema y subnodos en el árbol
  useEffect(() => {
    if (selectedId && mode === "tree") {
      const st = structures.find((s) => s.id === selectedId);
      if (st) {
        setExpandedSystems((prev) =>
          accordionMode ? { [st.system]: true } : { ...prev, [st.system]: true }
        );
        const path = getStructureHierarchyPath(st);
        const l2Id = `${st.system}/${path[0]}`;
        const l3Id = path[1] ? `${l2Id}/${path[1]}` : null;
        setExpandedSubnodes((prev) => ({
          ...prev,
          [l2Id]: true,
          ...(l3Id ? { [l3Id]: true } : {}),
        }));
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

  // Construir la jerarquía multinivel para cada sistema
  const hierarchyBySystem = useMemo(() => {
    const map = new Map<SystemId, TreeNodeItem[]>();
    for (const sys of Object.keys(SYSTEM_META) as SystemId[]) {
      const items = groupedBySystem.get(sys) || [];
      map.set(sys, buildSystemHierarchy(sys, items));
    }
    return map;
  }, [groupedBySystem]);

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

  const toggleSubnodeExpand = (branchId: string) => {
    setExpandedSubnodes((prev) => ({
      ...prev,
      [branchId]: !prev[branchId],
    }));
  };

  const collapseAllSystems = () => {
    setExpandedSystems({});
    setExpandedSubnodes({});
  };

  const expandAllSystems = () => {
    const allSys: Partial<Record<SystemId, boolean>> = {};
    const allSubs: Record<string, boolean> = {};
    for (const sys of Object.keys(SYSTEM_META) as SystemId[]) {
      allSys[sys] = true;
    }
    for (const [, treeItems] of hierarchyBySystem) {
      const visit = (items: TreeNodeItem[]) => {
        for (const it of items) {
          if (it.type === "branch") {
            allSubs[it.id] = true;
            visit(it.children);
          }
        }
      };
      visit(treeItems);
    }
    setExpandedSystems(allSys);
    setExpandedSubnodes(allSubs);
  };

  const handleToggleSystem = (sys: SystemId) => {
    const sysItems = structures.filter((s) => s.system === sys);
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

  const handleToggleBranch = (branch: TreeBranchNode) => {
    const sys = branch.system;
    const isSysEnabled = Boolean(layers[sys]?.enabled);
    const branchIds = branch.allItemIds;
    const visibleCount = isSysEnabled
      ? branchIds.filter((id) => !hiddenIds[id]).length
      : 0;

    const sysItems = structures.filter((s) => s.system === sys);

    if (visibleCount > 0) {
      // Rama con estructuras visibles -> las ocultamos todas
      setStructuresHidden(branchIds, true);
      // Si ya no queda ninguna visible en el sistema, apagamos la capa
      const otherVisible = sysItems.filter(
        (s) => !branchIds.includes(s.id) && !hiddenIds[s.id]
      ).length;
      if (otherVisible === 0) {
        setLayerEnabled(sys, false);
      }
    } else {
      // Rama apagada -> la encendemos
      if (!isSysEnabled) {
        // Si el sistema estaba apagado, activamos el sistema pero ocultando todos los demás
        // elementos ajenos a esta rama para que ÚNICAMENTE se muestre esta rama en 3D
        const otherIds = sysItems
          .map((s) => s.id)
          .filter((id) => !branchIds.includes(id));
        setStructuresHidden(otherIds, true);
        setStructuresHidden(branchIds, false);
        setLayerEnabled(sys, true);
      } else {
        // El sistema ya estaba activo, simplemente desocultamos las estructuras de esta rama
        setStructuresHidden(branchIds, false);
      }
    }
  };

  const handleToggleChild = (st: AnatomyStructure) => {
    const isSysEnabled = layers[st.system]?.enabled;
    const isExplicitlyHidden = Boolean(hiddenIds[st.id]);
    const isCurrentlyVisible = isSysEnabled && !isExplicitlyHidden;

    const sysItems = structures.filter((s) => s.system === st.system);

    if (isCurrentlyVisible) {
      // Estaba visible -> lo ocultamos
      toggleHide(st.id);
      // Si era la última estructura visible de este sistema, desactivamos la capa
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
    const sysItems = structures.filter((s) => s.system === st.system);
    if (!layers[st.system]?.enabled) {
      // Si el sistema estaba apagado y el usuario selecciona el nodo en el árbol:
      // Mostramos ÚNICAMENTE este hijo
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

  // Renderizado recursivo de elementos del árbol (subnodos / hojas)
  const renderTreeItem = (item: TreeNodeItem) => {
    if (item.type === "leaf") {
      const st = item.structure;
      const isSysEnabled = Boolean(layers[st.system]?.enabled);
      const isExplicitlyHidden = Boolean(hiddenIds[st.id]);
      const isHidden = !isSysEnabled || isExplicitlyHidden;
      const indentPx = item.level === 4 ? 36 : item.level === 3 ? 24 : 14;

      return (
        <div
          key={st.id}
          className={`tree-node-row ${
            selectedId === st.id ? "selected" : ""
          } ${isHidden ? "is-hidden" : ""}`}
          style={{ paddingLeft: `${indentPx}px` }}
        >
          <button
            className="tree-node-select"
            onClick={() => handleSelectChild(st)}
          >
            <span className="tree-node-name">{st.nameEs}</span>
            <small className="tree-node-id">{st.id}</small>
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
            {isHidden ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        </div>
      );
    }

    const branch = item;
    const isSysEnabled = Boolean(layers[branch.system]?.enabled);
    const branchIds = branch.allItemIds;
    const branchVisibleCount = isSysEnabled
      ? branchIds.filter((id) => !hiddenIds[id]).length
      : 0;
    const isBranchVisible = branchVisibleCount > 0;
    const isFiltering = Boolean(treeFilter.trim());
    const isExpanded = isFiltering || Boolean(expandedSubnodes[branch.id]);
    const indentPx = branch.level === 3 ? 24 : 14;

    return (
      <div key={branch.id} className="tree-subnode">
        <div
          className={`tree-subnode-header ${
            !isBranchVisible ? "is-hidden" : ""
          }`}
          style={{ paddingLeft: `${indentPx}px` }}
        >
          <button
            className="tree-subnode-btn"
            onClick={() => toggleSubnodeExpand(branch.id)}
            title={
              isExpanded
                ? `Colapsar ${branch.label}`
                : `Expandir ${branch.label}`
            }
          >
            {isExpanded ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )}
            <span className="tree-subnode-title">{branch.label}</span>
          </button>

          <div className="tree-subnode-actions">
            <span
              className="tree-subnode-badge"
              title={`${branchVisibleCount} de ${branchIds.length} visibles`}
            >
              {branchVisibleCount > 0 &&
              branchVisibleCount < branchIds.length
                ? `${branchVisibleCount}/${branchIds.length}`
                : branchIds.length}
            </span>

            <button
              className="icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleBranch(branch);
              }}
              title={
                isBranchVisible
                  ? `Ocultar todas las estructuras de ${branch.label}`
                  : `Mostrar todas las estructuras de ${branch.label}`
              }
            >
              {isBranchVisible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
          </div>
        </div>

        {isExpanded && branch.children.length > 0 && (
          <div className="tree-subnode-children">
            {branch.children.map((child) => renderTreeItem(child))}
          </div>
        )}
      </div>
    );
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

        {(mode !== "hubmap" || activeOrgan) && (
          <div className="slider-mode-card">
            <span className="slider-mode-label">Modo de barra:</span>
            <div className="slider-mode-toggle-btns">
              <button
                className={`btn-xs ${
                  sliderMode === "dissection" ? "active" : ""
                }`}
                onClick={() => setSliderMode("dissection")}
                title="Modo Disección (Z-Anatomy): Quita las capas superficiales para revelar las más internas"
              >
                <Layers size={12} />
                <span>Disección (Z-Anatomy)</span>
              </button>
              <button
                className={`btn-xs ${
                  sliderMode === "opacity" ? "active" : ""
                }`}
                onClick={() => setSliderMode("opacity")}
                title="Modo Transparencia (Rayos X): Vuelve las mallas translúcidas para ver a través de ellas"
              >
                <Eye size={12} />
                <span>Transparencia</span>
              </button>
            </div>
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
                  onClick={() => {
                    // Con datos móviles, activar todo puede suponer decenas de MB: se avisa antes.
                    const pending = (Object.keys(layers) as SystemId[])
                      .filter((sys) => !layers[sys].loaded)
                      .reduce((sum, sys) => sum + (infoMap.get(sys)?.optimizedBytes ?? 0), 0);
                    if (
                      showSizes &&
                      pending > 10e6 &&
                      !window.confirm(`Activar todos los sistemas descargará unos ${formatMB(pending)}. ¿Continuar?`)
                    ) {
                      return;
                    }
                    enableAllLayers(true);
                  }}
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

            <OfflinePanel
              sex={bodySex}
              systems={systemsInfo}
              cached={offlineCached}
              onChange={refreshOffline}
            />

            {lightNoticeOpen && (
              <div className="light-notice">
                <span>
                  {SAVE_DATA ? "Ahorro de datos activo: " : "Modo ligero: "}
                  se cargó solo el esqueleto. Activa otros sistemas cuando los
                  necesites; junto a cada uno se indica lo que se descargará.
                </span>
                <button className="icon-btn" aria-label="Cerrar aviso" onClick={() => setLightNoticeOpen(false)}>
                  ×
                </button>
              </div>
            )}

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
                        {offlineCached.has(sys) && (
                          <span className="badge-offline" title="Disponible sin conexión">
                            sin red ✓
                          </span>
                        )}
                        {showSizes && !st.loaded && !st.loading && !offlineCached.has(sys) && info?.optimizedBytes ? (
                          <span className="badge-size" title="Se descargará al activarlo">
                            {formatMB(info.optimizedBytes)}
                          </span>
                        ) : null}
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
                        <span className="opacity-label">
                          {sliderMode === "dissection"
                            ? "Profundidad"
                            : "Opacidad"}
                        </span>
                        <input
                          type="range"
                          min={0.05}
                          max={1}
                          step={0.05}
                          value={
                            sliderMode === "dissection"
                              ? st.depth ?? 1.0
                              : st.opacity
                          }
                          onChange={(e) =>
                            setLayerSliderValue(sys, parseFloat(e.target.value))
                          }
                        />
                        <span className="opacity-val">
                          {Math.round(
                            (sliderMode === "dissection"
                              ? st.depth ?? 1.0
                              : st.opacity) * 100
                          )}%
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
                    className="btn-xs desktop-only"
                    onClick={() => {
                      if (leftPanelWidth < 420) setLeftPanelWidth(480);
                      else if (leftPanelWidth < 560) setLeftPanelWidth(620);
                      else setLeftPanelWidth(380);
                    }}
                    title={`Ancho del panel: ${leftPanelWidth}px. Clic para alternar (380px / 480px / 620px), o arrastra el borde derecho.`}
                  >
                    <MoveHorizontal size={12} />
                    <span>{leftPanelWidth}px</span>
                  </button>
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
                      <div className="tree-header-actions">
                        {/* Control deslizante de Disección / Opacidad directamente en el árbol (estilo Z-Anatomy) */}
                        {layers[sys].enabled && (
                          <div
                            className="tree-mini-slider"
                            onClick={(e) => e.stopPropagation()}
                            title={
                              sliderMode === "dissection"
                                ? `Disección de capas: ${Math.round(
                                    (layers[sys].depth ?? 1.0) * 100
                                  )}% (desliza a la izquierda para retirar capas superficiales)`
                                : `Opacidad: ${Math.round(
                                    layers[sys].opacity * 100
                                  )}%`
                            }
                          >
                            <input
                              type="range"
                              min={0.05}
                              max={1}
                              step={0.05}
                              value={
                                sliderMode === "dissection"
                                  ? layers[sys].depth ?? 1.0
                                  : layers[sys].opacity
                              }
                              onChange={(e) =>
                                setLayerSliderValue(
                                  sys,
                                  parseFloat(e.target.value)
                                )
                              }
                            />
                            <span className="tree-slider-val">
                              {Math.round(
                                (sliderMode === "dissection"
                                  ? layers[sys].depth ?? 1.0
                                  : layers[sys].opacity) * 100
                              )}%
                            </span>
                          </div>
                        )}

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
                    </div>

                    {isExpanded && items.length > 0 && (
                      <div className="tree-children">
                        {(hierarchyBySystem.get(sys) || []).map((child) =>
                          renderTreeItem(child)
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="hubmap-list-section">
            {activeOrgan && (
              <div className="layer-card enabled hubmap-organ-card">
                <div className="layer-row">
                  <span className="layer-toggle">
                    <span
                      className="color-dot"
                      style={{ backgroundColor: SYSTEM_META[activeOrgan.system]?.colorHex }}
                    />
                    <span className="layer-name">{activeOrgan.nameEs || activeOrgan.organ}</span>
                  </span>
                  {(isolatedId || Object.keys(hiddenIds).length > 0) && (
                    <button
                      className="btn-xs"
                      onClick={showAllStructures}
                      title="Mostrar de nuevo todas las subestructuras"
                    >
                      <RotateCcw size={12} />
                      <span>Mostrar todo</span>
                    </button>
                  )}
                </div>

                <div className="opacity-row">
                  <span className="opacity-label">
                    {sliderMode === "dissection" ? "Profundidad" : "Opacidad"}
                  </span>
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={sliderMode === "dissection" ? hubmapLayer.depth : hubmapLayer.opacity}
                    onChange={(e) => setHubmapSliderValue(parseFloat(e.target.value))}
                    title={
                      sliderMode === "dissection"
                        ? "Desliza a la izquierda para retirar las subestructuras externas"
                        : "Desliza a la izquierda para ver a través del órgano"
                    }
                  />
                  <span className="opacity-val">
                    {Math.round(
                      (sliderMode === "dissection" ? hubmapLayer.depth : hubmapLayer.opacity) * 100
                    )}%
                  </span>
                </div>

                <label
                  className="hubmap-ghost-check"
                  title="Colorea cada pieza según su tipo (arterias rojas, venas azules, válvulas marfil…) en lugar del color único original"
                >
                  <input
                    type="checkbox"
                    checked={hubmapPartColors}
                    onChange={toggleHubmapPartColors}
                  />
                  <span>Colores por pieza</span>
                </label>

                <label
                  className="hubmap-ghost-check"
                  title="Al seleccionar una subestructura, el resto del órgano se vuelve translúcido"
                >
                  <input
                    type="checkbox"
                    checked={hubmapGhostOthers}
                    onChange={toggleHubmapGhostOthers}
                  />
                  <span>Atenuar el resto al seleccionar</span>
                </label>

                <div className="hubmap-nodes">
                  {activeOrgan.nodes.map((n, i) => {
                    const isHidden =
                      Boolean(hiddenIds[n.nodeName]) ||
                      (isolatedId !== null && isolatedId !== n.nodeName);
                    return (
                      <div
                        key={`${n.nodeName}-${i}`}
                        className={`tree-node-row ${selectedId === n.nodeName ? "selected" : ""} ${
                          isHidden ? "is-hidden" : ""
                        }`}
                      >
                        <button
                          className="tree-node-select"
                          onClick={() => selectStructure(n.nodeName)}
                          title={n.nodeName}
                        >
                          <span className="tree-node-name">{n.nameEs || n.nameEn}</span>
                        </button>
                        <button
                          className={`icon-btn ${isolatedId === n.nodeName ? "active" : ""}`}
                          onClick={() => toggleIsolate(n.nodeName)}
                          title={
                            isolatedId === n.nodeName ? "Salir de aislar" : "Aislar esta subestructura"
                          }
                        >
                          <Crosshair size={13} />
                        </button>
                        <button
                          className="icon-btn"
                          onClick={() => toggleHide(n.nodeName)}
                          title={hiddenIds[n.nodeName] ? "Mostrar" : "Ocultar"}
                        >
                          {hiddenIds[n.nodeName] ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

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
                  onClick={() => {
                    // Los modelos de HuBMAP no están optimizados: en móvil se avisa de los grandes.
                    const bytes = hubmapGlbBytes(org) ?? 0;
                    if (
                      showSizes &&
                      bytes > 15e6 &&
                      activeHubmapOrganId !== org.id &&
                      !window.confirm(`«${org.nameEs || org.organ}» descargará unos ${formatMB(bytes)}. ¿Continuar?`)
                    ) {
                      return;
                    }
                    setMode("hubmap", org.id);
                  }}
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
                    <span>
                      {org.nodesCount} subestructuras
                      {hubmapGlbBytes(org) ? ` · ${formatMB(hubmapGlbBytes(org)!)}` : ""}
                    </span>
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

      {/* Tirador interactivo de borde para arrastrar y cambiar el ancho del panel */}
      <div
        className={`panel-resizer-edge ${isDragging ? "is-dragging" : ""}`}
        onMouseDown={startResizing}
        onDoubleClick={() => setLeftPanelWidth(380)}
        title="Arrastra para cambiar el ancho del panel (Doble clic: restablecer a 380px)"
      >
        <div className="panel-resizer-handle" />
      </div>
    </aside>
  );
}
