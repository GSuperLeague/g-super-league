import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeLeague,
  archiveBetaLeague,
  leagueForSeason,
  matchRatings,
} from "../lib/analytics.ts";
import { applyAction, emptyLeague, standings } from "../lib/league.ts";
import type { League, Match } from "../lib/league.ts";
import {
  analyzeSingles,
  applySinglesAction,
  emptySinglesLeague,
  singlesForSeason,
  singlesStandings,
} from "../lib/singles.ts";
import { inheritRating, matchSeason, SEASON_START } from "../lib/seasons.ts";
import { betaReport, leadHistory } from "../lib/season-news.ts";
import { DOUBLES_TRUESKILL_POLICY, settleDoublesTrueSkill } from "../lib/rating-trueskill-v1.ts";

function fixture(): League {
  let league = emptyLeague();
  for (const id of ["a", "b"])
    league = applyAction(league, {
      type: "team.save",
      id,
      data: { name: id, short: id, color: "#365c49", bio: "" },
    });
  for (let i = 1; i <= 8; i++)
    league = applyAction(league, {
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
  return league;
}
function result(
  league: League,
  id: string,
  time: string,
  homeScore = 8,
  awayScore = 5,
) {
  return applyAction(league, {
    type: "match.result",
    id,
    data: {
      homeId: "a",
      awayId: "b",
      homeForwardId: "p1",
      homeDefenderId: "p2",
      awayForwardId: "p3",
      awayDefenderId: "p4",
      time,
      round: id,
      homeScore,
      awayScore,
    },
  });
}
test("season boundary uses Beijing midnight including equivalent UTC instants", () => {
  assert.equal(matchSeason("2026-11-01T23:59:59.999+08:00"), "beta");
  for (const time of [
    SEASON_START,
    "2026-11-01T16:00:00Z",
    "2026-11-02T04:00:00+08:00",
  ])
    assert.equal(matchSeason(time), "s1");
  assert.deepEqual(inheritRating(1526, 1532.123), {
    rankPoints: 1308,
    mmr: 1200 + 332.123 * 0.33,
  });
  assert.deepEqual(inheritRating(1000, 900.5), {
    rankPoints: 1200,
    mmr: 1200 - 299.5 * 0.33,
  });
});
test("season views independently inherit all three ratings and reset every result counter", () => {
  const league = result(fixture(), "old", "2026-11-01T15:59:59Z");
  const original = structuredClone(league);
  const old = analyzeLeague(leagueForSeason(league, "beta"));
  const next = leagueForSeason(league, "s1");
  const data = analyzeLeague(next);
  assert.equal(next.matches.length, 0);
  assert.ok(
    data.players.every(
      (p) =>
        p.overall.games === 0 &&
        p.overall.wins === 0 &&
        p.overall.gf === 0 &&
        p.history.length === 0 &&
        p.ratedGames.overall === 0,
    ),
  );
  assert.ok(
    standings(next).every((team) => team.played === 0 && team.points === 0),
  );
  for (const p of data.players)
    for (const role of ["overall", "forward", "defender"] as const) {
      const before = old.players.find((o) => o.player.id === p.player.id)!;
      const seed = inheritRating(before.rankPoints[role], before.mmr[role]);
      assert.equal(p.rankPoints[role], seed.rankPoints);
      assert.equal(p.mmr[role], seed.mmr);
    }
  assert.equal(data.players[0].rankPoints.forward, 1213);
  assert.equal(data.players[0].rankPoints.defender, 1200);
  assert.ok(data.players[2].mmr.overall < 1200);
  assert.deepEqual(league, original);
});
test("first-season match details begin at the inherited seeds, and Beta ignores all later results", () => {
  const beta = result(fixture(), "old", "2026-10-31T10:00:00Z");
  const baseline = analyzeLeague(leagueForSeason(beta, "beta"));
  const league = result(beta, "new", SEASON_START, 0, 10);
  assert.deepEqual(analyzeLeague(leagueForSeason(league, "beta")), baseline);
  const view = leagueForSeason(league, "s1");
  const rating = matchRatings(view, view.matches[0]);
  assert.equal(rating.rated, true);
  assert.equal(rating.players[0].overall.before, 1213);
  assert.equal(rating.players[0].position!.before, 1213);
  const players = analyzeLeague(view).players;
  assert.equal(players[0].overall.games, 1);
  assert.equal(players[0].overall.losses, 1);
  assert.equal(players[0].rankPoints.defender, 1200);
  assert.equal(players[0].rankPoints.overall, rating.players[0].overall.after);
  const edited = result(league, "old", "2026-10-31T10:00:00Z", 0, 10);
  assert.equal(
    leagueForSeason(edited, "s1").ratingSeeds!.p1.overall.rankPoints,
    1200,
  );
  assert.notDeepEqual(
    analyzeLeague(leagueForSeason(edited, "s1")).players,
    players,
  );
});

test("TrueSkill replays doubles from the season boundary with independent position uncertainty", () => {
  const past = result(fixture(), "old", "2026-11-01T15:59:59Z");
  const sealed = archiveBetaLeague(past, {
    lockedAt: SEASON_START,
    sourceRevision: 1,
    sourceCommit: "test",
  });
  const before = analyzeLeague(leagueForSeason(sealed, "beta"));
  const enabled = { ...sealed, doublesRatingPolicy: DOUBLES_TRUESKILL_POLICY };
  const close = leagueForSeason(result(structuredClone(enabled), "close", SEASON_START, 7, 6), "s1");
  const wide = leagueForSeason(result(structuredClone(enabled), "wide", SEASON_START, 7, 2), "s1");
  const closePlayer = analyzeLeague(close).players[0];
  const widePlayer = analyzeLeague(wide).players[0];
  assert.deepEqual(analyzeLeague(leagueForSeason(enabled, "beta")), before);
  assert.deepEqual(closePlayer.mmr, widePlayer.mmr);
  assert.notEqual(closePlayer.rankPoints.overall, widePlayer.rankPoints.overall);
  assert.ok(widePlayer.ratingUncertainty!.forward < wide.ratingUncertaintySeeds!.p1.forward);
  assert.equal(widePlayer.ratingUncertainty!.defender, 180);
  assert.equal(widePlayer.firstWinPoints.forward, 10);
  assert.equal(matchRatings(wide, wide.matches[0]).players[0].overall.after, widePlayer.rankPoints.overall);
  assert.equal(analyzeLeague(leagueForSeason(sealed, "s1")).players[0].ratingUncertainty, undefined);
});

test("a higher uncertainty gives a teammate more of the hidden rating correction", () => {
  const before = [80, 180, 80, 80].map((uncertainty) => ({ mean: 1200, uncertainty }));
  const { homeExpected, after } = settleDoublesTrueSkill(before, 0);
  assert.equal(homeExpected, 0.5);
  assert.ok(after[1].mean < after[0].mean && after[0].mean < 1200);
  assert.ok(after[1].uncertainty < 180);
  assert.equal(after[2].mean, after[3].mean);
});

test("draws pull different team estimates together and very unlikely wins stay finite", () => {
  const before = [20_000, 20_000, 1200, 1200].map((mean) => ({ mean, uncertainty: 180 }));
  const draw = settleDoublesTrueSkill(before, 0.5).after;
  assert.ok(draw[0].mean < before[0].mean && draw[2].mean > before[2].mean);
  const upset = settleDoublesTrueSkill(before, 0).after;
  assert.ok(upset.every((rating) => Number.isFinite(rating.mean) && rating.uncertainty > 0));
  assert.ok(upset[0].mean < before[0].mean && upset[2].mean > before[2].mean);
});
test("singles inherits its own Beta ratings without leaking old stats into new-season replay", () => {
  let singles = emptySinglesLeague();
  for (const [i, id] of ["p1", "p2"].entries())
    singles = applySinglesAction(singles, {
      type: "player.save",
      id,
      data: { name: id, nickname: "", number: i, photo: "", bio: "" },
    });
  const save = (id: string, time: string) => ({
    type: "match.result",
    id,
    data: {
      homeId: "p1",
      awayId: "p2",
      time,
      round: "1",
      homeScore: 10,
      awayScore: 0,
    },
  });
  singles = applySinglesAction(singles, save("old", "2026-10-31T10:00:00Z"));
  const old = analyzeSingles(singlesForSeason(singles, "beta"));
  const seeds = analyzeSingles(singlesForSeason(singles, "s1"));
  assert.equal(seeds[0].rankPoints, 1216);
  assert.equal(seeds[1].rankPoints, 1200);
  assert.equal(seeds[1].mmr, 1200 - 48 * 0.33);
  assert.equal(seeds[0].games, 0);
  assert.equal(
    singlesStandings([seeds[0], { ...seeds[1], games: 1 }], "rank")[0].player
      .id,
    "p1",
  );
  singles = applySinglesAction(singles, save("new", SEASON_START));
  const next = analyzeSingles(singlesForSeason(singles, "s1"));
  assert.equal(next[0].history[0].before, seeds[0].rankPoints);
  assert.equal(next[0].wins, 1);
  assert.deepEqual(analyzeSingles(singlesForSeason(singles, "beta")), old);
});
function detailed(
  league: League,
  id: string,
  players: string[],
  ownScorers: string[],
): League {
  const time = "2026-10-31T10:00:00Z";
  const goals = ownScorers.map((playerId, i) => ({
    id: `${id}-${i}`,
    playerId,
    ownGoal: true,
    teamId: players.slice(0, 2).includes(playerId) ? "b" : "a",
    minute: i,
    createdAt: time,
  }));
  const match: Match = {
    id,
    homeId: "a",
    awayId: "b",
    homePlayers: players.slice(0, 2),
    awayPlayers: players.slice(2),
    roles: {
      homeForwardId: players[0],
      homeDefenderId: players[1],
      awayForwardId: players[2],
      awayDefenderId: players[3],
    },
    time,
    round: id,
    status: "finished",
    goals,
  };
  return { ...league, matches: [...league.matches, match] };
}
test("Golden Own Goal uses per-game rates over finished detailed games with a three-game minimum", () => {
  let league = fixture();
  for (let i = 0; i < 6; i++)
    league = detailed(
      league,
      `m${i}`,
      i < 3 ? ["p1", "p2", "p3", "p4"] : ["p5", "p6", "p3", "p4"],
      [
        ...(i < 3 ? Array(i === 0 ? 2 : 1).fill("p1") : []),
        ...(i < 5 ? ["p3"] : []),
      ],
    );
  league = result(league, "summary", "2026-10-31T11:00:00Z", 100, 0);
  league = detailed(
    league,
    "live",
    ["p1", "p2", "p3", "p4"],
    Array(99).fill("p3"),
  );
  league.matches.at(-1)!.status = "live";
  // A huge total in just one detailed game must not qualify.
  league = detailed(
    league,
    "small",
    ["p7", "p8", "p3", "p4"],
    Array(50).fill("p7"),
  );
  const report = betaReport(league)!;
  const award = report.awards.find((a) => a.id === "own-goal")!;
  assert.equal(award.winner, "p1");
  assert.match(award.evidence, /4 次 \/ 3 场 = 1.33/);
  assert.equal(report.finished, 8);
  assert.equal(report.detailed, 7);
  assert.ok(
    !award.matchIds.includes("summary") && !award.matchIds.includes("live"),
  );
  assert.doesNotMatch(report.article.body, /MMR|隐藏分/);
  const after = result(league, "s1", SEASON_START, 999, 0);
  assert.deepEqual(betaReport(after), report);
});
test("lead-based awards require recorded goal order and never infer a comeback from a summary", () => {
  let league = result(fixture(), "summary", "2026-10-31T11:00:00Z", 8, 5);
  assert.equal(leadHistory(league.matches[0]), null);
  assert.ok(
    !betaReport(league)!.awards.some((a) =>
      ["resilience", "overturned"].includes(a.id),
    ),
  );
  league = detailed(
    league,
    "events",
    ["p1", "p2", "p3", "p4"],
    ["p1", "p2", "p3", "p3", "p4"],
  );
  const match = league.matches[1];
  match.goals.forEach((goal, i) => {
    goal.minute = 10 - i;
  });
  assert.deepEqual(leadHistory(match), { home: 1, away: 2 });
  match.status = "live";
  assert.equal(leadHistory(match), null);
});
