import { analyzeLeague } from "./analytics.ts";
import type { League } from "./league.ts";

// Replay public post-match points, including the site's daily rewards.
export function seasonRecords(league: League) {
  const data = analyzeLeague(league);
  const players = data.players.filter(p => p.overall.games > 0);
  const entries = players.flatMap(p => p.history.flatMap(h =>
    h.rankPoints === undefined || h.rankBefore === undefined ? [] : [{
      name: p.player.name, playerId: p.player.id, matchId: h.match.id,
      time: h.match.time, before: h.rankBefore, after: h.rankPoints,
      delta: h.rankPoints - h.rankBefore,
    }]));
  const day = (time: string) => new Date(Date.parse(time) + 8 * 3600000).toISOString().slice(0, 10);
  const state = new Map<string, { id: string; name: string; points: number; games: number }>();
  const byMatch = new Map<string, typeof entries>();
  for (const entry of entries) {
    const rows = byMatch.get(entry.matchId) ?? [];
    rows.push(entry);
    byMatch.set(entry.matchId, rows);
  }
  const closes = new Map<string, { name: string; points: number }>();
  for (const match of data.finished) {
    for (const entry of byMatch.get(match.id) ?? []) {
      state.set(entry.playerId, { id: entry.playerId, name: entry.name, points: entry.after, games: (state.get(entry.playerId)?.games ?? 0) + 1 });
    }
    const leader = [...state.values()].sort((a, b) => b.points - a.points || b.games - a.games || a.id.localeCompare(b.id))[0];
    if (leader) closes.set(day(match.time), { name: leader.name, points: leader.points });
  }
  const days: { date: string; name: string; points: number }[] = [];
  if (data.finished.length) {
    const end = day(data.finished.at(-1)!.time);
    let carry: { name: string; points: number } | undefined;
    for (let date = day(data.finished[0].time); date <= end; date = new Date(Date.parse(date) + 86400000).toISOString().slice(0, 10)) {
      carry = closes.get(date) ?? carry;
      if (carry) days.push({ date, ...carry });
    }
  }
  const leaders = [...new Set(days.map(d => d.name))].map(name => ({ name, days: days.filter(d => d.name === name).length }));
  const extreme = (key: "after" | "delta", direction: 1 | -1) => {
    const value = Math[direction === 1 ? "max" : "min"](...entries.map(e => e[key]));
    return entries.filter(e => e[key] === value);
  };
  const personal = players.map(p => ({
    name: p.player.name,
    goals: p.history.reduce((n, h) => n + h.match.goals.filter(g => !g.ownGoal && g.playerId === p.player.id).length, 0),
    winners: p.history.filter(h => h.result === "W" && !h.match.goals.at(-1)?.ownGoal && h.match.goals.at(-1)?.playerId === p.player.id).length,
    shutouts: p.history.filter(h => h.result === "W" && h.ga === 0).length,
    shutoutLosses: p.history.filter(h => h.result === "L" && h.gf === 0).length,
    oneGoalLosses: p.history.filter(h => h.result === "L" && h.ga - h.gf === 1).length,
    dailyGames: Math.max(...[...new Set(p.history.map(h => day(h.match.time)))].map(d => p.history.filter(h => day(h.match.time) === d).length)),
    ownGoalWins: p.history.filter(h => h.result === "W" && h.match.goals.some(g => g.ownGoal && g.playerId === p.player.id)).length,
    partners: new Set(p.history.flatMap(h => h.partners)).size,
  }));
  return { highest: extreme("after", 1), lowest: extreme("after", -1), gain: extreme("delta", 1), loss: extreme("delta", -1), days, leaders, personal };
}
