/**
 * CENTRAL TUNING CONFIG — the single place every feel-affecting number lives.
 *
 * v1 is a tuning instrument: map size, speeds, radii, HP, heal cadence,
 * timings and every per-skill stat table are defined HERE and nowhere else.
 * Simulation, rendering and (later) skills read from this object, so changing a
 * value in this file changes behaviour across the whole game with no other
 * edits.
 *
 * Rules for this file:
 *  - Numbers only describe *what* the game feels like; no logic lives here.
 *  - Units: distances in arena units, times in milliseconds, angles in degrees.
 *  - HP, damage and heal amounts MUST be integers (see `validateConfig`).
 *  - A skill stat is *leveled* (spendable with build points) exactly when its
 *    field is a `Levels` table; a plain number is a fixed value and costs
 *    nothing. `StatId` and `leveledStatIds()` derive the spendable set from
 *    that, so no separate list has to be kept in sync.
 *  - Simulation code receives a `GameConfig` as a parameter (defaulting to
 *    `CONFIG`) so tests and future tuning UIs can override values at runtime.
 */

export interface Point {
  x: number;
  y: number;
}

/** Levels are indexed from 0 (= level 1 in the design doc). */
export type Levels<T = number> = readonly T[];

export interface ArenaConfig {
  /** Side of the square arena, in units. */
  size: number;
  /** Where players start; index 0 is the local player, index 1 the rival. */
  spawnPoints: readonly Point[];
  obstacles: ObstacleGenConfig;
}

export interface ObstacleGenConfig {
  /** Inclusive range of how many obstacles to try to place. */
  countMin: number;
  countMax: number;
  /** Inclusive range for each rectangle side, in units. */
  sideMin: number;
  sideMax: number;
  /**
   * Minimum clear gap between two obstacles, and between an obstacle and the
   * arena edge. Must be ≥ a player's diameter so every gap is passable.
   */
  minGap: number;
  /** Radius around each spawn point that stays free of obstacles. */
  spawnClearance: number;
  /** Placement attempts per obstacle before giving up on it. */
  maxPlacementAttempts: number;
}

export interface PlayerConfig {
  /** Collision circle radius, in units. */
  radius: number;
  /** Movement speed expressed exactly as in the design doc: units per 100 ms. */
  moveSpeedUnitsPer100ms: number;
  /** Starting and maximum health. Integer. */
  maxHp: number;
  /** HP restored per heal tick. Integer. */
  healAmount: number;
  /** Time between heal ticks while below max HP. */
  healIntervalMs: number;
  /** When true, taking damage restarts the heal countdown. */
  healTimerResetsOnDamage: boolean;
}

export interface SimConfig {
  /** Fixed simulation step. Every timing in this file is a multiple of it. */
  tickMs: number;
  /** Cap on catch-up ticks per rendered frame (e.g. after a tab switch). */
  maxTicksPerFrame: number;
  /**
   * Upper bound on collision-resolution passes per tick. Each pass roughly
   * halves any remaining overlap; the loop exits as soon as nothing moves, so a
   * generous cap costs nothing in the common case.
   */
  collisionIterations: number;
}

export interface RoundsConfig {
  /** Match formats offered: best of N rounds. The first entry is the default. */
  bestOfOptions: readonly number[];
}

/* ---------------------------------------------------------------- skills -- */

export interface DashConfig {
  cooldownMs: Levels;
  distance: Levels;
  /** The dash always takes this long, regardless of distance. */
  durationMs: number;
}

export interface SlashConfig {
  cooldownMs: Levels;
  /** Sword length = cone depth, in units. */
  range: Levels;
  /** Cone width, in degrees. */
  areaDeg: Levels;
  /** Integer HP removed on hit. */
  damage: Levels;
  /** Wind-up before the swing starts. */
  windupMs: number;
  /** Duration of the swing itself (the blade "travels" during this time). */
  swingMs: number;
  /** Blade width as a fraction of the player's diameter. */
  bladeWidthRatio: number;
}

export interface ShotConfig {
  cooldownMs: Levels;
  /**
   * Maximum bullet travel distance, in units, after which the bullet fades.
   * The bullet always stops at the first edge, obstacle or player it hits; a
   * value ≥ the arena diagonal therefore means "flies until it hits something".
   * Level table left flat until tuned.
   */
  range: Levels;
  /** Integer HP removed on hit. */
  damage: Levels;
  /** Wind-up before the bullet leaves. */
  windupMs: number;
  /** The bullet takes this long to cross one arena side (not the diagonal). */
  travelArenaSideMs: number;
  /** Bullet diameter as a fraction of the player's diameter. */
  bulletWidthRatio: number;
}

