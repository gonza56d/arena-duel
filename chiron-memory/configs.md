# config

Setup and configuration — env vars, flags, how to run the project.

## Light backend env vars; JWT_SECRET is required

- **What**: `internal/config.Load()` reads `PORT` (default 8080), `MONGO_URI`
  (default `mongodb://localhost:27017`), `MONGO_DB` (default `arena_duel`), and
  `JWT_SECRET` (no default). Missing `JWT_SECRET` makes the server refuse to
  start. Token TTL is hardcoded to 24h. See `light-backend/.env.example`.
- **Why**: Safe local defaults, but the signing secret must be explicit so a
  weak/empty default can never sign real tokens.
- **Where**: `light-backend/internal/config/config.go`, `light-backend/.env.example`.
- **Run**: `go run ./cmd/server` (needs MongoDB up). `go test ./...` needs no DB
  — handler tests use the in-memory store.
- **Learned**: WO "Light backend foundation".
