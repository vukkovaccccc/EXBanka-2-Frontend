# ─── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Build-time env vars (Vite embeds these into the JS bundle at build time)
ARG VITE_API_BASE_URL=/api
ARG VITE_MOCK_MODE=false
ARG VITE_APP_ENV=production
ARG VITE_ACCESS_TOKEN_TTL_MS=900000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_MOCK_MODE=$VITE_MOCK_MODE
ENV VITE_APP_ENV=$VITE_APP_ENV
ENV VITE_ACCESS_TOKEN_TTL_MS=$VITE_ACCESS_TOKEN_TTL_MS

# Install deps first (layer cache optimization)
COPY package*.json ./
RUN npm ci --prefer-offline

# Copy source and build
COPY . .
RUN npm run build

# ─── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS runner

# Remove default nginx site
RUN rm -rf /usr/share/nginx/html/*

# Copy built assets
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]
