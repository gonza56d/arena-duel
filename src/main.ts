/**
 * Entry point. Runs the device gate, then either shows the block screen or
 * boots the canvas render shell. Re-evaluates the gate on resize so the game
 * appears/disappears as the window crosses the supported-size threshold.
 */
import "./style.css";
import { check } from "./deviceGate";
import { startRenderer, type Renderer } from "./renderer";
import { ARENA_SIZE, type ArenaViewport } from "./arena";

const app = document.getElementById("app") as HTMLElement;
const blockScreen = document.getElementById("block-screen") as HTMLElement;
const blockMessage = document.getElementById("block-message") as HTMLElement;
const canvas = document.getElementById("arena") as HTMLCanvasElement;

const scaleInfo = document.getElementById("scale-info");
const coordsInfo = document.getElementById("coords");

let renderer: Renderer | null = null;

/** Small HUD readout so the mapping/scale is visible while developing. */
function onFrame(vp: ArenaViewport): void {
  if (scaleInfo) {
    scaleInfo.textContent = `scale ${vp.scale.toFixed(3)} px/unit · arena ${ARENA_SIZE}×${ARENA_SIZE} → ${Math.round(
      vp.drawnSize,
    )}px`;
  }
}

function showGame(): void {
  blockScreen.hidden = true;
  app.hidden = false;
  if (!renderer) renderer = startRenderer(canvas, onFrame);
}

function showBlock(reason: string): void {
  if (renderer) {
    renderer.stop();
    renderer = null;
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

// Report arena coordinates under the cursor — demonstrates screenToArena.
canvas.addEventListener("mousemove", (e) => {
  if (!renderer || !coordsInfo) return;
  const p = renderer.viewport.screenToArena(e.offsetX, e.offsetY);
  coordsInfo.textContent = renderer.viewport.contains(p.x, p.y)
    ? `arena ${p.x.toFixed(0)}, ${p.y.toFixed(0)}`
    : "arena — (outside)";
});

window.addEventListener("resize", evaluate);
evaluate();
