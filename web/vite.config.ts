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

// App instalable (PWA, docs/PLAN_PWA.md). Etapa 1: manifiesto y service worker que solo guarda
// la "carcasa" de la app; metadatos y modelos tendrán su propia estrategia (etapas 2 y 3).
const pwa = VitePWA({
  // "prompt": una versión nueva espera y no recarga la página a mitad de un cuestionario.
  registerType: "prompt",
  injectRegister: "script-defer",
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