export interface ShieldConfig {
  cooldownMs: Levels;
  /** Fraction of damage blocked (1 = 100%). Blocked damage is floored to an integer. */
  blockFraction: number;
  /** Protected cone facing the pointer, in degrees. */
  coneDeg: number;
  /** Delay before the shield is up. The design doc says none. */
  windupMs: number;
  /**
   * How long the shield stays up after activation. Not in the design doc; the
   * cooldown starts at activation so this is the block window per use.
   */
  activeMs: number;
}

export interface BashConfig {
  cooldownMs: number;
  damage: number;
  slowDurationMs: number;
  /** Speed multiplier applied to the slowed target (0.5 = half speed). */
  slowSpeedMultiplier: number;
  range: number;
  coneDeg: number;
  windupMs: number;
}

export interface SkillsConfig {
  dash: DashConfig;
  slash: SlashConfig;
  shot: ShotConfig;
  shield: ShieldConfig;
  bash: BashConfig;
}

/* ---------------------------------------------------------------- build --- */

/** Keys of `T` whose value is a level table. */
type LevelKeys<T> = { [K in keyof T & string]: T[K] extends Levels ? K : never }[keyof T & string];

/**
 * Id of every leveled skill stat as `"skill.stat"` (e.g. `"slash.damage"`).
 * Derived from the skill configs above: a stat exists here exactly when its
 * field is a `Levels` table, so Bash (all fixed) contributes nothing. This is
 * the key type of a player's loadout and of the backend's `configured_stats`.
 */
export type StatId = {
  [S in keyof SkillsConfig & string]: `${S}.${LevelKeys<SkillsConfig[S]>}`;
}[keyof SkillsConfig & string];

export interface BuildConfig {
  /**
   * Stat points each player spends across skill levels. Level 1 of every
   * leveled stat is mandatory and already counts as 1 spent, so a valid build
   * spends exactly this many with every stat within [1, its table length].
   */
  points: number;
}

export interface GameConfig {
  arena: ArenaConfig;
  player: PlayerConfig;
  sim: SimConfig;
  rounds: RoundsConfig;
  build: BuildConfig;
  skills: SkillsConfig;
}

/* ---------------------------------------------------------------- values -- */

export const CONFIG: GameConfig = {
  arena: {
    size: 2100,
    spawnPoints: [
      { x: 300, y: 1050 },
      { x: 1800, y: 1050 },
    ],
    obstacles: {
      countMin: 10,
      countMax: 14,
      sideMin: 90,
      sideMax: 360,
      minGap: 90,
      spawnClearance: 220,
      maxPlacementAttempts: 200,
    },
  },

  player: {
    radius: 25,
    moveSpeedUnitsPer100ms: 37.5,
    maxHp: 10,
    healAmount: 1,
    healIntervalMs: 15_000,
    healTimerResetsOnDamage: false,
  },

  sim: {
    tickMs: 10,
    maxTicksPerFrame: 25,
    collisionIterations: 24,
  },

  rounds: {
    bestOfOptions: [3, 5, 7, 10],
  },

  build: {
    points: 16,
  },

  skills: {
    dash: {
      cooldownMs: [5_000, 4_500, 4_000, 3_500],
      distance: [125, 135, 145, 156.25],
      durationMs: 100,
    },
    slash: {
      cooldownMs: [2_000, 1_750, 1_500, 1_250],
      range: [50, 59, 68, 75],
      areaDeg: [45, 60, 75, 90],
      damage: [2, 3, 4],
      windupMs: 75,
      swingMs: 50,
      bladeWidthRatio: 0.1,
    },
    shot: {
      cooldownMs: [5_000, 4_500, 4_000, 3_500],
      range: [3_000, 3_000, 3_000, 3_000],
      damage: [2, 3, 4],
      windupMs: 50,
      travelArenaSideMs: 1_000,
      bulletWidthRatio: 0.5,
    },
    shield: {
      cooldownMs: [4_000, 3_500, 3_000, 2_500],
      blockFraction: 1,
      coneDeg: 90,
      windupMs: 0,
      activeMs: 500,
    },
    bash: {
      cooldownMs: 2_500,
      damage: 1,
      slowDurationMs: 1_000,
      slowSpeedMultiplier: 0.5,
      range: 63,
      coneDeg: 35,
      windupMs: 10,
    },
  },
};

