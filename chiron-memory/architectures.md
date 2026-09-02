# architecture

How the system is put together — layers, boundaries, and how data flows.

## The arena is a fixed 2100×2100-unit square; the whole arena is scaled/fit into the browse…

What: The arena is a fixed 2100×2100-unit square; the whole arena is scaled/fit into the browser window rather than mapping 1 arena unit = 1 pixel · Why: the arena is larger than any supported viewport, so it must be letterboxed/scaled to fit · Where: src/arena.ts (`ArenaViewport` class) · Learned: all later rendering (players, skills, fog-of-war) must go through `ArenaViewport.arenaToScreen`/`screenToArena`/`unitsToPixels` rather than drawing raw arena coordinates directly onto the canvas <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-1 -->

## The page layout is a CSS grid with the canvas placed in a center cell and all UI bars/pan…

What: The page layout is a CSS grid with the canvas placed in a center cell and all UI bars/panels placed in the surrounding grid tracks · Why: this makes it structurally impossible for UI to overlap the canvas, instead of relying on z-index or visual convention alone · Where: index.html, src/style.css <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-2 -->

## The canvas is sized DPR-aware (crisp on HiDPI) and a `ResizeObserver` recomputes the `Are…

What: The canvas is sized DPR-aware (crisp on HiDPI) and a `ResizeObserver` recomputes the `ArenaViewport` on every resize, driving a `requestAnimationFrame` render loop · Why: the arena must stay pixel-crisp and correctly scaled as the window or device pixel ratio changes, not just on initial load · Where: src/renderer.ts <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-6 -->
