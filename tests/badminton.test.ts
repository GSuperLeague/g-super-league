import test from "node:test";
import assert from "node:assert/strict";
import {
  applyBadmintonAction,
  emptyBadmintonLeague,
  analyzeBadminton,
  badmintonScore,
  badmintonWinner,
  badmintonPairs,
  gameWinner,
} from "../lib/badminton.ts";
import type {
  BadmintonLeague,
  BadmintonMatch,
  GameScore,
} from "../lib/badminton.ts";
let operation = 0;
const act = (s: BadmintonLeague, type: string, id: string, data?: unknown) =>
  applyBadmintonAction(s, {
    type,
    id,
    data,
    actionId: `test-operation-${++operation}`,
  });
function fixture() {
  let s = emptyBadmintonLeague();
  for (const id of ["A", "B", "C", "D"])
    s = act(s, "player.save", id, {
      name: `Player ${id}`,
      nickname: "",
      bio: "",
      hand: "unknown",
    });
  return s;
}
const details = (mode: "singles" | "doubles" = "singles") => ({
  mode,
  time: "2026-11-04T20:00:00+08:00",
  round: "Test match",
  homePlayers: mode === "singles" ? ["A"] : ["A", "B"],
  awayPlayers: mode === "singles" ? ["C"] : ["C", "D"],
  format: { pointsToWin: 11, bestOf: 1 },
});
const result = (
  s: BadmintonLeague,
  id = "m1",
  mode: "singles" | "doubles" = "singles",
  games: GameScore[] = [{ home: 11, away: 8 }],
) => act(s, "match.result", id, { ...details(mode), games });

