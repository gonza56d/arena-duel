/**
 * Slash — the sword. Primary click swings right → left, secondary left → right
 * (from the player's point of view facing the pointer). The aim is locked at
 * the click. After `windupMs` the blade — a segment of length `range` and
 * width `bladeWidth` anchored at the player's centre — sweeps across the
 * `areaDeg` cone in `swingMs`. Damage lands on the tick the travelling blade
 * first reaches an enemy: each tick tests the angular slice the blade covered
 * during that tick, so the wind-up (75 ms) need not be a tick multiple. Each
 * enemy is hit at most once per swing.
 *
 * Screen convention (y down): "the player's right" is +90° from the facing
 * angle, so right → left means decreasing angle.
 */
import { angleOf, degToRad, distancePointToSector, clamp } from "../geometry";
import type { PlayerState } from "../player";
import { livingOthers, type World } from "../world";
import { dealDamage } from "./combat";
import { isReady, startCooldown } from "./cooldowns";
import { resolveSlash } from "./stats";

export interface SlashState {
  /** Blade angle at the start and end of the swing, radians. */
  fromRad: number;
  toRad: number;
  elapsedMs: number;
  windupMs: number;
  swingMs: number;
  range: number;
  halfWidth: number;
  damage: number;
  /** True for the primary (right → left) swing. */
  primary: boolean;
  /** Players already damaged by this swing. */
  hitIds: number[];
}

export function triggerSlash(world: World, p: PlayerState, primary: boolean): boolean {
  if (!isReady(p, "slash")) return false;
  const stats = resolveSlash(p.loadout, world.config);
  startCooldown(p, "slash", stats.cooldownMs);

  const centre = angleOf(p.aimDir);
  const half = degToRad(stats.areaDeg) / 2;
  p.slash = {
    fromRad: primary ? centre + half : centre - half,
    toRad: primary ? centre - half : centre + half,
    elapsedMs: 0,
    windupMs: stats.windupMs,
    swingMs: stats.swingMs,
    range: stats.range,
    halfWidth: stats.bladeWidth / 2,
    damage: stats.damage,
    primary,
    hitIds: [],
  };
  world.events.push({ type: "skill", skill: "slash", playerId: p.id });
  return true;
}

/** Swing progress in [0, 1] at `elapsedMs` (0 throughout the wind-up). */
export function swingProgress(s: SlashState, elapsedMs: number): number {
  return clamp((elapsedMs - s.windupMs) / s.swingMs, 0, 1);
}

/** Blade angle at a given progress. */
export function bladeAngle(s: SlashState, progress: number): number {
  return s.fromRad + (s.toRad - s.fromRad) * progress;
}

export function tickSlash(world: World, p: PlayerState, dtMs: number): void {
  const s = p.slash;
  if (!s) return;
  const t0 = s.elapsedMs;
  const t1 = t0 + dtMs;
  s.elapsedMs = t1;

  if (t1 > s.windupMs) {
    // Angular slice the blade covered during this tick.
    const a0 = bladeAngle(s, swingProgress(s, t0));
    const a1 = bladeAngle(s, swingProgress(s, t1));
    for (const o of livingOthers(world, p)) {
      if (s.hitIds.includes(o.id)) continue;
      if (distancePointToSector(o.pos, p.pos, a0, a1, s.range) > o.radius + s.halfWidth) continue;
      dealDamage(world, "slash", p, o, s.damage, p.pos);
      s.hitIds.push(o.id);
    }
  }

  if (t1 >= s.windupMs + s.swingMs) p.slash = null;
}
