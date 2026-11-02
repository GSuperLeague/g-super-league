import { RATING_BASE, roundRating } from "./rating.ts";

export const SEASON_START = "2026-11-02T00:00:00+08:00";
export const SEASON_INHERITANCE = 0.33;
export const SEASONS = [
  { id: "s1", name: "第一赛季", period: "2026.11.02 起" },
  { id: "beta", name: "beta赛季", period: "2026.11.01 截止" },
] as const;
export type SeasonId = (typeof SEASONS)[number]["id"];
export type RatingSeed = { rankPoints: number; mmr: number };
export type SeasonContext<T> = {
  seasonId?: SeasonId;
  ratingSeeds?: Record<string, T>;
};

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
