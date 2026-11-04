import test from "node:test";
import assert from "node:assert/strict";
import { emptyLeague, applyAction } from "../lib/league.ts";
import type { League } from "../lib/league.ts";
import {
  analyzeLeague,
  leagueForSeason,
  archiveBetaLeague,
  matchRatings,
} from "../lib/analytics.ts";
import { FIRST_WIN_POLICY } from "../lib/seasons.ts";
import { doublesRankHistory } from "../lib/rank-history.ts";
import {
  analyzeSingles,
  emptySinglesLeague,
  applySinglesAction,
  singlesForSeason,
  archiveBetaSingles,
} from "../lib/singles.ts";
import type { SinglesLeague } from "../lib/singles.ts";

function fixture(): League {
  return {
    ...emptyLeague(),
    players: ["a", "b", "c", "d"].map((id, i) => ({
      id,
      name: id,
      nickname: "",
      number: i + 1,
      position: "全能型",
      value: 0,
      bio: "",
      photo: "",
      skills: [50, 50, 50, 50, 50, 50],
      teamIds: [],
    })),
  };
}
function result(
  s: League,
  id: string,
  time: string,
  swap = false,
  win = true,
  draw = false,
): League {
  return applyAction(structuredClone(s), {
    type: "match.result",
    id,
    data: {
      kind: "pickup",
      time,
      round: id,
      homeForwardId: swap ? "b" : "a",
      homeDefenderId: swap ? "a" : "b",
      awayForwardId: "c",
      awayDefenderId: "d",
      homeScore: win ? 7 : 4,
      awayScore: draw ? 7 : win ? 4 : 7,
    },
  });
}
const options = {
  lockedAt: "2026-11-04T08:00:00Z",
  sourceRevision: 10,
  sourceCommit: "test-baseline-v1",
};
const stats = (s: League) => analyzeLeague(leagueForSeason(s, "s1"));
const player = (s: League, id = "a") =>
  stats(s).players.find((p) => p.player.id === id)!;

test("frozen beta v1 keeps the original 7:4 settlement anchors", () => {
  const s = archiveBetaLeague(result(fixture(), "beta", "2026-10-31T12:00:00+08:00"), options);
  const beta = analyzeLeague(leagueForSeason(s, "beta"));
  const winner = beta.players.find(p=>p.player.id==="a")!, loser=beta.players.find(p=>p.player.id==="c")!;
  assert.equal(winner.rankPoints.overall,1239);
  assert.equal(winner.rankPoints.forward,1239);
  assert.equal(winner.rankPoints.defender,1200);
  assert.equal(loser.rankPoints.overall,1183);
  assert.ok(Math.abs(winner.mmr.overall-1238.8571428571429)<1e-9);
  assert.ok(Math.abs(loser.mmr.overall-1161.142857142857)<1e-9);
  assert.equal(winner.firstWinPoints.overall,0);
});

