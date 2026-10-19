import { score } from "./league.ts";
import type { League, Match, Player } from "./league.ts";

export type Role = "overall" | "forward" | "defender";
export type Result = "W" | "D" | "L";
export const ELO_BASE = 1200;
export const ELO_K = 32;
export const MIN_SAMPLE = 3;
export type Appearance = {
  match: Match;
  result: Result;
  gf: number;
  ga: number;
  role?: "forward" | "defender";
  partners: string[];
  opponents: string[];
  elo?: number;
  roleElo?: number;
  eloBefore?: number;
  roleEloBefore?: number;
  partnerEloBefore?: number;
  opponentEloBefore?: number;
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
  elo: Record<Role, number>;
  ratedGames: Record<Role, number>;
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

export function analyzeLeague(league: League): Analytics {
  const histories = new Map(
    league.players.map((p) => [p.id, [] as Appearance[]]),
  );
  const ratings = new Map(
    league.players.map((p) => [
      p.id,
      { overall: ELO_BASE, forward: ELO_BASE, defender: ELO_BASE },
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
    const summary = match.summary;
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
    const preRatings = new Map(
      roles.map((id) => [id, { ...ratings.get(id)! }]),
    );
    const deltas: { id: string; role: Role; value: number }[] = [];
    if (rated) {
      ratedMatches++;
      const homeResult =
        homeScore > awayScore ? 1 : homeScore < awayScore ? 0 : 0.5;
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
        const expected =
          1 /
          (1 +
            10 **
              (((before[2] + before[3]) / 2 - (before[0] + before[1]) / 2) /
                400));
        const delta = ELO_K * (homeResult - expected);
        roles.forEach((id, i) =>
          deltas.push({
            id,
            role:
              mode === "overall"
                ? "overall"
                : i % 2 === 0
                  ? "forward"
                  : "defender",
            value: i < 2 ? delta : -delta,
          }),
        );
      }
      for (const { id, role, value } of deltas) {
        ratings.get(id)![role] += value;
        ratedGames.get(id)![role]++;
      }
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
          elo: rated ? ratings.get(id)!.overall : undefined,
          roleElo: rated && role ? ratings.get(id)![role] : undefined,
          eloBefore: rated ? preRatings.get(id)!.overall : undefined,
          roleEloBefore: rated && role ? preRatings.get(id)![role] : undefined,
          partnerEloBefore: rated
            ? preRatings.get(roster.find((pid) => pid !== id)!)!.overall
            : undefined,
          opponentEloBefore: rated
            ? rosters[1 - side].reduce(
                (sum, pid) => sum + preRatings.get(pid)!.overall,
                0,
              ) / 2
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
        elo: ratings.get(player.id)!,
        ratedGames: ratedGames.get(player.id)!,
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

export function positionContext(stats: PlayerStats, role: Role) {
  const rows = stats.history.filter(
    (r) => role === "overall" || r.role === role,
  );
  const rated = rows.filter(
    (r) =>
      r.partnerEloBefore !== undefined && r.opponentEloBefore !== undefined,
  );
  return {
    partners: new Set(rows.flatMap((r) => r.partners)).size,
    opponents: new Set(rows.flatMap((r) => r.opponents)).size,
    ratedGames: rated.length,
    partnerElo: rated.length
      ? rated.reduce((sum, r) => sum + r.partnerEloBefore!, 0) / rated.length
      : null,
    opponentElo: rated.length
      ? rated.reduce((sum, r) => sum + r.opponentEloBefore!, 0) / rated.length
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
      const s = match.summary!;
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
    const start = before.players.find((p) => p.player.id === id)!.elo[role];
    const end = rated
      ? after!.players.find((p) => p.player.id === id)!.elo[role]
      : null;
    return {
      before: start,
      after: end,
      delta: end === null ? null : end - start,
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
  const elo = {
    label: role === "forward" ? "前锋 Elo" : "后卫 Elo",
    value: stats.ratedGames[role]
      ? clamp(50 + 50 * Math.tanh((stats.elo[role] - ELO_BASE) / 200))
      : null,
    raw: stats.ratedGames[role] ? Math.round(stats.elo[role]).toString() : "—",
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
      elo,
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
    elo,
    {
      label: "搭档适配性",
      value: compatibility,
      raw: compatibility === null ? "—" : `${means.length} 位搭档`,
    },
  ];
}
