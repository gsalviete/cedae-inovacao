FROM node:22-slim

RUN corepack enable \
 && corepack prepare pnpm@10.17.1 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml ./

RUN pnpm -v
RUN pnpm config list --location project
RUN pnpm install --frozen-lockfile --prod=false
COPY . .

RUN pnpm run build

EXPOSE 8095

CMD ["node", "dist/main.js"]