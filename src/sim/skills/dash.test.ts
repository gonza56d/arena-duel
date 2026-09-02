import { describe, expect, it } from "vitest";
import { CONFIG, type GameConfig } from "../../config";
import { circleInsideSquare, circleIntersectsRect, circlesIntersect, distance } from "../geometry";
import { defaultSkillLevels } from "./stats";
import { createWorld, stepWorld, type PlayerInput, type World } from "../world";

const TICK = CONFIG.sim.tickMs;
const SIZE = CONFIG.arena.size;
const R = CONFIG.player.radius;
const dash = CONFIG.skills.dash;

function withDash(patch: Partial<GameConfig["skills"]["dash"]>): GameConfig {
  return { ...CONFIG, skills: { ...CONFIG.skills, dash: { ...dash, ...patch } } };
}

/** Obstacle-free world (plus `obstacles`), dasher (id 0) at `me`, rival (id 1) at `rival`. */
function setup(opts: {
  me?: { x: number; y: number };
  rival?: { x: number; y: number };
  obstacles?: { x: number; y: number; w: number; h: number }[];
  config?: GameConfig;
  distanceLevel?: number;
}): World {
  const config = opts.config ?? CONFIG;
  const noObstacles: GameConfig = {
    ...config,
    arena: { ...config.arena, obstacles: { ...config.arena.obstacles, countMin: 0, countMax: 0 } },
  };
  const lv = defaultSkillLevels();
  lv.dash.distance = opts.distanceLevel ?? 0;
  const w = createWorld({ seed: 1, config: noObstacles, levels: { 0: lv } });
  w.players[0].pos = opts.me ?? { x: 1000, y: 1000 };
  w.players[1].pos = opts.rival ?? { x: 1000, y: 200 };
  (w.obstacles as { x: number; y: number; w: number; h: number; id: number }[]).push(
    ...(opts.obstacles ?? []).map((o, id) => ({ ...o, id })),
  );
  return w;
}

const idle: PlayerInput = { move: { x: 0, y: 0 } };
const dashRight: PlayerInput = { move: { x: 1, y: 0 }, skills: { dash: true } };

/** Press dash with `input`, then keep `hold` for the rest of the dash. */
function doDash(w: World, input: PlayerInput = dashRight, hold: PlayerInput = idle, ticks = dash.durationMs / TICK): void {
  stepWorld(w, { 0: input });
  for (let i = 1; i < ticks; i++) stepWorld(w, { 0: hold });
}

function assertValid(w: World): void {
  const [me, rival] = w.players;
  expect(circleInsideSquare({ ...me.pos, r: R }, SIZE)).toBe(true);
  for (const o of w.obstacles) expect(circleIntersectsRect({ ...me.pos, r: R }, o)).toBe(false);
  expect(circlesIntersect({ ...me.pos, r: R }, { ...rival.pos, r: R })).toBe(false);
}

