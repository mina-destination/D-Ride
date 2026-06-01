FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
COPY turbo.json ./
COPY apps/client-app/package*.json ./apps/client-app/
COPY packages/ ./packages/
RUN npm install --include=dev
COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npx turbo run build --filter=client-app

FROM nginx:alpine
COPY --from=builder /app/apps/client-app/dist /usr/share/nginx/html
COPY apps/client-app/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
