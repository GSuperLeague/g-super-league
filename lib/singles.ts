import type { Goal, League, Player } from "./league.ts";
import { inheritRating, matchSeason, seasonName } from "./seasons.ts";
import type { RatingSeed, SeasonContext, SeasonId } from "./seasons.ts";
import { applyNewsAction } from "./news.ts";
import type { NewsArticle } from "./news.ts";
import {
  RATING_BASE,
  expectedResult,
  marginMultiplier,
  mmrChange,
  nextRankPoints,
} from "./rating.ts";

export type SinglesPlayer = Pick<
  Player,
  "id" | "name" | "nickname" | "number" | "bio" | "photo"
>;
export type SinglesMatch = {
  id: string;
  homeId: string;
  awayId: string;
  time: string;
  round: string;
  status: "scheduled" | "live" | "finished";
  goals: Goal[];
  summary?: { homeScore: number; awayScore: number; recordedAt: string };
};
export type SinglesLeague = SeasonContext<RatingSeed> & {
  mode: "singles";
  teams: never[];
  players: SinglesPlayer[];
  matches: SinglesMatch[];
  settings: League["settings"];
  updatedAt: string;
  news?: NewsArticle[];
};
export type SinglesAction = {
  type: string;
  id: string;
  data?: unknown;
  goalId?: string;
};
export const emptySinglesLeague = (): SinglesLeague => ({
  mode: "singles",
  teams: [],
  players: [],
  matches: [],
  settings: { season: "2026 单打赛季", win: 3, draw: 1, loss: 0 },
  updatedAt: "",
});
export function singlesScore(m: SinglesMatch): [number, number] {
  return m.summary
    ? [m.summary.homeScore, m.summary.awayScore]
    : [
        m.goals.filter((g) => g.teamId === m.homeId).length,
        m.goals.filter((g) => g.teamId === m.awayId).length,
      ];
}
const fail = (message: string): never => {
  throw new Error(message);
};
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    return fail("提交内容无效");
  return value as Record<string, unknown>;
}
function str(value: unknown, max: number, required = false): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    return fail("请检查必填文字及长度");
  return value.trim();
}
function int(value: unknown, max: number): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > max
  )
    return fail("数值超出允许范围");
  return value;
}

