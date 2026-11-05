import { BADMINTON_FIRST_WIN_POLICY } from "./badminton.ts";
import { FIRST_WIN_POLICY } from "./seasons.ts";
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
export const footballFirstWinArticle: NewsArticle = {
  id: "gsl-s1-daily-position-first-win",
  title: "桌足每日位置首胜奖励公告",
  summary: `前锋首胜 +${footballPoints}，后卫首胜 +${footballPoints}；每人每天总段位分最多额外 +${footballPoints * 2}。`,
  body: [
    `第一赛季从北京时间${effectiveDate(FIRST_WIN_POLICY.startsAt)}起计算每日位置首胜奖励，已按有效比赛记录补算；beta赛季封存分数保持原样。`,
    `前锋首胜：球员当天首次以前锋身份取得胜利，总段位分额外 +${footballPoints}，前锋位置段位分也 +${footballPoints}。后卫首胜：当天首次以后卫身份取得胜利，总段位分额外 +${footballPoints}，后卫位置段位分也 +${footballPoints}。`,
    `两个位置分别计算，每个位置每天只领取一次；同一天拿到两个位置的首胜，总段位分合计额外 +${footballPoints * 2}。奖励额外叠加在正常比赛结算之上，传统球队积分照常计算。`,
    "首胜资格每天北京时间00:00刷新，已获得的奖励分数保留。只计算已确认完赛、阵容和前后位置完整的有效双打对局；常驻球队和临时组队都可参与。输球、平局、未完赛或位置记录不完整，都不占用首胜资格。",
    "首胜按实际比赛发生时间及既有结算顺序认定，补录、修改或删除比赛后自动重新计算；录入顺序和页面筛选不会增加领取次数。可在球员档案的每场加减分、单场结算里查看首胜明细。",
    `例如：今天以前锋身份连赢两场，只有第一场额外 +${footballPoints}；之后再以后卫身份赢一场，还可额外 +${footballPoints}。`,
  ].join("\n\n"),
  season: "s1",
  publishedAt: "2026-11-05T00:00:00+08:00",
};

export const badmintonFirstWinArticle: NewsArticle = {
  id: "gb-daily-mode-first-win",
  title: "羽毛球每日首胜奖励公告",
  summary: `单打首胜 +${badmintonPoints}，双打首胜 +${badmintonPoints}；每天各一次，两个项目分别计算。`,
  body: [
    "GB羽毛球每日首胜奖励从首场有效比赛开始补算，覆盖全部历史有效完赛；后续补录更早的比赛，也会按实际比赛时间重新认定首胜。",
    `单打：球员当天第一次赢得单打比赛，单打段位分额外 +${badmintonPoints}。双打：球员当天第一次赢得双打比赛，双打段位分额外 +${badmintonPoints}；同队两位球员分别判断各自的首胜资格。`,
    `单打、双打每天各一次，分别加到各自的段位分。同一天先赢单打、再赢双打，可以在两个项目各领 +${badmintonPoints}；同项目当天再次取胜不重复领取。`,
    "首胜资格每天北京时间00:00刷新，已获得的奖励分数保留；按实际比赛发生时间及既有结算顺序认定。只计算已确认完赛、阵容有效的整场比赛，单局胜利不单独领奖；输球、未完赛不占用资格。补录、修改、重新打开或删除比赛后自动重新计算。",
    "首胜奖励在正常胜负结算之外单独累加，不影响后续正常加减分的计算。球员每场加减分和单场结算会分别显示基础结算与首胜奖励。",
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
