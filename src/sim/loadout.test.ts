import { describe, expect, it } from "vitest";
import { CONFIG, leveledStatIds, type GameConfig, type StatId } from "../config";
import {
  assertValidLoadout,
  baseLoadout,
  generateLoadout,
  loadoutSpend,
  remainingPoints,
  statMaxLevel,
  statValue,
  validateLoadout,
  type Loadout,
} from "./loadout";
import { createRng } from "./rng";

const IDS = leveledStatIds(CONFIG);

function withPoints(points: number): GameConfig {
  return { ...CONFIG, build: { ...CONFIG.build, points } };
}

/** A hand-made valid 16-point build: 10 mandatory level-1s + 6 upgrades. */
const VALID: Loadout = {
  "dash.cooldownMs": 1,
  "dash.distance": 2,
  "slash.cooldownMs": 1,
  "slash.range": 3,
  "slash.areaDeg": 1,
  "slash.damage": 3,
  "shot.cooldownMs": 1,
  "shot.range": 1,
  "shot.damage": 1,
  "shield.cooldownMs": 2,
};

describe("generateLoadout", () => {
  it("always spends exactly 16 with every stat within [1, max] (acceptance 1)", () => {
    for (let seed = 0; seed < 500; seed++) {
      const l = generateLoadout(createRng(seed));
      expect(validateLoadout(l).ok).toBe(true);
      expect(loadoutSpend(l)).toBe(16);
      for (const id of IDS) {
        expect(l[id]).toBeGreaterThanOrEqual(1);
        expect(l[id]).toBeLessThanOrEqual(statMaxLevel(id));
        expect(Number.isInteger(l[id])).toBe(true);
      }
    }
  });

  it("never invents a stat outside the leveled set", () => {
    const l = generateLoadout(createRng(9));
    expect(Object.keys(l).sort()).toEqual([...IDS].sort());
  });

  it("is deterministic per seed and varies across seeds", () => {
    expect(generateLoadout(createRng(42))).toEqual(generateLoadout(createRng(42)));
    const distinct = new Set<string>();
    for (let seed = 0; seed < 50; seed++) distinct.add(JSON.stringify(generateLoadout(createRng(seed))));
    expect(distinct.size).toBeGreaterThan(20);
  });

  it("spreads points unevenly — different amounts of levels per stat", () => {
    let uneven = 0;
    for (let seed = 0; seed < 100; seed++) {
      const l = generateLoadout(createRng(seed));
      const levels = IDS.map((id) => l[id]);
      if (new Set(levels).size > 1) uneven++;
      // With 6 free points over 10 stats at least 4 stats stay at level 1.
      expect(levels.filter((v) => v === 1).length).toBeGreaterThanOrEqual(4);
    }
    expect(uneven).toBe(100);
  });

  it("can reach every stat's max level over many rolls", () => {
    const seenMax = new Set<StatId>();
    for (let seed = 0; seed < 300; seed++) {
      const l = generateLoadout(createRng(seed));
      for (const id of IDS) if (l[id] === statMaxLevel(id)) seenMax.add(id);
    }
    expect(seenMax.size).toBe(IDS.length);
  });

  it("follows build.points from config with no other edits", () => {
    expect(loadoutSpend(generateLoadout(createRng(1), withPoints(12)), withPoints(12))).toBe(12);
    // The floor: everything at level 1.
    expect(generateLoadout(createRng(1), withPoints(IDS.length))).toEqual(baseLoadout());
    // The ceiling: everything maxed.
    const maxed = generateLoadout(createRng(1), withPoints(38));
    for (const id of IDS) expect(maxed[id]).toBe(statMaxLevel(id));
  });

  it("follows the level tables: a shorter table caps that stat lower", () => {
    const cfg: GameConfig = {
      ...withPoints(38 - 2),
      skills: { ...CONFIG.skills, dash: { ...CONFIG.skills.dash, distance: [100, 125] } },
    };
    const maxed = generateLoadout(createRng(1), cfg);
    expect(maxed["dash.distance"]).toBe(2);
    expect(maxed["dash.cooldownMs"]).toBe(4);
  });
});

