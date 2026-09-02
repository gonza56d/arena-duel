# decision

A choice made and the reasoning behind it — the path taken over the alternatives.

## Client stack: Vite + TypeScript, no UI framework

**What.** The browser client is a Vite + TypeScript project (vanilla, no React/Vue).
Scripts: `npm run dev`, `npm run build` (runs `tsc --noEmit` then `vite build`),
`npm run typecheck`. Only devDeps are `vite` and `typescript`; zero runtime deps.

**Why.** TECH_SPECS requires all client code in TypeScript and canvas is
suggested. A render-loop canvas shell needs no component framework, so we avoided
one to keep the bundle and the mental model minimal. Vite gives a fast dev server
+ typed production build out of the box.

**Where.** `package.json`, `tsconfig.json`, `src/`.

**Learned.** 2026-09-02, initial client bootstrap work order.

## Arena is fitted whole into the window (not 1 unit = 1 px)

**What.** The arena is a fixed 2100×2100-unit square. The client scales the
*entire* arena to fit the available canvas box (`scale = min(w,h)/2100` px per
unit) rather than mapping 1 unit to 1 px. The canvas is sized to the largest
square that fits its stage cell.

**Why.** The arena (2100u) is larger than any supported viewport (≥800×600 css
px), so 1:1 would never fit. Fitting the whole square keeps the full battlefield
on screen and the aspect ratio fixed at 1:1 on any window size.

**Where.** `src/arena.ts` (`ARENA_SIZE`, `ArenaViewport`), `src/renderer.ts`.

**Learned.** 2026-09-02. Decision was pre-made in the work order; implemented here.

## Desktop-only gate: block phones and viewports < 800×600 css px

**What.** Before booting the game, `check()` blocks (shows a full-screen message
instead of the game) when it detects a phone (coarse pointer + no hover, or a
phone UA) or when `innerWidth < 800 || innerHeight < 600`. Re-evaluated on every
resize, so crossing the threshold shows/hides the game live. 800×600 exactly is
allowed; 799 is blocked.

**Why.** TECH_SPECS: desktop only for now, block phones and anything below a size
that makes sense; must work on a maximized 800×600 browser (that is the floor).

**Where.** `src/deviceGate.ts` (`MIN_WIDTH`/`MIN_HEIGHT`, `check`), wired in
`src/main.ts`.

**Learned.** 2026-09-02, initial client bootstrap work order.
