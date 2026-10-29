import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeSingles,
  applySinglesAction,
  emptySinglesLeague,
  singlesScore,
  singlesStandings,
} from "../lib/singles.ts";
import type { SinglesLeague } from "../lib/singles.ts";
import { applyAction, emptyLeague } from "../lib/league.ts";
import { analyzeLeague } from "../lib/analytics.ts";

function fixture() {
  let s = emptySinglesLeague();
  for (const [i, id] of ["a", "b", "c"].entries())
    s = applySinglesAction(s, {
      type: "player.save",
      id,
      data: { name: id, nickname: "", number: i, bio: "", photo: "" },
    });
  return s;
}
const match = (
  homeId = "a",
  awayId = "b",
  time = "2026-10-26T10:00:00+08:00",
) => ({ homeId, awayId, time, round: "1" });
const result = (
  s: SinglesLeague,
  id: string,
  homeScore: number,
  awayScore: number,
  time?: string,
) =>
  applySinglesAction(s, {
    type: "match.result",
    id,
    data: { ...match("a", "b", time), homeScore, awayScore },
  });
test("singles players do not require teams and reject doubles avatars and documents", () => {
  const s = fixture();
  assert.equal(s.teams.length, 0);
  assert.equal(s.players.length, 3);
  assert.throws(
    () =>
      applySinglesAction(emptyLeague() as unknown as SinglesLeague, {
        type: "player.delete",
        id: "a",
      }),
    /数据库格式/,
  );
  assert.throws(
    () =>
      applySinglesAction(s, {
        type: "player.save",
        id: "a",
        data: { ...s.players[0], photo: "/api/photos/abc" },
      }),
    /单打球员头像/,
  );
  assert.throws(
    () =>
      applySinglesAction(s, {
        type: "player.save",
        id: "b",
        data: s.players[0],
      }),
    /号码/,
  );
});
test("singles fixtures validate distinct registered opponents and immutable identities", () => {
  const s = fixture();
  for (const data of [
    match("a", "a"),
    match("a", "doubles-only"),
    { ...match(), time: "bad" },
  ])
    assert.throws(() =>
      applySinglesAction(s, { type: "match.save", id: "m", data }),
    );
  const scheduled = applySinglesAction(s, {
    type: "match.save",
    id: "m",
    data: match(),
  });
  assert.throws(
    () =>
      applySinglesAction(scheduled, {
        type: "match.save",
        id: "m",
        data: match("a", "c"),
      }),
    /不能更换/,
  );
  assert.throws(
    () => applySinglesAction(scheduled, { type: "player.delete", id: "a" }),
    /已有比赛/,
  );
  assert.equal(s.matches.length, 0);
});
test("live scores and own goals are idempotent, undoable, and excluded from ratings until finished", () => {
  let s = applySinglesAction(fixture(), {
    type: "match.save",
    id: "m",
    data: { ...match(), startNow: true },
  });
  const add = {
    type: "goal.add",
    id: "m",
    data: { id: "g", teamId: "a", playerId: "b", ownGoal: true },
  };
  s = applySinglesAction(s, add);
  s = applySinglesAction(s, add);
  assert.deepEqual(singlesScore(s.matches[0]), [1, 0]);
  let stats = analyzeSingles(s);
  assert.equal(stats[0].mmr, 1200);
  assert.equal(stats[0].points, 0);
  assert.equal(stats[1].ownGoals, 1);
  assert.throws(
    () =>
      applySinglesAction(s, {
        type: "goal.add",
        id: "m",
        data: { ...add.data, id: "invalid", playerId: "a" },
      }),
    /不符/,
  );
  s = applySinglesAction(s, { type: "match.finish", id: "m" });
  stats = analyzeSingles(s);
  assert.equal(stats[0].mmr, 1248);
  assert.equal(stats[1].mmr, 1152);
  assert.equal(stats[0].rankPoints, 1248);
  assert.equal(stats[1].rankPoints, 1179);
  assert.equal(stats[0].history[0].delta, 48);
  assert.equal(stats[1].history[0].delta, -21);
  assert.equal(stats[0].points, 3);
  assert.throws(
    () => applySinglesAction(s, { type: "goal.delete", id: "m", goalId: "g" }),
    /重新打开/,
  );
  s = applySinglesAction(s, { type: "match.reopen", id: "m" });
  assert.equal(analyzeSingles(s)[0].mmr, 1200);
  s = applySinglesAction(s, { type: "goal.delete", id: "m", goalId: "g" });
  assert.deepEqual(singlesScore(s.matches[0]), [0, 0]);
  assert.equal(analyzeSingles(s)[1].ownGoals, 0);
});
test("scheduled and summary matches reject live events; detailed replacement requires consent", () => {
  let s = applySinglesAction(fixture(), {
    type: "match.save",
    id: "m",
    data: match(),
  });
  const add = {
    type: "goal.add",
    id: "m",
    data: { id: "g", teamId: "a", playerId: "a" },
  };
  assert.throws(() => applySinglesAction(s, add), /开始比赛/);
  s = applySinglesAction(s, { type: "match.start", id: "m" });
  s = applySinglesAction(s, add);
  assert.throws(() => result(s, "m", 3, 2), /替换原逐球记录/);
  s = applySinglesAction(s, {
    type: "match.result",
    id: "m",
    data: { ...match(), homeScore: 3, awayScore: 2, replaceDetailed: true },
  });
  assert.deepEqual(singlesScore(s.matches[0]), [3, 2]);
  assert.equal(s.matches[0].goals.length, 0);
  assert.throws(() => applySinglesAction(s, add), /赛后汇总/);
  assert.equal(analyzeSingles(s)[0].ownGoals, 0);
});
test("editing and deleting old results replays Elo, points, streaks and opponent history", () => {
  let s = result(fixture(), "first", 8, 5, "2026-10-25T10:00:00+08:00");
  s = result(s, "second", 4, 2);
  let stats = analyzeSingles(s);
  assert.equal(stats[0].points, 6);
  assert.equal(stats[0].bestStreak, 2);
  assert.equal(stats[0].history[1].before, 1238);
  assert.equal(stats[0].mmr + stats[1].mmr, 2400);
  s = result(s, "first", 2, 8, "2026-10-25T10:00:00+08:00");
  stats = analyzeSingles(s);
  assert.equal(stats[0].points, 3);
  assert.equal(stats[0].bestStreak, 1);
  assert.equal(stats[0].history[1].before, 1181);
  assert.equal(stats[0].history[1].delta, 49);
  s = applySinglesAction(s, { type: "match.delete", id: "first" });
  stats = analyzeSingles(s);
  assert.equal(stats[0].mmr, 1240);
  assert.equal(stats[0].rankPoints, 1240);
  assert.equal(stats[0].games, 1);
  assert.equal(stats[0].history[0].opponentId, "b");
});
test("draws, custom points and rating order use completed singles results only", () => {
  let s = result(fixture(), "draw", 0, 0);
  s = applySinglesAction(s, {
    type: "settings.save",
    id: "settings",
    data: { season: "S", win: 5, draw: 2, loss: 1 },
  });
  const stats = analyzeSingles(s);
  assert.equal(stats[0].mmr, 1200);
  assert.equal(stats[0].rankPoints, 1204);
  assert.equal(stats[0].points, 2);
  assert.equal(stats[0].draws, 1);
  assert.equal(singlesStandings(stats, "rank").at(-1)!.player.id, "c");
  assert.throws(() => result(s, "bad", -1, 3));
  assert.throws(() => result(s, "bad", 1.5, 3));
});

