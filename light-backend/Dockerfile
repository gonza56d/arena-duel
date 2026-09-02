# syntax=docker/dockerfile:1
# Arena Duel light backend (Go + Gin + MongoDB).
# Multi-stage: compile with the Go toolchain, run as a non-root user on Alpine.
#
#   docker build -t arena-duel-backend light-backend
#   docker run --rm -p 8080:8080 -e JWT_SECRET=... -e MONGO_URI=mongodb://host:27017 arena-duel-backend

FROM golang:1.25-alpine AS build
WORKDIR /src

# Dependencies first so they are cached independently of source changes.
COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.20
RUN apk add --no-cache ca-certificates \
 && addgroup -S app && adduser -S -G app app
COPY --from=build /out/server /usr/local/bin/server

USER app
ENV PORT=8080 \
    GIN_MODE=release
EXPOSE 8080

# Config comes from the environment (see .env.example): PORT, MONGO_URI,
# MONGO_DB and the required JWT_SECRET.
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/server"]
