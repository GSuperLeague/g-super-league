import type { Player } from "./league.ts";
import { seasonOneTitles } from "./season-one-titles.ts";
import type { SeasonId } from "./seasons.ts";

// A missing edition is neutral; titles never carry over between seasons.
const seasonPositions: Partial<Record<SeasonId, Readonly<Record<string, string>>>> = {
  s1: Object.fromEntries(seasonOneTitles.map(p => [p.playerId, p.title])),
};

export const playerPositionOptions = [
  "前锋", "后卫", "守门员", "全能型",
  ...seasonOneTitles.map(p => p.title),
];

export function playerPosition(player: Pick<Player, "id" | "position">, season?: SeasonId): string {
  // Profile editing uses the stored position; seasonal views use sealed titles.
  return season ? seasonPositions[season]?.[player.id] ?? "全能型" : player.position;
}
