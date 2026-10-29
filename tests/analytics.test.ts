import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeLeague,
  matchRatings,
  positionContext,
  radarAxes,
  relationships,
  summarize,
  swapComparisons,
  teamHeadToHead,
} from "../lib/analytics.ts";
import { applyAction, emptyLeague } from "../lib/league.ts";
import type { League } from "../lib/league.ts";

function fixture(): League {
  let s = emptyLeague();
  for (const id of ["a", "b"])
    s = applyAction(s, {
      type: "team.save",
      id,
      data: { name: id, short: id, color: "#365c49", bio: "" },
    });
  for (let i = 1; i <= 5; i++)
    s = applyAction(s, {
      type: "player.save",
      id: `p${i}`,
      data: {
        name: `p${i}`,
        nickname: "",
        teamIds: ["a", "b"],
        number: i,
        position: "全能型",
        value: 0,
        bio: "",
        photo: "",
        skills: [50, 50, 50, 50, 50, 50],
      },
    });
  return s;
}
const result = (id = "m1", data = {}) => ({
  type: "match.result",
  id,
  data: {
    homeId: "a",
    awayId: "b",
    time: "2026-10-19T10:00:00Z",
    round: "R1",
    homeForwardId: "p1",
    homeDefenderId: "p2",
    awayForwardId: "p3",
    awayDefenderId: "p4",
    homeScore: 8,
    awayScore: 5,
    ...data,
  },
});

test("personal and role metrics use team scores, with no fabricated personal goals", () => {
  let league = applyAction(fixture(), result());
  league = applyAction(
    league,
    result("m2", {
      time: "2026-10-19T11:00:00Z",
      homeForwardId: "p2",
      homeDefenderId: "p1",
      homeScore: 0,
      awayScore: 2,
    }),
  );
  const p = analyzeLeague(league).players.find((p) => p.player.id === "p1")!;
  assert.deepEqual(
    [
      p.overall.games,
      p.overall.wins,
      p.overall.losses,
      p.overall.gf,
      p.overall.ga,
      p.overall.gd,
    ],
    [2, 1, 1, 8, 7, 1],
  );
  assert.equal(p.overall.winRate, 0.5);
  assert.equal(p.forward.avgFor, 8);
  assert.equal(p.defender.avgFor, 0);
  assert.equal(p.defender.closeWinRate, 0);
  assert.equal("goals" in p, false);
  assert.equal(
    analyzeLeague(league).players.find((p) => p.player.id === "p5")!.overall
      .winRate,
    null,
  );
});

test("MMR uses weighted pre-match team averages, and edits/deletion replay both ratings", () => {
  const first = applyAction(fixture(), result());
  const a = analyzeLeague(first);
  // At 8:5, margin = 1.1875, MMR = 32 * margin, RP = +32/-14 * margin.
  assert.equal(a.players[0].mmr.overall, 1238);
  assert.equal(a.players[1].mmr.defender, 1238);
  assert.equal(a.players[2].mmr.overall, 1162);
  assert.equal(a.players[0].rankPoints.overall, 1238);
  assert.equal(a.players[1].rankPoints.defender, 1238);
  assert.equal(a.players[2].rankPoints.overall, 1183);
  assert.equal(a.players[0].rankPoints.defender, 1200);
  assert.equal(
    a.players.reduce((sum, p) => sum + p.rankPoints.overall, 0),
    6042,
  );
  assert.equal(a.players[0].mmr.defender, 1200);
  assert.equal(
    a.players.reduce((sum, p) => sum + p.mmr.overall, 0),
    6000,
  );
  let next = applyAction(
    structuredClone(first),
    result("m2", { time: "2026-10-19T11:00:00Z" }),
  );
  const increased = analyzeLeague(next).players[0].mmr.overall;
  assert.ok(increased > 1238 && increased < 1276);
  const reverseOrder = { ...next, matches: [...next.matches].reverse() };
  assert.deepEqual(analyzeLeague(reverseOrder), analyzeLeague(next));
  next = applyAction(next, { type: "match.delete", id: "m2" });
  assert.deepEqual(
    analyzeLeague(next).players.map((p) => p.mmr),
    a.players.map((p) => p.mmr),
  );
  assert.deepEqual(
    analyzeLeague(next).players.map((p) => p.rankPoints),
    a.players.map((p) => p.rankPoints),
  );
  next = applyAction(next, result("m1", { homeScore: 5, awayScore: 8 }));
  assert.equal(analyzeLeague(next).players[0].mmr.overall, 1162);
  assert.equal(analyzeLeague(next).players[0].rankPoints.overall, 1183);
});