/* ------------------------------------------------------------- derived ---- */

/** Movement speed in units per millisecond, derived from the doc's "per 100 ms". */
export function moveSpeedUnitsPerMs(cfg: GameConfig = CONFIG): number {
  return cfg.player.moveSpeedUnitsPer100ms / 100;
}

/** Bullet speed in units per millisecond: one arena side per `travelArenaSideMs`. */
export function bulletSpeedUnitsPerMs(cfg: GameConfig = CONFIG): number {
  return cfg.arena.size / cfg.skills.shot.travelArenaSideMs;
}

/** Bullet radius in units: `bulletWidthRatio` of the player's diameter, halved. */
export function bulletRadius(cfg: GameConfig = CONFIG): number {
  return (cfg.player.radius * 2 * cfg.skills.shot.bulletWidthRatio) / 2;
}

/** Sword blade width in units: `bladeWidthRatio` of the player's diameter. */
export function bladeWidth(cfg: GameConfig = CONFIG): number {
  return cfg.player.radius * 2 * cfg.skills.slash.bladeWidthRatio;
}

/**
 * Every leveled stat id in `cfg`, in a stable order (skill order, then field
 * order as written above). Runtime twin of the `StatId` type: a field is a
 * stat exactly when it is an array.
 */
export function leveledStatIds(cfg: GameConfig = CONFIG): StatId[] {
  const ids: StatId[] = [];
  for (const [skill, skillCfg] of Object.entries(cfg.skills)) {
    for (const [stat, value] of Object.entries(skillCfg)) {
      if (Array.isArray(value)) ids.push(`${skill}.${stat}` as StatId);
    }
  }
  return ids;
}

/** The level table behind a stat id (index 0 = level 1). */
export function statLevels(id: StatId, cfg: GameConfig = CONFIG): Levels {
  const [skill, stat] = id.split(".");
  const table = (cfg.skills as unknown as Record<string, Record<string, unknown>>)[skill]?.[stat];
  if (!Array.isArray(table)) throw new Error(`${id} is not a leveled stat`);
  return table as Levels;
}

/* ---------------------------------------------------------- validation ---- */

/**
 * Checks the invariants the rest of the game relies on. Throws with a precise
 * message so a mistyped tuning value fails loudly at startup / in tests instead
 * of surfacing as a fractional HP mid-fight.
 */
