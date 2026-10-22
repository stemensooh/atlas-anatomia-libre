import React, { useCallback, useEffect, useRef, useState } from "react";
import { CloudDownload, HardDrive, Trash2, X } from "lucide-react";
import { SystemId, SystemInfo } from "../data/types";
import {
  cachedSystems,
  downloadBody,
  formatMB,
  offlineSupported,
  onMeteredConnection,
  removeBody,
  storageInfo,
  StorageInfo,
} from "../data/offlineModels";
import { BodySex } from "../store/useViewerStore";

// Qué sistemas del cuerpo están guardados para usar sin conexión. Se vuelve a consultar al
// cambiar de cuerpo y cada vez que termina de cargarse un sistema (verlo con red también lo guarda).
export function useOfflineSystems(sex: BodySex, systems: SystemInfo[], refreshKey: string) {
  const [cached, setCached] = useState<Set<SystemId>>(new Set());
  const refresh = useCallback(async () => {
    if (!offlineSupported()) return setCached(new Set());
    setCached(await cachedSystems(sex, systems));
  }, [sex, systems]);
  useEffect(() => {
    refresh();
  }, [refresh, refreshKey]);
  return { cached, refresh };
}

const SEX_LABEL: Record<BodySex, string> = { male: "masculino", female: "femenino" };

// Tarjeta "Uso sin conexión" de la pestaña Capas (docs/PLAN_PWA.md, etapa 3).
export function OfflinePanel({
  sex,
  systems,
  cached,
  onChange,
}: {
  sex: BodySex;
  systems: SystemInfo[];
  cached: Set<SystemId>;
  onChange: () => void;
}) {
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshStorage = useCallback(() => {
    storageInfo().then(setStorage).catch(() => setStorage(null));
  }, []);
  useEffect(refreshStorage, [refreshStorage, cached]);

  // Al cambiar de cuerpo se cancela una descarga en curso.
  useEffect(() => () => abortRef.current?.abort(), [sex]);

  if (!offlineSupported()) return null;

  const totalBytes = systems.reduce((s, x) => s + (x.optimizedBytes ?? 0), 0);
  const cachedBytes = systems.filter((x) => cached.has(x.id)).reduce((s, x) => s + (x.optimizedBytes ?? 0), 0);
  const pendingBytes = totalBytes - cachedBytes;
  const complete = systems.length > 0 && cached.size === systems.length;
  const free = storage ? Math.max(0, storage.quota - storage.usage) : null;

  const download = async () => {
    if (
      onMeteredConnection() &&
      !window.confirm(`Parece que usas datos móviles o ahorro de datos. ¿Descargar unos ${formatMB(pendingBytes)}?`)
    ) {
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setMessage(null);
    try {
      await downloadBody(sex, systems, (done, total) => setProgress({ done, total }), ctrl.signal);
      setMessage({ ok: true, text: `Cuerpo ${SEX_LABEL[sex]} disponible sin conexión.` });
    } catch (err) {
      setMessage(
        ctrl.signal.aborted
          ? { ok: true, text: "Descarga cancelada. Lo ya descargado se conserva." }
          : { ok: false, text: (err as Error).message || "No se pudo completar la descarga." }
      );
    } finally {
      abortRef.current = null;
      setProgress(null);
      onChange();
      refreshStorage();
    }
  };

  const remove = async () => {
    if (!window.confirm(`¿Borrar del dispositivo los modelos del cuerpo ${SEX_LABEL[sex]} (${formatMB(cachedBytes)})?`)) return;
    await removeBody(sex, systems);
    setMessage({ ok: true, text: "Espacio liberado. Se volverán a descargar al verlos con conexión." });
    onChange();
    refreshStorage();
  };

  return (
    <div className="offline-card">
      <div className="offline-head">
        <HardDrive size={15} />
        <strong>Uso sin conexión</strong>
        <small>
          {cached.size} de {systems.length} sistemas · {formatMB(cachedBytes)}
        </small>
      </div>

      {progress ? (
        <div className="offline-progress">
          <div className="offline-bar" role="progressbar" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.done}>
            <span style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
          </div>
          <small>
            {formatMB(progress.done)} de {formatMB(progress.total)}
          </small>
          <button className="btn-xs" onClick={() => abortRef.current?.abort()}>
            <X size={13} /> Cancelar
          </button>
        </div>
      ) : (
        <div className="offline-actions">
          {!complete && (
            <button className="btn-credits" onClick={download}>
              <CloudDownload size={14} />
              <span>
                {cached.size ? "Completar" : "Descargar"} cuerpo {SEX_LABEL[sex]} ({formatMB(pendingBytes)})
              </span>
            </button>
          )}
          {cached.size > 0 && (
            <button className="btn-xs" onClick={remove}>
              <Trash2 size={13} /> Liberar espacio
            </button>
          )}
        </div>
      )}

      {message && <small className={message.ok ? "notes-ok" : "notes-error"}>{message.text}</small>}
      {storage && (
        <small className="offline-storage">
          Espacio libre en el dispositivo: {free !== null ? formatMB(free) : "—"}
          {storage.persisted ? " · guardado de forma persistente" : ""}
        </small>
      )}
    </div>
  );
}
