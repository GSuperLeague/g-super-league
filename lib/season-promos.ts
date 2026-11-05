import { seasonName } from "./seasons.ts";
import type { SeasonId } from "./seasons.ts";
import type { NewsArticle } from "./news.ts";

export const FOOTBALL_CURRENT_THEME = "弹反几何";
export const FOOTBALL_NEXT_THEME = "爆冲流";

export function footballSeasonLabel(season: SeasonId) {
  return season === "s1"
    ? `${seasonName(season)} · ${FOOTBALL_CURRENT_THEME}`
    : seasonName(season);
}

type SeasonPromo = {
  id: "s1" | "s2";
  label: string;
  theme: string;
  status: string;
  description: string;
  article: NewsArticle;
};

// The second season is a preview, not a new scoring season or date boundary.
export const footballSeasonPromos: SeasonPromo[] = [
  {
    id: "s1",
    label: "第一赛季",
    theme: FOOTBALL_CURRENT_THEME,
    status: "正在进行",
    description: "对手先出球，我方借来球的力量弹回去。",
    article: {
      id: "gsl-s1-parry-geometry-trailer",
      title: `第一赛季：${FOOTBALL_CURRENT_THEME}｜赛季预告片`,
      summary: `G超第一赛季主题「${FOOTBALL_CURRENT_THEME}」：对手先踢球，我方借来球的力量反弹回去。`,
      body: `G超联赛第一赛季，主题是「${FOOTBALL_CURRENT_THEME}」。\n\n弹反，是对手先踢球后，我方借来球的力量，直接反弹回去。几何，是迎球的角度：让对手的来球，成为你的回击。\n\n预告片以“对手射门 → 我方迎球借力 → 弹回反击”展示这个过程。第一赛季正在进行。`,
      season: "s1",
      publishedAt: "2026-11-05T06:45:05.000Z",
    },
  },
  {
    id: "s2",
    label: "第二赛季预告",
    theme: FOOTBALL_NEXT_THEME,
    status: "敬请期待",
    description: "G超将启用爆冲流一个赛季。这将会很疯狂！！！！！",
    article: {
      id: "gsl-s2-full-throttle-preview",
      title: `第二赛季预告：${FOOTBALL_NEXT_THEME}，一个赛季！`,
      summary: "G超将启用爆冲流一个赛季。这将会很疯狂！！！！！",
      body: `第二赛季预告：G超将启用「${FOOTBALL_NEXT_THEME}」一个赛季。\n\n这将会很疯狂！！！！！\n\n先看预告片，准备迎接更快的节奏。第二赛季的开赛时间与具体赛程另行公布；当前赛事仍为第一赛季「${FOOTBALL_CURRENT_THEME}」。`,
      season: "s1",
      publishedAt: "2026-11-05T06:45:05.000Z",
    },
  },
];
