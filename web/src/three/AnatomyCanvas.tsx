import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { AdaptiveDpr, OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import { MeshoptDecoder } from "meshoptimizer";
import {
  SYSTEM_META,
  SystemId,
  AnatomyStructure,
  HubmapOrgan,
} from "../data/types";
import { KEY_LANDMARK_IDS } from "../data/didacticData";
import { cameraBridge, Vec3 } from "../data/viewState";
import { LOW_POWER } from "../data/devicePerf";
import { useLayout } from "../hooks/useLayout";
import { hubmapGlbUrl } from "../data/hubmap";
import { hubmapPartColor } from "../data/hubmapColors";
import { useViewerStore } from "../store/useViewerStore";

// Un clic (o toque) solo selecciona si el puntero apenas se movió entre pulsar y soltar: al
// girar el modelo con el dedo el gesto termina sobre una malla y no debe contar como selección
// (ni como respuesta en el modo clic 3D del cuestionario). R3F da esa distancia en event.delta.
const TAP_TOLERANCE_PX = 8;
const isTap = (e: ThreeEvent<MouseEvent>) => e.delta <= TAP_TOLERANCE_PX;

// El raycasting de R3F/three también alcanza mallas con visible = false (ocultas, aisladas fuera
// o retiradas por la disección). Sus manejadores salen sin detener la propagación, así el
// evento llega a la siguiente malla bajo el puntero, que es la que el usuario ve.

// Con el dedo no hay "pasar por encima": el resaltado de hover solo se usa con ratón o lápiz.
const isTouch = (e: ThreeEvent<PointerEvent>) => e.pointerType === "touch";

interface Pin3D {
  structureId: string;
  labelEs: string;
  position: [number, number, number];
  colorHex: string;
}

interface SystemLayerProps {
  system: SystemId;
  glbUrl: string;
  structureById: Map<string, AnatomyStructure>;
  structureByMeshName: Map<string, AnatomyStructure>;
  clippingPlanes: THREE.Plane[];
  showLabels3D: boolean;
}

function SystemLayerGroup({
  system,
  glbUrl,
  structureById,
  structureByMeshName,
  clippingPlanes,
  showLabels3D,
}: SystemLayerProps) {
  const layer = useViewerStore((s) => s.layers[system]);
  const selectedId = useViewerStore((s) => s.selectedId);
  const hoveredId = useViewerStore((s) => s.hoveredId);
  const isolatedId = useViewerStore((s) => s.isolatedId);
  const hiddenIds = useViewerStore((s) => s.hiddenIds);
  const setLayerLoading = useViewerStore((s) => s.setLayerLoading);
  const selectStructure = useViewerStore((s) => s.selectStructure);
  const pickStructure3D = useViewerStore((s) => s.pickStructure3D);
  const hoverStructure = useViewerStore((s) => s.hoverStructure);
  // Con frameloop="demand" (dispositivos de bajo consumo) hay que pedir un fotograma tras
  // modificar materiales u objetos directamente, fuera de React.
  const invalidate = useThree((s) => s.invalidate);

  const [sceneRoot, setSceneRoot] = useState<THREE.Group | null>(null);
  const [landmarks, setLandmarks] = useState<Pin3D[]>([]);
  const centerByIdRef = useRef<Map<string, [number, number, number]>>(new Map());
  const meshesRef = useRef<
    Array<{
      mesh: THREE.Mesh;
      structureId: string;
      baseMat: THREE.MeshStandardMaterial;
      radialDist: number;
    }>
  >([]);
  const rangeRRef = useRef<{ minR: number; maxR: number }>({ minR: 0, maxR: 1 });

  const sliderMode = useViewerStore((s) => s.sliderMode);

  useEffect(() => {
    setSceneRoot(null);
    setLandmarks([]);
    centerByIdRef.current.clear();
    meshesRef.current = [];
  }, [glbUrl]);

  useEffect(() => {
    if (!layer.enabled || sceneRoot) return;
    let cancelled = false;
    setLayerLoading(system, true, false);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);

    loader.load(
      glbUrl,
      (gltf) => {
        if (cancelled) return;
        const root = gltf.scene;
        root.updateMatrixWorld(true);

        const baseColor = new THREE.Color(SYSTEM_META[system].colorHex);
        const list: Array<{
          mesh: THREE.Mesh;
          structureId: string;
          baseMat: THREE.MeshStandardMaterial;
          radialDist: number;
        }> = [];
        const centers = new Map<string, THREE.Box3>();

        root.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const mesh = obj as THREE.Mesh;
            const rawName = mesh.name || obj.parent?.name || "";
            const st =
              structureByMeshName.get(rawName) ||
              structureByMeshName.get(obj.parent?.name || "");
            const cid =
              st?.id ||
              (mesh.userData?.id as string) ||
              (obj.parent?.userData?.id as string) ||
              rawName;

            const mat = new THREE.MeshStandardMaterial({
              color: baseColor,
              roughness: 0.52,
              metalness: 0.06,
              side: THREE.DoubleSide,
            });
            mesh.material = mat;
            mesh.userData.structureId = cid;
            mesh.userData.system = system;
            const box = new THREE.Box3().setFromObject(mesh);
            const c = box.getCenter(new THREE.Vector3());
            const radialDist = Math.sqrt(c.x * c.x + c.z * c.z);
            list.push({ mesh, structureId: cid, baseMat: mat, radialDist });

            if (!box.isEmpty()) {
              const prev = centers.get(cid);
              if (prev) {
                prev.union(box);
              } else {
                centers.set(cid, box);
              }
            }
          }
        });

        const pins: Pin3D[] = [];
        const centerMap = new Map<string, [number, number, number]>();
        centers.forEach((box, cid) => {
          const c = box.getCenter(new THREE.Vector3());
          const pos: [number, number, number] = [c.x, c.y, c.z];
          centerMap.set(cid, pos);
          if (KEY_LANDMARK_IDS.has(cid)) {
            const st = structureById.get(cid);
            pins.push({
              structureId: cid,
              labelEs: st?.nameEs || cid,
              position: pos,
              colorHex: SYSTEM_META[system].colorHex,
            });
          }
        });

        let minR = Infinity;
        let maxR = -Infinity;
        for (const item of list) {
          if (item.radialDist < minR) minR = item.radialDist;
          if (item.radialDist > maxR) maxR = item.radialDist;
        }
        rangeRRef.current = {
          minR: Number.isFinite(minR) ? minR : 0,
          maxR: Number.isFinite(maxR) && maxR > minR ? maxR : (minR || 0) + 0.001,
        };

        centerByIdRef.current = centerMap;
        setLandmarks(pins);
        meshesRef.current = list;
        setSceneRoot(root);
        setLayerLoading(system, false, true);
      },
      undefined,
      (err) => {
        console.error(`Error cargando ${glbUrl}:`, err);
        if (!cancelled) setLayerLoading(system, false, false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [layer.enabled, sceneRoot, glbUrl]);

  useEffect(() => {
    if (!sceneRoot) return;

    const { minR, maxR } = rangeRRef.current;
    const range = maxR > minR ? maxR - minR : 1;

    for (const item of meshesRef.current) {
      const { mesh, structureId, baseMat, radialDist } = item;
      const isHidden = !!hiddenIds[structureId];
      const isIsolatedOut = isolatedId !== null && isolatedId !== structureId;

      // Disección por capas (Z-Anatomy):
      // normDepth va de 0.0 (estructuras más internas) a 1.0 (más superficiales)
      const normDepth = (radialDist - minR) / range;
      const isPeeledOut =
        sliderMode === "dissection" && normDepth > (layer.depth ?? 1.0);

      mesh.visible =
        layer.enabled && !isHidden && !isIsolatedOut && !isPeeledOut;

      if (!mesh.visible) continue;

      const isTransparent = sliderMode === "opacity" && layer.opacity < 0.99;

      baseMat.transparent = isTransparent;
      baseMat.opacity = sliderMode === "opacity" ? layer.opacity : 1.0;
      baseMat.depthWrite = !isTransparent;
      baseMat.clippingPlanes = clippingPlanes;
      baseMat.clipShadows = true;

      const isSelected = selectedId === structureId;
      const isHovered = hoveredId === structureId;

      if (isSelected) {
        baseMat.emissive.setHex(0x0ea5e9);
        baseMat.emissiveIntensity = 0.58;
      } else if (isHovered) {
        baseMat.emissive.setHex(0x38bdf8);
        baseMat.emissiveIntensity = 0.28;
      } else {
        baseMat.emissive.setHex(0x000000);
        baseMat.emissiveIntensity = 0;
      }
      baseMat.needsUpdate = true;
    }
    invalidate();
  }, [
    invalidate,
    sceneRoot,
    layer.enabled,
    layer.opacity,
    layer.depth,
    sliderMode,
    selectedId,
    hoveredId,
    isolatedId,
    hiddenIds,
    clippingPlanes,
  ]);

  if (!sceneRoot || !layer.enabled) return null;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!e.object.visible) return;
    e.stopPropagation();
    if (!isTap(e)) return;
    const hit = e.object as THREE.Mesh;
    const cid = hit.userData?.structureId as string | undefined;
    if (cid) {
      pickStructure3D(cid);
    }
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    if (!e.object.visible) return;
    e.stopPropagation();
    if (isTouch(e)) return;
    const hit = e.object as THREE.Mesh;
    const cid = hit.userData?.structureId as string | undefined;
    if (cid) {
      hoverStructure(cid);
      document.body.style.cursor = "pointer";
    }
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    hoverStructure(null);
    document.body.style.cursor = "auto";
  };

  // Pin de la estructura seleccionada (aunque los pines globales estén apagados, si está activo showLabels3D se muestran todos)
  const selectedCenter =
    selectedId && centerByIdRef.current.has(selectedId)
      ? centerByIdRef.current.get(selectedId)!
      : null;
  const selectedStruct = selectedId ? structureById.get(selectedId) : null;

  return (
    <group>
      <primitive
        object={sceneRoot}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      />

      {showLabels3D &&
        landmarks.map((pin) => {
          if (hiddenIds[pin.structureId]) return null;
          if (isolatedId && isolatedId !== pin.structureId) return null;
          const isSel = selectedId === pin.structureId;
          return (
            <Html
              key={pin.structureId}
              position={pin.position}
              center
              zIndexRange={[10, 0]}
            >
              <button
                className={`pin-3d ${isSel ? "selected" : ""}`}
                onClick={(e) => {
                  e.stopPropagation();
                  selectStructure(pin.structureId);
                }}
              >
                <span
                  className="pin-dot"
                  style={{ backgroundColor: pin.colorHex }}
                />
                <span className="pin-text">{pin.labelEs}</span>
              </button>
            </Html>
          );
        })}
    </group>
  );
}

