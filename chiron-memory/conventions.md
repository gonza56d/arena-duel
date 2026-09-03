# convention

A rule the codebase follows — naming, patterns, and where things live.

## `validateLoadout` returns `{ok, errors[]}` with every violation; `assertValidLoadout` throws the same list. `createWorld`/`generateLoadout` assert, UIs should read the list

What: Build rule checks (missing/unknown stat, non-integer, below level 1, above max, spend ≠ `build.points` with over/under-by) are collected into one `LoadoutValidation` rather than failing on the first, mirroring `validateConfig`'s error list · Why: the same check guards v1's generated builds and will validate v2's manual builder, where a UI wants to show every problem at once · Where: src/sim/loadout.ts, src/sim/loadout.test.ts.

## No gameplay literal outside `src/config.ts`; units are arena units / milliseconds / degrees; level arrays are 0-indexed

What: Gameplay numbers never appear as literals outside `src/config.ts` — other modules read `CONFIG` (e.g. `ARENA_SIZE` in src/arena.ts is a re-export, the HUD reads `CONFIG.player.maxHp`). Distances are arena units, times milliseconds, angles degrees; skill level arrays are indexed from 0 (= "level 1" in the design doc) · Why: the whole point of the config module is that a tuning pass touches one file · Where: src/config.ts (header comment states the rules).

## Dev-only browser handle `window.arenaDebug` (gated on `import.meta.env.DEV`) exposes `config`, `world`, `damage(n, id)` and `step(ms, move)`

What: In dev builds `main.ts` sets `window.arenaDebug = { config, world, damage(amount, playerId), step(ms, move) }`; `step` advances exactly `ms` of simulated time through `Game.advance` regardless of frame rate · Why: lets HP/heal/death and movement be exercised from the console (and from browser automation) deterministically; stripped from production builds by the DEV gate · Where: src/main.ts (`exposeDebug`), src/vite-env.d.ts (Vite client types).

## Skill tests drive the sim only through `createWorld` + `stepWorld` with explicit `PlayerInput` objects; geometry set up by writing `players[i].pos` directly

