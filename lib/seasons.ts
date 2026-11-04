import { RATING_BASE, roundRating } from "./rating-v1.ts";

export const SEASON_START = "2026-11-02T00:00:00+08:00";
export const SEASON_INHERITANCE = 0.33;
export const SEASONS = [
  { id: "s1", name: "第一赛季", period: "2026.11.02 起" },
  { id: "beta", name: "beta赛季", period: "2026.11.01 截止" },
] as const;
export type SeasonId = (typeof SEASONS)[number]["id"];
export type RatingSeed = { rankPoints: number; mmr: number };
export type SeasonArchive<T, M, P, Team> = {
  schemaVersion: 1;
  seasonId: "beta";
  lockedAt: string;
  cutoff: string;
  sourceRevision: number;
  sourceCommit: string;
  ruleVersion: "gsl-beta-v1";
  ruleSnapshot: Record<string, unknown>;
  matches: M[];
  players: P[];
  teams: Team[];
  settings: { season: string; win: number; draw: number; loss: number };
  finalRatings: Record<string, T>;
  nextSeasonSeeds: Record<string, T>;
};
export const FIRST_WIN_POLICY = {
  version: "gsl-s1-daily-position-win-v1",
  seasonId: "s1",
  startsAt: SEASON_START,
  timeZone: "Asia/Shanghai",
  points: 10,
  scope: "player-day-position",
} as const;
export type FirstWinPolicy = typeof FIRST_WIN_POLICY;
export type SeasonContext<T, M = unknown, P = unknown, Team = unknown> = {
  seasonId?: SeasonId;
  ratingSeeds?: Record<string, T>;
  seasonArchives?: { beta?: SeasonArchive<T, M, P, Team> };
  firstWinPolicy?: FirstWinPolicy;
  // Derived from the complete season before applying UI filters.
  firstWinAwards?: Record<string, number>;
};

export type WinPosition = "forward" | "defender" | "singles";
export type FirstWinCandidate = {
  id: string;
  time: string;
  winners: { playerId: string; position: WinPosition }[];
};
export function firstWinKey(
  matchId: string,
  playerId: string,
  position: WinPosition,
) {
  return JSON.stringify([matchId, playerId, position]);
}
export function buildFirstWinAwards(
  candidates: FirstWinCandidate[],
  policy?: FirstWinPolicy,
): Record<string, number> {
  if (!policy || policy.version !== FIRST_WIN_POLICY.version) return {};
  const earned = new Set<string>(),
    awards: Record<string, number> = {};
  const dayFormat = new Intl.DateTimeFormat("sv-SE", {
    timeZone: policy.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // Caller supplies the same settlement order used by its scoring engine.
  for (const match of candidates) {
    if (
      !Number.isFinite(Date.parse(match.time)) ||
      Date.parse(match.time) < Date.parse(policy.startsAt) ||
      matchSeason(match.time) !== policy.seasonId
    )
      continue;
    const day = dayFormat.format(new Date(match.time));
    for (const { playerId, position } of match.winners) {
      const key = JSON.stringify([playerId, day, position]);
      if (earned.has(key)) continue;
      earned.add(key);
      awards[firstWinKey(match.id, playerId, position)] = policy.points;
    }
  }
  return awards;
}
export function assertSeasonWritable(
  context: {
    seasonArchives?: { beta?: { lockedAt: string } };
    matches: { id: string; time: string }[];
  },
  action: { type: string; id: string; data?: unknown },
) {
  if (!context.seasonArchives?.beta?.lockedAt) return;
  const matchWrite =
    action.type.startsWith("match.") || action.type.startsWith("goal.");
  if (!matchWrite) return;
  const existing = context.matches.find((m) => m.id === action.id);
  const data =
    action.data && typeof action.data === "object"
      ? (action.data as { time?: unknown })
      : undefined;
  const targetTime = typeof data?.time === "string" ? data.time : undefined;
  if (
    (existing && matchSeason(existing.time) === "beta") ||
    (targetTime &&
      Number.isFinite(Date.parse(targetTime)) &&
      matchSeason(targetTime) === "beta")
  ) {
    throw Error("beta赛季已封存，不能新增、修改或删除旧赛果");
  }
}

export function matchSeason(time: string): SeasonId {
  return Date.parse(time) < Date.parse(SEASON_START) ? "beta" : "s1";
}

export function inheritRating(points: number, mmr: number): RatingSeed {
  return {
    rankPoints:
      RATING_BASE +
      roundRating(Math.max(points - RATING_BASE, 0) * SEASON_INHERITANCE),
    mmr: RATING_BASE + (mmr - RATING_BASE) * SEASON_INHERITANCE,
  };
}

export function seasonName(id: SeasonId): string {
  return SEASONS.find((season) => season.id === id)!.name;
}
