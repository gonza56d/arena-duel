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

## Player color is validated as `#RRGGBB` or a preset name (red, blue, green, yellow, orange…

What: Player color is validated as `#RRGGBB` or a preset name (red, blue, green, yellow, orange, purple, cyan, pink, white, black) and always persisted/returned as lowercase `#rrggbb`; new accounts start at `#ffffff` · Why: the client paints the player circle on a canvas, so a single hex form avoids every consumer re-mapping names to values; the preset list is a convenience for the UI picker · Where: light-backend/internal/validate/profile.go (`Color`, `DefaultColor`) <!-- id: d6850825-ffb9-4edd-b6a4-f3419ad682ee-0 -->

## Player name rule is 2–24 printable runes, trimmed, and not unique across players

What: Player name rule is 2–24 printable runes, trimmed, and not unique across players · Why: the work order requires the name to be changeable at any time and imposes no uniqueness; identity is the account email, not the display name · Where: light-backend/internal/validate/profile.go (`PlayerName`) <!-- id: d6850825-ffb9-4edd-b6a4-f3419ad682ee-1 -->

## Profile updates go through `PATCH /profile`, which binds a dedicated request struct conta…

What: Profile updates go through `PATCH /profile`, which binds a dedicated request struct containing only `player_name` and `color` (both optional, at least one required); unknown keys such as `victories` are ignored, and a request with any invalid field is rejected whole with 400 · Why: the record counters must be impossible to set from the client, and a field-restricted bind type guarantees that structurally instead of by a runtime check · Where: light-backend/internal/handlers/profile.go, light-backend/internal/store/store.go (`ProfileUpdate`) <!-- id: d6850825-ffb9-4edd-b6a4-f3419ad682ee-2 -->

## A dev-only `window.arenaDebug` handle exposes `damage(n)` and `step(ms, move)` for manual…

What: A dev-only `window.arenaDebug` handle exposes `damage(n)` and `step(ms, move)` for manually driving/inspecting sim state from the browser console · Why: lets HP/heal/death and movement be poked and verified in a running browser without building full UI controls · Where: wired in src/main.ts / src/game.ts, dev builds only. <!-- id: 9a1bb5b3-64ad-4637-9caa-418980c8239f-11 -->

## The HUD (src/main.ts) displays live HP plus a heal countdown timer, not just a static HP…

What: The HUD (src/main.ts) displays live HP plus a heal countdown timer, not just a static HP value · Why: — · Where: src/main.ts, driven by world/player state from src/sim/. <!-- id: 9a1bb5b3-64ad-4637-9caa-418980c8239f-16 -->

## `validateConfig()` throws loudly if HP, damage, or heal values are non-integer, or if gen…

What: `validateConfig()` throws loudly if HP, damage, or heal values are non-integer, or if generation ranges are invalid (e.g. obstacle gaps too small to pass) · Why: HP/damage must always be integer per spec; catching a bad config at startup is cheaper than debugging a rounding bug mid-game · Where: src/config.ts. <!-- id: 9a1bb5b3-64ad-4637-9caa-418980c8239f-3 -->

## `validateConfig()` enforces a feasibility invariant: number of leveled stats ≤ `build.poi…

What: `validateConfig()` enforces a feasibility invariant: number of leveled stats ≤ `build.points` ≤ sum of each stat's max level · Why: guarantees a valid 16-point loadout is always constructible (every stat startable at 1, budget never unspendable or overflowing) before the generator even runs · Where: src/config.ts <!-- id: 6926e2c3-7419-4ad6-b844-125c61d8128a-5 -->

## `statValue()` is the single bridge function that converts a loadout's 1-based level into…

What: `statValue()` is the single bridge function that converts a loadout's 1-based level into the 0-indexed level-table lookup · Why/ · Why: — · Where: src/sim/loadout.ts · Learned: keeps the 1-based/0-indexed conversion in one place instead of scattering `-1` offsets across the codebase <!-- id: 6926e2c3-7419-4ad6-b844-125c61d8128a-7 -->

## `validateLoadout()` returns every violation it finds, not just the first

What: `validateLoadout()` returns every violation it finds, not just the first · Why: lets v2's manual builder surface full feedback on an invalid build in one pass, since it's meant to be reused as-is · Where: src/sim/loadout.ts <!-- id: 6926e2c3-7419-4ad6-b844-125c61d8128a-9 -->

## The HUD shows the live round score and match outcome as "You X – Y Zombie" plus a status…

What: The HUD shows the live round score and match outcome as "You X – Y Zombie" plus a status line (e.g. "Match won!") driven by `Match.roundsWon`/`phase`/`matchWinnerId` · Why: — · Where: src/main.ts, index.html, src/style.css <!-- id: 49b8d994-1df7-4abe-bf04-4b1b018c17fb-13 -->

