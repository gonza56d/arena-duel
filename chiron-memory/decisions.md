# decision

A choice made and the reasoning behind it — the path taken over the alternatives.

## The Arena Duel client shell is built with Vite + vanilla TypeScript, no UI framework, wit…

What: The Arena Duel client shell is built with Vite + vanilla TypeScript, no UI framework, with only `vite` and `typescript` as devDependencies · Why: lightest path to a TS canvas render loop with a dev server and production build; a framework adds nothing for this shell · Where: package.json, tsconfig.json (repo root) <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-0 -->

## Auth uses stateless JWT (HS256) bearer tokens instead of DB-stored session tokens

What: Auth uses stateless JWT (HS256) bearer tokens instead of DB-stored session tokens · Why: avoids an extra sessions collection and fits v1 scope; trade-off accepted is no server-side logout/revocation yet · Where: light-backend/internal/auth/token.go (TokenIssuer is the seam to swap for opaque DB tokens later) <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-0 -->

## Passwords are hashed with bcrypt rather than argon2

What: Passwords are hashed with bcrypt rather than argon2 · Why: simpler and battle-tested, available via x/crypto, satisfies the 'strong salted algorithm' requirement without extra tuning · Where: light-backend/internal/auth/password.go <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-1 -->

## Signup in v1 does not send or require any email verification/mailing

What: Signup in v1 does not send or require any email verification/mailing · Why: user explicitly said mailing is not needed yet, keeping v1 scope to email+password only · Where: light-backend/internal/handlers/handlers.go (signup flow) <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-10 -->