function HubmapOrganScene({
  organ,
  clippingPlanes,
}: {
  organ: HubmapOrgan;
  clippingPlanes: THREE.Plane[];
}) {
  const [root, setRoot] = useState<THREE.Group | null>(null);
  const [loading, setLoading] = useState(false);
  const selectedId = useViewerStore((s) => s.selectedId);
  const hoveredId = useViewerStore((s) => s.hoveredId);
  const isolatedId = useViewerStore((s) => s.isolatedId);
  const hiddenIds = useViewerStore((s) => s.hiddenIds);
  const sliderMode = useViewerStore((s) => s.sliderMode);
  const hubmapLayer = useViewerStore((s) => s.hubmapLayer);
  const ghostOthers = useViewerStore((s) => s.hubmapGhostOthers);
  const partColors = useViewerStore((s) => s.hubmapPartColors);
  const selectStructure = useViewerStore((s) => s.selectStructure);
  const hoverStructure = useViewerStore((s) => s.hoverStructure);
  const invalidate = useThree((s) => s.invalidate);
  // Cada malla con su material propio y los nombres de sus nodos padre: así se puede resaltar,
  // ocultar o aislar una subestructura o un grupo (p. ej. "VH_M_heart_valve" engloba las cuatro
  // válvulas). normDepth va de 0 (la más interna) a 1 (la más externa), para la disección.
  const meshesRef = useRef<
    Array<{
      mesh: THREE.Mesh;
      mat: THREE.MeshStandardMaterial;
      ids: Set<string>;
      normDepth: number;
      originalColor: THREE.Color;
      partColor: THREE.Color;
    }>
  >([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRoot(null);
    meshesRef.current = [];

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    // Desde el CDN oficial de HuBMAP (D-023); permite CORS.
    loader.load(
      hubmapGlbUrl(organ),
      (gltf) => {
        if (cancelled) return;
        const group = gltf.scene;

        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const scale = 0.85 / maxDim;

        group.position.set(
          -center.x * scale,
          -center.y * scale + 0.85,
          -center.z * scale
        );
        group.scale.setScalar(scale);
        group.updateMatrixWorld(true);

        const list: typeof meshesRef.current = [];
        const volumes: number[] = [];
        group.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            const nodeName = m.name || m.parent?.name || organ.organ;
            m.userData.structureId = nodeName;

            // Los GLB de HuBMAP comparten un único material entre todas las mallas (el corazón
            // usa "heart_mat" para las 14): cambiar su brillo resaltaría todo o nada. Se clona.
            const src = Array.isArray(m.material) ? m.material[0] : m.material;
            const originalColor =
              (src as THREE.MeshStandardMaterial)?.color?.clone() ?? new THREE.Color(0xb05050);
            const mat = new THREE.MeshStandardMaterial({
              color: originalColor.clone(),
              roughness: Math.max((src as THREE.MeshStandardMaterial)?.roughness ?? 0.5, 0.45),
              metalness: (src as THREE.MeshStandardMaterial)?.metalness ?? 0,
              side: THREE.DoubleSide,
            });
            m.material = mat;

            const ids = new Set<string>([nodeName]);
            for (let p = m.parent; p && p !== group; p = p.parent) {
              if (p.name) ids.add(p.name);
            }
            list.push({
              mesh: m,
              mat,
              ids,
              normDepth: 1,
              originalColor,
              partColor: hubmapPartColor(nodeName),
            });
            const s = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
            volumes.push(s.x * s.y * s.z);
          }
        });

        // En un órgano aislado no sirve la distancia al eje del cuerpo que usan los sistemas: las
        // estructuras externas (cavidades, corteza) envuelven a las internas y son las de mayor
        // volumen. Se ordenan por volumen de su caja y se reparten por igual en la barra.
        const order = volumes.map((v, i) => i).sort((a, b) => volumes[a] - volumes[b]);
        order.forEach((idx, rank) => {
          list[idx].normDepth = order.length > 1 ? rank / (order.length - 1) : 1;
        });

        meshesRef.current = list;
        setRoot(group);
        setLoading(false);
      },
      undefined,
      (err) => {
        console.error("Error cargando órgano HuBMAP:", err);
        if (!cancelled) setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [organ]);

  useEffect(() => {
    if (!root) return;
    const list = meshesRef.current;
    const isVisible = (ids: Set<string>, normDepth: number) => {
      for (const id of ids) if (hiddenIds[id]) return false;
      if (isolatedId && !ids.has(isolatedId)) return false;
      return !(sliderMode === "dissection" && normDepth > hubmapLayer.depth);
    };
    // Solo se atenúa el resto si la selección corresponde a alguna malla visible de este órgano.
    const hasSelection =
      !!selectedId && list.some((it) => it.ids.has(selectedId) && isVisible(it.ids, it.normDepth));
    const baseOpacity = sliderMode === "opacity" ? hubmapLayer.opacity : 1;

    for (const { mesh, mat, ids, normDepth, originalColor, partColor } of list) {
      mesh.visible = isVisible(ids, normDepth);
      if (!mesh.visible) continue;
      mat.color.copy(partColors ? partColor : originalColor);
      const isSelected = hasSelection && ids.has(selectedId!);
      const isHovered = !!hoveredId && ids.has(hoveredId);

      if (isSelected) {
        mat.emissive.setHex(0x0ea5e9);
        mat.emissiveIntensity = 0.58;
      } else if (isHovered) {
        mat.emissive.setHex(0x38bdf8);
        mat.emissiveIntensity = 0.28;
      } else {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }

      // Opcional: con una subestructura seleccionada, las demás quedan translúcidas para ver
      // también las internas (válvulas, músculos papilares) tapadas por las cavidades.
      const ghost = ghostOthers && hasSelection && !isSelected;
      const opacity = ghost ? Math.min(0.22, baseOpacity) : baseOpacity;
      mat.transparent = opacity < 0.99;
      mat.opacity = opacity;
      mat.depthWrite = !mat.transparent;
      mat.clippingPlanes = clippingPlanes;
      mat.needsUpdate = true;
    }
    invalidate();
  }, [
    root,
    selectedId,
    hoveredId,
    isolatedId,
    hiddenIds,
    sliderMode,
    hubmapLayer,
    ghostOthers,
    partColors,
    clippingPlanes,
    invalidate,
  ]);

  // Al cambiar de órgano no debe quedar el cursor de "mano" ni un hover huérfano.
  useEffect(
    () => () => {
      hoverStructure(null);
      document.body.style.cursor = "auto";
    },
    [organ, hoverStructure]
  );

  if (loading) {
    return (
      <Html center>
        <div className="loading-pill">
          Cargando órgano 3D ({organ.nameEs || organ.organ})…
        </div>
      </Html>
    );
  }

  if (!root) return null;

  return (
    <primitive
      object={root}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!e.object.visible) return;
        e.stopPropagation();
        if (!isTap(e)) return;
        const id = e.object.userData?.structureId;
        if (id) selectStructure(id);
      }}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        if (!e.object.visible) return;
        e.stopPropagation();
        if (isTouch(e)) return;
        const id = e.object.userData?.structureId;
        if (id) {
          hoverStructure(id);
          document.body.style.cursor = "pointer";
        }
      }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        hoverStructure(null);
        document.body.style.cursor = "auto";
      }}
    />
  );
}