test("GB defaults to 11 points, one game, win by two; new sport has no table-football history", () => {
  const s = emptyBadmintonLeague();
  assert.equal(s.sport, "badminton");
  assert.deepEqual(s.settings, {
    season: "GB 第一赛季",
    pointsToWin: 11,
    bestOf: 1,
    winBy: 2,
  });
  assert.deepEqual(s.matches, []);
});
test("single and double rosters require different players and the correct team size", () => {
  const s = fixture();
  assert.throws(
    () => act(s, "match.save", "m", { ...details(), awayPlayers: ["A"] }),
    /重复/,
  );
  assert.throws(
    () =>
      act(s, "match.save", "m", { ...details("doubles"), awayPlayers: ["C"] }),
    /2名/,
  );
  assert.throws(
    () =>
      act(s, "match.save", "m", {
        ...details("doubles"),
        awayPlayers: ["C", "C"],
      }),
    /重复/,
  );
});
test("deuce accepts the first two-point lead and rejects one-point leads and scores past the finish", () => {
  const s = fixture();
  assert.equal(badmintonWinner(result(s).matches[0]), "home");
  for (const game of [
    { home: 11, away: 9 },
    { home: 12, away: 10 },
    { home: 16, away: 14 },
    { home: 14, away: 16 },
  ]) assert.doesNotThrow(() => result(s, "close", "singles", [game]));
  for (const games of [
    [{ home: 10, away: 8 }],
    [{ home: 11, away: 10 }],
    [{ home: 11, away: 11 }],
    [{ home: 16, away: 13 }],
    [{ home: 12, away: 9 }],
  ])
    assert.throws(() => result(s, "bad", "singles", games));
});
test("stored matches without a win-by field retain the old 11:10 finish", () => {
  assert.equal(gameWinner({ home: 11, away: 10 }, { pointsToWin: 11, bestOf: 1 }), "home");
  assert.equal(gameWinner({ home: 12, away: 11 }, { pointsToWin: 11, bestOf: 1 }), null);
  const s = act(fixture(), "match.result", "legacy", {
    ...details(),
    format: { pointsToWin: 11, bestOf: 1, winBy: 1 },
    games: [{ home: 11, away: 10 }],
  });
  assert.equal(badmintonWinner(s.matches[0]), "home");
});
test("live deuce continues at 11:10, can be undone, and settles only after a two-point lead", () => {
  let s = act(fixture(), "match.save", "m", { ...details(), startNow: true });
  for (let i = 0; i < 10; i++) {
    s = act(s, "point.add", "m", { side: "home" });
    s = act(s, "point.add", "m", { side: "away" });
  }
  s = act(s, "point.add", "m", { side: "home" });
  assert.equal(badmintonWinner(s.matches[0]), null);
  assert.throws(() => act(s, "match.finish", "m"), /净胜两分/);
  s = act(s, "point.add", "m", { side: "away" });
  s = act(s, "point.add", "m", { side: "home" });
  s = act(s, "point.add", "m", { side: "home" });
  assert.equal(badmintonWinner(s.matches[0]), "home");
  assert.throws(() => act(s, "point.add", "m", { side: "away" }), /完赛条件/);
  s = act(s, "point.undo", "m");
  assert.equal(badmintonWinner(s.matches[0]), null);
  assert.deepEqual(s.matches[0].games, [{ home: 12, away: 11 }]);
  s = act(s, "point.add", "m", { side: "home" });
  s = act(s, "match.finish", "m");
  assert.equal(analyzeBadminton(s, "singles").find((p) => p.player.id === "A")!.rankPoints, 1216);
});
test("live points can be undone across a game boundary and do not settle before confirmation", () => {
  let s = act(fixture(), "match.save", "m", { ...details(), startNow: true });
  for (let i = 0; i < 11; i++) s = act(s, "point.add", "m", { side: "home" });
  assert.equal(s.matches[0].status, "live");
  assert.equal(
    analyzeBadminton(s, "singles").find((p) => p.player.id === "A")!.games,
    0,
  );
  assert.throws(() => act(s, "point.add", "m", { side: "home" }), /完赛条件/);
  s = act(s, "point.undo", "m");
  assert.deepEqual(s.matches[0].games, [{ home: 10, away: 0 }]);
  s = act(s, "point.add", "m", { side: "away" });
  s = act(s, "point.add", "m", { side: "home" });
  s = act(s, "match.finish", "m");
  assert.deepEqual(badmintonScore(s.matches[0]), {
    homeGames: 1,
    awayGames: 0,
    homePoints: 11,
    awayPoints: 1,
  });
  assert.equal(s.matches[0].status, "finished");
});
test("a retried action ID cannot add a second point", () => {
  let s = act(fixture(), "match.save", "m", { ...details(), startNow: true });
  const a = {
    type: "point.add",
    id: "m",
    actionId: "same-request-id",
    data: { side: "home" },
  };
  s = applyBadmintonAction(s, a);
  const retried = applyBadmintonAction(s, a);
  assert.deepEqual(s, retried);
  assert.equal(retried.matches[0].games[0].home, 1);
});
test("three-game matches reject extra games after clinching; live undo restores prior set", () => {
  const d = { ...details(), format: { pointsToWin: 11, bestOf: 3 } };
  assert.throws(
    () =>
      act(fixture(), "match.result", "m", {
        ...d,
        games: [
          { home: 11, away: 8 },
          { home: 11, away: 5 },
          { home: 1, away: 11 },
        ],
      }),
    /决出胜负/,
  );
  assert.throws(
    () =>
      act(fixture(), "match.result", "m", {
        ...d,
        games: [{ home: 11, away: 8 }],
      }),
    /完赛条件/,
  );
  let s = act(fixture(), "match.save", "m", { ...d, startNow: true });
  for (let i = 0; i < 11; i++) s = act(s, "point.add", "m", { side: "home" });
  s = act(s, "point.add", "m", { side: "away" });
  assert.deepEqual(s.matches[0].games, [
    { home: 11, away: 0 },
    { home: 0, away: 1 },
  ]);
  s = act(s, "point.undo", "m");
  assert.deepEqual(s.matches[0].games, [{ home: 11, away: 0 }]);
});
test("Elo starts at 1200; singles and doubles settle independently with identical partner changes", () => {
  let s = result(fixture(), "single");
  s = result(s, "double", "doubles");
  const singles = analyzeBadminton(s, "singles"),
    doubles = analyzeBadminton(s, "doubles");
  assert.equal(singles.find((p) => p.player.id === "A")!.rankPoints, 1216);
  assert.equal(singles.find((p) => p.player.id === "C")!.rankPoints, 1184);
  assert.equal(singles.find((p) => p.player.id === "B")!.rankPoints, 1200);
  assert.equal(doubles.find((p) => p.player.id === "A")!.rankPoints, 1216);
  assert.equal(doubles.find((p) => p.player.id === "B")!.rankPoints, 1216);
  assert.equal(
    doubles.reduce((sum, p) => sum + p.rankPoints, 0),
    4800,
  );
  assert.equal(badmintonPairs(s).length, 2);
});
test("editing and deleting an earlier match recalculates subsequent history without mutating input", () => {
  let s = result(fixture(), "m1");
  s = act(s, "match.result", "m2", {
    ...details(),
    time: "2026-11-04T21:00:00+08:00",
    games: [{ home: 11, away: 8 }],
  });
  const original = structuredClone(s),
    before = analyzeBadminton(s, "singles").find((p) => p.player.id === "A")!;
  assert.equal(before.rankPoints, 1231);
  const changed = act(s, "match.result", "m1", {
    ...details(),
    games: [{ home: 8, away: 11 }],
  });
  const recalculated = analyzeBadminton(changed, "singles").find(
    (p) => p.player.id === "A",
  )!;
  assert.equal(recalculated.history[1].before, 1184);
  assert.equal(recalculated.history[1].delta, 17);
  assert.equal(recalculated.rankPoints, 1201);
  assert.deepEqual(s, original);
  const deleted = act(s, "match.delete", "m1");
  assert.equal(
    analyzeBadminton(deleted, "singles").find((p) => p.player.id === "A")!
      .rankPoints,
    1216,
  );
});
test("reopening excludes a match from rankings until it is finished again", () => {
  let s = result(fixture());
  s = act(s, "match.reopen", "m1");
  assert.equal(
    analyzeBadminton(s, "singles").find((p) => p.player.id === "A")!.rankPoints,
    1200,
  );
  s = act(s, "match.finish", "m1");
  assert.equal(
    analyzeBadminton(s, "singles").find((p) => p.player.id === "A")!.rankPoints,
    1216,
  );
});
test("import preserves identity, avoids duplicate registration, and never copies football results", () => {
  const source = {
    id: "source-player",
    name: "New person",
    nickname: "N",
    photo: "",
  };
  let s = act(fixture(), "player.import", "import", { players: [source] });
  s = act(s, "player.import", "import2", { players: [source] });
  assert.equal(
    s.players.filter((p) => p.sourcePlayerId === "source-player").length,
    1,
  );
  assert.equal(s.matches.length, 0);
  assert.equal(
    analyzeBadminton(s, "doubles").find((p) => p.player.id === "source-player")!
      .rankPoints,
    1200,
  );
});
test("archiving preserves history and prevents a new appearance until restored", () => {
  let s = result(fixture());
  s = act(s, "player.active", "A", { active: false });
  assert.equal(
    analyzeBadminton(s, "singles").find((p) => p.player.id === "A")!.games,
    1,
  );
  assert.throws(() => result(s, "new-match"), /恢复/);
  s = act(s, "player.active", "A", { active: true });
  assert.doesNotThrow(() => result(s, "new-match"));
});
test("summary replacement requires explicit confirmation when point history exists", () => {
  let s = act(fixture(), "match.save", "m", { ...details(), startNow: true });
  s = act(s, "point.add", "m", { side: "home" });
  assert.throws(
    () =>
      act(s, "match.result", "m", {
        ...details(),
        games: [{ home: 11, away: 9 }],
      }),
    /确认/,
  );
  s = act(s, "match.result", "m", {
    ...details(),
    games: [{ home: 11, away: 9 }],
    replaceDetailed: true,
  });
  assert.equal(s.matches[0].recording, "summary");
  assert.equal(s.matches[0].pointEvents.length, 0);
});
