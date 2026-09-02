import { describe, expect, it } from "vitest";
import { CONFIG, moveSpeedUnitsPerMs, validateConfig, type GameConfig } from "./config";

function withPlayer(patch: Partial<GameConfig["player"]>): GameConfig {
  return { ...CONFIG, player: { ...CONFIG.player, ...patch } };
}

describe("CONFIG", () => {
  it("matches the design-doc feel numbers", () => {
    expect(CONFIG.arena.size).toBe(2100);
    expect(CONFIG.player.radius).toBe(25);
    expect(CONFIG.player.moveSpeedUnitsPer100ms).toBe(30);
    expect(CONFIG.player.maxHp).toBe(10);
    expect(CONFIG.player.healAmount).toBe(1);
    expect(CONFIG.player.healIntervalMs).toBe(15_000);
  });

  it("is valid", () => {
    expect(() => validateConfig(CONFIG)).not.toThrow();
  });

  it("derives units/ms from the doc's units/100ms", () => {
    expect(moveSpeedUnitsPerMs(CONFIG)).toBeCloseTo(0.3);
    expect(moveSpeedUnitsPerMs(withPlayer({ moveSpeedUnitsPer100ms: 60 }))).toBeCloseTo(0.6);
  });

  it("holds only integer HP, heal and damage values", () => {
    expect(Number.isInteger(CONFIG.player.maxHp)).toBe(true);
    expect(Number.isInteger(CONFIG.player.healAmount)).toBe(true);
    for (const d of CONFIG.skills.slash.damage) expect(Number.isInteger(d)).toBe(true);
    for (const d of CONFIG.skills.shot.damage) expect(Number.isInteger(d)).toBe(true);
    expect(Number.isInteger(CONFIG.skills.bash.damage)).toBe(true);
  });
});

describe("validateConfig", () => {
  it("rejects fractional HP", () => {
    expect(() => validateConfig(withPlayer({ maxHp: 10.5 }))).toThrow(/player.maxHp must be an integer/);
  });

  it("rejects fractional heal amount", () => {
    expect(() => validateConfig(withPlayer({ healAmount: 0.5 }))).toThrow(/player.healAmount must be an integer/);
  });

  it("rejects fractional skill damage", () => {
    const cfg: GameConfig = {
      ...CONFIG,
      skills: { ...CONFIG.skills, slash: { ...CONFIG.skills.slash, damage: [2, 2.5, 4] } },
    };
    expect(() => validateConfig(cfg)).toThrow(/skills.slash.damage\[1\] must be an integer/);
  });

  it("rejects obstacle gaps narrower than a player", () => {
    const cfg: GameConfig = {
      ...CONFIG,
      arena: { ...CONFIG.arena, obstacles: { ...CONFIG.arena.obstacles, minGap: 40 } },
    };
    expect(() => validateConfig(cfg)).toThrow(/minGap must be ≥ player diameter/);
  });

  it("rejects non-positive speed", () => {
    expect(() => validateConfig(withPlayer({ moveSpeedUnitsPer100ms: 0 }))).toThrow(/moveSpeedUnitsPer100ms/);
  });
});
