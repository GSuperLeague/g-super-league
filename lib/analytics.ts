import { score, matchRoles } from "./league.ts";
import type { League, Match, Player } from "./league.ts";
import {
  inheritRating,
  matchSeason,
  seasonName,
  buildFirstWinAwards,
  firstWinKey,
  FIRST_WIN_POLICY,
  SEASON_START,
} from "./seasons.ts";
import type { SeasonId } from "./seasons.ts";
import * as ratingV1 from "./rating-v1.ts";
import {
  RATING_BASE,
  expectedResult,
  marginMultiplier,
  mmrChange,
  nextRankPoints,
} from "./rating.ts";

export type Role = "overall" | "forward" | "defender";
export type Result = "W" | "D" | "L";
export const MIN_SAMPLE = 3;
export type Appearance = {
  match: Match;
  result: Result;
  gf: number;
  ga: number;
  role?: "forward" | "defender";
  partners: string[];
  opponents: string[];
  rankPoints?: number;
  roleRankPoints?: number;
  rankBefore?: number;
  roleRankBefore?: number;
  partnerRankBefore?: number;
  opponentRankBefore?: number;
  firstWinBonus?: number;
  roleFirstWinBonus?: number;
  baseDelta?: number | null;
  roleBaseDelta?: number;
};
export type Metrics = {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  winRate: number | null;
  winInterval: [number, number] | null;
  goalShare: number | null;
  avgFor: number | null;
  avgAgainst: number | null;
  avgDifference: number | null;
  closeGames: number;
  closeWinRate: number | null;
  deviation: number | null;
  longestStreak: number;
  currentStreak: number;
};
export type PlayerStats = {
  player: Player;
  history: Appearance[];
  overall: Metrics;
  forward: Metrics;
  defender: Metrics;
  rankPoints: Record<Role, number>;
  mmr: Record<Role, number>;
  ratedGames: Record<Role, number>;
  firstWinPoints: Record<Role, number>;
  recent: Metrics;
  form: Result[];
};
export type PairStats = Metrics & { ids: [string, string] };
export type PositionPairStats = Metrics & {
  forwardId: string;
  defenderId: string;
  matches: Match[];
};
export type SwapComparison = {
  id: string;
  opponents: [string, string];
  variants: PositionPairStats[];
};
export type RatingChange = {
  before: number;
  after: number | null;
  delta: number | null;
  firstWinBonus?: number;
  baseDelta?: number | null;
};
export type MatchRating = {
  playerId: string;
  side: "home" | "away";
  role?: "forward" | "defender";
  overall: RatingChange;
  position: RatingChange | null;
};
export type HeadToHead = Metrics & { id: string; matches: Match[] };
export type Analytics = {
  players: PlayerStats[];
  pairs: PairStats[];
  positionPairs: PositionPairStats[];
  finished: Match[];
  ratedMatches: number;
};

export function summarize(
  rows: Pick<Appearance, "gf" | "ga" | "result">[],
): Metrics {
  const games = rows.length;
  const wins = rows.filter((r) => r.result === "W").length;
  const draws = rows.filter((r) => r.result === "D").length;
  const gf = rows.reduce((sum, r) => sum + r.gf, 0);
  const ga = rows.reduce((sum, r) => sum + r.ga, 0);
  const close = rows.filter((r) => Math.abs(r.gf - r.ga) <= 2);
  const mean = games ? (gf - ga) / games : 0;
  const scored = rows.filter((r) => r.gf + r.ga > 0);
  // Wilson's 95% interval keeps small-sample win rates from implying certainty.
  const z2 = 1.96 ** 2;
  const rate = games ? wins / games : 0;
  const center = games ? (rate + z2 / (2 * games)) / (1 + z2 / games) : 0;
  const margin = games
    ? (1.96 * Math.sqrt((rate * (1 - rate)) / games + z2 / (4 * games ** 2))) /
      (1 + z2 / games)
    : 0;
  let longestStreak = 0,
    currentStreak = 0;
  for (const row of rows) {
    currentStreak = row.result === "W" ? currentStreak + 1 : 0;
    longestStreak = Math.max(longestStreak, currentStreak);
  }
  return {
    games,
    wins,
    draws,
    losses: games - wins - draws,
    gf,
    ga,
    gd: gf - ga,
    winRate: games ? wins / games : null,
    winInterval: games
      ? [Math.max(0, center - margin), Math.min(1, center + margin)]
      : null,
    goalShare: scored.length
      ? scored.reduce((sum, r) => sum + r.gf / (r.gf + r.ga), 0) / scored.length
      : null,
    avgFor: games ? gf / games : null,
    avgAgainst: games ? ga / games : null,
    avgDifference: games ? mean : null,
    closeGames: close.length,
    closeWinRate: close.length
      ? close.filter((r) => r.result === "W").length / close.length
      : null,
    deviation:
      games >= 2
        ? Math.sqrt(
            rows.reduce((sum, r) => sum + (r.gf - r.ga - mean) ** 2, 0) / games,
          )
        : null,
    longestStreak,
    currentStreak,
  };
}

