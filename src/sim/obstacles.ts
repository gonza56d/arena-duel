/**
 * Random obstacle layout. Obstacles are axis-aligned rectangles placed by
 * rejection sampling so that:
 *  - every obstacle keeps ≥ `minGap` from every other obstacle and from the
 *    arena edge (the gap is ≥ a player diameter, so every corridor is passable);
 *  - no obstacle intrudes on a spawn point's clearance circle.
 *
 * All randomness comes from the injected `Rng`, so a seed fully determines the
 * layout. Every number comes from `GameConfig.arena.obstacles`.
 */
import { CONFIG, type GameConfig } from "../config";
import { circleIntersectsRect, rectsCloserThan, type Rect } from "./geometry";
import type { Rng } from "./rng";

export interface Obstacle extends Rect {
  id: number;
}

export function generateObstacles(rng: Rng, cfg: GameConfig = CONFIG): Obstacle[] {
  const { size, spawnPoints, obstacles: o } = cfg.arena;
  const placed: Obstacle[] = [];
  const count = rng.int(o.countMin, o.countMax);

  for (let i = 0; i < count; i++) {
    for (let attempt = 0; attempt < o.maxPlacementAttempts; attempt++) {
      const w = rng.int(o.sideMin, o.sideMax);
      const h = rng.int(o.sideMin, o.sideMax);
      const maxX = size - o.minGap - w;
      const maxY = size - o.minGap - h;
      if (maxX < o.minGap || maxY < o.minGap) continue; // cannot fit at this size

      const candidate: Rect = {
        x: Math.round(rng.range(o.minGap, maxX)),
        y: Math.round(rng.range(o.minGap, maxY)),
        w,
        h,
      };

      if (placed.some((p) => rectsCloserThan(candidate, p, o.minGap))) continue;
      if (spawnPoints.some((s) => circleIntersectsRect({ ...s, r: o.spawnClearance }, candidate))) continue;

      placed.push({ id: placed.length, ...candidate });
      break;
    }
  }

  return placed;
}
