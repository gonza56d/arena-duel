import { describe, expect, it } from "vitest";
import { CONFIG, leveledStatIds, moveSpeedUnitsPerMs, statLevels, validateConfig, type GameConfig, type StatId } from "./config";

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
    expect(statLevels("dash.distance", CONFIG)).toEqual([100, 108, 116, 125]);
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

  it("rejects non-positive speed", () => {
    expect(() => validateConfig(withPlayer({ moveSpeedUnitsPer100ms: 0 }))).toThrow(/moveSpeedUnitsPer100ms/);
  });
});