## Fog of war in the renderer only hides an occluded rival's body, direction indicator, and…

What: Fog of war in the renderer only hides an occluded rival's body, direction indicator, and dash trail; in-flight projectiles/bullets stay visible even when they pass behind where an obstacle would occlude a player. · Why: — · Where: src/renderer.ts (draw(world, fx, viewerId)) <!-- id: 49b8d994-1df7-4abe-bf04-4b1b018c17fb-5 -->

## `validateConfig` enforces a feasibility check that the point budget is between the number…

What: `validateConfig` enforces a feasibility check that the point budget is between the number of leveled stats and the sum of their max levels (10 ≤ points ≤ 38 currently) · Why: guarantees any config change still allows a valid 1-per-stat minimum build without exceeding total max levels · Where: src/config.ts validateConfig <!-- id: 6926e2c3-7419-4ad6-b844-125c61d8128a-2 -->

## POST /profile/record always increments games_played on a valid authenticated call, but on…

What: POST /profile/record always increments games_played on a valid authenticated call, but only increments victories when the request body's won field is true; unauthenticated calls get 401. · Why: mirrors the profile record semantics (a loss still counts as a game played) and keeps the route behind auth even though it trusts client-reported outcomes in v1. · Where: light-backend/internal/handlers/profile.go, light-backend/internal/server/record_test.go. <!-- id: 49b8d994-1df7-4abe-bf04-4b1b018c17fb-11 -->

## A round ends the instant a player hits 0 HP (survivor wins that round; simultaneous death…

What: A round ends the instant a player hits 0 HP (survivor wins that round; simultaneous death is a round draw); the match is won on reaching roundsToWin = floor(N/2)+1, or decided/drawn once all N rounds are played if no majority (even N). · Why: defines best-of-N semantics precisely so scoring code and tests agree on edge cases (early stop vs full N, draws). · Where: src/sim/match.ts roundOutcome/concludeRound. <!-- id: 49b8d994-1df7-4abe-bf04-4b1b018c17fb-2 -->

## NPC behavior mechanics: movement is a random wander (unit direction re-picked on a random…

What: NPC behavior mechanics: movement is a random wander (unit direction re-picked on a random interval, with occasional idle pauses) while skill use is pressing one currently-ready skill at random on a random cadence. · Why: gives an NPC that 'randomly moves and uses skills' per the work order's intent, distinct from a scripted or optimal opponent. · Where: src/sim/npc.ts. <!-- id: 49b8d994-1df7-4abe-bf04-4b1b018c17fb-9 -->

## Shot's bullet travels at a fixed speed derived from config (arena side length per 1000ms,…

What: Shot's bullet travels at a fixed speed derived from config (arena side length per 1000ms, i.e. 1s to cross the map) and is swept each tick against edges, obstacles and living players excluding its owner; the first contact stops it · Why: — · Where: src/sim/skills/shot.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-12 -->

## Because createWorld rolls a random per-player Loadout, skill unit tests pin only the leve…

What: Because createWorld rolls a random per-player Loadout, skill unit tests pin only the levels they assert on via a `testLoadout` helper, which fills remaining stat points into stats the test doesn't observe · Why: keeps skill tests deterministic without hand-writing full loadouts for every stat · Where: src/sim/skills/*.test.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-15 -->

## Slash records which targets it has already hit during the current swing, so the per-tick…

What: Slash records which targets it has already hit during the current swing, so the per-tick angular-slice test doesn't re-damage the same enemy on a later tick as the blade continues sweeping · Why: needed because contact is tested every tick rather than once per swing · Where: src/sim/skills/slash.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-22 -->

## Bullet radius and blade width are computed via derived helper functions in config.ts (bul…

What: Bullet radius and blade width are computed via derived helper functions in config.ts (bulletRadius, bladeWidth) from player-width ratios, rather than stored as standalone literal stat fields · Why: — · Where: src/config.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-23 -->

## Slash's and Bash's cones use the player centre as the apex, with the skill's "range" stat…

What: Slash's and Bash's cones use the player centre as the apex, with the skill's "range" stat measured as the sector radius from that centre · Why: README doesn't specify apex/measurement point; centre-to-centre was chosen for consistency with the circle collision model · Where: src/sim/skills/slash.ts, src/sim/skills/bash.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-4 -->

## Slash, Shot and Bash lock their aim direction at the moment the triggering key/click is p…

What: Slash, Shot and Bash lock their aim direction at the moment the triggering key/click is pressed; Shield instead keeps following the live pointer for the whole time it's active · Why: — · Where: src/sim/skills/*.ts <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-5 -->
