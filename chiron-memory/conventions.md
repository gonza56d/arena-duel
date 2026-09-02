# convention

A rule the codebase follows — naming, patterns, and where things live.

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

## No gameplay literal outside `src/config.ts`; units are arena units / milliseconds / degrees; level arrays are 0-indexed

What: Gameplay numbers never appear as literals outside `src/config.ts` — other modules read `CONFIG` (e.g. `ARENA_SIZE` in src/arena.ts is a re-export, the HUD reads `CONFIG.player.maxHp`). Distances are arena units, times milliseconds, angles degrees; skill level arrays are indexed from 0 (= "level 1" in the design doc) · Why: the whole point of the config module is that a tuning pass touches one file · Where: src/config.ts (header comment states the rules).

## Dev-only browser handle `window.arenaDebug` (gated on `import.meta.env.DEV`) exposes `config`, `world`, `damage(n, id)` and `step(ms, move)`

What: In dev builds `main.ts` sets `window.arenaDebug = { config, world, damage(amount, playerId), step(ms, move) }`; `step` advances exactly `ms` of simulated time through `Game.advance` regardless of frame rate · Why: lets HP/heal/death and movement be exercised from the console (and from browser automation) deterministically; stripped from production builds by the DEV gate · Where: src/main.ts (`exposeDebug`), src/vite-env.d.ts (Vite client types).
