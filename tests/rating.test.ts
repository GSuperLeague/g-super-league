import test from "node:test";
import assert from "node:assert/strict";
import {
  expectedResult,
  marginMultiplier,
  mmrChange,
  nextRankPoints,
  rankPointBase,
  rankTier,
  roundRating,
} from "../lib/rating.ts";

test("margin is relative to the winning score and safe for scoreless draws", () => {
  assert.equal(marginMultiplier(0, 0), 1);
  assert.equal(marginMultiplier(7, 7), 1);
  assert.equal(marginMultiplier(7, 0), 1.5);
  assert.equal(marginMultiplier(0, 10), 1.5);
  assert.equal(marginMultiplier(10, 8), 1.1);
  assert.equal(marginMultiplier(5, 4), 1.1);
});

test("MMR responds faster, rewards upsets and stays zero sum", () => {
  const upset = mmrChange(1000, 1400, 1, 1.5);
  const expectedWin = mmrChange(1400, 1000, 1, 1.5);
  assert.ok(upset > expectedWin);
  assert.ok(Math.abs(upset + mmrChange(1400, 1000, 0, 1.5)) < 1e-10);
  assert.equal(mmrChange(1200, 1200, 1, 1), 32);
  assert.equal(mmrChange(1200, 1200, 1, 1.5), 48);
  assert.equal(mmrChange(1200, 1200, 0.5, 1), 0);
  assert.equal(expectedResult(1200, 1200), 0.5);
  assert.ok(expectedResult(1400, 1000) > 0.9);
});

test("early ranks reward growth and every tier from diamond has balanced base changes", () => {
  const cases = [
    [900, 36, -10, 6],
    [1000, 36, -10, 6],
    [1100, 34, -12, 5],
    [1200, 32, -14, 4],
    [1300, 28, -18, 3],
    [1400, 24, -24, 0],
    [1450, 24, -24, 0],
    [1500, 24, -24, 0],
    [1600, 24, -24, 0],
    [1700, 24, -24, 0],
    [2000, 24, -24, 0],
  ];
  for (const [points, win, loss, draw] of cases) {
    assert.equal(nextRankPoints(points, points, 1, 1, 0.5) - points, win);
    assert.equal(nextRankPoints(points, points, 0, 1, 0.5) - points, loss);
    assert.equal(nextRankPoints(points, points, 0.5, 1, 0.5) - points, draw);
  }
  for (const boundary of [1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700]) {
    const below = rankPointBase(boundary - 0.001);
    const above = rankPointBase(boundary + 0.001);
    for (const key of ["win", "loss", "draw"] as const)
      assert.ok(Math.abs(below[key] - above[key]) < 0.001);
  }
});

test("opponent strength changes rank gains and losses, including draws", () => {
  const change = (result: 0 | 0.5 | 1, expected: number) =>
    nextRankPoints(1400, 1400, result, 1, expected) - 1400;
  assert.ok(change(1, 0.2) > change(1, 0.5));
  assert.ok(change(1, 0.5) > change(1, 0.8));
  assert.ok(change(0, 0.8) < change(0, 0.5));
  assert.ok(change(0, 0.5) < change(0, 0.2));
  assert.ok(change(0.5, 0.2) > 0);
  assert.ok(change(0.5, 0.8) < 0);
});

test("alignment uses pre-match values, caps at eight, and margin scales the whole change", () => {
  assert.equal(nextRankPoints(1200, 1600, 1, 1, 0.5), 1240);
  assert.equal(nextRankPoints(1200, 800, 1, 1, 0.5), 1224);
  assert.equal(nextRankPoints(1200, 1600, 0, 1, 0.5), 1194);
  assert.equal(nextRankPoints(1200, 800, 0, 1, 0.5), 1178);
  assert.equal(nextRankPoints(1200, 1225, 1, 1, 0.5), 1233);
  assert.equal(nextRankPoints(1200, 1175, 1, 1, 0.5), 1231);
  assert.equal(nextRankPoints(1200, 1200, 1, 1.5, 0.5), 1248);
  assert.equal(nextRankPoints(1200, 1200, 0, 1.5, 0.5), 1179);
  assert.equal(roundRating(-22.5), -23);
  assert.equal(roundRating(22.5), 23);
});

