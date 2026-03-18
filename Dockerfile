# Stage 1: Install dependencies
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

# Stage 2: Production
FROM node:20-alpine AS production

RUN addgroup -g 1001 -S quickhire && \
    adduser -S quickhire -u 1001

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./
COPY src/ ./src/

ENV NODE_ENV=production
ENV PORT=8000

EXPOSE 8000

USER quickhire

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8000/health || exit 1

CMD ["node", "src/index.js"]
