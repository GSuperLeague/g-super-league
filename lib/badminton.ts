export type BadmintonMode = "singles" | "doubles";
export const BADMINTON_FIRST_WIN_POLICY = {
  timeZone: "Asia/Shanghai",
  points: 10,
} as const;
export type BadmintonPlayer = {
  id: string;
  name: string;
  nickname: string;
  bio: string;
  hand: "right" | "left" | "unknown";
  photo: string;
  active: boolean;
  sourcePlayerId?: string;
};
export type GameScore = { home: number; away: number };
export type BadmintonFormat = {
  pointsToWin: number;
  bestOf: 1 | 3;
  // Old stored matches omit this field and keep their original first-to rule.
  winBy?: 1 | 2;
};
export type BadmintonPoint = {
  id: string;
  side: "home" | "away";
  previousGames: GameScore[];
  recordedAt: string;
};
export type BadmintonMatch = {
  id: string;
  mode: BadmintonMode;
  time: string;
  round: string;
  homePlayers: string[];
  awayPlayers: string[];
  status: "scheduled" | "live" | "finished";
  format: BadmintonFormat;
  games: GameScore[];
  pointEvents: BadmintonPoint[];
  recording: "points" | "summary";
  createdAt: string;
  updatedAt: string;
  recordingSource?: {
    minutesUrl: string;
    summaryDocumentUrl: string;
    verbatimDocumentUrl: string;
    recordingStart: string;
    recordingOffsetStartSeconds: number;
    recordingOffsetEndSeconds: number;
    timePrecision: string;
    importedAt: string;
    note?: string;
  };
};
export type BadmintonLeague = {
  sport: "badminton";
  schemaVersion: 1;
  players: BadmintonPlayer[];
  matches: BadmintonMatch[];
  settings: { season: string } & BadmintonFormat;
  recentActions: string[];
  updatedAt: string;
};
export type BadmintonAction = {
  type: string;
  id: string;
  actionId: string;
  data?: unknown;
};
export const emptyBadmintonLeague = (): BadmintonLeague => ({
  sport: "badminton",
  schemaVersion: 1,
  players: [],
  matches: [],
  settings: { season: "GB 第一赛季", pointsToWin: 11, bestOf: 1, winBy: 2 },
  recentActions: [],
  updatedAt: "",
});

const fail = (message: string): never => {
  throw Error(message);
};
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail("提交内容格式不正确");
}
function text(value: unknown, max = 80, required = true): string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    fail("请检查文字内容和长度");
  return (value as string).trim();
}
function integer(value: unknown, min: number, max: number): number {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= min &&
    value <= max
    ? value
    : fail("比分或赛制数值不正确");
}
function formatFrom(value: unknown): BadmintonFormat {
  const input = record(value),
    pointsToWin = integer(input.pointsToWin, 1, 99);
  const bestOf = integer(input.bestOf, 1, 3);
  if (bestOf !== 1 && bestOf !== 3) fail("请选择一局决胜或三局两胜");
  const winBy = input.winBy === undefined ? 2 : integer(input.winBy, 1, 2);
  return { pointsToWin, bestOf: bestOf as 1 | 3, winBy: winBy as 1 | 2 };
}
export function badmintonRuleLabel(format: BadmintonFormat): string {
  return format.winBy === 2
    ? `${format.pointsToWin - 1}平后净胜两分`
    : "不加赛";
}
export function gameWinner(
  game: GameScore,
  format: BadmintonFormat,
): "home" | "away" | null {
  const target =
    format.winBy === 2
      ? Math.max(format.pointsToWin, Math.min(game.home, game.away) + 2)
      : format.pointsToWin;
  if (game.home === target && game.away < target)
    return "home";
  if (game.away === target && game.home < target)
    return "away";
  return null;
}
export function badmintonScore(match: BadmintonMatch) {
  const homeGames = match.games.filter(
    (g) => gameWinner(g, match.format) === "home",
  ).length;
  const awayGames = match.games.filter(
    (g) => gameWinner(g, match.format) === "away",
  ).length;
  return {
    homeGames,
    awayGames,
    homePoints: match.games.reduce((sum, g) => sum + g.home, 0),
    awayPoints: match.games.reduce((sum, g) => sum + g.away, 0),
  };
}
export function badmintonWinner(match: BadmintonMatch): "home" | "away" | null {
  const s = badmintonScore(match),
    required = Math.ceil(match.format.bestOf / 2);
  return s.homeGames >= required
    ? "home"
    : s.awayGames >= required
      ? "away"
      : null;
}
function checkedGames(
  value: unknown,
  format: BadmintonFormat,
  finished: boolean,
): GameScore[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > format.bestOf)
    fail("请逐局填写比分");
  const games = (value as unknown[]).map((v) => {
    const g = record(v);
    const max = format.winBy === 2 ? Number.MAX_SAFE_INTEGER : format.pointsToWin;
    return {
      home: integer(g.home, 0, max),
      away: integer(g.away, 0, max),
    };
  });
  let homeWins = 0,
    awayWins = 0;
  const required = Math.ceil(format.bestOf / 2);
  games.forEach((g, i) => {
    if (homeWins >= required || awayWins >= required)
      fail("比赛决出胜负后不能再增加一局");
    const winner = gameWinner(g, format);
    if (!winner && (finished || i < games.length - 1))
      fail(
        format.winBy === 2
          ? "每局须先达到目标分；平分后须首次净胜两分时结束"
          : "每局须有一方先达到目标分，双方不能同时达到目标分",
      );
    if (winner === "home") homeWins++;
    if (winner === "away") awayWins++;
  });
  if (finished && Math.max(homeWins, awayWins) < required)
    fail("比赛尚未达到完赛条件");
  return games;
}
function matchInput(s: BadmintonLeague, value: unknown) {
  const p = record(value);
  if (p.mode !== "singles" && p.mode !== "doubles") fail("请选择单打或双打");
  const mode = p.mode as BadmintonMode,
    count = mode === "singles" ? 1 : 2;
  const roster = (key: string) => {
    if (!Array.isArray(p[key]) || p[key].length !== count)
      fail(`每方须选择${count}名球员`);
    const ids = (p[key] as unknown[]).map((x) => text(x));
    if (!ids.every((id) => s.players.some((player) => player.id === id)))
      fail("球员尚未登记");
    return ids;
  };
  const homePlayers = roster("homePlayers"),
    awayPlayers = roster("awayPlayers");
  if (new Set([...homePlayers, ...awayPlayers]).size !== count * 2)
    fail("同一场比赛不能重复选择球员");
  const time = text(p.time, 50);
  if (!Number.isFinite(Date.parse(time))) fail("比赛时间无效");
  return {
    mode,
    time,
    round: text(p.round, 40),
    homePlayers,
    awayPlayers,
    format: formatFrom(p.format),
  };
}

