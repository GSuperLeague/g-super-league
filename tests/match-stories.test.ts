import test from "node:test";
import assert from "node:assert/strict";
import { emptyLeague } from "../lib/league.ts";
import type { League, Match } from "../lib/league.ts";
import { buildMatchStories, recordedMatchFlow } from "../lib/match-stories.ts";
import { betaReport } from "../lib/season-news.ts";

type GoalToken = "h" | "a" | "ho" | "ao";
function match(
  id: string,
  sequence: GoalToken[],
  overrides: Partial<Match> = {},
): Match {
  return {
    id,
    homeId: "home",
    awayId: "away",
    homePlayers: ["p1", "p2"],
    awayPlayers: ["p3", "p4"],
    roles: {
      homeForwardId: "p1",
      homeDefenderId: "p2",
      awayForwardId: "p3",
      awayDefenderId: "p4",
    },
    time: "2026-10-29T10:00:00Z",
    round: id,
    status: "finished",
    goals: sequence.map((token, i) => ({
      id: `${id}-${i}`,
      teamId: token === "h" || token === "ao" ? "home" : "away",
      playerId: token.startsWith("h") ? "p1" : "p3",
      ownGoal: token.endsWith("o"),
      minute: sequence.length - i,
      createdAt: new Date(
        Date.UTC(2026, 9, 29, 10, sequence.length - i),
      ).toISOString(),
    })),
    ...overrides,
  };
}
function league(matches: Match[]): League {
  return {
    ...emptyLeague(),
    players: Array.from({ length: 6 }, (_, i) => ({
      id: `p${i + 1}`,
      name: `球员${i + 1}`,
      nickname: "",
      teamIds: ["home", "away"],
      number: i + 1,
      position: "全能型",
      value: 0,
      bio: "",
      photo: "",
      skills: [50, 50, 50, 50, 50, 50],
    })),
    matches,
  };
}
const goals = (h: number, a: number): GoalToken[] => [
  ...Array<GoalToken>(h).fill("h"),
  ...Array<GoalToken>(a).fill("a"),
];

test("recorded flow follows array order, credits own goals to beneficiaries and counts actual lead changes", () => {
  const flow = recordedMatchFlow(
    match("swing", ["h", "ho", "a", "h", "h", "a"]),
  )!;
  assert.deepEqual(flow.points, [
    { home: 0, away: 0 },
    { home: 1, away: 0 },
    { home: 1, away: 1 },
    { home: 1, away: 2 },
    { home: 2, away: 2 },
    { home: 3, away: 2 },
    { home: 3, away: 3 },
  ]);
  assert.deepEqual(flow.leadChanges, [3, 5]);
  assert.deepEqual(flow.leads, { home: 1, away: 1 });
  assert.equal(flow.winner, null);
  const invalid = match("invalid", ["h"]);
  invalid.goals[0].teamId = "third-team";
  assert.equal(recordedMatchFlow(invalid), null);
});

test("attendance includes finished summary games, jointly awards ties and excludes live and first-season games", () => {
  const completed = match("completed", ["h"]);
  const summary = match("summary", [], {
    summary: {
      homeScore: 7,
      awayScore: 5,
      ...completed.roles!,
      recordedAt: completed.time,
    },
  });
  const report = betaReport(
    league([
      completed,
      summary,
      match("live", goals(5, 0), { status: "live" }),
      match("future", goals(5, 0), { time: "2026-11-02T02:00:00Z" }),
    ]),
  )!;
  const award = report.awards.find((a) => a.id === "attendance")!;
  assert.equal(award.winner, "球员1、球员2、球员3、球员4");
  assert.match(award.story, /出场 2 次，覆盖全季 100.0%/);
  assert.deepEqual(award.matchIds.sort(), ["completed", "summary"]);
  assert.doesNotMatch(award.winner, /球员[56]/);
});

