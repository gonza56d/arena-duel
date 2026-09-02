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

## Project is run via `npm run dev` (Vite dev server), built via `npm run build` (tsc + vite…

What: Project is run via `npm run dev` (Vite dev server), built via `npm run build` (tsc + vite build), and type-checked via `npm run typecheck`; the only devDependencies are `vite` and `typescript`, no runtime dependencies · Why: — · Where: package.json scripts. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-7 -->
