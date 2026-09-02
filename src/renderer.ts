/**
 * Canvas bootstrap: sizes the canvas to a square that fits the stage, keeps it
 * crisp on HiDPI displays, drives a requestAnimationFrame loop, and draws the
 * arena using the shared {@link ArenaViewport} mapping.
 *
 * This is the render shell only — no gameplay. Later systems draw on top by
 * converting their unit-space state through the same viewport.
 */
import { ARENA_SIZE, ArenaViewport } from "./arena";

const GRID_STEP_UNITS = 300; // reference grid every 300 units (7 × 7 cells).

export interface Renderer {
  viewport: ArenaViewport;
  stop(): void;
}

export function startRenderer(
  canvas: HTMLCanvasElement,
  onFrame?: (viewport: ArenaViewport) => void,
): Renderer {
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

  function draw(): void {
    const w = viewport.canvasCssWidth;
    const h = viewport.canvasCssHeight;

    ctx!.clearRect(0, 0, w, h);

    // Arena background.
    const topLeft = viewport.arenaToScreen(0, 0);
    const size = viewport.drawnSize;
    ctx!.fillStyle = "#0b1a14";
    ctx!.fillRect(topLeft.x, topLeft.y, size, size);

    // Reference grid (proves the unit → pixel mapping and rescaling).
    ctx!.lineWidth = 1;
    ctx!.strokeStyle = "rgba(120, 200, 160, 0.15)";
    ctx!.beginPath();
    for (let u = 0; u <= ARENA_SIZE; u += GRID_STEP_UNITS) {
      const v = viewport.arenaToScreen(u, u);
      ctx!.moveTo(v.x, topLeft.y);
      ctx!.lineTo(v.x, topLeft.y + size);
      ctx!.moveTo(topLeft.x, v.y);
      ctx!.lineTo(topLeft.x + size, v.y);
    }
    ctx!.stroke();

    // Arena boundary.
    ctx!.lineWidth = 2;
    ctx!.strokeStyle = "rgba(226, 85, 78, 0.9)";
    ctx!.strokeRect(topLeft.x, topLeft.y, size, size);

    // Demo marker: a player-sized circle (25-unit radius) at the arena centre,
    // placed purely via arenaToScreen / unitsToPixels to confirm the mapping.
    const center = viewport.arenaToScreen(ARENA_SIZE / 2, ARENA_SIZE / 2);
    ctx!.fillStyle = "#e2554e";
    ctx!.beginPath();
    ctx!.arc(center.x, center.y, viewport.unitsToPixels(25), 0, Math.PI * 2);
    ctx!.fill();
  }

  let running = true;
  function frame(): void {
    if (!running) return;
    onFrame?.(viewport);
    draw();
    requestAnimationFrame(frame);
  }

  const observer = new ResizeObserver(layout);
  observer.observe(stage);
  window.addEventListener("resize", layout);

  layout();
  requestAnimationFrame(frame);

  return {
    viewport,
    stop(): void {
      running = false;
      observer.disconnect();
      window.removeEventListener("resize", layout);
    },
  };
}
