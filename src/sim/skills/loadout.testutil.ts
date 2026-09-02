/**
 * Test-only helper: build a *valid* loadout (exactly `build.points` spent) with
 * the levels a test cares about pinned via `overrides` (1-based, as in
 * `Loadout`) and the leftover points poured into `filler` stats the test does
 * not observe. `createWorld` rolls random builds when none are given, so skill
 * tests must pass explicit loadouts to assert exact cooldowns and ranges.
 */
import { CONFIG, leveledStatIds, type GameConfig, type StatId } from "../../config";
import { assertValidLoadout, baseLoadout, statMaxLevel, type Loadout } from "../loadout";

export const DEFAULT_FILLER: readonly StatId[] = [
  "shield.cooldownMs",
  "dash.distance",
  "slash.range",
  "shot.range",
  "slash.areaDeg",
  "shot.damage",
  "slash.damage",
  "dash.cooldownMs",
  "slash.cooldownMs",
  "shot.cooldownMs",
];

export function testLoadout(
  overrides: Partial<Record<StatId, number>> = {},
  filler: readonly StatId[] = DEFAULT_FILLER,
  cfg: GameConfig = CONFIG,
): Loadout {
  const lv = { ...baseLoadout(cfg), ...overrides } as Record<StatId, number>;
  let remaining = cfg.build.points - leveledStatIds(cfg).reduce((sum, id) => sum + lv[id], 0);
  if (remaining < 0) throw new Error(`testLoadout: overrides overspend by ${-remaining} point(s)`);
  for (const id of filler) {
    if (id in overrides) continue;
    while (remaining > 0 && lv[id] < statMaxLevel(id, cfg)) {
      lv[id] += 1;
      remaining -= 1;
    }
  }
  if (remaining > 0) throw new Error(`testLoadout: ${remaining} point(s) left with no filler room`);
  assertValidLoadout(lv, cfg);
  return lv;
}
