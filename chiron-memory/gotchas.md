# gotcha

A non-obvious pitfall or trap, learned the hard way.

## Toggling visibility via the `[hidden]` attribute doesn't work once author CSS sets `displ…

What: Toggling visibility via the `[hidden]` attribute doesn't work once author CSS sets `display` on the same element's class (e.g. `.app { display: grid }`, `.block-screen { display: flex }`), because those rules override the UA `[hidden]` default by specificity · Why: needed an explicit `[hidden] { display: none }` rule in the stylesheet for the block-screen/app toggle to actually hide/show · Where: src/style.css <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-4 -->

## The MongoDB Go driver's InsertOne does not write the generated ObjectID back into the str…

What: The MongoDB Go driver's InsertOne does not write the generated ObjectID back into the struct that was passed in · Why: — · Where: light-backend/internal/store/mongo.go (CreateUser) · Learned: the store layer must explicitly retrieve/assign the generated ID after insert <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-7 -->

## go.mod ends up with both go.mongodb.org/mongo-driver (v1, direct) and go.mongodb.org/mong…

What: go.mod ends up with both go.mongodb.org/mongo-driver (v1, direct) and go.mongodb.org/mongo-driver/v2 (indirect) · Why: the v2 entry is pulled in transitively by Gin's dependency stack, not a real version conflict · Learned: don't try to 'fix' this by removing the indirect v2 line <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-8 -->

## chiron-memory/*.md files conflict often when concurrent work lands on master

What: chiron-memory/*.md files conflict often when concurrent work lands on master · Why: — · Where: chiron-memory/decisions.md, architectures.md, conventions.md, configs.md · Learned: resolve by keeping both sides' real entries, but if master has re-canonicalized an entry into the `<!-- id -->` canonical form, drop this branch's duplicate prose copy of the same concept instead of keeping both — otherwise the same knowledge is duplicated in two formats <!-- id: 8be8faed-7ee8-48da-9741-541435585adf-9 -->
