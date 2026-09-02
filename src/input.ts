/**
 * Local player input: keyboard movement, pointer aim and skill triggers.
 *
 *  - Movement: WASD / arrows, held keys → raw direction vector (the simulation
 *    normalises it). Opposite keys cancel out.
 *  - Aim: the pointer's position converted to arena units through the shared
 *    viewport (tracked on the whole window so aiming just off the canvas works).
 *  - Skills: edge-triggered. A key/button press queues a one-shot trigger that
 *    the game loop consumes on its next tick; holding a key does not repeat.
 *      Dash  left Shift          Shot   Alt or ⌘ (Meta)
 *      Slash left / right click  Shield Space
 *      Bash  E (the design doc leaves this key open; Ctrl was avoided because
 *            Ctrl+W/S/A/D fire browser shortcuts mid-fight)
 *
 * Keys are released on window blur so a player never keeps running after
 * alt-tabbing. Bindings are UI, not gameplay, so they live here, not in CONFIG.
 */
import type { ArenaViewport } from "./arena";
import type { Vec2 } from "./sim/geometry";
import type { SkillTriggers } from "./sim/skills";

const KEY_TO_AXIS: Record<string, Vec2> = {
  KeyW: { x: 0, y: -1 },
  ArrowUp: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

export const SKILL_KEYS: Record<string, keyof SkillTriggers> = {
  ShiftLeft: "dash",
  Space: "shield",
  AltLeft: "shot",
  AltRight: "shot",
  MetaLeft: "shot",
  MetaRight: "shot",
  KeyE: "bash",
};

/** `MouseEvent.button` → trigger. */
export const MOUSE_BUTTONS: Record<number, keyof SkillTriggers> = {
  0: "slashPrimary",
  2: "slashSecondary",
};

/** Human-readable key hints for the HUD, per skill. */
export const KEY_HINTS: Record<"dash" | "slash" | "shot" | "shield" | "bash", string> = {
  dash: "L-Shift",
  slash: "L / R click",
  shot: "Alt / ⌘",
  shield: "Space",
  bash: "E",
};

export interface PlayerInputSource {
  /** Current movement intent; zero when no movement key is held. */
  direction(): Vec2;
  /** Pointer position in arena units, or null before the pointer was seen. */
  aim(): Vec2 | null;
  /** Skills pressed since the last call. Clears them. */
  consumeTriggers(): SkillTriggers;
  stop(): void;
}

export function createInput(target: Window, canvas: HTMLCanvasElement, viewport: ArenaViewport): PlayerInputSource {
  const held = new Set<string>();
  let pending: SkillTriggers = {};
  let pointer: Vec2 | null = null;

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.code in KEY_TO_AXIS) {
      held.add(e.code);
      e.preventDefault(); // arrows would otherwise scroll the page
      return;
    }
    const skill = SKILL_KEYS[e.code];
    if (!skill) return;
    if (!e.repeat) pending[skill] = true;
    e.preventDefault(); // Space scrolls; Alt focuses the menu bar in some browsers
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    held.delete(e.code);
  };
  const onBlur = (): void => held.clear();

  const onMouseMove = (e: MouseEvent): void => {
    const rect = canvas.getBoundingClientRect();
    pointer = viewport.screenToArena(e.clientX - rect.left, e.clientY - rect.top);
  };
  const onMouseDown = (e: MouseEvent): void => {
    const skill = MOUSE_BUTTONS[e.button];
    if (!skill) return;
    onMouseMove(e); // make sure the aim matches where the click landed
    pending[skill] = true;
    e.preventDefault();
  };
  const onContextMenu = (e: Event): void => e.preventDefault();

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);
  target.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mousedown", onMouseDown);
  canvas.addEventListener("contextmenu", onContextMenu);

  return {
    direction(): Vec2 {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const axis = KEY_TO_AXIS[code];
        x += axis.x;
        y += axis.y;
      }
      return { x: Math.sign(x), y: Math.sign(y) };
    },
    aim(): Vec2 | null {
      return pointer;
    },
    consumeTriggers(): SkillTriggers {
      const out = pending;
      pending = {};
      return out;
    },
    stop(): void {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
      target.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("contextmenu", onContextMenu);
      held.clear();
      pending = {};
    },
  };
}
