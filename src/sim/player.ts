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
 *  - Every player carries a `loadout` (its skill levels, see loadout.ts); it
 *    is fixed for the whole match and is what skills read their stats from.
 *  - Skill runtime state (aim, cooldowns, slow, in-progress skills) also lives
 *    here; the skill modules under ./skills own the state types.
 */
import { CONFIG, type GameConfig } from "../config";
import type { Vec2 } from "./geometry";
import type { Loadout } from "./loadout";
import type { BashState } from "./skills/bash";
import { zeroCooldowns, type Cooldowns } from "./skills/cooldowns";
import type { DashState } from "./skills/dash";
import type { ShieldState } from "./skills/shield";
import type { ShotState } from "./skills/shot";
import type { SlashState } from "./skills/slash";

/** A temporary movement-speed reduction (Bash). Re-applying refreshes, never stacks. */
export interface SlowEffect {
  remainingMs: number;
  speedMultiplier: number;
}

export interface PlayerState {
  id: number;
  pos: Vec2;
  radius: number;
  hp: number;
  /** Time accumulated towards the next heal tick. */
  healTimerMs: number;
  /** Unit vector of the last non-zero movement; Dash uses it when idle. */
  lastMoveDir: Vec2;
  /** Unit vector from the player towards the pointer; aimed skills use it. */
  aimDir: Vec2;
  /** Skill levels for this match. Skills read their stats through `statValue` / `resolve*`. */
  readonly loadout: Loadout;
  /** Remaining cooldown per skill, in ms (0 = ready). */
  cooldowns: Cooldowns;
  slow: SlowEffect | null;
  /** In-progress skills (null when idle). */
  dash: DashState | null;
  slash: SlashState | null;
  shot: ShotState | null;
  bash: BashState | null;
  shield: ShieldState | null;
}

export function createPlayer(id: number, pos: Vec2, loadout: Loadout, cfg: GameConfig = CONFIG): PlayerState {
  return {
    id,
    pos: { x: pos.x, y: pos.y },
    radius: cfg.player.radius,
    hp: cfg.player.maxHp,
    healTimerMs: 0,
    lastMoveDir: { x: 1, y: 0 },
    aimDir: { x: 1, y: 0 },
    loadout,
    cooldowns: zeroCooldowns(),
    slow: null,
    dash: null,
    slash: null,
    shot: null,
    bash: null,
    shield: null,
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

/* ------------------------------------------------------------------- slow -- */

/** Slow the player for `durationMs`; a fresh slow replaces any running one. */
export function applySlow(p: PlayerState, durationMs: number, speedMultiplier: number): void {
  p.slow = { remainingMs: durationMs, speedMultiplier };
}

/** Current movement-speed multiplier (1 when not slowed). */
export function speedMultiplier(p: PlayerState): number {
  return p.slow ? p.slow.speedMultiplier : 1;
}

/**
 * Count the slow down. Called at the *start* of a tick, and the effect lapses
 * only once its counter has already reached 0, so a slow applied during tick k
 * scales movement for exactly `durationMs / tickMs` ticks starting at k + 1.
 */
export function tickSlow(p: PlayerState, dtMs: number): void {
  if (!p.slow) return;
  if (p.slow.remainingMs <= 0) {
    p.slow = null;
    return;
  }
  p.slow.remainingMs = Math.max(0, p.slow.remainingMs - dtMs);
}