const outcome = (gf: number, ga: number): Result =>
  gf > ga ? "W" : gf < ga ? "L" : "D";
const pairKey = (a: string, b: string) => JSON.stringify([a, b].sort());
const chronological = (a: Match, b: Match) =>
  Date.parse(a.time) - Date.parse(b.time) ||
  (a.summary?.recordedAt || "").localeCompare(b.summary?.recordedAt || "") ||
  a.id.localeCompare(b.id);

export function doublesFirstWinAwards(league: League): Record<string, number> {
  if (league.seasonId === "beta") return {};
  const known = new Set(league.players.map((p) => p.id));
  const candidates = league.matches
    .filter((m) => m.status === "finished")
    .slice()
    .sort(chronological)
    .map((match) => {
      const r = matchRoles(match),
        [a, b] = score(match);
      const roles = r
        ? [r.homeForwardId, r.homeDefenderId, r.awayForwardId, r.awayDefenderId]
        : [];
      const valid =
        roles.length === 4 &&
        new Set(roles).size === 4 &&
        match.homePlayers.length === 2 &&
        match.awayPlayers.length === 2 &&
        roles.every(
          (id, i) =>
            known.has(id) &&
            (i < 2 ? match.homePlayers : match.awayPlayers).includes(id),
        );
      const offset = a > b ? 0 : 2;
      return {
        id: match.id,
        time: match.time,
        winners:
          valid && a !== b
            ? [
                { playerId: roles[offset], position: "forward" as const },
                { playerId: roles[offset + 1], position: "defender" as const },
              ]
            : [],
      };
    });
  return buildFirstWinAwards(candidates, league.firstWinPolicy);
}

