import { describe, expect, it } from "vitest";
import { CONFIG, type GameConfig } from "../config";
import { circleInsideSquare, circleIntersectsRect, circlesIntersect } from "./geometry";
import { isDead } from "./player";
import { createWorld, damagePlayer, stepWorld } from "./world";

describe("createWorld", () => {
  it("spawns players at the config spawn points with config stats", () => {
    const w = createWorld({ seed: 1 });
    expect(w.arenaSize).toBe(CONFIG.arena.size);
    expect(w.players).toHaveLength(2);
    expect(w.players[0].pos).toEqual(CONFIG.arena.spawnPoints[0]);
    expect(w.players[1].pos).toEqual(CONFIG.arena.spawnPoints[1]);
    expect(w.players[0].radius).toBe(CONFIG.player.radius);
    expect(w.players[0].hp).toBe(CONFIG.player.maxHp);
  });

  it("is deterministic per seed", () => {
    expect(createWorld({ seed: 5 }).obstacles).toEqual(createWorld({ seed: 5 }).obstacles);
  });

  it("spawns nobody inside an obstacle", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const w = createWorld({ seed });
      for (const p of w.players) {
        for (const o of w.obstacles) expect(circleIntersectsRect({ ...p.pos, r: p.radius }, o)).toBe(false);
      }
    }
  });

  it("rejects an invalid config up front", () => {
    const bad: GameConfig = { ...CONFIG, player: { ...CONFIG.player, maxHp: 9.5 } };
    expect(() => createWorld({ seed: 1, config: bad })).toThrow(/Invalid game config/);
  });
});

describe("stepWorld", () => {
  it("moves a player at spec speed and advances time", () => {
    const w = createWorld({ seed: 1 });
    const start = { ...w.players[0].pos };
    const ticks = 100 / CONFIG.sim.tickMs;
    for (let i = 0; i < ticks; i++) stepWorld(w, { 0: { move: { x: 0, y: -1 } } });
    expect(w.players[0].pos.y).toBeCloseTo(start.y - 30);
    expect(w.players[0].pos.x).toBeCloseTo(start.x);
    expect(w.timeMs).toBeCloseTo(100);
    expect(w.tick).toBe(ticks);
  });

  it("leaves idle players in place", () => {
    const w = createWorld({ seed: 1 });
    const start = { ...w.players[1].pos };
    for (let i = 0; i < 100; i++) stepWorld(w, { 0: { move: { x: 1, y: 0 } } });
    expect(w.players[1].pos).toEqual(start);
  });

  it("never lets anyone leave the arena or overlap anything over a long random walk", () => {
    const w = createWorld({ seed: 77 });
    let s = 123;
    const rnd = (): number => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296) * 2 - 1;
    for (let i = 0; i < 20_000; i++) {
      if (i % 50 === 0) {
        // Re-roll directions occasionally so the walk explores the map.
        stepWorld(w, { 0: { move: { x: rnd(), y: rnd() } }, 1: { move: { x: rnd(), y: rnd() } } });
      } else {
        stepWorld(w, { 0: { move: w.players[0].lastMoveDir }, 1: { move: w.players[1].lastMoveDir } });
      }
      for (const p of w.players) {
        expect(circleInsideSquare({ ...p.pos, r: p.radius }, w.arenaSize)).toBe(true);
        for (const o of w.obstacles) expect(circleIntersectsRect({ ...p.pos, r: p.radius }, o)).toBe(false);
      }
      const [a, b] = w.players;
      expect(circlesIntersect({ ...a.pos, r: a.radius }, { ...b.pos, r: b.radius })).toBe(false);
    }
  });

  it("heals over time and kills at zero", () => {
    const w = createWorld({ seed: 1 });
    damagePlayer(w, 0, 3);
    expect(w.players[0].hp).toBe(CONFIG.player.maxHp - 3);

    const ticks = CONFIG.player.healIntervalMs / CONFIG.sim.tickMs;
    for (let i = 0; i < ticks; i++) stepWorld(w);
    expect(w.players[0].hp).toBe(CONFIG.player.maxHp - 2);

    damagePlayer(w, 0, CONFIG.player.maxHp);
    expect(isDead(w.players[0])).toBe(true);

    // Dead players neither move nor heal.
    const pos = { ...w.players[0].pos };
    for (let i = 0; i < ticks * 2; i++) stepWorld(w, { 0: { move: { x: 1, y: 0 } } });
    expect(w.players[0].pos).toEqual(pos);
    expect(isDead(w.players[0])).toBe(true);
  });

  it("changing one config constant changes behaviour with no other edits", () => {
    const tuned: GameConfig = {
      ...CONFIG,
      player: { ...CONFIG.player, moveSpeedUnitsPer100ms: 90, maxHp: 20, healIntervalMs: 1000 },
    };
    const w = createWorld({ seed: 1, config: tuned });
    expect(w.players[0].hp).toBe(20);

    const start = w.players[0].pos.y;
    for (let i = 0; i < 100 / tuned.sim.tickMs; i++) stepWorld(w, { 0: { move: { x: 0, y: -1 } } });
    expect(w.players[0].pos.y).toBeCloseTo(start - 90);

    damagePlayer(w, 0, 5);
    for (let i = 0; i < 1000 / tuned.sim.tickMs; i++) stepWorld(w);
    expect(w.players[0].hp).toBe(16);
  });
});
