/**
 * Game loop: fixed-step simulation driven by requestAnimationFrame.
 *
 * Real time is accumulated between frames and consumed in `sim.tickMs` slices
 * so the simulation is deterministic regardless of frame rate. Catch-up is
 * capped at `sim.maxTicksPerFrame` (after a tab switch the game slows instead
 * of freezing while it replays seconds of ticks).
 *
 * The loop drives a `Match` (one best-of-N game): the match owns the players'
 * loadouts for the whole game and swaps in a fresh `World` per round, so the
 * loop always simulates and draws `match.world`. `newGame()` is the only thing
 * that rerolls loadouts; `nextRound()` keeps them.
 *
 * `advance()` is the single code path that turns elapsed time into ticks and a
 * frame; the rAF callback and the dev tuning handle both go through it. Skill
 * triggers are one-shot: they apply to the first tick of the call only.
 *
 * `inputMode` says who owns the mouse: in `"gameplay"` (the default, for the
 * whole match including the between-rounds pause) every click on the page is a
 * skill press and the context menu is suppressed; a future menu switches to
 * `"ui"` to get the mouse back. Only the pointer leaving the page turns aim off.
 */
import type { ArenaViewport } from "./arena";
import { CONFIG, type GameConfig } from "./config";
import { createInput } from "./input";
import { advanceRound, concludeRound, createMatch, roundOutcome, startNextRound, type Match } from "./sim/match";
import { createNpc, npcRng, type Npc } from "./sim/npc";
import { createRenderer, FX_LINGER_MS, type Renderer, type TimedEvent } from "./renderer";
import type { Vec2 } from "./sim/geometry";
import type { SkillTriggers } from "./sim/skills";
import { stepWorld, type PlayerInput, type World, type WorldInputs } from "./sim/world";

/** Pause between the end of a round and the start of the next, in real ms. */
export const ROUND_INTERMISSION_MS = 1_800;

export interface InputOverride {
  move?: Vec2;
  aim?: Vec2;
  skills?: SkillTriggers;
}

/** Who the mouse belongs to: the fight, or HTML UI such as a menu. */
export type InputMode = "gameplay" | "ui";

export interface Game {
  /** The game in progress; replaced by `newGame()`. */
  readonly match: Match;
  /** The round in progress (`match.world`); replaced by `nextRound()`. */
  readonly world: World;
  viewport: ArenaViewport;
  /** Id of the player driven by this client's keyboard and mouse. */
  localPlayerId: number;
  /** Mouse ownership; `"gameplay"` unless a menu takes it. */
  inputMode: InputMode;
  /**
   * Consume `elapsedMs` of real time as fixed ticks (capped per call), feeding
   * the local player the live input unless `override` replaces parts of it,
   * then draw.
   */
  advance(elapsedMs: number, override?: InputOverride): void;
  /** Queue an input for any player, applied on the next tick only (dev / dummy control). */
  queue(playerId: number, input: PlayerInput): void;
  /** Start the next round of the current game: new layout, same loadouts. */
  nextRound(): World;
  /** Start a whole new game (same best-of): both loadouts are rerolled. */
  newGame(seed?: number): Match;
  stop(): void;
}

export interface GameOptions {
  seed?: number;
  /** One of `rounds.bestOfOptions`; defaults to the first. */
  bestOf?: number;
  config?: GameConfig;
  /** Called once per rendered frame, after simulation and drawing. */
  onFrame?: (world: World, viewport: ArenaViewport) => void;
  /** Called once when a match finishes (the series is decided). */
  onMatchOver?: (match: Match) => void;
}

