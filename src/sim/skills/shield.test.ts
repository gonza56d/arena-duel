import { describe, expect, it } from "vitest";
import { CONFIG, type GameConfig } from "../../config";
import { dealDamage } from "./combat";
import { isShieldUp } from "./shield";
import { createWorld, stepWorld, type World } from "../world";

const TICK = CONFIG.sim.tickMs;
const { maxHp } = CONFIG.player;
const shieldCfg = CONFIG.skills.shield;

/** Two players 300 units apart on the x axis, the defender (id 0) aiming at the attacker (id 1). */
function duel(config: GameConfig = CONFIG): World {
  const w = createWorld({ seed: 1, config });
  w.players[0].pos = { x: 1000, y: 1000 };
  w.players[1].pos = { x: 1300, y: 1000 };
  stepWorld(w, { 0: { move: { x: 0, y: 0 }, aim: { x: 1300, y: 1000 } } });
  return w;
}

function raise(w: World, aim = { x: 1300, y: 1000 }): void {
  stepWorld(w, { 0: { move: { x: 0, y: 0 }, aim, skills: { shield: true } } });
}

describe("Shield", () => {
  it("is up the same tick it is pressed (no animation time) and starts its cooldown", () => {
    const w = duel();
    const [me] = w.players;
    raise(w);
    expect(isShieldUp(me)).toBe(true);
    expect(w.events).toContainEqual({ type: "skill", skill: "shield", playerId: 0 });
    // The cooldown is set at the trigger and starts counting on the next tick.
    expect(me.cooldowns.shield).toBe(shieldCfg.cooldownMs[0]);
    stepWorld(w);
    expect(me.cooldowns.shield).toBe(shieldCfg.cooldownMs[0] - TICK);
  });

  it("cannot be raised again while on cooldown", () => {
    const w = duel();
    const [me] = w.players;
    raise(w);
    for (let i = 0; i < 100; i++) stepWorld(w);
    expect(me.shield).toBeNull();
    raise(w);
    expect(me.shield).toBeNull();
    expect(me.cooldowns.shield).toBeGreaterThan(0);
    // Once the cooldown is spent, it works again.
    for (let i = 0; i < shieldCfg.cooldownMs[0] / TICK; i++) stepWorld(w);
    expect(me.cooldowns.shield).toBe(0);
    raise(w);
    expect(isShieldUp(me)).toBe(true);
  });

  it("blocks 100% of damage coming from inside its cone", () => {
    const w = duel();
    const [me, rival] = w.players;
    raise(w);
    const out = dealDamage(w, "shot", rival, me, 3, rival.pos);
    expect(out).toEqual({ damage: 0, blocked: true });
    expect(me.hp).toBe(maxHp);
    expect(w.events[w.events.length - 1]).toMatchObject({ type: "hit", skill: "shot", damage: 0, blocked: true, targetId: 0 });
  });

  it("does not block damage from outside the cone", () => {
    const w = duel();
    const [me, rival] = w.players;
    raise(w);
    // From behind.
    expect(dealDamage(w, "slash", rival, me, 2, { x: 700, y: 1000 })).toEqual({ damage: 2, blocked: false });
    expect(me.hp).toBe(maxHp - 2);
    // From the side (90° off aim).
    expect(dealDamage(w, "slash", rival, me, 2, { x: 1000, y: 700 })).toEqual({ damage: 2, blocked: false });
    expect(me.hp).toBe(maxHp - 4);
  });

  it("covers exactly the configured 90° cone (45° either side of the aim)", () => {
    const w = duel();
    const [me, rival] = w.players;
    raise(w);
    const at = (deg: number): { x: number; y: number } => ({
      x: 1000 + 300 * Math.cos((deg * Math.PI) / 180),
      y: 1000 + 300 * Math.sin((deg * Math.PI) / 180),
    });
    expect(dealDamage(w, "shot", rival, me, 1, at(44.9)).blocked).toBe(true);
    expect(dealDamage(w, "shot", rival, me, 1, at(-44.9)).blocked).toBe(true);
    expect(dealDamage(w, "shot", rival, me, 1, at(45.1)).blocked).toBe(false);
    expect(dealDamage(w, "shot", rival, me, 1, at(-45.1)).blocked).toBe(false);
  });

  it("follows the pointer while raised", () => {
    const w = duel();
    const [me, rival] = w.players;
    raise(w);
    // Turn to face up; a hit from the right is no longer covered, one from above is.
    stepWorld(w, { 0: { move: { x: 0, y: 0 }, aim: { x: 1000, y: 500 } } });
    expect(dealDamage(w, "shot", rival, me, 1, { x: 1300, y: 1000 }).blocked).toBe(false);
    expect(dealDamage(w, "shot", rival, me, 1, { x: 1000, y: 600 }).blocked).toBe(true);
  });

  it("stays up for exactly the configured window, then drops", () => {
    const w = duel();
    const [me, rival] = w.players;
    raise(w); // tick 1 of the window
    const ticks = shieldCfg.activeMs / TICK;
    for (let i = 1; i < ticks; i++) {
      expect(isShieldUp(me)).toBe(true);
      stepWorld(w);
    }
    // Window spent: the shield is down and damage lands.
    expect(me.shield).toBeNull();
    expect(dealDamage(w, "shot", rival, me, 2, rival.pos)).toEqual({ damage: 2, blocked: false });
  });

  it("reads window, cone and block fraction from the config", () => {
    const cfg: GameConfig = {
      ...CONFIG,
      skills: { ...CONFIG.skills, shield: { ...shieldCfg, activeMs: 200, coneDeg: 180, blockFraction: 0.5 } },
    };
    const w = duel(cfg);
    const [me, rival] = w.players;
    raise(w);
    // 180° cone: a hit from the side is now inside; half block floors 3 → 1.
    expect(dealDamage(w, "slash", rival, me, 3, { x: 1000, y: 700 })).toEqual({ damage: 1, blocked: true });
    expect(me.hp).toBe(maxHp - 1);
    for (let i = 1; i < 200 / TICK; i++) stepWorld(w);
    expect(me.shield).toBeNull();
  });

  it("cannot be raised by a dead player", () => {
    const w = duel();
    w.players[0].hp = 0;
    raise(w);
    expect(w.players[0].shield).toBeNull();
    expect(w.players[0].cooldowns.shield).toBe(0);
  });
});
