import { describe, expect, it } from "vitest";
import { CONFIG, bulletRadius, bulletSpeedUnitsPerMs, type GameConfig } from "../../config";
import { defaultSkillLevels, type SkillLevels } from "./stats";
import { createWorld, stepWorld, type PlayerInput, type World } from "../world";

const TICK = CONFIG.sim.tickMs;
const SIZE = CONFIG.arena.size;
const R = CONFIG.player.radius;
const { maxHp } = CONFIG.player;
const shot = CONFIG.skills.shot;
const BULLET_R = bulletRadius(CONFIG); // 12.5
const SPEED = bulletSpeedUnitsPerMs(CONFIG); // 2.1 units/ms → 21 per tick

function withShot(patch: Partial<GameConfig["skills"]["shot"]>): GameConfig {
  return { ...CONFIG, skills: { ...CONFIG.skills, shot: { ...shot, ...patch } } };
}

/** Obstacle-free world; shooter (id 0) at `me`, rival (id 1) at `rival`, shooter aiming at `aim`. */
function setup(opts: {
  me?: { x: number; y: number };
  rival?: { x: number; y: number };
  aim?: { x: number; y: number };
  config?: GameConfig;
  levels?: Partial<SkillLevels["shot"]>;
  obstacles?: { x: number; y: number; w: number; h: number }[];
}): World {
  const config = opts.config ?? CONFIG;
  const noObstacles: GameConfig = {
    ...config,
    arena: { ...config.arena, obstacles: { ...config.arena.obstacles, countMin: 0, countMax: 0 } },
  };
  const lv = defaultSkillLevels();
  Object.assign(lv.shot, opts.levels);
  const w = createWorld({ seed: 1, config: noObstacles, levels: { 0: lv } });
  w.players[0].pos = opts.me ?? { x: 1000, y: 1000 };
  w.players[1].pos = opts.rival ?? { x: 1000, y: 200 }; // out of the way by default
  (w.obstacles as { x: number; y: number; w: number; h: number; id: number }[]).push(
    ...(opts.obstacles ?? []).map((o, id) => ({ ...o, id })),
  );
  stepWorld(w, { 0: { move: { x: 0, y: 0 }, aim: opts.aim ?? { x: 2000, y: 1000 } } });
  return w;
}

const idle: PlayerInput = { move: { x: 0, y: 0 } };
const fire: PlayerInput = { move: { x: 0, y: 0 }, skills: { shot: true } };

/** Press fire and run until the bullet has spawned. Returns ms elapsed since the press tick began. */
function fireAndSpawn(w: World): number {
  stepWorld(w, { 0: fire });
  let t = TICK;
  while (w.projectiles.length === 0 && w.players[0].shot) {
    stepWorld(w, { 0: idle });
    t += TICK;
  }
  return t;
}

/** Run until no bullet is in flight (or `maxMs`). Returns the last bulletStop event. */
function flyUntilStopped(w: World, maxMs = 3000) {
  for (let t = 0; t < maxMs && w.projectiles.length > 0; t += TICK) stepWorld(w, { 0: idle });
  return w.events.find((e) => e.type === "bulletStop");
}

