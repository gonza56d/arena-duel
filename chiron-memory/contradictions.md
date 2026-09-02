# contradiction

A memory that clashes with newer reality — flagged to be resolved.

## The README claims '26 possible points' but the actual per-skill level tables sum to 38 to…

What: The README claims '26 possible points' but the actual per-skill level tables sum to 38 total levels across 10 leveled stats (28 upgrade steps above the level-1 minimums) · Why: the generator and validator drive off the config tables, not the README figure, so the README text is stale/wrong · Where: README.md vs src/config.ts skill level tables · Learned: don't trust the README's stat-point count; verify against config.ts tables. <!-- id: 6926e2c3-7419-4ad6-b844-125c61d8128a-3 -->

## A concurrent change on master replaced the per-stat `SkillLevels` (0-indexed level per st…

What: A concurrent change on master replaced the per-stat `SkillLevels` (0-indexed level per stat, resolved from CONFIG) approach with a `Loadout` system — a 1-based "skill.stat" map from a random 16-point-per-match build; `resolveDash/Slash/Shot/Shield` now read through `statValue(loadout, cfg)` instead · Why: master's random-build design became the single source of truth for skill levels during the merge · Where: src/sim/loadout.ts, src/sim/skills/*.ts · Learned: any earlier memory describing "level index per stat"/SkillLevels is superseded by this Loadout-based resolution <!-- id: e2412a3f-22b6-4699-abeb-07d261e5f0b0-13 -->
