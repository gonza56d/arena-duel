import { describe, expect, it } from "vitest";
import { CONFIG, type GameConfig } from "../../config";
import { resolveBash, resolveDash, resolveShield, resolveShot, resolveSlash } from "./stats";
import { testLoadout } from "./loadout.testutil";

describe("skill stats", () => {
  it("resolve level 1 of every stat to the first config entry", () => {
    // Pin every stat a resolver reads to level 1; the 6 free points go to shot.range / shot.cooldown.
    const lv = testLoadout(
      { "dash.cooldownMs": 1, "dash.distance": 1, "slash.cooldownMs": 1, "slash.range": 1, "slash.areaDeg": 1, "slash.damage": 1, "shield.cooldownMs": 1 },
      ["shot.range", "shot.cooldownMs"],
    );
    expect(resolveDash(lv)).toEqual({ cooldownMs: 5_000, distance: 125, durationMs: 100 });
    expect(resolveSlash(lv)).toEqual({
      cooldownMs: 2_000,
      range: 50,
      areaDeg: 45,
      damage: 2,
      windupMs: 75,
      swingMs: 50,
      bladeWidth: 5,
    });
    expect(resolveShot(lv)).toMatchObject({ cooldownMs: 3_500, range: 3_000, damage: 2, windupMs: 50, speed: 2.1, bulletRadius: 12.5 });
    expect(resolveShield(lv)).toEqual({ cooldownMs: 4_000, blockFraction: 1, coneDeg: 90, windupMs: 0, activeMs: 500 });
    expect(resolveBash()).toBe(CONFIG.skills.bash);
  });

  it("resolve each stat independently by its own 1-based level", () => {
    const lv = testLoadout({ "slash.range": 4, "slash.damage": 3, "dash.distance": 2 }, ["shield.cooldownMs", "shot.range"]);
    const slash = resolveSlash(lv);
    expect(slash.range).toBe(75);
    expect(slash.damage).toBe(4);
    expect(slash.areaDeg).toBe(45); // untouched stat stays at level 1
    expect(slash.cooldownMs).toBe(2_000);
    expect(resolveDash(lv).distance).toBe(135);
    expect(resolveDash(lv).cooldownMs).toBe(5_000);
  });

  it("read from the injected config", () => {
    const cfg: GameConfig = {
      ...CONFIG,
      skills: { ...CONFIG.skills, dash: { ...CONFIG.skills.dash, distance: [500, 600, 700, 800], durationMs: 250 } },
    };
    const lv = testLoadout({ "dash.cooldownMs": 1, "dash.distance": 1 }, ["shield.cooldownMs", "slash.range"], cfg);
    expect(resolveDash(lv, cfg)).toEqual({ cooldownMs: 5_000, distance: 500, durationMs: 250 });
  });

  it("reject levels outside the config tables (via statValue)", () => {
    const lv = { ...testLoadout(), "slash.damage": 4 }; // damage only has 3 levels
    expect(() => resolveSlash(lv)).toThrow(/slash.damage level 4 is outside \[1, 3\]/);
    const zero = { ...testLoadout(), "shield.cooldownMs": 0 };
    expect(() => resolveShield(zero)).toThrow(/shield.cooldownMs level 0/);
  });
});
