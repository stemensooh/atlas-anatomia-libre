import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

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

export default defineConfig({
  plugins: [react(), serveAnatomyDataPlugin()],
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
