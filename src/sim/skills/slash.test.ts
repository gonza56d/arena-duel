import { describe, expect, it } from "vitest";
import { CONFIG, type GameConfig } from "../../config";
import { type StatId } from "../../config";
import { createWorld, stepWorld, type PlayerInput, type World } from "../world";
import { testLoadout } from "./loadout.testutil";

const TICK = CONFIG.sim.tickMs;
const R = CONFIG.player.radius;
const { maxHp } = CONFIG.player;
const slash = CONFIG.skills.slash;
const HALF_BLADE = (R * 2 * slash.bladeWidthRatio) / 2; // 2.5

function withSlash(patch: Partial<GameConfig["skills"]["slash"]>): GameConfig {
  return { ...CONFIG, skills: { ...CONFIG.skills, slash: { ...slash, ...patch } } };
}

interface Setup {
  rival: { x: number; y: number };
  config?: GameConfig;
  /** 1-based slash stat levels for the attacker; unspecified slash stats stay at level 1. */
  levels?: Partial<Record<"range" | "area" | "damage", number>>;
}

/** Free points go to stats no slash test observes. */
const FILLER: StatId[] = ["shield.cooldownMs", "dash.distance", "shot.range", "shot.damage", "dash.cooldownMs", "shot.cooldownMs"];

/** Attacker (id 0) at (1000,1000) aiming +x; rival (id 1) at `rival`. */
function setup({ rival, config = CONFIG, levels = {} }: Setup): World {
  const attacker = testLoadout(
    {
      "slash.cooldownMs": 1,
      "slash.range": levels.range ?? 1,
      "slash.areaDeg": levels.area ?? 1,
      "slash.damage": levels.damage ?? 1,
    },
    FILLER,
    config,
  );
  const defender = testLoadout({}, FILLER, config);
  const w = createWorld({ seed: 1, config, loadouts: [attacker, defender] });
  w.players[0].pos = { x: 1000, y: 1000 };
  w.players[1].pos = rival;
  stepWorld(w, { 0: { move: { x: 0, y: 0 }, aim: { x: 2000, y: 1000 } } });
  return w;
}

const idle: PlayerInput = { move: { x: 0, y: 0 } };
const primary: PlayerInput = { move: { x: 0, y: 0 }, skills: { slashPrimary: true } };
const secondary: PlayerInput = { move: { x: 0, y: 0 }, skills: { slashSecondary: true } };

/** Rival centre at distance `d`, `deg` off the aim (positive = the attacker's right). */
function polar(d: number, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: 1000 + d * Math.cos(a), y: 1000 + d * Math.sin(a) };
}

/** Press once, then run idle ticks until the rival loses HP; returns elapsed ms since the press tick began. */
function timeToHit(w: World, press: PlayerInput = primary, maxMs = 400): number | null {
  const rival = w.players[1];
  stepWorld(w, { 0: press });
  if (rival.hp < maxHp) return TICK;
  for (let t = 2 * TICK; t <= maxMs; t += TICK) {
    stepWorld(w, { 0: idle });
    if (rival.hp < maxHp) return t;
  }
  return null;
}

