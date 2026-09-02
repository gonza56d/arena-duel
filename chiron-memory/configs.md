# config

Setup and configuration — env vars, flags, how to run the project.

## Root `Makefile` is the developer entry point: `make run` / `make test` / `make up`; `make help` (default) lists every target

What: The root `Makefile` wraps both toolchains so nobody types `npm`/`go` directly. `make run` starts MongoDB through `docker compose up -d --wait mongo`, then `go run ./cmd/server` (sourcing `light-backend/.env`) and `npm run dev` in one terminal (Ctrl-C stops both); `make run-backend` / `make run-client` start one side. `make test` runs `test-client` (vitest) and `test-backend` (`go test ./...`), runs *both* even if the first fails, and exits non-zero if either failed. `make up`/`down`/`docker-build`/`logs` drive the compose stack. Client deps auto-install through the `node_modules/.package-lock.json` stamp (written by `npm ci`). `WITH_MONGO=0` skips the compose MongoDB for developers with their own instance · Why: the two components needed different toolchains plus a hand-started MongoDB before anything ran; one discoverable entry point removes that setup tax · Where: Makefile, README.md ("Getting started").

## `docker compose up` brings up mongo:7 + backend + client (Vite dev target) with zero required configuration

What: `docker-compose.yml` (project name `arena-duel`) defines `mongo` (mongo:7, `mongo-data` volume, `mongosh` ping healthcheck, port 27017 published so the host-run backend can use it), `backend` (built from `light-backend/`, env set inline mirroring `.env.example` with `MONGO_URI=mongodb://mongo:27017`, `JWT_SECRET=${JWT_SECRET:-dev default}`, `depends_on: mongo: condition: service_healthy`, `restart: unless-stopped`) and `client` (root `Dockerfile` target `dev`, `src/`, `index.html`, `tsconfig.json` bind-mounted for hot reload, `VITE_LIGHT_BACKEND_URL` defaulting to `http://localhost:8080`). Only `JWT_SECRET` is worth overriding (shell or git-ignored root `.env`) · Why: acceptance criterion was a working environment from one command with no manual DB setup; the backend pings Mongo at startup with a 10s timeout and `log.Fatal`s on failure, so the healthcheck gate (plus restart policy) is what makes the first `up` reliable · Where: docker-compose.yml, light-backend/cmd/server/main.go (startup ping).

## `light-backend/.env` is generated, not copied: `make env` fills `JWT_SECRET` with `openssl rand -hex 32`

What: `make env` (a prerequisite of `run` and `run-backend`) creates `light-backend/.env` from `.env.example` only if it is missing, replacing the `JWT_SECRET` placeholder with a random 64-hex value; `run-backend` loads it with `set -a; . ./.env; set +a` before `go run` because the server has no dotenv loader · Why: `JWT_SECRET` is mandatory and a fresh clone should run without hand-editing files, while never committing a real secret · Where: Makefile (`env`, `run-backend`), light-backend/.env.example.

## Project is run via `npm run dev` (Vite dev server), built via `npm run build` (tsc + vite…

What: Project is run via `npm run dev` (Vite dev server), built via `npm run build` (tsc + vite build), type-checked via `npm run typecheck`, and unit-tested via `npm test` (vitest run) / `npm run test:watch`; devDependencies are `vite`, `typescript` and `vitest`, no runtime dependencies · Why: — · Where: package.json scripts. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-7 -->

## `JWT_SECRET` is a required environment variable and the server refuses to start without it

What: `JWT_SECRET` is a required environment variable and the server refuses to start without it · Why: — · Where: light-backend/internal/config/config.go, .env.example <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-7 -->

## vitest ^4 was added as the project's first and only test dependency (none existed before…

What: vitest ^4 was added as the project's first and only test dependency (none existed before this work order). · Why: — · Where: package.json devDependencies, scripts.test = "vitest run", scripts["test:watch"] = "vitest watch". <!-- id: 9a1bb5b3-64ad-4637-9caa-418980c8239f-17 -->

## JWT_SECRET is the only environment value a developer needs to consider overriding for non…

What: JWT_SECRET is the only environment value a developer needs to consider overriding for non-local use — docker-compose supplies a dev-only default, and `make env`/`make run` auto-generates a random one into light-backend/.env if it's missing · Why: — · Where: Makefile, docker-compose.yml, light-backend/.env.example <!-- id: 4e0e2b7a-b190-46a6-b7a1-430eb2b62463-14 -->

## light-backend/go.mod requires Go 1.25 while the local toolchain may be 1.24.x; with GOTOO…

What: light-backend/go.mod requires Go 1.25 while the local toolchain may be 1.24.x; with GOTOOLCHAIN=auto the first `go build`/`go test` run auto-downloads Go 1.25 · Why: — · Where: light-backend/go.mod <!-- id: 4e0e2b7a-b190-46a6-b7a1-430eb2b62463-3 -->
