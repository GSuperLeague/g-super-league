import test from "node:test";
import assert from "node:assert/strict";
import {
  analyzeBadminton,
  applyBadmintonAction,
  emptyBadmintonLeague,
} from "../lib/badminton.ts";
import type { BadmintonLeague, BadmintonMode } from "../lib/badminton.ts";

let sequence = 0;
function action(
  league: BadmintonLeague,
  type: string,
  id: string,
  data?: unknown,
) {
  return applyBadmintonAction(league, {
    type,
    id,
    data,
    actionId: `first-win-test-${++sequence}`,
  });
}
function fixture() {
  let league = emptyBadmintonLeague();
  for (const id of ["A", "B", "C", "D"])
    league = action(league, "player.save", id, {
      name: id,
      nickname: "",
      bio: "",
      hand: "unknown",
    });
  return league;
}
function finish(
  league: BadmintonLeague,
  id: string,
  time: string,
  options: {
    mode?: BadmintonMode;
    winner?: "home" | "away";
    homePlayers?: string[];
    awayPlayers?: string[];
  } = {},
) {
  const mode = options.mode || "singles";
  return action(league, "match.result", id, {
    mode,
    time,
    round: id,
    homePlayers: options.homePlayers || (mode === "singles" ? ["A"] : ["A", "B"]),
    awayPlayers: options.awayPlayers || (mode === "singles" ? ["C"] : ["C", "D"]),
    format: { pointsToWin: 11, bestOf: 1, winBy: 2 },
    games: [options.winner === "away" ? { home: 8, away: 11 } : { home: 11, away: 8 }],
  });
}
const player = (league: BadmintonLeague, id = "A", mode: BadmintonMode = "singles") =>
  analyzeBadminton(league, mode).find((p) => p.player.id === id)!;

test("GB awards the earliest valid win retroactively, including newly backfilled earlier history", () => {
  const league = finish(fixture(), "original-first", "2026-11-04T15:59:59Z");
  const winner = player(league);
  assert.equal(winner.rankPoints, 1226);
  assert.equal(winner.firstWinPoints, 10);
  assert.equal(winner.history[0].baseDelta, 16);
  assert.equal(winner.history[0].firstWinBonus, 10);
  assert.equal(winner.history[0].delta, 26);
  assert.equal(player(league, "C").rankPoints, 1189);
  assert.equal(player(league, "C").participationPoints, 5);
  assert.equal(player(league, "C").firstWinPoints, 0);
  const backfilled = finish(league, "earlier-history", "2026-09-20T10:00:00+08:00");
  assert.deepEqual(player(backfilled).history.map((h) => h.match.id), ["earlier-history", "original-first"]);
  assert.deepEqual(player(backfilled).history.map((h) => h.firstWinBonus), [10, 10]);
  assert.equal(player(backfilled).rankPoints, 1251);
  assert.equal(player(backfilled).firstWinPoints, 20);
});

test("one award per mode per day; the award does not bias the next Elo settlement", () => {
  let league = finish(fixture(), "first", "2026-11-05T10:00:00+08:00");
  league = finish(league, "second", "2026-11-05T11:00:00+08:00");
  const winner = player(league);
  assert.deepEqual(winner.history.map((h) => h.firstWinBonus), [10, 0]);
  assert.deepEqual(winner.history.map((h) => h.baseDelta), [16, 15]);
  assert.deepEqual(winner.history.map((h) => h.delta), [26, 15]);
  assert.equal(winner.rankPoints, 1241);
  assert.equal(winner.firstWinPoints, 10);
  assert.deepEqual(player(league, "C").history.map((h) => h.baseDelta), [-16, -15]);
  assert.deepEqual(player(league, "C").history.map((h) => h.participationBonus), [5, 0]);
  assert.deepEqual(player(league, "C").history.map((h) => h.delta), [-11, -15]);
});

test("Beijing midnight refreshes eligibility even while the UTC calendar day is unchanged", () => {
  let league = finish(fixture(), "late", "2026-11-05T15:59:59Z");
  league = finish(league, "midnight", "2026-11-05T16:00:00Z");
  const winner = player(league);
  assert.deepEqual(winner.history.map((h) => h.firstWinBonus), [10, 10]);
  assert.equal(winner.firstWinPoints, 20);
  assert.equal(winner.rankPoints, 1251);
});

test("singles and doubles are independent; doubles partners claim their own eligibility", () => {
  let league = finish(fixture(), "single", "2026-11-05T09:00:00+08:00");
  league = finish(league, "double", "2026-11-05T10:00:00+08:00", { mode: "doubles" });
  assert.equal(player(league, "A", "singles").firstWinPoints, 10);
  assert.equal(player(league, "A", "doubles").firstWinPoints, 10);
  assert.equal(player(league, "B", "doubles").firstWinPoints, 10);
  league = finish(league, "changed-partner", "2026-11-05T11:00:00+08:00", {
    mode: "doubles",
    homePlayers: ["A", "D"],
    awayPlayers: ["B", "C"],
  });
  assert.equal(player(league, "A", "doubles").history.at(-1)!.firstWinBonus, 0);
  assert.equal(player(league, "D", "doubles").history.at(-1)!.firstWinBonus, 10);
  assert.equal(player(league, "A", "doubles").rankPoints, 1242);
  assert.equal(player(league, "D", "doubles").rankPoints, 1210);
  assert.equal(player(league, "B", "doubles").firstWinPoints, 10);
  assert.equal(player(league, "C", "doubles").firstWinPoints, 0);
});

