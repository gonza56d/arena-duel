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

## One-shot skill presses are only drained inside `simulate`, so any phase where nothing simulates lets stale presses pile up and fire on the next round's first tick

What: `PlayerInputSource.consumeTriggers()` is called only from `game.ts`'s `simulate()`; while `match.phase` is `roundOver` (the intermission) or `matchOver`, clicks and skill keys accumulate in `pending` and — before this was fixed — were all applied on the first tick of the next round (a Slash swung the moment the round began). `resetTransient()` now calls `input.consumeTriggers()` when a world is swapped in · Why: the input source is edge-triggered and lossless by design (a press between two frames must survive), so nothing ever discards presses on its own; whoever adds a non-simulating phase (menus, countdowns, pause) must decide explicitly whether presses made during it are dropped or carried · Where: src/game.ts (`resetTransient`, `simulate`), src/input.ts (`consumeTriggers`) · Learned: page-wide mouse capture made this much more visible because a click *anywhere* now counts, not just on the canvas.

## `arenaDebug.step(0)` runs no frame, so the HUD DOM is empty until the first real tick or rAF

What: `Game.advance` is only reached inside `step`'s loop while `left > 0`, so `step(0)` neither ticks nor draws and `#hp-label` reads `""` right after a page load in a tab whose rAF loop is frozen. · Why: `step` chunks `ms` into `for (left = ms; left > 0; …)`. · Learned: in browser smoke tests call `step(10)` (one tick) before asserting HUD text; forcing `#app` to `800px × 600px` inline is a reliable way to exercise the minimum-viewport layout, and the ResizeObserver did fire in the automation tab this time (canvas relaid out to 376 px).

## An element's `[hidden]` attribute can be silently overridden if an author CSS rule sets `…

What: An element's `[hidden]` attribute can be silently overridden if an author CSS rule sets `display: grid` or `display: flex` on that same selector (e.g. `.app`, `.block-screen`) · Why: author `display` rules win over the UA default `[hidden] { display: none }` rule in CSS specificity/cascade order · Where: src/style.css · Learned: added an explicit `[hidden] { display: none !important; }` guard so the device gate's show/hide toggling is reliable. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-3 -->

## The claude-in-chrome `resize_window` tool can report success while not actually shrinking…

What: The claude-in-chrome `resize_window` tool can report success while not actually shrinking the real browser window below the display's own constraints · Why: window resizing is bounded by the host display/OS, so requesting a smaller size than that floor silently no-ops · Learned: to test small-viewport/device-gate logic, override `window.innerWidth`/`window.innerHeight` via `Object.defineProperty` and dispatch a `resize` event instead of relying on `resize_window`. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-5 -->

## `go.mongodb.org/mongo-driver/v2` appears as an indirect dependency in go.mod even though…

What: `go.mongodb.org/mongo-driver/v2` appears as an indirect dependency in go.mod even though the project uses the v1 driver (`go.mongodb.org/mongo-driver v1.17.9`) directly · Why: v2 is pulled in transitively via Gin's dependency stack, not something the project added intentionally · Where: light-backend/go.mod · Learned: don't mistake the indirect v2 entry for the driver actually in use <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-8 -->

## The MongoDB Go driver's `InsertOne` does not write the generated ObjectID back into the p…

What: The MongoDB Go driver's `InsertOne` does not write the generated ObjectID back into the passed struct automatically; the store code must extract it from the InsertOneResult and set it on the User manually · Why: — · Where: light-backend/internal/store/mongo.go <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-9 -->

## `createWorld({ loadouts })` generates loadouts (when not explicitly passed) from the worl…

What: `createWorld({ loadouts })` generates loadouts (when not explicitly passed) from the world RNG *after* the obstacle layout is generated · Why: preserves existing per-seed obstacle layouts exactly as before the loadout feature was added — generating loadouts first would have shifted the RNG stream and changed pre-existing seeded test/layout expectations · Where: src/sim/world.ts createWorld · Learned: when adding new RNG consumption to a seeded pipeline, order matters for backward compatibility with existing seeds. <!-- id: 6926e2c3-7419-4ad6-b844-125c61d8128a-10 -->

## The Bash skill has no level table at all (fully fixed/non-spendable), while Shot range's…

What: The Bash skill has no level table at all (fully fixed/non-spendable), while Shot range's level table is flat (`[700, 700, 700, 700]`) so spending points on it currently has no gameplay effect · Why: Shot range is still typed as a leveled stat and was kept spendable by design, pending future tuning · Where: src/config.ts skills.shot / skills.bash · Learned: don't assume every stat that accepts points changes behavior yet — check whether its table has distinct values per level. <!-- id: 6926e2c3-7419-4ad6-b844-125c61d8128a-4 -->