test("a win cannot remove points and a loss cannot award them", () => {
  for (const points of [0, 1000, 1200, 1400, 1600, 2000])
    for (const gap of [-1000, 0, 1000])
      for (const expected of [0, 0.01, 0.5, 0.99, 1]) {
        assert.ok(
          nextRankPoints(points, points + gap, 1, 1.5, expected) >= points,
        );
        assert.ok(
          nextRankPoints(points, points + gap, 0, 1.5, expected) <= points,
        );
      }
});

test("farming much weaker opponents cannot keep inflating a leading rank", () => {
  let points = 1800;
  const before = points;
  for (let game = 0; game < 100; game++)
    points = nextRankPoints(points, 1600, game === 99 ? 0 : 1, 1, 0.99);
  assert.ok(points < before);
});

test("balanced results give progression below diamond but do not inflate high ranks", () => {
  function balanced(points: number, mmr: number) {
    for (let pair = 0; pair < 100; pair++) {
      points = nextRankPoints(points, mmr, 1, 1, 0.5);
      points = nextRankPoints(points, mmr, 0, 1, 0.5);
    }
    return points;
  }
  assert.ok(balanced(1200, 1200) > 1250);
  assert.ok(balanced(1400, 1400) <= 1400);
  for (const points of [1400, 1500, 1600, 1700, 2000])
    assert.ok(Math.abs(balanced(points, points) - points) < 20);
});

test("24 games at 50 percent wins typically reach platinum with varied margins and opponents", () => {
  let seed = 20261029;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (const [home, away] of [
    [7, 6],
    [8, 5],
    [10, 0],
  ])
    for (const matched of [true, false]) {
      const endings: number[] = [];
      for (let season = 0; season < 1024; season++) {
        const results = Array.from({ length: 24 }, (_, i) =>
          i < 12 ? 1 : 0,
        ) as (0 | 1)[];
        for (let i = results.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [results[i], results[j]] = [results[j], results[i]];
        }
        let points = 1200;
        let mmr = 1200;
        const multiplier = marginMultiplier(home, away);
        for (const result of results) {
          const opponent = matched ? mmr : 1200;
          points = nextRankPoints(
            points,
            mmr,
            result,
            multiplier,
            expectedResult(mmr, opponent),
          );
          mmr += mmrChange(mmr, opponent, result, multiplier);
        }
        endings.push(points);
      }
      endings.sort((a, b) => a - b);
      const median = endings[Math.floor(endings.length / 2)];
      assert.ok(
        median >= 1290 && median <= 1320,
        `${home}:${away}, matched=${matched}, median=${median}`,
      );
      if (matched) {
        assert.ok(endings[Math.floor(endings.length * 0.1)] >= 1270);
        assert.ok(endings[Math.floor(endings.length * 0.9)] <= 1350);
      }
    }
});

test("MMR follows a sustained winning run while rank points taper at high tiers", () => {
  let mmr = 1200;
  let points = 1200;
  for (let game = 0; game < 25; game++) {
    const expected = expectedResult(mmr, 1200);
    points = nextRankPoints(points, mmr, 1, 1.1, expected);
    mmr += mmrChange(mmr, 1200, 1, 1.1);
  }
  assert.ok(mmr > 1500);
  assert.ok(Math.abs(points - mmr) < 100);
});

test("rank points can enter iron and stop at zero", () => {
  assert.equal(nextRankPoints(1001, 1001, 0, 1, 0.5), 991);
  assert.equal(nextRankPoints(8, 8, 0, 1.5, 0.5), 0);
  assert.equal(nextRankPoints(0, 0, 0, 1, 0.5), 0);
  assert.equal(nextRankPoints(0, 0, 1, 1, 0.5), 36);
});

test("tier boundaries include the initial gold rank and open-ended king", () => {
  const boundaries = [0, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700];
  const names = [
    "黑铁",
    "青铜",
    "白银",
    "黄金",
    "铂金",
    "钻石",
    "大师",
    "宗师",
    "王者",
  ];
  boundaries.forEach((points, i) => {
    assert.equal(rankTier(points).name, names[i]);
    if (i) assert.equal(rankTier(points - 1).name, names[i - 1]);
  });
  assert.equal(rankTier(10000).name, "王者");
});
