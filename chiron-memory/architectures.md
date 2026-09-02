# architecture

How the system is put together — layers, boundaries, and how data flows.

## `Match` (src/sim/match.ts) owns a game's loadouts; a `World` is one round and always carries a loadout per player

What: `createMatch({seed, bestOf, config})` validates the config, rolls one loadout per player (local player first, rival/NPC second) from a match-level RNG, then builds round 1; `startNextRound(match)` replaces `match.world` with a fresh `createWorld` (new obstacle seed drawn from the same match RNG, full HP) using the *same* loadout objects, and throws past `bestOf` rounds. `createWorld({loadouts})` validates and assigns them (`PlayerState.loadout`); when omitted it rolls builds from the world RNG *after* the obstacles so a seed's layout is identical either way. `game.ts` drives `match.world` and exposes `nextRound()` / `newGame(seed?)`; only `newGame` rerolls · Why: the design doc wants builds rolled per game (a whole best-of-N), not per round, and the match is the smallest container that expresses that; scoring/round wins are deliberately absent — they plug into this later · Where: src/sim/match.ts, src/sim/world.ts, src/sim/player.ts (`createPlayer(id, pos, loadout, cfg)`), src/game.ts, src/main.ts (sidebar renders both builds; `arenaDebug.loadouts / nextRound() / newGame()`) · Learned: each round gets its own obstacle layout (a user call); `Game.world` is now a getter, so anything caching the world across rounds (debug handles, HUD) must re-read it.

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

## The simulation layer under src/sim/ (rng, geometry, obstacles, player, movement, world) h…

What: The simulation layer under src/sim/ (rng, geometry, obstacles, player, movement, world) has no DOM dependencies and takes config as an injected parameter · Why: keeps sim logic pure and deterministic so unit tests can override config values (e.g. double speed) without touching production config · Where: src/sim/*.ts, called from src/game.ts. <!-- id: 9a1bb5b3-64ad-4637-9caa-418980c8239f-1 -->

## Obstacles are generated with a seeded mulberry32 RNG producing non-overlapping axis-align…

What: Obstacles are generated with a seeded mulberry32 RNG producing non-overlapping axis-aligned rectangles, kept clear of an edge margin and player spawn zones, with guaranteed passable gaps (gap ≥ player diameter + margin) · Why: obstacle placement must be random but never trap or block spawn points · Where: src/sim/obstacles.ts, src/sim/rng.ts, generation params in CONFIG.arena. <!-- id: 9a1bb5b3-64ad-4637-9caa-418980c8239f-9 -->

## A dev-only debug handle `window.arenaDebug` (exposing `damage()`, `step(ms, move)`, and l…

What: A dev-only debug handle `window.arenaDebug` (exposing `damage()`, `step(ms, move)`, and live world state) is attached client-side for manual/automated verification of HP, heal, and movement without needing real network play. · Why: — · Where: src/main.ts / src/game.ts. <!-- id: 9a1bb5b3-64ad-4637-9caa-418980c8239f-10 -->

## Simulation logic lives in `src/sim/` as pure functions with no DOM dependency; CONFIG is…

What: Simulation logic lives in `src/sim/` as pure functions with no DOM dependency; CONFIG is passed in as a parameter rather than imported globally inside sim modules. · Why: lets unit tests override config values (e.g. double move speed) to verify behavior changes in isolation, and keeps the simulation reusable/deterministic. · Where: src/sim/*.ts. <!-- id: 9a1bb5b3-64ad-4637-9caa-418980c8239f-2 -->

## `StatId` (and its runtime twins `leveledStatIds()`/`statLevels()`) is derived from every…

What: `StatId` (and its runtime twins `leveledStatIds()`/`statLevels()`) is derived from every `Levels` field present in the skill configs, not hardcoded · Why: keeps the stat model data-driven — giving a skill a level table makes it spendable automatically, with no generator/validator changes needed · Where: src/config.ts <!-- id: 6926e2c3-7419-4ad6-b844-125c61d8128a-1 -->

## A match (`src/sim/match.ts`), not the world/round, owns loadouts — `createMatch(seed, bes…

What: A match (`src/sim/match.ts`), not the world/round, owns loadouts — `createMatch(seed, bestOf, config)` rolls the player's and NPC's loadouts once, and `startNextRound()` reuses them unchanged; only creating a new match rerolls · Why: implements the rule that loadouts are per-game, fixed across all rounds, rerolled only on a new game · Where: src/sim/match.ts <!-- id: 6926e2c3-7419-4ad6-b844-125c61d8128a-11 -->

## `Loadout` is a flat "skill.stat" → level map using 1-based levels (level 1 = the enforced…

What: `Loadout` is a flat "skill.stat" → level map using 1-based levels (level 1 = the enforced minimum) · Why: 1-based levels match the backend's reserved `configured_stats` map format, keeping the client representation aligned with the future backend contract · Where: src/sim/loadout.ts <!-- id: 6926e2c3-7419-4ad6-b844-125c61d8128a-6 -->
