# architecture

A structural/design choice: layers, module boundaries, where things live.

## Simulation is a pure `src/sim/` layer; the client wraps it with `game.ts` (loop), `input.ts` (keys) and `renderer.ts` (draw)

What: `src/sim/` (geometry, rng, obstacles, player, movement, world) has no DOM or timer dependencies: `createWorld({seed, config})` builds state and `stepWorld(world, inputs, dtMs)` advances it. The client layer wraps it: `game.ts` owns the requestAnimationFrame loop and exposes `Game.advance(elapsedMs, move)` (the single time→ticks→draw path), `input.ts` turns WASD/arrows into a direction vector, and `renderer.ts` draws a `World` through the shared `ArenaViewport` · Why: keeps everything the future game backend must re-run (movement, collision, HP) free of browser concerns and unit-testable · Where: src/sim/world.ts, src/game.ts, src/input.ts, src/renderer.ts, src/main.ts.

## Movement collision = displace, then push out along minimum-translation vectors, then clamp; a move that cannot settle is cancelled

What: `movePlayer` displaces the circle by `speed × dt`, then `resolvePosition` iterates (up to `sim.collisionIterations`, exiting early once nothing moves): push out of each obstacle (circle-vs-AABB MTV), push out of each other living player (circle-vs-circle MTV), clamp inside the arena. If the result still overlaps something, the move is cancelled and the player keeps its previous (known-free) position · Why: MTV push-out preserves the tangential component so players slide along walls naturally; the cancel fallback makes "never leaves the arena / never overlaps" an invariant instead of a hope · Where: src/sim/movement.ts, src/sim/geometry.ts.

## The arena is a fixed 2100×2100-unit square; the client fits the whole arena into the brow…

What: The arena is a fixed 2100×2100-unit square; the client fits the whole arena into the browser window (scale = min(windowW, windowH) / 2100) rather than mapping 1 unit = 1 px · Why: the arena is larger than any supported viewport, so it must be scaled/letterboxed to fit · Where: src/arena.ts (`ArenaViewport` class) · Learned: this is the shared coordinate-mapping contract all future rendering (players, skills, fog-of-war) must use — call `arenaToScreen`/`screenToArena`/`unitsToPixels` rather than computing pixel positions independently. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-0 -->

## The canvas is sized using devicePixelRatio (not just CSS pixels), with a ResizeObserver o…

What: The canvas is sized using devicePixelRatio (not just CSS pixels), with a ResizeObserver on the canvas's container recomputing the ArenaViewport on every resize · Why: keeps rendering crisp on HiDPI/Retina displays and keeps the coordinate mapping in sync whenever the letterboxed canvas size changes · Where: src/renderer.ts. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-6 -->

## The 'light' backend (accounts + auth, low-intensity requests) lives in its own top-level…

What: The 'light' backend (accounts + auth, low-intensity requests) lives in its own top-level directory `light-backend/`, separate from the future game backend that will handle combat · Why: v1 combat runs client-side; accounts/profile is a distinct low-intensity service per the project's two-backend split · Where: light-backend/ <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-2 -->

## Data access goes through a `UserStore` interface with a MongoDB implementation and an in-…

What: Data access goes through a `UserStore` interface with a MongoDB implementation and an in-memory fake implementation · Why: Lets handler/unit tests run against the in-memory fake with no live MongoDB required · Where: light-backend/internal/store/store.go, mongo.go, memory.go <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-3 -->

## A dev-only debug handle `window.arenaDebug` (exposing `damage()`, `step(ms, move)`, and l…

What: A dev-only debug handle `window.arenaDebug` (exposing `damage()`, `step(ms, move)`, and live world state) is attached client-side for manual/automated verification of HP, heal, and movement without needing real network play. · Why: — · Where: src/main.ts / src/game.ts. <!-- id: 9a1bb5b3-64ad-4637-9caa-418980c8239f-10 -->

## Simulation logic lives in `src/sim/` as pure functions with no DOM dependency; CONFIG is…

