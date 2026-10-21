import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { GLTFLoader } from "three-stdlib";
import { MeshoptDecoder } from "meshoptimizer";
import { SYSTEM_META, SystemId, AnatomyStructure, HubmapOrgan } from "../data/types";
import { useViewerStore } from "../store/useViewerStore";

interface SystemLayerProps {
  system: SystemId;
  glbUrl: string;
  structureByMeshName: Map<string, AnatomyStructure>;
  clippingPlanes: THREE.Plane[];
}

function SystemLayerGroup({
  system,
  glbUrl,
  structureByMeshName,
  clippingPlanes,
}: SystemLayerProps) {
  const layer = useViewerStore((s) => s.layers[system]);
  const selectedId = useViewerStore((s) => s.selectedId);
  const hoveredId = useViewerStore((s) => s.hoveredId);
  const isolatedId = useViewerStore((s) => s.isolatedId);
  const hiddenIds = useViewerStore((s) => s.hiddenIds);
  const setLayerLoading = useViewerStore((s) => s.setLayerLoading);
  const selectStructure = useViewerStore((s) => s.selectStructure);
  const hoverStructure = useViewerStore((s) => s.hoverStructure);

  const [sceneRoot, setSceneRoot] = useState<THREE.Group | null>(null);
  const meshesRef = useRef<
    Array<{
      mesh: THREE.Mesh;
      structureId: string;
      baseMat: THREE.MeshStandardMaterial;
    }>
  >([]);

  // Reiniciar escena cuando cambia glbUrl (masculino <-> femenino)
  useEffect(() => {
    setSceneRoot(null);
    meshesRef.current = [];
  }, [glbUrl]);

  // Carga bajo demanda cuando se activa la capa
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
        const baseColor = new THREE.Color(SYSTEM_META[system].colorHex);
        const list: Array<{
          mesh: THREE.Mesh;
          structureId: string;
          baseMat: THREE.MeshStandardMaterial;
        }> = [];

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
            list.push({ mesh, structureId: cid, baseMat: mat });
          }
        });

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

  // Actualizar visibilidad, opacidad, resaltado y planos de corte
  useEffect(() => {
    if (!sceneRoot) return;
    const isTransparent = layer.opacity < 0.99;

    for (const item of meshesRef.current) {
      const { mesh, structureId, baseMat } = item;
      const isHidden = !!hiddenIds[structureId];
      const isIsolatedOut = isolatedId !== null && isolatedId !== structureId;
      mesh.visible = layer.enabled && !isHidden && !isIsolatedOut;

      if (!mesh.visible) continue;

      const isSelected = selectedId === structureId;
      const isHovered = hoveredId === structureId;

      baseMat.transparent = isTransparent;
      baseMat.opacity = layer.opacity;
      baseMat.depthWrite = !isTransparent;
      baseMat.clippingPlanes = clippingPlanes;
      baseMat.clipShadows = true;

      if (isSelected) {
        baseMat.emissive.setHex(0x0ea5e9);
        baseMat.emissiveIntensity = 0.55;
      } else if (isHovered) {
        baseMat.emissive.setHex(0x38bdf8);
        baseMat.emissiveIntensity = 0.28;
      } else {
        baseMat.emissive.setHex(0x000000);
        baseMat.emissiveIntensity = 0;
      }
      baseMat.needsUpdate = true;
    }
  }, [
    sceneRoot,
    layer.enabled,
    layer.opacity,
    selectedId,
    hoveredId,
    isolatedId,
    hiddenIds,
    clippingPlanes,
  ]);

  if (!sceneRoot || !layer.enabled) return null;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    const hit = e.object as THREE.Mesh;
    const cid = hit.userData?.structureId as string | undefined;
    if (cid) {
      selectStructure(cid);
    }
  };

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
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

  return (
    <primitive
      object={sceneRoot}
      onClick={handleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    />
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

        // Centrar y normalizar escala del órgano de HuBMAP para inspección cómoda
        const box = new THREE.Box3().setFromObject(group);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 0.001);
        const scale = 0.85 / maxDim;

        group.position.set(-center.x * scale, -center.y * scale + 0.85, -center.z * scale);
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

  // Resaltar nodo seleccionado en HuBMAP
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
  }, [root, selectedId, clippingPlanes]);

  if (loading) {
    return (
      <Html center>
        <div className="loading-pill">Cargando órgano 3D ({organ.organ})…</div>
      </Html>
    );
  }

  if (!root) return null;

  return (
    <primitive
      object={root}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        const id = e.object.userData?.structureId;
        if (id) selectStructure(id);
      }}
    />
  );
}

function CameraController() {
  const cameraPreset = useViewerStore((s) => s.cameraPreset);
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);

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
  }, [cameraPreset, camera]);

  return (
    <OrbitControls
      ref={controlsRef}
      target={[0, 0.88, 0]}
      enableDamping
      dampingFactor={0.08}
      minDistance={0.18}
      maxDistance={4.5}
    />
  );
}

export function AnatomyCanvas({
  structureByMeshName,
  hubmapById,
}: {
  structureByMeshName: Map<string, AnatomyStructure>;
  hubmapById: Map<string, HubmapOrgan>;
}) {
  const mode = useViewerStore((s) => s.mode);
  const bodySex = useViewerStore((s) => s.bodySex);
  const activeHubmapOrganId = useViewerStore((s) => s.activeHubmapOrganId);
  const clipY = useViewerStore((s) => s.clipY);
  const selectStructure = useViewerStore((s) => s.selectStructure);

  const clippingPlanes = useMemo(() => {
    if (clipY === null) return [];
    return [new THREE.Plane(new THREE.Vector3(0, -1, 0), clipY)];
  }, [clipY]);

  const activeOrgan = activeHubmapOrganId ? hubmapById.get(activeHubmapOrganId) : null;

  return (
    <Canvas
      camera={{ position: [0, 0.92, 2.05], fov: 42, near: 0.01, far: 25 }}
      gl={{ localClippingEnabled: true, antialias: true }}
      onPointerMissed={() => selectStructure(null)}
    >
      <color attach="background" args={["#0b1120"]} />
      <ambientLight intensity={0.65} />
      <hemisphereLight args={["#e2e8f0", "#1e293b", 0.55]} />
      <directionalLight position={[2.5, 3.5, 3.0]} intensity={1.15} />
      <directionalLight position={[-2.5, 2.0, -2.5]} intensity={0.65} />
      <directionalLight position={[0, -2.0, 1.5]} intensity={0.25} />

      <gridHelper args={[2.4, 24, "#1e293b", "#0f172a"]} position={[0, 0, 0]} />

      {mode === "body" &&
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
              structureByMeshName={structureByMeshName}
              clippingPlanes={clippingPlanes}
            />
          );
        })}

      {mode === "hubmap" && activeOrgan && (
        <HubmapOrganScene organ={activeOrgan} clippingPlanes={clippingPlanes} />
      )}

      <CameraController />
    </Canvas>
  );
}
