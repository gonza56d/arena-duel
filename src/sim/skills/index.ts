/**
 * Skill orchestration for one simulation tick.
 *
 * Every skill follows the same shape: `trigger*` starts it (only when its
 * cooldown is 0; the cooldown starts immediately), `tick*` advances its
 * wind-up / active timeline and applies effects. Skills are independent of
 * each other and of movement: any skill can be used while moving or dashing.
 */
import type { Vec2 } from "../geometry";
import type { Environment } from "../movement";
import { isDead, type PlayerState } from "../player";
import type { World } from "../world";
import { tickBash, triggerBash } from "./bash";
import { triggerDash } from "./dash";
import { tickShield, triggerShield } from "./shield";
import { stepProjectiles as stepBullets, tickShot, triggerShot } from "./shot";
import { tickSlash, triggerSlash } from "./slash";
import type { SkillId } from "./stats";

/** One-shot "pressed this tick" flags. */
export interface SkillTriggers {
  dash?: boolean;
  /** Primary click: the blade travels right → left. */
  slashPrimary?: boolean;
  /** Secondary click: left → right. */
  slashSecondary?: boolean;
  shot?: boolean;
  bash?: boolean;
  shield?: boolean;
}

export const NO_TRIGGERS: Readonly<SkillTriggers> = Object.freeze({});

/**
 * Try to start every triggered skill. Ignored while on cooldown or dead.
 * `move` is the current movement input (Dash follows it).
 */
export function triggerSkills(world: World, p: PlayerState, triggers: SkillTriggers, move: Vec2, env: Environment): void {
  if (isDead(p)) return;
  if (triggers.dash) triggerDash(world, p, move, env);
  if (triggers.shield) triggerShield(world, p);
  if (triggers.bash) triggerBash(world, p);
  if (triggers.shot) triggerShot(world, p);
  // Both buttons in one tick: the primary swing wins.
  if (triggers.slashPrimary) triggerSlash(world, p, true);
  else if (triggers.slashSecondary) triggerSlash(world, p, false);
}

/** Advance this player's offensive skills by `dtMs` (may damage others). */
export function tickPlayerSkills(world: World, p: PlayerState, dtMs: number): void {
  tickBash(world, p, dtMs);
  tickSlash(world, p, dtMs);
  tickShot(world, p, dtMs);
}

/** Advance every bullet in flight. */
export function stepProjectiles(world: World, dtMs: number): void {
  stepBullets(world, dtMs);
}

/**
 * Advance every shield. Runs after all offense in the tick so a shield raised
 * this tick protects for the whole tick and one that expires does so only
 * after the tick's hits were resolved.
 */
export function tickShields(world: World, dtMs: number): void {
  for (const p of world.players) tickShield(p, dtMs);
}

export type { SkillId };
