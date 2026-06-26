# ── Stage 1: build ────────────────────────────────────────
FROM node:22-slim AS builder

RUN corepack enable \
 && corepack prepare pnpm@11.8.0 --activate

WORKDIR /app

COPY .npmrc package.json pnpm-lock.yaml ./

# CI=true: pnpm não pede confirmação interativa em caso de purge
ENV CI=true

# --ignore-scripts: instala todos os pacotes sem rodar build scripts,
# eliminando ERR_PNPM_IGNORED_BUILDS
RUN pnpm install --frozen-lockfile --ignore-scripts

# pnpm rebuild mantém o estado interno do pnpm consistente
# (npm rebuild causava inconsistência → pnpm queria purgar node_modules)
RUN pnpm rebuild bcrypt oracledb @nestjs/core

COPY . .

RUN pnpm run build

# ── Stage 2: runtime ───────────────────────────────────────
FROM node:22-slim AS runner

WORKDIR /app

COPY package.json ./

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 8095

CMD ["node", "dist/main.js"]
