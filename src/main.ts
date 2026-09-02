/**
 * Entry point. Validates the tuning config, runs the device gate, then either
 * shows the block screen or starts the game. Re-evaluates the gate on resize so
 * the game appears/disappears as the window crosses the supported-size
 * threshold.
 */
import "./style.css";
import { ARENA_SIZE, type ArenaViewport } from "./arena";
import { CONFIG, leveledStatIds, validateConfig, type StatId } from "./config";
import { check } from "./deviceGate";
import { startGame, type Game } from "./game";
import { loadoutSpend, statValue, type Loadout } from "./sim/loadout";
import type { Match } from "./sim/match";
import { isDead } from "./sim/player";
import { damagePlayer, type World } from "./sim/world";

validateConfig(CONFIG);

const app = document.getElementById("app") as HTMLElement;
const blockScreen = document.getElementById("block-screen") as HTMLElement;
const blockMessage = document.getElementById("block-message") as HTMLElement;
const canvas = document.getElementById("arena") as HTMLCanvasElement;

const scaleInfo = document.getElementById("scale-info");
const coordsInfo = document.getElementById("coords");
const hud = document.getElementById("hud");
const roundInfo = document.getElementById("round-info");
const buildLocal = document.getElementById("build-local");
const buildRival = document.getElementById("build-rival");

let game: Game | null = null;
/** The match whose builds are currently shown in the sidebar. */
let shownMatch: Match | null = null;

/** Display names for skills and their leveled stats. */
const SKILL_NAMES: Record<string, string> = { dash: "Dash", slash: "Slash", bash: "Bash", shot: "Shot", shield: "Shield" };
const STAT_NAMES: Record<string, string> = { cooldownMs: "cooldown", areaDeg: "area" };

/**
 * List one build as "Skill — stat L· stat L" lines, one per skill in config
 * order; skills with no leveled stat (Bash) read "fixed". Each level carries
 * the config value it selects as a tooltip.
 */
function renderBuild(list: HTMLElement, loadout: Loadout): void {
  list.replaceChildren();
  for (const skill of Object.keys(CONFIG.skills)) {
    const ids = leveledStatIds(CONFIG).filter((id) => id.startsWith(`${skill}.`));
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.className = "skill-name";
    name.textContent = SKILL_NAMES[skill] ?? skill;
    const levels = document.createElement("span");
    levels.className = "skill-levels";
    if (ids.length === 0) {
      levels.textContent = "fixed";
    } else {
      for (const id of ids) {
        const stat = id.slice(skill.length + 1);
        const span = document.createElement("span");
        span.textContent = `${STAT_NAMES[stat] ?? stat} ${loadout[id as StatId]}`;
        span.title = `${id} level ${loadout[id as StatId]} → ${statValue(loadout, id as StatId, CONFIG)}`;
        levels.append(span);
      }
    }
    li.append(name, levels);
    list.append(li);
  }
}

function renderMatch(m: Match): void {
  if (buildLocal) renderBuild(buildLocal, m.loadouts[0]);
  if (buildRival) renderBuild(buildRival, m.loadouts[1]);
  const title = document.getElementById("build-title");
  if (title) title.textContent = `Your build · ${loadoutSpend(m.loadouts[0])}/${CONFIG.build.points} pts`;
}

function updateHud(world: World): void {
  if (!hud || !game) return;
  const me = world.players.find((p) => p.id === game!.localPlayerId);
  if (!me) return;
  if (isDead(me)) {
    hud.textContent = `HP ${me.hp}/${CONFIG.player.maxHp} · DEAD`;
    return;
  }
  const healIn = me.hp < CONFIG.player.maxHp ? ` · heal in ${((CONFIG.player.healIntervalMs - me.healTimerMs) / 1000).toFixed(1)}s` : "";
  hud.textContent = `HP ${me.hp}/${CONFIG.player.maxHp}${healIn}`;
}

function onFrame(world: World, vp: ArenaViewport): void {
  updateHud(world);
  if (game) {
    const m = game.match;
    if (roundInfo) roundInfo.textContent = `Best of ${m.bestOf} · Round ${m.round}`;
    if (m !== shownMatch) {
      renderMatch(m);
      shownMatch = m;
    }
  }
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
 *  - `arenaDebug.step(1000, { x: 1, y: 0 })` advances exactly 1 s of simulated
 *    time moving right, independent of frame rate or tab visibility.
 *  - `arenaDebug.loadouts` are the current game's builds; `nextRound()` keeps
 *    them, `newGame(seed?)` rerolls them.
 */
function exposeDebug(g: Game): void {
  if (!import.meta.env.DEV) return;
  const chunkMs = CONFIG.sim.tickMs * CONFIG.sim.maxTicksPerFrame;
  (window as unknown as { arenaDebug: unknown }).arenaDebug = {
    config: CONFIG,
    get match() {
      return g.match;
    },
    get world() {
      return g.world;
    },
    get loadouts() {
      return g.match.loadouts;
    },
    damage: (amount = 1, playerId = g.localPlayerId) => damagePlayer(g.world, playerId, amount),
    step: (ms: number, move = { x: 0, y: 0 }) => {
      for (let left = ms; left > 0; left -= chunkMs) g.advance(Math.min(left, chunkMs), move);
      return g.world.players.find((p) => p.id === g.localPlayerId)?.pos;
    },
    nextRound: () => {
      g.nextRound();
      g.advance(0);
      return g.match.round;
    },
    newGame: (seed?: number) => {
      g.newGame(seed);
      g.advance(0);
      return g.match.loadouts;
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