What: every skill test builds a world with obstacle generation disabled (`countMin/Max: 0`) and explicit `loadouts` from `testLoadout(overrides, filler)` (pins the levels under test, pours the remaining points into stats the test does not observe — `createWorld` rolls random builds otherwise), places players by assigning `pos`, aims via one `stepWorld` with `aim`, then presses via `skills` flags and steps ticks; helpers like `timeToHit` return elapsed ms · Why: exercises the real tick order (aim → cooldown → trigger → move → offense → shields) instead of calling `trigger*` directly, so ordering bugs show up · Where: src/sim/skills/*.test.ts · Learned: `world.events` is cleared every tick, so assert on events *before* stepping again; `tsconfig` targets ES2020, so `Array.prototype.at` is unavailable in tests.

## Renderer-only constants (colours, `FX_LINGER_MS`) live in src/renderer.ts; the game loop collects `world.events` into a `TimedEvent[]` for fades

What: `Game.advance` appends each tick's events with `atMs = world.timeMs` and prunes those older than `FX_LINGER_MS`; the renderer fades them by age. Skill visuals otherwise read sim state (`dash.from`, `bladeAngle(slash)`, `isShieldUp`, `projectiles`) · Why: the sim stays free of presentation timing while still giving the renderer transient hits/impacts to show · Where: src/game.ts, src/renderer.ts.

## Makefile targets self-document with a trailing `## description`, `##@ Section` lines group them, and the file stays GNU Make 3.81-compatible

What: every public target line ends in `## one-line description`; `make help` is an awk pass over `$(MAKEFILE_LIST)` that prints `##@ Section` headers and each `target ## desc` pair, so a target without `##` is invisible in `help`. The Makefile must keep working on GNU Make 3.81 (macOS default): no `.ONESHELL`, `.RECIPEPREFIX`, `$(file …)`, `!=` or `::=`; multi-line recipes use `\` continuations with one shell · Why: `make help` is the discoverability contract of the work order, and macOS developers get 3.81 without Homebrew · Where: Makefile.

## Client `Dockerfile` has `dev` (Vite dev server) and `prod` (nginx) targets; backend `Dockerfile` is a multi-stage non-root Alpine image

What: root `Dockerfile`: `deps` (node:24-alpine, `npm ci`) → `dev` (copies sources, `CMD npm run dev -- --host 0.0.0.0 --port 5173`, used by compose) and `build` → `prod` (nginx:1.27-alpine serving `dist/`, the default target; `VITE_LIGHT_BACKEND_URL` is a build `ARG` there). `light-backend/Dockerfile`: golang:1.25-alpine build with `CGO_ENABLED=0`, alpine runtime as user `app`, `GIN_MODE=release`, busybox `wget` `HEALTHCHECK` on `/health`. Each context has a `.dockerignore` (root excludes `light-backend/`, `node_modules`, `.env*`; backend excludes `.env`, `bin/`) · Why: compose needs hot reload (dev server + bind mounts) while `docker build .` should still yield a deployable static image; the backend image must never bake a local `.env` · Where: Dockerfile, .dockerignore, light-backend/Dockerfile, light-backend/.dockerignore.

## Browser-facing client modules are unit-tested with Node's own `EventTarget`/`Event` fakes, not jsdom

What: `src/input.test.ts` drives `createInput` with a plain `new EventTarget()` cast to `Window`, dispatching `new Event(type, { cancelable: true })` with the fields the handler reads (`button`, `clientX/Y`, `relatedTarget`, `code`, `repeat`) assigned onto it; the canvas is `{ getBoundingClientRect }` cast to `HTMLCanvasElement` and the viewport is a real `ArenaViewport` (`resize(1000, 800)` → 800-px arena letterboxed at x = 100). Assert side effects through the returned API (`aim()`, `consumeTriggers()`, `direction()`) and `event.defaultPrevented` · Why: vitest runs in the node environment here (no jsdom dependency, tests stay ~3 s), and the handlers only need the event fields they read — a full DOM buys nothing. Keeps the "sim is pure, client is thin" split testable on both sides · Where: src/input.test.ts, package.json (no jsdom, `vitest run`) · Learned: `preventDefault()` only flips `defaultPrevented` on a `cancelable` event — construct fakes with `{ cancelable: true }` or the suppression assertions silently pass/fail wrong; `MouseEvent`/`KeyboardEvent` constructors do not exist in node, so cast plain events.

## The player HUD is `src/hud.ts` (`createHud(root)` → `{ setLoadout, update }`), driven from main.ts once per match and once per frame; the old right-panel `#hud` HP line is gone

What: `createHud` builds the DOM once (10 `.hp-block`s, `#hp-label`, `#hp-status`, five `.ability` tiles with inline-SVG glyphs, a conic-gradient `.ability-sweep` driven by the `--cd` custom property = fraction of cooldown remaining, and a `s.s` countdown). `renderMatch` calls `setLoadout(m.loadouts[0])` so each skill's full cooldown comes from `resolve*` for the local build; `updateHud` calls `update(me)` every frame from `PlayerState` (`hp`, `healTimerMs`, `slow`, `cooldowns[id]`, in-progress skill state → `.ready` / `.cooling` / `.active`). The heal countdown / SLOWED / DEAD readouts moved from the right panel into `#hp-status` beside the label (`statusText`); score and match outcome stay in the top bar; the sidebar build list keeps its own cooldown text. Pure rules (`filledBlocks`, `cooldownFraction`, `skillCooldownMs`, `statusText`) are unit-tested without a DOM; block count and colours are presentation constants in hud.ts/style.css, not config. · Why: keeps main.ts to wiring and lets the display rules be tested with vitest in node (no jsdom), consistent with the renderer-only-constants rule. · Where: src/hud.ts, src/hud.test.ts, src/main.ts, src/style.css. · Learned: this supersedes the earlier note that the HP/heal line is rendered in `src/main.ts`; `SKILL_NAMES` now lives in hud.ts and the sidebar imports it.

## UI HTML (top/side/bottom bars) is placed around the canvas using a CSS grid with the canv…

What: UI HTML (top/side/bottom bars) is placed around the canvas using a CSS grid with the canvas confined to a center cell, instead of relying on z-index/absolute-positioning discipline to avoid overlap · Why: makes it structurally impossible for UI to cover the canvas, satisfying the 'UI never overlaps canvas' requirement by layout rather than convention · Where: index.html, src/style.css. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-2 -->

## Signup rejects a duplicate email with HTTP 409 Conflict (not a generic 400)

What: Signup rejects a duplicate email with HTTP 409 Conflict (not a generic 400) · Why: — · Where: light-backend/internal/handlers/handlers.go <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-10 -->

## Passwords must never be stored, logged, or returned in plaintext, including in dev/test;…

What: Passwords must never be stored, logged, or returned in plaintext, including in dev/test; `models.User.PasswordHash` is tagged `json:"-"` to prevent accidental exposure in responses · Why: Explicit requirement from the work order, applies even during testing · Where: light-backend/internal/models/user.go <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-4 -->

## Login failures return an opaque 401 regardless of whether the email exists or the passwor…

What: Login failures return an opaque 401 regardless of whether the email exists or the password is wrong · Why: Prevents account enumeration via differing error messages · Where: light-backend/internal/handlers/handlers.go <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-5 -->

## Password strength rule is minimum 8 characters with at least one letter and one digit; em…

What: Password strength rule is minimum 8 characters with at least one letter and one digit; email is validated via `net/mail` and stored lowercased with a unique MongoDB index enforcing no duplicates · Why: — · Where: light-backend/internal/validate/validate.go <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-6 -->

## `validateConfig()` enforces a feasibility invariant: number of leveled stats ≤ `build.poi…

What: `validateConfig()` enforces a feasibility invariant: number of leveled stats ≤ `build.points` ≤ sum of each stat's max level · Why: guarantees a valid 16-point loadout is always constructible (every stat startable at 1, budget never unspendable or overflowing) before the generator even runs · Where: src/config.ts <!-- id: 6926e2c3-7419-4ad6-b844-125c61d8128a-5 -->

## `statValue()` is the single bridge function that converts a loadout's 1-based level into…

What: `statValue()` is the single bridge function that converts a loadout's 1-based level into the 0-indexed level-table lookup · Why/ · Why: — · Where: src/sim/loadout.ts · Learned: keeps the 1-based/0-indexed conversion in one place instead of scattering `-1` offsets across the codebase <!-- id: 6926e2c3-7419-4ad6-b844-125c61d8128a-7 -->

## `validateLoadout()` returns every violation it finds, not just the first

What: `validateLoadout()` returns every violation it finds, not just the first · Why: lets v2's manual builder surface full feedback on an invalid build in one pass, since it's meant to be reused as-is · Where: src/sim/loadout.ts <!-- id: 6926e2c3-7419-4ad6-b844-125c61d8128a-9 -->

## The HUD (src/main.ts) displays live HP plus a heal countdown timer, not just a static HP…

What: The HUD (src/main.ts) displays live HP plus a heal countdown timer, not just a static HP value · Why: — · Where: src/main.ts, driven by world/player state from src/sim/. <!-- id: 9a1bb5b3-64ad-4637-9caa-418980c8239f-16 -->

## `validateConfig()` throws loudly if HP, damage, or heal values are non-integer, or if gen…

What: `validateConfig()` throws loudly if HP, damage, or heal values are non-integer, or if generation ranges are invalid (e.g. obstacle gaps too small to pass) · Why: HP/damage must always be integer per spec; catching a bad config at startup is cheaper than debugging a rounding bug mid-game · Where: src/config.ts. <!-- id: 9a1bb5b3-64ad-4637-9caa-418980c8239f-3 -->

## Player color is validated as `#RRGGBB` or a preset name (red, blue, green, yellow, orange…

What: Player color is validated as `#RRGGBB` or a preset name (red, blue, green, yellow, orange, purple, cyan, pink, white, black) and always persisted/returned as lowercase `#rrggbb`; new accounts start at `#ffffff` · Why: the client paints the player circle on a canvas, so a single hex form avoids every consumer re-mapping names to values; the preset list is a convenience for the UI picker · Where: light-backend/internal/validate/profile.go (`Color`, `DefaultColor`) <!-- id: d6850825-ffb9-4edd-b6a4-f3419ad682ee-0 -->

## Player name rule is 2–24 printable runes, trimmed, and not unique across players

What: Player name rule is 2–24 printable runes, trimmed, and not unique across players · Why: the work order requires the name to be changeable at any time and imposes no uniqueness; identity is the account email, not the display name · Where: light-backend/internal/validate/profile.go (`PlayerName`) <!-- id: d6850825-ffb9-4edd-b6a4-f3419ad682ee-1 -->

## Profile updates go through `PATCH /profile`, which binds a dedicated request struct conta…

What: Profile updates go through `PATCH /profile`, which binds a dedicated request struct containing only `player_name` and `color` (both optional, at least one required); unknown keys such as `victories` are ignored, and a request with any invalid field is rejected whole with 400 · Why: the record counters must be impossible to set from the client, and a field-restricted bind type guarantees that structurally instead of by a runtime check · Where: light-backend/internal/handlers/profile.go, light-backend/internal/store/store.go (`ProfileUpdate`) <!-- id: d6850825-ffb9-4edd-b6a4-f3419ad682ee-2 -->

## Shot's bullet travels at a fixed speed derived from config (arena side length per 1000ms,…

What: Shot's bullet travels at a fixed speed derived from config (arena side length per 1000ms, i.e. 1s to cross the map) and is swept each tick against edges, obstacles and living players excluding its owner; the first contact stops it · Why: — · Where: src/sim/skills/shot.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-12 -->

## Because createWorld rolls a random per-player Loadout, skill unit tests pin only the leve…

What: Because createWorld rolls a random per-player Loadout, skill unit tests pin only the levels they assert on via a `testLoadout` helper, which fills remaining stat points into stats the test doesn't observe · Why: keeps skill tests deterministic without hand-writing full loadouts for every stat · Where: src/sim/skills/*.test.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-15 -->

## Slash's and Bash's cones use the player centre as the apex, with the skill's "range" stat…

What: Slash's and Bash's cones use the player centre as the apex, with the skill's "range" stat measured as the sector radius from that centre · Why: README doesn't specify apex/measurement point; centre-to-centre was chosen for consistency with the circle collision model · Where: src/sim/skills/slash.ts, src/sim/skills/bash.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-4 -->

## Slash records which targets it has already hit during the current swing, so the per-tick…

What: Slash records which targets it has already hit during the current swing, so the per-tick angular-slice test doesn't re-damage the same enemy on a later tick as the blade continues sweeping · Why: needed because contact is tested every tick rather than once per swing · Where: src/sim/skills/slash.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-22 -->

## Bullet radius and blade width are computed via derived helper functions in config.ts (bul…

What: Bullet radius and blade width are computed via derived helper functions in config.ts (bulletRadius, bladeWidth) from player-width ratios, rather than stored as standalone literal stat fields · Why: — · Where: src/config.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-23 -->

## POST /profile/record always increments games_played on a valid authenticated call, but on…

What: POST /profile/record always increments games_played on a valid authenticated call, but only increments victories when the request body's won field is true; unauthenticated calls get 401. · Why: mirrors the profile record semantics (a loss still counts as a game played) and keeps the route behind auth even though it trusts client-reported outcomes in v1. · Where: light-backend/internal/handlers/profile.go, light-backend/internal/server/record_test.go. <!-- id: 49b8d994-1df7-4abe-bf04-4b1b018c17fb-11 -->

## A round ends the instant a player hits 0 HP (survivor wins that round; simultaneous death…

What: A round ends the instant a player hits 0 HP (survivor wins that round; simultaneous death is a round draw); the match is won on reaching roundsToWin = floor(N/2)+1, or decided/drawn once all N rounds are played if no majority (even N). · Why: defines best-of-N semantics precisely so scoring code and tests agree on edge cases (early stop vs full N, draws). · Where: src/sim/match.ts roundOutcome/concludeRound. <!-- id: 49b8d994-1df7-4abe-bf04-4b1b018c17fb-2 -->

## `renderer.draw(world, fx, viewerId)` hides a rival's body, direction/aim indicators, dash…

What: `renderer.draw(world, fx, viewerId)` hides a rival's body, direction/aim indicators, dash trail, slash cone/blade, shield arc and bash cone whenever `canSee` says the body is out of sight (`playerInView`). Effects that are not anchored to a body — a rival's bullets, `bulletStop` impact rings and `hit` flashes — are tested at their own position with `inView(target)`, so a bullet is hidden while inside the fog and appears the moment it flies into sight (the same rule as a body stepping out). Anything owned by the viewer (`ownerId` / `attackerId` / `playerId` equal to the viewer) is drawn regardless. Supersedes the earlier rule that in-flight projectiles stayed visible in the fog · Why: playtest of milestone 1 — a hidden zombie's shots and impacts (bullets emerging from behind a wall, impact rings on the wall's far face) gave away its position; hiding a bullet only while its *shooter* is hidden was rejected because an incoming bullet in the open must stay visible · Where: src/renderer.ts (`viewerOf`, `inView`, `playerInView`, `drawProjectiles`, `drawEffects`) · Learned: with no `viewerId` (headless/debug draw) nothing is fogged; the fog layer and the occlusion rule both derive from the same `vision.ts` geometry so they never disagree. <!-- id: 49b8d994-1df7-4abe-bf04-4b1b018c17fb-5 -->

## NPC behavior mechanics: movement is a random wander (unit direction re-picked on a random…

What: NPC behavior mechanics: movement is a random wander (unit direction re-picked on a random interval, with occasional idle pauses) while skill use is pressing one currently-ready skill at random on a random cadence. · Why: gives an NPC that 'randomly moves and uses skills' per the work order's intent, distinct from a scripted or optimal opponent. · Where: src/sim/npc.ts. <!-- id: 49b8d994-1df7-4abe-bf04-4b1b018c17fb-9 -->

## The HUD shows the live round score and match outcome as "You X – Y Zombie" plus a status…

What: The HUD shows the live round score and match outcome as "You X – Y Zombie" plus a status line (e.g. "Match won!") driven by `Match.roundsWon`/`phase`/`matchWinnerId` · Why: — · Where: src/main.ts, index.html, src/style.css <!-- id: 49b8d994-1df7-4abe-bf04-4b1b018c17fb-13 -->

## The root `.env` file (used only for docker-compose variable interpolation) is gitignored,…

What: The root `.env` file (used only for docker-compose variable interpolation) is gitignored, matching the existing gitignore pattern for light-backend/.env · Why: — · Where: .gitignore <!-- id: 4e0e2b7a-b190-46a6-b7a1-430eb2b62463-15 -->

## README.md documents the same 'design-doc' tuning figures (movement speed, dash distance p…

What: README.md documents the same 'design-doc' tuning figures (movement speed, dash distance per level) that live in src/config.ts, and config.test.ts has tests explicitly named 'matches the design-doc feel/skill numbers'. · Why: Keeps the README and the tunable source of truth from silently drifting apart. · Where: README.md; src/config.ts; src/config.test.ts. · Learned: Any tuning change to config.ts values documented in the README must update the corresponding README figures too, or the 'matches design-doc numbers' tests become circular/misleading. <!-- id: 754c4845-39b9-4c33-a042-e3533143617f-3 -->

## Project decisions (tuning bumps, design choices) are recorded in chiron-memory/decisions.…

What: Project decisions (tuning bumps, design choices) are recorded in chiron-memory/decisions.md using a What/Why/Where/Learned structure, meant to be validated with a `chiron-memory check` CLI. · Why: chiron-memory is this project's own persistent memory system, queried via `chiron memory search` / `memory_canonical` / `memory_search`. · Where: chiron-memory/decisions.md. · Learned: In this environment the `chiron memory` CLI currently has no check/validate subcommand installed (confirmed via `chiron memory --help`), so new entries can only be format-checked manually until that subcommand exists. <!-- id: 754c4845-39b9-4c33-a042-e3533143617f-5 -->

## chiron-memory/decisions.md is an append-only running log of independent What/Why/Where/Le…

What: chiron-memory/decisions.md is an append-only running log of independent What/Why/Where/Learned entries, not a set of competing edits. · Why: When a concurrent branch and this branch each appended a different decision and the merge conflicted, the correct resolution was to keep both entries (not choose one), since neither superseded the other. · Where: chiron-memory/decisions.md. · Learned: Merge conflicts in this file should default to keeping both sides' new entries rather than picking a winner. <!-- id: 754c4845-39b9-4c33-a042-e3533143617f-7 -->

## A stop-hook flags when a work order's code diff is large relative to how little chiron-me…

What: A stop-hook flags when a work order's code diff is large relative to how little chiron-memory/ changed, prompting a check that any decisions, conventions, or gotchas from the session got recorded there. · Why: Keeps chiron-memory (the project's own persistent memory) from silently falling behind the code as work orders land. · Where: chiron-memory/ (validated via `chiron-memory check` when that CLI subcommand is installed). · Learned: Expect this nudge after any substantive change and treat it as a prompt to record real findings, not filler, into the type-appropriate chiron-memory file. <!-- id: 754c4845-39b9-4c33-a042-e3533143617f-8 -->

## Every enemy-owned effect visual (slash, shield, dash trail, bash cone, bullets, impact ri…

What: Every enemy-owned effect visual (slash, shield, dash trail, bash cone, bullets, impact rings, hit flashes) is gated by the same in-view check used for the enemy's body, while anything whose owner/attacker/player id equals the local viewer is always drawn unconditionally · Why: one shared rule keeps fog occlusion consistent across all current and future skills, and guarantees a player never loses visibility of their own actions. · Where: src/renderer.ts. <!-- id: 8202c722-e583-407d-b90a-d9f614718cb7-5 -->

## HUD DOM logic lives in src/hud.ts as `createHud(root)`, returning `setLoadout(loadout)` (…

What: HUD DOM logic lives in src/hud.ts as `createHud(root)`, returning `setLoadout(loadout)` (called once per match to set cooldown totals) and `update(player)` (called every frame from world state) · Why: — · Where: src/hud.ts, src/main.ts · Learned: mirrors the existing per-frame HUD wiring pattern already used for score/outcome in main.ts. <!-- id: c0468463-20e6-4d0d-af7e-dabbc91f90ae-2 -->

## `filledBlocks(hp, maxHp)` rounds up (Math.ceil) rather than down

What: `filledBlocks(hp, maxHp)` rounds up (Math.ceil) rather than down · Why: an alive player with any HP > 0 must never render as 0 filled blocks · Where: src/hud.ts. <!-- id: c0468463-20e6-4d0d-af7e-dabbc91f90ae-3 -->

## Ability icon order is fixed across the HUD as dash → slash → shot → shield → bash

What: Ability icon order is fixed across the HUD as dash → slash → shot → shield → bash · Why: — · Where: `HUD_SKILLS`/`SKILL_NAMES` in src/hud.ts. <!-- id: c0468463-20e6-4d0d-af7e-dabbc91f90ae-5 -->

## The old right-panel HP text line was removed in favor of the new below-arena HUD; the Sta…

What: The old right-panel HP text line was removed in favor of the new below-arena HUD; the Status panel retains only coordinate info · Why: — · Where: index.html, src/main.ts. <!-- id: c0468463-20e6-4d0d-af7e-dabbc91f90ae-7 -->

## Ability cooldown is visualized with a CSS conic-gradient sweep on each `.ability` tile dr…

What: Ability cooldown is visualized with a CSS conic-gradient sweep on each `.ability` tile driven by a `--cd` custom property (fraction of cooldown remaining), a numeric countdown label, and a `ready`/`cooling`/`active` state class · Why: — · Where: src/style.css, src/hud.ts. <!-- id: c0468463-20e6-4d0d-af7e-dabbc91f90ae-8 -->

## chiron-memory/decisions.md is an append-only log of independent entries; merge conflicts…

What: chiron-memory/decisions.md is an append-only log of independent entries; merge conflicts on it must be resolved by keeping both sides' entries concatenated, never by picking one side · Why: — · Where: chiron-memory/decisions.md · Learned: applied when merging origin/master — kept master's fog-readability entry followed by this branch's two HUD entries. <!-- id: c0468463-20e6-4d0d-af7e-dabbc91f90ae-9 -->
