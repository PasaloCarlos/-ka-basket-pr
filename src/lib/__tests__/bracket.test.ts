import { describe, it, expect } from "vitest";
import {
  nextPowerOfTwo,
  generateSingleElim,
  applyResult,
  roundLabel,
  type Seed,
} from "@/lib/bracket";

function seeds(n: number): Seed[] {
  return Array.from({ length: n }, (_, i) => ({
    teamId: `t${i + 1}`,
    teamName: `Equipo ${i + 1}`,
  }));
}

describe("nextPowerOfTwo", () => {
  it("rounds up to the next power of two", () => {
    expect(nextPowerOfTwo(2)).toBe(2);
    expect(nextPowerOfTwo(3)).toBe(4);
    expect(nextPowerOfTwo(5)).toBe(8);
    expect(nextPowerOfTwo(8)).toBe(8);
  });
});

describe("generateSingleElim", () => {
  it("throws with fewer than 2 seeds", () => {
    expect(() => generateSingleElim(seeds(1))).toThrow();
  });

  it("builds a single final for 2 teams, no byes", () => {
    const m = generateSingleElim(seeds(2));
    expect(m).toHaveLength(1);
    expect(m[0].round).toBe(1);
    expect(m[0].isBye).toBe(false);
    expect(m[0].nextRound).toBeNull();
  });

  it("builds 3 matches over 2 rounds for 4 teams, no byes", () => {
    const m = generateSingleElim(seeds(4));
    expect(m).toHaveLength(3);
    expect(m.filter((x) => x.round === 1)).toHaveLength(2);
    expect(m.filter((x) => x.round === 2)).toHaveLength(1);
    expect(m.some((x) => x.isBye)).toBe(false);
    for (const r1 of m.filter((x) => x.round === 1)) {
      expect(r1.nextRound).toBe(2);
      expect(r1.nextPosition).toBe(0);
    }
  });

  it("separates seed 1 and seed 2 until the final (4 teams)", () => {
    const m = generateSingleElim(seeds(4));
    const r1 = m.filter((x) => x.round === 1);
    const seed1Match = r1.find((x) => x.team1Id === "t1" || x.team2Id === "t1")!;
    const seed2Match = r1.find((x) => x.team1Id === "t2" || x.team2Id === "t2")!;
    expect(seed1Match.position).not.toBe(seed2Match.position);
  });

  it("gives byes to top seeds for 3 teams (1 bye)", () => {
    const m = generateSingleElim(seeds(3));
    const byes = m.filter((x) => x.isBye);
    expect(byes).toHaveLength(1);
    expect(byes[0].winnerTeamId).toBe("t1");
    // every non-bye match keeps a null winner until played
    expect(m.filter((x) => !x.isBye && x.winnerTeamId != null)).toHaveLength(0);
  });

  it("creates 7 matches and 3 byes for 5 teams, byes to the top seeds", () => {
    const m = generateSingleElim(seeds(5));
    expect(m).toHaveLength(7);
    const byes = m.filter((x) => x.isBye);
    expect(byes).toHaveLength(3);
    expect(byes.map((x) => x.winnerTeamId).sort()).toEqual(["t1", "t2", "t3"]);
    expect(Math.max(...m.map((x) => x.round))).toBe(3);
  });

  it("creates 7 matches and 0 byes for 8 teams", () => {
    const m = generateSingleElim(seeds(8));
    expect(m).toHaveLength(7);
    expect(m.filter((x) => x.isBye)).toHaveLength(0);
  });
});

describe("applyResult", () => {
  it("returns the winning slot", () => {
    expect(applyResult(21, 18)).toBe(1);
    expect(applyResult(15, 21)).toBe(2);
  });
  it("throws on a tie", () => {
    expect(() => applyResult(10, 10)).toThrow();
  });
});

describe("roundLabel", () => {
  it("labels rounds from the final backwards", () => {
    expect(roundLabel(3, 3)).toBe("Final");
    expect(roundLabel(2, 3)).toBe("Semifinal");
    expect(roundLabel(1, 3)).toBe("Cuartos");
    expect(roundLabel(1, 5)).toBe("Ronda 1");
  });
});
