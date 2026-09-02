# gotcha

A non-obvious pitfall or trap, learned the hard way.

## MTV push-out leaves shapes overlapping by ~1e-14 unless a contact skin is added

What: After pushing a circle out of a rectangle/circle by exactly `r - dist`, floating-point rounding can leave them overlapping by ~4e-14, so strict intersection checks still report contact forever · Why: `hypot` and the division/multiplication by the normal do not round-trip exactly · Where: src/sim/geometry.ts (`CONTACT_SKIN = 1e-6` added to every resolver's push) · Learned: tests that assert "not intersecting" after resolution need the skin, not looser tolerances.

## Iterative push-out + clamp converges only geometrically (~0.5× per pass) and never converges in an exact-fit gap

What: When a circle is wedged between the arena edge and another circle, each resolve pass removes only about half the remaining overlap; in a corridor exactly one diameter wide the contact skin makes the two pushes oscillate forever · Why: the edge clamp undoes part of every diagonal push; with a gap == diameter there is no position that is skin-free of both walls · Where: src/sim/movement.ts · Learned: `sim.collisionIterations` is a generous cap (24) with early exit, and `movePlayer` cancels a move whose result is not free — generated layouts always have `minGap ≥ 90` so exact-fit gaps never occur in practice.

## The claude-in-chrome automation tab reports `visibilityState: hidden`, so requestAnimationFrame never fires there

What: In the MCP-controlled tab `document.visibilityState` is `hidden` and `hasFocus()` is false even after clicking on the page, so the rAF game loop never advances (tick count stays frozen) and synthetic key events appear to do nothing · Why: the tab group lives in a background window; screenshots still work because they are captured via the extension · Learned: smoke-test the client through `window.arenaDebug.step(ms, move)` (deterministic, frame-independent) instead of waiting on wall-clock time; do not mistake the frozen loop for a bug in game.ts.

## Slash's 75 ms wind-up is not a multiple of the 10 ms tick — skill timelines must be handled in continuous ms, not tick counts

What: the tick spanning 70→80 ms contains 5 ms of wind-up and 5 ms of swing; `tickSlash` sweeps the blade between `bladeAngle(progress(t0))` and `bladeAngle(progress(t1))` with progress clamped to [0,1], and `tickShot` gives the bullet a `firstStepMs` remainder · Why: the earlier note that "every timing is a multiple of 10 ms" is false for Slash · Where: src/sim/skills/slash.ts, src/sim/skills/shot.ts · Learned: never count wind-ups in ticks; compare elapsed ms to the wind-up and handle the partial tick.

## A player passing over another during Dash must be excluded from the other's collision list, or MTV push-out shoves the bystander along

What: with the dasher still in `others`, the stationary rival started each tick overlapping the dasher and `resolvePosition` pushed the rival 10 units per tick — the rival ended 100 units away · Why: the movement resolver assumes every overlap is the mover's fault · Where: src/sim/world.ts `collidableOthers` (skips `o.dash`) · Learned: any future "phase through" mechanic needs the same exclusion.

## The rAF loop in the claude-in-chrome tab may or may not run (depends on whether the tab group's window is visible), so verify a rendered frame inside one synchronous JS execution

What: in one session the game loop was frozen (visibilityState hidden), in another it ran normally and a scene "frozen" with `arenaDebug.step` had moved on by the time a screenshot/zoom was taken · Why: `requestAnimationFrame` follows tab visibility, which the extension's window placement decides · Learned: to check visuals, drive the sim with `arenaDebug.act/step/rival` and read `canvas.getContext('2d').getImageData` at the expected screen position **in the same `javascript_tool` call** (draw happens synchronously inside `Game.advance`); also drop players at a spot verified clear of the seeded obstacles, otherwise collision resolution shoves them before the scenario runs.

## An element's `[hidden]` attribute can be silently overridden if an author CSS rule sets `…

What: An element's `[hidden]` attribute can be silently overridden if an author CSS rule sets `display: grid` or `display: flex` on that same selector (e.g. `.app`, `.block-screen`) · Why: author `display` rules win over the UA default `[hidden] { display: none }` rule in CSS specificity/cascade order · Where: src/style.css · Learned: added an explicit `[hidden] { display: none !important; }` guard so the device gate's show/hide toggling is reliable. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-3 -->

## The claude-in-chrome `resize_window` tool can report success while not actually shrinking…

What: The claude-in-chrome `resize_window` tool can report success while not actually shrinking the real browser window below the display's own constraints · Why: window resizing is bounded by the host display/OS, so requesting a smaller size than that floor silently no-ops · Learned: to test small-viewport/device-gate logic, override `window.innerWidth`/`window.innerHeight` via `Object.defineProperty` and dispatch a `resize` event instead of relying on `resize_window`. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-5 -->

## `go.mongodb.org/mongo-driver/v2` appears as an indirect dependency in go.mod even though…

What: `go.mongodb.org/mongo-driver/v2` appears as an indirect dependency in go.mod even though the project uses the v1 driver (`go.mongodb.org/mongo-driver v1.17.9`) directly · Why: v2 is pulled in transitively via Gin's dependency stack, not something the project added intentionally · Where: light-backend/go.mod · Learned: don't mistake the indirect v2 entry for the driver actually in use <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-8 -->

## The MongoDB Go driver's `InsertOne` does not write the generated ObjectID back into the p…

What: The MongoDB Go driver's `InsertOne` does not write the generated ObjectID back into the passed struct automatically; the store code must extract it from the InsertOneResult and set it on the User manually · Why: — · Where: light-backend/internal/store/mongo.go <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-9 -->

## `VITE_LIGHT_BACKEND_URL` is read by the browser, so under compose it must be the host-facing URL, not `http://backend:8080`

What: the client resolves the backend base URL from `import.meta.env.VITE_LIGHT_BACKEND_URL` at runtime in the browser; `docker-compose.yml` therefore passes `http://localhost:8080` (the published port), not the compose-network hostname, which the browser cannot resolve · Where: src/profile.ts (`baseUrl`), docker-compose.yml (`client.environment`) · Learned: the same applies to the `prod` image build arg — it is baked for the browser's network, not the container's.

## Vite inside Docker needs `--host 0.0.0.0`; without it the published port 5173 is unreachable from the host

What: `npm run dev` binds to the container's loopback by default (there is no `vite.config`), so the `dev` image runs `npm run dev -- --host 0.0.0.0 --port 5173` · Where: Dockerfile (`dev` target CMD) · Learned: `make run-client` on the host keeps the plain `npm run dev`, where localhost is fine.

## `go.mod` says `go 1.25.0` but local machines may run an older Go; `GOTOOLCHAIN=auto` downloads 1.25 on the first `go test`

What: the backend module requires Go 1.25.0; with the default `GOTOOLCHAIN=auto` an older local Go (1.24 was observed) fetches the 1.25 toolchain on first `make test-backend`/`make run-backend`, so that first run is slow and needs network. The backend image pins `golang:1.25-alpine` for the same reason · Where: light-backend/go.mod, light-backend/Dockerfile · Learned: a "go: downloading go1.25.0" line during `make test` is expected, not a broken install.

## Backend has no CORS middleware; browser calls from the Vite origin (:5173) to :8080 are blocked regardless of how things are started

What: `router.go` registers no CORS headers, so `fetch` from `http://localhost:5173` to `http://localhost:8080` (POST + JSON + Authorization triggers a preflight) fails in the browser even though `curl` works and the compose/Makefile wiring is correct. Documented as a known limitation in the root README; fixing it (e.g. gin-contrib/cors) was deliberately left out of the Makefile/Docker work order · Where: light-backend/internal/server/router.go, README.md ("Known limitation") · Learned: when the client's `/profile/record` call "does nothing", check the browser console for a CORS error before suspecting the compose network.