function CameraController() {
  const cameraPreset = useViewerStore((s) => s.cameraPreset);
  const cameraView = useViewerStore((s) => s.cameraView);
  const sheetPanel = useViewerStore((s) => s.sheet.panel);
  const sheetSize = useViewerStore((s) => s.sheet.size);
  const layout = useLayout();
  const { camera, invalidate, size } = useThree();

  // Móvil con el panel a media altura: el panel tapa la mitad inferior del visor, así que se
  // desplaza la imagen para centrar el modelo en la mitad visible. setViewOffset cambia la
  // proyección, que también usan el raycasting y los pines: los toques siguen apuntando bien.
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    if (layout === "mobile" && sheetPanel && sheetSize === "half") {
      cam.setViewOffset(size.width, size.height, 0, size.height * 0.25, size.width, size.height);
    } else {
      cam.clearViewOffset();
    }
    cam.updateProjectionMatrix();
    invalidate();
  }, [layout, sheetPanel, sheetSize, size.width, size.height, camera, invalidate]);
  const controlsRef = useRef<any>(null);

  // Permite leer la cámara desde fuera del Canvas para guardar vistas.
  useEffect(() => {
    cameraBridge.read = () => ({
      position: camera.position.toArray() as Vec3,
      target: (controlsRef.current?.target ?? new THREE.Vector3(0, 0.88, 0)).toArray() as Vec3,
    });
    return () => {
      cameraBridge.read = null;
    };
  }, [camera]);

  // Vista guardada: posición y punto de mira exactos.
  useEffect(() => {
    if (!cameraView) return;
    camera.position.set(...cameraView.position);
    if (controlsRef.current) {
      controlsRef.current.target.set(...cameraView.target);
      controlsRef.current.update();
    }
    invalidate();
  }, [cameraView, camera, invalidate]);

  useEffect(() => {
    const target = new THREE.Vector3(0, 0.88, 0);
    const dist = 2.05;
    switch (cameraPreset.preset) {
      case "front":
      case "reset":
        camera.position.set(0, 0.92, dist);
        break;
      case "back":
        camera.position.set(0, 0.92, -dist);
        break;
      case "left":
        camera.position.set(dist, 0.92, 0);
        break;
      case "right":
        camera.position.set(-dist, 0.92, 0);
        break;
      case "top":
        camera.position.set(0, 2.55, 0.01);
        break;
    }
    if (controlsRef.current) {
      controlsRef.current.target.copy(target);
      controlsRef.current.update();
    }
    invalidate();
  }, [cameraPreset, camera, invalidate]);

  return (
    <OrbitControls
      ref={controlsRef}
      // Táctil: un dedo gira; dos dedos pellizcan para el zoom y arrastran para desplazar.
      touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      // Mientras se gira, AdaptiveDpr baja la resolución en los dispositivos de bajo consumo.
      regress={LOW_POWER}
      target={[0, 0.88, 0]}
      enableDamping
      dampingFactor={0.08}
      minDistance={0.18}
      maxDistance={4.5}
    />
  );
}

