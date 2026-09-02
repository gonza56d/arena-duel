/**
 * Cooldown bookkeeping. A cooldown starts the instant a skill is triggered and
 * counts down every tick; a skill is usable only when its counter is at 0.
 * Cooldowns are the *only* gate between uses, so they also prevent re-triggering
 * a skill that is still winding up or active (every cooldown ≥ its skill's
 * wind-up + active time in the shipped config).
 */
import type { PlayerState } from "../player";
import { SKILL_IDS, type SkillId } from "./stats";

export type Cooldowns = Record<SkillId, number>;

export function zeroCooldowns(): Cooldowns {
  return { dash: 0, slash: 0, shot: 0, shield: 0, bash: 0 };
}

export function isReady(p: PlayerState, skill: SkillId): boolean {
  return p.cooldowns[skill] <= 0;
}

export function startCooldown(p: PlayerState, skill: SkillId, ms: number): void {
  p.cooldowns[skill] = ms;
}

export function tickCooldowns(p: PlayerState, dtMs: number): void {
  for (const id of SKILL_IDS) {
    if (p.cooldowns[id] > 0) p.cooldowns[id] = Math.max(0, p.cooldowns[id] - dtMs);
  }
}
