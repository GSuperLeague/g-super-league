import { analyzeLeague, leagueForSeason } from "./analytics.ts";
import type { PlayerStats, Role } from "./analytics.ts";
import { score } from "./league.ts";
import type { League, Match } from "./league.ts";
import type { NewsArticle } from "./news.ts";
import { rankTier } from "./rating.ts";
import { buildMatchStories, recordedMatchFlow } from "./match-stories.ts";
import type { MatchStory } from "./match-stories.ts";

export type SeasonAward = {
  id: string;
  title: string;
  subtitle: string;
  winner: string;
  story: string;
  evidence: string;
  matchIds: string[];
};
type PlayerByline = { surname: string; nickname: string; givenName: string };
export type RankingStory = {
  title: string;
  byline: PlayerByline | null;
  verse: string;
  body: string;
};
const betaBylines: Record<string, PlayerByline> = {
  余俊洁: { surname: "Yu", nickname: "Augety", givenName: "Junjie" },
  雷可洋: { surname: "Lei", nickname: "Cyanide", givenName: "Keyang" },
  胡竹霖: { surname: "Hu", nickname: "Kenny", givenName: "Zhulin" },
};
export type BetaReport = {
  article: NewsArticle;
  top3: PlayerStats[];
  rankingStories: RankingStory[];
  awards: SeasonAward[];
  highlights: MatchStory[];
  finished: number;
  detailed: number;
};

// Goal array order is the recorded scoring sequence; summary-only games have no lead history.
export function leadHistory(
  match: Match,
): { home: number; away: number } | null {
  return recordedMatchFlow(match)?.leads ?? null;
}

