# convention

A rule the codebase follows — naming, patterns, and where things live.

## UI HTML (top/side/bottom bars) is placed around the canvas using a CSS grid with the canv…

What: UI HTML (top/side/bottom bars) is placed around the canvas using a CSS grid with the canvas confined to a center cell, instead of relying on z-index/absolute-positioning discipline to avoid overlap · Why: makes it structurally impossible for UI to cover the canvas, satisfying the 'UI never overlaps canvas' requirement by layout rather than convention · Where: index.html, src/style.css. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-2 -->
