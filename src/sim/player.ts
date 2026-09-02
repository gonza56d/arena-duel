/**
 * Player state and the HP model.
 *
 * Design-doc rules encoded here:
 *  - HP is an integer, starts at `maxHp`.
 *  - Damage is always an integer; non-integer amounts are a programming error
 *    and throw rather than silently producing fractional HP.
 *  - The only healing is time-based: `healAmount` every `healIntervalMs` while
 *    alive and below max.
 *  - A player is dead when HP ≤ 0. HP is not clamped at 0 so overkill is
 *    visible; it is clamped at `maxHp` from above.
 */
import { CONFIG, type GameConfig } from "../config";
import type { Vec2 } from "./geometry";

export interface PlayerState {
  id: number;
  pos: Vec2;
  radius: number;
  hp: number;
  /** Time accumulated towards the next heal tick. */
  healTimerMs: number;
  /** Unit vector of the last non-zero movement (used by Dash later). */
  lastMoveDir: Vec2;
}

export function createPlayer(id: number, pos: Vec2, cfg: GameConfig = CONFIG): PlayerState {
  return {
    id,
    pos: { x: pos.x, y: pos.y },
    radius: cfg.player.radius,
    hp: cfg.player.maxHp,
    healTimerMs: 0,
    lastMoveDir: { x: 1, y: 0 },
  };
}

export function isDead(p: PlayerState): boolean {
  return p.hp <= 0;
}

function assertIntegerAmount(kind: string, amount: number): void {
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`${kind} must be a non-negative integer (got ${amount})`);
  }
}

/**
 * Remove `amount` HP. Returns the resulting HP. No effect on dead players.
 * Optionally restarts the heal countdown (config flag).
 */
export function applyDamage(p: PlayerState, amount: number, cfg: GameConfig = CONFIG): number {
  assertIntegerAmount("damage", amount);
  if (isDead(p)) return p.hp;
  p.hp -= amount;
  if (cfg.player.healTimerResetsOnDamage) p.healTimerMs = 0;
  return p.hp;
}

/** Add `amount` HP, never above `maxHp`. Dead players do not heal. */
export function applyHeal(p: PlayerState, amount: number, cfg: GameConfig = CONFIG): number {
  assertIntegerAmount("heal", amount);
  if (isDead(p)) return p.hp;
  p.hp = Math.min(cfg.player.maxHp, p.hp + amount);
  return p.hp;
}

/**
 * Advance the passive heal timer by `dtMs`. Heals `healAmount` for every full
 * `healIntervalMs` accumulated while below max HP. The timer is reset whenever
 * the player is dead or at full HP so healing always starts a full interval
 * after the first damage taken.
 */
export function tickHeal(p: PlayerState, dtMs: number, cfg: GameConfig = CONFIG): void {
  const { maxHp, healAmount, healIntervalMs } = cfg.player;
  if (isDead(p) || p.hp >= maxHp) {
    p.healTimerMs = 0;
    return;
  }
  p.healTimerMs += dtMs;
  while (p.healTimerMs >= healIntervalMs && p.hp < maxHp) {
    p.healTimerMs -= healIntervalMs;
    applyHeal(p, healAmount, cfg);
  }
  if (p.hp >= maxHp) p.healTimerMs = 0;
}
