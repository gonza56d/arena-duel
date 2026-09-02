import { describe, expect, it } from "vitest";
import { CONFIG, type GameConfig } from "../../config";
import { speedMultiplier } from "../player";
import { createWorld, stepWorld, type World } from "../world";
import { testLoadout } from "./loadout.testutil";

const TICK = CONFIG.sim.tickMs;
const R = CONFIG.player.radius;
const { maxHp } = CONFIG.player;
const bash = CONFIG.skills.bash;

function withBash(patch: Partial<GameConfig["skills"]["bash"]>): GameConfig {
  return { ...CONFIG, skills: { ...CONFIG.skills, bash: { ...bash, ...patch } } };
}

/** Attacker (id 0) at (1000,1000) aiming +x; rival (id 1) placed at `rival`. */
function setup(rival: { x: number; y: number }, config: GameConfig = CONFIG): World {
  const loadout = testLoadout({}, undefined, config);
  const w = createWorld({ seed: 1, config, loadouts: [loadout, loadout] });
  w.players[0].pos = { x: 1000, y: 1000 };
  w.players[1].pos = rival;
  stepWorld(w, { 0: { move: { x: 0, y: 0 }, aim: { x: 2000, y: 1000 } } });
  return w;
}

const idle = { move: { x: 0, y: 0 } };
const press = { move: { x: 0, y: 0 }, skills: { bash: true } };

/** Rival centre at distance `d` from the attacker, `deg` off the aim. */
function polar(d: number, deg: number): { x: number; y: number } {
  const a = (deg * Math.PI) / 180;
  return { x: 1000 + d * Math.cos(a), y: 1000 + d * Math.sin(a) };
}