describe("Shot", () => {
  it("spawns the bullet at the shooter's centre after the 50 ms wind-up, then starts its cooldown", () => {
    const w = setup({});
    const me = w.players[0];
    const t = fireAndSpawn(w);
    expect(t).toBe(shot.windupMs);
    expect(w.projectiles).toHaveLength(1);
    expect(w.projectiles[0].pos).toEqual({ x: 1000, y: 1000 });
    expect(w.projectiles[0].radius).toBeCloseTo(BULLET_R);
    expect(me.shot).toBeNull();
    expect(me.cooldowns.shot).toBe(shot.cooldownMs[0] - (t - TICK));
  });

  it("flies at one arena side per second (21 units per 10 ms tick)", () => {
    const w = setup({});
    fireAndSpawn(w);
    stepWorld(w, { 0: idle });
    expect(w.projectiles[0].pos.x).toBeCloseTo(1000 + SPEED * TICK);
    for (let i = 0; i < 9; i++) stepWorld(w, { 0: idle });
    expect(w.projectiles[0].pos.x).toBeCloseTo(1000 + SPEED * TICK * 10);
    expect(w.projectiles[0].pos.y).toBeCloseTo(1000);
    expect(SPEED * shot.travelArenaSideMs).toBe(SIZE);
  });

  it("travels towards the pointer, including diagonals", () => {
    const w = setup({ aim: { x: 1100, y: 1100 } });
    fireAndSpawn(w);
    stepWorld(w, { 0: idle });
    const b = w.projectiles[0];
    expect(b.pos.x - 1000).toBeCloseTo(b.pos.y - 1000);
    expect(Math.hypot(b.pos.x - 1000, b.pos.y - 1000)).toBeCloseTo(SPEED * TICK);
  });

  it("locks its direction at the press", () => {
    const w = setup({});
    stepWorld(w, { 0: fire });
    for (let i = 0; i < 8; i++) stepWorld(w, { 0: { ...idle, aim: { x: 1000, y: 0 } } });
    const b = w.projectiles[0];
    expect(b.pos.y).toBeCloseTo(1000);
    expect(b.pos.x).toBeGreaterThan(1000);
  });

  it("stops flush against the arena edge", () => {
    const w = setup({ me: { x: 2000, y: 1000 } });
    fireAndSpawn(w);
    const stop = flyUntilStopped(w);
    expect(w.projectiles).toHaveLength(0);
    expect(stop).toMatchObject({ type: "bulletStop", reason: "edge" });
    expect(stop!.pos.x).toBeCloseTo(SIZE - BULLET_R);
  });

  it("stops flush against an obstacle", () => {
    const wall = { x: 1300, y: 800, w: 100, h: 400 };
    const w = setup({ obstacles: [wall] });
    fireAndSpawn(w);
    const stop = flyUntilStopped(w);
    expect(stop).toMatchObject({ type: "bulletStop", reason: "obstacle" });
    expect(stop!.pos.x).toBeCloseTo(wall.x - BULLET_R);
    expect(w.projectiles).toHaveLength(0);
  });

  it("hits a player for the level's integer damage and disappears", () => {
    const w = setup({ rival: { x: 1400, y: 1000 } });
    const rival = w.players[1];
    fireAndSpawn(w);
    const stop = flyUntilStopped(w);
    expect(rival.hp).toBe(maxHp - shot.damage[0]);
    expect(stop).toMatchObject({ type: "bulletStop", reason: "player" });
    expect(stop!.pos.x).toBeCloseTo(1400 - R - BULLET_R);
    expect(w.events).toContainEqual(expect.objectContaining({ type: "hit", skill: "shot", damage: 2, targetId: 1 }));
    expect(w.projectiles).toHaveLength(0);
  });

  it("never hits its own shooter", () => {
    const w = setup({});
    fireAndSpawn(w);
    flyUntilStopped(w);
    expect(w.players[0].hp).toBe(maxHp);
  });

  it("stops at the first thing along its path", () => {
    // Obstacle before the player: player untouched.
    const shielded = setup({ rival: { x: 1600, y: 1000 }, obstacles: [{ x: 1300, y: 900, w: 50, h: 200 }] });
    fireAndSpawn(shielded);
    expect(flyUntilStopped(shielded)).toMatchObject({ reason: "obstacle" });
    expect(shielded.players[1].hp).toBe(maxHp);

    // Player before the obstacle: the obstacle is never reached.
    const exposed = setup({ rival: { x: 1200, y: 1000 }, obstacles: [{ x: 1300, y: 900, w: 50, h: 200 }] });
    fireAndSpawn(exposed);
    expect(flyUntilStopped(exposed)).toMatchObject({ reason: "player" });
    expect(exposed.players[1].hp).toBe(maxHp - 2);
  });

  it("cannot tunnel: a wall thinner than one tick of travel still stops it", () => {
    const w = setup({ obstacles: [{ x: 1305, y: 900, w: 4, h: 200 }] });
    fireAndSpawn(w);
    expect(flyUntilStopped(w)).toMatchObject({ reason: "obstacle" });
  });

  it("grazes: a bullet passing within its radius of a player counts as a hit", () => {
    const w = setup({ rival: { x: 1400, y: 1000 + R + BULLET_R - 1 } });
    fireAndSpawn(w);
    flyUntilStopped(w);
    expect(w.players[1].hp).toBe(maxHp - 2);

    const miss = setup({ rival: { x: 1400, y: 1000 + R + BULLET_R + 1 } });
    fireAndSpawn(miss);
    expect(flyUntilStopped(miss)).toMatchObject({ reason: "edge" });
    expect(miss.players[1].hp).toBe(maxHp);
  });

  it("is blocked by a shield facing the bullet and not by one facing away", () => {
    const front = setup({ rival: { x: 1400, y: 1000 } });
    stepWorld(front, { 1: { move: { x: 0, y: 0 }, aim: { x: 0, y: 1000 }, skills: { shield: true } } });
    fireAndSpawn(front);
    flyUntilStopped(front);
    expect(front.players[1].hp).toBe(maxHp);
    expect(front.events).toContainEqual(expect.objectContaining({ type: "hit", skill: "shot", blocked: true, damage: 0 }));

    const back = setup({ rival: { x: 1400, y: 1000 } });
    stepWorld(back, { 1: { move: { x: 0, y: 0 }, aim: { x: 2100, y: 1000 }, skills: { shield: true } } });
    fireAndSpawn(back);
    flyUntilStopped(back);
    expect(back.players[1].hp).toBe(maxHp - 2);
  });

  it("fades after its configured range without hitting anything further", () => {
    const w = setup({ rival: { x: 1400, y: 1000 }, config: withShot({ range: [100, 100, 100, 100] }) });
    fireAndSpawn(w);
    const stop = flyUntilStopped(w);
    expect(stop).toMatchObject({ reason: "range" });
    expect(stop!.pos.x).toBeCloseTo(1100);
    expect(w.players[1].hp).toBe(maxHp);
  });

  it("cannot be fired while on cooldown", () => {
    const w = setup({ config: withShot({ cooldownMs: [200, 200, 200, 200] }) });
    stepWorld(w, { 0: fire });
    for (let i = 0; i < 15; i++) stepWorld(w, { 0: fire }); // spam
    expect(w.projectiles).toHaveLength(1);
    for (let i = 0; i < 5; i++) stepWorld(w, { 0: idle });
    expect(w.players[0].cooldowns.shot).toBe(0);
    stepWorld(w, { 0: fire });
    expect(w.players[0].shot).not.toBeNull();
    for (let i = 0; i < 5; i++) stepWorld(w, { 0: idle });
    expect(w.projectiles).toHaveLength(2);
  });

  it("uses the damage of its level", () => {
    const w = setup({ rival: { x: 1400, y: 1000 }, levels: { damage: 2 } });
    fireAndSpawn(w);
    flyUntilStopped(w);
    expect(w.players[1].hp).toBe(maxHp - shot.damage[2]);
  });

  it("honours a wind-up that is not a tick multiple (bullet flies the remainder of that tick)", () => {
    const w = setup({ config: withShot({ windupMs: 45 }) });
    const t = fireAndSpawn(w);
    expect(t).toBe(50);
    expect(w.projectiles[0].pos.x).toBeCloseTo(1000 + SPEED * 5);
  });

  it("leaves from where the shooter is when the wind-up ends, and can be fired while moving", () => {
    const w = setup({});
    stepWorld(w, { 0: { move: { x: 0, y: -1 }, skills: { shot: true } } });
    for (let i = 0; i < 4; i++) stepWorld(w, { 0: { move: { x: 0, y: -1 } } });
    expect(w.projectiles[0].pos.y).toBeCloseTo(1000 - 5 * 3);
    expect(w.projectiles[0].pos.x).toBeCloseTo(1000);
  });

  it("cannot be fired by the dead, but a bullet already flying keeps going", () => {
    const w = setup({ rival: { x: 1400, y: 1000 } });
    fireAndSpawn(w);
    w.players[0].hp = 0;
    flyUntilStopped(w);
    expect(w.players[1].hp).toBe(maxHp - 2);

    stepWorld(w, { 0: fire });
    expect(w.players[0].shot).toBeNull();
  });
});
