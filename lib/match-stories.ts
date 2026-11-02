import type { League, Match } from "./league.ts";

type ScorePoint = { home: number; away: number };
type ScoringRun = {
  teamId: string;
  start: number;
  end: number;
  length: number;
};
export type MatchFlow = {
  match: Match;
  points: ScorePoint[];
  leads: ScorePoint;
  leadChanges: number[];
  runs: ScoringRun[];
  winner: "home" | "away" | null;
  winnerDeficit: number;
};
export type MatchStory = {
  id: string;
  title: string;
  matchId: string;
  time: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  moments: { label: string; score: string }[];
  paragraphs: string[];
};

// Array order is the scoring record; timestamps and minutes may be backfilled.
export function recordedMatchFlow(match: Match): MatchFlow | null {
  if (match.status !== "finished" || match.summary) return null;
  const points: ScorePoint[] = [{ home: 0, away: 0 }];
  const leads = { home: 0, away: 0 };
  const leadChanges: number[] = [];
  const runs: ScoringRun[] = [];
  let leader = 0;
  for (const [index, goal] of match.goals.entries()) {
    if (goal.teamId !== match.homeId && goal.teamId !== match.awayId)
      return null;
    const previous = points.at(-1)!;
    const current = {
      home: previous.home + Number(goal.teamId === match.homeId),
      away: previous.away + Number(goal.teamId === match.awayId),
    };
    points.push(current);
    const difference = current.home - current.away;
    leads.home = Math.max(leads.home, difference);
    leads.away = Math.max(leads.away, -difference);
    const nextLeader = Math.sign(difference);
    if (nextLeader && leader && nextLeader !== leader)
      leadChanges.push(index + 1);
    if (nextLeader) leader = nextLeader;
    const run = runs.at(-1);
    if (run?.teamId === goal.teamId) {
      run.end = index + 1;
      run.length++;
    } else
      runs.push({
        teamId: goal.teamId,
        start: index,
        end: index + 1,
        length: 1,
      });
  }
  const final = points.at(-1)!;
  const winner =
    final.home > final.away ? "home" : final.away > final.home ? "away" : null;
  return {
    match,
    points,
    leads,
    leadChanges,
    runs,
    winner,
    winnerDeficit:
      winner === "home" ? leads.away : winner === "away" ? leads.home : 0,
  };
}

const byTime = (a: MatchFlow, b: MatchFlow) =>
  Date.parse(a.match.time) - Date.parse(b.match.time) ||
  a.match.id.localeCompare(b.match.id);
const opposite = (side: "home" | "away") => (side === "home" ? "away" : "home");
const sidePlayers = (flow: MatchFlow, side: "home" | "away") =>
  side === "home" ? flow.match.homePlayers : flow.match.awayPlayers;
const lastGoalDecides = (flow: MatchFlow) => {
  const before = flow.points.at(-2);
  return (
    before !== undefined && before.home === before.away && flow.winner !== null
  );
};