// The reducer is shared by the API and domain tests. Writes are persisted with
// an expected-revision check, and action IDs make retried point events idempotent.
export function applyBadmintonAction(
  input: BadmintonLeague,
  action: BadmintonAction,
  now = new Date().toISOString(),
): BadmintonLeague {
  const s = structuredClone(input),
    id = text(action.id),
    actionId = text(action.actionId);
  if (s.recentActions.includes(actionId)) return s;
  const p = action.data === undefined ? {} : record(action.data);
  if (action.type === "player.save") {
    const name = text(p.name, 30),
      old = s.players.find((player) => player.id === id);
    if (s.players.some((player) => player.id !== id && player.name === name))
      fail("已有同名球员，请使用能够区分的姓名");
    if (!["right", "left", "unknown"].includes(String(p.hand)))
      fail("请选择惯用手");
    const photo = old?.photo || "";
    const player: BadmintonPlayer = {
      id,
      name,
      nickname: text(p.nickname ?? "", 30, false),
      bio: text(p.bio ?? "", 300, false),
      hand: p.hand as BadmintonPlayer["hand"],
      photo,
      active: old?.active ?? true,
      ...(old?.sourcePlayerId ? { sourcePlayerId: old.sourcePlayerId } : {}),
    };
    if (old) s.players[s.players.indexOf(old)] = player;
    else s.players.push(player);
  } else if (action.type === "player.import") {
    if (
      !Array.isArray(p.players) ||
      p.players.length < 1 ||
      p.players.length > 200
    )
      fail("请选择要登记的球员");
    // The API constructs this payload from the trusted table-football roster.
    for (const raw of p.players as unknown[]) {
      const source = record(raw),
        sourceId = text(source.id);
      if (
        s.players.some(
          (x) => x.sourcePlayerId === sourceId || x.id === sourceId,
        )
      )
        continue;
      const name = text(source.name, 30);
      if (s.players.some((x) => x.name === name))
        fail(`${name} 已登记，请先核对同名球员身份`);
      const photo = text(source.photo ?? "", 150, false);
      if (photo && !/^\/api\/photos\/[a-f0-9-]+$/.test(photo))
        fail("来源头像格式无效");
      s.players.push({
        id: sourceId,
        sourcePlayerId: sourceId,
        name,
        nickname: text(source.nickname ?? "", 30, false),
        photo,
        hand: "unknown",
        bio: "",
        active: true,
      });
    }
  } else if (action.type === "player.active") {
    const player = s.players.find((player) => player.id === id);
    if (!player) fail("找不到球员");
    if (typeof p.active !== "boolean") fail("登记状态无效");
    player!.active = p.active as boolean;
  } else if (action.type === "match.save" || action.type === "match.result") {
    const old = s.matches.find((match) => match.id === id);
    if (action.type === "match.save" && old && old.status !== "scheduled")
      fail("已开赛请使用修改比分");
    const details = matchInput(s, p);
    if (
      !old &&
      [...details.homePlayers, ...details.awayPlayers].some(
        (pid) => !s.players.find((x) => x.id === pid)?.active,
      )
    )
      fail("请先恢复球员的登记状态");
    if (
      action.type === "match.result" &&
      old?.pointEvents.length &&
      p.replaceDetailed !== true
    )
      fail("请确认用新比分替换原逐分记录");
    const finished = action.type === "match.result";
    const games = finished
      ? checkedGames(p.games, details.format, true)
      : [{ home: 0, away: 0 }];
    const match: BadmintonMatch = {
      id,
      ...details,
      games,
      pointEvents: [],
      status: finished
        ? "finished"
        : p.startNow === true
          ? "live"
          : "scheduled",
      recording: finished ? "summary" : "points",
      createdAt: old?.createdAt || now,
      updatedAt: now,
      ...(old?.recordingSource ? { recordingSource: old.recordingSource } : {}),
    };
    if (old) s.matches[s.matches.indexOf(old)] = match;
    else s.matches.push(match);
  } else if (action.type === "match.delete") {
    if (!s.matches.some((match) => match.id === id)) fail("找不到比赛");
    s.matches = s.matches.filter((match) => match.id !== id);
  } else if (action.type === "settings.save") {
    s.settings = { season: text(p.season, 30), ...formatFrom(p) };
  } else {
    const match = s.matches.find((match) => match.id === id);
    if (!match) fail("找不到比赛");
    const m = match!;
    if (action.type === "match.start") {
      if (m.status !== "scheduled") fail("比赛已经开始");
      m.status = "live";
    } else if (action.type === "match.finish") {
      if (m.status !== "live") fail("比赛未进行中");
      checkedGames(m.games, m.format, true);
      m.status = "finished";
    } else if (action.type === "match.reopen") {
      if (m.status !== "finished") fail("只有已完赛比赛可以重新打开");
      m.status = "live";
    } else if (action.type === "point.add") {
      if (m.status !== "live") fail("请先开始或重新打开比赛");
      if (m.recording === "summary") fail("赛后录入的比赛请使用修改比分");
      if (p.side !== "home" && p.side !== "away") fail("请选择得分方");
      if (badmintonWinner(m)) fail("已达到完赛条件，请确认完赛或撤销上一分");
      if (m.pointEvents.length >= 600) fail("逐分记录过多，请使用修改比分");
      const previousGames = structuredClone(m.games);
      if (gameWinner(m.games.at(-1)!, m.format))
        m.games.push({ home: 0, away: 0 });
      m.games.at(-1)![p.side as "home" | "away"]++;
      m.pointEvents.push({
        id: actionId,
        side: p.side as "home" | "away",
        previousGames,
        recordedAt: now,
      });
    } else if (action.type === "point.undo") {
      if (m.status !== "live") fail("请先重新打开比赛");
      const event = m.pointEvents.pop();
      if (!event) throw Error("没有可以撤销的逐分记录");
      m.games = event.previousGames;
    } else fail("未知操作");
    m.updatedAt = now;
  }
  if (s.players.length > 2000 || s.matches.length > 5000)
    fail("联赛记录已达到容量上限");
  s.recentActions = [...s.recentActions, actionId].slice(-200);
  s.updatedAt = now;
  return s;
}

