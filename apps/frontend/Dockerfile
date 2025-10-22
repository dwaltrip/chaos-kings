FROM node:20-alpine AS build
WORKDIR /app

# Install frontend deps
COPY frontend/package*.json frontend/
RUN cd frontend && npm ci

# Copy sources (monorepo)
COPY frontend frontend
COPY common common
COPY core core

# Build Vite app
RUN cd frontend && npm run build

FROM caddy:2.8-alpine
WORKDIR /srv
COPY --from=build /app/frontend/dist /srv
COPY frontend/Caddyfile /etc/caddy/Caddyfile

