# architecture

A structural/design choice: layers, module boundaries, where things live.

## `Match` (src/sim/match.ts) owns a game's loadouts; a `World` is one round and always carries a loadout per player

What: `createMatch({seed, bestOf, config})` validates the config, rolls one loadout per player (local player first, rival/NPC second) from a match-level RNG, then builds round 1; `startNextRound(match)` replaces `match.world` with a fresh `createWorld` (new obstacle seed drawn from the same match RNG, full HP) using the *same* loadout objects, and throws past `bestOf` rounds. `createWorld({loadouts})` validates and assigns them (`PlayerState.loadout`); when omitted it rolls builds from the world RNG *after* the obstacles so a seed's layout is identical either way. `game.ts` drives `match.world` and exposes `nextRound()` / `newGame(seed?)`; only `newGame` rerolls · Why: the design doc wants builds rolled per game (a whole best-of-N), not per round, and the match is the smallest container that expresses that; scoring/round wins are deliberately absent — they plug into this later · Where: src/sim/match.ts, src/sim/world.ts, src/sim/player.ts (`createPlayer(id, pos, loadout, cfg)`), src/game.ts, src/main.ts (sidebar renders both builds; `arenaDebug.loadouts / nextRound() / newGame()`) · Learned: each round gets its own obstacle layout (a user call); `Game.world` is now a getter, so anything caching the world across rounds (debug handles, HUD) must re-read it.

## Simulation is a pure `src/sim/` layer; the client wraps it with `game.ts` (loop), `input.ts` (keys) and `renderer.ts` (draw)

What: `src/sim/` (geometry, rng, obstacles, player, movement, world) has no DOM or timer dependencies: `createWorld({seed, config})` builds state and `stepWorld(world, inputs, dtMs)` advances it. The client layer wraps it: `game.ts` owns the requestAnimationFrame loop and exposes `Game.advance(elapsedMs, move)` (the single time→ticks→draw path), `input.ts` turns WASD/arrows into a direction vector, and `renderer.ts` draws a `World` through the shared `ArenaViewport` · Why: keeps everything the future game backend must re-run (movement, collision, HP) free of browser concerns and unit-testable · Where: src/sim/world.ts, src/game.ts, src/input.ts, src/renderer.ts, src/main.ts.

## Movement collision = displace, then push out along minimum-translation vectors, then clamp; a move that cannot settle is cancelled

What: `movePlayer` displaces the circle by `speed × dt`, then `resolvePosition` iterates (up to `sim.collisionIterations`, exiting early once nothing moves): push out of each obstacle (circle-vs-AABB MTV), push out of each other living player (circle-vs-circle MTV), clamp inside the arena. If the result still overlaps something, the move is cancelled and the player keeps its previous (known-free) position · Why: MTV push-out preserves the tangential component so players slide along walls naturally; the cancel fallback makes "never leaves the arena / never overlaps" an invariant instead of a hope · Where: src/sim/movement.ts, src/sim/geometry.ts.

## Skills live in `src/sim/skills/` as `trigger*` / `tick*` pairs orchestrated by `skills/index.ts`; `stepWorld` runs aim → cooldowns/slow → triggers → movement (dash overrides) → offense → projectiles → shields → heal

What: each skill module owns its state type (stored on `PlayerState.dash/slash/shot/bash/shield`), a `trigger*` (cooldown gate + state) and a `tick*`; `skills/index.ts` dispatches `SkillTriggers` from `PlayerInput.skills` and ticks them; `PlayerInput` gained `aim` (arena point → `aimDir`) and `skills`; `World` gained `projectiles` and per-tick `events` (cleared at the start of each step) · Why: keeps every skill unit-testable through `createWorld`/`stepWorld` with no DOM, and the tick order makes timing exact: a 10 ms wind-up pressed at tick k resolves at the end of tick k; a slow applied in tick k scales exactly `duration/tick` movement ticks starting at k+1 · Where: src/sim/skills/index.ts, src/sim/world.ts, src/sim/events.ts · Learned: skill modules import `type World` only, so there is no runtime cycle with world.ts.

## Dash landing is planned once at the press (`planDash`) and interpolated linearly; a dashing player is excluded from others' collision

What: `planDash` clamps to the first obstacle/edge via swept-circle tests (exact rounded Minkowski sum), then applies the enemy rule: if the landing would overlap an enemy and `distance stat > centre distance` land at the sweep exit point (just behind) unless that exceeds the obstacle/edge limit, otherwise at the entry point (just in front); `tickDash` moves `from → to` over `durationMs` ignoring movement input; `collidableOthers` skips players with an active dash · Why: pre-planning makes the doc's positioning rule exact and deterministic; excluding the dasher from others' `others` list stops the stationary rival from being MTV-shoved along by a dash passing over them · Where: src/sim/skills/dash.ts, src/sim/world.ts (`collidableOthers`) · Learned: the 300-random-situation test in dash.test.ts is the invariant guard — landing is always inside the arena and overlap-free.

