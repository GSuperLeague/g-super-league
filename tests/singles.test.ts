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
import { emptyLeague } from "../lib/league.ts";

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
  assert.equal(stats[0].elo, 1200);
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
  assert.equal(stats[0].elo, 1216);
  assert.equal(stats[1].elo, 1184);
  assert.equal(stats[0].points, 3);
  assert.throws(
    () => applySinglesAction(s, { type: "goal.delete", id: "m", goalId: "g" }),
    /重新打开/,
  );
  s = applySinglesAction(s, { type: "match.reopen", id: "m" });
  assert.equal(analyzeSingles(s)[0].elo, 1200);
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
  assert.equal(stats[0].history[1].before, 1216);
  assert.equal(stats[0].elo + stats[1].elo, 2400);
  s = result(s, "first", 2, 8, "2026-10-25T10:00:00+08:00");
  stats = analyzeSingles(s);
  assert.equal(stats[0].points, 3);
  assert.equal(stats[0].bestStreak, 1);
  assert.equal(stats[0].history[1].before, 1184);
  assert.ok(stats[0].history[1].delta > 16);
  s = applySinglesAction(s, { type: "match.delete", id: "first" });
  stats = analyzeSingles(s);
  assert.equal(stats[0].elo, 1216);
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
  assert.equal(stats[0].elo, 1200);
  assert.equal(stats[0].points, 2);
  assert.equal(stats[0].draws, 1);
  assert.equal(singlesStandings(stats, "elo").at(-1)!.player.id, "c");
  assert.throws(() => result(s, "bad", -1, 3));
  assert.throws(() => result(s, "bad", 1.5, 3));
});
