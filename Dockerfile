# ── Stage 1: build ────────────────────────────────────────
FROM node:22-slim AS builder

RUN corepack enable \
 && corepack prepare pnpm@11.8.0 --activate

WORKDIR /app

COPY backend/.npmrc backend/package.json backend/pnpm-lock.yaml ./

# CI=true: pnpm não pede confirmação interativa em caso de purge
ENV CI=true

# --ignore-scripts: instala todos os pacotes sem rodar build scripts,
# eliminando ERR_PNPM_IGNORED_BUILDS
RUN pnpm install --frozen-lockfile --ignore-scripts

# pnpm rebuild mantém o estado interno do pnpm consistente
# (npm rebuild causava inconsistência → pnpm queria purgar node_modules)
RUN pnpm rebuild oracledb @nestjs/core

COPY backend/. .

RUN pnpm run build

# ── Stage 2: runtime ───────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

COPY backend/package.json ./

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# main.ts serve o frontend a partir de ../../frontend relativo a dist/ (ou seja, /frontend) —
# empacotado na imagem para a pipeline não depender do volume usado no docker-compose local.
COPY frontend /frontend

EXPOSE 8095

CMD ["node", "dist/main.js"]
