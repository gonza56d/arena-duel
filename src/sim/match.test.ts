import { describe, expect, it } from "vitest";
import { CONFIG, type GameConfig } from "../config";
import { validateLoadout } from "./loadout";
import { advanceRound, concludeRound, createMatch, roundOutcome, roundsToWin, startNextRound, type Match } from "./match";
import { damagePlayer } from "./world";

/** Kill player `loserId` in the current round, then score it. */
function playRound(m: Match, loserId: number): void {
  damagePlayer(m.world, loserId, CONFIG.player.maxHp);
  const outcome = roundOutcome(m.world);
  expect(outcome).not.toBeNull();
  concludeRound(m, outcome!.winnerId);
}

/** Drive a whole match where player `winnerId` wins every round it needs to. */
function runMatch(m: Match, winnerId: number): void {
  const loserId = winnerId === 0 ? 1 : 0;
  while (m.phase !== "matchOver") {
    if (m.phase === "roundOver") advanceRound(m);
    playRound(m, loserId);
  }
}

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

describe("the match plays best-of-N to a winner (acceptance 2)", () => {
  it("needs a majority of rounds to win", () => {
    expect(roundsToWin(3)).toBe(2);
    expect(roundsToWin(5)).toBe(3);
    expect(roundsToWin(7)).toBe(4);
    expect(roundsToWin(10)).toBe(6);
  });

  it("reports no outcome until a player is dead, then the survivor", () => {
    const m = createMatch({ seed: 2, bestOf: 3 });
    expect(roundOutcome(m.world)).toBeNull();
    damagePlayer(m.world, 1, CONFIG.player.maxHp);
    expect(roundOutcome(m.world)).toEqual({ winnerId: 0 });
  });

  it.each(CONFIG.rounds.bestOfOptions)("declares the player the winner of a best-of-%i they sweep", (bestOf: number) => {
    const m = createMatch({ seed: 4, bestOf });
    runMatch(m, 0);
    expect(m.phase).toBe("matchOver");
    expect(m.matchWinnerId).toBe(0);
    expect(m.roundsWon[0]).toBe(roundsToWin(bestOf));
    // The series stops the instant it is decided — no wasted rounds.
    expect(m.round).toBe(roundsToWin(bestOf));
  });

  it("declares the NPC the winner when it sweeps", () => {
    const m = createMatch({ seed: 5, bestOf: 5 });
    runMatch(m, 1);
    expect(m.matchWinnerId).toBe(1);
    expect(m.roundsWon).toEqual([0, 3]);
  });

  it("goes the full distance and wins by count when rounds are split", () => {
    const m = createMatch({ seed: 6, bestOf: 5 });
    // 0,1,0,1 then a decider — player 0 takes rounds 1,3,5.
    playRound(m, 1); // p0 wins r1
    advanceRound(m);
    playRound(m, 0); // p1 wins r2
    advanceRound(m);
    playRound(m, 1); // p0 wins r3
    advanceRound(m);
    playRound(m, 0); // p1 wins r4  -> 2-2
    expect(m.phase).toBe("roundOver");
    advanceRound(m);
    playRound(m, 1); // p0 wins r5  -> 3-2
    expect(m.phase).toBe("matchOver");
    expect(m.matchWinnerId).toBe(0);
    expect(m.roundsWon).toEqual([3, 2]);
  });

  it("a drawn round scores nobody and can end an even series level", () => {
    const m = createMatch({ seed: 7, bestOf: 10 });
    for (let r = 1; r <= 10; r++) {
      // Both players die in the same round -> draw, no points.
      damagePlayer(m.world, 0, CONFIG.player.maxHp);
      damagePlayer(m.world, 1, CONFIG.player.maxHp);
      expect(roundOutcome(m.world)).toEqual({ winnerId: null });
      concludeRound(m, null);
      if (m.phase === "roundOver") advanceRound(m);
    }
    expect(m.phase).toBe("matchOver");
    expect(m.roundsWon).toEqual([0, 0]);
    expect(m.matchWinnerId).toBeNull(); // level series has no winner
  });

  it("guards the phase transitions", () => {
    const m = createMatch({ seed: 8, bestOf: 3 });
    expect(() => advanceRound(m)).toThrow(/Cannot advance a round while playing/);
    playRound(m, 1);
    expect(() => concludeRound(m, 0)).toThrow(/Cannot conclude a round while roundOver/);
  });
});
