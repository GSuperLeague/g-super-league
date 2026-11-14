import assert from "node:assert/strict";
import test from "node:test";
import { playerPosition, playerPositionOptions } from "../lib/player-positions.ts";
import { seasonOneTitles } from "../lib/season-one-titles.ts";

test("final S1 titles are shared by the default player labels and position options", () => {
  for (const player of seasonOneTitles) {
    assert.equal(playerPosition({ id: player.playerId, position: "全能型" }, "s1"), player.title);
    assert.ok(playerPositionOptions.includes(player.title));
    assert.equal(playerPosition({ id: player.playerId, position: "自定义称号" }), "自定义称号");
  }
});

test("season titles are independent of stored profile positions and never leak into Beta", () => {
  const player = {
    id: "0662b9de-b5d8-40c1-b478-59adc30e5e9c",
    position: "全场核心",
  };
  assert.equal(playerPosition(player, "s1"), "全场核心");
  assert.equal(playerPosition(player, "beta"), "全能型");
  assert.equal(playerPosition(player), "全场核心");
  assert.equal(player.position, "全场核心");
  for (const title of seasonOneTitles) {
    const profile = { id: title.playerId, position: "自定义称号" };
    assert.equal(playerPosition(profile, "beta"), "全能型");
    assert.equal(playerPosition(profile, "s1"), title.title);
    assert.equal(playerPosition(profile), "自定义称号");
  }
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
  for (const season of ["s1", "beta"] as const) {
    assert.equal(playerPosition({ id: "new-player", position: "前锋" }, season), "全能型");
    assert.equal(playerPosition({ id: "74442fe4-b8e0-44e5-b14e-ad19293fca14", position: "全能型" }, season), "全能型");
  }
});