## Bullets are swept, not sampled: each tick `stepProjectile` finds the nearest of edge / obstacle / living non-owner player along the travel segment

What: `Projectile` moves `speed × dt` per tick, resolved with `sweepCircleSquare/Rect/Circle`; the first contact stops it, damages the player if any (source = bullet position, so shields see the arrival side), and emits `bulletStop`; a wind-up ending mid-tick gives the bullet a shorter `firstStepMs` · Why: at 21 units per tick a point sample could tunnel through thin obstacles or a 50-unit player · Where: src/sim/skills/shot.ts · Learned: the bullet spawns at the shooter's centre and ignores its owner, so point-blank shots never miss and never self-hit.

## The zombie NPC is a client-side controller that emits the same PlayerInput a human does, so the sim is the only rule-gate it can't bypass

What: `src/sim/npc.ts` `createNpc(playerId, rng)` returns a `decide(world, dtMs): PlayerInput` (random wander move, aim at the nearest living opponent, one randomly-chosen *ready* skill on a random cadence); `game.ts` calls it every sim tick for each non-local player and merges its input into the same `stepWorld` inputs as the local player (dev `queue()`/`rival()` overrides it) · Why: because the NPC's only output is a `PlayerInput` routed through the identical `stepWorld` path, cooldowns (`triggerSkills` ignores a not-ready skill) and `movePlayer`'s speed/collision clamp bind it exactly as they bind a human — it is *structurally* unable to move faster/further or fire off-cooldown (acceptance 1), with no separate enforcement to keep in sync · Where: src/sim/npc.ts, src/game.ts · Learned: `npcRng(seed, playerId)` derives the NPC RNG from the match seed so its rolls are reproducible; the NPC is not part of the pure `World` (it only reads it), keeping the sim input-driven.

## The match owns round scoring/phase as pure functions; game.ts drives them with a real-time between-rounds pause

What: `src/sim/match.ts` gained `roundsWon[]`, `phase` (`playing`/`roundOver`/`matchOver`), `lastRoundWinnerId`, `matchWinnerId`, plus pure `roundsToWin(bestOf)=⌊N/2⌋+1`, `roundOutcome(world)` (round ends when a player hits 0 HP; sole survivor wins, both-dead = draw), `concludeRound(match, winnerId)` (scores, → matchOver when a player reaches the target *or* all `bestOf` rounds are played; winner = strict rounds-won leader, else null draw) and `advanceRound(match)`; `game.ts` checks `roundOutcome` after each tick, `break`s to freeze the death frame, then waits `ROUND_INTERMISSION_MS` (real time) before `advanceRound` · Why: keeps the whole best-of-N decision testable with no DOM/RAF (acceptance 2), and the early-stop (target reached) means a swept best-of-3 ends at round 2 · Where: src/sim/match.ts, src/game.ts · Learned: `startNextRound` still throws past `bestOf`, but the flow never calls it there because a full-distance match is declared `matchOver` by the round-count branch first.

## Fog of war = line-of-sight occlusion by obstacles, computed in `sim/vision.ts`, applied by the renderer via a `viewerId`

What: `geometry.segmentIntersectsRect` (Liang–Barsky) backs `vision.canSee(viewer, target, obstacles)`, which is true when the target centre *or* either silhouette edge (centre ± radius ⊥ to the view) has a clear line; `renderer.draw(world, fx, viewerId?)` skips drawing any rival `canSee` reports as hidden (body, indicators and dash trail), while projectiles and transient effects in the open stay visible · Why: the README's "fog of war won't let you see your rival if they're hidden using the obstacles"; silhouette sampling shows a rival the moment a sliver clears a corner instead of only when its exact centre does (acceptance 3) · Where: src/sim/geometry.ts, src/sim/vision.ts, src/renderer.ts · Learned: a viewer always sees itself and, with no `viewerId` (headless/debug draw), nothing is fogged; the rule lives in pure `sim/` so it is unit-tested without the canvas.

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

## PlayerInput was extended with `aim` (an arena-space point) and `skills` (one-shot per-tic…

What: PlayerInput was extended with `aim` (an arena-space point) and `skills` (one-shot per-tick trigger flags); World was extended with `projectiles` and per-tick `events` arrays to carry skill effects (hits, blocks, cone flashes) out of the sim · Why: — · Where: src/sim/world.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-16 -->

## During Dash's 100ms travel, the player's live movement input is suspended entirely — posi…

What: During Dash's 100ms travel, the player's live movement input is suspended entirely — position is driven only by the precomputed linear path from the trigger-time plan, not by move keys held during the dash · Why: — · Where: src/sim/skills/dash.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-19 -->

