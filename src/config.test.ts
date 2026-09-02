import { describe, expect, it } from "vitest";
import { CONFIG, bladeWidth, bulletRadius, bulletSpeedUnitsPerMs, moveSpeedUnitsPerMs, validateConfig, type GameConfig } from "./config";

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

  it("matches the design-doc skill numbers", () => {
    const { dash, slash, shot, shield, bash } = CONFIG.skills;
    expect(dash.cooldownMs).toEqual([10_000, 9_000, 8_000, 7_000]);
    expect(dash.distance).toEqual([100, 108, 116, 125]);
    expect(dash.durationMs).toBe(100);
    expect(slash.cooldownMs).toEqual([4_000, 3_500, 3_000, 2_500]);
    expect(slash.range).toEqual([50, 59, 68, 75]);
    expect(slash.areaDeg).toEqual([45, 60, 75, 90]);
    expect(slash.damage).toEqual([2, 3, 4]);
    expect(slash.windupMs).toBe(75);
    expect(slash.swingMs).toBe(50);
    expect(slash.bladeWidthRatio).toBe(0.1);
    expect(shot.cooldownMs).toEqual([10_000, 9_000, 8_000, 7_000]);
    expect(shot.damage).toEqual([2, 3, 4]);
    expect(shot.windupMs).toBe(50);
    expect(shot.travelArenaSideMs).toBe(1_000);
    expect(shot.bulletWidthRatio).toBe(0.5);
    expect(shield.cooldownMs).toEqual([8_000, 7_000, 6_000, 5_000]);
    expect(shield.blockFraction).toBe(1);
    expect(shield.coneDeg).toBe(90);
    expect(shield.windupMs).toBe(0);
    expect(bash).toEqual({
      cooldownMs: 5_000,
      damage: 1,
      slowDurationMs: 1_000,
      slowSpeedMultiplier: 0.5,
      range: 63,
      coneDeg: 35,
      windupMs: 10,
    });
  });

  it("lets a bullet cross the whole arena by default (range ≥ diagonal)", () => {
    for (const r of CONFIG.skills.shot.range) expect(r).toBeGreaterThanOrEqual(CONFIG.arena.size * Math.SQRT2);
  });

  it("derives bullet speed, bullet radius and blade width from the doc's ratios", () => {
    expect(bulletSpeedUnitsPerMs(CONFIG)).toBeCloseTo(2100 / 1000);
    expect(bulletRadius(CONFIG)).toBeCloseTo(12.5); // 0.5 × 50 diameter, halved
    expect(bladeWidth(CONFIG)).toBeCloseTo(5); // 0.1 × 50 diameter
    const wide: GameConfig = { ...CONFIG, arena: { ...CONFIG.arena, size: 4200 } };
    expect(bulletSpeedUnitsPerMs(wide)).toBeCloseTo(4.2);
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

  it("rejects a non-positive shield window", () => {
    const cfg: GameConfig = {
      ...CONFIG,
      skills: { ...CONFIG.skills, shield: { ...CONFIG.skills.shield, activeMs: 0 } },
    };
    expect(() => validateConfig(cfg)).toThrow(/skills.shield.activeMs must be > 0/);
  });

  it("rejects non-positive speed", () => {
    expect(() => validateConfig(withPlayer({ moveSpeedUnitsPer100ms: 0 }))).toThrow(/moveSpeedUnitsPer100ms/);
  });
});
