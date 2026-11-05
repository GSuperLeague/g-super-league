import { BADMINTON_FIRST_WIN_POLICY } from "./badminton.ts";
import { FIRST_WIN_POLICY } from "./seasons.ts";
import { DAILY_PARTICIPATION_POINTS } from "./daily-rewards.ts";
import type { NewsArticle } from "./news.ts";

const effectiveDate = (time: string) =>
  new Date(time).toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

const footballPoints = FIRST_WIN_POLICY.points;
const badmintonPoints = BADMINTON_FIRST_WIN_POLICY.points;
const participationPoints = DAILY_PARTICIPATION_POINTS;
export const footballFirstWinArticle: NewsArticle = {
  id: "gsl-s1-daily-position-first-win",
  title: "桌足每日奖励公告",
  summary: `每日有效参与 +${participationPoints}；取得任一位置首胜后只保留首胜奖励。前锋、后卫首胜各 +${footballPoints}，每天最多 +${footballPoints * 2}。`,
  body: [
    `第一赛季每日奖励从北京时间${effectiveDate(FIRST_WIN_POLICY.startsAt)}起补算；beta赛季封存分数保持原样。`,
    `每日参与：完成有效双打比赛、但当天没有任何位置首胜，总段位分额外 +${participationPoints}，每人每天一次；参与分只计入总段位，不计入前锋或后卫位置段位。`,
    `前锋首胜：球员当天首次以前锋身份取得胜利，总段位分额外 +${footballPoints}，前锋位置段位分也 +${footballPoints}。后卫首胜：当天首次以后卫身份取得胜利，总段位分额外 +${footballPoints}，后卫位置段位分也 +${footballPoints}。`,
    `参与分与首胜奖励互斥：当天取得前锋或后卫任一首胜，参与 +${participationPoints} 自动取消，只保留首胜奖励。两个位置首胜分别领取，当天总奖励最高 +${footballPoints * 2}。正常比赛结算和传统球队积分照常计算。`,
    "每日资格按北京时间00:00刷新，已获得的分数累计保留。只计算已确认完赛、阵容和前后位置完整的有效双打对局；常驻球队和临时组队都可参与。输球或平局可以领取参与分，未完赛或位置记录不完整不领取每日奖励。",
    `例如：先输一场暂得参与 +${participationPoints}，之后拿到首胜，当天奖励改为首胜 +${footballPoints}，不会叠加成 +${participationPoints + footballPoints}；若两个位置都拿到首胜，当天奖励为 +${footballPoints * 2}。`,
    "按实际比赛发生时间及既有结算顺序认定。补录、改分、重开或删除比赛后，参与和首胜自动互换并回算；切换筛选不会多领。每日奖励不参与基础胜负结算，可在球员逐场记录和单场结算查看明细。",
  ].join("\n\n"),
  season: "s1",
  publishedAt: "2026-11-05T00:00:00+08:00",
};

export const badmintonFirstWinArticle: NewsArticle = {
  id: "gb-daily-mode-first-win",
  title: "羽毛球每日奖励公告",
  summary: `每日参与 +${participationPoints} 或首胜 +${badmintonPoints}，二者互斥；单打、双打每天分别计算。`,
  body: [
    "GB羽毛球每日奖励从首场有效比赛开始补算，覆盖全部历史有效完赛；后续补录更早的比赛，也会自动重新认定。",
    `当日在本项目完成有效比赛但没有获胜，领取参与 +${participationPoints}；当日第一次获胜则领取首胜 +${badmintonPoints}。同一项目同一天只领取一种奖励，不叠加成 +${participationPoints + badmintonPoints}。双打队友分别按各自的资格判断。`,
    `单打、双打每天分别计算，并加到各自段位分。例如单打首胜 +${badmintonPoints}、双打参与 +${participationPoints} 可以同时获得，因为属于两个独立项目。`,
    `先输后赢时，之前的参与 +${participationPoints} 会回算取消，当天仅保留首胜 +${badmintonPoints}；以前场次的每日奖励明细也会同步更新。`,
    "每天北京时间00:00刷新资格，已获得的分数累计保留。只计算已确认完赛、阵容有效的整场比赛，单局胜利不单独领奖；未完赛不领取每日奖励。补录、改分、重开或删除比赛后自动重新计算。每日奖励不影响基础胜负加减分，逐场记录与单场结算分别显示基础变化、首胜或参与奖励。",
  ].join("\n\n"),
  season: "s1",
  publishedAt: "2026-11-05T00:00:00+08:00",
};

export const firstWinAnnouncements = [
  {
    sport: "football",
    label: "G超 · 桌足联赛",
    effectiveLabel: `${effectiveDate(FIRST_WIN_POLICY.startsAt)}起`,
    article: footballFirstWinArticle,
  },
  {
    sport: "badminton",
    label: "GB · 羽毛球联赛",
    effectiveLabel: "自首场有效比赛起补算",
    article: badmintonFirstWinArticle,
  },
] as const;
