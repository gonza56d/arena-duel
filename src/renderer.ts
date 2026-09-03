/**
 * Canvas renderer: sizes the canvas to a square that fits the stage, keeps it
 * crisp on HiDPI displays, and draws a {@link World} through the shared
 * {@link ArenaViewport} mapping. It owns no timing — the game loop calls
 * `draw(world, fx)` once per frame.
 *
 * Skill visuals read the simulation state directly (dash trail, blade angle,
 * shield arc, bullets) plus the recent world events (hit flashes, bullet
 * impacts, bash cones). Presentation-only constants (colours, flash duration)
 * live here; every gameplay number still comes from the world's config.
 *
 * Fog of war, when a `viewerId` is given, has two halves that must agree:
 *  - the fog *layer* shades every zone the viewer has no sight line to (the
 *    shadow wedges from `shadowPolygons`), so the boundary reads at a glance;
 *  - *occlusion* skips anything of a rival's the viewer cannot see — its body,
 *    indicators, floating HP bar and skill visuals follow the body's `canSee`,
 *    and free-flying effects (bullets, impacts, hit flashes) are tested at their
 *    own position, so a bullet is hidden inside the fog and appears as it flies
 *    into sight.
 * The viewer's own effects are always drawn.
 *
 * A rival's HP bar floats above its body and is drawn in the same pass as the
 * body, so it has no fog geometry of its own: it shows exactly when the body
 * does. The viewer reads its own HP on the HUD and gets no floating bar.
 */
import { ARENA_SIZE, ArenaViewport } from "./arena";
import type { WorldEvent } from "./sim/events";
import { angleOf, degToRad } from "./sim/geometry";
import { isDead, type PlayerState } from "./sim/player";
import { isShieldUp } from "./sim/skills/shield";
import { bladeAngle, swingProgress } from "./sim/skills/slash";
import { canSee, shadowPolygons, type VisionTarget } from "./sim/vision";
import type { World } from "./sim/world";

const GRID_STEP_UNITS = 300; // reference grid every 300 units (7 × 7 cells).

/** How long a one-off effect (hit flash, impact, bash cone) stays visible, in sim ms. */
export const FX_LINGER_MS = 350;

export type TimedEvent = WorldEvent & { atMs: number };

const COLORS = {
  arena: "#16332a", // lit floor — kept a shade brighter than before so the fog contrasts
  grid: "rgba(140, 220, 180, 0.2)",
  fog: "rgba(2, 5, 10, 0.72)", // painted over the floor wherever the viewer has no sight line
  boundary: "rgba(226, 85, 78, 0.9)",
  obstacleFill: "#2a3341",
  obstacleEdge: "#3d4a5e",
  players: ["#e2554e", "#4e9de2", "#e2c34e", "#8ce24e"],
  dead: "rgba(140, 140, 140, 0.45)",
  facing: "rgba(255, 255, 255, 0.35)",
  aim: "rgba(255, 255, 255, 0.8)",
  slow: "rgba(90, 160, 255, 0.9)",
  shield: "rgba(120, 220, 255, 0.85)",
  shieldFill: "rgba(120, 220, 255, 0.18)",
  blade: "rgba(255, 245, 200, 0.95)",
  swept: "rgba(255, 245, 200, 0.18)",
  windup: "rgba(255, 245, 200, 0.35)",
  bash: "rgba(255, 170, 60, 0.45)",
  bullet: "#ffe9a8",
  dash: "rgba(255, 255, 255, 0.25)",
  hit: "rgba(255, 80, 80, 0.9)",
  blocked: "rgba(120, 220, 255, 0.9)",
  impact: "rgba(255, 233, 168, 0.8)",
  hpFill: "#e2322a", // same reds as the HUD's health blocks (style.css --hp-full / --hp-empty)
  hpEmpty: "#4a1512",
  hpEdge: "rgba(0, 0, 0, 0.6)",
};

/**
 * Floating HP bar proportions, as multiples of the body radius so the bar
 * scales with the body through the viewport. `minHeightPx` keeps it legible on
 * small canvases, the way bullets keep a 2 px minimum.
 */
const HP_BAR = { widthRadii: 4, heightRadii: 0.5, gapRadii: 0.7, minHeightPx: 3 };

export interface HpBarLayout {
  /** Bar rectangle in canvas CSS px: the background / outline. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Filled share of the width, HP over max clamped to [0, 1]. */
  fraction: number;
}

/**
 * Where a body's HP bar goes: centred on the body, its bottom edge a fixed gap
 * above the top of the circle, everything converted through the viewport.
 * Pure so it can be unit-tested without a canvas.
 */
