/**
 * Entry point. Validates the tuning config, runs the device gate, then either
 * shows the block screen or starts the game. Re-evaluates the gate on resize so
 * the game appears/disappears as the window crosses the supported-size
 * threshold.
 */
import "./style.css";
import { ARENA_SIZE, type ArenaViewport } from "./arena";
import { CONFIG, validateConfig } from "./config";
import { check } from "./deviceGate";
import { startGame, type Game } from "./game";
import { isDead } from "./sim/player";
import type { SkillTriggers } from "./sim/skills";
import { SKILL_IDS, type SkillId } from "./sim/skills/stats";
import { damagePlayer, type World } from "./sim/world";

validateConfig(CONFIG);

const app = document.getElementById("app") as HTMLElement;
const blockScreen = document.getElementById("block-screen") as HTMLElement;
const blockMessage = document.getElementById("block-message") as HTMLElement;
const canvas = document.getElementById("arena") as HTMLCanvasElement;

const scaleInfo = document.getElementById("scale-info");
const coordsInfo = document.getElementById("coords");
const hud = document.getElementById("hud");
const skillRows = new Map<SkillId, { li: HTMLElement; cd: HTMLElement }>();
for (const id of SKILL_IDS) {
  const li = document.querySelector<HTMLElement>(`#skill-list li[data-skill="${id}"]`);
  const cd = li?.querySelector<HTMLElement>(".cd");
  if (li && cd) skillRows.set(id, { li, cd });
}

let game: Game | null = null;

function updateHud(world: World): void {
  if (!hud || !game) return;
  const me = world.players.find((p) => p.id === game!.localPlayerId);
  if (!me) return;
  if (isDead(me)) {
    hud.textContent = `HP ${me.hp}/${CONFIG.player.maxHp} · DEAD`;
  } else {
    const healIn =
      me.hp < CONFIG.player.maxHp ? ` · heal in ${((CONFIG.player.healIntervalMs - me.healTimerMs) / 1000).toFixed(1)}s` : "";
    const slowed = me.slow ? ` · SLOWED ${(me.slow.remainingMs / 1000).toFixed(1)}s` : "";
    hud.textContent = `HP ${me.hp}/${CONFIG.player.maxHp}${healIn}${slowed}`;
  }

  for (const [id, row] of skillRows) {
    const left = me.cooldowns[id];
    row.cd.textContent = left > 0 ? `${(left / 1000).toFixed(1)}s` : "ready";
    row.li.classList.toggle("cooling", left > 0);
    row.li.classList.toggle("active", me[id] !== null);
  }
}

function onFrame(world: World, vp: ArenaViewport): void {
  updateHud(world);
  if (scaleInfo) {
    scaleInfo.textContent = `scale ${vp.scale.toFixed(3)} px/unit · arena ${ARENA_SIZE}×${ARENA_SIZE} → ${Math.round(
      vp.drawnSize,
    )}px`;
  }
}

function showGame(): void {
  blockScreen.hidden = true;
  app.hidden = false;
  if (!game) {
    game = startGame(canvas, { onFrame });
    exposeDebug(game);
  }
}

function showBlock(reason: string): void {
  if (game) {
    game.stop();
    game = null;
  }
  app.hidden = true;
  blockScreen.hidden = false;
  blockMessage.textContent = reason;
}

function evaluate(): void {
  const result = check();
  if (result.ok) showGame();
  else showBlock(result.reason);
}

/**
 * Dev-only tuning handle (browser console). Never shipped in builds.
 *  - `arenaDebug.damage(3)` hurts the local player so HP/heal/death can be watched.
 *  - `arenaDebug.step(1000, { x: 1, y: 0 }, aim?)` advances exactly 1 s of
 *    simulated time moving right (aiming at `aim` if given), independent of
 *    frame rate or tab visibility.
 *  - `arenaDebug.act({ dash: true }, aim?, move?)` presses skills for the local
 *    player on the next tick and advances one tick.
 *  - `arenaDebug.rival({ shield: true }, aim?)` queues skills for the dummy
 *    rival (player 1) so blocking and hits can be exercised.
 */
function exposeDebug(g: Game): void {
  if (!import.meta.env.DEV) return;
  const chunkMs = CONFIG.sim.tickMs * CONFIG.sim.maxTicksPerFrame;
  const zero = { x: 0, y: 0 };
  (window as unknown as { arenaDebug: unknown }).arenaDebug = {
    config: CONFIG,
    world: g.world,
    damage: (amount = 1, playerId = g.localPlayerId) => damagePlayer(g.world, playerId, amount),
    step: (ms: number, move = zero, aim?: { x: number; y: number }) => {
      for (let left = ms; left > 0; left -= chunkMs) g.advance(Math.min(left, chunkMs), { move, aim });
      return g.world.players.find((p) => p.id === g.localPlayerId)?.pos;
    },
    act: (skills: SkillTriggers, aim?: { x: number; y: number }, move = zero) => {
      g.advance(CONFIG.sim.tickMs, { move, aim, skills });
      return g.world.players.find((p) => p.id === g.localPlayerId);
    },
    rival: (skills: SkillTriggers, aim?: { x: number; y: number }, move = zero, playerId = 1) => {
      g.queue(playerId, { move, aim, skills });
      return g.world.players.find((p) => p.id === playerId);
    },
  };
}

// Report arena coordinates under the cursor — demonstrates screenToArena.
canvas.addEventListener("mousemove", (e) => {
  if (!game || !coordsInfo) return;
  const p = game.viewport.screenToArena(e.offsetX, e.offsetY);
  coordsInfo.textContent = game.viewport.contains(p.x, p.y)
    ? `arena ${p.x.toFixed(0)}, ${p.y.toFixed(0)}`
    : "arena — (outside)";
});

window.addEventListener("resize", evaluate);
evaluate();
