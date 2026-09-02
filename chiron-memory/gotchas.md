# gotcha

A non-obvious pitfall or trap, learned the hard way.

## An element's `[hidden]` attribute can be silently overridden if an author CSS rule sets `…

What: An element's `[hidden]` attribute can be silently overridden if an author CSS rule sets `display: grid` or `display: flex` on that same selector (e.g. `.app`, `.block-screen`) · Why: author `display` rules win over the UA default `[hidden] { display: none }` rule in CSS specificity/cascade order · Where: src/style.css · Learned: added an explicit `[hidden] { display: none !important; }` guard so the device gate's show/hide toggling is reliable. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-3 -->

## The claude-in-chrome `resize_window` tool can report success while not actually shrinking…

What: The claude-in-chrome `resize_window` tool can report success while not actually shrinking the real browser window below the display's own constraints · Why: window resizing is bounded by the host display/OS, so requesting a smaller size than that floor silently no-ops · Learned: to test small-viewport/device-gate logic, override `window.innerWidth`/`window.innerHeight` via `Object.defineProperty` and dispatch a `resize` event instead of relying on `resize_window`. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-5 -->

## `go.mongodb.org/mongo-driver/v2` appears as an indirect dependency in go.mod even though…

What: `go.mongodb.org/mongo-driver/v2` appears as an indirect dependency in go.mod even though the project uses the v1 driver (`go.mongodb.org/mongo-driver v1.17.9`) directly · Why: v2 is pulled in transitively via Gin's dependency stack, not something the project added intentionally · Where: light-backend/go.mod · Learned: don't mistake the indirect v2 entry for the driver actually in use <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-8 -->

## The MongoDB Go driver's `InsertOne` does not write the generated ObjectID back into the p…

What: The MongoDB Go driver's `InsertOne` does not write the generated ObjectID back into the passed struct automatically; the store code must extract it from the InsertOneResult and set it on the User manually · Why: — · Where: light-backend/internal/store/mongo.go <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-9 -->

## MTV push-out leaves shapes overlapping by ~1e-14 unless a contact skin is added

What: After pushing a circle out of a rectangle/circle by exactly `r - dist`, floating-point rounding can leave them overlapping by ~4e-14, so strict intersection checks still report contact forever · Why: `hypot` and the division/multiplication by the normal do not round-trip exactly · Where: src/sim/geometry.ts (`CONTACT_SKIN = 1e-6` added to every resolver's push) · Learned: tests that assert "not intersecting" after resolution need the skin, not looser tolerances.

## Iterative push-out + clamp converges only geometrically (~0.5× per pass) and never converges in an exact-fit gap

What: When a circle is wedged between the arena edge and another circle, each resolve pass removes only about half the remaining overlap; in a corridor exactly one diameter wide the contact skin makes the two pushes oscillate forever · Why: the edge clamp undoes part of every diagonal push; with a gap == diameter there is no position that is skin-free of both walls · Where: src/sim/movement.ts · Learned: `sim.collisionIterations` is a generous cap (24) with early exit, and `movePlayer` cancels a move whose result is not free — generated layouts always have `minGap ≥ 90` so exact-fit gaps never occur in practice.

## The claude-in-chrome automation tab reports `visibilityState: hidden`, so requestAnimationFrame never fires there

What: In the MCP-controlled tab `document.visibilityState` is `hidden` and `hasFocus()` is false even after clicking on the page, so the rAF game loop never advances (tick count stays frozen) and synthetic key events appear to do nothing · Why: the tab group lives in a background window; screenshots still work because they are captured via the extension · Learned: smoke-test the client through `window.arenaDebug.step(ms, move)` (deterministic, frame-independent) instead of waiting on wall-clock time; do not mistake the frozen loop for a bug in game.ts.
