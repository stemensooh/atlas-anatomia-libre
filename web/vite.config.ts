import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const DATA_PROCESSED = path.resolve(__dirname, "../data/processed");

function serveAnatomyDataPlugin() {
  return {
    name: "serve-anatomy-data",
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = (req.url || "").split("?")[0];
        let filePath: string | null = null;

        if (url.startsWith("/data/processed/")) {
          const rel = decodeURIComponent(url.replace("/data/processed/", ""));
          filePath = path.join(DATA_PROCESSED, rel);
        }

        if (filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          if (filePath.endsWith(".glb")) {
            res.setHeader("Content-Type", "model/gltf-binary");
          } else if (filePath.endsWith(".json")) {
            res.setHeader("Content-Type", "application/json; charset=utf-8");
          }
          res.setHeader("Cache-Control", "public, max-age=3600");
          fs.createReadStream(filePath).pipe(res);
          return;
        }
        next();
      });
    },
    closeBundle() {
      // En build de producción, copiar data/processed a dist/data/processed
      const outDir = path.resolve(__dirname, "dist/data/processed");
      if (fs.existsSync(DATA_PROCESSED)) {
        fs.mkdirSync(outDir, { recursive: true });
        for (const entry of fs.readdirSync(DATA_PROCESSED)) {
          const src = path.join(DATA_PROCESSED, entry);
          if (fs.statSync(src).isFile() && (entry.endsWith(".glb") || entry.endsWith(".json"))) {
            fs.copyFileSync(src, path.join(outDir, entry));
          }
        }
      }
    },
  };
}

// App instalable (PWA, docs/PLAN_PWA.md). Precache de la "carcasa" de la app y cachés en tiempo de
// ejecución para metadatos y modelos (etapa 2). /api/ nunca se guarda: sesiones y datos personales.
const DAY = 24 * 60 * 60;
const pwa = VitePWA({
  // "prompt": una versión nueva espera y no recarga la página a mitad de un cuestionario.
  registerType: "prompt",
  // El registro lo hace la app (PwaPrompt, virtual:pwa-register/react) para poder avisar de versiones nuevas.
  injectRegister: false,
  // En desarrollo no hay service worker: evita servir versiones viejas mientras se programa.
  devOptions: { enabled: false },
  // Los iconos ya entran por globPatterns: que el plugin no los añada otra vez.
  includeManifestIcons: false,
  manifest: {
    id: "/",
    name: "Atlas Anatómico 3D Libre",
    short_name: "Atlas 3D",
    description:
      "Visor anatómico 3D libre y educativo: sistemas del cuerpo humano, fichas en español, tours y cuestionarios.",
    lang: "es",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0b1120",
    theme_color: "#0f172a",
    categories: ["education", "medical"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  },
  workbox: {
    // Solo la app (HTML, JS, CSS e iconos). data/ (metadata.json y 98 MB de modelos) queda fuera:
    // el build la copia a dist/, pero no debe entrar en esta caché.
    // Los iconos ya entran por este patrón y el manifiesto lo añade el plugin: no repetirlos
    // (con entradas duplicadas Workbox puede fallar al instalar).
    globPatterns: ["**/*.{html,js,css,svg,png}"],
    globIgnores: ["data/**"],
    navigateFallback: "/index.html",
    // La API y los datos nunca se responden con la app en caché.
    navigateFallbackDenylist: [/^\/api\//, /^\/data\//],
    cleanupOutdatedCaches: true,
    // En la primera instalación el service worker toma el control de la página ya abierta
    // (las versiones nuevas siguen esperando a que el usuario acepte: registerType "prompt").
    clientsClaim: true,
    runtimeCaching: [
      {
        // Catálogo: se sirve la copia guardada al instante y se actualiza en segundo plano.
        urlPattern: /\/data\/processed\/metadata\.json$/,
        handler: "StaleWhileRevalidate",
        options: { cacheName: "atlas-metadatos", expiration: { maxEntries: 2 } },
      },
      {
        // Modelos por sistema: los ya cargados quedan disponibles sin conexión. No se descarga
        // nada que no se haya pedido (arranque ligero, D-020); "Descargar para usar sin conexión"
        // (etapa 3) usa esta misma caché.
        urlPattern: /\/data\/processed\/[^/]+\.glb$/,
        handler: "CacheFirst",
        options: {
          cacheName: "atlas-modelos",
          cacheableResponse: { statuses: [200] },
          expiration: { maxEntries: 30, maxAgeSeconds: 60 * DAY, purgeOnQuotaError: true },
        },
      },
      {
        // Órganos HuBMAP del CDN oficial (D-023, CORS): los vistos quedan en caché un tiempo.
        urlPattern: /^https:\/\/cdn\.humanatlas\.io\/.+\.glb$/,
        handler: "CacheFirst",
        options: {
          cacheName: "atlas-hubmap",
          cacheableResponse: { statuses: [200] },
          expiration: { maxEntries: 15, maxAgeSeconds: 30 * DAY, purgeOnQuotaError: true },
        },
      },
    ],
  },
});

export default defineConfig({
  plugins: [react(), serveAnatomyDataPlugin(), pwa],
  server: {
    port: 5173,
    // API de cuestionarios con SQLite (server/, Fase 5)
    // changeOrigin: false conserva la cabecera Host del navegador, que el servidor compara
    // con Origin para rechazar peticiones de otros sitios (CSRF).
    proxy: {
      "/api": { target: "http://127.0.0.1:3001", changeOrigin: false },
    },
    fs: {
      allow: [".."],
    },
  },
});
