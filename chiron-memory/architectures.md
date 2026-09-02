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

## Client render shell: viewport mapping is the shared contract

**What.** The client is split into small modules under `src/`:
- `arena.ts` — `ArenaViewport`, the single source of truth for converting between
  arena units and canvas CSS pixels (`arenaToScreen`, `screenToArena`,
  `unitsToPixels`, `pixelsToUnits`, `contains`). Holds `scale` + letterbox
  `offset`, recomputed on resize.
- `renderer.ts` — owns the canvas: DPR-aware sizing, `ResizeObserver` + window
  resize → recompute viewport, and the `requestAnimationFrame` loop. Draws the
  arena (boundary, reference grid, a demo centre marker) through the viewport.
- `deviceGate.ts` — pure `check()` returning ok/blocked + reason.
- `main.ts` — entry: runs the gate, shows the block screen or starts the renderer,
  re-evaluates on resize.

**Why.** Every later gameplay renderer (players, skills, fog, obstacles) must keep
its state in arena units and draw only through `ArenaViewport`, so world logic is
resolution-independent and only pixels change with the window. Isolating that
mapping in one class is the load-bearing boundary for all future rendering.

**Where.** `src/*.ts`, layout in `index.html` + `src/style.css`.

**Learned.** 2026-09-02, initial client bootstrap.

## HTML UI lives in grid tracks around the canvas (never over it)

**What.** `index.html` uses a CSS grid (`.app`) with a center `stage` cell for the
canvas and surrounding cells (top/left/right/bottom `.ui-bar`) for HTML UI. The
canvas only ever fills the center cell; UI can structurally never overlap it. The
block screen is a separate fixed overlay toggled via the `hidden` attribute
(`[hidden]{display:none!important}` is set because `.app`/`.block-screen` display
rules would otherwise beat the UA rule).

**Why.** TECH_SPECS: UI must be around the canvas, not covering it. A grid makes
non-overlap a layout invariant rather than something to police per element.

**Where.** `src/style.css` (`.app` grid, `.stage`, `.ui-bar`, `[hidden]`).

**Learned.** 2026-09-02.
