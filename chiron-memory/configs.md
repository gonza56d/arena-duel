# config

Setup and configuration — env vars, flags, how to run the project.

## Project is run via `npm run dev` (Vite dev server), built via `npm run build` (tsc + vite…

What: Project is run via `npm run dev` (Vite dev server), built via `npm run build` (tsc + vite build), type-checked via `npm run typecheck`, and unit-tested via `npm test` (vitest run) / `npm run test:watch`; devDependencies are `vite`, `typescript` and `vitest`, no runtime dependencies · Why: — · Where: package.json scripts. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-7 -->

## `JWT_SECRET` is a required environment variable and the server refuses to start without it

What: `JWT_SECRET` is a required environment variable and the server refuses to start without it · Why: — · Where: light-backend/internal/config/config.go, .env.example <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-7 -->
