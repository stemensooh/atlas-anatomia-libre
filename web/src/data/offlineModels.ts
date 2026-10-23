import { BodySex } from "../store/useViewerStore";
import { SystemId, SystemInfo } from "./types";

// "Descargar para usar sin conexión" (docs/PLAN_PWA.md, etapa 3). Los modelos se guardan en las
// mismas cachés que usa el service worker (vite.config.ts → runtimeCaching), que los sirve sin red.
export const MODELS_CACHE = "atlas-modelos";
export const METADATA_CACHE = "atlas-metadatos";
export const METADATA_URL = "/data/processed/metadata.json";

export const glbPath = (sex: BodySex, system: SystemId) =>
  sex === "female" ? `/data/processed/female_${system}.glb` : `/data/processed/${system}.glb`;

const absolute = (path: string) => new URL(path, location.origin).href;

// Solo tiene sentido con un service worker que controle la página (producción o `vite preview`):
// en desarrollo lo descargado no se usaría.
export const offlineSupported = () =>
  typeof window !== "undefined" && "caches" in window && !!navigator.serviceWorker?.controller;

// Sistemas del cuerpo que ya están guardados en la caché (por haberlos visto o descargado).
export async function cachedSystems(sex: BodySex, systems: SystemInfo[]): Promise<Set<SystemId>> {
  const out = new Set<SystemId>();
  if (!("caches" in window)) return out;
  const cache = await caches.open(MODELS_CACHE);
  await Promise.all(
    systems.map(async (s) => {
      if (await cache.match(absolute(glbPath(sex, s.id)))) out.add(s.id);
    })
  );
  return out;
}

export interface StorageInfo {
  usage: number;
  quota: number;
  persisted: boolean;
}

export async function storageInfo(): Promise<StorageInfo | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  const persisted = (await navigator.storage.persisted?.()) ?? false;
  return { usage, quota, persisted };
}

export class OfflineDownloadError extends Error {}

// Descarga a la caché los sistemas que faltan (y metadata.json). Informa del progreso en bytes y
// se puede cancelar; lo ya guardado se conserva. Pide almacenamiento persistente para que el
// navegador no lo borre cuando le falte espacio.
export async function downloadBody(
  sex: BodySex,
  systems: SystemInfo[],
  onProgress: (done: number, total: number) => void,
  signal: AbortSignal
): Promise<void> {
  const already = await cachedSystems(sex, systems);
  const pending = systems.filter((s) => !already.has(s.id));
  const total = pending.reduce((sum, s) => sum + (s.optimizedBytes ?? 0), 0);

  const info = await storageInfo();
  if (info && info.quota - info.usage < total * 1.1) {
    throw new OfflineDownloadError(
      `No hay espacio suficiente: hacen falta unos ${formatMB(total)} y quedan ${formatMB(info.quota - info.usage)}.`
    );
  }
  await navigator.storage?.persist?.().catch(() => false);

  // El catálogo también es necesario sin red.
  const meta = await caches.open(METADATA_CACHE);
  if (!(await meta.match(absolute(METADATA_URL)))) {
    const r = await fetch(METADATA_URL, { signal });
    if (r.ok) await meta.put(absolute(METADATA_URL), r);
  }

  const cache = await caches.open(MODELS_CACHE);
  let done = 0;
  onProgress(0, total);
  for (const s of pending) {
    const url = glbPath(sex, s.id);
    const res = await fetch(url, { signal });
    if (!res.ok || !res.body) throw new OfflineDownloadError(`No se pudo descargar ${url} (HTTP ${res.status}).`);
    // Se lee por partes para informar del progreso y se guarda la respuesta completa.
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    for (;;) {
      const { done: end, value } = await reader.read();
      if (end) break;
      chunks.push(value);
      done += value.byteLength;
      onProgress(done, total);
    }
    await cache.put(
      absolute(url),
      new Response(new Blob(chunks as BlobPart[]), {
        status: 200,
        headers: { "Content-Type": "model/gltf-binary" },
      })
    );
  }
  onProgress(total, total);
}

// Borra de la caché los modelos de ese cuerpo (se volverán a descargar al verlos con red).
export async function removeBody(sex: BodySex, systems: SystemInfo[]): Promise<void> {
  const cache = await caches.open(MODELS_CACHE);
  await Promise.all(systems.map((s) => cache.delete(absolute(glbPath(sex, s.id)))));
}

export const formatMB = (bytes: number) => `${(bytes / 1e6).toFixed(bytes < 10e6 ? 1 : 0)} MB`;

// ¿Conviene confirmar antes de descargar? (ahorro de datos o red móvil, si el navegador lo dice).
export function onMeteredConnection(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean; type?: string } }).connection;
  return !!c?.saveData || c?.type === "cellular";
}