test("losses, unfinished games and invalid rosters do not consume a first win", () => {
  let league = finish(fixture(), "loss", "2026-11-05T08:00:00+08:00", { winner: "away" });
  league = finish(league, "unfinished", "2026-11-05T09:00:00+08:00");
  league = action(league, "match.reopen", "unfinished");
  league = finish(league, "valid-win", "2026-11-05T11:00:00+08:00");
  const invalid = structuredClone(league.matches.find((m) => m.id === "valid-win")!);
  invalid.id = "invalid-roster";
  invalid.time = "2026-11-05T10:00:00+08:00";
  invalid.awayPlayers = ["A"];
  league.matches.push(invalid);
  const winner = player(league);
  assert.deepEqual(winner.history.map((h) => h.match.id), ["loss", "valid-win"]);
  assert.deepEqual(winner.history.map((h) => h.firstWinBonus), [0, 10]);
  assert.equal(winner.firstWinPoints, 10);
});

test("backfill, result corrections, reopening and deletion relocate the award without duplicates", () => {
  let league = finish(fixture(), "late", "2026-11-05T12:00:00+08:00");
  league = finish(league, "early", "2026-11-05T10:00:00+08:00");
  const snapshot = structuredClone(league);
  assert.deepEqual(player(league).history.map((h) => [h.match.id, h.firstWinBonus]), [["early", 10], ["late", 0]]);
  const corrected = finish(league, "early", "2026-11-05T10:00:00+08:00", { winner: "away" });
  assert.deepEqual(player(corrected).history.map((h) => h.firstWinBonus), [0, 10]);
  assert.equal(player(corrected).history[1].baseDelta, 17);
  const deleted = action(league, "match.delete", "early");
  assert.equal(player(deleted).history[0].match.id, "late");
  assert.equal(player(deleted).history[0].firstWinBonus, 10);
  const reopened = action(league, "match.reopen", "early");
  assert.equal(player(reopened).history[0].match.id, "late");
  assert.equal(player(reopened).firstWinPoints, 10);
  assert.equal(player(league).firstWinPoints, 10);
  assert.deepEqual(league, snapshot);
});

test("equal-time matches use the existing createdAt/id tie break regardless of input order", () => {
  const time = "2026-11-05T10:00:00+08:00";
  let league = finish(fixture(), "z", time);
  league = finish(league, "a", time);
  for (const match of league.matches) match.createdAt = time;
  const reversed = structuredClone(league);
  reversed.matches.reverse();
  assert.deepEqual(player(league).history.map((h) => [h.match.id, h.firstWinBonus]), [["a", 10], ["z", 0]]);
  assert.deepEqual(analyzeBadminton(league, "singles"), analyzeBadminton(reversed, "singles"));
});

test("mixed wins and changing partners retain every baseline Elo delta independently of bonuses", () => {
  let league = finish(fixture(), "m1", "2026-11-05T10:00:00+08:00", { mode: "doubles" });
  league = finish(league, "m2", "2026-11-05T11:00:00+08:00", { mode: "doubles", winner: "away" });
  league = finish(league, "m3", "2026-11-06T10:00:00+08:00", { mode: "doubles", homePlayers: ["A", "D"], awayPlayers: ["B", "C"] });
  league = finish(league, "m4", "2026-11-06T11:00:00+08:00", { mode: "doubles", winner: "away" });
  const expected: Record<string, { base: number; deltas: number[]; bonus: number }> = {
    A: { base: 1199, deltas: [16, -17, 16, -16], bonus: 20 },
    B: { base: 1167, deltas: [16, -17, -16, -16], bonus: 10 },
    C: { base: 1201, deltas: [-16, 17, -16, 16], bonus: 20 },
    D: { base: 1233, deltas: [-16, 17, 16, 16], bonus: 20 },
  };
  for (const current of analyzeBadminton(league, "doubles")) {
    const anchor = expected[current.player.id];
    assert.equal(current.rankPoints - current.firstWinPoints - current.participationPoints, anchor.base);
    assert.deepEqual(current.history.map((h) => h.baseDelta), anchor.deltas);
    assert.equal(current.firstWinPoints, anchor.bonus);
    assert.equal(current.participationPoints, current.player.id === "B" ? 5 : 0);
    for (const h of current.history) assert.equal(h.delta, h.baseDelta + h.firstWinBonus + h.participationBonus);
  }
});
