import { describe, expect, it } from "vitest";
import {
  CONFIG,
  bladeWidth,
  bulletRadius,
  bulletSpeedUnitsPerMs,
  leveledStatIds,
  moveSpeedUnitsPerMs,
  statLevels,
  validateConfig,
  type GameConfig,
  type StatId,
} from "./config";

function withPlayer(patch: Partial<GameConfig["player"]>): GameConfig {
  return { ...CONFIG, player: { ...CONFIG.player, ...patch } };
}

describe("CONFIG", () => {
  it("matches the design-doc feel numbers", () => {
    expect(CONFIG.arena.size).toBe(2100);
    expect(CONFIG.player.radius).toBe(25);
    expect(CONFIG.player.moveSpeedUnitsPer100ms).toBe(37.5);
    expect(CONFIG.player.maxHp).toBe(10);
    expect(CONFIG.player.healAmount).toBe(1);
    expect(CONFIG.player.healIntervalMs).toBe(15_000);
  });

  it("is valid", () => {
    expect(() => validateConfig(CONFIG)).not.toThrow();
  });

  it("derives units/ms from the doc's units/100ms", () => {
    expect(moveSpeedUnitsPerMs(CONFIG)).toBeCloseTo(0.375);
    expect(moveSpeedUnitsPerMs(withPlayer({ moveSpeedUnitsPer100ms: 60 }))).toBeCloseTo(0.6);
  });

  it("matches the design-doc skill numbers", () => {
    const { dash, slash, shot, shield, bash } = CONFIG.skills;
    expect(dash.cooldownMs).toEqual([5_000, 4_500, 4_000, 3_500]);
    expect(dash.distance).toEqual([125, 135, 145, 156.25]);
    expect(dash.durationMs).toBe(100);
    expect(slash.cooldownMs).toEqual([2_000, 1_750, 1_500, 1_250]);
    expect(slash.range).toEqual([50, 59, 68, 75]);
    expect(slash.areaDeg).toEqual([45, 60, 75, 90]);
    expect(slash.damage).toEqual([2, 3, 4]);
    expect(slash.windupMs).toBe(75);
    expect(slash.swingMs).toBe(50);
    expect(slash.bladeWidthRatio).toBe(0.1);
    expect(shot.cooldownMs).toEqual([5_000, 4_500, 4_000, 3_500]);
    expect(shot.damage).toEqual([2, 3, 4]);
    expect(shot.windupMs).toBe(50);
    expect(shot.travelArenaSideMs).toBe(1_000);
    expect(shot.bulletWidthRatio).toBe(0.5);
    expect(shield.cooldownMs).toEqual([4_000, 3_500, 3_000, 2_500]);
    expect(shield.blockFraction).toBe(1);
    expect(shield.coneDeg).toBe(90);
    expect(shield.windupMs).toBe(0);
    expect(bash).toEqual({
      cooldownMs: 2_500,
      damage: 1,
      slowDurationMs: 1_000,
      slowSpeedMultiplier: 0.5,
      range: 63,
      coneDeg: 35,
      windupMs: 10,
    });
  });

  it("applies the milestone-1 mobility bump as a uniform +25% over the design-doc values", () => {
    // Pre-bump design-doc numbers. Scaling every level by the same factor keeps
    // the level-to-level progression of dash distance exactly as documented.
    const BASE_SPEED = 30;
    const BASE_DASH = [100, 108, 116, 125];
    expect(CONFIG.player.moveSpeedUnitsPer100ms).toBeCloseTo(BASE_SPEED * 1.25);
    expect(CONFIG.skills.dash.distance).toHaveLength(BASE_DASH.length);
    CONFIG.skills.dash.distance.forEach((d, i) => expect(d).toBeCloseTo(BASE_DASH[i] * 1.25));
  });

  it("applies the cooldown tuning pass as a uniform −50% over the design-doc values", () => {
    // Pre-cut design-doc cooldowns. Halving every level (and Bash's fixed
    // value) keeps each skill's level-to-level progression exactly as documented.
    const BASE_COOLDOWNS = {
      dash: [10_000, 9_000, 8_000, 7_000],
      slash: [4_000, 3_500, 3_000, 2_500],
      shot: [10_000, 9_000, 8_000, 7_000],
      shield: [8_000, 7_000, 6_000, 5_000],
    } as const;
    const BASE_BASH_COOLDOWN = 5_000;
    for (const [skill, base] of Object.entries(BASE_COOLDOWNS) as [keyof typeof BASE_COOLDOWNS, readonly number[]][]) {
      const actual = CONFIG.skills[skill].cooldownMs;
      expect(actual).toHaveLength(base.length);
      actual.forEach((cd, i) => expect(cd).toBe(base[i] / 2));
    }
    expect(CONFIG.skills.bash.cooldownMs).toBe(BASE_BASH_COOLDOWN / 2);
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

  it("gives each player 16 build points", () => {
    expect(CONFIG.build.points).toBe(16);
  });

  it("holds only integer HP, heal and damage values", () => {
    expect(Number.isInteger(CONFIG.player.maxHp)).toBe(true);
    expect(Number.isInteger(CONFIG.player.healAmount)).toBe(true);
    for (const d of CONFIG.skills.slash.damage) expect(Number.isInteger(d)).toBe(true);
    for (const d of CONFIG.skills.shot.damage) expect(Number.isInteger(d)).toBe(true);
    expect(Number.isInteger(CONFIG.skills.bash.damage)).toBe(true);
  });
});

describe("leveled stats", () => {
  // Compile-time twin of the runtime list: adding/removing a `Levels` field in
  // a skill config must be reflected here, and vice versa.
  const EXPECTED: Record<StatId, true> = {
    "dash.cooldownMs": true,
    "dash.distance": true,
    "slash.cooldownMs": true,
    "slash.range": true,
    "slash.areaDeg": true,
    "slash.damage": true,
    "shot.cooldownMs": true,
    "shot.range": true,
    "shot.damage": true,
    "shield.cooldownMs": true,
  };

  it("derives exactly the Levels-typed skill fields, in config order", () => {
    expect(leveledStatIds(CONFIG)).toEqual(Object.keys(EXPECTED));
  });

  it("excludes every fixed value (Bash is entirely fixed)", () => {
    expect(leveledStatIds(CONFIG).some((id) => id.startsWith("bash."))).toBe(false);
  });

  it("resolves a stat id to its level table", () => {
    expect(statLevels("slash.damage", CONFIG)).toBe(CONFIG.skills.slash.damage);
    expect(statLevels("dash.distance", CONFIG)).toEqual([125, 135, 145, 156.25]);
    expect(() => statLevels("bash.damage" as StatId, CONFIG)).toThrow(/not a leveled stat/);
  });
});

describe("validateConfig", () => {
  const withPoints = (points: number): GameConfig => ({ ...CONFIG, build: { ...CONFIG.build, points } });

  it("rejects build points below the level-1 floor of every stat", () => {
    const floor = leveledStatIds(CONFIG).length;
    expect(() => validateConfig(withPoints(floor))).not.toThrow();
    expect(() => validateConfig(withPoints(floor - 1))).toThrow(/build.points must be within \[10, 38\]/);
  });

  it("rejects build points above what maxing every stat costs", () => {
    expect(() => validateConfig(withPoints(38))).not.toThrow();
    expect(() => validateConfig(withPoints(39))).toThrow(/build.points must be within/);
  });

  it("rejects fractional build points", () => {
    expect(() => validateConfig(withPoints(16.5))).toThrow(/build.points must be an integer/);
  });

  it("rejects a non-integer best-of option", () => {
    const cfg: GameConfig = { ...CONFIG, rounds: { bestOfOptions: [3, 4.5] } };
    expect(() => validateConfig(cfg)).toThrow(/rounds.bestOfOptions\[1\] must be an integer/);
  });

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
