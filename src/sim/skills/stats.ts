/**
 * The concrete numbers a player's skills use, resolved from its `Loadout`.
 *
 * A loadout holds a 1-based level per leveled stat (see ../loadout.ts);
 * `statValue` bridges that to the 0-indexed config tables, and the `resolve*`
 * helpers below gather each skill's numbers — leveled stats through
 * `statValue`, fixed ones straight from the config — so skill code never
 * indexes `CONFIG.skills.x.y[...]` itself. Bash has no leveled stats.
 */
import { CONFIG, bladeWidth, bulletRadius, bulletSpeedUnitsPerMs, type BashConfig, type GameConfig } from "../../config";
import { statValue, type Loadout } from "../loadout";

export type SkillId = "dash" | "slash" | "shot" | "shield" | "bash";
export const SKILL_IDS: readonly SkillId[] = ["dash", "slash", "shot", "shield", "bash"];

export interface DashStats {
  cooldownMs: number;
  distance: number;
  durationMs: number;
}

export interface SlashStats {
  cooldownMs: number;
  range: number;
  areaDeg: number;
  damage: number;
  windupMs: number;
  swingMs: number;
  /** Blade width in units (derived from the player diameter). */
  bladeWidth: number;
}

export interface ShotStats {
  cooldownMs: number;
  range: number;
  damage: number;
  windupMs: number;
  /** Units per millisecond. */
  speed: number;
  bulletRadius: number;
}

export interface ShieldStats {
  cooldownMs: number;
  blockFraction: number;
  coneDeg: number;
  windupMs: number;
  activeMs: number;
}

export type BashStats = Readonly<BashConfig>;

export function resolveDash(loadout: Loadout, cfg: GameConfig = CONFIG): DashStats {
  return {
    cooldownMs: statValue(loadout, "dash.cooldownMs", cfg),
    distance: statValue(loadout, "dash.distance", cfg),
    durationMs: cfg.skills.dash.durationMs,
  };
}

export function resolveSlash(loadout: Loadout, cfg: GameConfig = CONFIG): SlashStats {
  const c = cfg.skills.slash;
  return {
    cooldownMs: statValue(loadout, "slash.cooldownMs", cfg),
    range: statValue(loadout, "slash.range", cfg),
    areaDeg: statValue(loadout, "slash.areaDeg", cfg),
    damage: statValue(loadout, "slash.damage", cfg),
    windupMs: c.windupMs,
    swingMs: c.swingMs,
    bladeWidth: bladeWidth(cfg),
  };
}

export function resolveShot(loadout: Loadout, cfg: GameConfig = CONFIG): ShotStats {
  return {
    cooldownMs: statValue(loadout, "shot.cooldownMs", cfg),
    range: statValue(loadout, "shot.range", cfg),
    damage: statValue(loadout, "shot.damage", cfg),
    windupMs: cfg.skills.shot.windupMs,
    speed: bulletSpeedUnitsPerMs(cfg),
    bulletRadius: bulletRadius(cfg),
  };
}

export function resolveShield(loadout: Loadout, cfg: GameConfig = CONFIG): ShieldStats {
  const c = cfg.skills.shield;
  return {
    cooldownMs: statValue(loadout, "shield.cooldownMs", cfg),
    blockFraction: c.blockFraction,
    coneDeg: c.coneDeg,
    windupMs: c.windupMs,
    activeMs: c.activeMs,
  };
}

export function resolveBash(cfg: GameConfig = CONFIG): BashStats {
  return cfg.skills.bash;
}
