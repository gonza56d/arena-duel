import { describe, expect, it } from "vitest";
import { CONFIG, type GameConfig } from "../../config";
import { defaultSkillLevels, resolveBash, resolveDash, resolveShield, resolveShot, resolveSlash, validateSkillLevels } from "./stats";

describe("skill stats", () => {
  it("resolve level 1 of every stat to the first config entry", () => {
    const lv = defaultSkillLevels();
    expect(resolveDash(lv)).toEqual({ cooldownMs: 10_000, distance: 100, durationMs: 100 });
    expect(resolveSlash(lv)).toEqual({
      cooldownMs: 4_000,
      range: 50,
      areaDeg: 45,
      damage: 2,
      windupMs: 75,
      swingMs: 50,
      bladeWidth: 5,
    });
    expect(resolveShot(lv)).toMatchObject({ cooldownMs: 10_000, damage: 2, windupMs: 50, speed: 2.1, bulletRadius: 12.5 });
    expect(resolveShield(lv)).toEqual({ cooldownMs: 8_000, blockFraction: 1, coneDeg: 90, windupMs: 0, activeMs: 500 });
    expect(resolveBash()).toBe(CONFIG.skills.bash);
  });

  it("resolve each stat independently by its own level", () => {
    const lv = defaultSkillLevels();
    lv.slash.range = 3;
    lv.slash.damage = 2;
    lv.dash.distance = 1;
    const slash = resolveSlash(lv);
    expect(slash.range).toBe(75);
    expect(slash.damage).toBe(4);
    expect(slash.areaDeg).toBe(45); // untouched stat stays at level 1
    expect(slash.cooldownMs).toBe(4_000);
    expect(resolveDash(lv).distance).toBe(108);
    expect(resolveDash(lv).cooldownMs).toBe(10_000);
  });

  it("read from the injected config", () => {
    const cfg: GameConfig = {
      ...CONFIG,
      skills: { ...CONFIG.skills, dash: { ...CONFIG.skills.dash, distance: [500, 600, 700, 800], durationMs: 250 } },
    };
    expect(resolveDash(defaultSkillLevels(), cfg)).toEqual({ cooldownMs: 10_000, distance: 500, durationMs: 250 });
  });

  it("reject levels outside the config tables", () => {
    const lv = defaultSkillLevels();
    lv.slash.damage = 3; // damage only has 3 levels
    expect(() => validateSkillLevels(lv)).toThrow(/slash.damage level 3 out of range \[0, 2\]/);
    const neg = defaultSkillLevels();
    neg.shield.cooldown = -1;
    expect(() => validateSkillLevels(neg)).toThrow(/shield.cooldown level -1/);
    const frac = defaultSkillLevels();
    frac.dash.distance = 1.5;
    expect(() => validateSkillLevels(frac)).toThrow(/dash.distance level 1.5/);
  });
});
