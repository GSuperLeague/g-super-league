import { seasonName } from "./seasons.ts";
import type { SeasonId } from "./seasons.ts";
import type { NewsArticle } from "./news.ts";

export const FOOTBALL_CURRENT_THEME = "弹反赛季";
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
  durationSeconds: number;
  description: string;
  article: NewsArticle;
};

// The second season is a preview, not a new scoring season or date boundary.
export const footballSeasonPromos: SeasonPromo[] = [
  {
    id: "s1",
    label: "第一赛季",
    theme: FOOTBALL_CURRENT_THEME,
    status: "正式进行中",
    durationSeconds: 26,
    description: "对手先出球，我方借来球的力量弹回去。",
    article: {
      id: "gsl-s1-parry-geometry-trailer",
      title: `${FOOTBALL_CURRENT_THEME}正式进行中｜G超第一赛季`,
      summary: `G超第一赛季「${FOOTBALL_CURRENT_THEME}」已于11月2日正式开赛：对手先踢球，我方借来球的力量反弹回去。`,
      body: `G超联赛第一赛季「${FOOTBALL_CURRENT_THEME}」已于2026年11月2日正式开赛，目前正在进行中。\n\n弹反，是对手先踢球后，我方借来球的力量，直接反弹回去，让对手的来球成为你的回击。\n\n赛季短片以“对手射门 → 我方迎球借力 → 弹回反击”展示这个过程。欢迎进入比赛中心，查看本赛季的赛程、战绩与段位变化。`,
      season: "s1",
      publishedAt: "2026-11-05T06:45:05.000Z",
    },
  },
  {
    id: "s2",
    label: "第二赛季预告",
    theme: FOOTBALL_NEXT_THEME,
    status: "敬请期待",
    durationSeconds: 15,
    description: "球杆连续狂转数圈，把球高速射出。这将会很疯狂！！！！！",
    article: {
      id: "gsl-s2-full-throttle-preview",
      title: `第二赛季预告：${FOOTBALL_NEXT_THEME}，一个赛季！`,
      summary: "G超将启用爆冲流一个赛季：球杆连续狂转数圈后高速击球。这将会很疯狂！！！！！",
      body: `第二赛季预告：G超将启用「${FOOTBALL_NEXT_THEME}」一个赛季。\n\n爆冲流，是杆子连续快速旋转好几圈，带动球员高速触球，把球高速射出去。\n\n这将会很疯狂！！！！！\n\n15秒预告以多镜头串起一次完整动作：手柄加速、整杆球员连续翻转、触球爆射、快速跟球、球网随冲击晃动，再落到赛季标题。第二赛季的开赛时间与具体赛程另行公布；当前赛事仍为第一赛季「${FOOTBALL_CURRENT_THEME}」。`,
      season: "s1",
      publishedAt: "2026-11-05T06:45:05.000Z",
    },
  },
];
