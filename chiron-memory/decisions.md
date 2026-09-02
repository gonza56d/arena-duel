# decision

A choice made and the reasoning behind it — the path taken over the alternatives.

## Client stack chosen is Vite + vanilla TypeScript, no UI framework, canvas 2D API for rend…

What: Client stack chosen is Vite + vanilla TypeScript, no UI framework, canvas 2D API for rendering · Why: lightest path to a TS canvas render loop with dev server + production build; only needed devDeps were `vite` and `typescript` · Where: package.json, tsconfig.json, src/main.ts. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-1 -->

## Desktop/device gate blocks phones (coarse pointer + no hover, or phone UA string) and any…

What: Desktop/device gate blocks phones (coarse pointer + no hover, or phone UA string) and any viewport below 800×600 CSS px, with an exact boundary (800×600 renders the game, 799×600 blocks it); re-evaluated live on resize · Why: — · Where: src/deviceGate.ts, wired in src/main.ts. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-4 -->