test("singles settlement uses pre-match values independently of home/away orientation", () => {
  let league = result(fixture(), "first", 8, 5, "2026-10-25T10:00:00+08:00");
  league = applySinglesAction(league, {
    type: "match.result",
    id: "second",
    data: { ...match("a", "c"), homeScore: 3, awayScore: 8 },
  });
  league = applySinglesAction(league, {
    type: "match.result",
    id: "third",
    data: {
      ...match("b", "c", "2026-10-26T11:00:00+08:00"),
      homeScore: 5,
      awayScore: 5,
    },
  });
  const swapped = structuredClone(league);
  swapped.players.reverse();
  for (const m of swapped.matches) {
    [m.homeId, m.awayId] = [m.awayId, m.homeId];
    [m.summary!.homeScore, m.summary!.awayScore] = [
      m.summary!.awayScore,
      m.summary!.homeScore,
    ];
  }
  const expected = analyzeSingles(league);
  for (const actual of analyzeSingles(swapped)) {
    const original = expected.find((p) => p.player.id === actual.player.id)!;
    assert.ok(Math.abs(actual.mmr - original.mmr) < 1e-10);
    assert.equal(actual.rankPoints, original.rankPoints);
    assert.deepEqual(
      actual.history.map(({ match: _, ...h }) => h),
      original.history.map(({ match: _, ...h }) => h),
    );
  }
});

test("singles and doubles first-match settlements match hand-calculated score anchors", () => {
  const anchors = [
    { score: [8, 5], mmr: [1238, 1162], rank: [1238, 1183] },
    { score: [10, 0], mmr: [1248, 1152], rank: [1248, 1179] },
    { score: [5, 8], mmr: [1162, 1238], rank: [1183, 1238] },
    { score: [2, 5], mmr: [1158.4, 1241.6], rank: [1182, 1242] },
    { score: [0, 0], mmr: [1200, 1200], rank: [1204, 1204] },
  ];
  for (const anchor of anchors) {
    const [homeScore, awayScore] = anchor.score;
    const singles = analyzeSingles(result(fixture(), "m", homeScore, awayScore));
    let doubles = emptyLeague();
    doubles.teams = ["home", "away"].map((id) => ({
      id,
      name: id,
      short: id,
      color: "#365c49",
      bio: "",
    }));
    doubles.players = ["a", "partner-a", "b", "partner-b"].map((id, i) => ({
      id,
      name: id,
      nickname: "",
      number: i,
      teamIds: [i < 2 ? "home" : "away"],
      position: "全能型",
      value: 0,
      bio: "",
      photo: "",
      skills: [50, 50, 50, 50, 50, 50],
    }));
    doubles = applyAction(doubles, {
      type: "match.result",
      id: "m",
      data: {
        homeId: "home",
        awayId: "away",
        time: "2026-10-26T10:00:00+08:00",
        round: "1",
        homeForwardId: "a",
        homeDefenderId: "partner-a",
        awayForwardId: "b",
        awayDefenderId: "partner-b",
        homeScore,
        awayScore,
      },
    });
    const paired = analyzeLeague(doubles).players;
    for (const [side, id] of ["a", "b"].entries()) {
      const single = singles.find((p) => p.player.id === id)!;
      const pair = paired.find((p) => p.player.id === id)!;
      assert.equal(single.mmr, anchor.mmr[side]);
      assert.equal(single.rankPoints, anchor.rank[side]);
      assert.equal(pair.mmr.overall, anchor.mmr[side]);
      assert.equal(pair.rankPoints.overall, anchor.rank[side]);
      assert.equal(pair.mmr.forward, anchor.mmr[side]);
      assert.equal(pair.rankPoints.forward, anchor.rank[side]);
      assert.equal(single.history[0].before, 1200);
      assert.equal(single.history[0].delta, anchor.rank[side] - 1200);
    }
  }
});