export function applySinglesAction(
  source: SinglesLeague,
  input: unknown,
): SinglesLeague {
  if (source.mode !== "singles") return fail("单打数据库格式不正确");
  const s = structuredClone(source),
    a = record(input),
    id = str(a.id, 80, true);
  if (a.type === "news.save" || a.type === "news.delete") {
    s.news = applyNewsAction(s.news || [], { type: a.type, id, data: a.data });
  } else if (a.type === "player.save") {
    const p = record(a.data),
      number = int(p.number, 99);
    if (s.players.some((x) => x.id !== id && x.number === number))
      fail("该号码已被单打球员使用");
    const photo = str(p.photo, 160);
    if (photo && !/^\/api\/singles\/photos\/[a-f0-9-]+$/.test(photo))
      fail("请上传单打球员头像");
    const player: SinglesPlayer = {
      id,
      name: str(p.name, 30, true),
      nickname: str(p.nickname, 30),
      number,
      bio: str(p.bio, 500),
      photo,
    };
    const index = s.players.findIndex((x) => x.id === id);
    if (index < 0) s.players.push(player);
    else s.players[index] = player;
  } else if (a.type === "player.delete") {
    if (s.matches.some((m) => m.homeId === id || m.awayId === id))
      fail("球员已有比赛记录，不能删除");
    s.players = s.players.filter((p) => p.id !== id);
  } else if (a.type === "match.save" || a.type === "match.result") {
    const p = record(a.data),
      old = s.matches.find((m) => m.id === id);
    if (a.type === "match.save" && old && old.status !== "scheduled")
      fail("仅未开赛的赛程可以编辑");
    const homeId = str(p.homeId, 80, true),
      awayId = str(p.awayId, 80, true);
    if (
      homeId === awayId ||
      ![homeId, awayId].every((pid) => s.players.some((x) => x.id === pid))
    )
      fail("请选择两位不同的单打球员");
    if (old && (old.homeId !== homeId || old.awayId !== awayId))
      fail("已有比赛不能更换球员，请新建比赛");
    if (
      a.type === "match.result" &&
      old?.goals.length &&
      p.replaceDetailed !== true
    )
      fail("请确认替换原逐球记录");
    const time = str(p.time, 50, true);
    if (!Number.isFinite(Date.parse(time))) fail("比赛时间无效");
    const match: SinglesMatch = {
      id,
      homeId,
      awayId,
      time,
      round: str(p.round, 30, true),
      goals: [],
      status:
        a.type === "match.result"
          ? "finished"
          : p.startNow === true
            ? "live"
            : "scheduled",
    };
    if (a.type === "match.result")
      match.summary = {
        homeScore: int(p.homeScore, 999),
        awayScore: int(p.awayScore, 999),
        recordedAt: new Date().toISOString(),
      };
    if (old) s.matches[s.matches.indexOf(old)] = match;
    else s.matches.push(match);
  } else if (a.type === "match.delete") {
    s.matches = s.matches.filter((m) => m.id !== id);
  } else if (a.type === "settings.save") {
    const p = record(a.data);
    s.settings = {
      season: str(p.season, 30, true),
      win: int(p.win, 10),
      draw: int(p.draw, 10),
      loss: int(p.loss, 10),
    };
  } else {
    const match = s.matches.find((m) => m.id === id);
    if (!match) return fail("找不到单打比赛");
    if (match.summary) fail("这场比赛使用赛后汇总，请编辑最终比分");
    if (a.type === "match.start") {
      if (match.status !== "scheduled") fail("比赛已经开始");
      match.status = "live";
    } else if (a.type === "match.finish") {
      if (match.status !== "live") fail("只有进行中的比赛可以完赛");
      match.status = "finished";
    } else if (a.type === "match.reopen") {
      if (match.status !== "finished") fail("只有已完赛比赛可以重新打开");
      match.status = "live";
    } else if (a.type === "goal.add") {
      const p = record(a.data),
        eventId = str(p.id, 80, true);
      if (match.goals.some((g) => g.id === eventId)) return s;
      if (match.status !== "live") fail("请先开始比赛，或重新打开已完赛比赛");
      const teamId = str(p.teamId, 80, true),
        playerId = str(p.playerId, 80, true),
        ownGoal = p.ownGoal === true;
      if (![match.homeId, match.awayId].includes(teamId))
        fail("得分方不在本场比赛中");
      const scorer = ownGoal
        ? teamId === match.homeId
          ? match.awayId
          : match.homeId
        : teamId;
      if (playerId !== scorer) fail("进球球员与得分方不符");
      if (singlesScore(match)[teamId === match.homeId ? 0 : 1] >= 999)
        fail("比分不能超过 999");
      match.goals.push({
        id: eventId,
        teamId,
        playerId,
        ownGoal,
        minute: int(p.minute ?? 0, 999),
        createdAt: new Date().toISOString(),
      });
    } else if (a.type === "goal.delete") {
      if (match.status !== "live") fail("请先重新打开比赛，再修改进球");
      match.goals = match.goals.filter((g) => g.id !== str(a.goalId, 80, true));
    } else fail("未知操作");
  }
  if (s.players.length > 2000 || s.matches.length > 5000)
    fail("已达到单打联赛容量上限");
  s.updatedAt = new Date().toISOString();
  return s;
}