export function analyzeLeague(league: League): Analytics {
  const legacy = league.seasonId === "beta";
  const nextPoints = legacy ? ratingV1.nextRankPoints : nextRankPoints;
  const expected = legacy ? ratingV1.expectedResult : expectedResult;
  const margin = legacy ? ratingV1.marginMultiplier : marginMultiplier;
  const changeMmr = legacy ? ratingV1.mmrChange : mmrChange;
  const awards = legacy
    ? {}
    : (league.firstWinAwards ?? doublesFirstWinAwards(league));
  const bonusPoints = new Map(
    league.players.map((p) => [p.id, { overall: 0, forward: 0, defender: 0 }]),
  );
  const histories = new Map(
    league.players.map((p) => [p.id, [] as Appearance[]]),
  );
  const ratings = new Map(
    league.players.map((p) => [
      p.id,
      {
        overall: league.ratingSeeds?.[p.id]?.overall.mmr ?? RATING_BASE,
        forward: league.ratingSeeds?.[p.id]?.forward.mmr ?? RATING_BASE,
        defender: league.ratingSeeds?.[p.id]?.defender.mmr ?? RATING_BASE,
      },
    ]),
  );
  const rankPoints = new Map(
    league.players.map((p) => [
      p.id,
      {
        overall: league.ratingSeeds?.[p.id]?.overall.rankPoints ?? RATING_BASE,
        forward: league.ratingSeeds?.[p.id]?.forward.rankPoints ?? RATING_BASE,
        defender:
          league.ratingSeeds?.[p.id]?.defender.rankPoints ?? RATING_BASE,
      },
    ]),
  );
  const ratedGames = new Map(
    league.players.map((p) => [p.id, { overall: 0, forward: 0, defender: 0 }]),
  );
  const pairs = new Map<
    string,
    { ids: [string, string]; rows: Appearance[] }
  >();
  const positionPairs = new Map<
    string,
    { forwardId: string; defenderId: string; rows: Appearance[] }
  >();
  const finished = league.matches
    .filter((m) => m.status === "finished")
    .slice()
    .sort(chronological);
  let ratedMatches = 0;
  for (const match of finished) {
    const [homeScore, awayScore] = score(match);
    const rosters = [match.homePlayers, match.awayPlayers];
    if (
      !rosters.every((r) => r.length > 0) ||
      new Set(rosters.flat()).size !== rosters.flat().length
    )
      continue;
    const summary = matchRoles(match);
    const roles = summary
      ? [
          summary.homeForwardId,
          summary.homeDefenderId,
          summary.awayForwardId,
          summary.awayDefenderId,
        ]
      : [];
    const knownRoles =
      roles.length === 4 &&
      new Set(roles).size === 4 &&
      roles.every(
        (id, i) => histories.has(id) && rosters[i < 2 ? 0 : 1].includes(id),
      );
    // Rate complete 2v2 results only. Team strength is the mean of both players' pre-match ratings.
    const rated = knownRoles && rosters.every((r) => r.length === 2);
    const preRankPoints = new Map(
      roles.map((id) => [id, { ...rankPoints.get(id)! }]),
    );
    const preDisplayPoints = new Map(
      roles
        .filter((id) => rankPoints.has(id))
        .map((id) => [
          id,
          {
            overall: rankPoints.get(id)!.overall + bonusPoints.get(id)!.overall,
            forward: rankPoints.get(id)!.forward + bonusPoints.get(id)!.forward,
            defender:
              rankPoints.get(id)!.defender + bonusPoints.get(id)!.defender,
          },
        ]),
    );
    const deltas: { id: string; role: Role; value: number }[] = [];
    if (rated) {
      ratedMatches++;
      const homeResult =
        homeScore > awayScore ? 1 : homeScore < awayScore ? 0 : 0.5;
      const multiplier = margin(homeScore, awayScore);
      for (const mode of ["overall", "position"] as const) {
        const before = roles.map(
          (id, i) =>
            ratings.get(id)![
              mode === "overall"
                ? "overall"
                : i % 2 === 0
                  ? "forward"
                  : "defender"
            ],
        );
        const delta = changeMmr(
          (before[0] + before[1]) / 2,
          (before[2] + before[3]) / 2,
          homeResult,
          multiplier,
        );
        const homeExpected = expected(
          (before[0] + before[1]) / 2,
          (before[2] + before[3]) / 2,
        );
        roles.forEach((id, i) => {
          const role =
            mode === "overall"
              ? "overall"
              : i % 2 === 0
                ? "forward"
                : "defender";
          const result =
            i < 2
              ? homeResult
              : homeResult === 1
                ? 0
                : homeResult === 0
                  ? 1
                  : 0.5;
          rankPoints.get(id)![role] = nextPoints(
            preRankPoints.get(id)![role],
            before[i],
            result,
            multiplier,
            i < 2 ? homeExpected : 1 - homeExpected,
          );
          deltas.push({
            id,
            role,
            value: i < 2 ? delta : -delta,
          });
        });
      }
      for (const { id, role, value } of deltas) {
        ratings.get(id)![role] += value;
        ratedGames.get(id)![role]++;
      }
      roles.forEach((id, i) => {
        const role = i % 2 === 0 ? "forward" : "defender";
        const bonus = awards[firstWinKey(match.id, id, role)] || 0;
        bonusPoints.get(id)!.overall += bonus;
        bonusPoints.get(id)![role] += bonus;
      });
    }
    rosters.forEach((roster, side) => {
      const gf = side === 0 ? homeScore : awayScore,
        ga = side === 0 ? awayScore : homeScore;
      const result = outcome(gf, ga);
      for (const id of roster) {
        const role = knownRoles
          ? roles[side * 2] === id
            ? "forward"
            : roles[side * 2 + 1] === id
              ? "defender"
              : undefined
          : undefined;
        histories.get(id)?.push({
          match,
          gf,
          ga,
          result,
          role,
          partners: roster.filter((pid) => pid !== id),
          opponents: rosters[1 - side],
          rankPoints: rated
            ? rankPoints.get(id)!.overall + bonusPoints.get(id)!.overall
            : undefined,
          roleRankPoints:
            rated && role
              ? rankPoints.get(id)![role] + bonusPoints.get(id)![role]
              : undefined,
          rankBefore: rated ? preDisplayPoints.get(id)!.overall : undefined,
          roleRankBefore:
            rated && role ? preDisplayPoints.get(id)![role] : undefined,
          partnerRankBefore: rated
            ? preDisplayPoints.get(roster.find((pid) => pid !== id)!)!.overall
            : undefined,
          opponentRankBefore: rated
            ? rosters[1 - side].reduce(
                (sum, pid) => sum + preDisplayPoints.get(pid)!.overall,
                0,
              ) / 2
            : undefined,
          firstWinBonus:
            rated && role
              ? awards[firstWinKey(match.id, id, role)] || 0
              : undefined,
          roleFirstWinBonus:
            rated && role
              ? awards[firstWinKey(match.id, id, role)] || 0
              : undefined,
          baseDelta: rated
            ? rankPoints.get(id)!.overall - preRankPoints.get(id)!.overall
            : undefined,
          roleBaseDelta:
            rated && role
              ? rankPoints.get(id)![role] - preRankPoints.get(id)![role]
              : undefined,
        });
      }
      if (rated) {
        const forwardId = roles[side * 2],
          defenderId = roles[side * 2 + 1];
        const key = JSON.stringify([forwardId, defenderId]);
        if (!positionPairs.has(key))
          positionPairs.set(key, { forwardId, defenderId, rows: [] });
        positionPairs
          .get(key)!
          .rows.push({ match, gf, ga, result, partners: [], opponents: [] });
      }
      if (roster.length === 2 && roster.every((id) => histories.has(id))) {
        const key = pairKey(roster[0], roster[1]);
        if (!pairs.has(key))
          pairs.set(key, {
            ids: [...roster].sort() as [string, string],
            rows: [],
          });
        pairs
          .get(key)!
          .rows.push({ match, gf, ga, result, partners: [], opponents: [] });
      }
    });
  }
  const archive = league.seasonArchives?.beta;
  const frozenFinal =
    legacy &&
    archive &&
    league.matches.length === archive.matches.length &&
    league.matches.every((m) => archive.matches.some((old) => old.id === m.id));
  return {
    finished,
    ratedMatches,
    players: league.players.map((player) => {
      const history = histories.get(player.id)!;
      return {
        player,
        history,
        overall: summarize(history),
        forward: summarize(history.filter((r) => r.role === "forward")),
        defender: summarize(history.filter((r) => r.role === "defender")),
        rankPoints:
          frozenFinal && archive.finalRatings[player.id]
            ? {
                overall: archive.finalRatings[player.id].overall.rankPoints,
                forward: archive.finalRatings[player.id].forward.rankPoints,
                defender: archive.finalRatings[player.id].defender.rankPoints,
              }
            : {
                overall:
                  rankPoints.get(player.id)!.overall +
                  bonusPoints.get(player.id)!.overall,
                forward:
                  rankPoints.get(player.id)!.forward +
                  bonusPoints.get(player.id)!.forward,
                defender:
                  rankPoints.get(player.id)!.defender +
                  bonusPoints.get(player.id)!.defender,
              },
        mmr:
          frozenFinal && archive.finalRatings[player.id]
            ? {
                overall: archive.finalRatings[player.id].overall.mmr,
                forward: archive.finalRatings[player.id].forward.mmr,
                defender: archive.finalRatings[player.id].defender.mmr,
              }
            : ratings.get(player.id)!,
        ratedGames: ratedGames.get(player.id)!,
        firstWinPoints: bonusPoints.get(player.id)!,
        recent: summarize(history.slice(-10)),
        form: history.slice(-10).map((r) => r.result),
      };
    }),
    pairs: [...pairs.values()].map((p) => ({
      ids: p.ids,
      ...summarize(p.rows),
    })),
    positionPairs: [...positionPairs.values()].map((p) => ({
      forwardId: p.forwardId,
      defenderId: p.defenderId,
      matches: p.rows.map((r) => r.match),
      ...summarize(p.rows),
    })),
  };
}

