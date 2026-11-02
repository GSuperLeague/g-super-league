import test from "node:test";
import assert from "node:assert/strict";
import { analyzeLeague, leagueForSeason, matchRatings } from "../lib/analytics.ts";
import { applyAction, emptyLeague } from "../lib/league.ts";
import type { League } from "../lib/league.ts";
import { analyzeSingles, applySinglesAction, emptySinglesLeague, singlesForSeason } from "../lib/singles.ts";
import { doublesRankHistory, rankHistorySummary, singlesRankHistory } from "../lib/rank-history.ts";

function fixture() {
  let league = emptyLeague();
  for (const id of ["a", "b"])
    league = applyAction(league, { type: "team.save", id, data: { name: id, short: id, color: "#365c49", bio: "" } });
  for (let i = 1; i <= 5; i++)
    league = applyAction(league, {
      type: "player.save", id: `p${i}`,
      data: { name: `p${i}`, nickname: "", teamIds: ["a", "b"], number: i, position: "全能型", value: 0, bio: "", photo: "", skills: [50, 50, 50, 50, 50, 50] },
    });
  return league;
}
function result(league: League, id: string, time: string, homeScore: number, awayScore: number, swap = false) {
  return applyAction(league, {
    type: "match.result", id,
    data: { homeId: "a", awayId: "b", time, round: id, homeScore, awayScore, homeForwardId: swap ? "p2" : "p1", homeDefenderId: swap ? "p1" : "p2", awayForwardId: "p3", awayDefenderId: "p4" },
  });
}

test("player ledger shows newest first and agrees with each match's overall and position settlement", () => {
  let league = result(fixture(), "old", "2026-10-31T10:00:00Z", 7, 0);
  league = result(league, "first", "2026-11-02T08:00:00Z", 7, 5);
  league = result(league, "second", "2026-11-02T09:00:00Z", 0, 7, true);
  const view = leagueForSeason(league, "s1");
  const stats = analyzeLeague(view).players.find((p) => p.player.id === "p1")!;
  const original = structuredClone(stats.history);
  const ledger = doublesRankHistory(stats.history, "overall");
  assert.deepEqual(ledger.map((row) => row.matchId), ["second", "first"]);
  assert.equal(ledger[1].before, view.ratingSeeds!.p1.overall.rankPoints);
  assert.ok(ledger[1].before! > 1200, "use the inherited start, not a hardcoded 1200");
  assert.ok(ledger[0].delta! < 0);
  assert.ok(ledger[1].delta! > 0);
  assert.equal(rankHistorySummary(ledger).total, stats.rankPoints.overall - view.ratingSeeds!.p1.overall.rankPoints);
  for (const role of ["overall", "forward", "defender"] as const) {
    const rows = doublesRankHistory(stats.history, role);
    if (role !== "overall") assert.ok(rows.every((row) => row.role === role));
    for (const row of rows) {
      const match = view.matches.find((m) => m.id === row.matchId)!;
      const settlement = matchRatings(view, match).players.find((p) => p.playerId === "p1")!;
      const expected = role === "overall" ? settlement.overall : settlement.position!;
      assert.deepEqual({ before: row.before, after: row.after, delta: row.delta }, expected);
    }
  }
  assert.deepEqual(stats.history, original, "reading the ledger must not reverse source history in place");
  assert.deepEqual(ledger[0].partnerIds, ["p2"]);
  assert.deepEqual(ledger[0].opponentIds, ["p3", "p4"]);
});

test("legacy unrated appearances remain visible without fabricating a zero-point settlement", () => {
  const league = result(fixture(), "rated", "2026-11-02T08:00:00Z", 7, 0);
  league.matches.push({ id: "legacy", time: "2026-11-02T09:00:00Z", round: "旧记录", homeId: "a", awayId: "b", homePlayers: ["p1", "p2"], awayPlayers: ["p3", "p4"], status: "finished", goals: [] });
  league.matches.push({ ...league.matches[1], id: "pending", time: "2026-11-02T10:00:00Z", status: "live" });
  const stats = analyzeLeague(league).players.find((p) => p.player.id === "p1")!;
  const rows = doublesRankHistory(stats.history, "overall");
  assert.deepEqual(rows.map((row) => row.matchId), ["legacy", "rated"]);
  assert.deepEqual([rows[0].before, rows[0].after, rows[0].delta], [null, null, null]);
  assert.deepEqual(rankHistorySummary(rows), { latest: null, total: 48, ratedGames: 1 });
  const unused = analyzeLeague(league).players.find((p) => p.player.id === "p5")!;
  assert.deepEqual(doublesRankHistory(unused.history, "overall"), []);
  assert.deepEqual(rankHistorySummary([]), { latest: null, total: null, ratedGames: 0 });
});

test("editing or deleting an old result refreshes the ledger from the same replay used by rankings", () => {
  let league = result(fixture(), "first", "2026-11-02T08:00:00Z", 7, 0);
  league = result(league, "second", "2026-11-02T09:00:00Z", 7, 5);
  const rows = (source: League) => doublesRankHistory(analyzeLeague(source).players[0].history, "overall");
  const before = rows(league);
  const edited = result(league, "first", "2026-11-02T08:00:00Z", 0, 7);
  assert.notEqual(rows(edited)[0].before, before[0].before);
  assert.ok(rows(edited)[1].delta! < 0);
  const deleted = applyAction(edited, { type: "match.delete", id: "first" });
  assert.deepEqual(rows(deleted).map((row) => row.matchId), ["second"]);
  assert.equal(rows(deleted)[0].before, 1200);
});

test("singles uses its own season settlement and preserves a real zero-point change", () => {
  let league = emptySinglesLeague();
  for (const [i, id] of ["p1", "p2"].entries())
    league = applySinglesAction(league, { type: "player.save", id, data: { name: id, nickname: "", number: i + 1, photo: "", bio: "" } });
  for (const [id, time, homeScore, awayScore] of [
    ["old", "2026-10-31T10:00:00Z", 7, 0],
    ["new", "2026-11-02T08:00:00Z", 0, 7],
  ] as const)
    league = applySinglesAction(league, { type: "match.result", id, data: { homeId: "p1", awayId: "p2", time, round: id, homeScore, awayScore } });
  const view = singlesForSeason(league, "s1");
  const stats = analyzeSingles(view)[0];
  const rows = singlesRankHistory(stats.history);
  assert.deepEqual(rows.map((row) => row.matchId), ["new"]);
  assert.equal(rows[0].before, view.ratingSeeds!.p1.rankPoints);
  assert.equal(rows[0].delta, stats.history[0].delta);
  assert.deepEqual(rows[0].opponentIds, ["p2"]);
  const zero = { ...stats.history[0], before: 0, after: 0, delta: 0 };
  assert.deepEqual(rankHistorySummary(singlesRankHistory([zero])), { latest: 0, total: 0, ratedGames: 1 });
});
