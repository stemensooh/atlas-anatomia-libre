import React, { useEffect, useState } from "react";
import { RefreshCw, WifiOff, X } from "lucide-react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useOnline } from "../hooks/useOnline";

// Cada cuánto se comprueba si hay una versión nueva publicada (además de al abrir la app).
const UPDATE_CHECK_MS = 60 * 60 * 1000;

// En la primera visita el esqueleto y metadata.json se descargan antes de que el service worker
// controle la página, así que no quedan en su caché. Al tomar el control se vuelven a pedir: salen
// de la caché HTTP del navegador (sin gastar datos) y esta vez pasan por el service worker.
async function warmUpOfflineCache() {
  const urls = performance
    .getEntriesByType("resource")
    .map((e) => e.name)
    .filter((u) => new URL(u).origin === location.origin && u.includes("/data/processed/"));
  await Promise.all([...new Set(urls)].map((u) => fetch(u, { cache: "force-cache" }).catch(() => {})));
}

// Registro del service worker (docs/PLAN_PWA.md, etapa 2) y avisos de la app:
//   - versión nueva: no se recarga sola, para no cortar un cuestionario; el usuario decide;
//   - lista para usar sin conexión (solo la primera vez);
//   - sin conexión: qué funciona y qué no.
export function PwaPrompt() {
  const online = useOnline();
  // El aviso de sin conexión se puede cerrar (el estado sigue en la barra superior); vuelve a
  // salir si se pierde la conexión otra vez.
  const [offlineDismissed, setOfflineDismissed] = useState(false);
  useEffect(() => {
    if (online) setOfflineDismissed(false);
  }, [online]);
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (registration) setInterval(() => registration.update().catch(() => {}), UPDATE_CHECK_MS);
    },
  });

  // Cuando el service worker pasa a controlar la página por primera vez (primera visita).
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (navigator.serviceWorker.controller) {
      warmUpOfflineCache();
      return;
    }
    const onControl = () => warmUpOfflineCache();
    navigator.serviceWorker.addEventListener("controllerchange", onControl, { once: true });
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControl);
  }, []);

  // El aviso "lista sin conexión" es informativo: desaparece solo.
  useEffect(() => {
    if (!offlineReady) return;
    const t = setTimeout(() => setOfflineReady(false), 6000);
    return () => clearTimeout(t);
  }, [offlineReady, setOfflineReady]);

  return (
    <div className="pwa-toasts" aria-live="polite">
      {!online && !offlineDismissed && (
        <div className="pwa-toast offline" role="status">
          <WifiOff size={16} />
          <span>
            <strong>Sin conexión.</strong> Puedes explorar lo ya descargado y los cuestionarios
            incluidos; las cuentas, vistas y notas no se guardan hasta volver a conectar.
          </span>
          <button className="icon-btn" aria-label="Cerrar aviso" onClick={() => setOfflineDismissed(true)}>
            <X size={14} />
          </button>
        </div>
      )}
      {needRefresh && (
        <div className="pwa-toast" role="alert">
          <RefreshCw size={16} />
          <span>
            <strong>Hay una versión nueva del atlas.</strong> Se aplicará al recargar.
          </span>
          <div className="pwa-toast-actions">
            <button className="btn-credits" onClick={() => updateServiceWorker(true)}>
              Actualizar
            </button>
            <button className="btn-xs" onClick={() => setNeedRefresh(false)}>
              Más tarde
            </button>
          </div>
        </div>
      )}
      {offlineReady && !needRefresh && (
        <div className="pwa-toast" role="status">
          <span>Listo: el atlas se puede abrir sin conexión.</span>
          <button className="icon-btn" aria-label="Cerrar aviso" onClick={() => setOfflineReady(false)}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