export function hpBarLayout(
  body: { pos: { x: number; y: number }; radius: number; hp: number },
  maxHp: number,
  viewport: ArenaViewport,
): HpBarLayout {
  const w = viewport.unitsToPixels(body.radius * HP_BAR.widthRadii);
  const h = Math.max(HP_BAR.minHeightPx, viewport.unitsToPixels(body.radius * HP_BAR.heightRadii));
  const anchor = viewport.arenaToScreen(body.pos.x, body.pos.y - body.radius * (1 + HP_BAR.gapRadii));
  return {
    x: anchor.x - w / 2,
    y: anchor.y - h,
    w,
    h,
    fraction: Math.min(1, Math.max(0, body.hp / maxHp)),
  };
}

export interface Renderer {
  viewport: ArenaViewport;
  /**
   * Draw one frame of the given world with the recent effects. When `viewerId`
   * is given, fog of war shades every zone that player has no sight line to and
   * hides rivals — and everything they do — while out of that player's sight.
   */
  draw(world: World, fx?: readonly TimedEvent[], viewerId?: number): void;
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

  const px = (units: number): number => viewport.unitsToPixels(units);
  const at = (x: number, y: number): { x: number; y: number } => viewport.arenaToScreen(x, y);

  function drawArena(): void {
    const topLeft = at(0, 0);
    const size = viewport.drawnSize;

    ctx!.fillStyle = COLORS.arena;
    ctx!.fillRect(topLeft.x, topLeft.y, size, size);

    ctx!.lineWidth = 1;
    ctx!.strokeStyle = COLORS.grid;
    ctx!.beginPath();
    for (let u = 0; u <= ARENA_SIZE; u += GRID_STEP_UNITS) {
      const v = at(u, u);
      ctx!.moveTo(v.x, topLeft.y);
      ctx!.lineTo(v.x, topLeft.y + size);
      ctx!.moveTo(topLeft.x, v.y);
      ctx!.lineTo(topLeft.x + size, v.y);
    }
    ctx!.stroke();
  }

  /**
   * Fog layer: shade every zone the viewer cannot see. All wedges go into one
   * path and one fill so overlapping shadows never darken twice. Drawn under
   * the obstacles, which therefore stay bright and readable as cover.
   */
  function drawFog(world: World, viewer: PlayerState): void {
    const wedges = shadowPolygons(viewer.pos, world.obstacles);
    if (wedges.length === 0) return;
    const topLeft = at(0, 0);
    const size = viewport.drawnSize;
    ctx!.save();
    ctx!.beginPath();
    ctx!.rect(topLeft.x, topLeft.y, size, size); // never shade the letterbox
    ctx!.clip();
    ctx!.beginPath();
    for (const poly of wedges) {
      const first = at(poly[0].x, poly[0].y);
      ctx!.moveTo(first.x, first.y);
      for (let i = 1; i < poly.length; i++) {
        const v = at(poly[i].x, poly[i].y);
        ctx!.lineTo(v.x, v.y);
      }
      ctx!.closePath();
    }
    ctx!.fillStyle = COLORS.fog;
    ctx!.fill("nonzero");
    ctx!.restore();
  }

  function drawObstacles(world: World): void {
    ctx!.fillStyle = COLORS.obstacleFill;
    ctx!.strokeStyle = COLORS.obstacleEdge;
    ctx!.lineWidth = 1;
    for (const o of world.obstacles) {
      const p = at(o.x, o.y);
      ctx!.fillRect(p.x, p.y, px(o.w), px(o.h));
      ctx!.strokeRect(p.x, p.y, px(o.w), px(o.h));
    }
  }

  /** Filled/stroked pie slice centred on `pos`, in arena units. */
  function sector(pos: { x: number; y: number }, fromRad: number, toRad: number, radius: number): void {
    const c = at(pos.x, pos.y);
    ctx!.beginPath();
    ctx!.moveTo(c.x, c.y);
    ctx!.arc(c.x, c.y, px(radius), Math.min(fromRad, toRad), Math.max(fromRad, toRad));
    ctx!.closePath();
  }

  function drawDashTrail(p: PlayerState): void {
    if (!p.dash) return;
    const a = at(p.dash.from.x, p.dash.from.y);
    const b = at(p.pos.x, p.pos.y);
    ctx!.strokeStyle = COLORS.dash;
    ctx!.lineWidth = px(p.radius * 2);
    ctx!.lineCap = "round";
    ctx!.beginPath();
    ctx!.moveTo(a.x, a.y);
    ctx!.lineTo(b.x, b.y);
    ctx!.stroke();
    ctx!.lineCap = "butt";
  }