export function betaReport(source: League): BetaReport | null {
  const league = leagueForSeason(source, "beta");
  const data = analyzeLeague(league);
  if (!data.finished.length) return null;
  const name = (id: string) =>
    league.players.find((p) => p.id === id)?.name || "已归档球员";
  const pairName = (ids: string[]) => ids.map(name).join("、");
  const order = (role: Role) => (a: PlayerStats, b: PlayerStats) =>
    b.rankPoints[role] - a.rankPoints[role] ||
    b.ratedGames[role] - a.ratedGames[role] ||
    a.player.id.localeCompare(b.player.id);
  const top3 = data.players
    .filter((p) => p.ratedGames.overall > 0)
    .sort(order("overall"))
    .slice(0, 3);
  const rankingStories = top3.map((p, index): RankingStory => {
    const verse = ["一剑霜寒十四州", "千磨万击还坚劲", "长风破浪会有时"][index];
    const byline = betaBylines[p.player.name] ?? null;
    const displayName = byline
      ? `${byline.surname} "${byline.nickname}" ${byline.givenName}`
      : p.player.name;
    const title = `TOP ${index + 1} ${displayName} ${verse}`;
    const handle = byline?.nickname || p.player.name;
    const detailedGames = p.history.flatMap((h) => {
      const flow = recordedMatchFlow(h.match);
      if (!flow) return [];
      const side: "home" | "away" = h.match.homePlayers.includes(p.player.id)
        ? "home"
        : "away";
      return [
        {
          ...h,
          flow,
          side,
          deficit: side === "home" ? flow.leads.away : flow.leads.home,
          goals: h.match.goals.filter(
            (g) => !g.ownGoal && g.playerId === p.player.id,
          ).length,
        },
      ];
    });
    let body: string;
    if (index === 0) {
      const close = p.history.filter((h) => Math.abs(h.gf - h.ga) <= 2);
      const closeWins = close.filter((h) => h.result === "W").length;
      const peakGoals = Math.max(
        0,
        ...detailedGames.filter((h) => h.result === "W").map((h) => h.goals),
      );
      const peakWins = detailedGames.filter(
        (h) => h.result === "W" && h.goals === peakGoals,
      );
      body = [
        `${handle} 留给 beta赛季的，是很鲜明的锋芒。${p.forward.games ? `站在前锋位置时，他是这一季一个极有分量的名字，${p.forward.games} 次出场拿下 ${p.forward.wins} 场胜利，让锋线成了他最醒目的赛场名片。` : `他在 ${p.overall.games} 场出场里拿到 ${p.overall.wins} 场胜利，把自己的名字写到了榜首。`}${peakGoals >= 4 ? `他也有亲手接过得分任务的时候：${peakWins.length} 场胜利里单场打进 ${peakGoals} 球${peakWins.every((h) => h.goals === h.gf) ? "，包办本方全部得分" : ""}，足够让人记住他成为比赛主角时的样子。` : ""}“一剑霜寒十四州”，写的是这份在球桌上留下过实绩的锋芒。`,
        close.length
          ? `锋芒之外，他在胶着比赛里的表现同样令人印象深刻。分差不超过 2 球的 ${close.length} 场比赛，他带走了 ${closeWins} 场胜利。${closeWins / close.length >= 0.75 ? `大比分赢球能展示火力，比分接近时依然频繁取胜，则让 ${handle} 的强势多了一层分量。两边只差一两球，胜场却一次次落在他这一边；这份把接近的比赛收进胜场的能力，也是他这个赛季最值得记住的地方。` : "这些接近的比分，也记录了他在榜首之路上经历的较量。每一次赢下来，都是这份赛季成绩里具体的一笔。"}`
          : `回看他的整个赛季，一场场胜利把个人表现与榜首的位置连在了一起。强势的场次留下高光，已经完成的比赛则让这份赛季印象有了落点。`,
        `${p.rankPoints.overall} 分、${rankTier(p.rankPoints.overall).name}段位，为 ${handle} 的这一季落了款。他留在终榜上的形象，是一个进攻表现鲜明、又能在近比分较量里不断赢下比赛的领跑者。赛季故事里有过许多不同的搭档和比分，他的名字始终属于最值得关注的那一行。`,
      ]
        .filter(Boolean)
        .join("\n\n");
    } else if (index === 1) {
      const absent = data.finished.length - p.overall.games;
      const half = Math.floor(p.history.length / 2);
      const early = p.history.slice(0, half);
      const late = p.history.slice(half);
      const earlyWins = early.filter((h) => h.result === "W").length;
      const lateWins = late.filter((h) => h.result === "W").length;
      const partnerCount = data.pairs.filter((pair) =>
        pair.ids.includes(p.player.id),
      ).length;
      const defenderLeader = data.players
        .filter((p) => p.ratedGames.defender > 0)
        .sort(order("defender"))[0];
      body = [
        `在这一季的球桌边，${handle} 是一个反复出现、让人越来越熟悉的身影。全季 ${data.finished.length} 场完赛，他打了 ${p.overall.games} 场，许多人的搭档回忆和交手记录里都有他。${absent > 0 && absent <= 3 ? `反倒是他没出现的那 ${absent} 场，成了出勤表上的少见留白。` : ""}这份长时间的参与，让他的赛季带着一种很扎实的勤勉：换一场球、换一位搭档，故事里经常仍有这个名字。`,
        `${p.forward.games && p.defender.games ? `他也把这一季打出了不同站位的厚度。${p.forward.games === p.defender.games ? `前锋和后卫各 ${p.forward.games} 次出场，像一张排得整整齐齐的值班表，` : "前锋与后卫两个位置都留下了他的出场记录，"}` : ""}${p.defender.games ? `后场尤其是他留下个人印记的地方。${defenderLeader?.player.id === p.player.id ? `本季后卫榜第一的位置，最终由 ${handle} 以 ${p.rankPoints.defender} 分坐定。` : `他的后卫段位分最终来到 ${p.rankPoints.defender}。`}频繁出现之外，这份后场成绩让人看见了他在比赛里的分量。` : `不同的比赛经历，也一点点累积成了他的赛季表现。`}${early.length >= 4 && lateWins / late.length > earlyWins / early.length ? "按个人出场顺序看，他在后半程又比前半程赢得更勤，越打越有收获。" : ""}`,
        `${partnerCount >= 3 ? `他先后与 ${partnerCount} 位选手搭档，把自己的赛季和不少人的故事连在了一起。` : ""}回顾 ${handle}，勤勉、参与感和后场担当，是这一季最清楚的几个词。那些反复上场、切换站位、和不同队友并肩的比赛，最终汇成 ${p.rankPoints.overall} 分的 TOP 2。“千磨万击还坚劲”，也就有了这样一位在长长赛程里始终留下身影的注脚。`,
      ]
        .filter(Boolean)
        .join("\n\n");
    } else {
      const last = detailedGames.find(
        (h) => h.match.id === p.history.at(-1)?.match.id,
      );
      const previous = p.history.at(-2);
      const comebacks = detailedGames.filter(
        (h) => h.result === "W" && h.deficit >= 2,
      );
      const longestRun = detailedGames
        .filter((h) => h.result === "W" && h !== last)
        .flatMap((h) =>
          h.flow.runs
            .filter(
              (run) =>
                run.teamId ===
                  (h.side === "home" ? h.match.homeId : h.match.awayId) &&
                run.length >= 4,
            )
            .map((run) => ({ ...h, run })),
        )
        .sort((a, b) => b.run.length - a.run.length)[0];
      let closing: string;
      if (last?.result === "W" && last.deficit >= 2) {
        const low = last.flow.points.find((point) =>
          last.side === "home"
            ? point.away - point.home === last.deficit
            : point.home - point.away === last.deficit,
        )!;
        closing = `收官战把他的这一面留得格外鲜明。${previous?.result === "L" ? `上一场还是 ${previous.gf}:${previous.ga} 的失利，` : ""}最后一次出场又一度落到 ${last.side === "home" ? `${low.home}:${low.away}` : `${low.away}:${low.home}`}，${handle} 和${pairName(last.partners)}却把 ${last.deficit} 球的落后追成了 ${last.gf}:${last.ga} 的胜利。前一场的失利和这一场的逆转挨在一起，正好写出了他的赛季气质：有过低谷，也能在不利的比分里重新留下高光。`;
      } else {
        closing = `在那些已经完成的比赛里，他既经历过失利，也留下了属于自己的胜场。${p.overall.longestStreak >= 3 ? `那段 ${p.overall.longestStreak} 连胜，也是这份赛季回忆里值得回看的片段。` : ""}高光与波折放在一起，才是完整的 ${handle}。`;
      }
      const lowRun = longestRun?.flow.points[longestRun.run.start];
      const highRun = longestRun?.flow.points[longestRun.run.end];
      const runGoals =
        longestRun?.match.goals
          .slice(longestRun.run.start, longestRun.run.end)
          .filter((g) => !g.ownGoal && g.playerId === p.player.id).length ?? 0;
      body = [
        `${handle} 的 beta赛季，带着明显的起伏，也留下了一份很有记忆点的韧劲。胜负在他的赛季里交错，打得不顺的场次和突然亮起来的表现，都属于同一个人。${comebacks.length ? `他有 ${comebacks.length} 场比赛曾落后至少 2 球，最后仍把胜利拿了回来。这样的比赛，让“还没结束”成了描述他这一季时很贴切的一句话。` : `回看他的比赛，需要把高光与波折一起放进故事里，才能看见这一季的全貌。`}`,
        closing,
        `${longestRun && lowRun && highRun && runGoals >= 3 ? `他也有火力突然集中的一面：另一场从 ${longestRun.side === "home" ? `${lowRun.home}:${lowRun.away}` : `${lowRun.away}:${lowRun.home}`} 连拿 ${longestRun.run.length} 分的比赛里，他一个人打进了其中 ${runGoals} 球，把得分表现直接写进了那段转折。` : ""}${p.rankPoints.overall} 分的 TOP 3，留住了 ${handle} 这样一幅赛季画像：经历起伏，在落后时赢回过比赛，也有过自己成为进攻主角的时刻。“长风破浪会有时”，写给的正是这些已经在 beta赛季发生过的突破。`,
      ].join("\n\n");
    }
    return { title, byline, verse, body };
  });
  const awards: SeasonAward[] = [];
  const own = league.players
    .map((p) => {
      const matches = data.finished.filter(
        (m) =>
          !m.summary &&
          (m.homePlayers.includes(p.id) || m.awayPlayers.includes(p.id)),
      );
      const ownGoals = matches.reduce(
        (sum, m) =>
          sum + m.goals.filter((g) => g.ownGoal && g.playerId === p.id).length,
        0,
      );
      return {
        ...p,
        matches,
        ownGoals,
        average: matches.length ? ownGoals / matches.length : 0,
      };
    })
    .filter((p) => p.matches.length >= 3 && p.ownGoals > 0)
    .sort(
      (a, b) =>
        b.average - a.average ||
        b.ownGoals - a.ownGoals ||
        a.id.localeCompare(b.id),
    )[0];
  if (own)
    awards.push({
      id: "own-goal",
      title: "金乌龙奖",
      subtitle: "球门另一边的主角",
      winner: own.name,
      story: `${own.name}在 ${own.matches.length} 场比赛里留下 ${own.ownGoals} 次乌龙，场均 ${own.average.toFixed(2)} 次，拿下本季金乌龙奖。这 ${own.ownGoals} 粒球分布在 ${own.matches.filter((m) => m.goals.some((g) => g.ownGoal && g.playerId === own.id)).length} 场比赛中，让他在这张特殊的榜单上格外醒目。进球的动作完成了，庆祝的机会却交到了对手手里；别人忙着攻破对面的球门，他偶尔也给自己的半场制造一点意外。这座奖杯留作 beta赛季的独家纪念，新赛季的小目标很明确：保留脚感，把球送往正确的方向。`,
      evidence: `按场均乌龙排序 · ${own.ownGoals} 次 / ${own.matches.length} 场 = ${own.average.toFixed(2)} 次/场 · 至少 3 场逐球完赛`,
      matchIds: own.matches.map((m) => m.id),
    });
  const pair = data.pairs
    .filter((p) => p.games >= 3)
    .sort(
      (a, b) =>
        (b.winRate ?? 0) - (a.winRate ?? 0) ||
        b.games - a.games ||
        b.gd - a.gd ||
        a.ids.join().localeCompare(b.ids.join()),
    )[0];
  if (pair)
    awards.push({
      id: "partnership",
      title: "金牌搭档奖",
      subtitle: "这次站在同一边",
      winner: pairName(pair.ids),
      story: `${pairName(pair.ids)}交出 ${pair.wins} 胜 ${pair.draws} 平 ${pair.losses} 负的合作答卷。${pair.games} 次并肩，${Math.round((pair.winRate ?? 0) * 100)}% 的胜率，让这对组合成为本季金牌搭档。他们合作时打进 ${pair.gf} 球、失 ${pair.ga} 球，合计净胜 ${pair.gd} 球；场均 ${pair.avgFor!.toFixed(2)} 球的进攻产出与 ${pair.avgAgainst!.toFixed(2)} 球的失球数，把这份默契写成了具体的比分。个人榜上各有追求，站到同一边时又能一起兑现胜利。beta赛季已经收官，这对搭档下一季还能否延续胜率，也会是球桌边值得关注的悬念。`,
      evidence: `合作至少 3 场 · 按胜率、场次、净胜球排序`,
      matchIds: data.finished
        .filter((m) =>
          [m.homePlayers, m.awayPlayers].some(
            (ids) =>
              ids.length === 2 && pair.ids.every((id) => ids.includes(id)),
          ),
        )
        .map((m) => m.id),
    });
  for (const [role, title, subtitle] of [
    ["forward", "最佳前锋", "锋线的答案"],
    ["defender", "最佳后卫", "后场的定海针"],
  ] as const) {
    const p = data.players
      .filter((p) => p.ratedGames[role] >= 3)
      .sort(order(role))[0];
    if (p)
      awards.push({
        id: role,
        title,
        subtitle,
        winner: p.player.name,
        story: `${p.player.name}以 ${p.rankPoints[role]} ${role === "forward" ? "前锋" : "后卫"}段位分领跑，摘下 beta赛季最佳${role === "forward" ? "前锋" : "后卫"}。他在这个位置出场 ${p[role].games} 次，取得 ${p[role].wins} 胜 ${p[role].draws} 平 ${p[role].losses} 负，胜率 ${((p[role].winRate ?? 0) * 100).toFixed(1)}%；这些比赛合计进 ${p[role].gf} 球、失 ${p[role].ga} 球，净胜 ${p[role].gd} 球。${role === "forward" ? `他出任前锋时，场均进球达到 ${p[role].avgFor!.toFixed(2)}，为锋线这座奖杯留下了直观的比分注脚。球桌前半场的位置交到他手里，赛季终榜也给出了相应的回报。` : `他出任后卫时，场均失球为 ${p[role].avgAgainst!.toFixed(2)}。后场的价值往往藏在一场场胜负里，而这一季的后卫段位榜把这些积累汇成了第一名。`}总榜有总榜的较量，位置榜也有自己的冠军；这份荣誉属于他在这个位置打下的整个赛季。`,
        evidence: `至少 3 场有效位置样本 · 按对应位置段位分排序`,
        matchIds: p.history
          .filter((h) => h.role === role && h.roleRankPoints !== undefined)
          .map((h) => h.match.id),
      });
  }
  const rivals = data.players
    .flatMap((p) =>
      league.players
        .filter((o) => o.id !== p.player.id)
        .map((opponent) => {
          const matches = p.history.filter((h) =>
            h.opponents.includes(opponent.id),
          );
          return {
            player: p.player,
            opponent,
            matches,
            losses: matches.filter((h) => h.result === "L").length,
            wins: matches.filter((h) => h.result === "W").length,
          };
        }),
    )
    .filter((r) => r.matches.length >= 3 && r.losses > 0)
    .sort(
      (a, b) =>
        b.losses - a.losses ||
        b.matches.length - a.matches.length ||
        a.player.id.localeCompare(b.player.id) ||
        a.opponent.id.localeCompare(b.opponent.id),
    );
  const rival = rivals[0];
  if (rival)
    awards.push({
      id: "rival",
      title: "头号宿敌",
      subtitle: "下赛季一定赢回来",
      winner: `${rival.player.name} → ${rival.opponent.name}`,
      story: `${rival.player.name}与${rival.opponent.name}在 beta赛季隔桌相遇 ${rival.matches.length} 次，其中 ${rival.losses} 次失利、${rival.wins} 次取胜${rival.matches.length > rival.losses + rival.wins ? `、${rival.matches.length - rival.losses - rival.wins} 次战平` : ""}。交手次数让这段对决足够熟悉，胜负账本又让它始终留着一点不甘心。${rival.wins > 0 ? `${rival.wins} 场胜利证明局面并非没有转机，` : ""}${rival.losses} 场失利则把“下次一定”攒成了本季最厚的一笔挑战。beta赛季的头号宿敌奖先把这份恩怨记下：新赛季积分可以重新开始，看到对方站在球桌另一侧时，想赢回来的那一场仍然值得期待。`,
      evidence: `至少 3 次交手 · 按负场数、交手场次排序`,
      matchIds: rival.matches.map((h) => h.match.id),
    });
  const funny = data.pairs
    .filter((p) => p.games >= 3)
    .map((p) => {
      const matches = data.finished.filter(
        (m) =>
          !m.summary &&
          [m.homePlayers, m.awayPlayers].some(
            (ids) => ids.length === 2 && p.ids.every((id) => ids.includes(id)),
          ),
      );
      return {
        pair: p,
        matches,
        ownGoals: matches.reduce(
          (sum, m) =>
            sum +
            m.goals.filter((g) => g.ownGoal && p.ids.includes(g.playerId))
              .length,
          0,
        ),
      };
    })
    .filter((p) => p.ownGoals > 0)
    .sort(
      (a, b) =>
        b.ownGoals - a.ownGoals ||
        b.pair.games - a.pair.games ||
        a.pair.ids.join().localeCompare(b.pair.ids.join()),
    )[0];
  if (funny)
    awards.push({
      id: "funny",
      title: "快乐搭档奖",
      subtitle: "最搞笑组合",
      winner: pairName(funny.pair.ids),
      story: `${pairName(funny.pair.ids)}合作期间留下了 ${funny.ownGoals} 次乌龙球，拿下 beta赛季快乐搭档奖。${funny.pair.games} 场合作的最终成绩是 ${funny.pair.wins} 胜 ${funny.pair.draws} 平 ${funny.pair.losses} 负，但属于这对组合的赛季记忆显然不止胜负：本来准备一起进攻，偶尔却一起给对面添上了惊喜。金牌搭档负责把配合变成胜场，他们则把配合踢出了另一种戏剧效果。这座奖杯留给这份特殊的共同经历，下一季继续搭档时，先把送给对手的礼物收一收。`,
      evidence: `合作至少 3 场 · 共同出场时两人的乌龙总数最高`,
      matchIds: funny.matches
        .filter((m) =>
          m.goals.some((g) => g.ownGoal && funny.pair.ids.includes(g.playerId)),
        )
        .map((m) => m.id),
    });
  const detailed = data.finished.filter((m) => leadHistory(m) !== null);
  const resilience = data.players.map((p) => {
    const appearances = p.history.filter((h) =>
      detailed.some((m) => m.id === h.match.id),
    );
    const won = appearances.filter((h) => {
      const leads = leadHistory(h.match)!;
      const opponentLead = h.match.homePlayers.includes(p.player.id)
        ? leads.away
        : leads.home;
      return h.result === "W" && opponentLead >= 2;
    });
    const led = appearances.filter((h) => {
      const leads = leadHistory(h.match)!;
      return (
        (h.match.homePlayers.includes(p.player.id) ? leads.home : leads.away) >=
        2
      );
    });
    return {
      p,
      won,
      led,
      lost: led.filter((h) => h.result === "L"),
      detailedGames: appearances.length,
    };
  });
  const resilient = resilience
    .filter((r) => r.detailedGames >= 3 && r.won.length)
    .sort(
      (a, b) =>
        b.won.length - a.won.length ||
        a.p.player.id.localeCompare(b.p.player.id),
    )[0];
  if (resilient)
    awards.push({
      id: "resilience",
      title: "韧性之星",
      subtitle: "落后也不认输",
      winner: resilient.p.player.name,
      story: `${resilient.p.player.name}在 beta赛季有 ${resilient.won.length} 场比赛曾落后至少 2 球，最终仍然赢下比赛，拿走本季韧性之星。${resilient.p.overall.wins} 场赛季胜利中，有 ${resilient.won.length} 场走过了这样的逆转路线：先面对差距，再一点点把比分追平、翻过来。这份成绩让“还没结束”有了具体的场次支撑。顺风时赢球和落后时翻盘，留下的是两种不同的赛季记忆；他把后者攒成了一座奖杯，也给下一季的对手留下一句提醒：比分领先，还得把最后一球打完。`,
      evidence: `仅逐球完赛记录 · 曾落后至少 2 球后获胜 · 至少 3 场逐球样本`,
      matchIds: resilient.won.map((h) => h.match.id),
    });
  const overturned = resilience
    .filter((r) => r.detailedGames >= 3 && r.led.length >= 2 && r.lost.length)
    .sort(
      (a, b) =>
        b.lost.length - a.lost.length ||
        b.lost.length / b.led.length - a.lost.length / a.led.length ||
        a.p.player.id.localeCompare(b.p.player.id),
    )[0];
  if (overturned)
    awards.push({
      id: "overturned",
      title: "领先体验卡",
      subtitle: "最容易被翻盘",
      winner: overturned.p.player.name,
      story: `${overturned.p.player.name}有 ${overturned.led.length} 场比赛曾领先至少 2 球，其中 ${overturned.lost.length} 场最终被对手逆转。${((overturned.lost.length / overturned.led.length) * 100).toFixed(1)}% 的这类领先没能换来最后的胜利，让本季“领先体验卡”落到了他的名下。比分拉开时的主动来过，结局翻转时的遗憾也来过；这 ${overturned.lost.length} 场比赛把“稳住”变成了新赛季一个很具体的课题。能建立优势已经是比赛的一半，接下来要争取的是把优势留到终场。beta赛季先收下一张体验卡，第一赛季再争取升级成长期会员。`,
      evidence: `仅逐球完赛记录 · 按被逆转次数、被逆转比例排序`,
      matchIds: overturned.lost.map((h) => h.match.id),
    });
  const mostGames = Math.max(0, ...data.players.map((p) => p.overall.games));
  const attendance = data.players
    .filter((p) => p.overall.games === mostGames && mostGames > 0)
    .sort((a, b) => a.player.id.localeCompare(b.player.id));
  if (attendance.length)
    awards.push({
      id: "attendance",
      title: "劳模奖",
      subtitle: "球桌边最常见的身影",
      winner: attendance.map((p) => p.player.name).join("、"),
      story: `${attendance.map((p) => `${p.player.name}在 beta赛季出场 ${p.overall.games} 次，覆盖全季 ${((p.overall.games / data.finished.length) * 100).toFixed(1)}% 的完赛，留下 ${p.overall.wins} 胜 ${p.overall.draws} 平 ${p.overall.losses} 负的成绩。他在前锋位置出场 ${p.forward.games} 次、后卫位置出场 ${p.defender.games} 次。`).join("")}劳模奖奖励的是这份持续参与：榜单上的每个数字都需要一场场比赛积累，而${attendance.length > 1 ? "这些" : "这位"}球桌边的常客，也和更多人的赛季故事交织在了一起。`,
      evidence: `按完赛出场数评选 · ${mostGames} 场 · 相同场次并列获奖`,
      matchIds: [
        ...new Set(attendance.flatMap((p) => p.history.map((h) => h.match.id))),
      ],
    });
  const highlights = buildMatchStories(league);
  const flows = detailed.map((m) => recordedMatchFlow(m)!);
  const maximumDeficit = Math.max(
    0,
    ...flows.map((flow) => flow.winnerDeficit),
  );
  const comebacks = flows.filter(
    (flow) => maximumDeficit > 0 && flow.winnerDeficit === maximumDeficit,
  );
  if (comebacks.length)
    awards.push({
      id: "comeback",
      title: "年度逆转",
      subtitle: "最大的落后，最难忘的胜利",
      winner: [
        ...new Set(
          comebacks.map((flow) =>
            pairName(
              flow.winner === "home"
                ? flow.match.homePlayers
                : flow.match.awayPlayers,
            ),
          ),
        ),
      ].join(" / "),
      story: `${comebacks
        .map((flow) => {
          const home = flow.winner === "home";
          const final = flow.points.at(-1)!;
          return `${pairName(home ? flow.match.homePlayers : flow.match.awayPlayers)}曾落后 ${maximumDeficit} 球，最终却以 ${home ? `${final.home}:${final.away}` : `${final.away}:${final.home}`} 赢下比赛。`;
        })
        .join(
          "",
        )}这${comebacks.length === 1 ? "一场" : ` ${comebacks.length} 场`}比赛拿下 beta赛季年度逆转：它把本季最深的比分劣势，变成了胜方最值得回看的一次翻盘。比分越是悬殊，后面的每一次追分就越有分量；这次反败为胜，也为赛季收官留下了一个足够鲜明的单场注脚。`,
      evidence: `逐球完赛中的最大落后分差 · 落后 ${maximumDeficit} 球后获胜 · 同分差并列获奖`,
      matchIds: comebacks.map((flow) => flow.match.id),
    });
  const totalGoals = data.finished.reduce((sum, m) => {
    const [h, a] = score(m);
    return sum + h + a;
  }, 0);
  const activePlayers = new Set(
    data.finished.flatMap((m) => [...m.homePlayers, ...m.awayPlayers]),
  ).size;
  const closeGames = data.finished.filter((m) => {
    const [home, away] = score(m);
    return Math.abs(home - away) <= 2;
  }).length;
  const article: NewsArticle = {
    id: "beta-final",
    title: "beta赛季收官：冠军落定，故事留在球桌上",
    season: "beta",
    publishedAt: "2026-11-02T00:00:00+08:00",
    summary: `${data.finished.length} 场比赛、${totalGoals} 粒进球。${top3[0]?.player.name || "赛季榜首"}领跑定榜，金牌搭档、乌龙与逆转的赛季故事一同揭晓。`,
    body: [
      `随着赛果归档，G超联赛 beta赛季正式收官。${activePlayers} 位球员在 ${data.finished.length} 场比赛里留下 ${totalGoals} 粒进球，场均 ${(totalGoals / data.finished.length).toFixed(2)} 球；其中 ${closeGames} 场最终分差不超过 2 球，胜负就在几次攻防之间。这一季，榜首的争夺、固定搭档的配合、换位之后的表现，以及乌龙和逆转带来的意外，都成了这张球桌上的第一份赛季记忆。终榜的数字已经落定，下面这份收官报道，把领奖台和比分背后的故事一起留下。`,
      `本赛季 TOP 3：${top3.map((p, i) => `TOP ${i + 1} ${p.player.name}，${p.rankPoints.overall} 分，${p.overall.wins} 胜 ${p.overall.draws} 平 ${p.overall.losses} 负`).join("；")}。`,
      ...rankingStories.map((story) => `${story.title}\n${story.body}`),
      ...awards.map(
        (award) => `${award.title}｜${award.winner}\n${award.story}`,
      ),
      ...highlights.map(
        (highlight) =>
          `单场高光｜${highlight.title}\n${highlight.home} ${highlight.homeScore}:${highlight.awayScore} ${highlight.away}\n${highlight.paragraphs.join("\n\n")}`,
      ),
      `11 月 2 日起，第一赛季开场。公开段位分以 1200 为底，超出部分继承 33%；总分、前锋分和后卫分分别继承。beta赛季的战绩、终榜和这份获奖名单会留在历史赛季，新的胜负从这一季重新累计。冠军有要守住的位置，追赶者有要缩小的差距，宿敌与搭档也都还有下一场。上一季的故事写到这里，第一赛季的第一粒进球，等待大家继续。`,
    ].join("\n\n"),
  };
  return {
    article,
    top3,
    rankingStories,
    awards,
    highlights,
    finished: data.finished.length,
    detailed: detailed.length,
  };
}
