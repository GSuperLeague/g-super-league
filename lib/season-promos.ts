import { SEASON_TWO_START, seasonName } from "./seasons.ts";
import type { SeasonId } from "./seasons.ts";
import type { NewsArticle } from "./news.ts";

export const FOOTBALL_FIRST_THEME = "弹反赛季";
export const FOOTBALL_SECOND_THEME = "爆冲流";
export const FOOTBALL_SPIN_TRIAL_PERIOD = "11 月 16 日至 18 日";

export function footballSeasonLabel(season: SeasonId) {
  if (season === "s1") return `${seasonName(season)} · ${FOOTBALL_FIRST_THEME}`;
  if (season === "s2") return `${seasonName(season)} · ${FOOTBALL_SECOND_THEME}`;
  return seasonName(season);
}

type SeasonPromo = {
  id: "s1" | "s2";
  label: string;
  theme: string;
  status: string;
  durationSeconds: number;
  description: string;
  article: NewsArticle;
};

export const footballSeasonPromos: SeasonPromo[] = [
  {
    id: "s1",
    label: "第一赛季",
    theme: FOOTBALL_FIRST_THEME,
    status: "已定榜收官",
    durationSeconds: 26,
    description: "对手先出球，我方借来球的力量弹回去。",
    article: {
      id: "gsl-s1-parry-geometry-trailer",
      title: `${FOOTBALL_FIRST_THEME}｜G超第一赛季`,
      summary: "第一赛季已收官。赛季短片展示如何借对手的来球反击。",
      body: "G超联赛第一赛季「弹反赛季」于 2026 年 11 月 2 日开赛。\n\n赛季短片展示了迎球借力、弹回反击的过程。可切换至第一赛季回看赛程、战绩与段位变化。",
      season: "s1",
      publishedAt: "2026-11-05T06:45:05.000Z",
    },
  },
  {
    id: "s2",
    label: "第二赛季",
    theme: FOOTBALL_SECOND_THEME,
    status: "正式进行中",
    durationSeconds: 15,
    description: "球杆连续快速旋转数圈后高速击球。赛季开幕试行三天。",
    article: {
      id: "gsl-s2-full-throttle-preview",
      title: "第二赛季正式开赛｜爆冲流试行三天",
      summary: `第二赛季于 11 月 16 日开赛，北京时间 ${FOOTBALL_SPIN_TRIAL_PERIOD}允许爆冲。`,
      body: `G超桌足第二赛季于 2026 年 11 月 16 日开赛。北京时间 ${FOOTBALL_SPIN_TRIAL_PERIOD}的比赛允许爆冲，11 月 19 日 00:00 起恢复常规规则。\n\n赛季起始分为 1200 加上第一赛季段位分超过 1200 部分的 33%，加分四舍五入。双打总分、前锋分、后卫分分别继承，单打按自己的终榜继承。\n\n下面的赛季短片展示一次完整的爆冲射门。`,
      season: "s2",
      publishedAt: SEASON_TWO_START,
    },
  },
];
