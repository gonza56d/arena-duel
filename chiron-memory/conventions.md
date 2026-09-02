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
