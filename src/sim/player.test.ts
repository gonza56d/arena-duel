import { describe, expect, it } from "vitest";
import { CONFIG, type GameConfig } from "../config";
import { applyDamage, applyHeal, createPlayer, isDead, tickHeal } from "./player";
import { generateLoadout } from "./loadout";
import { createRng } from "./rng";

/** Any valid build; movement/HP rules do not depend on it. */
const LOADOUT = generateLoadout(createRng(1));

const { maxHp, healIntervalMs } = CONFIG.player;

describe("HP model", () => {
  it("starts at max HP as an integer", () => {
    const p = createPlayer(0, { x: 100, y: 100 }, LOADOUT);
    expect(p.hp).toBe(maxHp);
    expect(Number.isInteger(p.hp)).toBe(true);
    expect(isDead(p)).toBe(false);
  });

  it("applies integer damage", () => {
    const p = createPlayer(0, { x: 100, y: 100 }, LOADOUT);
    expect(applyDamage(p, 3)).toBe(maxHp - 3);
    expect(Number.isInteger(p.hp)).toBe(true);
  });

  it("refuses non-integer or negative damage", () => {
    const p = createPlayer(0, { x: 100, y: 100 }, LOADOUT);
    expect(() => applyDamage(p, 1.5)).toThrow(/integer/);
    expect(() => applyDamage(p, -1)).toThrow(/integer/);
    expect(p.hp).toBe(maxHp);
  });

  it("dies at exactly 0 and below 0", () => {
    const p = createPlayer(0, { x: 100, y: 100 }, LOADOUT);
    applyDamage(p, maxHp);
    expect(p.hp).toBe(0);
    expect(isDead(p)).toBe(true);

    const q = createPlayer(1, { x: 100, y: 100 }, LOADOUT);
    applyDamage(q, maxHp + 4);
    expect(q.hp).toBeLessThan(0);
    expect(isDead(q)).toBe(true);
  });

  it("ignores damage and heal once dead", () => {
    const p = createPlayer(0, { x: 100, y: 100 }, LOADOUT);
    applyDamage(p, maxHp);
    expect(applyDamage(p, 2)).toBe(0);
    expect(applyHeal(p, 5)).toBe(0);
    tickHeal(p, healIntervalMs * 10);
    expect(p.hp).toBe(0);
  });

  it("never heals above max", () => {
    const p = createPlayer(0, { x: 100, y: 100 }, LOADOUT);
    applyDamage(p, 1);
    expect(applyHeal(p, 5)).toBe(maxHp);
  });
});

describe("time-based healing", () => {
  it("heals 1 every interval while below max", () => {
    const p = createPlayer(0, { x: 100, y: 100 }, LOADOUT);
    applyDamage(p, 3);

    tickHeal(p, healIntervalMs - 1);
    expect(p.hp).toBe(maxHp - 3);

    tickHeal(p, 1);
    expect(p.hp).toBe(maxHp - 2);

    tickHeal(p, healIntervalMs);
    expect(p.hp).toBe(maxHp - 1);
  });

  it("accumulates across many small ticks", () => {
    const p = createPlayer(0, { x: 100, y: 100 }, LOADOUT);
    applyDamage(p, 2);
    const tick = CONFIG.sim.tickMs;
    const ticksPerHeal = healIntervalMs / tick;
    for (let i = 0; i < ticksPerHeal - 1; i++) tickHeal(p, tick);
    expect(p.hp).toBe(maxHp - 2);
    tickHeal(p, tick);
    expect(p.hp).toBe(maxHp - 1);
  });

  it("does not bank time while at full HP", () => {
    const p = createPlayer(0, { x: 100, y: 100 }, LOADOUT);
    tickHeal(p, healIntervalMs * 3);
    applyDamage(p, 1);
    tickHeal(p, healIntervalMs - 1);
    expect(p.hp).toBe(maxHp - 1);
    tickHeal(p, 1);
    expect(p.hp).toBe(maxHp);
  });

  it("stops at max and resets the timer", () => {
    const p = createPlayer(0, { x: 100, y: 100 }, LOADOUT);
    applyDamage(p, 1);
    tickHeal(p, healIntervalMs * 5);
    expect(p.hp).toBe(maxHp);
    expect(p.healTimerMs).toBe(0);
  });

  it("keeps HP an integer through a long fight", () => {
    const p = createPlayer(0, { x: 100, y: 100 }, LOADOUT);
    let t = 0;
    for (let i = 0; i < 100_000; i++) {
      tickHeal(p, CONFIG.sim.tickMs);
      t += CONFIG.sim.tickMs;
      if (t % 4000 === 0) applyDamage(p, 2);
      if (isDead(p)) applyHeal(p, 0); // stays dead; heal is a no-op
      expect(Number.isInteger(p.hp)).toBe(true);
    }
  });

  it("optionally restarts the countdown on damage (config flag)", () => {
    const cfg: GameConfig = { ...CONFIG, player: { ...CONFIG.player, healTimerResetsOnDamage: true } };
    const p = createPlayer(0, { x: 100, y: 100 }, LOADOUT, cfg);
    applyDamage(p, 1, cfg);
    tickHeal(p, healIntervalMs - 1, cfg);
    applyDamage(p, 1, cfg);
    tickHeal(p, 1, cfg);
    expect(p.hp).toBe(maxHp - 2);

    // Default config does not reset.
    const q = createPlayer(1, { x: 100, y: 100 }, LOADOUT);
    applyDamage(q, 1);
    tickHeal(q, healIntervalMs - 1);
    applyDamage(q, 1);
    tickHeal(q, 1);
    expect(q.hp).toBe(maxHp - 1);
  });

  it("reads interval and amount from the config", () => {
    const cfg: GameConfig = { ...CONFIG, player: { ...CONFIG.player, healIntervalMs: 1000, healAmount: 2 } };
    const p = createPlayer(0, { x: 100, y: 100 }, LOADOUT, cfg);
    applyDamage(p, 5, cfg);
    tickHeal(p, 1000, cfg);
    expect(p.hp).toBe(maxHp - 3);
  });
});
