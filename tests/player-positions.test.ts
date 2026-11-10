import assert from "node:assert/strict";
import test from "node:test";
import { playerPosition, playerPositionOptions } from "../lib/player-positions.ts";

test("approved positions replace legacy defaults without changing player data", () => {
  const player = {
    id: "0662b9de-b5d8-40c1-b478-59adc30e5e9c",
    position: "全能型",
  };
  assert.equal(playerPosition(player), "全场核心");
  assert.equal(player.position, "全能型");
  assert.ok(playerPositionOptions.includes(playerPosition(player)));
});

test("explicit profile positions remain editable and take precedence", () => {
  const player = {
    id: "0662b9de-b5d8-40c1-b478-59adc30e5e9c",
    position: "后卫",
  };
  assert.equal(playerPosition(player), "后卫");
  assert.equal(playerPosition({ ...player, position: "关键先生" }), "关键先生");
  assert.equal(playerPosition({ ...player, position: "自定义称号" }), "自定义称号");
});

test("unlisted players keep their own position without inheriting a title", () => {
  assert.equal(playerPosition({ id: "new-player", position: "全能型" }), "全能型");
  assert.equal(playerPosition({ id: "new-player", position: "前锋" }), "前锋");
});
