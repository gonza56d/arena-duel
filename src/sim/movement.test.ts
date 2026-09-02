import { describe, expect, it } from "vitest";
import { CONFIG, type GameConfig } from "../config";
import { circleInsideSquare, circleIntersectsRect, circlesIntersect, distance } from "./geometry";
import { moveDistance, movePlayer, type Environment } from "./movement";
import { applySlow, createPlayer } from "./player";

const SIZE = CONFIG.arena.size;
const R = CONFIG.player.radius;
const TICK = CONFIG.sim.tickMs;

const emptyEnv: Environment = { arenaSize: SIZE, obstacles: [], others: [] };

/** Run `ms` of simulation in fixed ticks. */
function run(p: ReturnType<typeof createPlayer>, input: { x: number; y: number }, ms: number, env = emptyEnv, cfg = CONFIG): void {
  const ticks = Math.round(ms / TICK);
  for (let i = 0; i < ticks; i++) movePlayer(p, input, TICK, env, cfg);
}

describe("movement speed", () => {
  it("covers 30 units per 100 ms with the default config", () => {
    expect(moveDistance(100)).toBeCloseTo(30);
  });

  it("moves 30 units in 100 ms along +x", () => {
    const p = createPlayer(0, { x: 1000, y: 1000 });
    run(p, { x: 1, y: 0 }, 100);
    expect(p.pos.x).toBeCloseTo(1030);
    expect(p.pos.y).toBeCloseTo(1000);
  });

  it("moves 30 units in 100 ms along any direction (diagonals are not faster)", () => {
    for (const input of [
      { x: 1, y: 1 },
      { x: -1, y: 1 },
      { x: 0, y: -1 },
      { x: 3, y: -7 },
      { x: 0.2, y: 0 },
    ]) {
      const p = createPlayer(0, { x: 1000, y: 1000 });
      run(p, input, 100);
      expect(distance(p.pos, { x: 1000, y: 1000 })).toBeCloseTo(30);
    }
  });

  it("stands still with zero input", () => {
    const p = createPlayer(0, { x: 1000, y: 1000 });
    run(p, { x: 0, y: 0 }, 1000);
    expect(p.pos).toEqual({ x: 1000, y: 1000 });
  });

  it("remembers the last non-zero direction", () => {
    const p = createPlayer(0, { x: 1000, y: 1000 });
    run(p, { x: 0, y: -2 }, TICK);
    run(p, { x: 0, y: 0 }, TICK);
    expect(p.lastMoveDir).toEqual({ x: 0, y: -1 });
  });

  it("moves at half speed while slowed", () => {
    const p = createPlayer(0, { x: 1000, y: 1000 });
    applySlow(p, 5000, 0.5);
    run(p, { x: 1, y: 0 }, 100);
    expect(p.pos.x).toBeCloseTo(1015);
  });

  it("changing only the config speed changes the distance travelled", () => {
    const fast: GameConfig = { ...CONFIG, player: { ...CONFIG.player, moveSpeedUnitsPer100ms: 60 } };
    const slow: GameConfig = { ...CONFIG, player: { ...CONFIG.player, moveSpeedUnitsPer100ms: 10 } };

    const a = createPlayer(0, { x: 1000, y: 1000 }, fast);
    run(a, { x: 1, y: 0 }, 100, emptyEnv, fast);
    expect(a.pos.x).toBeCloseTo(1060);

    const b = createPlayer(0, { x: 1000, y: 1000 }, slow);
    run(b, { x: 1, y: 0 }, 100, emptyEnv, slow);
    expect(b.pos.x).toBeCloseTo(1010);
  });
});

