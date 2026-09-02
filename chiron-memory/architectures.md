# architecture

How the system is put together — layers, boundaries, and how data flows.

## Light backend lives in `light-backend/`, separate from the game backend

- **What**: The low-intensity service (accounts, auth, later profile) is its own
  Go module at `light-backend/` (module `github.com/arena-duel/light-backend`).
  The real-time combat backend is a separate service (not built yet). TECH_SPECS
  mandates two backends: one for the game loop, one for logins/config.
- **Why**: Keep the game backend free to prioritize smooth combat calculation;
  route low-intensity requests (signup/login/profile) elsewhere. This light
  service persists across all milestones.
- **Where**: `light-backend/` (repo also holds README.md, TECH_SPECS.md at root;
  frontend + game backend expected as future siblings).
- **Learned**: WO "Light backend foundation".

## Handlers depend on a `UserStore` interface, not Mongo directly

- **What**: `internal/store/store.go` defines `UserStore`; `mongo.go` is the prod
  impl, `memory.go` is an in-memory fake. Handlers/middleware take the interface.
- **Why**: Handler + router tests run against the fake with `httptest`, so the
  full acceptance-criteria suite needs no live MongoDB (`go test ./...` is
  self-contained). Mongo enforces email uniqueness via a unique index created in
  `MongoStore.ensureIndexes`; the fake mirrors that semantic.
- **Where**: `light-backend/internal/store/`, tests in `internal/server/router_test.go`.
- **Learned**: same WO.
