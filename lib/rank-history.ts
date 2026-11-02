import type { Appearance, Role } from "./analytics.ts";
import type { SinglesAppearance } from "./singles.ts";

export type RankHistoryEntry = {
  matchId: string;
  time: string;
  round: string;
  result: "W" | "D" | "L";
  gf: number;
  ga: number;
  role?: "forward" | "defender";
  partnerIds: string[];
  opponentIds: string[];
  before: number | null;
  after: number | null;
  delta: number | null;
};

function change(before: number | undefined, after: number | undefined) {
  if (before === undefined || after === undefined)
    return { before: null, after: null, delta: null };
  return { before, after, delta: after - before };
}

// Analysis histories are already in settlement order, including ties in match time.
// Reversing that order keeps the ledger consistent with the existing replay.
export function doublesRankHistory(
  history: readonly Appearance[],
  role: Role,
): RankHistoryEntry[] {
  return history
    .filter((row) => role === "overall" || row.role === role)
    .map((row) => ({
      matchId: row.match.id,
      time: row.match.time,
      round: row.match.round,
      result: row.result,
      gf: row.gf,
      ga: row.ga,
      role: row.role,
      partnerIds: row.partners,
      opponentIds: row.opponents,
      ...change(
        role === "overall" ? row.rankBefore : row.roleRankBefore,
        role === "overall" ? row.rankPoints : row.roleRankPoints,
      ),
    }))
    .reverse();
}

export function singlesRankHistory(
  history: readonly SinglesAppearance[],
): RankHistoryEntry[] {
  return history
    .map((row) => ({
      matchId: row.match.id,
      time: row.match.time,
      round: row.match.round,
      result: row.result,
      gf: row.gf,
      ga: row.ga,
      partnerIds: [],
      opponentIds: [row.opponentId],
      ...change(row.before, row.after),
    }))
    .reverse();
}

export function rankHistorySummary(entries: readonly RankHistoryEntry[]) {
  const rated = entries.filter((entry) => entry.delta !== null);
  return {
    latest: entries[0]?.delta ?? null,
    total: rated.length
      ? rated.reduce((sum, entry) => sum + entry.delta!, 0)
      : null,
    ratedGames: rated.length,
  };
}
