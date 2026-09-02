/**
 * Canvas renderer: sizes the canvas to a square that fits the stage, keeps it
 * crisp on HiDPI displays, and draws a {@link World} through the shared
 * {@link ArenaViewport} mapping. It owns no timing — the game loop calls
 * `draw(world)` once per frame.
 */
import { ARENA_SIZE, ArenaViewport } from "./arena";
import { isDead } from "./sim/player";
import type { World } from "./sim/world";

const GRID_STEP_UNITS = 300; // reference grid every 300 units (7 × 7 cells).

const COLORS = {
  arena: "#0b1a14",
  grid: "rgba(120, 200, 160, 0.15)",
  boundary: "rgba(226, 85, 78, 0.9)",
  obstacleFill: "#2a3341",
  obstacleEdge: "#3d4a5e",
  players: ["#e2554e", "#4e9de2", "#e2c34e", "#8ce24e"],
  dead: "rgba(140, 140, 140, 0.45)",
  facing: "rgba(255, 255, 255, 0.55)",
};

export interface Renderer {
  viewport: ArenaViewport;
  /** Draw one frame of the given world. */
  draw(world: World): void;
  stop(): void;
}

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  const stage = canvas.parentElement!;
  const viewport = new ArenaViewport();

  /**
   * Size the canvas: pick the largest square that fits the stage, set that as
   * the CSS size, and back it with a devicePixelRatio-scaled pixel buffer so
   * lines stay sharp. Then hand the CSS size to the viewport.
   */
  function layout(): void {
    const rect = stage.getBoundingClientRect();
    const cssSize = Math.max(0, Math.floor(Math.min(rect.width, rect.height)));

    canvas.style.width = `${cssSize}px`;
    canvas.style.height = `${cssSize}px`;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(cssSize * dpr);
    canvas.height = Math.round(cssSize * dpr);
    // Draw in CSS pixels; the DPR scale maps them to the backing buffer.
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);

    viewport.resize(cssSize, cssSize);
  }

  function drawArena(): void {
    const topLeft = viewport.arenaToScreen(0, 0);
    const size = viewport.drawnSize;

    ctx!.fillStyle = COLORS.arena;
    ctx!.fillRect(topLeft.x, topLeft.y, size, size);

    ctx!.lineWidth = 1;
    ctx!.strokeStyle = COLORS.grid;
    ctx!.beginPath();
    for (let u = 0; u <= ARENA_SIZE; u += GRID_STEP_UNITS) {
      const v = viewport.arenaToScreen(u, u);
      ctx!.moveTo(v.x, topLeft.y);
      ctx!.lineTo(v.x, topLeft.y + size);
      ctx!.moveTo(topLeft.x, v.y);
      ctx!.lineTo(topLeft.x + size, v.y);
    }
    ctx!.stroke();
  }

  function drawObstacles(world: World): void {
    ctx!.fillStyle = COLORS.obstacleFill;
    ctx!.strokeStyle = COLORS.obstacleEdge;
    ctx!.lineWidth = 1;
    for (const o of world.obstacles) {
      const p = viewport.arenaToScreen(o.x, o.y);
      const w = viewport.unitsToPixels(o.w);
      const h = viewport.unitsToPixels(o.h);
      ctx!.fillRect(p.x, p.y, w, h);
      ctx!.strokeRect(p.x, p.y, w, h);
    }
  }

  function drawPlayers(world: World): void {
    for (const player of world.players) {
      const c = viewport.arenaToScreen(player.pos.x, player.pos.y);
      const r = viewport.unitsToPixels(player.radius);
      const dead = isDead(player);

      ctx!.fillStyle = dead ? COLORS.dead : COLORS.players[player.id % COLORS.players.length];
      ctx!.beginPath();
      ctx!.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx!.fill();

      if (dead) continue;
      // Facing tick: shows the remembered movement direction (Dash will use it).
      ctx!.strokeStyle = COLORS.facing;
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(c.x, c.y);
      ctx!.lineTo(c.x + player.lastMoveDir.x * r, c.y + player.lastMoveDir.y * r);
      ctx!.stroke();
    }
  }

  function drawBoundary(): void {
    const topLeft = viewport.arenaToScreen(0, 0);
    const size = viewport.drawnSize;
    ctx!.lineWidth = 2;
    ctx!.strokeStyle = COLORS.boundary;
    ctx!.strokeRect(topLeft.x, topLeft.y, size, size);
  }

  const observer = new ResizeObserver(layout);
  observer.observe(stage);
  window.addEventListener("resize", layout);
  layout();

  return {
    viewport,
    draw(world: World): void {
      ctx!.clearRect(0, 0, viewport.canvasCssWidth, viewport.canvasCssHeight);
      drawArena();
      drawObstacles(world);
      drawPlayers(world);
      drawBoundary();
    },
    stop(): void {
      observer.disconnect();
      window.removeEventListener("resize", layout);
    },
  };
}
