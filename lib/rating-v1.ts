// Frozen beta-season scoring v1. Add later rule versions in a new module.
export const RATING_BASE = 1200;
export const MMR_K = 64;
export type RatingResult = 0 | 0.5 | 1;

export function expectedResult(own: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - own) / 400));
}

export function marginMultiplier(home: number, away: number): number {
  const winningScore = Math.max(home, away);
  return winningScore ? 1 + (0.5 * Math.abs(home - away)) / winningScore : 1;
}

export function mmrChange(
  own: number,
  opponent: number,
  result: RatingResult,
  multiplier: number,
): number {
  return MMR_K * (result - expectedResult(own, opponent)) * multiplier;
}

// Symmetric rounding also handles negative half-points consistently.
export const roundRating = (value: number): number =>
  Math.sign(value) * Math.round(Math.abs(value));

// Interpolation avoids abrupt settlement changes when crossing a tier boundary.
export const RANK_POINT_CURVE = [
  { min: 1000, win: 36, loss: 10, draw: 6 },
  { min: 1100, win: 34, loss: 12, draw: 5 },
  { min: 1200, win: 32, loss: 14, draw: 4 },
  { min: 1300, win: 28, loss: 18, draw: 3 },
  { min: 1400, win: 24, loss: 24, draw: 0 },
] as const;

export function rankPointBase(points: number): {
  win: number;
  loss: number;
  draw: number;
} {
  const first = RANK_POINT_CURVE[0];
  if (points <= first.min) return first;
  for (let i = 1; i < RANK_POINT_CURVE.length; i++) {
    const low = RANK_POINT_CURVE[i - 1];
    const high = RANK_POINT_CURVE[i];
    if (points <= high.min) {
      const progress = (points - low.min) / (high.min - low.min);
      return {
        win: low.win + (high.win - low.win) * progress,
        loss: low.loss + (high.loss - low.loss) * progress,
        draw: low.draw + (high.draw - low.draw) * progress,
      };
    }
  }
  return RANK_POINT_CURVE[RANK_POINT_CURVE.length - 1];
}

export function nextRankPoints(
  points: number,
  mmr: number,
  result: RatingResult,
  multiplier: number,
  expected: number,
): number {
  const { win, loss, draw } = rankPointBase(points);
  const base =
    result === 1
      ? win * 2 * (1 - expected)
      : result === 0
        ? -loss * 2 * expected
        : draw + (win + loss) * (0.5 - expected);
  const alignment = Math.max(-8, Math.min(8, (mmr - points) / 25));
  const adjusted = base + alignment;
  // Wins never remove points; a heavily favored win can legitimately award zero.
  const change =
    result === 1
      ? Math.max(0, adjusted)
      : result === 0
        ? Math.min(0, adjusted)
        : adjusted;
  return Math.max(0, points + roundRating(change * multiplier));
}
