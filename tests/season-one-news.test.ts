import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { analyzeLeague, leagueForSeason } from "../lib/analytics.ts";
import type { League } from "../lib/league.ts";
import { score } from "../lib/league.ts";
import { recordedMatchFlow } from "../lib/match-stories.ts";
import { applyNewsAction } from "../lib/news.ts";
import { seasonOneReport as report, seasonOneSource } from "../lib/season-one-news.ts";
import { seasonRecords } from "../lib/season-records.ts";
import { seasonOneTitles, seasonOneTitleEdition } from "../lib/season-one-titles.ts";

test("final titles remain in both the structured report and its editable body", () => {
  assert.equal(report.titleEdition, seasonOneTitleEdition);
  assert.equal(seasonOneTitles.length, 11);
  assert.equal(new Set(seasonOneTitles.map(p => p.playerId)).size, 11);
  assert.equal(new Set(seasonOneTitles.map(p => p.title)).size, 11);
  const editionIndex = report.article.body.indexOf(seasonOneTitleEdition.label);
  assert.ok(editionIndex > report.article.body.indexOf("单场高光｜最后三球"));
  for (const player of seasonOneTitles) {
    assert.ok(report.article.body.includes(`${player.name}｜${player.title}`));
    assert.ok(report.article.body.includes(player.reason));
  }
});

test("the complete final report can be edited and restored through existing news actions", () => {
  const original = report.article.body;
  const saved = applyNewsAction([], { type: "news.save", id: report.article.id, data: report.article });
  assert.equal(saved[0].body, original);
  const edited = applyNewsAction(saved, { type: "news.save", id: report.article.id, data: { ...report.article, body: "修订后的定榜稿" } });
  assert.equal(edited.length, 1);
  assert.equal(edited[0].body, "修订后的定榜稿");
  assert.deepEqual(applyNewsAction(edited, { type: "news.delete", id: report.article.id }), []);
  assert.equal(report.article.body, original);
});

