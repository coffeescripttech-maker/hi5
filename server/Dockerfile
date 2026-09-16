# HI5 Portal API — production image
# Build:   docker build -t hi5-portal-api .        (context = server/)
# Runtime: node dist/index.js  →  Express on PORT (default 3001)
#
# Deployed via Coolify: point it at this repo /"Server" folder, choose
# "Dockerfile", set the env vars below, and mount two persistent volumes:
#   /data/uploads  <- UPLOAD_DIR
#   /data/backups  <- BACKUP_DIR

# ---- Stage 1: compile TypeScript ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- Stage 2: runtime ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3001
WORKDIR /app

# Chromium for puppeteer-core PDF rendering (binary at /usr/bin/chromium;
# pdf.controller already launches with --no-sandbox for root containers).
# default-mysql-client provides mysqldump for the backup cron.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
       chromium \
       fonts-liberation \
       default-mysql-client \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

VOLUME ["/data/uploads", "/data/backups"]

HEALTHCHECK --interval=60s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>{if(r.ok)process.exit(0);process.exit(1)}).catch(()=>process.exit(1))"

EXPOSE 3001
CMD ["node", "dist/index.js"]
