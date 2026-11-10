import type { Player } from "./league.ts";

// Approved from the beta and first-season snapshot exported on 2026-11-10.
const seasonPositions: Readonly<Record<string, string>> = {
  "0662b9de-b5d8-40c1-b478-59adc30e5e9c": "全场核心",
  "2334bf4a-0ae4-4eeb-b6f0-82c23ee8ec22": "后场中枢",
  "02c0b1bc-865e-4199-b86b-5369f24c6405": "关键先生",
  "7e1a9aeb-798a-48e9-8856-85ff1eae236a": "锋卫自由人",
  "402ac18c-a909-4233-9824-43f1d3cf01ed": "进攻铁卫",
  "3202d20b-081c-411e-9b18-114fa454a876": "缠斗前锋",
  "74442fe4-b8e0-44e5-b14e-ad19293fca14": "轮换拼图",
  "aafc9164-9d8d-4795-a11d-ab9dc368a3b8": "锋线新锐",
  "9155991a-86f5-51fb-828a-090804df6b6f": "后程发力者",
  "b444445d-8e78-51e8-ad6d-b5c933dce7be": "专职后卫",
};

export const playerPositionOptions = [
  "前锋", "后卫", "守门员", "全能型",
  ...Object.values(seasonPositions),
];

export function playerPosition(player: Pick<Player, "id" | "position">): string {
  return player.position === "全能型"
    ? seasonPositions[player.id] ?? player.position
    : player.position;
}
