# convention

A rule the codebase follows — naming, patterns, and where things live.

## The desktop/device gate blocks phones (coarse pointer + no hover, or a phone user-agent)…

What: The desktop/device gate blocks phones (coarse pointer + no hover, or a phone user-agent) and any viewport below 800×600 CSS px, with 800×600 itself treated as the minimum supported (renders), and 799×600 blocking · Why: — · Where: src/deviceGate.ts <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-3 -->

## This project's Chiron workflow commits work-order changes to `master` and moves the corre…

What: This project's Chiron workflow commits work-order changes to `master` and moves the corresponding board card to Done via the `/chiron-push` command · Why: — · Where: Chiron board / `.chiron/project.json` <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-5 -->

## The desktop/device gate re-evaluates on every window resize (not just once on load), so s…

What: The desktop/device gate re-evaluates on every window resize (not just once on load), so shrinking the window below threshold blocks the game live and enlarging it restores the game without a page reload · Why: — · Where: src/deviceGate.ts, src/main.ts <!-- id: a8ff3d25-28af-4269-9f4d-3d0b0b6d3636-7 -->
