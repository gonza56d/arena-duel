# syntax=docker/dockerfile:1
# Arena Duel client (Vite + TypeScript, canvas).
#
#   target "dev"  — Vite dev server with hot reload; used by docker-compose.yml
#   target "prod" — production build served by nginx (default when no --target)
#
#   docker build -t arena-duel-client .                       # prod
#   docker build -t arena-duel-client:dev --target dev .      # dev

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# --- dev: Vite dev server. Compose bind-mounts src/ and index.html over the
# image copy so edits hot-reload; node_modules stays in the image. -------------
FROM deps AS dev
COPY . .
# URL the *browser* uses to reach the backend (host-facing, not the compose
# network). Overridden by docker-compose.yml / the environment.
ENV VITE_LIGHT_BACKEND_URL=http://localhost:8080
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]

# --- build: tsc --noEmit + vite build ---------------------------------------
FROM deps AS build
COPY . .
ARG VITE_LIGHT_BACKEND_URL=http://localhost:8080
ENV VITE_LIGHT_BACKEND_URL=$VITE_LIGHT_BACKEND_URL
RUN npm run build

# --- prod: static files behind nginx ----------------------------------------
FROM nginx:1.27-alpine AS prod
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