export function leagueForSeason(league: League, season: SeasonId): League {
  const archive = league.seasonArchives?.beta;
  const beta: League = {
    ...league,
    seasonId: "beta",
    ratingSeeds: undefined,
    firstWinAwards: {},
    settings: {
      ...(archive?.settings || league.settings),
      season: seasonName("beta"),
    },
    teams: archive?.teams || league.teams,
    players: archive
      ? archive.players.map(
          (p) => league.players.find((current) => current.id === p.id) || p,
        )
      : league.players,
    matches:
      archive?.matches ||
      league.matches.filter((m) => matchSeason(m.time) === "beta"),
  };
  if (season === "beta") return beta;
  const previous = analyzeLeague(beta);
  const next: League = {
    ...league,
    seasonId: season,
    settings: { ...league.settings, season: seasonName(season) },
    matches: league.matches.filter((m) => matchSeason(m.time) === season),
    ratingSeeds:
      archive?.nextSeasonSeeds ||
      Object.fromEntries(
        previous.players.map((p) => [
          p.player.id,
          {
            overall: inheritRating(p.rankPoints.overall, p.mmr.overall),
            forward: inheritRating(p.rankPoints.forward, p.mmr.forward),
            defender: inheritRating(p.rankPoints.defender, p.mmr.defender),
          },
        ]),
      ),
  };
  next.firstWinAwards = doublesFirstWinAwards(next);
  return next;
}