describe("Bash", () => {
  it("hits instantly once the 10 ms animation completes: 1 damage and a 50% slow", () => {
    const w = setup({ x: 1080, y: 1000 });
    const [me, rival] = w.players;
    stepWorld(w, { 0: press }); // the 10 ms wind-up spans exactly this tick
    expect(rival.hp).toBe(maxHp - bash.damage);
    expect(speedMultiplier(rival)).toBe(bash.slowSpeedMultiplier);
    expect(rival.slow?.remainingMs).toBe(bash.slowDurationMs);
    expect(me.bash).toBeNull();
    expect(me.cooldowns.bash).toBe(bash.cooldownMs);
    expect(w.events).toContainEqual(expect.objectContaining({ type: "hit", skill: "bash", damage: 1, blocked: false }));
  });

  it("does nothing until the wind-up is over (longer wind-up from config)", () => {
    const w = setup({ x: 1080, y: 1000 }, withBash({ windupMs: 30 }));
    const rival = w.players[1];
    stepWorld(w, { 0: press });
    stepWorld(w, { 0: idle });
    expect(rival.hp).toBe(maxHp);
    stepWorld(w, { 0: idle });
    expect(rival.hp).toBe(maxHp - 1);
  });

  it("locks its direction at the key press", () => {
    const w = setup({ x: 1080, y: 1000 }, withBash({ windupMs: 30 }));
    const rival = w.players[1];
    stepWorld(w, { 0: press });
    // Turn away during the wind-up: the strike still lands where it was aimed.
    stepWorld(w, { 0: { ...idle, aim: { x: 1000, y: 0 } } });
    stepWorld(w, { 0: { ...idle, aim: { x: 1000, y: 0 } } });
    expect(rival.hp).toBe(maxHp - 1);
  });

  it("reaches exactly range 63 (measured from the centre) and no further", () => {
    const touching = setup(polar(bash.range + R, 0));
    stepWorld(touching, { 0: press });
    expect(touching.players[1].hp).toBe(maxHp - 1);

    const justOut = setup(polar(bash.range + R + 0.5, 0));
    stepWorld(justOut, { 0: press });
    expect(justOut.players[1].hp).toBe(maxHp);
  });

  it("covers a 35° cone: a body grazing the edge is hit, one just past it is not", () => {
    // At distance 60 the rival's circle touches the 17.5° edge when its centre is
    // 17.5° + asin(25 / 60) ≈ 42.1° off the aim.
    const inside = setup(polar(60, 41));
    stepWorld(inside, { 0: press });
    expect(inside.players[1].hp).toBe(maxHp - 1);

    const outside = setup(polar(60, 43.5));
    stepWorld(outside, { 0: press });
    expect(outside.players[1].hp).toBe(maxHp);

    const behind = setup(polar(60, 180));
    stepWorld(behind, { 0: press });
    expect(behind.players[1].hp).toBe(maxHp);
  });

  it("slows the target to half speed for exactly 1 s", () => {
    const w = setup({ x: 1080, y: 1000 });
    const rival = w.players[1];
    stepWorld(w, { 0: press });
    const start = rival.pos.y;
    for (let i = 0; i < 100 / TICK; i++) stepWorld(w, { 1: { move: { x: 0, y: 1 } } });
    expect(rival.pos.y - start).toBeCloseTo(15); // 30 units per 100 ms, halved
    // Remaining 900 ms of slow, then full speed again.
    for (let i = 0; i < 900 / TICK; i++) stepWorld(w, { 1: { move: { x: 0, y: 1 } } });
    const y = rival.pos.y;
    for (let i = 0; i < 100 / TICK; i++) stepWorld(w, { 1: { move: { x: 0, y: 1 } } });
    expect(rival.slow).toBeNull();
    expect(rival.pos.y - y).toBeCloseTo(30);
  });

  it("cannot be used while on cooldown, then works again", () => {
    const w = setup({ x: 1080, y: 1000 }, withBash({ cooldownMs: 100 }));
    const [me, rival] = w.players;
    stepWorld(w, { 0: press });
    stepWorld(w, { 0: press }); // ignored: 90 ms left
    expect(rival.hp).toBe(maxHp - 1);
    expect(me.bash).toBeNull();
    for (let i = 0; i < 8; i++) stepWorld(w, { 0: press }); // still ignored
    expect(rival.hp).toBe(maxHp - 1);
    expect(me.cooldowns.bash).toBe(TICK);
    stepWorld(w, { 0: press }); // the cooldown reaches 0 this tick, so the press counts
    expect(rival.hp).toBe(maxHp - 2);
    expect(rival.slow?.remainingMs).toBe(bash.slowDurationMs); // refreshed, not stacked
  });

  it("is fully negated by a shield facing the attacker: no damage, no slow", () => {
    const w = setup({ x: 1080, y: 1000 });
    const rival = w.players[1];
    stepWorld(w, { 1: { move: { x: 0, y: 0 }, aim: { x: 0, y: 1000 }, skills: { shield: true } } });
    stepWorld(w, { 0: press });
    expect(rival.hp).toBe(maxHp);
    expect(rival.slow).toBeNull();
    expect(w.events).toContainEqual(expect.objectContaining({ type: "hit", skill: "bash", damage: 0, blocked: true }));
  });

  it("goes through a shield facing away", () => {
    const w = setup({ x: 1080, y: 1000 });
    const rival = w.players[1];
    stepWorld(w, { 1: { move: { x: 0, y: 0 }, aim: { x: 2100, y: 1000 }, skills: { shield: true } } });
    stepWorld(w, { 0: press });
    expect(rival.hp).toBe(maxHp - 1);
    expect(rival.slow).not.toBeNull();
  });

  it("reads damage, range and slow from the config", () => {
    const cfg = withBash({ damage: 3, range: 200, slowSpeedMultiplier: 0.25, slowDurationMs: 200 });
    const w = setup({ x: 1200, y: 1000 }, cfg);
    const rival = w.players[1];
    stepWorld(w, { 0: press });
    expect(rival.hp).toBe(maxHp - 3);
    expect(rival.slow).toEqual({ remainingMs: 200, speedMultiplier: 0.25 });
  });

  it("ignores dead targets and cannot be used by the dead", () => {
    const w = setup({ x: 1080, y: 1000 });
    const [me, rival] = w.players;
    rival.hp = 0;
    stepWorld(w, { 0: press });
    expect(rival.hp).toBe(0);
    expect(w.events.filter((e) => e.type === "hit")).toHaveLength(0);

    me.hp = 0;
    me.cooldowns.bash = 0;
    stepWorld(w, { 0: press });
    expect(me.bash).toBeNull();
    expect(me.cooldowns.bash).toBe(0);
  });
});
