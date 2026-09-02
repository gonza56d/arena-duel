# decision

A choice made and the reasoning behind it — the path taken over the alternatives.

## Auth uses JWT (HS256) bearer tokens, not DB-stored sessions

- **What**: Login issues a stateless JWT signed with HS256; the subject claim is
  the user's Mongo ObjectID hex. No `sessions` collection.
- **Why**: Simplest thing that satisfies "session mechanism is a bearer token"
  for v1; no extra storage or lookup on every request. Trade-off accepted: no
  server-side revocation yet. If revocation/logout is needed later, switch to
  opaque random tokens in a `sessions` collection (the `TokenIssuer` in
  `internal/auth/token.go` is the seam to change).
- **Where**: `light-backend/internal/auth/token.go`, wired in `cmd/server/main.go`.
- **Learned**: WO "Light backend foundation — accounts, auth & MongoDB".

## Passwords hashed with bcrypt (DefaultCost), not argon2

- **What**: `internal/auth/password.go` uses `golang.org/x/crypto/bcrypt`.
- **Why**: Strong, salted (per-hash salt embedded), battle-tested, in the std
  extended libs — meets "strong salted algorithm" with less setup than argon2.
  Note bcrypt only uses the first 72 bytes; passwords are capped at 128 chars in
  `internal/validate`.
- **Where**: `light-backend/internal/auth/password.go`.
- **Learned**: same WO. Requirement: never store/log plaintext, incl. dev/test.

## Client stack chosen is Vite + vanilla TypeScript, no UI framework, canvas 2D API for rend…

What: Client stack chosen is Vite + vanilla TypeScript, no UI framework, canvas 2D API for rendering · Why: lightest path to a TS canvas render loop with dev server + production build; only needed devDeps were `vite` and `typescript` · Where: package.json, tsconfig.json, src/main.ts. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-1 -->

## Desktop/device gate blocks phones (coarse pointer + no hover, or phone UA string) and any…

What: Desktop/device gate blocks phones (coarse pointer + no hover, or phone UA string) and any viewport below 800×600 CSS px, with an exact boundary (800×600 renders the game, 799×600 blocks it); re-evaluated live on resize · Why: — · Where: src/deviceGate.ts, wired in src/main.ts. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-4 -->