## Chiron auto-commits work-order changes, and separate parallel work orders append to the s…

What: Chiron auto-commits work-order changes, and separate parallel work orders append to the same shared `chiron-memory/*.md` files, so `/chiron-push` can hit merge conflicts in memory files even when the actual code doesn't conflict. · Why: — · Learned: resolve by keeping both sides' appended sections (master's then local's) rather than discarding either — the files are append-only logs, not exclusive-owned state. <!-- id: 9a1bb5b3-64ad-4637-9caa-418980c8239f-13 -->

## A single collision-resolution pass per tick wasn't enough to converge a player squeezed s…

What: A single collision-resolution pass per tick wasn't enough to converge a player squeezed simultaneously between the arena edge, an obstacle, and another player. · Why: needed multiple resolution passes; added `sim.collisionPasses` to CONFIG (extra resolution passes per tick) to settle these multi-constraint cases. · Where: src/config.ts, src/sim/movement.ts. <!-- id: 9a1bb5b3-64ad-4637-9caa-418980c8239f-6 -->

## Slash's 75ms wind-up is not a multiple of the simulation tick length, so each tick must t…

What: Slash's 75ms wind-up is not a multiple of the simulation tick length, so each tick must test the angular slice of the blade's sweep actually covered that tick rather than snapping to tick boundaries · Why: otherwise damage lands a tick early or late relative to when the blade visually reaches the target · Where: src/sim/skills/slash.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-11 -->

## Skill-key input must be edge-triggered but must never drop a press that occurs between tw…

What: Skill-key input must be edge-triggered but must never drop a press that occurs between two animation frames · Why: a merge bug in `game.ts`'s `advance` overwrote queued local input each frame, silently dropping presses at high frame rates · Where: src/input.ts, src/game.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-17 -->

## light-backend has no CORS middleware, so browser fetch calls from the Vite client origin…

What: light-backend has no CORS middleware, so browser fetch calls from the Vite client origin (:5173) to the backend (:8080) are blocked by the browser regardless of whether the two run locally, via `make run`, or via docker compose · Why: pre-existing gap, intentionally left unfixed for this work order per user scoping decision · Where: light-backend router <!-- id: 4e0e2b7a-b190-46a6-b7a1-430eb2b62463-10 -->

## This project's `chiron memory` CLI has no `check` subcommand, so memory validation via `c…

What: This project's `chiron memory` CLI has no `check` subcommand, so memory validation via `chiron-memory check` is unavailable and must be skipped · Why: — · Where: chiron-memory/ tooling <!-- id: 4e0e2b7a-b190-46a6-b7a1-430eb2b62463-16 -->

## The Makefile must stay compatible with GNU Make 3.81, since that is macOS's bundled defau…

What: The Makefile must stay compatible with GNU Make 3.81, since that is macOS's bundled default make · Why: — · Learned: an `awk` script embedded in the `help` target failed with newer-Make-only syntax until rewritten for 3.81 <!-- id: 4e0e2b7a-b190-46a6-b7a1-430eb2b62463-2 -->

## light-backend has no `.env` file loader in the Go code — it reads env vars directly from…

What: light-backend has no `.env` file loader in the Go code — it reads env vars directly from the process environment; `.env` is only a developer convenience consumed by the Makefile/docker-compose, not by the Go binary · Why: — · Where: light-backend/internal/config/config.go <!-- id: 4e0e2b7a-b190-46a6-b7a1-430eb2b62463-6 -->

## The client's backend URL (`VITE_LIGHT_BACKEND_URL`, default http://localhost:8080) is bak…

What: The client's backend URL (`VITE_LIGHT_BACKEND_URL`, default http://localhost:8080) is baked into browser-side JS via Vite env handling, so under docker compose it must still point to a host-facing URL, not an internal compose service name like `http://backend:8080`, because the browser (not the container) makes the request · Why: — · Where: src/config.ts, docker-compose.yml <!-- id: 4e0e2b7a-b190-46a6-b7a1-430eb2b62463-8 -->

## Tuning numbers from src/config.ts (movement speed, dash distance, and their derived per-t…

