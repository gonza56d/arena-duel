/**
 * Shield — spacebar. Blocks damage arriving from inside a cone that follows
 * the pointer. No animation time: it is up the same tick it is pressed, stays
 * up for `activeMs`, and its cooldown starts at activation.
 *
 * Blocking is decided per hit by `shieldBlocks`: the *source* of the damage
 * (attacker centre for melee, bullet position for shots) must lie within
 * `coneDeg / 2` of the defender's current aim. Any damage source counts —
 * slashes, shots and bashes alike; a blocked bash also applies no slow.
 */
import { degToRad, withinCone, type Vec2 } from "../geometry";
import type { PlayerState } from "../player";
import type { World } from "../world";
import { isReady, startCooldown } from "./cooldowns";
import { resolveShield } from "./stats";

export interface ShieldState {
  elapsedMs: number;
  windupMs: number;
  activeMs: number;
}

/** Raise the shield if it is off cooldown. Returns true when it activated. */
export function triggerShield(world: World, p: PlayerState): boolean {
  if (!isReady(p, "shield")) return false;
  const stats = resolveShield(p.loadout, world.config);
  startCooldown(p, "shield", stats.cooldownMs);
  p.shield = { elapsedMs: 0, windupMs: stats.windupMs, activeMs: stats.activeMs };
  world.events.push({ type: "skill", skill: "shield", playerId: p.id });
  return true;
}

export function tickShield(p: PlayerState, dtMs: number): void {
  if (!p.shield) return;
  p.shield.elapsedMs += dtMs;
  if (p.shield.elapsedMs >= p.shield.windupMs + p.shield.activeMs) p.shield = null;
}

/** True while the shield is raised (wind-up over, window not yet spent). */
export function isShieldUp(p: PlayerState): boolean {
  return p.shield !== null && p.shield.elapsedMs >= p.shield.windupMs;
}

/** True when a hit coming from `sourcePos` lands inside the raised shield's cone. */
export function shieldBlocks(p: PlayerState, sourcePos: Vec2, coneDeg: number): boolean {
  return isShieldUp(p) && withinCone(p.pos, p.aimDir, degToRad(coneDeg) / 2, sourcePos);
}
