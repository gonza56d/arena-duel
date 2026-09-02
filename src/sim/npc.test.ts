import { describe, expect, it } from "vitest";
import { CONFIG, moveSpeedUnitsPerMs, type GameConfig } from "../config";
import { distance, length } from "./geometry";
import { createNpc, npcRng } from "./npc";
import { createRng } from "./rng";
import type { SkillTriggers } from "./skills";
import type { SkillId } from "./skills/stats";
import { createWorld, damagePlayer, stepWorld, type World } from "./world";

/** Same rules, but an empty arena so movement can be measured without push-out. */
const OPEN_ARENA: GameConfig = {
  ...CONFIG,
  arena: { ...CONFIG.arena, obstacles: { ...CONFIG.arena.obstacles, countMin: 0, countMax: 0 } },
};

/** Which skill a set of one-shot triggers activates (Slash from either swing). */
function skillOf(triggers: SkillTriggers): SkillId | null {
  if (triggers.dash) return "dash";
  if (triggers.shot) return "shot";
  if (triggers.bash) return "bash";
  if (triggers.shield) return "shield";
  if (triggers.slashPrimary || triggers.slashSecondary) return "slash";
  return null;
}

describe("the zombie NPC only ever emits legal input (acceptance 1)", () => {
  it("moves with a unit vector or not at all — never a super-speed request", () => {
    const world = createWorld({ seed: 3 });
    const npc = createNpc(1, createRng(42));
    for (let i = 0; i < 1000; i++) {
      const move = npc.decide(world, CONFIG.sim.tickMs).move;
      const len = length(move);
      expect(len === 0 || Math.abs(len - 1) < 1e-9).toBe(true);
    }
  });

  it("never presses a skill that is on cooldown", () => {
    const world: World = createWorld({ seed: 8 });
    const npc = createNpc(1, npcRng(8, 1));
    const self = () => world.players[1];

    let skillsFired = 0;
    for (let tick = 0; tick < 3000; tick++) {
      const input = npc.decide(world, CONFIG.sim.tickMs);
      const skill = input.skills && skillOf(input.skills);
      if (skill) {
        // The skill it chose to press must be ready right now.
        expect(self().cooldowns[skill]).toBeLessThanOrEqual(0);
        skillsFired++;
      }
      stepWorld(world, { 1: input }, CONFIG.sim.tickMs); // player 0 stands still
    }
    expect(skillsFired).toBeGreaterThan(0); // it actually fought
  });

  it("never outruns the move speed on an ordinary tick", () => {
    // Empty arena, the opponent dead: nothing to collide with, so any excess
    // displacement would have to come from the NPC itself.
    const world = createWorld({ seed: 8, config: OPEN_ARENA });
    damagePlayer(world, 0, OPEN_ARENA.player.maxHp);
    const npc = createNpc(1, npcRng(8, 1));
    const self = () => world.players[1];
    const maxStep = moveSpeedUnitsPerMs(OPEN_ARENA) * OPEN_ARENA.sim.tickMs + 1e-6;

    for (let tick = 0; tick < 3000; tick++) {
      const before = { ...self().pos };
      const wasDashing = self().dash !== null;
      stepWorld(world, { 1: npc.decide(world, OPEN_ARENA.sim.tickMs) }, OPEN_ARENA.sim.tickMs);
      // Dash is a legal skill, bound by its own rules; measure only plain moves.
      if (!wasDashing && self().dash === null) {
        expect(distance(before, self().pos)).toBeLessThanOrEqual(maxStep);
      }
    }
  });
});

describe("the NPC is deterministic per seed", () => {
  it("two NPCs with the same seed drive identical worlds", () => {
    const build = (): { world: World; npc: ReturnType<typeof createNpc> } => ({
      world: createWorld({ seed: 15 }),
      npc: createNpc(1, npcRng(15, 1)),
    });
    const a = build();
    const b = build();
    for (let tick = 0; tick < 500; tick++) {
      stepWorld(a.world, { 1: a.npc.decide(a.world, CONFIG.sim.tickMs) }, CONFIG.sim.tickMs);
      stepWorld(b.world, { 1: b.npc.decide(b.world, CONFIG.sim.tickMs) }, CONFIG.sim.tickMs);
    }
    expect(a.world.players[1].pos).toEqual(b.world.players[1].pos);
    expect(a.world.players[1].cooldowns).toEqual(b.world.players[1].cooldowns);
  });
});