describe("arena edges", () => {
  it.each([
    ["left", { x: -1, y: 0 }, (p: { x: number; y: number }) => p.x],
    ["right", { x: 1, y: 0 }, (p: { x: number; y: number }) => SIZE - p.x],
    ["top", { x: 0, y: -1 }, (p: { x: number; y: number }) => p.y],
    ["bottom", { x: 0, y: 1 }, (p: { x: number; y: number }) => SIZE - p.y],
  ])("stops flush against the %s edge and never leaves", (_name, input, gapToEdge) => {
    const p = createPlayer(0, { x: SIZE / 2, y: SIZE / 2 });
    run(p, input, 20_000); // far more than needed to cross the arena
    expect(gapToEdge(p.pos)).toBeCloseTo(R);
    expect(circleInsideSquare({ ...p.pos, r: R }, SIZE)).toBe(true);
  });

  it("slides along a wall when pushing diagonally into it", () => {
    const p = createPlayer(0, { x: 100, y: 1000 });
    run(p, { x: -1, y: 1 }, 1000);
    expect(p.pos.x).toBeCloseTo(R);
    expect(p.pos.y).toBeGreaterThan(1000);
    expect(circleInsideSquare({ ...p.pos, r: R }, SIZE)).toBe(true);
  });

  it("gets pinned in a corner without escaping", () => {
    const p = createPlayer(0, { x: 200, y: 200 });
    run(p, { x: -1, y: -1 }, 5000);
    expect(p.pos.x).toBeCloseTo(R);
    expect(p.pos.y).toBeCloseTo(R);
  });

  it("uses the arena size from the config", () => {
    const small: GameConfig = { ...CONFIG, arena: { ...CONFIG.arena, size: 500 } };
    const env: Environment = { arenaSize: small.arena.size, obstacles: [], others: [] };
    const p = createPlayer(0, { x: 250, y: 250 }, small);
    run(p, { x: 1, y: 0 }, 5000, env, small);
    expect(p.pos.x).toBeCloseTo(500 - R);
  });
});

describe("obstacles", () => {
  const wall = { x: 1200, y: 800, w: 100, h: 400 };
  const env: Environment = { arenaSize: SIZE, obstacles: [wall], others: [] };

  it("stops at an obstacle and never overlaps it", () => {
    const p = createPlayer(0, { x: 1000, y: 1000 });
    for (let i = 0; i < 300; i++) {
      movePlayer(p, { x: 1, y: 0 }, TICK, env);
      expect(circleIntersectsRect({ ...p.pos, r: R }, wall)).toBe(false);
    }
    expect(p.pos.x).toBeCloseTo(wall.x - R);
    expect(p.pos.y).toBeCloseTo(1000);
  });

  it("slides along an obstacle face", () => {
    const tall = { x: 1200, y: 0, w: 100, h: SIZE };
    const tallEnv: Environment = { arenaSize: SIZE, obstacles: [tall], others: [] };
    const p = createPlayer(0, { x: 1000, y: 1000 });
    run(p, { x: 1, y: 1 }, 1500, tallEnv);
    expect(p.pos.x).toBeCloseTo(tall.x - R);
    expect(p.pos.y).toBeGreaterThan(1100);
    expect(circleIntersectsRect({ ...p.pos, r: R }, tall)).toBe(false);
  });

  it("rounds an obstacle corner and continues past it", () => {
    const p = createPlayer(0, { x: 1000, y: 1000 });
    run(p, { x: 1, y: 1 }, 3000, env);
    expect(p.pos.x).toBeGreaterThan(wall.x + wall.w); // got past the wall's bottom-right corner
    expect(circleIntersectsRect({ ...p.pos, r: R }, wall)).toBe(false);
  });

  it("is pushed out if it starts overlapping", () => {
    const p = createPlayer(0, { x: 1210, y: 1000 });
    movePlayer(p, { x: 0, y: 0 }, TICK, env);
    expect(circleIntersectsRect({ ...p.pos, r: R }, wall)).toBe(false);
  });

  it("is pushed out of an obstacle corner", () => {
    const p = createPlayer(0, { x: 1190, y: 790 });
    for (let i = 0; i < 50; i++) movePlayer(p, { x: 1, y: 1 }, TICK, env);
    expect(circleIntersectsRect({ ...p.pos, r: R }, wall)).toBe(false);
  });
});

