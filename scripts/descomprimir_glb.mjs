/**
 * Genera una copia glTF estándar para pruebas de renderers que no admiten
 * EXT_meshopt_compression. No modifica los modelos publicados en data/processed.
 * Uso: node scripts/descomprimir_glb.mjs <entrada.glb> <salida.glb>
 */
import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { NodeIO } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  throw new Error('Uso: node scripts/descomprimir_glb.mjs <entrada.glb> <salida.glb>');
}

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
  .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const document = await io.read(resolve(input));

document.disposeExtension('EXT_meshopt_compression');

await mkdir(dirname(resolve(output)), { recursive: true });
await io.write(resolve(output), document);
