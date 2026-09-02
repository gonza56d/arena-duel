# Arena Duel — Light Backend

The low-intensity backend for Arena Duel: it owns **accounts and auth** now and
will own **player profile** later. The real-time combat backend is a separate
service. This one persists across all milestones.

Stack: **Go + Gin**, **MongoDB** (official driver), **bcrypt** password hashing,
**JWT (HS256)** bearer tokens.

## Endpoints

| Method | Path           | Auth      | Description                                  |
| ------ | -------------- | --------- | -------------------------------------------- |
| GET    | `/health`      | –         | Liveness probe.                              |
| POST   | `/auth/signup` | –         | Register with `email` + `password`.          |
| POST   | `/auth/login`  | –         | Verify credentials, return a bearer token.   |
| GET    | `/me`          | Bearer    | Return the authenticated user.               |

### Rules

- **Email** is validated for format and stored lowercased; a unique index
  rejects duplicates.
- **Password** must be 8–128 chars with at least one letter and one digit.
- **Passwords are never stored or returned in plaintext** — only a salted
  bcrypt hash is persisted, and `PasswordHash` is `json:"-"` so it can't leak
  through a response.
- **Login** returns the same `401` for unknown email and wrong password so
  accounts can't be enumerated.

## Configuration

Copy `.env.example` to `.env` (see that file for each variable). `JWT_SECRET`
is required; the rest have local-dev defaults.

## Run

```bash
# Start MongoDB (example with Docker):
docker run -d --name arena-mongo -p 27017:27017 mongo:7

# Load env and run:
export $(grep -v '^#' .env | xargs)   # or use your preferred env loader
go run ./cmd/server
```

## Test

```bash
go test ./...
```

The handler tests run against an in-memory user store, so no MongoDB is
required for the test suite. They cover all four acceptance criteria: signup +
duplicate rejection, hashed-not-plaintext storage, the token/`me` flow (200 with
a token, 401 without), and email/password validation.

## Example

```bash
# Sign up
curl -s -X POST localhost:8080/auth/signup \
  -H 'Content-Type: application/json' \
  -d '{"email":"player@example.com","password":"passw0rd"}'

# Log in -> {"token":"...","token_type":"Bearer"}
TOKEN=$(curl -s -X POST localhost:8080/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"player@example.com","password":"passw0rd"}' | jq -r .token)

# Me
curl -s localhost:8080/me -H "Authorization: Bearer $TOKEN"
```

## Layout

```
cmd/server/         entrypoint
internal/config/    env-based configuration
internal/models/    User document
internal/store/     UserStore interface + Mongo impl + in-memory fake
internal/auth/      bcrypt hashing + JWT issue/verify
internal/validate/  email + password-strength rules
internal/handlers/  signup, login, me
internal/middleware/ bearer-token auth middleware
internal/server/    router wiring
```