## Match-level transitions (round end / new game, via game.ts's nextRound/newGame) reset eac…

What: Match-level transitions (round end / new game, via game.ts's nextRound/newGame) reset each player's transient skill state — cooldowns, slow, aimDir and per-skill state — alongside HP and position · Why: — · Where: src/game.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-21 -->

## Skills live under src/sim/skills/ as trigger*/tick* function pairs orchestrated by skills…

What: Skills live under src/sim/skills/ as trigger*/tick* function pairs orchestrated by skills/index.ts; stepWorld's per-tick order is aim → cooldown/slow timers → triggers → movement (dash overrides) → offense → projectiles → shields → heal · Why: — · Where: src/sim/world.ts, src/sim/skills/index.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-6 -->

## All damage goes through one `dealDamage` function that checks the target's shield (a 90°…

What: All damage goes through one `dealDamage` function that checks the target's shield (a 90° cone around the target's live aim) before applying damage, flooring any partial block to an integer · Why: — · Where: src/sim/skills/combat.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-7 -->

## skills/cooldowns.ts is the single cooldown gate for all five skills — a cooldown is set a…

What: skills/cooldowns.ts is the single cooldown gate for all five skills — a cooldown is set at the trigger tick, decremented every tick, and the skill can only fire again once it reaches 0 · Why: — · Where: src/sim/skills/cooldowns.ts · Learned: this is the mechanism that satisfies the "no skill during cooldown" acceptance criterion; new skills must route through it rather than rolling their own gate <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-8 -->

## During its 100ms travel a dashing player is excluded from other players' collision checks…

What: During its 100ms travel a dashing player is excluded from other players' collision checks, so Dash passes over an enemy instead of shoving it · Why: — · Where: src/sim/skills/dash.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-9 -->

## The zombie NPC (src/sim/npc.ts) is a decide(world, dtMs) function that emits the same Pla…

What: The zombie NPC (src/sim/npc.ts) is a decide(world, dtMs) function that emits the same PlayerInput a human emits (move vector, aim, skill triggers), fed through the identical stepWorld path as the local player. · Why: routing NPC actions through the shared simulation rules (cooldown gates in triggerSkills, speed clamp in movePlayer) makes it structurally impossible for the NPC to exceed cooldowns or move speed — no separate validation logic needed. · Where: src/sim/npc.ts, wired per-tick in src/game.ts. <!-- id: 49b8d994-1df7-4abe-bf04-4b1b018c17fb-0 -->

## Match scoring/round-flow logic (roundsToWin, roundOutcome, concludeRound, advanceRound, p…

What: Match scoring/round-flow logic (roundsToWin, roundOutcome, concludeRound, advanceRound, plus phase/roundsWon/matchWinnerId state) lives as pure functions added to src/sim/match.ts rather than in game.ts or a new module. · Why: keeps round/match progression testable without DOM/timers, consistent with the project's existing pure-sim architecture. · Where: src/sim/match.ts. <!-- id: 49b8d994-1df7-4abe-bf04-4b1b018c17fb-1 -->

## A round does not advance the instant a player dies — game.ts freezes on the death frame,…

What: A round does not advance the instant a player dies — game.ts freezes on the death frame, waits a fixed intermission, then starts the next round (and freezes entirely once phase becomes matchOver). · Why: gives the player a readable beat to see who won the round/match before the next round or a game-over state appears, instead of an instant jarring reset. · Where: src/game.ts (advance/nextRound flow). <!-- id: 49b8d994-1df7-4abe-bf04-4b1b018c17fb-10 -->

## Fog of war is implemented as geometry.segmentIntersectsRect (Liang–Barsky line-rect clipp…

What: Fog of war is implemented as geometry.segmentIntersectsRect (Liang–Barsky line-rect clipping) plus vision.ts canSee(from, target, obstacles), which samples the target's silhouette (center ± radius edges), not just the center point. · Why: sampling only the center line would flicker/misjudge visibility when a circle is partially exposed at an obstacle's corner; silhouette sampling makes an actor fully behind cover reliably hidden. · Where: src/sim/geometry.ts, src/sim/vision.ts; consumed by renderer.draw(world, fx, viewerId). <!-- id: 49b8d994-1df7-4abe-bf04-4b1b018c17fb-3 -->

## The game exposes a window.arenaDebug object (world state, step(), newGame()) usable from…

What: The game exposes a window.arenaDebug object (world state, step(), newGame()) usable from the browser console for scripted end-to-end smoke testing of match flow, NPC behavior and fog occlusion. · Why: lets a full best-of-N match, NPC damage output, and fog behavior be verified live in-browser without manual play, beyond what unit tests cover. · Where: exposed from src/game.ts / src/main.ts wiring. <!-- id: 49b8d994-1df7-4abe-bf04-4b1b018c17fb-7 -->
