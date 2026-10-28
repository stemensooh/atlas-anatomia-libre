/**
 * Genera un LOD glTF estándar para probar renderers móviles sin modificar las
 * fuentes publicadas. Mantiene nodos y nombres; reduce la geometría con meshopt.
 * Uso: node scripts/generar_lod_glb.mjs <entrada.glb> <salida.glb> [ratio]
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { simplify } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';

const [input, output, ratioArg = '0.2'] = process.argv.slice(2);
const ratio = Number(ratioArg);
if (!input || !output || !Number.isFinite(ratio) || ratio <= 0 || ratio > 1) {
  throw new Error('Uso: node scripts/generar_lod_glb.mjs <entrada.glb> <salida.glb> [ratio 0..1]');
}

await Promise.all([MeshoptDecoder.ready, MeshoptSimplifier.ready]);
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const document = await io.read(resolve(input));

await document.transform(
  simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01, lockBorder: true }),
);
document.disposeExtension('EXT_meshopt_compression');

await mkdir(dirname(resolve(output)), { recursive: true });
await io.write(resolve(output), document);