export function archiveBetaLeague(
  league: League,
  options: { lockedAt: string; sourceRevision: number; sourceCommit: string },
): League {
  if (league.seasonArchives?.beta) throw Error("beta赛季已经封存");
  const beta = leagueForSeason(league, "beta"),
    stats = analyzeLeague(beta);
  const finalRatings = Object.fromEntries(
    stats.players.map((p) => [
      p.player.id,
      {
        overall: { rankPoints: p.rankPoints.overall, mmr: p.mmr.overall },
        forward: { rankPoints: p.rankPoints.forward, mmr: p.mmr.forward },
        defender: { rankPoints: p.rankPoints.defender, mmr: p.mmr.defender },
      },
    ]),
  );
  const nextSeasonSeeds = Object.fromEntries(
    stats.players.map((p) => [
      p.player.id,
      {
        overall: inheritRating(p.rankPoints.overall, p.mmr.overall),
        forward: inheritRating(p.rankPoints.forward, p.mmr.forward),
        defender: inheritRating(p.rankPoints.defender, p.mmr.defender),
      },
    ]),
  );
  return {
    ...structuredClone(league),
    firstWinPolicy: { ...FIRST_WIN_POLICY },
    seasonArchives: {
      ...league.seasonArchives,
      beta: {
        schemaVersion: 1,
        seasonId: "beta",
        ...options,
        cutoff: SEASON_START,
        ruleVersion: "gsl-beta-v1",
        ruleSnapshot: {
          base: ratingV1.RATING_BASE,
          mmrK: ratingV1.MMR_K,
          expectedScale: 400,
          rankPointCurve: ratingV1.RANK_POINT_CURVE,
          margin: "1+0.5*abs(home-away)/max(home,away)",
          alignmentCap: 8,
          alignmentDivisor: 25,
          rounding: "symmetric-nearest-integer",
          firstWinBonus: 0,
          inheritance: 0.33,
        },
        matches: structuredClone(beta.matches),
        players: structuredClone(beta.players),
        teams: structuredClone(beta.teams),
        settings: structuredClone(beta.settings),
        finalRatings,
        nextSeasonSeeds,
      },
    },
  };
}

export function positionContext(stats: PlayerStats, role: Role) {
  const rows = stats.history.filter(
    (r) => role === "overall" || r.role === role,
  );
  const rated = rows.filter(
    (r) =>
      r.partnerRankBefore !== undefined && r.opponentRankBefore !== undefined,
  );
  return {
    partners: new Set(rows.flatMap((r) => r.partners)).size,
    opponents: new Set(rows.flatMap((r) => r.opponents)).size,
    ratedGames: rated.length,
    partnerRankPoints: rated.length
      ? rated.reduce((sum, r) => sum + r.partnerRankBefore!, 0) / rated.length
      : null,
    opponentRankPoints: rated.length
      ? rated.reduce((sum, r) => sum + r.opponentRankBefore!, 0) / rated.length
      : null,
  };
}

