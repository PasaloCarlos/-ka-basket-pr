// Pure single-elimination bracket generator. No DB, no I/O — unit-tested.
// The DB ids of next matches are unknown here, so links are emitted as
// structural coordinates (nextRound/nextPosition/nextSlot); the action layer
// resolves them to next_match_id after inserting rows.

export type Seed = { teamId: string; teamName: string };

export type GeneratedMatch = {
  round: number; // 1-based; 1 = first round
  position: number; // 0-based within the round (top → bottom)
  team1Id: string | null;
  team1Name: string | null;
  team2Id: string | null;
  team2Name: string | null;
  isBye: boolean; // round-1 match with exactly one team
  winnerTeamId: string | null; // pre-set only for byes
  winnerName: string | null;
  nextRound: number | null;
  nextPosition: number | null;
  nextSlot: 1 | 2 | null;
};

export function nextPowerOfTwo(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// Standard bracket seeding sequence for `size` slots (values 1..size), arranged
// so consecutive pairs are the round-1 matchups and seed 1 cannot meet seed 2
// before the final. e.g. size 4 -> [1,4,2,3]; size 8 -> [1,8,4,5,2,7,3,6].
// `size` must be a power of two (callers pass nextPowerOfTwo(n)).
export function seedOrder(size: number): number[] {
  let pols = [1, 2];
  while (pols.length < size) {
    const sum = pols.length * 2 + 1;
    const next: number[] = [];
    for (const p of pols) {
      next.push(p);
      next.push(sum - p);
    }
    pols = next;
  }
  return pols;
}

// Named up to 4-round brackets (≤ 16 teams). Deeper rounds fall back to "Ronda N".
const FINAL_LABELS = ["Final", "Semifinal", "Cuartos", "Octavos"];

export function roundLabel(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round; // 0 = final
  return FINAL_LABELS[fromEnd] ?? `Ronda ${round}`;
}

export function applyResult(score1: number, score2: number): 1 | 2 {
  if (!Number.isFinite(score1) || !Number.isFinite(score2)) {
    throw new Error("Marcador inválido.");
  }
  if (score1 === score2) {
    throw new Error("No puede haber empate en eliminación sencilla.");
  }
  return score1 > score2 ? 1 : 2;
}

export function generateSingleElim(seeds: Seed[]): GeneratedMatch[] {
  if (seeds.length < 2) {
    throw new Error("Necesitas al menos 2 equipos para generar el bracket.");
  }
  const n = seeds.length;
  const size = nextPowerOfTwo(n);
  const totalRounds = Math.log2(size);
  const order = seedOrder(size);
  const seedAt = (slot: number): Seed | null => {
    const seedNum = order[slot];
    return seedNum <= n ? seeds[seedNum - 1] : null;
  };

  const matches: GeneratedMatch[] = [];

  // Round 1
  const r1Count = size / 2;
  for (let p = 0; p < r1Count; p++) {
    const t1 = seedAt(2 * p);
    const t2 = seedAt(2 * p + 1);
    const isBye = (t1 == null) !== (t2 == null); // exactly one null
    const present = t1 ?? t2;
    const hasNext = totalRounds >= 2;
    matches.push({
      round: 1,
      position: p,
      team1Id: t1?.teamId ?? null,
      team1Name: t1?.teamName ?? null,
      team2Id: t2?.teamId ?? null,
      team2Name: t2?.teamName ?? null,
      isBye,
      winnerTeamId: isBye ? present!.teamId : null,
      winnerName: isBye ? present!.teamName : null,
      nextRound: hasNext ? 2 : null,
      nextPosition: hasNext ? Math.floor(p / 2) : null,
      nextSlot: hasNext ? (p % 2 === 0 ? 1 : 2) : null,
    });
  }

  // Rounds 2..totalRounds — empty, linked forward.
  for (let r = 2; r <= totalRounds; r++) {
    const count = size / Math.pow(2, r);
    for (let p = 0; p < count; p++) {
      const isFinal = r === totalRounds;
      matches.push({
        round: r,
        position: p,
        team1Id: null,
        team1Name: null,
        team2Id: null,
        team2Name: null,
        isBye: false,
        winnerTeamId: null,
        winnerName: null,
        nextRound: isFinal ? null : r + 1,
        nextPosition: isFinal ? null : Math.floor(p / 2),
        nextSlot: isFinal ? null : p % 2 === 0 ? 1 : 2,
      });
    }
  }

  return matches;
}
