# Imagen de la API (server/) para producción — D-017.
# Contexto de construcción: la RAÍZ del repositorio (la API lee data/processed/metadata.json
# y web/src/data/defaultQuizzes.json con rutas relativas a server/src).
#   docker build -f server/Dockerfile .
# Normalmente se construye con deploy/docker-compose.yml.
# Las credenciales NO entran en la imagen: se pasan en tiempo de ejecución (env_file).

FROM node:24-alpine

# pnpm fijado a la versión usada en desarrollo (lockfile v9).
RUN npm install -g pnpm@11.17.0 && npm cache clean --force

ENV NODE_ENV=production
WORKDIR /app/server

# 1) Dependencias de producción (capa cacheada mientras no cambie el lockfile).
COPY server/package.json server/pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile && pnpm store prune

# 2) Código y los datos que lee la API (solo lectura: metadata.json y modelos .glb para mallas y tamaños).
COPY server/src ./src
COPY data/processed/ /app/data/processed/
COPY web/src/data/defaultQuizzes.json /app/web/src/data/defaultQuizzes.json

# Usuario sin privilegios (incluido en la imagen oficial de Node).
USER node

EXPOSE 3001
# Node 24 ejecuta TypeScript directamente (eliminación de tipos): no hay paso de compilación.
CMD ["node", "--disable-warning=ExperimentalWarning", "src/index.ts"]