export function swapComparisons(data: Analytics): SwapComparison[] {
  const groups = new Map<
    string,
    {
      opponents: [string, string];
      pairs: Map<string, { pair: PositionPairStats; rows: Appearance[] }>;
    }
  >();
  for (const pair of data.positionPairs) {
    for (const match of pair.matches) {
      const s = matchRoles(match)!;
      const home = s.homeForwardId === pair.forwardId;
      const opponents: [string, string] = home
        ? [s.awayForwardId, s.awayDefenderId]
        : [s.homeForwardId, s.homeDefenderId];
      const key = JSON.stringify([
        [pair.forwardId, pair.defenderId].sort(),
        opponents,
      ]);
      if (!groups.has(key)) groups.set(key, { opponents, pairs: new Map() });
      const group = groups.get(key)!;
      if (!group.pairs.has(pair.forwardId))
        group.pairs.set(pair.forwardId, { pair, rows: [] });
      const scores = score(match),
        gf = scores[home ? 0 : 1],
        ga = scores[home ? 1 : 0];
      group.pairs.get(pair.forwardId)!.rows.push({
        match,
        gf,
        ga,
        result: outcome(gf, ga),
        partners: [],
        opponents: [],
      });
    }
  }
  return [...groups.entries()]
    .filter(([, g]) => g.pairs.size === 2)
    .map(([id, g]) => ({
      id,
      opponents: g.opponents,
      variants: [...g.pairs.values()].map(({ pair, rows }) => ({
        forwardId: pair.forwardId,
        defenderId: pair.defenderId,
        matches: rows.map((r) => r.match),
        ...summarize(rows),
      })),
    }));
}

export function matchRatings(
  league: League,
  match: Match,
): { rated: boolean; players: MatchRating[] } {
  // Replay only through this match, so later results cannot leak into its before/after values.
  const earlier = league.matches.filter(
    (m) => m.id !== match.id && chronological(m, match) < 0,
  );
  const before = analyzeLeague({ ...league, matches: earlier });
  const after =
    match.status === "finished"
      ? analyzeLeague({ ...league, matches: [...earlier, match] })
      : null;
  const rated =
    after !== null && after.ratedMatches === before.ratedMatches + 1;
  const change = (id: string, role: Role): RatingChange => {
    const start = before.players.find((p) => p.player.id === id)!.rankPoints[
      role
    ];
    const end = rated
      ? after!.players.find((p) => p.player.id === id)!.rankPoints[role]
      : null;
    const history = after?.players
      .find((p) => p.player.id === id)
      ?.history.find((h) => h.match.id === match.id);
    const bonus =
      (role === "overall"
        ? history?.firstWinBonus
        : history?.roleFirstWinBonus) || 0;
    return {
      before: start,
      after: end,
      delta: end === null ? null : end - start,
      ...(league.firstWinPolicy && league.seasonId !== "beta"
        ? {
            firstWinBonus: bonus,
            baseDelta: end === null ? null : end - start - bonus,
          }
        : {}),
    };
  };
  const players: MatchRating[] = [];
  for (const [side, ids] of [
    ["home", match.homePlayers],
    ["away", match.awayPlayers],
  ] as const) {
    for (const id of ids) {
      if (!before.players.some((p) => p.player.id === id)) continue;
      const role = after?.players
        .find((p) => p.player.id === id)
        ?.history.find((r) => r.match.id === match.id)?.role;
      players.push({
        playerId: id,
        side,
        role,
        overall: change(id, "overall"),
        position: role ? change(id, role) : null,
      });
    }
  }
  return { rated, players };
}

export function relationships(
  stats: PlayerStats,
  kind: "partner" | "opponent",
): HeadToHead[] {
  const groups = new Map<string, Appearance[]>();
  for (const row of stats.history) {
    if (kind === "partner" && row.partners.length !== 1) continue;
    for (const id of kind === "partner" ? row.partners : row.opponents) {
      if (!groups.has(id)) groups.set(id, []);
      groups.get(id)!.push(row);
    }
  }
  return [...groups]
    .map(([id, rows]) => ({
      id,
      ...summarize(rows),
      matches: rows.map((r) => r.match),
    }))
    .sort(
      (a, b) =>
        b.games - a.games ||
        (b.winRate ?? 0) - (a.winRate ?? 0) ||
        a.id.localeCompare(b.id),
    );
}

