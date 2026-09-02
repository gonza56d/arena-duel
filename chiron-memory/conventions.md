# convention

A rule the codebase follows — naming, patterns, and where things live.

## Never expose password material; login errors are opaque

- **What**: `models.User.PasswordHash` has `json:"-"` so it never serializes.
  Signup returns the created user directly (safe because of that tag). Login
  returns the same `401 {"error":"invalid credentials"}` for both unknown email
  and wrong password. Emails are normalized (trim + lowercase) before storage
  and lookup in `internal/validate.Email`.
- **Why**: Prevent plaintext/hash leaks through API responses or logs, and avoid
  account enumeration. Case-insensitive uniqueness needs a consistent stored form.
- **Where**: `internal/models/user.go`, `internal/handlers/handlers.go`,
  `internal/validate/validate.go`.
- **Learned**: WO "Light backend foundation".

## Password strength rule: 8–128 chars, ≥1 letter and ≥1 digit

- **What**: The "basic strength rule" is defined once in
  `internal/validate.Password`. Upper bound 128 because bcrypt ignores bytes
  past 72; keep the rule here if it changes.
- **Where**: `internal/validate/validate.go`.
- **Learned**: same WO.

## UI HTML (top/side/bottom bars) is placed around the canvas using a CSS grid with the canv…

What: UI HTML (top/side/bottom bars) is placed around the canvas using a CSS grid with the canvas confined to a center cell, instead of relying on z-index/absolute-positioning discipline to avoid overlap · Why: makes it structurally impossible for UI to cover the canvas, satisfying the 'UI never overlaps canvas' requirement by layout rather than convention · Where: index.html, src/style.css. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-2 -->
