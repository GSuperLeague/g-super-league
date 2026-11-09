import type { RatingResult } from "./rating-v1.ts";
import { SEASON_START } from "./seasons.ts";
import type { SeasonId } from "./seasons.ts";

export const DOUBLES_TRUESKILL_POLICY = {
  version: "gsl-s1-doubles-trueskill-v1",
  seasonId: "s1",
  startsAt: SEASON_START,
} as const;
export type DoublesRatingPolicy = typeof DOUBLES_TRUESKILL_POLICY;

// A change to these parameters requires a new policy version.
const INITIAL_UNCERTAINTY = 180;
const INITIAL_UNCERTAINTY_FLOOR = 80;
const PRIOR_GAMES_SCALE = 8;
const PERFORMANCE_DEVIATION = 250;
const PER_MATCH_DRIFT = 3;
export const DOUBLES_PROVISIONAL_THRESHOLD = 120;

type Estimate = { mean: number; uncertainty: number };

export function usesDoublesTrueSkill(league: {
  seasonId?: SeasonId;
  doublesRatingPolicy?: DoublesRatingPolicy;
}): boolean {
  const policy = league.doublesRatingPolicy;
  return league.seasonId === DOUBLES_TRUESKILL_POLICY.seasonId &&
    policy?.version === DOUBLES_TRUESKILL_POLICY.version &&
    policy.seasonId === DOUBLES_TRUESKILL_POLICY.seasonId &&
    policy.startsAt === DOUBLES_TRUESKILL_POLICY.startsAt;
}

export function doublesInitialUncertainty(betaGames: number): number {
  return Math.max(
    INITIAL_UNCERTAINTY_FLOOR,
    INITIAL_UNCERTAINTY / Math.sqrt(1 + betaGames / PRIOR_GAMES_SCALE),
  );
}

const ERFC_COEFFICIENTS = [
  0.17087277, -0.82215223, 1.48851587, -1.13520398, 0.27886807,
  -0.18628806, 0.09678418, 0.37409196, 1.00002368,
];
const SQRT_TWO_PI = Math.sqrt(2 * Math.PI);

// The Gaussian upper tail for z >= 0 with exp(-z²/2) factored out.
function scaledNormalTail(z: number): number {
  const t = 1 / (1 + 0.5 * z / Math.SQRT2);
  const polynomial = ERFC_COEFFICIENTS.reduce(
    (value, coefficient) => coefficient + t * value,
    0,
  );
  return 0.5 * t * Math.exp(-1.26551223 + t * polynomial);
}

function normalCdf(z: number): number {
  if (z === 0) return 0.5;
  const tail = Math.exp(-z * z / 2) * scaledNormalTail(Math.abs(z));
  return z < 0 ? tail : 1 - tail;
}

function winCorrection(z: number): number {
  // The scaled form avoids dividing two underflowed values on unlikely wins.
  return z < 0
    ? 1 / (SQRT_TWO_PI * scaledNormalTail(-z))
    : Math.exp(-z * z / 2) / (SQRT_TWO_PI * normalCdf(z));
}

/** Slots are home forward, home defender, away forward, away defender. */
export function settleDoublesTrueSkill(
  before: readonly Estimate[],
  homeResult: RatingResult,
): { homeExpected: number; after: Estimate[] } {
  const variances = before.map((rating) => rating.uncertainty ** 2 + PER_MATCH_DRIFT ** 2);
  const totalVariance = variances.reduce((sum, variance) => sum + variance, 4 * PERFORMANCE_DEVIATION ** 2);
  const deviation = Math.sqrt(totalVariance);
  const homeMean = before[0].mean + before[1].mean;
  const awayMean = before[2].mean + before[3].mean;
  const standardized = (homeMean - awayMean) / deviation;
  const homeExpected = normalCdf(standardized);

  const draw = homeResult === 0.5;
  const homeWon = homeResult === 1;
  const outcome = homeWon ? standardized : -standardized;
  // A recorded tie conditions the performance difference on zero, the
  // zero-width limit of TrueSkill's draw interval.
  const v = draw ? -standardized : winCorrection(outcome);
  const w = draw ? 1 : Math.min(1, Math.max(0, v * (v + outcome)));
  const after = before.map((rating, index) => {
    const home = index < 2;
    const positive = draw ? home : home === homeWon;
    const variance = variances[index];
    return {
      mean: rating.mean + (positive ? 1 : -1) * variance / deviation * v,
      uncertainty: Math.sqrt(variance * (1 - variance / totalVariance * w)),
    };
  });
  return { homeExpected, after };
}