describe("validateLoadout", () => {
  it("accepts a valid build", () => {
    expect(validateLoadout(VALID)).toEqual({ ok: true, errors: [] });
    expect(() => assertValidLoadout(VALID)).not.toThrow();
    expect(remainingPoints(VALID)).toBe(0);
  });

  it("rejects an over-spent build", () => {
    const over: Loadout = { ...VALID, "dash.cooldownMs": 2 };
    const v = validateLoadout(over);
    expect(v.ok).toBe(false);
    expect(v.errors).toEqual(["spends 17 of 16 points (over by 1)"]);
    expect(remainingPoints(over)).toBe(-1);
  });

  it("rejects an under-spent build", () => {
    const under: Loadout = { ...VALID, "slash.damage": 2 };
    const v = validateLoadout(under);
    expect(v.ok).toBe(false);
    expect(v.errors).toEqual(["spends 15 of 16 points (under by 1)"]);
    expect(remainingPoints(under)).toBe(1);
    expect(validateLoadout(baseLoadout()).errors).toEqual(["spends 10 of 16 points (under by 6)"]);
  });

  it("rejects a stat below the level-1 minimum, even if the total is right", () => {
    const v = validateLoadout({ ...VALID, "shot.range": 0, "dash.cooldownMs": 2 });
    expect(v.ok).toBe(false);
    expect(v.errors).toEqual(["shot.range level 0 is below the level-1 minimum"]);
  });

  it("rejects a stat above its max level, even if the total is right", () => {
    // slash.damage has 3 levels; move slash.range's points onto it.
    const v = validateLoadout({ ...VALID, "slash.damage": 4, "slash.range": 2 });
    expect(v.ok).toBe(false);
    expect(v.errors).toEqual(["slash.damage level 4 exceeds its max level 3"]);
  });

  it("rejects fractional levels", () => {
    const v = validateLoadout({ ...VALID, "dash.distance": 1.5, "shield.cooldownMs": 2.5 });
    expect(v.ok).toBe(false);
    expect(v.errors).toContain("dash.distance level must be an integer (got 1.5)");
    expect(v.errors).toContain("shield.cooldownMs level must be an integer (got 2.5)");
  });

  it("rejects missing and unknown stats", () => {
    const { "shot.damage": _dropped, ...partial } = VALID;
    const v = validateLoadout({ ...partial, "bash.damage": 1 } as unknown as Loadout);
    expect(v.ok).toBe(false);
    expect(v.errors).toContain("bash.damage is not a leveled stat");
    expect(v.errors).toContain("shot.damage is missing (level 1 is the minimum)");
    expect(v.errors).toContain("spends 15 of 16 points (under by 1)");
  });

  it("reports every violation at once and assertValidLoadout lists them", () => {
    const bad: Loadout = { ...VALID, "dash.distance": 0, "slash.damage": 9 };
    expect(validateLoadout(bad).errors).toHaveLength(3);
    expect(() => assertValidLoadout(bad)).toThrow(/Invalid loadout:\n - dash.distance level 0/);
  });

  it("validates against the config it is given", () => {
    expect(validateLoadout(baseLoadout(), withPoints(IDS.length)).ok).toBe(true);
    expect(validateLoadout(VALID, withPoints(IDS.length)).ok).toBe(false);
  });
});

describe("statValue", () => {
  it("maps a 1-based level onto the 0-indexed config table", () => {
    expect(statValue(VALID, "slash.damage")).toBe(CONFIG.skills.slash.damage[2]); // level 3 → 4
    expect(statValue(VALID, "slash.range")).toBe(68);
    expect(statValue(VALID, "dash.distance")).toBe(135);
    expect(statValue(VALID, "dash.cooldownMs")).toBe(5_000);
    expect(statValue(VALID, "shield.cooldownMs")).toBe(3_500);
  });

  it("refuses a level outside the table instead of returning undefined", () => {
    expect(() => statValue({ ...VALID, "slash.damage": 4 }, "slash.damage")).toThrow(/outside \[1, 3\]/);
    expect(() => statValue({ ...VALID, "slash.damage": 0 }, "slash.damage")).toThrow(/outside \[1, 3\]/);
  });

  it("reads the table from the config it is given", () => {
    const cfg: GameConfig = { ...CONFIG, skills: { ...CONFIG.skills, slash: { ...CONFIG.skills.slash, damage: [1, 2, 3] } } };
    expect(statValue(VALID, "slash.damage", cfg)).toBe(3);
  });
});
