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