What: Simulation logic lives in `src/sim/` as pure functions with no DOM dependency; CONFIG is passed in as a parameter rather than imported globally inside sim modules. · Why: lets unit tests override config values (e.g. double move speed) to verify behavior changes in isolation, and keeps the simulation reusable/deterministic. · Where: src/sim/*.ts. <!-- id: 9a1bb5b3-64ad-4637-9caa-418980c8239f-2 -->

## The simulation layer under src/sim/ (rng, geometry, obstacles, player, movement, world) h…

What: The simulation layer under src/sim/ (rng, geometry, obstacles, player, movement, world) has no DOM dependencies and takes config as an injected parameter · Why: keeps sim logic pure and deterministic so unit tests can override config values (e.g. double speed) without touching production config · Where: src/sim/*.ts, called from src/game.ts. <!-- id: 9a1bb5b3-64ad-4637-9caa-418980c8239f-1 -->

## Obstacles are generated with a seeded mulberry32 RNG producing non-overlapping axis-align…

What: Obstacles are generated with a seeded mulberry32 RNG producing non-overlapping axis-aligned rectangles, kept clear of an edge margin and player spawn zones, with guaranteed passable gaps (gap ≥ player diameter + margin) · Why: obstacle placement must be random but never trap or block spawn points · Where: src/sim/obstacles.ts, src/sim/rng.ts, generation params in CONFIG.arena. <!-- id: 9a1bb5b3-64ad-4637-9caa-418980c8239f-9 -->

## Skills live in `src/sim/skills/` as `trigger*` / `tick*` pairs orchestrated by `skills/index.ts`; `stepWorld` runs aim → cooldowns/slow → triggers → movement (dash overrides) → offense → projectiles → shields → heal

What: each skill module owns its state type (stored on `PlayerState.dash/slash/shot/bash/shield`), a `trigger*` (cooldown gate + state) and a `tick*`; `skills/index.ts` dispatches `SkillTriggers` from `PlayerInput.skills` and ticks them; `PlayerInput` gained `aim` (arena point → `aimDir`) and `skills`; `World` gained `projectiles` and per-tick `events` (cleared at the start of each step) · Why: keeps every skill unit-testable through `createWorld`/`stepWorld` with no DOM, and the tick order makes timing exact: a 10 ms wind-up pressed at tick k resolves at the end of tick k; a slow applied in tick k scales exactly `duration/tick` movement ticks starting at k+1 · Where: src/sim/skills/index.ts, src/sim/world.ts, src/sim/events.ts · Learned: skill modules import `type World` only, so there is no runtime cycle with world.ts.

## Dash landing is planned once at the press (`planDash`) and interpolated linearly; a dashing player is excluded from others' collision

What: `planDash` clamps to the first obstacle/edge via swept-circle tests (exact rounded Minkowski sum), then applies the enemy rule: if the landing would overlap an enemy and `distance stat > centre distance` land at the sweep exit point (just behind) unless that exceeds the obstacle/edge limit, otherwise at the entry point (just in front); `tickDash` moves `from → to` over `durationMs` ignoring movement input; `collidableOthers` skips players with an active dash · Why: pre-planning makes the doc's positioning rule exact and deterministic; excluding the dasher from others' `others` list stops the stationary rival from being MTV-shoved along by a dash passing over them · Where: src/sim/skills/dash.ts, src/sim/world.ts (`collidableOthers`) · Learned: the 300-random-situation test in dash.test.ts is the invariant guard — landing is always inside the arena and overlap-free.

## Bullets are swept, not sampled: each tick `stepProjectile` finds the nearest of edge / obstacle / living non-owner player along the travel segment

What: `Projectile` moves `speed × dt` per tick, resolved with `sweepCircleSquare/Rect/Circle`; the first contact stops it, damages the player if any (source = bullet position, so shields see the arrival side), and emits `bulletStop`; a wind-up ending mid-tick gives the bullet a shorter `firstStepMs` · Why: at 21 units per tick a point sample could tunnel through thin obstacles or a 50-unit player · Where: src/sim/skills/shot.ts · Learned: the bullet spawns at the shooter's centre and ignores its owner, so point-blank shots never miss and never self-hit.
