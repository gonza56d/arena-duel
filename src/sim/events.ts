/**
 * Things that happened during one simulation tick, for the renderer / HUD.
 * `stepWorld` clears the list at the start of every tick; the client collects
 * what it needs to show (hit flashes, bullet impacts) between frames.
 */
import type { Vec2 } from "./geometry";
import type { SkillId } from "./skills/stats";

export type WorldEvent =
  | {
      type: "hit";
      skill: SkillId;
      attackerId: number;
      targetId: number;
      /** Damage actually applied (0 when fully blocked). */
      damage: number;
      blocked: boolean;
      /** Where the hit landed (target centre). */
      pos: Vec2;
    }
  | {
      type: "bulletStop";
      ownerId: number;
      reason: "edge" | "obstacle" | "player" | "range";
      pos: Vec2;
    }
  | { type: "skill"; skill: SkillId; playerId: number };
