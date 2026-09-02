/**
 * Loadouts: how a player's build points are spent across skill levels.
 *
 * Design-doc rules encoded here:
 *  - A player spends exactly `build.points` across the leveled skill stats.
 *  - Level 1 of every leveled stat is mandatory and already counts as 1 spent;
 *    nothing can go lower.
 *  - A stat cannot exceed the last level of its table.
 *  - Fixed skill values (all of Bash, shield cone, timings…) are not stats and
 *    cost nothing — they are simply not `StatId`s.
 *
 * Levels in a loadout are 1-based, as in the design doc ("level 1 is
 * blocked"); the config tables are 0-indexed, and `statValue` is the one place
 * that bridges the two. Combat code should read stats through `statValue`
 * rather than indexing config tables itself, so a loadout — random today,
 * hand-built in v2 — is the only thing that has to change.
 *
 * `validateLoadout` is the reusable rule check: it guards the v1 generator's
 * output and is what the v2 manual builder validates against. It reports every
 * violation, not just the first, so a UI can show them all.
 */
import { CONFIG, leveledStatIds, statLevels, type GameConfig, type StatId } from "../config";
import type { Rng } from "./rng";

/**
 * Level (1-based) chosen for each leveled stat. A flat "skill.stat" → level
 * map, the same shape as the backend's `configured_stats`.
 */
export type Loadout = Readonly<Record<StatId, number>>;

export interface LoadoutValidation {
  ok: boolean;
  /** Human-readable rule violations; empty when `ok`. */
  errors: string[];
}

/** Highest level a stat can reach (= its table length). */
export function statMaxLevel(id: StatId, cfg: GameConfig = CONFIG): number {
  return statLevels(id, cfg).length;
}

/**
 * The config value a loadout selects for `id` — e.g. slash damage at level 2
 * is `skills.slash.damage[1]`. Throws on a level outside the table rather
 * than returning `undefined` into combat math.
 */
export function statValue(loadout: Loadout, id: StatId, cfg: GameConfig = CONFIG): number {
  const table = statLevels(id, cfg);
  const level = loadout[id];
  if (!Number.isInteger(level) || level < 1 || level > table.length) {
    throw new Error(`${id} level ${level} is outside [1, ${table.length}]`);
  }
  return table[level - 1];
}

/** Points spent: the sum of every leveled stat's level (level 1 counts as 1). */
export function loadoutSpend(loadout: Loadout, cfg: GameConfig = CONFIG): number {
  return leveledStatIds(cfg).reduce((sum, id) => sum + (loadout[id] ?? 0), 0);
}

/** Points still unspent; negative when the build is over-spent. */
export function remainingPoints(loadout: Loadout, cfg: GameConfig = CONFIG): number {
  return cfg.build.points - loadoutSpend(loadout, cfg);
}

/**
 * Check a build against the rules: every leveled stat present with an integer
 * level in [1, max], no unknown stats, and exactly `build.points` spent.
 */
export function validateLoadout(loadout: Loadout, cfg: GameConfig = CONFIG): LoadoutValidation {
  const errors: string[] = [];
  const ids = leveledStatIds(cfg);
  const known = new Set<string>(ids);

  for (const key of Object.keys(loadout)) {
    if (!known.has(key)) errors.push(`${key} is not a leveled stat`);
  }

  for (const id of ids) {
    const level = (loadout as Partial<Record<StatId, number>>)[id];
    if (level === undefined) {
      errors.push(`${id} is missing (level 1 is the minimum)`);
    } else if (!Number.isInteger(level)) {
      errors.push(`${id} level must be an integer (got ${level})`);
    } else if (level < 1) {
      errors.push(`${id} level ${level} is below the level-1 minimum`);
    } else if (level > statMaxLevel(id, cfg)) {
      errors.push(`${id} level ${level} exceeds its max level ${statMaxLevel(id, cfg)}`);
    }
  }

  const spend = loadoutSpend(loadout, cfg);
  const { points } = cfg.build;
  if (spend !== points) {
    const diff = Math.abs(spend - points);
    errors.push(`spends ${spend} of ${points} points (${spend > points ? "over" : "under"} by ${diff})`);
  }

  return { ok: errors.length === 0, errors };
}

/** `validateLoadout` that throws with every violation listed. */
export function assertValidLoadout(loadout: Loadout, cfg: GameConfig = CONFIG): void {
  const result = validateLoadout(loadout, cfg);
  if (!result.ok) throw new Error(`Invalid loadout:\n - ${result.errors.join("\n - ")}`);
}

/**
 * Every leveled stat at level 1 — the mandatory floor a builder starts from.
 * Only a valid build in itself when `build.points` equals the stat count.
 */
export function baseLoadout(cfg: GameConfig = CONFIG): Loadout {
  const out = {} as Record<StatId, number>;
  for (const id of leveledStatIds(cfg)) out[id] = 1;
  return out;
}

/**
 * Roll a random valid build: start at the level-1 floor, then spend the
 * remaining points one at a time on a uniformly random stat that is not yet
 * maxed. Deterministic per `rng` state, so a match seed reproduces its builds.
 * Requires a validated config (`build.points` within the feasible range).
 */
export function generateLoadout(rng: Rng, cfg: GameConfig = CONFIG): Loadout {
  const levels = { ...baseLoadout(cfg) } as Record<StatId, number>;
  const ids = leveledStatIds(cfg);
  let remaining = cfg.build.points - ids.length;
  while (remaining > 0) {
    const open = ids.filter((id) => levels[id] < statMaxLevel(id, cfg));
    if (open.length === 0) throw new Error(`Cannot spend ${remaining} more point(s): every stat is maxed`);
    levels[open[rng.int(0, open.length - 1)]] += 1;
    remaining -= 1;
  }
  assertValidLoadout(levels, cfg);
  return levels;
}
