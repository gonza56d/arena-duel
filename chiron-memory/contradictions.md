# contradiction

A memory that clashes with newer reality — flagged to be resolved.

## The README claims '26 possible points' but the actual per-skill level tables sum to 38 to…

What: The README claims '26 possible points' but the actual per-skill level tables sum to 38 total levels across 10 leveled stats (28 upgrade steps above the level-1 minimums) · Why: the generator and validator drive off the config tables, not the README figure, so the README text is stale/wrong · Where: README.md vs src/config.ts skill level tables · Learned: don't trust the README's stat-point count; verify against config.ts tables. <!-- id: 6926e2c3-7419-4ad6-b844-125c61d8128a-3 -->

## Enemy bullets, bullet-impact rings, and hit flashes are now occluded based on the effect'…

What: Enemy bullets, bullet-impact rings, and hit flashes are now occluded based on the effect's own current position being in view — not on whether the shooter/owner is currently visible — superseding the earlier recorded convention that projectiles stay visible in fog regardless · Why: hiding a bullet whenever its shooter is hidden would also hide bullets that already flew into the open; a bullet should behave like any object crossing the fog boundary. · Where: src/renderer.ts, chiron-memory/conventions.md. <!-- id: 8202c722-e583-407d-b90a-d9f614718cb7-4 -->
