# decision

A choice made and the reasoning behind it — the path taken over the alternatives.

## Client stack chosen is Vite + vanilla TypeScript, no UI framework, canvas 2D API for rend…

What: Client stack chosen is Vite + vanilla TypeScript, no UI framework, canvas 2D API for rendering · Why: lightest path to a TS canvas render loop with dev server + production build; only needed devDeps were `vite` and `typescript` · Where: package.json, tsconfig.json, src/main.ts. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-1 -->

## Desktop/device gate blocks phones (coarse pointer + no hover, or phone UA string) and any…

What: Desktop/device gate blocks phones (coarse pointer + no hover, or phone UA string) and any viewport below 800×600 CSS px, with an exact boundary (800×600 renders the game, 799×600 blocks it); re-evaluated live on resize · Why: — · Where: src/deviceGate.ts, wired in src/main.ts. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-4 -->

## Light backend (accounts/auth) built as new Go module in `light-backend/`, using Gin, offi…

What: Light backend (accounts/auth) built as new Go module in `light-backend/`, using Gin, official MongoDB driver, bcrypt for password hashing, and JWT (HS256) bearer tokens · Why: Gin+MongoDB were suggested by the work order; bcrypt is simpler and as battle-tested as argon2 for meeting the 'strong salted algorithm' requirement · Where: light-backend/go.mod <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-0 -->

## Bearer tokens are stateless JWTs (HS256) rather than opaque tokens stored in a `sessions`…

What: Bearer tokens are stateless JWTs (HS256) rather than opaque tokens stored in a `sessions` collection · Why: Simpler for v1, no extra collection needed; trade-off explicitly accepted: no server-side logout/revocation yet · Where: light-backend/internal/auth/token.go · Learned: TokenIssuer in token.go is the seam to swap for DB-stored opaque tokens if revocation is needed later <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-1 -->

## Victories/games_played change only via UserStore.IncrementRecord, which has no HTTP endpoint in v1

What: The record counters (`victories`, `games_played`) change only via `UserStore.IncrementRecord(ctx, id, won)` (Mongo `$inc`), and that method is deliberately not exposed over HTTP · Why: an authenticated client endpoint would let players record their own wins; the future match-end path (game backend or a trusted server-side call) is the intended caller · Where: light-backend/internal/store/store.go, mongo.go, memory.go · Learned: `IncrementRecord` is the seam to wire when the match-end flow exists; don't add a client-facing route for it <!-- id: d6850825-ffb9-4edd-b6a4-f3419ad682ee-3 -->

## configured_stats is reserved on the User model as map[string]int, omitempty, never written in v1

What: `configured_stats` is reserved on the User model as `map[string]int` (stat name → level), `omitempty` in bson and json, and never written in v1 · Why: the PRD's 16-points-over-26-stats build is v2; reserving the field now fixes the document shape without exposing an editable surface · Where: light-backend/internal/models/user.go <!-- id: d6850825-ffb9-4edd-b6a4-f3419ad682ee-4 -->