What: Tuning numbers from src/config.ts (movement speed, dash distance, and their derived per-tick/slowed values) are hardcoded as exact expected values across many unrelated test files, not just config.test.ts. · Why: Tests like movement, world, bash (slow effect), shot/slash (move-while-casting), stats, loadout and dash each independently assert a concrete number derived from the config values. · Where: src/config.test.ts, src/sim/movement.test.ts, src/sim/world.test.ts, src/sim/skills/bash.test.ts, src/sim/skills/shot.test.ts, src/sim/skills/slash.test.ts, src/sim/skills/stats.test.ts, src/sim/loadout.test.ts, src/sim/skills/dash.test.ts. · Learned: Any future tuning change in config.ts should be followed by running the full suite and expect failures to ripple into several test files that assert derived numbers, not just the base config value. <!-- id: 754c4845-39b9-4c33-a042-e3533143617f-2 -->

## validateConfig() in src/config.ts only checks that tuning values are positive numbers, no…

What: validateConfig() in src/config.ts only checks that tuning values are positive numbers, not that they're integers. · Why: This was confirmed while scaling values by a non-integer factor (×1.25 producing 37.5 and 156.25). · Where: src/config.ts. · Learned: Fractional tuning values pass validation without special-casing, so scaling config numbers by non-integer multipliers is safe to do directly in the tables. <!-- id: 754c4845-39b9-4c33-a042-e3533143617f-4 -->

## In src/sim/skills/dash.test.ts, some geometry tests (enemy 'land behind/at/in front' rule…

What: In src/sim/skills/dash.test.ts, some geometry tests (enemy 'land behind/at/in front' rules, obstacle clamp) compute rival/wall positions directly from the live CONFIG dash-distance value instead of using the existing withDash({ distance }) test override. · Why: Discovered while bumping dash distance +25% — those tests broke because their hard-coded positions were derived from the old distance, while tests already using withDash({ distance }) stayed insulated from the tuning change. · Where: src/sim/skills/dash.test.ts. · Learned: Future dash-distance tuning changes need positions in these geometry tests re-derived by hand unless they're rewritten to use the withDash({ distance }) override. <!-- id: 754c4845-39b9-4c33-a042-e3533143617f-6 -->

## When resolving merge conflicts in chiron-memory/*.md, "master" may have re-curated (moved…

What: When resolving merge conflicts in chiron-memory/*.md, "master" may have re-curated (moved/reworded) existing entries rather than only adding new ones, so naively keeping both sides can duplicate an entry master already relocated · Why: hit this merging fog-of-war memory updates against a master that had moved an existing decision entry earlier in decisions.md. · Where: chiron-memory/architectures.md, chiron-memory/decisions.md. · Learned: diff each conflicting side against the merge base to tell a move/reword apart from a genuinely new addition before appending. <!-- id: 8202c722-e583-407d-b90a-d9f614718cb7-6 -->

## `npm run typecheck` reports pre-existing errors unrelated to any given change — e.g

What: `npm run typecheck` reports pre-existing errors unrelated to any given change — e.g. `Property 'env' does not exist on type 'ImportMeta'` in src/main.ts and src/profile.ts · Why: these are not introduced by feature work; treat them as an existing baseline rather than a regression, and diff typecheck output against a clean baseline before assuming your change broke something. · Where: src/main.ts, src/profile.ts. <!-- id: 8202c722-e583-407d-b90a-d9f614718cb7-7 -->

## `shadowPolygons`'s wedge vertices must be ordered consistently relative to the viewer or…

What: `shadowPolygons`'s wedge vertices must be ordered consistently relative to the viewer or two edge-facing wedges end up wound oppositely, making the point-in-polygon fog test disagree with `hasClearLine` · Why: hit during Phase 1 — both new vision tests (winding-consistency and grid-shading) failed until edge vertex ordering was made viewer-relative. · Where: src/sim/vision.ts, src/sim/vision.test.ts. <!-- id: 8202c722-e583-407d-b90a-d9f614718cb7-8 -->

## `window.arenaDebug.step(0)` advances zero simulation time and runs no frame — it does not…

What: `window.arenaDebug.step(0)` advances zero simulation time and runs no frame — it does not tick cooldowns, heal, or any state; use `step(n)` with n > 0 (e.g. step(10)) to actually advance the sim in console/browser-driven testing. · Why: discovered while browser-verifying the HUD cooldown sweep — an initial `step(0)` call appeared to do nothing because it genuinely does nothing. · Where: window.arenaDebug (exposed by the game for scripted e2e testing). <!-- id: c0468463-20e6-4d0d-af7e-dabbc91f90ae-8 -->