test("strong opponents reward upset wins more, while draws conserve rating", () => {
  let league = applyAction(fixture(), result());
  league = applyAction(
    league,
    result("m2", { time: "2026-10-19T11:00:00Z", homeScore: 4, awayScore: 8 }),
  );
  const p3 = analyzeLeague(league).players[2];
  assert.ok(p3.mmr.overall > 1200);
  const drawn = analyzeLeague(
    applyAction(fixture(), result("m", { homeScore: 5, awayScore: 5 })),
  );
  assert.ok(drawn.players.every((p) => p.mmr.overall === 1200));
  assert.equal(drawn.players[0].rankPoints.overall, 1204);
  assert.equal(drawn.players[2].rankPoints.overall, 1204);
  assert.equal(drawn.players[0].overall.closeWinRate, 0);
});

test("teammates share MMR changes but get individual pre-match catch-up adjustments", () => {
  let league = fixture();
  for (let i = 0; i < 6; i++)
    league = applyAction(
      league,
      result(`warmup${i}`, {
        time: `2026-10-19T10:0${i}:00Z`,
        homeScore: 10,
        awayScore: 0,
      }),
    );
  const before = analyzeLeague(league).players;
  league = applyAction(
    league,
    result("mixed", {
      time: "2026-10-19T11:00:00Z",
      homeDefenderId: "p5",
      homeScore: 10,
      awayScore: 0,
    }),
  );
  const after = analyzeLeague(league).players;
  assert.equal(after[0].rankPoints.overall - before[0].rankPoints.overall, 16);
  assert.ok(
    after[4].rankPoints.overall - before[4].rankPoints.overall >
      after[0].rankPoints.overall - before[0].rankPoints.overall,
  );
  assert.ok(
    Math.abs(
      after[0].mmr.overall -
        before[0].mmr.overall -
        (after[4].mmr.overall - before[4].mmr.overall),
    ) < 1e-10,
  );
  assert.equal(after[4].ratedGames.overall, 1);
  assert.equal(after[4].rankPoints.defender, after[4].rankPoints.overall);
  assert.equal(after[4].rankPoints.forward, 1200);
});