export type SinglesAppearance = {
  match: SinglesMatch;
  opponentId: string;
  gf: number;
  ga: number;
  result: "W" | "D" | "L";
  before: number;
  after: number;
  delta: number;
};
export type SinglesStats = {
  player: SinglesPlayer;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  rankPoints: number;
  mmr: number;
  winRate: number | null;
  ownGoals: number;
  streak: number;
  bestStreak: number;
  history: SinglesAppearance[];
};
export function analyzeSingles(s: SinglesLeague): SinglesStats[] {
  const stats = new Map<string, SinglesStats>(
    s.players.map((player) => [
      player.id,
      {
        player,
        games: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gf: 0,
        ga: 0,
        gd: 0,
        points: 0,
        rankPoints: s.ratingSeeds?.[player.id]?.rankPoints ?? RATING_BASE,
        mmr: s.ratingSeeds?.[player.id]?.mmr ?? RATING_BASE,
        winRate: null,
        ownGoals: 0,
        streak: 0,
        bestStreak: 0,
        history: [],
      },
    ]),
  );
  const ordered = [...s.matches].sort(
    (a, b) =>
      Date.parse(a.time) - Date.parse(b.time) || a.id.localeCompare(b.id),
  );
  for (const match of ordered) {
    if (match.status !== "scheduled")
      for (const goal of match.goals) {
        const player = stats.get(goal.playerId);
        if (goal.ownGoal && player) player.ownGoals++;
      }
    if (match.status !== "finished") continue;
    const home = stats.get(match.homeId),
      away = stats.get(match.awayId);
    if (!home || !away || home === away) continue;
    const [a, b] = singlesScore(match),
      actual = a > b ? 1 : a < b ? 0 : 0.5;
    const multiplier = marginMultiplier(a, b);
    const delta = mmrChange(home.mmr, away.mmr, actual, multiplier);
    const homeExpected = expectedResult(home.mmr, away.mmr);
    for (const [self, opponent, gf, ga, change] of [
      [home, away, a, b, delta],
      [away, home, b, a, -delta],
    ] as const) {
      const result = gf > ga ? "W" : gf < ga ? "L" : "D";
      const before = self.rankPoints;
      self.rankPoints = nextRankPoints(
        before,
        self.mmr,
        gf > ga ? 1 : gf < ga ? 0 : 0.5,
        multiplier,
        self === home ? homeExpected : 1 - homeExpected,
      );
      self.games++;
      self.gf += gf;
      self.ga += ga;
      self.gd = self.gf - self.ga;
      self.wins += result === "W" ? 1 : 0;
      self.draws += result === "D" ? 1 : 0;
      self.losses += result === "L" ? 1 : 0;
      self.points =
        self.wins * s.settings.win +
        self.draws * s.settings.draw +
        self.losses * s.settings.loss;
      self.winRate = self.wins / self.games;
      self.mmr += change;
      self.streak = result === "W" ? self.streak + 1 : 0;
      self.bestStreak = Math.max(self.bestStreak, self.streak);
      self.history.push({
        match,
        opponentId: opponent.player.id,
        gf,
        ga,
        result,
        before,
        after: self.rankPoints,
        delta: self.rankPoints - before,
      });
    }
  }
  return [...stats.values()];
}
export function singlesForSeason(
  league: SinglesLeague,
  season: SeasonId,
): SinglesLeague {
  const beta: SinglesLeague = {
    ...league,
    seasonId: "beta",
    ratingSeeds: undefined,
    settings: { ...league.settings, season: seasonName("beta") },
    matches: league.matches.filter((m) => matchSeason(m.time) === "beta"),
  };
  if (season === "beta") return beta;
  return {
    ...league,
    seasonId: season,
    settings: { ...league.settings, season: seasonName(season) },
    matches: league.matches.filter((m) => matchSeason(m.time) === season),
    ratingSeeds: Object.fromEntries(
      analyzeSingles(beta).map((p) => [
        p.player.id,
        inheritRating(p.rankPoints, p.mmr),
      ]),
    ),
  };
}

export function singlesStandings(
  stats: SinglesStats[],
  by: "points" | "rank" = "points",
): SinglesStats[] {
  return [...stats].sort((a, b) =>
    by === "rank"
      ? b.rankPoints - a.rankPoints ||
        b.games - a.games ||
        a.player.id.localeCompare(b.player.id)
      : b.points - a.points ||
        b.gd - a.gd ||
        b.gf - a.gf ||
        a.player.name.localeCompare(b.player.name, "zh"),
  );
}
