# gotcha

A non-obvious pitfall or trap, learned the hard way.

## An element's `[hidden]` attribute can be silently overridden if an author CSS rule sets `…

What: An element's `[hidden]` attribute can be silently overridden if an author CSS rule sets `display: grid` or `display: flex` on that same selector (e.g. `.app`, `.block-screen`) · Why: author `display` rules win over the UA default `[hidden] { display: none }` rule in CSS specificity/cascade order · Where: src/style.css · Learned: added an explicit `[hidden] { display: none !important; }` guard so the device gate's show/hide toggling is reliable. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-3 -->

## The claude-in-chrome `resize_window` tool can report success while not actually shrinking…

What: The claude-in-chrome `resize_window` tool can report success while not actually shrinking the real browser window below the display's own constraints · Why: window resizing is bounded by the host display/OS, so requesting a smaller size than that floor silently no-ops · Learned: to test small-viewport/device-gate logic, override `window.innerWidth`/`window.innerHeight` via `Object.defineProperty` and dispatch a `resize` event instead of relying on `resize_window`. <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-5 -->