export function buildMatchStories(league: League): MatchStory[] {
  const name = (id: string) =>
    league.players.find((p) => p.id === id)?.name || "已归档球员";
  const names = (ids: string[]) => ids.map(name).join("、");
  const flows = league.matches
    .map(recordedMatchFlow)
    .filter((flow): flow is MatchFlow => flow !== null)
    .sort(byTime);
  const stories: MatchStory[] = [];
  const used = new Set<string>();
  const score = (point: ScorePoint, side: "home" | "away") =>
    `${point[side]}:${point[opposite(side)]}`;
  const add = (
    flow: MatchFlow,
    id: string,
    title: string,
    paragraphs: string[],
    stages: [number, string][],
  ) => {
    const final = flow.points.at(-1)!;
    const moments = new Map<number, string>([
      [0, "开局"],
      ...stages,
      [flow.points.length - 1, "终场"],
    ]);
    stories.push({
      id,
      title,
      matchId: flow.match.id,
      time: flow.match.time,
      home: names(flow.match.homePlayers),
      away: names(flow.match.awayPlayers),
      homeScore: final.home,
      awayScore: final.away,
      moments: [...moments]
        .sort(([a], [b]) => a - b)
        .map(([index, label]) => ({
          label,
          score: `${flow.points[index].home}:${flow.points[index].away}`,
        })),
      paragraphs,
    });
    used.add(flow.match.id);
  };
  const lowestPoint = (flow: MatchFlow) =>
    flow.points
      .map((point) => point[opposite(flow.winner!)] - point[flow.winner!])
      .lastIndexOf(flow.winnerDeficit);

  const comeback = flows
    .filter((flow) => flow.winner && flow.winnerDeficit > 0)
    .sort((a, b) => b.winnerDeficit - a.winnerDeficit || byTime(a, b))[0];
  if (comeback) {
    const side = comeback.winner!;
    const low = lowestPoint(comeback);
    const winners = names(sidePlayers(comeback, side));
    const losers = names(sidePlayers(comeback, opposite(side)));
    const final = comeback.points.at(-1)!;
    const closingRun = comeback.runs.at(-1)!;
    const scorers = sidePlayers(comeback, side)
      .map((id) => ({
        id,
        goals: comeback.match.goals
          .slice(low)
          .filter((g) => !g.ownGoal && g.playerId === id).length,
      }))
      .filter((p) => p.goals);
    add(
      comeback,
      "comeback",
      `落后 ${comeback.winnerDeficit} 球，最后赢的还是他们`,
      [
        `${winners}面对${losers}，一度以 ${score(comeback.points[low], side)} 落后。这是本场最大的分差，也是他们离胜利最远的一个节点。最终的比分却停在 ${score(final, side)}：从落后 ${comeback.winnerDeficit} 球到反败为胜，他们把这一场写成了 beta赛季最醒目的逆转。`,
        `${closingRun.teamId === (side === "home" ? comeback.match.homeId : comeback.match.awayId) && closingRun.start === low ? `从这个比分起，他们连续拿下 ${closingRun.length} 分。` : "此后，他们开始追分。"}${scorers.length ? `${scorers.map((p) => `${name(p.id)}打进 ${p.goals} 球`).join("，")}。` : ""}${lastGoalDecides(comeback) ? `双方在倒数第二球后站上 ${comeback.points.at(-2)!.home}:${comeback.points.at(-2)!.away}，最后一球把整场比赛的结局翻了过来。` : "终场的胜利，把此前落后的比分留在了身后。"}领先时的优势有多大，后来这次翻盘就有多值得记住。`,
      ],
      [
        [low, "最大落后"],
        ...(lastGoalDecides(comeback)
          ? [[comeback.points.length - 2, "最后平分"] as [number, string]]
          : []),
      ],
    );
  }

  const redemption = flows
    .filter((flow) => {
      if (!flow.winner || used.has(flow.match.id)) return false;
      const final = flow.points.at(-1)!;
      const last = flow.match.goals.at(-1);
      return (
        Math.abs(final.home - final.away) === 1 &&
        last &&
        !last.ownGoal &&
        sidePlayers(flow, flow.winner).includes(last.playerId) &&
        flow.match.goals.some((g) => g.ownGoal && g.playerId === last.playerId)
      );
    })
    .sort((a, b) => b.winnerDeficit - a.winnerDeficit || byTime(a, b))[0];
  if (redemption) {
    const side = redemption.winner!;
    const last = redemption.match.goals.at(-1)!;
    const ownIndex = redemption.match.goals.findIndex(
      (g) => g.ownGoal && g.playerId === last.playerId,
    );
    const goals = redemption.match.goals.filter(
      (g) => !g.ownGoal && g.playerId === last.playerId,
    ).length;
    const final = redemption.points.at(-1)!;
    add(
      redemption,
      "redemption",
      "先送乌龙，再亲手拿下最后一球",
      [
        `${name(last.playerId)}的这场比赛，因为一次乌龙留下了波折。那一球之后，比分变成 ${score(redemption.points[ownIndex + 1], side)}。${redemption.winnerDeficit ? `这场比赛里，他和搭档${names(sidePlayers(redemption, side).filter((id) => id !== last.playerId))}一度以 ${score(redemption.points[lowestPoint(redemption)], side)} 落后。` : "比赛还远没有结束。"}但终场时，${names(sidePlayers(redemption, side))}以 ${score(final, side)} 赢下比赛，把前面的失误留在了胜利之前。`,
        `他全场打进 ${goals} 球，并在 ${score(redemption.points.at(-2)!, side)} 的平局之后，打入了决定最终胜负的最后一球。前面的乌龙和终场的制胜球属于同一个人，因此连成了一个完整的故事：先给自己挖下难题，再把答案亲手打进对面的球门。`,
      ],
      [
        [ownIndex + 1, "乌龙之后"],
        ...(redemption.winnerDeficit
          ? [[lowestPoint(redemption), "最大落后"] as [number, string]]
          : []),
        [redemption.points.length - 2, "最后平分"],
      ],
    );
  }

  const seesaw = flows
    .filter(
      (flow) =>
        !used.has(flow.match.id) && flow.winner && flow.leadChanges.length >= 3,
    )
    .sort(
      (a, b) =>
        b.leadChanges.length - a.leadChanges.length ||
        Math.abs(a.points.at(-1)!.home - a.points.at(-1)!.away) -
          Math.abs(b.points.at(-1)!.home - b.points.at(-1)!.away) ||
        byTime(a, b),
    )[0];
  if (seesaw) {
    const side = seesaw.winner!;
    const final = seesaw.points.at(-1)!;
    const ties = seesaw.points
      .slice(1)
      .filter((point) => point.home === point.away).length;
    const run = seesaw.runs.at(-1)!;
    add(
      seesaw,
      "seesaw",
      `${seesaw.leadChanges.length} 次交换领先，把悬念留到终场`,
      [
        `${names(seesaw.match.homePlayers)}与${names(seesaw.match.awayPlayers)}把这一场打成了拉锯战。比分 ${ties} 次回到平局，领先方也 ${seesaw.leadChanges.length} 次更换。前面刚刚取得的优势，下一轮攻防就可能交到另一边；直到最后，${names(sidePlayers(seesaw, side))}才以 ${score(final, side)} 拿下胜利。`,
        `${run.teamId === (side === "home" ? seesaw.match.homeId : seesaw.match.awayId) ? `最后一段从 ${score(seesaw.points[run.start], side)} 开始，胜方连续拿下 ${run.length} 分，` : "比赛的最后一段，"}把比分定在 ${score(final, side)}。${lastGoalDecides(seesaw) ? `此前的 ${score(seesaw.points.at(-2)!, side)} 还把双方留在同一条线上，${name(seesaw.match.goals.at(-1)!.playerId)}${seesaw.match.goals.at(-1)!.ownGoal ? "的乌龙让胜负在最后一球落定" : "的最后一球才让胜负落定"}。` : "来回易手的领先终于在终场前有了归属。"}这场球留下的高光，就是那份一直延续到最后的悬念。`,
      ],
      seesaw.leadChanges.map((index, i) => [index, `第 ${i + 1} 次易手`]),
    );
  }

  const runCandidate = flows
    .filter((flow) => flow.winner && !used.has(flow.match.id))
    .flatMap((flow) =>
      flow.runs
        .filter(
          (run) =>
            run.length >= 4 &&
            run.teamId ===
              (flow.winner === "home" ? flow.match.homeId : flow.match.awayId),
        )
        .map((run) => ({ flow, run })),
    )
    .sort(
      (a, b) =>
        b.run.length - a.run.length ||
        b.flow.points[b.run.start][opposite(b.flow.winner!)] -
          b.flow.points[b.run.start][b.flow.winner!] -
          (a.flow.points[a.run.start][opposite(a.flow.winner!)] -
            a.flow.points[a.run.start][a.flow.winner!]) ||
        byTime(a.flow, b.flow),
    )[0];
  if (runCandidate) {
    const { flow, run } = runCandidate;
    const side = flow.winner!;
    const goals = flow.match.goals.slice(run.start, run.end);
    const scorers = sidePlayers(flow, side)
      .map((id) => ({
        id,
        goals: goals.filter((g) => !g.ownGoal && g.playerId === id).length,
      }))
      .filter((p) => p.goals);
    const ownGoals = goals.filter((g) => g.ownGoal).length;
    add(
      flow,
      "scoring-run",
      `连拿 ${run.length} 分，把一场球打出转折`,
      [
        `${names(sidePlayers(flow, side))}从 ${score(flow.points[run.start], side)} 开始，一口气连续拿下 ${run.length} 分，把比分改写为 ${score(flow.points[run.end], side)}。${flow.points[run.start][side] < flow.points[run.start][opposite(side)] ? (flow.points[run.end][side] > flow.points[run.end][opposite(side)] ? "追平、反超，再到拉开差距，都发生在这段连续得分里。" : "这一段连续得分，把此前的落后一步步缩小。") : "对手在这一段里没有增加得分，比分也逐渐向同一边倾斜。"}最终，他们以 ${score(flow.points.at(-1)!, side)} 赢下了这场比赛。`,
        `这波得分中，${[...scorers.map((p) => `${name(p.id)}打进 ${p.goals} 球`), ...(ownGoals ? [`${ownGoals} 分来自对手的乌龙`] : [])].join("，")}。一个接一个的得分累积起来，把比赛推到了新的局面。比起只看终场比分，这段连续得分更能留下这场比赛的转折。`,
      ],
      [
        [run.start, "连续得分前"],
        [run.end, "连续得分后"],
      ],
    );
  }

  const scorer = flows
    .filter((flow) => flow.winner && !used.has(flow.match.id))
    .flatMap((flow) =>
      sidePlayers(flow, flow.winner!).map((id) => ({
        flow,
        id,
        goals: flow.match.goals.filter((g) => !g.ownGoal && g.playerId === id)
          .length,
      })),
    )
    .filter((p) => p.goals >= 4)
    .sort(
      (a, b) =>
        b.goals - a.goals || byTime(a.flow, b.flow) || a.id.localeCompare(b.id),
    )[0];
  if (scorer) {
    const { flow, id, goals } = scorer;
    const side = flow.winner!;
    const final = flow.points.at(-1)!;
    const stages: [number, string][] = [];
    if (flow.winnerDeficit) stages.push([lowestPoint(flow), "最大落后"]);
    const equalizer = flow.points.findIndex(
      (point, i) => i > (stages[0]?.[0] ?? 0) && point.home === point.away,
    );
    if (equalizer > 0) stages.push([equalizer, "追平比分"]);
    add(
      flow,
      "scorer",
      goals === final[side]
        ? `包办 ${goals} 球，这场火力全部写在他名下`
        : `单场 ${goals} 球，留下一个高光时刻`,
      [
        `${name(id)}在这场比赛中打进 ${goals} 球，${goals === final[side] ? `包办了本方的全部进球，` : ""}帮助${names(sidePlayers(flow, side))}以 ${score(final, side)} 击败${names(sidePlayers(flow, opposite(side)))}。${flow.winnerDeficit ? `这场胜利还经历过 ${score(flow.points[lowestPoint(flow)], side)} 的落后，进球也因此同时承担了追分和反超的任务。` : "胜利之外，这份单场进球记录让他成了比赛里最醒目的名字。"}`,
        `${equalizer > 0 ? `比分回到 ${score(flow.points[equalizer], side)} 后，比赛仍然没有结束。` : "前面的进球累积成优势，最后还需要把比分守到终场。"}终场的 ${score(final, side)}，把这些进球连成了一场完整的胜利。赛季榜单记录整季的积累，这一场则把他的得分表现浓缩到了球桌上的一次对决里。`,
      ],
      stages,
    );
  }
  return stories;
}
