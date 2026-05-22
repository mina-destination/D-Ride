FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY turbo.json ./
COPY apps/driver-portal/package*.json ./apps/driver-portal/
COPY packages/ ./packages/
RUN npm install
COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npx turbo run build --filter=driver-portal

FROM nginx:alpine
COPY --from=builder /app/apps/driver-portal/dist /usr/share/nginx/html
COPY apps/driver-portal/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