export function AnatomyCanvas({
  structureById,
  structureByMeshName,
  hubmapById,
}: {
  structureById: Map<string, AnatomyStructure>;
  structureByMeshName: Map<string, AnatomyStructure>;
  hubmapById: Map<string, HubmapOrgan>;
}) {
  const mode = useViewerStore((s) => s.mode);
  const bodySex = useViewerStore((s) => s.bodySex);
  const activeHubmapOrganId = useViewerStore((s) => s.activeHubmapOrganId);
  const clip = useViewerStore((s) => s.clip);
  const showLabels3D = useViewerStore((s) => s.showLabels3D);
  // En el cuestionario los pines se ocultan: sus etiquetas revelarían las respuestas.
  const quizActive = useViewerStore((s) => s.rightTab === "quiz");
  const theme = useViewerStore((s) => s.theme);
  const selectStructure = useViewerStore((s) => s.selectStructure);

  const clippingPlanes = useMemo(() => {
    const planes: THREE.Plane[] = [];
    if (clip.axialY !== null) {
      const sign = clip.invertY ? 1 : -1;
      planes.push(
        new THREE.Plane(new THREE.Vector3(0, sign, 0), -sign * clip.axialY)
      );
    }
    if (clip.sagittalX !== null) {
      const sign = clip.invertX ? 1 : -1;
      planes.push(
        new THREE.Plane(new THREE.Vector3(sign, 0, 0), -sign * clip.sagittalX)
      );
    }
    if (clip.coronalZ !== null) {
      const sign = clip.invertZ ? 1 : -1;
      planes.push(
        new THREE.Plane(new THREE.Vector3(0, 0, sign), -sign * clip.coronalZ)
      );
    }
    return planes;
  }, [clip]);

  const activeOrgan = activeHubmapOrganId
    ? hubmapById.get(activeHubmapOrganId)
    : null;
  const bgColor = theme === "light" ? "#f1f5f9" : "#0b1120";
  const gridColor1 = theme === "light" ? "#cbd5e1" : "#1e293b";
  const gridColor2 = theme === "light" ? "#e2e8f0" : "#0f172a";

  return (
    <Canvas
      camera={{ position: [0, 0.92, 2.05], fov: 42, near: 0.01, far: 25 }}
      gl={{ localClippingEnabled: true, antialias: !LOW_POWER }}
      // Bajo consumo: resolución máxima 1,5× y solo se dibuja cuando algo cambia (no 60 fps fijos).
      dpr={LOW_POWER ? [1, 1.5] : [1, 2]}
      frameloop={LOW_POWER ? "demand" : "always"}
      performance={{ min: 0.5 }}
      onPointerMissed={() => selectStructure(null)}
    >
      {LOW_POWER && <AdaptiveDpr />}
      <color attach="background" args={[bgColor]} />
      <ambientLight intensity={0.68} />
      <hemisphereLight args={["#e2e8f0", "#1e293b", 0.55]} />
      <directionalLight position={[2.5, 3.5, 3.0]} intensity={1.15} />
      <directionalLight position={[-2.5, 2.0, -2.5]} intensity={0.65} />
      <directionalLight position={[0, -2.0, 1.5]} intensity={0.25} />

      <gridHelper
        args={[2.4, 24, gridColor1, gridColor2]}
        position={[0, 0, 0]}
      />

      {mode !== "hubmap" &&
        (Object.keys(SYSTEM_META) as SystemId[]).map((sys) => {
          const glbUrl =
            bodySex === "female"
              ? `/data/processed/female_${sys}.glb`
              : `/data/processed/${sys}.glb`;
          return (
            <SystemLayerGroup
              key={`${bodySex}-${sys}`}
              system={sys}
              glbUrl={glbUrl}
              structureById={structureById}
              structureByMeshName={structureByMeshName}
              clippingPlanes={clippingPlanes}
              showLabels3D={showLabels3D && !quizActive}
            />
          );
        })}

      {mode === "hubmap" && activeOrgan && (
        <HubmapOrganScene
          organ={activeOrgan}
          clippingPlanes={clippingPlanes}
        />
      )}

      <CameraController />
    </Canvas>
  );
}
