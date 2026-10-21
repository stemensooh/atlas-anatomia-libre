/**
 * Extrae los 10 sistemas anatómicos del cuerpo femenino completo (HuBMAP united-female),
 * alinea la altura con el suelo (y = 0), aplica cuantización + compresión meshopt y guarda:
 *   data/processed/female_<system>.glb
 * Y exporta la lista de nodos femeninos por sistema en:
 *   data/processed/_female_nodes.json
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Document, NodeIO, getBounds } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, reorder, quantize, meshopt, cloneDocument } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptDecoder } from "meshoptimizer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const UNITED_FEMALE_GLB = path.join(
  ROOT,
  "data",
  "raw",
  "hubmap",
  "united-female",
  "3d-vh-f-united.glb"
);
const OUT_DIR = path.join(ROOT, "data", "processed");

const SYSTEM_GROUPS = {
  skeletal: ["VH_F_skeletal_system", "VH_F_lower_limb"],
  muscular: ["VH_F_muscular_system"],
  circulatory: ["VH_F_circulatory_system"],
  nervous: ["VH_F_nervous_system"],
  digestive: ["VH_F_digestive_system"],
  respiratory: ["VH_F_respiratory_system"],
  urinary: ["VH_F_urinary_system"],
  reproductive: ["VH_F_reproductive_system"],
  lymphatic: ["VH_F_lymphatic_system"],
  integumentary: ["VH_F_integumentary_system"],
};

const COPYRIGHT_HUBMAP =
  "HuBMAP CCF 3D Reference Object Library (Visible Human Female), licensed under CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Procesado y comprimido por STEMENSOFT bajo CC BY-SA 4.0.";

async function main() {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;

  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({
      "meshopt.encoder": MeshoptEncoder,
      "meshopt.decoder": MeshoptDecoder,
    });

  console.log("Leyendo data/raw/hubmap/united-female/3d-vh-f-united.glb…");
  const baseDoc = await io.read(UNITED_FEMALE_GLB);
  const baseScene = baseDoc.getRoot().listScenes()[0];
  const bounds = getBounds(baseScene);
  const yOffset = -bounds.min[1]; // Elevar para que los pies queden en y = 0.0 m

  const femaleNodesMeta = [];
  const systemStats = {};

  for (const [sys, groupNames] of Object.entries(SYSTEM_GROUPS)) {
    const doc = cloneDocument(baseDoc);
    const root = doc.getRoot();
    const scene = root.listScenes()[0];
    const vhf = scene.listChildren()[0];

    // Desplazar raíz para apoyar los pies en y = 0
    const t = vhf.getTranslation();
    vhf.setTranslation([t[0], t[1] + yOffset, t[2]]);

    // Conservar solo los grupos de este sistema bajo VH_F (eliminando recursivamente el resto)
    for (const child of [...vhf.listChildren()]) {
      if (!groupNames.includes(child.getName())) {
        const toDispose = [];
        child.traverse((n) => toDispose.push(n));
        for (const n of toDispose.reverse()) {
          n.dispose();
        }
      }
    }

    // Recolectar nombres de nodos con malla en este sistema
    let meshNodesCount = 0;
    let verticesCount = 0;
    let trianglesCount = 0;

    vhf.traverse((node) => {
      const mesh = node.getMesh();
      if (mesh) {
        meshNodesCount++;
        const nodeName = node.getName() || mesh.getName() || `${sys}_${meshNodesCount}`;
        node.setName(nodeName);
        mesh.setName(nodeName);
        node.setExtras({ ...node.getExtras(), id: nodeName, system: sys });

        for (const prim of mesh.listPrimitives()) {
          const pos = prim.getAttribute("POSITION");
          if (pos) verticesCount += pos.getCount();
          const idx = prim.getIndices();
          if (idx) trianglesCount += Math.floor(idx.getCount() / 3);
        }

        femaleNodesMeta.push({
          nodeName,
          system: sys,
        });
      }
    });

    root.getAsset().copyright = COPYRIGHT_HUBMAP;
    root.getAsset().generator = "STEMENSOFT biologia procesar_femenino.mjs";

    await doc.transform(
      prune({ keepExtras: true, keepLeaves: false }),
      dedup(),
      reorder({ encoder: MeshoptEncoder, target: "performance" }),
      quantize({
        quantizePosition: 14,
        quantizeNormal: 10,
      }),
      meshopt({ encoder: MeshoptEncoder, level: "high" })
    );

    const outPath = path.join(OUT_DIR, `female_${sys}.glb`);
    await io.write(outPath, doc);
    const stat = await fs.stat(outPath);

    systemStats[sys] = {
      id: sys,
      glbFile: `female_${sys}.glb`,
      structuresCount: meshNodesCount,
      vertices: verticesCount,
      triangles: trianglesCount,
      optimizedBytes: stat.size,
    };

    console.log(
      `  ✓ female_${sys.padEnd(13)}: ${String(meshNodesCount).padStart(4)} nodos | ${(
        stat.size / 1e6
      )
        .toFixed(2)
        .padStart(6)} MB`
    );
  }

  await fs.writeFile(
    path.join(OUT_DIR, "_female_nodes.json"),
    JSON.stringify({ systems: systemStats, nodes: femaleNodesMeta }, null, 2),
    "utf-8"
  );
  console.log("✓ Nodos y GLB femeninos generados.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
