# architecture

How the system is put together — layers, boundaries, and how data flows.

## The arena is a fixed 2100×2100-unit square; the client fits the whole arena into the brow…

What: The arena is a fixed 2100×2100-unit square; the client fits the whole arena into the browser window (scale = min(windowW, windowH) / 2100) rather than mapping 1 unit = 1 px · Why: the arena is larger than any supported viewport, so it must be scaled/letterboxed to fit · Where: src/arena.ts (`ArenaViewport` class) · Learned: this is the shared coordinate-mapping contract all future rendering (players, skills, fog-of-war) must use — call `arenaToScreen`/`screenToArena`/`unitsToPixels` rather than computing pixel positions independently. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-0 -->

## The canvas is sized using devicePixelRatio (not just CSS pixels), with a ResizeObserver o…

What: The canvas is sized using devicePixelRatio (not just CSS pixels), with a ResizeObserver on the canvas's container recomputing the ArenaViewport on every resize · Why: keeps rendering crisp on HiDPI/Retina displays and keeps the coordinate mapping in sync whenever the letterboxed canvas size changes · Where: src/renderer.ts. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-6 -->

## The 'light' backend (accounts + auth, low-intensity requests) lives in its own top-level…

What: The 'light' backend (accounts + auth, low-intensity requests) lives in its own top-level directory `light-backend/`, separate from the future game backend that will handle combat · Why: v1 combat runs client-side; accounts/profile is a distinct low-intensity service per the project's two-backend split · Where: light-backend/ <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-2 -->

## Data access goes through a `UserStore` interface with a MongoDB implementation and an in-…

What: Data access goes through a `UserStore` interface with a MongoDB implementation and an in-memory fake implementation · Why: Lets handler/unit tests run against the in-memory fake with no live MongoDB required · Where: light-backend/internal/store/store.go, mongo.go, memory.go <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-3 -->