test("annual comeback uses the winning side's biggest deficit, handles away wins and awards equal deficits", () => {
  const away = match("away-win", goals(5, 6));
  const home = match("home-win", [...goals(0, 5), ...goals(6, 0)]);
  const tie = match("draw", goals(8, 8));
  const live = match("live", goals(9, 10), { status: "live" });
  const report = betaReport(league([away, home, tie, live]))!;
  const award = report.awards.find((a) => a.id === "comeback")!;
  assert.match(award.evidence, /落后 5 球后获胜/);
  assert.equal(award.winner, "球员3、球员4 / 球员1、球员2");
  assert.deepEqual(award.matchIds, ["away-win", "home-win"]);
  assert.match(award.story, /球员3、球员4曾落后 5 球，最终却以 6:5/);
  const story = report.highlights[0];
  assert.equal(story.matchId, "away-win");
  assert.deepEqual(
    story.moments.map((m) => m.score),
    ["0:0", "5:0", "5:5", "5:6"],
  );
  assert.match(story.paragraphs[0], /0:5 落后/);
});

test("a season with summary results only has attendance but no invented comebacks or highlights", () => {
  const base = match("summary", []);
  base.summary = {
    homeScore: 7,
    awayScore: 6,
    ...base.roles!,
    recordedAt: base.time,
  };
  const report = betaReport(league([base]))!;
  assert.ok(report.awards.some((a) => a.id === "attendance"));
  assert.ok(!report.awards.some((a) => a.id === "comeback"));
  assert.deepEqual(report.highlights, []);
});

test("five story categories use distinct matches with chronological home-away score timelines", () => {
  const matches = [
    match("comeback", goals(5, 6)),
    match("redemption", ["ho", ...goals(0, 3), ...goals(5, 0)]),
    match("seesaw", ["h", "a", "a", "h", "h", "a", "a", "h", "h"]),
    match("run", [...goals(0, 2), ...goals(7, 0)]),
    match("scorer", [
      "a",
      "h",
      "a",
      "h",
      "a",
      "h",
      "a",
      "h",
      "h",
      "h",
      "h",
      "a",
    ]),
  ];
  const stories = buildMatchStories(league(matches));
  assert.deepEqual(
    stories.map((s) => s.id),
    ["comeback", "redemption", "seesaw", "scoring-run", "scorer"],
  );
  assert.equal(new Set(stories.map((s) => s.matchId)).size, 5);
  for (const story of stories) {
    const flow = recordedMatchFlow(
      matches.find((m) => m.id === story.matchId)!,
    )!;
    assert.equal(
      story.moments.at(-1)!.score,
      `${story.homeScore}:${story.awayScore}`,
    );
    const indices = story.moments.map((m) =>
      flow.points.findIndex((p) => `${p.home}:${p.away}` === m.score),
    );
    assert.ok(
      indices.every((n, i) => n >= 0 && (i === 0 || n > indices[i - 1])),
    );
  }
  const redemption = stories.find((s) => s.id === "redemption")!;
  assert.match(redemption.paragraphs.join(""), /全场打进 5 球/);
  assert.doesNotMatch(redemption.paragraphs.join(""), /打进 6 球/);
  const more = league([
    ...matches,
    match("live", goals(30, 31), { status: "live" }),
  ]);
  assert.deepEqual(buildMatchStories(more), stories);
});

test("own-goal runs never become a personal scoring record and losing final goals are not called decisive", () => {
  const matches = [
    match("largest", goals(5, 6)),
    match("own-run", Array<GoalToken>(7).fill("ao")),
    match("scorer", ["h", "h", "a", "h", "a", "h", "a", "h", "h", "a"]),
  ];
  const stories = buildMatchStories(league(matches));
  const run = stories.find((s) => s.id === "scoring-run")!;
  assert.equal(run.matchId, "own-run");
  assert.match(run.paragraphs[1], /7 分来自对手的乌龙/);
  assert.doesNotMatch(run.paragraphs[1], /球员3打进/);
  const scorer = stories.find((s) => s.id === "scorer")!;
  assert.equal(scorer.matchId, "scorer");
  const withLosingLastGoal = buildMatchStories(
    league([match("losing-last", [...goals(0, 4), ...goals(7, 0), "a"])]),
  )[0];
  assert.doesNotMatch(
    withLosingLastGoal.paragraphs.join(""),
    /最后一球把整场比赛的结局翻了过来/,
  );
  assert.ok(!withLosingLastGoal.moments.some((m) => m.label === "最后平分"));
});