  function drawSlash(p: PlayerState): void {
    const s = p.slash;
    if (!s) return;
    const progress = swingProgress(s, s.elapsedMs);
    if (s.elapsedMs < s.windupMs) {
      // Wind-up: show the cone about to be swept.
      sector(p.pos, s.fromRad, s.toRad, s.range);
      ctx!.strokeStyle = COLORS.windup;
      ctx!.lineWidth = 1;
      ctx!.stroke();
      return;
    }
    // Swing: fill what the blade has covered so far and draw the blade itself.
    const now = bladeAngle(s, progress);
    sector(p.pos, s.fromRad, now, s.range);
    ctx!.fillStyle = COLORS.swept;
    ctx!.fill();
    const c = at(p.pos.x, p.pos.y);
    ctx!.strokeStyle = COLORS.blade;
    ctx!.lineWidth = Math.max(1.5, px(s.halfWidth * 2));
    ctx!.beginPath();
    ctx!.moveTo(c.x, c.y);
    ctx!.lineTo(c.x + Math.cos(now) * px(s.range), c.y + Math.sin(now) * px(s.range));
    ctx!.stroke();
  }

  function drawShield(world: World, p: PlayerState): void {
    if (!isShieldUp(p)) return;
    const half = degToRad(world.config.skills.shield.coneDeg) / 2;
    const a = angleOf(p.aimDir);
    const c = at(p.pos.x, p.pos.y);
    ctx!.beginPath();
    ctx!.arc(c.x, c.y, px(p.radius) + 5, a - half, a + half);
    ctx!.strokeStyle = COLORS.shield;
    ctx!.lineWidth = 4;
    ctx!.stroke();
    sector(p.pos, a - half, a + half, p.radius + 5 / viewport.scale);
    ctx!.fillStyle = COLORS.shieldFill;
    ctx!.fill();
  }

  /**
   * Fog of war: whose eyes are we drawing through? `null` means no fog at all
   * (no `viewerId`, or one that is not in this world — e.g. a headless/debug
   * draw): everything is shown.
   */
  function viewerOf(world: World, viewerId?: number): PlayerState | null {
    if (viewerId === undefined) return null;
    return world.players.find((p) => p.id === viewerId) ?? null;
  }

  /** Is the circle `target` in `viewer`'s sight (or is there no fog)? */
  function inView(world: World, viewer: PlayerState | null, target: VisionTarget): boolean {
    return viewer === null || canSee(viewer.pos, target, world.obstacles);
  }

  /**
   * Is `player` drawn? A viewer always sees itself; a rival is hidden when every
   * sight line to its body is blocked by an obstacle. Everything anchored to a
   * player (indicators, HP bar, dash trail, slash, shield, bash cone) follows
   * this.
   */
  function playerInView(world: World, viewer: PlayerState | null, player: PlayerState): boolean {
    if (viewer === null || player.id === viewer.id) return true;
    return inView(world, viewer, { pos: player.pos, radius: player.radius });
  }

  /**
   * Floating HP bar over a rival. Only ever called for a player already in the
   * `visible` list, so it has no fog test of its own: drawn iff the body is.
   * The viewer reads its own HP on the HUD, so it gets none.
   */
  function drawHpBar(world: World, viewer: PlayerState | null, player: PlayerState): void {
    if (viewer && player.id === viewer.id) return;
    const bar = hpBarLayout(player, world.config.player.maxHp, viewport);
    ctx!.fillStyle = COLORS.hpEmpty;
    ctx!.fillRect(bar.x, bar.y, bar.w, bar.h);
    ctx!.fillStyle = COLORS.hpFill;
    ctx!.fillRect(bar.x, bar.y, bar.w * bar.fraction, bar.h);
    ctx!.strokeStyle = COLORS.hpEdge;
    ctx!.lineWidth = 1;
    ctx!.strokeRect(bar.x, bar.y, bar.w, bar.h);
  }

