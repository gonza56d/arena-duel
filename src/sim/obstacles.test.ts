import { describe, expect, it } from "vitest";
import { CONFIG } from "../config";
import { circleIntersectsRect, rectsCloserThan } from "./geometry";
import { generateObstacles } from "./obstacles";
import { createRng } from "./rng";

const o = CONFIG.arena.obstacles;

describe("generateObstacles", () => {
  it("is deterministic for a seed and differs across seeds", () => {
    const a = generateObstacles(createRng(42));
    const b = generateObstacles(createRng(42));
    const c = generateObstacles(createRng(43));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it.each([1, 7, 42, 1234, 99999])("seed %i produces a valid layout", (seed) => {
    const obstacles = generateObstacles(createRng(seed));

    expect(obstacles.length).toBeGreaterThanOrEqual(1);
    expect(obstacles.length).toBeLessThanOrEqual(o.countMax);

    for (const r of obstacles) {
      // Sizes within the configured range.
      expect(r.w).toBeGreaterThanOrEqual(o.sideMin);
      expect(r.w).toBeLessThanOrEqual(o.sideMax);
      expect(r.h).toBeGreaterThanOrEqual(o.sideMin);
      expect(r.h).toBeLessThanOrEqual(o.sideMax);

      // Inside the arena with a passable corridor along every edge.
      expect(r.x).toBeGreaterThanOrEqual(o.minGap);
      expect(r.y).toBeGreaterThanOrEqual(o.minGap);
      expect(r.x + r.w).toBeLessThanOrEqual(CONFIG.arena.size - o.minGap);
      expect(r.y + r.h).toBeLessThanOrEqual(CONFIG.arena.size - o.minGap);

      // Spawn points stay clear.
      for (const s of CONFIG.arena.spawnPoints) {
        expect(circleIntersectsRect({ ...s, r: o.spawnClearance }, r)).toBe(false);
      }
    }

    // Every pair keeps at least a player-diameter gap.
    for (let i = 0; i < obstacles.length; i++) {
      for (let j = i + 1; j < obstacles.length; j++) {
        expect(rectsCloserThan(obstacles[i], obstacles[j], o.minGap - 1e-9)).toBe(false);
      }
    }
  });

  it("reads its counts from the config", () => {
    const cfg = { ...CONFIG, arena: { ...CONFIG.arena, obstacles: { ...o, countMin: 3, countMax: 3 } } };
    expect(generateObstacles(createRng(1), cfg)).toHaveLength(3);
  });
});
