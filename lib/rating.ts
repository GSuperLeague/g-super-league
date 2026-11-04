export { RATING_BASE, MMR_K, expectedResult, marginMultiplier, mmrChange, roundRating, RANK_POINT_CURVE, rankPointBase, nextRankPoints } from "./rating-v1.ts";
export type { RatingResult } from "./rating-v1.ts";

export const RANK_TIERS = [
  { id: "iron", name: "黑铁", min: 0 },
  { id: "bronze", name: "青铜", min: 1000 },
  { id: "silver", name: "白银", min: 1100 },
  { id: "gold", name: "黄金", min: 1200 },
  { id: "platinum", name: "铂金", min: 1300 },
  { id: "diamond", name: "钻石", min: 1400 },
  { id: "master", name: "大师", min: 1500 },
  { id: "grandmaster", name: "宗师", min: 1600 },
  { id: "king", name: "王者", min: 1700 },
] as const;
export type RankTier = (typeof RANK_TIERS)[number];

export function rankTier(points: number): RankTier {
  for (let i = RANK_TIERS.length - 1; i >= 0; i--)
    if (points >= RANK_TIERS[i].min) return RANK_TIERS[i];
  return RANK_TIERS[0];
}
