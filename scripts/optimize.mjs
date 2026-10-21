/**
 * Fase 2: optimización, compresión meshopt y validación de los 10 GLB por sistema.
 *
 * Lee:    data/processed/_raw_glb/<system>.glb
 * Escribe: data/processed/<system>.glb
 * Valida:  gltf-validator (sin errores)
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { EXTMeshoptCompression, KHRMeshQuantization } from "@gltf-transform/extensions";
import { dedup, prune, reorder, quantize, meshopt } from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import validator from "gltf-validator";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const RAW_GLB_DIR = path.join(ROOT, "data", "processed", "_raw_glb");
const OUT_DIR = path.join(ROOT, "data", "processed");
const META_PATH = path.join(OUT_DIR, "metadata.json");

const SYSTEMS = [
  "skeletal",
  "muscular",
  "circulatory",
  "nervous",
  "digestive",
  "respiratory",
  "urinary",
  "reproductive",
  "lymphatic",
  "integumentary",
];

async function main() {
  await MeshoptEncoder.ready;
  await MeshoptSimplifier.ready;

  const io = new NodeIO()
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({
      "meshopt.encoder": MeshoptEncoder,
    });

  let totalRawBytes = 0;
  let totalOptBytes = 0;
  const sizeBySystem = {};

  console.log("Optimizando y validando los 10 archivos GLB…");

  for (const sys of SYSTEMS) {
    const inPath = path.join(RAW_GLB_DIR, `${sys}.glb`);
    const outPath = path.join(OUT_DIR, `${sys}.glb`);

    const rawStat = await fs.stat(inPath);
    totalRawBytes += rawStat.size;

    const doc = await io.read(inPath);

    // Preservar copyright y extras del asset
    await doc.transform(
      dedup(),
      prune({ keepExtras: true, keepLeaves: true }),
      reorder({ encoder: MeshoptEncoder, target: "performance" }),
      quantize({
        quantizePosition: 14,
        quantizeNormal: 10,
      }),
      meshopt({ encoder: MeshoptEncoder, level: "high" })
    );

    await io.write(outPath, doc);
    const outBytes = await fs.readFile(outPath);
    totalOptBytes += outBytes.byteLength;
    sizeBySystem[sys] = {
      rawBytes: rawStat.size,
      optimizedBytes: outBytes.byteLength,
    };

    // Validar GLB con gltf-validator
    const report = await validator.validateBytes(new Uint8Array(outBytes), {
      maxIssues: 10,
    });
    const errors = report.issues.numErrors;
    const warnings = report.issues.numWarnings;

    const rawMB = (rawStat.size / 1e6).toFixed(2).padStart(6);
    const optMB = (outBytes.byteLength / 1e6).toFixed(2).padStart(6);
    const ratio = ((1 - outBytes.byteLength / rawStat.size) * 100).toFixed(1);
    console.log(
      `  ✓ ${sys.padEnd(14)}: ${rawMB} MB -> ${optMB} MB (-${ratio}%) | errores=${errors}, avisos=${warnings}`
    );
    if (errors > 0) {
      console.error("Errores de validación en", sys, report.issues.messages);
      process.exitCode = 1;
    }
  }

  // Actualizar tamaños en metadata.json y limpiar carpeta temporal _raw_glb
  try {
    const metaRaw = await fs.readFile(META_PATH, "utf-8");
    const meta = JSON.parse(metaRaw);
    for (const s of meta.systems || []) {
      if (sizeBySystem[s.id]) {
        s.rawBytes = sizeBySystem[s.id].rawBytes;
        s.optimizedBytes = sizeBySystem[s.id].optimizedBytes;
      }
    }
    meta.totalRawBytes = totalRawBytes;
    meta.totalOptimizedBytes = totalOptBytes;
    await fs.writeFile(META_PATH, JSON.stringify(meta, null, 2) + "\n", "utf-8");
  } catch (err) {
    console.warn("Aviso al actualizar metadata.json:", err.message);
  }

  await fs.rm(RAW_GLB_DIR, { recursive: true, force: true });

  console.log(
    `\nTotal 10 sistemas: ${(totalRawBytes / 1e6).toFixed(2)} MB -> ${(totalOptBytes / 1e6).toFixed(2)} MB`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