export function startGame(canvas: HTMLCanvasElement, opts: GameOptions = {}): Game {
  const config = opts.config ?? CONFIG;
  let match = createMatch({ seed: opts.seed, bestOf: opts.bestOf, config });
  const localPlayerId = match.world.players[0].id;
  /** One controller per non-local player; rebuilt when a new match starts. */
  let npcs: Npc[] = buildNpcs(match);

  const renderer: Renderer = createRenderer(canvas);
  let inputMode: InputMode = "gameplay";
  const input = createInput(window, canvas, renderer.viewport, { capturesMouse: () => inputMode === "gameplay" });

  const tickMs = config.sim.tickMs;
  const maxTicks = config.sim.maxTicksPerFrame;

  let running = true;
  let last = performance.now();
  let accumulator = 0;
  let queued: WorldInputs = {};
  const fx: TimedEvent[] = [];
  /** Real ms left in the between-rounds pause (only counts while `roundOver`). */
  let intermissionLeft = 0;
  /** Guards the one-shot `onMatchOver`. */
  let matchOverFired = false;

  /** A fresh NPC controller for every player the local client does not drive. */
  function buildNpcs(m: Match): Npc[] {
    return m.world.players
      .filter((p) => p.id !== localPlayerId)
      .map((p) => createNpc(p.id, npcRng(m.seed, p.id)));
  }

  /** This tick's input for every NPC-controlled player. */
  function npcInputs(world: World): WorldInputs {
    const out: WorldInputs = {};
    for (const npc of npcs) out[npc.playerId] = npc.decide(world, tickMs);
    return out;
  }

  /** Forget per-round transient state when the world is replaced. */
  function resetTransient(): void {
    accumulator = 0;
    queued = {};
    input.consumeTriggers(); // presses made while nothing simulated must not fire at round start
    fx.length = 0;
    intermissionLeft = 0;
  }

  function advance(elapsedMs: number, override: InputOverride = {}): void {
    if (match.phase === "playing") simulate(elapsedMs, override);
    else if (match.phase === "roundOver") {
      // Freeze on the death frame, then start the next round after the pause.
      intermissionLeft -= elapsedMs;
      if (intermissionLeft <= 0) {
        advanceRound(match);
        resetTransient();
      }
    }
    // `matchOver`: nothing simulates; the final frame stays on screen.

    const world = match.world;
    while (fx.length > 0 && fx[0].atMs < world.timeMs - FX_LINGER_MS) fx.shift();
    renderer.draw(world, fx, localPlayerId);
    opts.onFrame?.(world, renderer.viewport);
  }

  /** Consume real time as fixed ticks, feeding local + NPC input, until the
   * round ends or the time budget is spent. */
  function simulate(elapsedMs: number, override: InputOverride): void {
    const world = match.world;
    // Drop time we cannot catch up on rather than spiralling.
    accumulator = Math.min(accumulator + elapsedMs, tickMs * maxTicks);

    const move = override.move ?? input.direction();
    const aim = override.aim ?? input.aim() ?? undefined;
    const pressed = override.skills ?? input.consumeTriggers();

    // First tick: live input + anything queued (presses carried from a frame
    // that ran no tick, or dev/dummy inputs for other players).
    const carried = queued[localPlayerId];
    const first: WorldInputs = {
      ...queued,
      [localPlayerId]: { move, aim: aim ?? carried?.aim, skills: { ...(carried?.skills ?? {}), ...pressed } },
    };
    const rest: WorldInputs = { [localPlayerId]: { move, aim } };
    queued = {};

    let ran = false;
    while (accumulator >= tickMs) {
      // NPCs decide every tick against the live world; the local player's input
      // (and, on the first tick, dev/dummy queued input) overrides theirs.
      const inputs: WorldInputs = ran ? { ...npcInputs(world), ...rest } : { ...npcInputs(world), ...first };
      stepWorld(world, inputs, tickMs);
      ran = true;
      accumulator -= tickMs;
      for (const e of world.events) fx.push({ ...e, atMs: world.timeMs });

      const outcome = roundOutcome(world);
      if (outcome) {
        concludeRound(match, outcome.winnerId);
        onRoundConcluded();
        break; // stop stepping so the death frame holds
      }
    }
    if (!ran) {
      // Nothing advanced this frame (very high frame rate): keep the one-shot
      // presses so a click is never lost, but let movement/aim refresh live.
      queued = first;
      queued[localPlayerId] = { move: { x: 0, y: 0 }, skills: first[localPlayerId]?.skills };
    }
  }

  /** React to a round that just ended: arm the pause, or finish the match. */
  function onRoundConcluded(): void {
    if (match.phase === "matchOver") {
      if (!matchOverFired) {
        matchOverFired = true;
        opts.onMatchOver?.(match);
      }
    } else {
      intermissionLeft = ROUND_INTERMISSION_MS;
    }
  }

  function frame(now: number): void {
    if (!running) return;
    advance(now - last);
    last = now;
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  return {
    get match(): Match {
      return match;
    },
    get world(): World {
      return match.world;
    },
    viewport: renderer.viewport,
    localPlayerId,
    get inputMode(): InputMode {
      return inputMode;
    },
    set inputMode(mode: InputMode) {
      inputMode = mode;
    },
    advance,
    queue(playerId: number, playerInput: PlayerInput): void {
      const prev = queued[playerId];
      queued[playerId] = prev
        ? { ...prev, ...playerInput, skills: { ...(prev.skills ?? {}), ...(playerInput.skills ?? {}) } }
        : playerInput;
    },
    nextRound(): World {
      // Dev helper: force a fresh round regardless of scoring.
      resetTransient();
      const world = startNextRound(match);
      match.phase = "playing";
      match.lastRoundWinnerId = null;
      return world;
    },
    newGame(seed?: number): Match {
      resetTransient();
      matchOverFired = false;
      match = createMatch({ seed, bestOf: match.bestOf, config });
      npcs = buildNpcs(match);
      return match;
    },
    stop(): void {
      running = false;
      input.stop();
      renderer.stop();
    },
  };
}