export function teamHeadToHead(
  league: League,
  homeId: string,
  awayId: string,
): HeadToHead {
  const matches = league.matches
    .filter(
      (m) =>
        m.status === "finished" &&
        m.kind !== "pickup" &&
        ((m.homeId === homeId && m.awayId === awayId) ||
          (m.homeId === awayId && m.awayId === homeId)),
    )
    .slice()
    .sort(chronological);
  const rows = matches.map((match) => {
    const scores = score(match);
    const gf = scores[match.homeId === homeId ? 0 : 1],
      ga = scores[match.homeId === homeId ? 1 : 0];
    return { gf, ga, result: outcome(gf, ga) };
  });
  return { id: awayId, ...summarize(rows), matches };
}

export type RadarAxis = { label: string; value: number | null; raw: string };
const clamp = (n: number) => Math.max(0, Math.min(100, n));
const netScore = (n: number) => clamp(50 + 50 * Math.tanh(n / 5));
const strength = (m: Metrics) =>
  m.games ? (m.winRate! * 100 + netScore(m.avgDifference!)) / 2 : null;
const stability = (m: Metrics) =>
  m.deviation === null ? null : 100 / (1 + m.deviation / 5);
export function radarAxes(stats: PlayerStats, role: Role): RadarAxis[] {
  const m = stats[role];
  const percent = (n: number | null) =>
    n === null ? "—" : `${Math.round(n * 100)}%`;
  const numeric = (n: number | null) => (n === null ? "—" : n.toFixed(2));
  const win = {
    label:
      role === "overall"
        ? "总胜率"
        : role === "forward"
          ? "前锋胜率"
          : "后卫胜率",
    value: m.winRate === null ? null : m.winRate * 100,
    raw: percent(m.winRate),
  };
  const net = {
    label: "场均净胜球",
    value: m.avgDifference === null ? null : netScore(m.avgDifference),
    raw: numeric(m.avgDifference),
  };
  const close = {
    label: role === "defender" ? "抗压能力" : "关键局胜率",
    value: m.closeWinRate === null ? null : m.closeWinRate * 100,
    raw: percent(m.closeWinRate),
  };
  const steady = {
    label: "稳定性",
    value: stability(m),
    raw: m.deviation === null ? "—" : `σ ${m.deviation.toFixed(2)}`,
  };
  const rank = {
    label: role === "forward" ? "前锋段位分" : "后卫段位分",
    value: stats.ratedGames[role]
      ? clamp(50 + 50 * Math.tanh((stats.rankPoints[role] - RATING_BASE) / 200))
      : null,
    raw: stats.ratedGames[role] ? stats.rankPoints[role].toString() : "—",
  };
  if (role === "overall")
    return [
      win,
      net,
      {
        label: "前锋表现",
        value: strength(stats.forward),
        raw: stats.forward.games
          ? `${strength(stats.forward)!.toFixed(0)} 分`
          : "—",
      },
      {
        label: "后卫表现",
        value: strength(stats.defender),
        raw: stats.defender.games
          ? `${strength(stats.defender)!.toFixed(0)} 分`
          : "—",
      },
      steady,
      close,
    ];
  if (role === "defender")
    return [
      win,
      {
        label: "失球控制",
        value: m.avgAgainst === null ? null : 100 / (1 + m.avgAgainst / 5),
        raw: numeric(m.avgAgainst),
      },
      net,
      rank,
      close,
      steady,
    ];
  const groups = new Map<string, number[]>();
  for (const row of stats.history.filter(
    (r) => r.role === "forward" && r.partners.length === 1,
  )) {
    const id = row.partners[0];
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id)!.push(row.gf - row.ga);
  }
  const means = [...groups.values()]
    .filter((g) => g.length >= 2)
    .map((g) => g.reduce((a, b) => a + b, 0) / g.length);
  const mean = means.reduce((a, b) => a + b, 0) / (means.length || 1);
  const compatibility =
    means.length >= 2
      ? 100 /
        (1 +
          Math.sqrt(
            means.reduce((sum, n) => sum + (n - mean) ** 2, 0) / means.length,
          ) /
            5)
      : null;
  return [
    win,
    {
      label: "球队场均得分",
      value: m.avgFor === null ? null : (100 * m.avgFor) / (m.avgFor + 5),
      raw: numeric(m.avgFor),
    },
    net,
    close,
    rank,
    {
      label: "搭档适配性",
      value: compatibility,
      raw: compatibility === null ? "—" : `${means.length} 位搭档`,
    },
  ];
}