  function drawPlayers(world: World, viewer: PlayerState | null): void {
    const visible = world.players.filter((p) => playerInView(world, viewer, p));

    for (const player of visible) drawDashTrail(player);

    for (const player of visible) {
      const c = at(player.pos.x, player.pos.y);
      const r = px(player.radius);
      const dead = isDead(player);

      ctx!.fillStyle = dead ? COLORS.dead : COLORS.players[player.id % COLORS.players.length];
      ctx!.beginPath();
      ctx!.arc(c.x, c.y, r, 0, Math.PI * 2);
      ctx!.fill();

      if (dead) continue;

      if (player.slow) {
        ctx!.strokeStyle = COLORS.slow;
        ctx!.lineWidth = 2;
        ctx!.setLineDash([4, 4]);
        ctx!.beginPath();
        ctx!.arc(c.x, c.y, r + 2, 0, Math.PI * 2);
        ctx!.stroke();
        ctx!.setLineDash([]);
      }

      // Remembered movement direction (Dash uses it when idle).
      ctx!.strokeStyle = COLORS.facing;
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(c.x, c.y);
      ctx!.lineTo(c.x + player.lastMoveDir.x * r * 0.6, c.y + player.lastMoveDir.y * r * 0.6);
      ctx!.stroke();

      // Aim line towards the pointer.
      ctx!.strokeStyle = COLORS.aim;
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(c.x + player.aimDir.x * r * 0.5, c.y + player.aimDir.y * r * 0.5);
      ctx!.lineTo(c.x + player.aimDir.x * r * 1.5, c.y + player.aimDir.y * r * 1.5);
      ctx!.stroke();

      drawSlash(player);
      drawShield(world, player);
      drawHpBar(world, viewer, player);
    }
  }

  /** Bullets: the viewer's own always; a rival's only where it is in sight. */
  function drawProjectiles(world: World, viewer: PlayerState | null): void {
    ctx!.fillStyle = COLORS.bullet;
    for (const b of world.projectiles) {
      if (viewer && b.ownerId !== viewer.id && !inView(world, viewer, b)) continue;
      const c = at(b.pos.x, b.pos.y);
      ctx!.beginPath();
      ctx!.arc(c.x, c.y, Math.max(2, px(b.radius)), 0, Math.PI * 2);
      ctx!.fill();
    }
  }

  /**
   * One-off effects. The viewer's own (as attacker / shooter / caster) are
   * always shown; a rival's hit flashes and bullet impacts only where they land
   * in sight, and its bash cone only while the rival itself is in view.
   */
  function drawEffects(world: World, fx: readonly TimedEvent[], viewer: PlayerState | null): void {
    const bash = world.config.skills.bash;
    const pointRadius = world.config.player.radius; // generous: a flash the size of a body
    for (const e of fx) {
      const age = (world.timeMs - e.atMs) / FX_LINGER_MS; // 0 fresh → 1 gone
      const alpha = Math.max(0, 1 - age);
      ctx!.globalAlpha = alpha;
      switch (e.type) {
        case "hit": {
          if (viewer && e.attackerId !== viewer.id && !inView(world, viewer, { pos: e.pos, radius: pointRadius })) break;
          const c = at(e.pos.x, e.pos.y);
          ctx!.strokeStyle = e.blocked ? COLORS.blocked : COLORS.hit;
          ctx!.lineWidth = 3;
          ctx!.beginPath();
          ctx!.arc(c.x, c.y, px(world.config.player.radius) * (1.1 + age * 0.8), 0, Math.PI * 2);
          ctx!.stroke();
          break;
        }
        case "bulletStop": {
          if (viewer && e.ownerId !== viewer.id && !inView(world, viewer, { pos: e.pos, radius: pointRadius })) break;
          const c = at(e.pos.x, e.pos.y);
          ctx!.strokeStyle = COLORS.impact;
          ctx!.lineWidth = 2;
          ctx!.beginPath();
          ctx!.arc(c.x, c.y, 3 + age * 10, 0, Math.PI * 2);
          ctx!.stroke();
          break;
        }
        case "skill": {
          if (e.skill !== "bash") break;
          const p = world.players.find((q) => q.id === e.playerId);
          if (!p || !playerInView(world, viewer, p)) break;
          const a = angleOf(p.bash?.dir ?? p.aimDir);
          const half = degToRad(bash.coneDeg) / 2;
          sector(p.pos, a - half, a + half, bash.range);
          ctx!.fillStyle = COLORS.bash;
          ctx!.fill();
          break;
        }
      }
    }
    ctx!.globalAlpha = 1;
  }

  function drawBoundary(): void {
    const topLeft = at(0, 0);
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
    draw(world: World, fx: readonly TimedEvent[] = [], viewerId?: number): void {
      ctx!.clearRect(0, 0, viewport.canvasCssWidth, viewport.canvasCssHeight);
      const viewer = viewerOf(world, viewerId);
      drawArena();
      if (viewer) drawFog(world, viewer);
      drawObstacles(world);
      // Everything below is fog-occluded from the viewer's eyes: a rival and
      // all it does are hidden while out of sight; its bullets and impacts only
      // where they are in sight; the viewer's own effects always.
      drawPlayers(world, viewer);
      drawProjectiles(world, viewer);
      drawEffects(world, fx, viewer);
      drawBoundary();
    },
    stop(): void {
      observer.disconnect();
      window.removeEventListener("resize", layout);
    },
  };
}
