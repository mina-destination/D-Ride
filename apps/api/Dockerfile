FROM node:20-alpine AS builder
WORKDIR /app
# We will use turbo prune in a real monorepo scenario, but for now we copy everything
COPY package*.json ./
COPY turbo.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/ ./packages/
RUN npm install
COPY . .
RUN npx turbo run build --filter=api

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/ .
CMD ["npm", "run", "start:prod", "--workspace=apps/api"]