// The supplied export is intentionally ignored by Git; run locally with the original evidence.
test("final standings, awards, rookies and score sequences agree with the supplied snapshot", {
  skip: !existsSync(seasonOneSource.file),
}, () => {
  const snapshot = JSON.parse(readFileSync(seasonOneSource.file, "utf8")) as { league: League; exportedAt: string };
  assert.equal(snapshot.exportedAt, seasonOneSource.exportedAt);
  const league = leagueForSeason(snapshot.league, "s1");
  const stats = analyzeLeague(league);
  const beta = analyzeLeague(leagueForSeason(snapshot.league, "beta"));
  assert.equal(stats.finished.length, report.finished);
  assert.equal(stats.finished.at(-1)!.time, seasonOneSource.lastMatchAt);
  assert.equal(stats.finished.reduce((n, m) => n + score(m).reduce((a, b) => a + b, 0), 0), 1136);
  assert.equal(stats.finished.filter(recordedMatchFlow).length, report.detailed);
  assert.equal(stats.players.filter(p => p.overall.games).length, 11);
  assert.equal(stats.finished.filter(m => Math.abs(score(m)[0] - score(m)[1]) <= 2).length, 40);
  const ranked = stats.players.filter(p => p.ratedGames.overall).sort((a, b) => b.rankPoints.overall - a.rankPoints.overall || b.ratedGames.overall - a.ratedGames.overall || a.player.id.localeCompare(b.player.id));
  const records = seasonRecords(league);
  assert.deepEqual(records.days, report.recordBook!.days);
  assert.deepEqual(records.leaders, [
    { name: "陆鹏睿", days: 7 }, { name: "胡竹霖", days: 1 },
    { name: "五点五", days: 1 }, { name: "雷可洋", days: 4 },
  ]);
  for (const [index, key] of (["highest", "lowest", "gain", "loss"] as const).entries()) {
    assert.equal(records[key].length, 1);
    const actual = records[key][0];
    const entry = report.recordBook!.entries[index];
    assert.equal(entry.name, actual.name);
    assert.equal(entry.matchId, actual.matchId);
    assert.equal(Number(entry.value.replace("−", "-")), key === "gain" || key === "loss" ? actual.delta : actual.after);
  }
  // Independently recompute each day's standings from the truncated match list.
  for (const day of records.days) {
    const cutoff = Date.parse(`${day.date}T23:59:59.999+08:00`);
    const partial = analyzeLeague({ ...league, matches: league.matches.filter(m => Date.parse(m.time) <= cutoff) });
    const leader = partial.players.filter(p => p.ratedGames.overall > 0)
      .sort((a, b) => b.rankPoints.overall - a.rankPoints.overall || b.ratedGames.overall - a.ratedGames.overall || a.player.id.localeCompare(b.player.id))[0];
    assert.deepEqual({ name: leader.player.name, points: leader.rankPoints.overall }, { name: day.name, points: day.points });
  }
  report.top3.forEach((p, i) => {
    const actual = ranked[i];
    assert.equal(p.player.id, actual.player.id);
    assert.deepEqual(p.rankPoints, actual.rankPoints);
    for (const key of ["games", "wins", "draws", "losses", "winRate", "longestStreak"] as const)
      assert.equal(p.overall[key], actual.overall[key]);
  });
  const rookies = stats.players.filter(p => p.overall.games && !beta.players.find(b => b.player.id === p.player.id)?.overall.games);
  assert.deepEqual(rookies.map(p => p.player.name).sort(), report.rookies!.map(p => p.name).sort());
  for (const rookie of report.rookies!) {
    const actual = rookies.find(p => p.player.name === rookie.name)!;
    assert.equal(rookie.record, `${actual.overall.games} 场 · ${actual.overall.wins} 胜 ${actual.overall.losses} 负`);
  }
  const byName = (name: string) => stats.players.find(p => p.player.name === name)!;
  assert.deepEqual(seasonOneTitles.map(p => [p.playerId, p.name]), ranked.map(p => [p.player.id, p.player.name]));
  const personal = (name: string) => records.personal.find(p => p.name === name)!;
  const lei = byName("雷可洋");
  const allRoleLeader = (["overall", "forward", "defender"] as const).every(role =>
    stats.players.filter(p => p.ratedGames[role]).sort((a, b) => b.rankPoints[role] - a.rankPoints[role])[0].player.id === lei.player.id);
  const zhouLast = byName("周晨阳").history.at(-1)!;
  const wangFirstWin = byName("王藝坤").history.find(h => h.result === "W")!;
  const zhang = byName("张瑞航");
  const zhangDefenderGoals = zhang.history.filter(h => h.role === "defender").reduce((n, h) => n + h.match.goals.filter(g => !g.ownGoal && g.playerId === zhang.player.id).length, 0);
  const titleFacts: Record<string, string[]> = {
    雷可洋: [allRoleLeader ? "全部第一" : "", `${personal("雷可洋").goals} 球`],
    陆鹏睿: [`${records.leaders.find(p => p.name === "陆鹏睿")!.days} 天`, `${byName("陆鹏睿").overall.currentStreak} 场`],
    胡竹霖: [`${byName("胡竹霖").forward.games} / ${byName("胡竹霖").defender.games} 场`, `${byName("胡竹霖").forward.wins} / ${byName("胡竹霖").defender.wins} 胜`],
    周晨阳: [`${byName("周晨阳").overall.longestLosingStreak} 负 → ${byName("周晨阳").overall.longestStreak} 胜`, zhouLast.match.goals.filter(g => !g.ownGoal && g.playerId === byName("周晨阳").player.id).length === 7 ? "一人七球" : ""],
    五点五: [`${byName("五点五").overall.wins} 胜 / ${byName("五点五").overall.games} 场`, `${stats.pairs.find(p => p.ids.includes(byName("五点五").player.id) && p.ids.includes(lei.player.id))!.wins} 战全胜`],
    张瑞航: [`${zhang.defender.wins} 胜 / ${zhang.defender.games} 场`, `${zhangDefenderGoals} 球`],
    陈渔: [`${byName("陈渔").overall.games} 场`, `${byName("陈渔").forward.wins} 胜 / ${byName("陈渔").forward.games} 场`],
    王藝坤: [byName("王藝坤").history.map(h => `${h.gf}:${h.ga}`).join(" → "), wangFirstWin.match.goals.at(-1)!.playerId === byName("王藝坤").player.id ? "本人打进" : ""],
    朱泽木: [`${Math.min(...byName("朱泽木").history.map(h => h.rankPoints!))} → ${byName("朱泽木").rankPoints.overall} 分`, `${byName("朱泽木").overall.currentStreak} 场`],
    傅大源: [`${byName("傅大源").defender.games} / ${byName("傅大源").overall.games} 场`, byName("傅大源").history.filter(h => h.result === "W").every(h => h.role === "defender") ? "均在后卫位置" : ""],
    贾硕萌: [`${byName("贾硕萌").forward.games} / ${byName("贾硕萌").overall.games} 场`, byName("贾硕萌").history.filter(h => h.result === "W").every(h => h.role === "forward") ? "全部来自锋线" : ""],
  };
  for (const player of seasonOneTitles)
    assert.deepEqual(player.facts.map(f => f.value), titleFacts[player.name], player.name);
  const allGoals = stats.finished.flatMap(m => m.goals);
  assert.equal(allGoals.filter(g => !g.playerId).length, 188);
  const best = (key: keyof Omit<typeof records.personal[number], "name">) => {
    const maximum = Math.max(...records.personal.map(p => p[key]));
    return records.personal.filter(p => p[key] === maximum).map(p => [p.name, maximum]);
  };
  assert.deepEqual(best("goals"), [["雷可洋", 250]]);
  assert.deepEqual(best("winners"), [["雷可洋", 23]]);
  assert.deepEqual(best("dailyGames"), [["雷可洋", 18], ["周晨阳", 18]]);
  assert.deepEqual(best("partners"), [["陆鹏睿", 10]]);
  assert.deepEqual(best("oneGoalLosses"), [["雷可洋", 8], ["陆鹏睿", 8], ["周晨阳", 8]]);
  assert.deepEqual(best("shutouts"), [["雷可洋", 3]]);
  assert.equal(stats.finished.filter(m => score(m).includes(0)).length, 3);
  const sevenGoals = stats.finished.flatMap(m => stats.players.flatMap(p =>
    m.goals.filter(g => !g.ownGoal && g.playerId === p.player.id).length === 7 ? [p.player.name] : []));
  assert.deepEqual(sevenGoals.sort(), ["陆鹏睿", "雷可洋", "五点五", "周晨阳"].sort());
  const gain = byName("胡竹霖").history.find(h => h.match.id === records.gain[0].matchId)!;
  assert.equal(gain.baseDelta, 64);
  assert.equal(gain.firstWinBonus, 10);
  assert.equal(Math.max(...stats.players.map(p => p.overall.longestLosingStreak)), 17);
  assert.equal(byName("朱泽木").overall.longestLosingStreak, 17);
  assert.ok(byName("朱泽木").history.slice(0, 17).every(h => h.result === "L"));
  assert.deepEqual([byName("朱泽木").history[17].gf, byName("朱泽木").history[17].ga], [7, 4]);
  assert.equal(byName("周晨阳").overall.longestLosingStreak, 13);
  assert.equal(byName("周晨阳").overall.longestStreak, 6);
  assert.equal(byName("周晨阳").overall.currentStreak, 5);
  assert.equal(byName("陆鹏睿").overall.currentStreak, 4);
  assert.equal(Math.max(...stats.players.map(p => p.overall.longestStreak)), 7);
  const pair = stats.pairs.find(p => p.ids.includes(byName("五点五").player.id) && p.ids.includes(byName("雷可洋").player.id))!;
  assert.deepEqual([pair.games, pair.wins, pair.gf, pair.ga], [8, 8, 56, 21]);
  for (const award of report.awards)
    for (const id of award.matchIds) assert.ok(stats.finished.some(m => m.id === id), `${award.id}: missing match ${id}`);
  for (const highlight of report.highlights) {
    const match = stats.finished.find(m => m.id === highlight.matchId)!;
    assert.equal(match.time, highlight.time);
    const names = (ids: string[]) => ids.map(id => league.players.find(p => p.id === id)!.name).join("、");
    assert.equal(names(match.homePlayers), highlight.home);
    assert.equal(names(match.awayPlayers), highlight.away);
    assert.deepEqual(score(match), [highlight.homeScore, highlight.awayScore]);
    const flow = recordedMatchFlow(match)!;
    const sequence = flow.points.map(p => `${p.home}:${p.away}`);
    let previous = -1;
    for (const moment of highlight.moments) {
      const index = sequence.indexOf(moment.score, previous + 1);
      assert.ok(index > previous, `${highlight.id}: invalid scoring sequence ${moment.score}`);
      previous = index;
    }
  }
  const comebacks = byName("雷可洋").history.filter(h => {
    const flow = recordedMatchFlow(h.match)!;
    return h.result === "W" && (h.match.homePlayers.includes(byName("雷可洋").player.id) ? flow.leads.away : flow.leads.home) >= 2;
  });
  assert.equal(comebacks.length, 14);
  const seesaw = stats.finished.find(m => m.id === "31e2298a-80fd-5541-8dc8-f4f40998a51a")!;
  assert.equal(recordedMatchFlow(seesaw)!.leadChanges.length, Math.max(...stats.finished.map(m => recordedMatchFlow(m)!.leadChanges.length)));
  assert.equal(recordedMatchFlow(seesaw)!.leadChanges.length, 6);
});