test("forward and defender each grant one +10 per player/day, with a total daily cap of 20", () => {
  let s = fixture();
  s = result(s, "one", "2026-11-02T10:00:00+08:00");
  s = result(s, "two", "2026-11-02T11:00:00+08:00");
  s = result(s, "swap", "2026-11-02T12:00:00+08:00", true);
  s = result(s, "again", "2026-11-02T13:00:00+08:00", true);
  const plain = player(s),
    enabled = player({ ...s, firstWinPolicy: { ...FIRST_WIN_POLICY } });
  assert.deepEqual(enabled.firstWinPoints, {
    overall: 20,
    forward: 10,
    defender: 10,
  });
  assert.deepEqual(
    enabled.history.map((h) => h.firstWinBonus),
    [10, 0, 10, 0],
  );
  assert.equal(enabled.rankPoints.overall, plain.rankPoints.overall + 20);
  assert.equal(enabled.rankPoints.forward, plain.rankPoints.forward + 10);
  assert.equal(enabled.rankPoints.defender, plain.rankPoints.defender + 10);
  assert.deepEqual(enabled.mmr, plain.mmr);
  for (let i = 0; i < plain.history.length; i++)
    assert.equal(
      enabled.history[i].baseDelta,
      plain.history[i].rankPoints! - plain.history[i].rankBefore!,
    );
  assert.equal(
    player({ ...s, firstWinPolicy: { ...FIRST_WIN_POLICY } }, "b")
      .firstWinPoints.overall,
    20,
  );
});
test("losses, draws, unfinished games and incomplete position records cannot consume a first win", () => {
  let s = fixture();
  s = result(s, "loss", "2026-11-02T09:00:00+08:00", false, false);
  s = result(s, "draw", "2026-11-02T10:00:00+08:00", false, true, true);
  s = result(s, "live", "2026-11-02T11:00:00+08:00");
  s.matches.at(-1)!.status = "live";
  s = result(s, "unknown", "2026-11-02T12:00:00+08:00");
  delete s.matches.at(-1)!.summary;
  s.matches.at(-1)!.goals = [];
  s = result(s, "valid", "2026-11-02T13:00:00+08:00");
  s.firstWinPolicy = { ...FIRST_WIN_POLICY };
  const p = player(s);
  assert.equal(p.firstWinPoints.overall, 10);
  assert.equal(
    p.history.find((h) => h.match.id === "valid")!.firstWinBonus,
    10,
  );
  assert.equal(p.history.find((h) => h.match.id === "draw")!.firstWinBonus, 0);
  assert.equal(
    p.history.find((h) => h.match.id === "unknown")!.firstWinBonus,
    undefined,
  );
});
test("the day resets at Beijing midnight and beta never receives the new bonus", () => {
  let s = fixture();
  s = result(s, "beta", "2026-11-01T15:59:59Z");
  s = result(s, "start", "2026-11-01T16:00:00Z");
  s = result(s, "same-day", "2026-11-02T15:59:59Z");
  s = result(s, "next-day", "2026-11-02T16:00:00Z");
  const activated = archiveBetaLeague(s, options),
    p = player(activated);
  assert.deepEqual(
    p.history.map((h) => h.firstWinBonus),
    [10, 0, 10],
  );
  assert.equal(p.firstWinPoints.overall, 20);
  const beforeBeta = analyzeLeague(leagueForSeason(s, "beta")),
    afterBeta = analyzeLeague(leagueForSeason(activated, "beta"));
  assert.deepEqual(
    afterBeta.players.map((p) => p.rankPoints),
    beforeBeta.players.map((p) => p.rankPoints),
  );
  assert.deepEqual(
    afterBeta.players.map((p) => p.mmr),
    beforeBeta.players.map((p) => p.mmr),
  );
  assert.ok(afterBeta.players.every((p) => p.firstWinPoints.overall === 0));
});
test("backfilled matches use actual match order, and edited or deleted wins reassign the daily reward", () => {
  let s = fixture();
  s = result(s, "later", "2026-11-02T11:00:00+08:00");
  s = result(s, "earlier", "2026-11-02T10:00:00+08:00");
  s.firstWinPolicy = { ...FIRST_WIN_POLICY };
  assert.deepEqual(
    player(s).history.map((h) => [h.match.id, h.firstWinBonus]),
    [
      ["earlier", 10],
      ["later", 0],
    ],
  );
  s = result(s, "earlier", "2026-11-02T10:00:00+08:00", false, false);
  assert.deepEqual(
    player(s).history.map((h) => h.firstWinBonus),
    [0, 10],
  );
  s = applyAction(structuredClone(s), { type: "match.delete", id: "earlier" });
  assert.equal(player(s).firstWinPoints.overall, 10);
  assert.equal(player(s).history[0].firstWinBonus, 10);
});
test("filtering out an earlier win cannot manufacture another first win", () => {
  let s = fixture();
  s = result(s, "first", "2026-11-02T10:00:00+08:00");
  s = result(s, "second", "2026-11-02T11:00:00+08:00");
  s.firstWinPolicy = { ...FIRST_WIN_POLICY };
  const full = leagueForSeason(s, "s1"),
    filtered = {
      ...full,
      matches: full.matches.filter((m) => m.id === "second"),
    };
  assert.equal(
    analyzeLeague(filtered).players.find((p) => p.player.id === "a")!
      .firstWinPoints.overall,
    0,
  );
  assert.equal(
    matchRatings(
      full,
      full.matches.find((m) => m.id === "second")!,
    ).players.find((p) => p.playerId === "a")!.overall.firstWinBonus,
    0,
  );
});
test("the player ledger and match settlement agree on base + bonus for overall and the played position", () => {
  const s = {
    ...result(fixture(), "first", "2026-11-02T10:00:00+08:00"),
    firstWinPolicy: { ...FIRST_WIN_POLICY },
  };
  const season = leagueForSeason(s, "s1"),
    p = analyzeLeague(season).players.find((p) => p.player.id === "a")!,
    settled = matchRatings(season, season.matches[0]).players.find(
      (p) => p.playerId === "a",
    )!;
  for (const role of ["overall", "forward"] as const) {
    const row = doublesRankHistory(p.history, role)[0],
      change = role === "overall" ? settled.overall : settled.position!;
    assert.equal(row.firstWinBonus, 10);
    assert.equal(row.delta, row.baseDelta! + 10);
    assert.equal(row.after, change.after);
    assert.equal(row.before, change.before);
    assert.equal(row.delta, change.delta);
    assert.equal(change.delta, change.baseDelta! + 10);
  }
});
test("sealed beta uses frozen results, final scores, old settings and fixed inherited seeds", () => {
  let s = fixture();
  s = result(s, "beta", "2026-10-31T12:00:00+08:00");
  s = result(s, "new", "2026-11-02T12:00:00+08:00");
  const before = analyzeLeague(leagueForSeason(s, "beta")),
    oldSeeds = leagueForSeason(s, "s1").ratingSeeds;
  const sealed = archiveBetaLeague(s, options),
    archive = structuredClone(sealed.seasonArchives!.beta!);
  sealed.matches.find((m) => m.id === "beta")!.summary!.homeScore = 0;
  sealed.matches.find((m) => m.id === "beta")!.summary!.awayScore = 99;
  sealed.settings.win = 9;
  const view = leagueForSeason(sealed, "beta"),
    after = analyzeLeague(view);
  assert.equal(view.matches[0].summary!.homeScore, 7);
  assert.equal(view.settings.win, 3);
  assert.deepEqual(
    after.players.map((p) => p.rankPoints),
    before.players.map((p) => p.rankPoints),
  );
  assert.deepEqual(
    after.players.map((p) => p.mmr),
    before.players.map((p) => p.mmr),
  );
  assert.deepEqual(leagueForSeason(sealed, "s1").ratingSeeds, oldSeeds);
  assert.deepEqual(sealed.seasonArchives!.beta, archive);
  assert.throws(() => archiveBetaLeague(sealed, options), /已经封存/);
});
test("normal write actions cannot edit, reopen, delete or add beta matches, or move a new match into beta", () => {
  let s = fixture();
  s = result(s, "beta", "2026-10-31T12:00:00+08:00");
  s = result(s, "new", "2026-11-02T12:00:00+08:00");
  s = archiveBetaLeague(s, options);
  for (const type of [
    "match.delete",
    "match.reopen",
    "match.finish",
    "match.start",
    "goal.add",
    "goal.delete",
  ])
    assert.throws(
      () => applyAction(structuredClone(s), { type, id: "beta", data: {} }),
      /已封存/,
    );
  assert.throws(
    () => result(s, "added", "2026-10-31T13:00:00+08:00"),
    /已封存/,
  );
  assert.throws(() => result(s, "new", "2026-10-31T13:00:00+08:00"), /已封存/);
  assert.throws(() => result(s, "beta", "2026-11-02T13:00:00+08:00"), /已封存/);
  assert.doesNotThrow(() => result(s, "new", "2026-11-02T13:00:00+08:00"));
});
test("singles has its own once-per-day reward and independently frozen beta scores", () => {
  let s: SinglesLeague = {
    ...emptySinglesLeague(),
    players: ["a", "b"].map((id, i) => ({
      id,
      name: id,
      nickname: "",
      number: i + 1,
      bio: "",
      photo: "",
    })),
  };
  const record = (id: string, time: string) => {
    s = applySinglesAction(s, {
      type: "match.result",
      id,
      data: {
        homeId: "a",
        awayId: "b",
        time,
        round: id,
        homeScore: 7,
        awayScore: 4,
      },
    });
  };
  record("beta", "2026-10-31T12:00:00+08:00");
  record("one", "2026-11-02T10:00:00+08:00");
  record("two", "2026-11-02T11:00:00+08:00");
  record("three", "2026-11-03T11:00:00+08:00");
  const plain = analyzeSingles(singlesForSeason(s, "s1")).find(
      (p) => p.player.id === "a",
    )!,
    betaBefore = analyzeSingles(singlesForSeason(s, "beta"));
  s = archiveBetaSingles(s, options);
  const p = analyzeSingles(singlesForSeason(s, "s1")).find(
    (p) => p.player.id === "a",
  )!;
  assert.equal(p.firstWinPoints, 20);
  assert.equal(p.rankPoints, plain.rankPoints + 20);
  assert.equal(p.mmr, plain.mmr);
  assert.deepEqual(
    p.history.map((h) => h.firstWinBonus),
    [10, 0, 10],
  );
  assert.deepEqual(
    analyzeSingles(singlesForSeason(s, "beta")).map((p) => p.rankPoints),
    betaBefore.map((p) => p.rankPoints),
  );
  assert.throws(
    () => applySinglesAction(s, { type: "match.delete", id: "beta" }),
    /已封存/,
  );
});
