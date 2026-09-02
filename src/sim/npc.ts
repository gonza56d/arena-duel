/**
 * The zombie NPC: a rival driven entirely by producing the *same*
 * {@link PlayerInput} a human produces (a move vector, an aim point and one-shot
 * skill triggers). Because its output flows through the identical `stepWorld`
 * path, every limit that binds a human binds it too — cooldowns gate its skills
 * (`triggerSkills` ignores a skill that is not ready) and `movePlayer` clamps
 * its speed and collisions. The NPC therefore *cannot* move faster or further,
 * or fire more often, than the rules allow, no matter what it "wants" to do.
 *
 * Its behaviour is deliberately dumb, per the v1 intent — "randomly moves and
 * uses skills" — so combat can be felt rather than solved:
 *  - it wanders in a random direction, repicked at random intervals (with the
 *    occasional pause);
 *  - it aims at the nearest living opponent, so a "straight fight" actually
 *    happens and its aimed skills can land;
 *  - on a random cadence it fires one randomly chosen skill that is ready. It
 *    only ever presses ready skills (never wastes a press on a cooling one), and
 *    the simulation is the hard gate regardless.
 *
 * All randomness comes from the injected {@link Rng}, so a given seed and tick
 * sequence reproduce the same behaviour.
 */
import { distance, fromAngle, TAU, type Vec2 } from "./geometry";
import { isDead, type PlayerState } from "./player";
import { createRng, type Rng } from "./rng";
import type { SkillTriggers } from "./skills";
import { isReady } from "./skills/cooldowns";
import { SKILL_IDS, type SkillId } from "./skills/stats";
import type { PlayerInput, World } from "./world";

export interface Npc {
  readonly playerId: number;
  /** Input for this NPC's next `dtMs` tick. Reads the world; never mutates it. */
  decide(world: World, dtMs: number): PlayerInput;
}

export interface NpcOptions {
  /** A new wander direction is chosen after a random pause in this range (ms). */
  repickMinMs: number;
  repickMaxMs: number;
  /** Chance, on each repick, of standing still instead of moving. */
  idleChance: number;
  /** A skill is attempted after a random gap in this range (ms). */
  skillGapMinMs: number;
  skillGapMaxMs: number;
  /** Chance an attempt actually fires (otherwise it is a beat of hesitation). */
  skillChance: number;
}

export const DEFAULT_NPC_OPTIONS: NpcOptions = {
  repickMinMs: 300,
  repickMaxMs: 900,
  idleChance: 0.2,
  skillGapMinMs: 250,
  skillGapMaxMs: 600,
  skillChance: 0.7,
};

/**
 * A deterministic RNG for the NPC of a given match, mixed from the match seed
 * and player id so the local player's and rival's controllers (should there be
 * more than one) diverge, and so a match seed reproduces the NPC's rolls.
 */
export function npcRng(seed: number, playerId: number): Rng {
  return createRng((seed ^ 0x9e3779b9 ^ Math.imul(playerId + 1, 0x85ebca6b)) >>> 0);
}

export function createNpc(playerId: number, rng: Rng, opts: NpcOptions = DEFAULT_NPC_OPTIONS): Npc {
  let moveDir: Vec2 = { x: 0, y: 0 };
  let repickInMs = 0; // ≤ 0 ⇒ repick on the next decide
  let skillInMs = rng.range(opts.skillGapMinMs, opts.skillGapMaxMs);

  return {
    playerId,
    decide(world: World, dtMs: number): PlayerInput {
      const self = world.players.find((p) => p.id === playerId);
      if (!self || isDead(self)) return { move: { x: 0, y: 0 } };

      // Wander: pick a fresh random direction whenever the pause elapses.
      repickInMs -= dtMs;
      if (repickInMs <= 0) {
        repickInMs = rng.range(opts.repickMinMs, opts.repickMaxMs);
        moveDir = rng.next() < opts.idleChance ? { x: 0, y: 0 } : fromAngle(rng.range(0, TAU));
      }

      // Face the nearest opponent so aimed skills point at a real fight.
      const target = nearestOpponent(world, self);
      const aim = target ? { x: target.pos.x, y: target.pos.y } : undefined;

      // Fire a random ready skill on a random cadence.
      let skills: SkillTriggers | undefined;
      skillInMs -= dtMs;
      if (skillInMs <= 0) {
        skillInMs = rng.range(opts.skillGapMinMs, opts.skillGapMaxMs);
        if (rng.next() < opts.skillChance) {
          const ready = SKILL_IDS.filter((id) => isReady(self, id));
          if (ready.length > 0) skills = triggerFor(ready[rng.int(0, ready.length - 1)], rng);
        }
      }

      return { move: moveDir, aim, skills };
    },
  };
}

/** The living player nearest to `self` other than itself, or null if none. */
function nearestOpponent(world: World, self: PlayerState): PlayerState | null {
  let best: PlayerState | null = null;
  let bestDist = Infinity;
  for (const p of world.players) {
    if (p === self || isDead(p)) continue;
    const d = distance(self.pos, p.pos);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best;
}

/** The one-shot trigger flags for a skill; Slash randomly swings either way. */
function triggerFor(id: SkillId, rng: Rng): SkillTriggers {
  switch (id) {
    case "dash":
      return { dash: true };
    case "shot":
      return { shot: true };
    case "bash":
      return { bash: true };
    case "shield":
      return { shield: true };
    case "slash":
      return rng.next() < 0.5 ? { slashPrimary: true } : { slashSecondary: true };
  }
}
