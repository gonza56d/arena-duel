/**
 * Game loop: fixed-step simulation driven by requestAnimationFrame.
 *
 * Real time is accumulated between frames and consumed in `sim.tickMs` slices
 * so the simulation is deterministic regardless of frame rate. Catch-up is
 * capped at `sim.maxTicksPerFrame` (after a tab switch the game slows instead
 * of freezing while it replays seconds of ticks).
 *
 * `advance()` is the single code path that turns elapsed time into ticks and a
 * frame; the rAF callback and the dev tuning handle both go through it. Skill
 * triggers are one-shot: they apply to the first tick of the call only.
 */
import type { ArenaViewport } from "./arena";
import { CONFIG, type GameConfig } from "./config";
import { createInput } from "./input";
import { createRenderer, FX_LINGER_MS, type Renderer, type TimedEvent } from "./renderer";
import type { Vec2 } from "./sim/geometry";
import type { SkillTriggers } from "./sim/skills";
import { createWorld, stepWorld, type PlayerInput, type World, type WorldInputs } from "./sim/world";

export interface InputOverride {
  move?: Vec2;
  aim?: Vec2;
  skills?: SkillTriggers;
}

export interface Game {
  world: World;
  viewport: ArenaViewport;
  /** Id of the player driven by this client's keyboard and mouse. */
  localPlayerId: number;
  /**
   * Consume `elapsedMs` of real time as fixed ticks (capped per call), feeding
   * the local player the live input unless `override` replaces parts of it,
   * then draw.
   */
  advance(elapsedMs: number, override?: InputOverride): void;
  /** Queue an input for any player, applied on the next tick only (dev / dummy control). */
  queue(playerId: number, input: PlayerInput): void;
  stop(): void;
}

export interface GameOptions {
  seed?: number;
  config?: GameConfig;
  /** Called once per rendered frame, after simulation and drawing. */
  onFrame?: (world: World, viewport: ArenaViewport) => void;
}

export function startGame(canvas: HTMLCanvasElement, opts: GameOptions = {}): Game {
  const config = opts.config ?? CONFIG;
  const world = createWorld({ seed: opts.seed, config });
  const localPlayerId = world.players[0].id;

  const renderer: Renderer = createRenderer(canvas);
  const input = createInput(window, canvas, renderer.viewport);

  const tickMs = config.sim.tickMs;
  const maxTicks = config.sim.maxTicksPerFrame;

  let running = true;
  let last = performance.now();
  let accumulator = 0;
  let queued: WorldInputs = {};
  const fx: TimedEvent[] = [];

  function advance(elapsedMs: number, override: InputOverride = {}): void {
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
      stepWorld(world, ran ? rest : first, tickMs);
      ran = true;
      accumulator -= tickMs;
      for (const e of world.events) fx.push({ ...e, atMs: world.timeMs });
    }
    if (!ran) {
      // Nothing advanced this frame (very high frame rate): keep the one-shot
      // presses so a click is never lost, but let movement/aim refresh live.
      queued = first;
      queued[localPlayerId] = { move: { x: 0, y: 0 }, skills: first[localPlayerId]?.skills };
    }

    while (fx.length > 0 && fx[0].atMs < world.timeMs - FX_LINGER_MS) fx.shift();
    renderer.draw(world, fx);
    opts.onFrame?.(world, renderer.viewport);
  }

  function frame(now: number): void {
    if (!running) return;
    advance(now - last);
    last = now;
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  return {
    world,
    viewport: renderer.viewport,
    localPlayerId,
    advance,
    queue(playerId: number, playerInput: PlayerInput): void {
      const prev = queued[playerId];
      queued[playerId] = prev
        ? { ...prev, ...playerInput, skills: { ...(prev.skills ?? {}), ...(playerInput.skills ?? {}) } }
        : playerInput;
    },
    stop(): void {
      running = false;
      input.stop();
      renderer.stop();
    },
  };
}
