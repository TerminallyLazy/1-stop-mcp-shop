# Dockerfile for Next.js 13+ (with shadcn, Tailwind, TypeScript)
# Multi-stage for optimized production image

# Install dependencies only when needed
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN \
  if [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
  fi

# Rebuild the source code only when needed
FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
COPY --from=deps /app/node_modules ./node_modules
ENV NEXT_TELEMETRY_DISABLED 1
RUN npm run build

# Production image, copy built assets and serve with Next.js
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

# If you use a custom server, e.g. Express, expose its port instead
EXPOSE 3000

# Copy built assets from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Start the Next.js server
CMD ["npm", "start"]
