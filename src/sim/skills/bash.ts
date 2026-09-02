/**
 * Bash — a shield strike. Fixed numbers (no levelled stats): after a 10 ms
 * wind-up it *instantly* hits every living enemy whose circle overlaps a
 * 35° cone of radius 63 in front of the player (no travel, unlike Slash),
 * dealing 1 damage and slowing them by 50% for 1 s. Direction is locked at
 * the key press. All numbers come from `CONFIG.skills.bash`.
 */
import { circleIntersectsSector, degToRad, type Vec2 } from "../geometry";
import { applySlow, type PlayerState } from "../player";
import { livingOthers, type World } from "../world";
import { dealDamage } from "./combat";
import { isReady, startCooldown } from "./cooldowns";
import { resolveBash } from "./stats";

export interface BashState {
  /** Cone centre direction, locked at the press. */
  dir: Vec2;
  elapsedMs: number;
  windupMs: number;
}

export function triggerBash(world: World, p: PlayerState): boolean {
  if (!isReady(p, "bash")) return false;
  const stats = resolveBash(world.config);
  startCooldown(p, "bash", stats.cooldownMs);
  p.bash = { dir: { ...p.aimDir }, elapsedMs: 0, windupMs: stats.windupMs };
  world.events.push({ type: "skill", skill: "bash", playerId: p.id });
  return true;
}

/** Advance the wind-up; on completion resolve the hit at once and clear the state. */
export function tickBash(world: World, p: PlayerState, dtMs: number): void {
  const b = p.bash;
  if (!b) return;
  b.elapsedMs += dtMs;
  if (b.elapsedMs < b.windupMs) return;

  const stats = resolveBash(world.config);
  const halfAngle = degToRad(stats.coneDeg) / 2;
  for (const o of livingOthers(world, p)) {
    if (!circleIntersectsSector({ x: o.pos.x, y: o.pos.y, r: o.radius }, p.pos, b.dir, halfAngle, stats.range)) continue;
    const hit = dealDamage(world, "bash", p, o, stats.damage, p.pos);
    if (!hit.blocked) applySlow(o, stats.slowDurationMs, stats.slowSpeedMultiplier);
  }
  p.bash = null;
}