export function validateConfig(cfg: GameConfig = CONFIG): void {
  const errors: string[] = [];
  const positive = (name: string, v: number): void => {
    if (!(v > 0) || !Number.isFinite(v)) errors.push(`${name} must be > 0 (got ${v})`);
  };
  const nonNegative = (name: string, v: number): void => {
    if (!(v >= 0) || !Number.isFinite(v)) errors.push(`${name} must be ≥ 0 (got ${v})`);
  };
  const integer = (name: string, v: number): void => {
    if (!Number.isInteger(v)) errors.push(`${name} must be an integer (got ${v})`);
  };
  const integerLevels = (name: string, vs: Levels): void => {
    vs.forEach((v, i) => integer(`${name}[${i}]`, v));
  };
  const positiveLevels = (name: string, vs: Levels): void => {
    if (vs.length === 0) errors.push(`${name} must have at least one level`);
    vs.forEach((v, i) => positive(`${name}[${i}]`, v));
  };

  const { arena, player, sim, rounds, build, skills } = cfg;

  positive("arena.size", arena.size);
  if (arena.spawnPoints.length < 2) errors.push("arena.spawnPoints needs at least 2 entries");
  arena.spawnPoints.forEach((p, i) => {
    if (p.x < player.radius || p.x > arena.size - player.radius || p.y < player.radius || p.y > arena.size - player.radius) {
      errors.push(`arena.spawnPoints[${i}] must keep the whole player inside the arena`);
    }
  });
  const o = arena.obstacles;
  nonNegative("arena.obstacles.countMin", o.countMin);
  if (o.countMax < o.countMin) errors.push("arena.obstacles.countMax must be ≥ countMin");
  positive("arena.obstacles.sideMin", o.sideMin);
  if (o.sideMax < o.sideMin) errors.push("arena.obstacles.sideMax must be ≥ sideMin");
  if (o.minGap < player.radius * 2) {
    errors.push(`arena.obstacles.minGap must be ≥ player diameter (${player.radius * 2}) so gaps stay passable`);
  }
  nonNegative("arena.obstacles.spawnClearance", o.spawnClearance);
  positive("arena.obstacles.maxPlacementAttempts", o.maxPlacementAttempts);

  positive("player.radius", player.radius);
  positive("player.moveSpeedUnitsPer100ms", player.moveSpeedUnitsPer100ms);
  positive("player.maxHp", player.maxHp);
  integer("player.maxHp", player.maxHp);
  positive("player.healAmount", player.healAmount);
  integer("player.healAmount", player.healAmount);
  positive("player.healIntervalMs", player.healIntervalMs);

  positive("sim.tickMs", sim.tickMs);
  positive("sim.maxTicksPerFrame", sim.maxTicksPerFrame);
  positive("sim.collisionIterations", sim.collisionIterations);

  if (rounds.bestOfOptions.length === 0) errors.push("rounds.bestOfOptions must not be empty");
  rounds.bestOfOptions.forEach((n, i) => {
    positive(`rounds.bestOfOptions[${i}]`, n);
    integer(`rounds.bestOfOptions[${i}]`, n);
  });

  positive("build.points", build.points);
  integer("build.points", build.points);
  const statIds = leveledStatIds(cfg);
  const minSpend = statIds.length;
  const maxSpend = statIds.reduce((sum, id) => sum + statLevels(id, cfg).length, 0);
  if (build.points < minSpend || build.points > maxSpend) {
    errors.push(
      `build.points must be within [${minSpend}, ${maxSpend}] ` +
        `(level 1 of all ${minSpend} leveled stats is mandatory; ${maxSpend} maxes every stat) (got ${build.points})`,
    );
  }

  positiveLevels("skills.dash.cooldownMs", skills.dash.cooldownMs);
  positiveLevels("skills.dash.distance", skills.dash.distance);
  positive("skills.dash.durationMs", skills.dash.durationMs);

  positiveLevels("skills.slash.cooldownMs", skills.slash.cooldownMs);
  positiveLevels("skills.slash.range", skills.slash.range);
  positiveLevels("skills.slash.areaDeg", skills.slash.areaDeg);
  positiveLevels("skills.slash.damage", skills.slash.damage);
  integerLevels("skills.slash.damage", skills.slash.damage);
  nonNegative("skills.slash.windupMs", skills.slash.windupMs);
  positive("skills.slash.swingMs", skills.slash.swingMs);
  positive("skills.slash.bladeWidthRatio", skills.slash.bladeWidthRatio);

  positiveLevels("skills.shot.cooldownMs", skills.shot.cooldownMs);
  positiveLevels("skills.shot.range", skills.shot.range);
  positiveLevels("skills.shot.damage", skills.shot.damage);
  integerLevels("skills.shot.damage", skills.shot.damage);
  nonNegative("skills.shot.windupMs", skills.shot.windupMs);
  positive("skills.shot.travelArenaSideMs", skills.shot.travelArenaSideMs);
  positive("skills.shot.bulletWidthRatio", skills.shot.bulletWidthRatio);

  positiveLevels("skills.shield.cooldownMs", skills.shield.cooldownMs);
  if (skills.shield.blockFraction < 0 || skills.shield.blockFraction > 1) {
    errors.push("skills.shield.blockFraction must be within [0, 1]");
  }
  positive("skills.shield.coneDeg", skills.shield.coneDeg);
  nonNegative("skills.shield.windupMs", skills.shield.windupMs);
  positive("skills.shield.activeMs", skills.shield.activeMs);

  positive("skills.bash.cooldownMs", skills.bash.cooldownMs);
  positive("skills.bash.damage", skills.bash.damage);
  integer("skills.bash.damage", skills.bash.damage);
  positive("skills.bash.slowDurationMs", skills.bash.slowDurationMs);
  if (skills.bash.slowSpeedMultiplier <= 0 || skills.bash.slowSpeedMultiplier > 1) {
    errors.push("skills.bash.slowSpeedMultiplier must be within (0, 1]");
  }
  positive("skills.bash.range", skills.bash.range);
  positive("skills.bash.coneDeg", skills.bash.coneDeg);
  nonNegative("skills.bash.windupMs", skills.bash.windupMs);

  if (errors.length > 0) {
    throw new Error(`Invalid game config:\n - ${errors.join("\n - ")}`);
  }
}
