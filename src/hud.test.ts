import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import { cooldownFraction, filledBlocks, HP_BLOCKS, HUD_SKILLS, skillCooldownMs, statusText } from "./hud";
import { createPlayer } from "./sim/player";
import { testLoadout } from "./sim/skills/loadout.testutil";

describe("filledBlocks", () => {
  it("lights all 10 blocks at full HP and none when dead", () => {
    expect(HP_BLOCKS).toBe(10);
    expect(filledBlocks(CONFIG.player.maxHp)).toBe(10);
    expect(filledBlocks(0)).toBe(0);
    expect(filledBlocks(-3)).toBe(0); // overkill is not clamped in the sim
  });

  it("maps each HP point to one block with the shipped maxHp of 10", () => {
    expect(CONFIG.player.maxHp).toBe(10);
    for (let hp = 0; hp <= 10; hp++) expect(filledBlocks(hp)).toBe(hp);
  });

  it("treats a partial tenth as present so a living player never shows an empty bar", () => {
    expect(filledBlocks(1, 20)).toBe(1);
    expect(filledBlocks(19, 20)).toBe(10);
    expect(filledBlocks(10, 20)).toBe(5);
    expect(filledBlocks(7, 30)).toBe(3); // 2.33 tenths → 3 blocks
  });

  it("never exceeds the block count and tolerates a bad max", () => {
    expect(filledBlocks(15, 10)).toBe(10);
    expect(filledBlocks(5, 0)).toBe(0);
  });
});

describe("cooldownFraction", () => {
  it("is 1 at the trigger tick, shrinks as the cooldown elapses and is 0 when ready", () => {
    expect(cooldownFraction(4000, 4000)).toBe(1);
    expect(cooldownFraction(1000, 4000)).toBe(0.25);
    expect(cooldownFraction(0, 4000)).toBe(0);
  });

  it("clamps out-of-range inputs", () => {
    expect(cooldownFraction(5000, 4000)).toBe(1);
    expect(cooldownFraction(-1, 4000)).toBe(0);
    expect(cooldownFraction(100, 0)).toBe(0); // total unknown → treat as ready
  });
});

describe("skillCooldownMs", () => {
  it("reads every skill's cooldown for the build, so the HUD sweep matches the sim gate", () => {
    const loadout = testLoadout({ "dash.cooldownMs": 2, "slash.cooldownMs": 4, "shot.cooldownMs": 1, "shield.cooldownMs": 3 });
    expect(skillCooldownMs(loadout, "dash")).toBe(CONFIG.skills.dash.cooldownMs[1]);
    expect(skillCooldownMs(loadout, "slash")).toBe(CONFIG.skills.slash.cooldownMs[3]);
    expect(skillCooldownMs(loadout, "shot")).toBe(CONFIG.skills.shot.cooldownMs[0]);
    expect(skillCooldownMs(loadout, "shield")).toBe(CONFIG.skills.shield.cooldownMs[2]);
    expect(skillCooldownMs(loadout, "bash")).toBe(CONFIG.skills.bash.cooldownMs);
  });

  it("covers every skill in HUD order", () => {
    expect([...HUD_SKILLS].sort()).toEqual(["bash", "dash", "shield", "shot", "slash"]);
  });
});

describe("statusText", () => {
  it("keeps the heal countdown, slow and death readouts of the old status line", () => {
    const p = createPlayer(0, { x: 100, y: 100 }, testLoadout({}));
    expect(statusText(p)).toBe("");
    p.hp = 6;
    p.healTimerMs = 2_500;
    expect(statusText(p)).toBe(`heal in ${((CONFIG.player.healIntervalMs - 2_500) / 1000).toFixed(1)}s`);
    p.slow = { remainingMs: 800, speedMultiplier: 0.5 };
    expect(statusText(p)).toContain("SLOWED 0.8s");
    p.hp = 0;
    expect(statusText(p)).toBe("DEAD");
  });
});