describe("Slash", () => {
  it("deals no damage during the 75 ms wind-up and lands during the 50 ms swing", () => {
    const w = setup({ rival: polar(60, 0) });
    const t = timeToHit(w)!;
    expect(t).toBeGreaterThan(slash.windupMs);
    expect(t).toBeLessThanOrEqual(slash.windupMs + slash.swingMs);
    expect(w.players[1].hp).toBe(maxHp - slash.damage[0]);
  });

  it("starts its cooldown at the click and clears its state when the swing ends", () => {
    const w = setup({ rival: polar(60, 0) });
    const me = w.players[0];
    stepWorld(w, { 0: primary });
    expect(me.cooldowns.slash).toBe(slash.cooldownMs[0]);
    expect(me.slash).not.toBeNull();
    expect(w.events).toContainEqual({ type: "skill", skill: "slash", playerId: 0 });
    for (let t = 2 * TICK; t < slash.windupMs + slash.swingMs; t += TICK) {
      stepWorld(w, { 0: idle });
      expect(me.slash).not.toBeNull();
    }
    stepWorld(w, { 0: idle }); // 130 ms: swing over
    expect(me.slash).toBeNull();
  });

  it("travels: the blade reaches the side it starts from first (primary right → left, secondary the reverse)", () => {
    // Rival 30° to the attacker's right at distance 70, 90° cone. The primary swing starts
    // on the right and meets it at once; the secondary swing has to travel across first.
    const fromRight = timeToHit(setup({ rival: polar(70, 30), levels: { area: 4 } }), primary)!;
    const fromLeft = timeToHit(setup({ rival: polar(70, 30), levels: { area: 4 } }), secondary)!;
    expect(fromRight).toBeLessThan(fromLeft);
    expect(fromRight).toBe(80); // first tick of the swing
    expect(fromLeft).toBe(110); // blade at 11.6° after ≈31 ms of the 50 ms swing

    // Mirror: rival on the left.
    const mirrorPrimary = timeToHit(setup({ rival: polar(70, -30), levels: { area: 4 } }), primary)!;
    const mirrorSecondary = timeToHit(setup({ rival: polar(70, -30), levels: { area: 4 } }), secondary)!;
    expect(mirrorSecondary).toBe(80);
    expect(mirrorPrimary).toBe(110);
  });

  it("reaches exactly range + rival radius + half the blade width along the aim", () => {
    const reach = slash.range[0] + R + HALF_BLADE; // 77.5
    expect(timeToHit(setup({ rival: polar(reach - 0.01, 0) }))).not.toBeNull();
    expect(timeToHit(setup({ rival: polar(reach + 1, 0) }))).toBeNull();
    // Range level 4 reaches further.
    expect(timeToHit(setup({ rival: polar(reach + 1, 0), levels: { range: 4 } }))).not.toBeNull();
  });

  it("hits only inside the cone; a wider area reaches a rival off to the side", () => {
    // Rival at 60° off aim, distance 50: outside the 45° cone's reach, inside the 90° one.
    expect(timeToHit(setup({ rival: polar(50, 60) }))).toBeNull();
    expect(timeToHit(setup({ rival: polar(50, 60), levels: { area: 4 } }))).not.toBeNull();
    // Directly behind: never.
    expect(timeToHit(setup({ rival: polar(40, 180), levels: { area: 4 } }))).toBeNull();
  });

  it("hits each enemy once per swing", () => {
    const w = setup({ rival: polar(60, 0) });
    stepWorld(w, { 0: primary });
    for (let i = 0; i < 30; i++) stepWorld(w, { 0: idle });
    expect(w.players[1].hp).toBe(maxHp - slash.damage[0]);
    expect(w.events.filter((e) => e.type === "hit")).toHaveLength(0);
  });

  it("deals the integer damage of its level", () => {
    const w = setup({ rival: polar(60, 0), levels: { damage: 3 } });
    timeToHit(w);
    expect(w.players[1].hp).toBe(maxHp - slash.damage[2]);
    expect(Number.isInteger(w.players[1].hp)).toBe(true);
  });

  it("cannot be swung again while on cooldown", () => {
    const w = setup({ rival: polar(60, 0), config: withSlash({ cooldownMs: [300, 300, 300, 300] }) });
    const [me, rival] = w.players;
    stepWorld(w, { 0: primary });
    for (let i = 0; i < 20; i++) stepWorld(w, { 0: secondary }); // spam during cooldown: ignored
    expect(rival.hp).toBe(maxHp - 2);
    expect(me.slash).toBeNull();
    for (let i = 0; i < 10; i++) stepWorld(w, { 0: idle });
    expect(me.cooldowns.slash).toBe(0);
    stepWorld(w, { 0: secondary });
    expect(me.slash).not.toBeNull();
    for (let i = 0; i < 15; i++) stepWorld(w, { 0: idle });
    expect(rival.hp).toBe(maxHp - 4);
  });

  it("locks its aim at the click", () => {
    const w = setup({ rival: polar(60, 0) });
    const rival = w.players[1];
    stepWorld(w, { 0: primary });
    // Turn to face up during the wind-up and swing; the swing still hits the rival on the right.
    for (let i = 0; i < 15; i++) stepWorld(w, { 0: { ...idle, aim: { x: 1000, y: 0 } } });
    expect(rival.hp).toBe(maxHp - 2);
  });

  it("can be used while moving; movement continues through the swing", () => {
    const w = setup({ rival: polar(60, 0) });
    const [me, rival] = w.players;
    const start = me.pos.y;
    stepWorld(w, { 0: { move: { x: 0, y: -1 }, skills: { slashPrimary: true } } });
    for (let i = 0; i < 12; i++) stepWorld(w, { 0: { move: { x: 0, y: -1 } } });
    expect(rival.hp).toBe(maxHp - 2);
    expect(me.pos.y).toBeCloseTo(start - 13 * 3.75);
  });

  it("is blocked by a shield facing the attacker", () => {
    const w = setup({ rival: polar(60, 0) });
    const rival = w.players[1];
    stepWorld(w, { 1: { move: { x: 0, y: 0 }, aim: { x: 0, y: 1000 }, skills: { shield: true } } });
    stepWorld(w, { 0: primary });
    for (let i = 0; i < 12; i++) stepWorld(w, { 0: idle });
    expect(rival.hp).toBe(maxHp);
  });

  it("reads wind-up, swing, blade width and range from the config", () => {
    // A 30 ms wind-up + 20 ms swing lands by 50 ms.
    const fast = withSlash({ windupMs: 30, swingMs: 20 });
    expect(timeToHit(setup({ rival: polar(60, 0), config: fast }))).toBeLessThanOrEqual(50);
    // A blade as wide as the player reaches a further-centred rival: 50 + 25 + 25 = 100.
    const wide = withSlash({ bladeWidthRatio: 1 });
    expect(timeToHit(setup({ rival: polar(99, 0), config: wide }))).not.toBeNull();
    expect(timeToHit(setup({ rival: polar(99, 0) }))).toBeNull();
  });
});
