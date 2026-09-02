/**
 * Per-player skill levels and the concrete numbers they resolve to.
 *
 * The design doc gives each *stat* its own level table (Dash distance, Slash
 * range, Slash damage, …), so a player's build is a level index per stat, not
 * per skill. Indices are 0-based (0 = "level 1" in the doc). Bash has no
 * levelled stats. Every number below is read from the central config; nothing
 * in this file is a gameplay literal.
 */
import { CONFIG, bladeWidth, bulletRadius, bulletSpeedUnitsPerMs, type BashConfig, type GameConfig, type Levels } from "../../config";

export type SkillId = "dash" | "slash" | "shot" | "shield" | "bash";
export const SKILL_IDS: readonly SkillId[] = ["dash", "slash", "shot", "shield", "bash"];

export interface SkillLevels {
  dash: { cooldown: number; distance: number };
  slash: { cooldown: number; range: number; area: number; damage: number };
  shot: { cooldown: number; range: number; damage: number };
  shield: { cooldown: number };
}

/** Every stat at level 1. */
export function defaultSkillLevels(): SkillLevels {
  return {
    dash: { cooldown: 0, distance: 0 },
    slash: { cooldown: 0, range: 0, area: 0, damage: 0 },
    shot: { cooldown: 0, range: 0, damage: 0 },
    shield: { cooldown: 0 },
  };
}

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

function pick(name: string, table: Levels, level: number): number {
  if (!Number.isInteger(level) || level < 0 || level >= table.length) {
    throw new Error(`${name} level ${level} out of range [0, ${table.length - 1}]`);
  }
  return table[level];
}

export function resolveDash(levels: SkillLevels, cfg: GameConfig = CONFIG): DashStats {
  const c = cfg.skills.dash;
  return {
    cooldownMs: pick("dash.cooldown", c.cooldownMs, levels.dash.cooldown),
    distance: pick("dash.distance", c.distance, levels.dash.distance),
    durationMs: c.durationMs,
  };
}

export function resolveSlash(levels: SkillLevels, cfg: GameConfig = CONFIG): SlashStats {
  const c = cfg.skills.slash;
  return {
    cooldownMs: pick("slash.cooldown", c.cooldownMs, levels.slash.cooldown),
    range: pick("slash.range", c.range, levels.slash.range),
    areaDeg: pick("slash.area", c.areaDeg, levels.slash.area),
    damage: pick("slash.damage", c.damage, levels.slash.damage),
    windupMs: c.windupMs,
    swingMs: c.swingMs,
    bladeWidth: bladeWidth(cfg),
  };
}

export function resolveShot(levels: SkillLevels, cfg: GameConfig = CONFIG): ShotStats {
  const c = cfg.skills.shot;
  return {
    cooldownMs: pick("shot.cooldown", c.cooldownMs, levels.shot.cooldown),
    range: pick("shot.range", c.range, levels.shot.range),
    damage: pick("shot.damage", c.damage, levels.shot.damage),
    windupMs: c.windupMs,
    speed: bulletSpeedUnitsPerMs(cfg),
    bulletRadius: bulletRadius(cfg),
  };
}

export function resolveShield(levels: SkillLevels, cfg: GameConfig = CONFIG): ShieldStats {
  const c = cfg.skills.shield;
  return {
    cooldownMs: pick("shield.cooldown", c.cooldownMs, levels.shield.cooldown),
    blockFraction: c.blockFraction,
    coneDeg: c.coneDeg,
    windupMs: c.windupMs,
    activeMs: c.activeMs,
  };
}

export function resolveBash(cfg: GameConfig = CONFIG): BashStats {
  return cfg.skills.bash;
}

/** Throws when any level index falls outside its config table. */
export function validateSkillLevels(levels: SkillLevels, cfg: GameConfig = CONFIG): void {
  resolveDash(levels, cfg);
  resolveSlash(levels, cfg);
  resolveShot(levels, cfg);
  resolveShield(levels, cfg);
}
