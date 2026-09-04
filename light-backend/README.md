# Arena Duel — Light Backend

The low-intensity backend for Arena Duel: it owns **accounts, auth and the
player profile** (name, color, record). The real-time combat backend is a
separate service. This one persists across all milestones.

Stack: **Go + Gin**, **MongoDB** (official driver), **bcrypt** password hashing,
**JWT (HS256)** bearer tokens.

## Endpoints

| Method | Path           | Auth      | Description                                  |
| ------ | -------------- | --------- | -------------------------------------------- |
| GET    | `/health`      | –         | Liveness probe.                              |
| POST   | `/auth/signup` | –         | Register with `email` + `password`.          |
| POST   | `/auth/login`  | –         | Verify credentials, return a bearer token.   |
| GET    | `/me`          | Bearer    | Return the authenticated user document.      |
| GET    | `/profile`     | Bearer    | Player profile: name, color, record, build.  |
| PATCH  | `/profile`     | Bearer    | Update `player_name` and/or `color`.         |
| PUT    | `/profile/build` | Bearer  | Replace the stat build (`configured_stats`). |
| POST   | `/profile/record` | Bearer | Record a finished match (`{"won": bool}`).   |

### Rules

- **Email** is validated for format and stored lowercased; a unique index
  rejects duplicates.
- **Password** must be 8–128 chars with at least one letter and one digit.
- **Passwords are never stored or returned in plaintext** — only a salted
  bcrypt hash is persisted, and `PasswordHash` is `json:"-"` so it can't leak
  through a response.
- **Login** returns the same `401` for unknown email and wrong password so
  accounts can't be enumerated.
- **Player name** is changeable at any time: 2–24 printable characters,
  trimmed, not unique.
- **Color** accepts `#RRGGBB` or a preset (`red`, `blue`, `green`, `yellow`,
  `orange`, `purple`, `cyan`, `pink`, `white`, `black`) and is always stored
  and returned as lowercase `#rrggbb`. New accounts start with `#ffffff`.
- **Victories / games played are server-owned.** `PATCH /profile` binds only
  `player_name` and `color`; any other key is ignored. The counters change only
  through `UserStore.IncrementRecord` via `POST /profile/record`, which bumps
  them by at most one game per call (a client cannot set arbitrary values).
- **Stat build (v2).** `PUT /profile/build` replaces `configured_stats` (stat
  id → 1-based level) as a whole. The build is validated server-side against
  the catalog mirrored from `src/config.ts` (see `internal/validate/build.go`):
  every leveled stat present, each level within `[1, its max]`, no unknown
  stats, and exactly 16 points spent (spend = sum of levels). An invalid build
  gets `400` with every violation in `details` and nothing is written. A user
  who never saved a build has no `configured_stats` key in responses (v1
  shape preserved).

## Configuration

Copy `.env.example` to `.env` (see that file for each variable), or run `make env`
from the repo root to do it with a generated `JWT_SECRET`. `JWT_SECRET` is
required; the rest have local-dev defaults.

## Run

From the repository root — MongoDB is started in Docker and `.env` is created
from `.env.example` (with a random `JWT_SECRET`) on first run:

```bash
make run-backend      # backend only  -> http://localhost:8080
make run              # backend + client
make up               # whole stack in Docker Compose (see the root README)
```

Manually, without the Makefile:

```bash
# Start MongoDB (example with Docker):
docker run -d --name arena-mongo -p 27017:27017 mongo:7

# Load env and run:
export $(grep -v '^#' .env | xargs)   # or use your preferred env loader
go run ./cmd/server
```

The `Dockerfile` in this directory builds a small non-root image
(`docker build -t arena-duel-backend .`); it is what `docker-compose.yml` uses.

## Test

```bash
make test-backend     # from the repo root (make test runs client + backend)
go test ./...         # or directly
```

The handler tests run against an in-memory user store, so no MongoDB is
required for the test suite. They cover signup + duplicate rejection,
hashed-not-plaintext storage, the token/`me` flow (200 with a token, 401
without), email/password validation, and the profile flow (set/change name and
color, persistence across re-login, counters not client-editable).

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

# Set player name + color (preset or #RRGGBB), then read the profile
curl -s -X PATCH localhost:8080/profile \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"player_name":"Zed","color":"red"}'
curl -s localhost:8080/profile -H "Authorization: Bearer $TOKEN"
# -> {"id":"...","email":"...","player_name":"Zed","color":"#e53935","victories":0,"games_played":0}
```

## Layout

```
cmd/server/         entrypoint
internal/config/    env-based configuration
internal/models/    User document (account + profile + record counters)
internal/store/     UserStore interface + Mongo impl + in-memory fake
internal/auth/      bcrypt hashing + JWT issue/verify
internal/validate/  email, password-strength, player-name and color rules
internal/handlers/  signup, login, me, profile get/update
internal/middleware/ bearer-token auth middleware
internal/server/    router wiring
```
