# gotcha

A non-obvious pitfall or trap, learned the hard way.

## Toggling visibility via the `[hidden]` attribute doesn't work once author CSS sets `displ…

What: Toggling visibility via the `[hidden]` attribute doesn't work once author CSS sets `display` on the same element's class (e.g. `.app { display: grid }`, `.block-screen { display: flex }`), because those rules override the UA `[hidden]` default by specificity · Why: needed an explicit `[hidden] { display: none }` rule in the stylesheet for the block-screen/app toggle to actually hide/show · Where: src/style.css <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-4 -->