describe("other players", () => {
  it("cannot walk through another player", () => {
    const rival = { x: 1300, y: 1000, r: R };
    const env: Environment = { arenaSize: SIZE, obstacles: [], others: [rival] };
    const p = createPlayer(0, { x: 1000, y: 1000 });
    for (let i = 0; i < 300; i++) {
      movePlayer(p, { x: 1, y: 0 }, TICK, env);
      expect(circlesIntersect({ ...p.pos, r: R }, rival)).toBe(false);
    }
    expect(p.pos.x).toBeCloseTo(rival.x - 2 * R);
  });

  it("slides around another player when approaching off-centre", () => {
    const rival = { x: 1300, y: 1010, r: R };
    const env: Environment = { arenaSize: SIZE, obstacles: [], others: [rival] };
    const p = createPlayer(0, { x: 1000, y: 1000 });
    run(p, { x: 1, y: 0 }, 2000, env);
    expect(circlesIntersect({ ...p.pos, r: R }, rival)).toBe(false);
    expect(p.pos.x).toBeGreaterThan(rival.x); // got past
  });
});

describe("combined", () => {
  it("stays valid when squeezed between the arena edge, an obstacle and a player", () => {
    const wall = { x: 100, y: 0, w: 100, h: 800 };
    const rival = { x: 60, y: 900, r: R };
    const env: Environment = { arenaSize: SIZE, obstacles: [wall], others: [rival] };
    const p = createPlayer(0, { x: 60, y: 700 });
    for (let i = 0; i < 500; i++) {
      movePlayer(p, { x: -1, y: 1 }, TICK, env);
      expect(circleInsideSquare({ ...p.pos, r: R }, SIZE)).toBe(true);
      expect(circleIntersectsRect({ ...p.pos, r: R }, wall)).toBe(false);
      expect(circlesIntersect({ ...p.pos, r: R }, rival)).toBe(false);
    }
    // Ended up resting against both the edge and the rival, not frozen mid-way.
    expect(p.pos.x).toBeCloseTo(R);
    expect(distance(p.pos, rival)).toBeCloseTo(2 * R, 2);
  });

  it("stops behind a rival blocking a narrow corridor, without overlapping anything", () => {
    // Corridor barely wider than a player, rival dead ahead: nowhere to slide.
    const left = { x: 0, y: 0, w: 100, h: 2000 };
    const right = { x: 154, y: 0, w: 100, h: 2000 };
    const rival = { x: 127, y: 500, r: R };
    const env: Environment = { arenaSize: SIZE, obstacles: [left, right], others: [rival] };
    const p = createPlayer(0, { x: 127, y: 300 });
    for (let i = 0; i < 300; i++) {
      movePlayer(p, { x: 0.3, y: 1 }, TICK, env);
      expect(circleIntersectsRect({ ...p.pos, r: R }, left)).toBe(false);
      expect(circleIntersectsRect({ ...p.pos, r: R }, right)).toBe(false);
      expect(circlesIntersect({ ...p.pos, r: R }, rival)).toBe(false);
    }
    expect(p.pos.y).toBeCloseTo(rival.y - 2 * R, 1);
  });

  it("cancels a move it cannot resolve instead of leaving the player overlapping", () => {
    // Degenerate exact-fit corridor (gap == diameter): pushing sideways can never settle.
    const left = { x: 0, y: 0, w: 100, h: 2000 };
    const right = { x: 150, y: 0, w: 100, h: 2000 };
    const env: Environment = { arenaSize: SIZE, obstacles: [left, right], others: [] };
    const p = createPlayer(0, { x: 125, y: 300 });
    movePlayer(p, { x: 1, y: 0 }, TICK, env);
    expect(p.pos).toEqual({ x: 125, y: 300 });
    expect(circleIntersectsRect({ ...p.pos, r: R }, left)).toBe(false);
    expect(circleIntersectsRect({ ...p.pos, r: R }, right)).toBe(false);
  });
});
