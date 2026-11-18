# syntax=docker/dockerfile:1

# --- Etapa 1: compilar el frontend con Vite ---
FROM node:20-alpine AS build
WORKDIR /app

# Vacío (por defecto) = la API se llama al mismo origen y la resuelve Caddy.
ARG VITE_API_URL=
ENV VITE_API_URL=${VITE_API_URL}

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Etapa 2: servir el build estático con nginx ---
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
