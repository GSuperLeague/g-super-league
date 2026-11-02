import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import {
  analyzeLeague,
  leagueForSeason,
  matchRatings,
} from "../lib/analytics.ts";
import { rankTier } from "../lib/rating.ts";

const port = process.env.GSL_LOCAL_FRONT_PORT || "5173";
const prefix = process.env.VC_PREFIX
  ? `${process.env.VC_PREFIX.replace(/\/$/, "")}/proxy/${port}`
  : "";
const base =
  process.env.E2E_BASE_URL ||
  `http://127.0.0.1:${port}${prefix}/g-super-league/`;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const response = await fetch(new URL("api/league", base));
assert.equal(response.status, 200);
const { data: rawLeague } = await response.json();
const league = leagueForSeason(rawLeague, "beta");
const data = analyzeLeague(league);
assert.ok(
  data.ratedMatches > 0,
  "Use a local snapshot containing completed doubles matches",
);
const artifacts = ".migration/browser-checks";
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
const nav = (name) =>
  page.locator(".sidebar").getByRole("button", { name, exact: true });

async function capture(name) {
  assert.doesNotMatch(await page.locator("body").innerText(), /MMR|Elo|隐藏分/);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
    `${name}: horizontal overflow`,
  );
  const badges = await page
    .locator(".rank-score:visible")
    .evaluateAll((scores) =>
      scores.map((score) => {
        const badge = score
          .querySelector(".tier-emblem")
          .getBoundingClientRect();
        const value = score
          .querySelector(".rank-score-value")
          .getBoundingClientRect();
        return {
          width: badge.width,
          height: badge.height,
          separated: badge.right <= value.left + 1,
        };
      }),
    );
  assert.ok(badges.length > 0, `${name}: no rank badges`);
  assert.ok(
    badges.every(
      (badge) => badge.width > 0 && badge.height > 0 && badge.separated,
    ),
    `${name}: missing or overlapping badge`,
  );
  const matchFits = await page
    .locator(".match-elo-table")
    .evaluateAll((tables) =>
      tables.every((table) => {
        if (table.scrollWidth > table.parentElement.clientWidth + 1)
          return false;
        return [...table.querySelectorAll(".rank-score")].every((score) => {
          const bounds = score.getBoundingClientRect();
          const cell = score.closest("td").getBoundingClientRect();
          return bounds.left >= cell.left && bounds.right <= cell.right;
        });
      }),
    );
  assert.ok(matchFits, `${name}: match scores overflow their columns`);
  await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true });
}

try {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}#doubles`);
    await page.reload();
    await page
      .getByRole("combobox", { name: "赛季", exact: true })
      .selectOption("beta");
    await page
      .getByRole("heading", { name: "个人段位榜", exact: true })
      .waitFor();
    await capture(`ranks-${width}-overview`);
    await nav("球员档案").click();
    await capture(`ranks-${width}-directory`);
    const directoryFits = await page
      .locator(".directory-metrics .rank-score")
      .evaluateAll((scores) =>
        scores.every((score) => {
          const bounds = score.getBoundingClientRect();
          const cell = score.closest("strong").getBoundingClientRect();
          return bounds.right <= cell.right + 1;
        }),
      );
    assert.ok(directoryFits, `${width}: directory score overflows its column`);
    await nav("赛场数据").click();
    for (const [role, label] of [
      ["overall", "总览"],
      ["forward", "前锋"],
      ["defender", "后卫"],
    ]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      const rows = page.locator(".ranking-table tbody tr");
      const expected = data.players
        .filter((p) => p[role].games >= 1)
        .sort(
          (a, b) =>
            b.rankPoints[role] - a.rankPoints[role] ||
            b[role].games - a[role].games ||
            a.player.id.localeCompare(b.player.id),
        );
      assert.equal(await rows.count(), expected.length);
      for (let i = 0; i < expected.length; i++) {
        const row = rows.nth(i),
          points = expected[i].rankPoints[role];
        assert.ok((await row.innerText()).includes(expected[i].player.name));
        assert.equal(
          await row.locator(".rank-score-value").innerText(),
          String(points),
        );
        assert.ok(
          (
            await row.locator(".rank-score").getAttribute("aria-label")
          ).startsWith(rankTier(points).name),
        );
      }
      if (role === "overall") await capture(`ranks-${width}-standings`);
    }
    await page.getByRole("button", { name: "总览", exact: true }).click();
    await page.locator(".ranking-table .data-name-button").first().click();
    await page
      .getByRole("heading", { name: "段位分轨迹", exact: true })
      .waitFor();
    await capture(`ranks-${width}-profile`);
    await page.getByRole("button", { name: "前锋", exact: true }).click();
    await capture(`ranks-${width}-role-profile`);
    await nav("赛程与比分").click();
    await page.locator(".match-card").first().click();
    await page
      .getByRole("heading", { name: "本场段位分变化", exact: true })
      .waitFor();
    await capture(`ranks-${width}-match`);
    const shown = await page
      .locator(".match-elo-table tbody .rank-score-value")
      .allTextContents();
    assert.equal(shown.length, 8);
    assert.ok(
      data.finished.some((match) => {
        const ratings = matchRatings(league, match).players;
        return ratings.every(
          (p, i) =>
            shown[i * 2] === String(p.overall.before) &&
            shown[i * 2 + 1] === String(p.overall.after),
        );
      }),
    );
    await page.getByRole("button", { name: "位置段位分", exact: true }).click();
    await capture(`ranks-${width}-position-match`);
    await nav("赛场数据").click();
    await page.getByRole("tab", { name: "位置对照", exact: true }).click();
    assert.doesNotMatch(
      await page.locator("body").innerText(),
      /MMR|Elo|隐藏分/,
    );
    await page.getByRole("tab", { name: "赛场荣誉", exact: true }).click();
    await capture(`ranks-${width}-honors`);
    await page.getByText("统计口径与评分", { exact: true }).click();
    assert.equal(await page.locator(".rank-legend > div").count(), 9);
    await capture(`ranks-${width}-tiers`);
  }
  assert.deepEqual(errors, []);
  console.log(
    "PASS: public scores/tier icons, overall/role standings, single-match replay, hidden MMR, desktop/390px/320px layouts",
  );
} finally {
  await browser.close();
}