test("doubles settlement is invariant to changing sides and roster iteration order", () => {
  let league = applyAction(fixture(), result());
  league = applyAction(
    league,
    result("m2", {
      time: "2026-10-19T11:00:00Z",
      homeDefenderId: "p5",
      awayForwardId: "p2",
      homeScore: 3,
      awayScore: 8,
    }),
  );
  league = applyAction(
    league,
    result("m3", {
      time: "2026-10-19T12:00:00Z",
      homeForwardId: "p2",
      homeDefenderId: "p3",
      awayForwardId: "p5",
      awayDefenderId: "p1",
      homeScore: 5,
      awayScore: 5,
    }),
  );
  const swapped = structuredClone(league);
  for (const m of swapped.matches) {
    [m.homeId, m.awayId] = [m.awayId, m.homeId];
    [m.homePlayers, m.awayPlayers] = [m.awayPlayers, m.homePlayers];
    const s = m.summary!;
    [s.homeScore, s.awayScore] = [s.awayScore, s.homeScore];
    [s.homeForwardId, s.awayForwardId] = [s.awayForwardId, s.homeForwardId];
    [s.homeDefenderId, s.awayDefenderId] = [s.awayDefenderId, s.homeDefenderId];
  }
  const reordered = structuredClone(league);
  reordered.players.reverse();
  for (const m of reordered.matches) {
    m.homePlayers.reverse();
    m.awayPlayers.reverse();
  }
  const settled = (source: League) =>
    analyzeLeague(source)
      .players.map((p) => ({
        id: p.player.id,
        mmr: p.mmr,
        rankPoints: p.rankPoints,
        ratedGames: p.ratedGames,
        history: p.history.map((h) => ({
          rankBefore: h.rankBefore,
          rankPoints: h.rankPoints,
          roleRankBefore: h.roleRankBefore,
          roleRankPoints: h.roleRankPoints,
          partnerRankBefore: h.partnerRankBefore,
          opponentRankBefore: h.opponentRankBefore,
        })),
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
  assert.deepEqual(settled(swapped), settled(league));
  assert.deepEqual(settled(reordered), settled(league));
  const matchSettlements = (source: League) =>
    source.matches.map((m) =>
      matchRatings(source, m)
        .players.map(({ playerId, role, overall, position }) => ({
          playerId,
          role,
          overall,
          position,
        }))
        .sort((a, b) => a.playerId.localeCompare(b.playerId)),
    );
  assert.deepEqual(matchSettlements(swapped), matchSettlements(league));
  assert.deepEqual(matchSettlements(reordered), matchSettlements(league));
});

test("pair and opponent records are symmetric and pickup is excluded from team encounters", () => {
  const league = applyAction(
    fixture(),
    result("pickup", { kind: "pickup", homeScore: 7, awayScore: 6 }),
  );
  const stats = analyzeLeague(league);
  const p1 = stats.players[0],
    p3 = stats.players[2];
  assert.equal(stats.pairs.length, 2);
  assert.equal(relationships(p1, "partner")[0].id, "p2");
  assert.equal(
    relationships(p1, "opponent").find((p) => p.id === "p3")!.wins,
    1,
  );
  assert.equal(
    relationships(p3, "opponent").find((p) => p.id === "p1")!.losses,
    1,
  );
  assert.equal(teamHeadToHead(league, "a", "b").games, 0);
  assert.equal(stats.ratedMatches, 1);
});

test("legacy results count overall appearances without guessing roles or splitting larger rosters", () => {
  const league = applyAction(fixture(), result());
  delete league.matches[0].summary;
  league.matches[0].homePlayers.push("p5");
  const data = analyzeLeague(league);
  assert.equal(data.players[0].overall.games, 1);
  assert.equal(data.players[0].forward.games, 0);
  assert.equal(data.ratedMatches, 0);
  assert.equal(data.pairs.length, 1);
  assert.equal(relationships(data.players[0], "partner").length, 0);
  assert.ok(data.players.every((p) => p.mmr.overall === 1200));
  const league2 = structuredClone(league);
  league2.players[0].position = "前锋";
  assert.deepEqual(
    analyzeLeague(league2).players[0].forward,
    data.players[0].forward,
  );
});

test("scheduled/live games are excluded, streaks break at draws, and no-sample radar axes stay missing", () => {
  const league = applyAction(fixture(), result());
  league.matches[0].status = "live";
  const stats = analyzeLeague(league).players[0];
  assert.equal(stats.overall.games, 0);
  assert.ok(radarAxes(stats, "overall").every((a) => a.value === null));
  assert.ok(radarAxes(stats, "forward").every((a) => a.value === null));
  const summary = summarize([
    { gf: 8, ga: 5, result: "W" },
    { gf: 7, ga: 6, result: "W" },
    { gf: 3, ga: 3, result: "D" },
    { gf: 6, ga: 5, result: "W" },
  ]);
  assert.equal(summary.longestStreak, 2);
  assert.equal(summary.currentStreak, 1);
  assert.equal(summary.closeGames, 3);
  assert.equal(summary.closeWinRate, 2 / 3);
});

test("role changes use historical records and detailed team encounters honor home/away orientation", () => {
  let league = applyAction(fixture(), result());
  league = applyAction(
    league,
    result("m2", {
      time: "2026-10-19T11:00:00Z",
      homeId: "b",
      awayId: "a",
      homeScore: 2,
      awayScore: 7,
    }),
  );
  const encounter = teamHeadToHead(league, "a", "b");
  assert.deepEqual(
    [encounter.games, encounter.wins, encounter.gf, encounter.ga],
    [2, 2, 15, 7],
  );
  const original = analyzeLeague(league).players[0];
  league.players[0].position = "后卫";
  assert.deepEqual(analyzeLeague(league).players[0].forward, original.forward);
});

test("recent form uses last ten games and stable same-time ordering", () => {
  let league = fixture();
  for (let i = 0; i < 12; i++)
    league = applyAction(
      league,
      result(`m${String(i).padStart(2, "0")}`, {
        time: `2026-10-19T${String(i).padStart(2, "0")}:00:00Z`,
        homeScore: i === 0 ? 0 : 8,
      }),
    );
  const p = analyzeLeague(league).players[0];
  assert.equal(p.recent.games, 10);
  assert.equal(p.recent.wins, 10);
  assert.equal(p.overall.longestStreak, 11);
  assert.ok(
    radarAxes(p, "overall").every(
      (a) =>
        a.value === null ||
        (Number.isFinite(a.value) && a.value >= 0 && a.value <= 100),
    ),
  );
});

test("goal share averages matches equally, excludes scoreless draws, and intervals reflect sample size", () => {
  const rows = [
    { gf: 10, ga: 0, result: "W" as const },
    { gf: 1, ga: 1, result: "D" as const },
    { gf: 0, ga: 0, result: "D" as const },
  ];
  assert.equal(summarize(rows).goalShare, 0.75);
  assert.equal(summarize([rows[2]]).goalShare, null);
  assert.equal(summarize([]).winInterval, null);
  const single = summarize([rows[0]]).winInterval!;
  const many = summarize(
    Array.from({ length: 10 }, () => rows[0]),
  ).winInterval!;
  assert.ok(Math.abs(single[0] - 0.2065) < 0.001);
  assert.ok(Math.abs(single[1] - 1) < 1e-12);
  assert.ok(many[0] > single[0]);
  assert.equal(summarize([rows[2]]).winInterval![0], 0);
});

test("position pairs distinguish role direction and swaps hold opponents and their positions fixed", () => {
  let league = applyAction(fixture(), result());
  league = applyAction(
    league,
    result("m2", {
      time: "2026-10-19T11:00:00Z",
      homeForwardId: "p2",
      homeDefenderId: "p1",
      homeScore: 3,
      awayScore: 8,
    }),
  );
  league = applyAction(
    league,
    result("m3", {
      time: "2026-10-19T12:00:00Z",
      awayForwardId: "p4",
      awayDefenderId: "p3",
    }),
  );
  league = applyAction(
    league,
    result("m4", {
      time: "2026-10-19T13:00:00Z",
      homeId: "b",
      awayId: "a",
      homeForwardId: "p3",
      homeDefenderId: "p4",
      awayForwardId: "p2",
      awayDefenderId: "p1",
      homeScore: 4,
      awayScore: 7,
    }),
  );
  const data = analyzeLeague(league);
  assert.equal(data.pairs.find((p) => p.ids.includes("p1"))!.games, 4);
  assert.equal(
    data.positionPairs.find(
      (p) => p.forwardId === "p1" && p.defenderId === "p2",
    )!.games,
    2,
  );
  const comparison = swapComparisons(data).find(
    (g) => g.opponents[0] === "p3" && g.opponents[1] === "p4",
  )!;
  assert.ok(comparison);
  assert.equal(comparison.variants.find((v) => v.forwardId === "p1")!.games, 1);
  const reversed = comparison.variants.find((v) => v.forwardId === "p2")!;
  assert.deepEqual(
    [reversed.games, reversed.wins, reversed.gf, reversed.ga],
    [2, 1, 10, 12],
  );
  assert.equal(
    comparison.variants.flatMap((v) => v.matches).some((m) => m.id === "m3"),
    false,
  );
});

test("match ratings preserve before/after values, separate position ratings, and ignore later games", () => {
  let league = applyAction(fixture(), result());
  league = applyAction(
    league,
    result("m2", {
      time: "2026-10-19T11:00:00Z",
      homeForwardId: "p2",
      homeDefenderId: "p1",
      homeScore: 4,
      awayScore: 8,
    }),
  );
  const second = matchRatings(league, league.matches[1]);
  assert.equal(second.rated, true);
  const p1 = second.players.find((p) => p.playerId === "p1")!;
  assert.equal(p1.role, "defender");
  assert.equal(p1.overall.before, 1238);
  assert.equal(p1.position!.before, 1200);
  assert.notEqual(p1.overall.delta, p1.position!.delta);
  assert.equal(p1.overall.after! - p1.overall.before, p1.overall.delta);
  assert.ok(second.players.reduce((sum, p) => sum + p.overall.delta!, 0) > 0);
  assert.deepEqual(matchRatings(league, league.matches[0]).players[0].overall, {
    before: 1200,
    after: 1238,
    delta: 38,
  });
  league = applyAction(
    league,
    result("m3", { time: "2026-10-19T12:00:00Z", homeScore: 0, awayScore: 9 }),
  );
  assert.deepEqual(matchRatings(league, league.matches[1]), second);
  assert.deepEqual(
    matchRatings(
      { ...league, matches: [...league.matches].reverse() },
      league.matches[1],
    ),
    second,
  );
  league = applyAction(league, result("m1", { homeScore: 0, awayScore: 9 }));
  assert.equal(
    matchRatings(league, league.matches[1]).players.find(
      (p) => p.playerId === "p1",
    )!.overall.before,
    1179,
  );
  league = applyAction(league, { type: "match.delete", id: "m1" });
  assert.equal(
    matchRatings(
      league,
      league.matches.find((m) => m.id === "m2")!,
    ).players.find((p) => p.playerId === "p1")!.overall.before,
    1200,
  );
});

test("unsettled and ineligible games have no fabricated Elo change", () => {
  let league = applyAction(fixture(), result());
  league = applyAction(league, result("m2", { time: "2026-10-19T11:00:00Z" }));
  league = applyAction(league, result("m3", { time: "2026-10-19T12:00:00Z" }));
  const pending = {
    ...league.matches[1],
    status: "scheduled" as const,
    summary: undefined,
  };
  const resultPending = matchRatings(league, pending);
  assert.equal(resultPending.rated, false);
  assert.equal(resultPending.players[0].overall.before, 1238);
  assert.equal(resultPending.players[0].overall.after, null);
  assert.equal(resultPending.players[0].overall.delta, null);
  assert.equal(resultPending.players[0].position, null);
  const ineligible = { ...league.matches[1], summary: undefined };
  assert.ok(
    matchRatings(league, ineligible).players.every(
      (p) => p.overall.after === null,
    ),
  );
  assert.equal(
    analyzeLeague({ ...league, matches: [ineligible] }).positionPairs.length,
    0,
  );
});

test("opponent and partner context uses historical pre-match ratings and recorded roles", () => {
  let league = applyAction(fixture(), result());
  league = applyAction(league, result("m2", { time: "2026-10-19T11:00:00Z" }));
  const stats = analyzeLeague(league).players[0];
  assert.equal(stats.history[1].rankBefore, 1238);
  assert.equal(stats.history[1].roleRankBefore, 1238);
  const context = positionContext(stats, "forward");
  assert.deepEqual(context, {
    partners: 1,
    opponents: 2,
    ratedGames: 2,
    partnerRankPoints: 1219,
    opponentRankPoints: 1191.5,
  });
  assert.equal(positionContext(stats, "defender").partnerRankPoints, null);
  league = applyAction(league, result("m3", { time: "2026-10-19T12:00:00Z" }));
  assert.deepEqual(
    analyzeLeague(league).players[0].history.slice(0, 2),
    stats.history,
  );
});

test("relative winning margin scales MMR and rank points without using manual attributes", () => {
  const small = applyAction(
    fixture(),
    result("m1", { homeScore: 7, awayScore: 6 }),
  );
  const large = applyAction(
    fixture(),
    result("m1", { homeScore: 10, awayScore: 0 }),
  );
  large.players[0].skills = [100, 100, 100, 100, 100, 100];
  large.players[0].value = 999;
  large.players[0].position = "后卫";
  const narrow = analyzeLeague(small).players[0];
  const wide = analyzeLeague(large).players[0];
  assert.ok(wide.mmr.overall > narrow.mmr.overall);
  assert.ok(wide.rankPoints.overall > narrow.rankPoints.overall);
  assert.equal(wide.mmr.forward, 1248);
  assert.equal(wide.rankPoints.forward, 1248);
  const sameMargin = applyAction(
    fixture(),
    result("m1", { homeScore: 7, awayScore: 0 }),
  );
  assert.deepEqual(
    analyzeLeague(sameMargin).players.map((p) => [p.mmr, p.rankPoints]),
    analyzeLeague(large).players.map((p) => [p.mmr, p.rankPoints]),
  );
});