export type BadmintonAppearance = {
  match: BadmintonMatch;
  result: "W" | "L";
  before: number;
  after: number;
  delta: number;
  baseDelta: number;
  firstWinBonus: number;
  partnerIds: string[];
  opponentIds: string[];
  pointsFor: number;
  pointsAgainst: number;
};
export type BadmintonStats = {
  player: BadmintonPlayer;
  rankPoints: number;
  firstWinPoints: number;
  games: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  history: BadmintonAppearance[];
};
export function analyzeBadminton(
  league: BadmintonLeague,
  mode: BadmintonMode,
): BadmintonStats[] {
  const stats = new Map(
    league.players.map((player) => [
      player.id,
      {
        player,
        rankPoints: 1200,
        firstWinPoints: 0,
        games: 0,
        wins: 0,
        losses: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        history: [] as BadmintonAppearance[],
      },
    ]),
  );
  const matches = league.matches
    .filter((m) => m.mode === mode && m.status === "finished")
    .sort(
      (a, b) =>
        Date.parse(a.time) - Date.parse(b.time) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
  const firstWins = new Set<string>();
  const dayFormat = new Intl.DateTimeFormat("sv-SE", {
    timeZone: BADMINTON_FIRST_WIN_POLICY.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  for (const match of matches) {
    const winner = badmintonWinner(match),
      score = badmintonScore(match),
      count = mode === "singles" ? 1 : 2;
    if (
      !winner ||
      match.homePlayers.length !== count ||
      match.awayPlayers.length !== count ||
      new Set([...match.homePlayers, ...match.awayPlayers]).size !==
        count * 2 ||
      ![...match.homePlayers, ...match.awayPlayers].every((id) => stats.has(id))
    )
      continue;
    const average = (ids: string[]) =>
      ids.reduce((sum, id) => {
        const p = stats.get(id)!;
        return sum + p.rankPoints - p.firstWinPoints;
      }, 0) / ids.length;
    const expected =
      1 /
      (1 +
        10 **
          ((average(match.awayPlayers) - average(match.homePlayers)) / 400));
    const raw = 32 * ((winner === "home" ? 1 : 0) - expected);
    const delta = Math.sign(raw) * Math.round(Math.abs(raw));
    const matchTime = Date.parse(match.time);
    const bonusDay = Number.isFinite(matchTime)
      ? dayFormat.format(new Date(matchTime))
      : null;
    for (const side of ["home", "away"] as const) {
      const roster = side === "home" ? match.homePlayers : match.awayPlayers,
        opponents = side === "home" ? match.awayPlayers : match.homePlayers;
      for (const id of roster) {
        const p = stats.get(id)!,
          before = p.rankPoints,
          change = side === "home" ? delta : -delta;
        const baseBefore = before - p.firstWinPoints;
        const baseAfter = Math.max(0, baseBefore + change);
        const firstWinKey = JSON.stringify([mode, id, bonusDay]);
        const firstWinBonus =
          winner === side && bonusDay !== null && !firstWins.has(firstWinKey)
            ? BADMINTON_FIRST_WIN_POLICY.points
            : 0;
        if (firstWinBonus) firstWins.add(firstWinKey);
        p.firstWinPoints += firstWinBonus;
        p.rankPoints = baseAfter + p.firstWinPoints;
        p.games++;
        p.wins += Number(winner === side);
        p.losses += Number(winner !== side);
        const pointsFor = side === "home" ? score.homePoints : score.awayPoints,
          pointsAgainst = side === "home" ? score.awayPoints : score.homePoints;
        p.pointsFor += pointsFor;
        p.pointsAgainst += pointsAgainst;
        p.history.push({
          match,
          result: winner === side ? "W" : "L",
          before,
          after: p.rankPoints,
          delta: p.rankPoints - before,
          baseDelta: baseAfter - baseBefore,
          firstWinBonus,
          partnerIds: roster.filter((x) => x !== id),
          opponentIds: opponents,
          pointsFor,
          pointsAgainst,
        });
      }
    }
  }
  return [...stats.values()].sort(
    (a, b) =>
      b.rankPoints - a.rankPoints ||
      b.wins - a.wins ||
      b.games - a.games ||
      a.player.name.localeCompare(b.player.name, "zh"),
  );
}
export function badmintonPairs(league: BadmintonLeague) {
  const pairs = new Map<
    string,
    {
      ids: string[];
      games: number;
      wins: number;
      pointsFor: number;
      pointsAgainst: number;
    }
  >();
  for (const m of league.matches.filter(
    (m) => m.mode === "doubles" && m.status === "finished",
  )) {
    const winner = badmintonWinner(m);
    if (!winner) continue;
    const score = badmintonScore(m);
    for (const side of ["home", "away"] as const) {
      const ids = [...(side === "home" ? m.homePlayers : m.awayPlayers)].sort();
      if (ids.length !== 2) continue;
      const key = ids.join(":"),
        p = pairs.get(key) || {
          ids,
          games: 0,
          wins: 0,
          pointsFor: 0,
          pointsAgainst: 0,
        };
      p.games++;
      p.wins += Number(winner === side);
      p.pointsFor += side === "home" ? score.homePoints : score.awayPoints;
      p.pointsAgainst += side === "home" ? score.awayPoints : score.homePoints;
      pairs.set(key, p);
    }
  }
  return [...pairs.values()].sort(
    (a, b) => b.wins / b.games - a.wins / a.games || b.games - a.games,
  );
}
