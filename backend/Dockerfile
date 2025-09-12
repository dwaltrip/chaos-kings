FROM node:20-alpine AS build
WORKDIR /app

# Install backend deps
COPY backend/package*.json backend/
RUN cd backend && npm ci

# Copy sources (monorepo)
COPY backend backend
COPY common common
COPY core core

# Build backend (TS -> JS) - skipped for ts-node runtime
# RUN cd backend && npm run build

# Runtime image
FROM node:20-alpine
WORKDIR /app/backend
ENV NODE_ENV=production

# Copy backend sources and build output
COPY --from=build /app/backend /app/backend

# Also copy shared source used by ts-node at runtime
COPY --from=build /app/common /app/common
COPY --from=build /app/core /app/core

# Install deps (including dev, to allow running migrations inside container)
RUN npm ci

EXPOSE 3131
CMD ["npm", "run", "start:prod"]
