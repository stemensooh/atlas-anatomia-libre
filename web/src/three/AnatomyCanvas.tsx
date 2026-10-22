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
import { useViewerStore } from "../store/useViewerStore";

// Un clic (o toque) solo selecciona si el puntero apenas se movió entre pulsar y soltar: al
// girar el modelo con el dedo el gesto termina sobre una malla y no debe contar como selección
// (ni como respuesta en el modo clic 3D del cuestionario). R3F da esa distancia en event.delta.
const TAP_TOLERANCE_PX = 8;
const isTap = (e: ThreeEvent<MouseEvent>) => e.delta <= TAP_TOLERANCE_PX;

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
    e.stopPropagation();
    if (!isTap(e)) return;
    const hit = e.object as THREE.Mesh;
    const cid = hit.userData?.structureId as string | undefined;
    if (cid) {
      pickStructure3D(cid);
    }
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
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
  const selectStructure = useViewerStore((s) => s.selectStructure);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRoot(null);

    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    loader.load(
      `/${organ.glbFile}`,
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

        group.traverse((obj) => {
          if ((obj as THREE.Mesh).isMesh) {
            const m = obj as THREE.Mesh;
            const nodeName = m.name || m.parent?.name || organ.organ;
            m.userData.structureId = nodeName;
            if (Array.isArray(m.material)) {
              m.material.forEach((mt) => {
                mt.clippingPlanes = clippingPlanes;
                mt.side = THREE.DoubleSide;
              });
            } else if (m.material) {
              m.material.clippingPlanes = clippingPlanes;
              m.material.side = THREE.DoubleSide;
            }
          }
        });

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
  }, [organ.glbFile]);

  useEffect(() => {
    if (!root) return;
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat && mat.emissive) {
          if (selectedId && m.userData.structureId === selectedId) {
            mat.emissive.setHex(0x0ea5e9);
            mat.emissiveIntensity = 0.45;
          } else {
            mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0;
          }
        }
        if (mat) {
          mat.clippingPlanes = clippingPlanes;
        }
      }
    });
    invalidate();
  }, [root, selectedId, clippingPlanes, invalidate]);

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
        e.stopPropagation();
        if (!isTap(e)) return;
        const id = e.object.userData?.structureId;
        if (id) selectStructure(id);
      }}
    />
  );
}

function CameraController() {
  const cameraPreset = useViewerStore((s) => s.cameraPreset);
  const cameraView = useViewerStore((s) => s.cameraView);
  const { camera, invalidate } = useThree();
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
