# Image Docker du serveur Bomberman Arena.
#
# Le contexte de build est la RACINE du monorepo (voir docker-compose.yml) :
# le serveur dépend du workspace @bomberman/shared et le package-lock.json est à la racine.
#
#   docker build -f server/Dockerfile -t bomberman-arena-server .

# ---------- Étape 1 : compilation TypeScript (shared + server) ----------
FROM node:22-alpine AS build
WORKDIR /app

# Electron est installé par les dépendances racine : inutile de télécharger son binaire ici.
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1

# Manifestes seuls d'abord, pour garder npm ci en cache tant que les dépendances ne changent pas.
# client/package.json est requis par npm (workspace déclaré), mais ses dépendances ne sont pas installées.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --workspace=shared --workspace=server --include-workspace-root

COPY tsconfig.base.json ./
COPY shared/ shared/
COPY server/ server/
# Le script prebuild du serveur compile d'abord shared
RUN npm run build --workspace=server

# ---------- Étape 2 : image d'exécution (dépendances de production uniquement) ----------
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/
# --omit=optional : vite (dépendance racine) déclare tsx et @types/node en peers optionnels,
# que npm garderait sinon. Le serveur n'a besoin que de ws et de @bomberman/shared.
RUN npm ci --omit=dev --omit=optional --workspace=server && npm cache clean --force

COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/server/dist server/dist

USER node
EXPOSE 3000
CMD ["node", "server/dist/index.js"]
