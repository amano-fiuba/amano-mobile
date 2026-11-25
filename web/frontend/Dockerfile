# ---- Etapa 1: compilar ----
FROM node:24-alpine AS build
WORKDIR /app

# Primero solo las dependencias (se cachea esta capa)
COPY package.json package-lock.json ./
RUN npm ci

# Después el código y la compilación
COPY . .
RUN npm run build

# ---- Etapa 2: servir ----
FROM nginx:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