describe("Dash", () => {
  it("covers exactly the level's distance in exactly 100 ms, 10 units per tick", () => {
    const w = setup({});
    const me = w.players[0];
    stepWorld(w, { 0: dashRight });
    expect(me.dash).not.toBeNull();
    expect(me.pos.x).toBeCloseTo(1010);
    expect(me.cooldowns.dash).toBe(dash.cooldownMs[0]);
    for (let i = 1; i < 10; i++) {
      stepWorld(w, { 0: idle });
      expect(me.pos.x).toBeCloseTo(1000 + 10 * (i + 1));
    }
    expect(me.pos).toEqual({ x: 1100, y: 1000 });
    expect(me.dash).toBeNull();
    // Normal walking resumes at 3 units per tick.
    stepWorld(w, { 0: { move: { x: 1, y: 0 } } });
    expect(me.pos.x).toBeCloseTo(1103);
  });

  it("goes in the direction the player is moving, normalised", () => {
    const w = setup({});
    doDash(w, { move: { x: 1, y: 1 }, skills: { dash: true } });
    const me = w.players[0];
    expect(distance(me.pos, { x: 1000, y: 1000 })).toBeCloseTo(100);
    expect(me.pos.x - 1000).toBeCloseTo(me.pos.y - 1000);
  });

  it("uses the last movement direction when idle", () => {
    const w = setup({});
    stepWorld(w, { 0: { move: { x: 0, y: -1 } } });
    stepWorld(w, { 0: idle });
    doDash(w, { move: { x: 0, y: 0 }, skills: { dash: true } });
    expect(w.players[0].pos.x).toBeCloseTo(1000);
    expect(w.players[0].pos.y).toBeCloseTo(1000 - 3 - 100);
    expect(w.players[0].lastMoveDir).toEqual({ x: 0, y: -1 });
  });

  it("ignores movement input while dashing", () => {
    const w = setup({});
    doDash(w, dashRight, { move: { x: 0, y: -1 } });
    expect(w.players[0].pos).toEqual({ x: 1100, y: 1000 });
  });

  it("takes the same 100 ms whatever the distance level", () => {
    const w = setup({ distanceLevel: 3 });
    doDash(w);
    expect(w.players[0].pos.x).toBeCloseTo(1000 + dash.distance[3]);
    expect(w.players[0].dash).toBeNull();
  });

  it("reads distance and duration from the config", () => {
    const w = setup({ config: withDash({ distance: [300, 300, 300, 300], durationMs: 200 }) });
    doDash(w, dashRight, idle, 10);
    expect(w.players[0].pos.x).toBeCloseTo(1150); // half way after 100 ms
    expect(w.players[0].dash).not.toBeNull();
    for (let i = 0; i < 10; i++) stepWorld(w, { 0: idle });
    expect(w.players[0].pos.x).toBeCloseTo(1300);
    expect(w.players[0].dash).toBeNull();
  });

  it("cannot be used while on cooldown (including mid-dash)", () => {
    const w = setup({ config: withDash({ cooldownMs: [300, 300, 300, 300] }) });
    const me = w.players[0];
    stepWorld(w, { 0: dashRight });
    for (let i = 0; i < 20; i++) stepWorld(w, { 0: dashRight }); // spam through the dash and the cooldown
    expect(me.pos.x).toBeCloseTo(1100 + 11 * 3); // one dash, then walking
    for (let i = 0; i < 10; i++) stepWorld(w, { 0: idle });
    expect(me.cooldowns.dash).toBe(0);
    doDash(w);
    expect(me.pos.x).toBeCloseTo(1100 + 33 + 100);
  });

  it("stops flush against the arena edge", () => {
    const w = setup({ me: { x: 2050, y: 1000 } });
    doDash(w);
    expect(w.players[0].pos.x).toBeCloseTo(SIZE - R, 5);
    assertValid(w);
  });

  it("stops flush against an obstacle in its path", () => {
    const wall = { x: 1050, y: 800, w: 100, h: 400 };
    const w = setup({ obstacles: [wall] });
    doDash(w);
    expect(w.players[0].pos.x).toBeCloseTo(wall.x - R, 5);
    assertValid(w);
  });

  it("stops at an obstacle corner without clipping it", () => {
    const block = { x: 1050, y: 1050, w: 100, h: 100 };
    const w = setup({ obstacles: [block] });
    doDash(w, { move: { x: 1, y: 1 }, skills: { dash: true } });
    const me = w.players[0];
    expect(distance(me.pos, { x: block.x, y: block.y })).toBeCloseTo(R, 4);
    assertValid(w);
  });

  it("lands just behind an enemy it dashes over when the dash distance exceeds their distance", () => {
    const w = setup({ rival: { x: 1060, y: 1000 } });
    doDash(w);
    const [me, rival] = w.players;
    expect(me.pos.x).toBeCloseTo(1060 + 2 * R, 4); // touching the enemy's far side
    expect(me.pos.x).toBeGreaterThan(rival.pos.x);
    expect(rival.pos).toEqual({ x: 1060, y: 1000 }); // the enemy is passed over, not shoved
    assertValid(w);
  });

  it("passes over an enemy and lands at full distance when that spot is already clear", () => {
    const w = setup({ rival: { x: 1050, y: 1000 } }); // touching; exit point is exactly 100 away
    doDash(w);
    expect(w.players[0].pos.x).toBeCloseTo(1100, 4);
    assertValid(w);
  });

  it("lands in front of an enemy when the dash distance does not exceed their distance", () => {
    const w = setup({ rival: { x: 1120, y: 1000 } });
    doDash(w);
    const [me, rival] = w.players;
    expect(me.pos.x).toBeCloseTo(1120 - 2 * R, 4);
    expect(me.pos.x).toBeLessThan(rival.pos.x);
    assertValid(w);
  });

  it("lands in front when an obstacle sits right behind the enemy", () => {
    const w = setup({ rival: { x: 1060, y: 1000 }, obstacles: [{ x: 1095, y: 800, w: 100, h: 400 }] });
    doDash(w);
    expect(w.players[0].pos.x).toBeCloseTo(1060 - 2 * R, 4);
    assertValid(w);
  });

  it("lands in front when the arena edge sits right behind the enemy", () => {
    const w = setup({ me: { x: 1990, y: 1000 }, rival: { x: 2050, y: 1000 } });
    doDash(w);
    expect(w.players[0].pos.x).toBeCloseTo(2050 - 2 * R, 4);
    assertValid(w);
  });

  it("goes over an enemy whose far side is clear even if an obstacle lies further along", () => {
    // Enemy at 60; wall starts at 1200 so the landing behind (1110) is fine.
    const w = setup({ rival: { x: 1060, y: 1000 }, obstacles: [{ x: 1200, y: 800, w: 100, h: 400 }] });
    doDash(w);
    expect(w.players[0].pos.x).toBeCloseTo(1110, 4);
    assertValid(w);
  });

  it("never ends overlapping anything across many random situations", () => {
    let s = 7;
    const rnd = (): number => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
    for (let i = 0; i < 300; i++) {
      const w = createWorld({ seed: 100 + i });
      const [me, rival] = w.players;
      // Drop both players at random free spots.
      for (const p of [me, rival]) {
        for (let tries = 0; tries < 100; tries++) {
          p.pos = { x: R + rnd() * (SIZE - 2 * R), y: R + rnd() * (SIZE - 2 * R) };
          const other = p === me ? rival : me;
          const clear =
            !w.obstacles.some((o) => circleIntersectsRect({ ...p.pos, r: R }, o)) &&
            !circlesIntersect({ ...p.pos, r: R }, { ...other.pos, r: R });
          if (clear) break;
        }
      }
      // Usually aim roughly at the rival so the enemy rule gets exercised.
      const toRival = { x: rival.pos.x - me.pos.x + (rnd() - 0.5) * 60, y: rival.pos.y - me.pos.y + (rnd() - 0.5) * 60 };
      const dir = rnd() < 0.7 ? toRival : { x: rnd() - 0.5, y: rnd() - 0.5 };
      doDash(w, { move: dir, skills: { dash: true } });
      assertValid(w);
    }
  });

  it("can be combined with another skill in the same tick", () => {
    const w = setup({});
    stepWorld(w, { 0: { move: { x: 1, y: 0 }, skills: { dash: true, slashPrimary: true } } });
    expect(w.players[0].dash).not.toBeNull();
    expect(w.players[0].slash).not.toBeNull();
  });

  it("cannot be used by the dead", () => {
    const w = setup({});
    w.players[0].hp = 0;
    stepWorld(w, { 0: dashRight });
    expect(w.players[0].dash).toBeNull();
    expect(w.players[0].pos).toEqual({ x: 1000, y: 1000 });
  });
});
