import { describe, expect, it } from "vitest";
import { CONFIG, type GameConfig } from "../config";
import { validateLoadout } from "./loadout";
import { createMatch, startNextRound } from "./match";
import { damagePlayer } from "./world";

describe("createMatch", () => {
  it("rolls one valid loadout per player and starts round 1 with them", () => {
    const m = createMatch({ seed: 1 });
    expect(m.round).toBe(1);
    expect(m.loadouts).toHaveLength(2);
    for (const l of m.loadouts) expect(validateLoadout(l, m.config).ok).toBe(true);
    expect(m.world.players[0].loadout).toBe(m.loadouts[0]);
    expect(m.world.players[1].loadout).toBe(m.loadouts[1]);
  });

  it("rolls the player's and the NPC's loadouts independently", () => {
    let differ = 0;
    for (let seed = 0; seed < 30; seed++) {
      const [player, npc] = createMatch({ seed }).loadouts;
      if (JSON.stringify(player) !== JSON.stringify(npc)) differ++;
    }
    expect(differ).toBeGreaterThan(25);
  });

  it("is deterministic per seed", () => {
    const a = createMatch({ seed: 7 });
    const b = createMatch({ seed: 7 });
    expect(a.loadouts).toEqual(b.loadouts);
    expect(a.world.obstacles).toEqual(b.world.obstacles);
  });

  it("defaults to the first best-of option and rejects formats not offered", () => {
    expect(createMatch({ seed: 1 }).bestOf).toBe(CONFIG.rounds.bestOfOptions[0]);
    expect(createMatch({ seed: 1, bestOf: 7 }).bestOf).toBe(7);
    expect(() => createMatch({ seed: 1, bestOf: 4 })).toThrow(/Best of 4 is not offered/);
  });

  it("rejects an invalid config up front", () => {
    const bad: GameConfig = { ...CONFIG, build: { points: 3 } };
    expect(() => createMatch({ seed: 1, config: bad })).toThrow(/Invalid game config/);
  });
});

describe("rounds within a game keep the same loadout; a new game rerolls (acceptance 2)", () => {
  it("startNextRound gives a fresh world with the very same loadouts", () => {
    const m = createMatch({ seed: 3, bestOf: 5 });
    const first = m.world;
    const loadouts = m.loadouts.map((l) => ({ ...l }));
    damagePlayer(first, 0, 4);

    const second = startNextRound(m);
    expect(m.round).toBe(2);
    expect(m.world).toBe(second);
    expect(second).not.toBe(first);
    expect(second.players[0].hp).toBe(CONFIG.player.maxHp);
    // Same loadout objects and same contents, on the match and on the players.
    expect(m.loadouts).toEqual(loadouts);
    expect(second.players[0].loadout).toBe(m.loadouts[0]);
    expect(second.players[1].loadout).toBe(m.loadouts[1]);

    for (let r = 3; r <= 5; r++) {
      const w = startNextRound(m);
      expect(m.round).toBe(r);
      expect(w.players.map((p) => p.loadout)).toEqual(loadouts);
    }
  });

  it("gives each round its own obstacle layout, deterministically", () => {
    const a = createMatch({ seed: 11 });
    const round1 = a.world.obstacles;
    const round2 = startNextRound(a).obstacles;
    expect(round2).not.toEqual(round1);

    const b = createMatch({ seed: 11 });
    startNextRound(b);
    expect(b.world.obstacles).toEqual(round2);
  });

  it("a new match rerolls both loadouts", () => {
    const first = createMatch({ seed: 100 });
    let rerolled = 0;
    for (let seed = 101; seed < 111; seed++) {
      const next = createMatch({ seed });
      if (JSON.stringify(next.loadouts) !== JSON.stringify(first.loadouts)) rerolled++;
    }
    expect(rerolled).toBe(10);
  });

  it("does not run past the series length", () => {
    const m = createMatch({ seed: 1, bestOf: 3 });
    startNextRound(m);
    startNextRound(m);
    expect(m.round).toBe(3);
    expect(() => startNextRound(m)).toThrow(/Match is over: all 3 rounds/);
  });

  it("follows rounds.bestOfOptions from config", () => {
    const cfg: GameConfig = { ...CONFIG, rounds: { bestOfOptions: [1] } };
    const m = createMatch({ seed: 1, config: cfg });
    expect(m.bestOf).toBe(1);
    expect(() => startNextRound(m)).toThrow(/Match is over/);
  });
});
