/**
 * Local player input: keyboard movement, pointer aim and skill triggers.
 *
 *  - Movement: WASD / arrows, held keys → raw direction vector (the simulation
 *    normalises it). Opposite keys cancel out.
 *  - Aim: the pointer's position converted to arena units through the shared
 *    viewport. Tracked on the whole window: during a fight the mouse belongs to
 *    the game wherever it is on the page, so an aim or click that overshoots the
 *    arena edge still counts (the direction it resolves to is unclamped — it
 *    points where the cursor is). The aim is dropped only when the pointer
 *    leaves the page, and restored by the next move back in.
 *  - Ownership: `capturesMouse()` gates every mouse handler. While it is true
 *    gameplay owns the mouse (clicks fire skills, the context menu is
 *    suppressed); while false the handlers do nothing at all, so a menu or
 *    other UI can use the mouse natively without gameplay stealing its clicks.
 *  - Skills: edge-triggered. A key/button press queues a one-shot trigger that
 *    the game loop consumes on its next tick; holding a key does not repeat.
 *      Dash  left Shift          Shot   C
 *      Slash left / right click  Shield Space
 *      Bash  E
 *    Skill keys are plain letters/Space/Shift on purpose: the design doc named
 *    Ctrl and ⌘ (Alt / Meta), but Ctrl+W/S/A/D and ⌘+W fire browser shortcuts
 *    (close tab, save, bookmark) mid-fight, and Alt focuses the menu bar in
 *    some browsers — so Shot moved to C and Bash to E.
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
  KeyC: "shot",
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
  shot: "C",
  shield: "Space",
  bash: "E",
};

export interface InputOptions {
  /**
   * True while gameplay owns the mouse (a fight is on). When false, mouse
   * events are left to the page untouched. Defaults to always-on.
   */
  capturesMouse?: () => boolean;
}

export interface PlayerInputSource {
  /** Current movement intent; zero when no movement key is held. */
  direction(): Vec2;
  /**
   * Pointer position in arena units (may lie outside the arena square), or
   * null before the pointer was seen / while it is outside the page.
   */
  aim(): Vec2 | null;
  /** Skills pressed since the last call. Clears them. */
  consumeTriggers(): SkillTriggers;
  stop(): void;
}

export function createInput(
  target: Window,
  canvas: HTMLCanvasElement,
  viewport: ArenaViewport,
  opts: InputOptions = {},
): PlayerInputSource {
  const capturesMouse = opts.capturesMouse ?? (() => true);
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
    e.preventDefault(); // Space would scroll the page
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    held.delete(e.code);
  };
  const onBlur = (): void => held.clear();

  /** Arena point under a mouse event, relative to the canvas wherever the event landed. */
  const pointAt = (e: MouseEvent): Vec2 => {
    const rect = canvas.getBoundingClientRect();
    return viewport.screenToArena(e.clientX - rect.left, e.clientY - rect.top);
  };
  const onMouseMove = (e: MouseEvent): void => {
    if (!capturesMouse()) return;
    pointer = pointAt(e);
  };
  const onMouseDown = (e: MouseEvent): void => {
    if (!capturesMouse()) return;
    const skill = MOUSE_BUTTONS[e.button];
    if (!skill) return;
    pointer = pointAt(e); // make sure the aim matches where the click landed
    pending[skill] = true;
    e.preventDefault(); // no text selection / focus change on the UI around the arena
  };
  const onContextMenu = (e: Event): void => {
    if (capturesMouse()) e.preventDefault();
  };
  /** `mouseout` with no `relatedTarget` means the pointer left the page itself. */
  const onMouseOut = (e: MouseEvent): void => {
    if (e.relatedTarget === null) pointer = null;
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);
  target.addEventListener("mousemove", onMouseMove);
  target.addEventListener("mousedown", onMouseDown);
  target.addEventListener("contextmenu", onContextMenu);
  target.addEventListener("mouseout", onMouseOut);

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
      target.removeEventListener("mousedown", onMouseDown);
      target.removeEventListener("contextmenu", onContextMenu);
      target.removeEventListener("mouseout", onMouseOut);
      held.clear();
      pending = {};
    },
  };
}
