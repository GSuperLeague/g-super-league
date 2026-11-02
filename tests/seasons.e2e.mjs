import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { analyzeLeague, leagueForSeason } from "../lib/analytics.ts";
import { betaReport } from "../lib/season-news.ts";

const port = process.env.GSL_LOCAL_FRONT_PORT || "5173";
const prefix = process.env.VC_PREFIX
  ? `${process.env.VC_PREFIX.replace(/\/$/, "")}/proxy/${port}`
  : "";
const base =
  process.env.E2E_BASE_URL ||
  `http://127.0.0.1:${port}${prefix}/g-super-league/`;
assert.ok(["localhost", "127.0.0.1"].includes(new URL(base).hostname));
const api = new URL("api/league", base);
const read = async () => {
  const response = await fetch(api);
  assert.equal(response.status, 200);
  return (await response.json()).data;
};
const before = await read();
const report = betaReport(before);
assert.ok(report, "Use a snapshot containing Beta matches");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
const nav = (name) =>
  page.locator(".sidebar").getByRole("button", { name, exact: true });
const artifacts = ".migration/browser-checks";
await mkdir(artifacts, { recursive: true });
async function capture(name) {
  assert.doesNotMatch(await page.locator("body").innerText(), /MMR|Elo|隐藏分/);
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
    false,
    `${name}: horizontal overflow`,
  );
  await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true });
}
let createdId;
try {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}#doubles`);
    await page.reload();
    await page
      .getByRole("heading", { name: "个人段位榜", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("combobox", { name: "赛季", exact: true })
        .inputValue(),
      "s1",
    );
    await capture(`seasons-${width}-start`);
    await nav("赛场数据").click();
    for (const [role, label] of [
      ["overall", "总览"],
      ["forward", "前锋"],
      ["defender", "后卫"],
    ]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      const expected = analyzeLeague(
        leagueForSeason(before, "s1"),
      ).players.sort(
        (a, b) =>
          b.rankPoints[role] - a.rankPoints[role] ||
          b[role].games - a[role].games ||
          a.player.id.localeCompare(b.player.id),
      );
      const rows = page.locator(".ranking-table tbody tr");
      assert.equal(await rows.count(), expected.length);
      for (let i = 0; i < expected.length; i++) {
        assert.ok(
          (await rows.nth(i).innerText()).includes(expected[i].player.name),
        );
        assert.equal(
          await rows.nth(i).locator(".rank-score-value").innerText(),
          String(expected[i].rankPoints[role]),
        );
        assert.match(
          await rows.nth(i).locator("td").nth(4).innerText(),
          new RegExp(
            `${expected[i][role].wins} / ${expected[i][role].draws} / ${expected[i][role].losses}`,
          ),
        );
      }
    }
    await capture(`seasons-${width}-inherited`);
    const player = analyzeLeague(leagueForSeason(before, "s1")).players[0];
    await page
      .locator(".ranking-table .data-name-button")
      .filter({ hasText: player.player.name })
      .click();
    for (const [role, label] of [
      ["overall", "总览"],
      ["forward", "前锋"],
      ["defender", "后卫"],
    ]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      const start = leagueForSeason(before, "s1").ratingSeeds[player.player.id][
        role
      ].rankPoints;
      const games = player.history.filter((h) =>
        role === "overall"
          ? h.rankPoints !== undefined
          : h.role === role && h.roleRankPoints !== undefined,
      ).length;
      await page
        .getByRole("img", {
          name: `段位分从 ${start} 变化至 ${player.rankPoints[role]}，共 ${games} 场`,
          exact: true,
        })
        .waitFor();
    }
    await capture(`seasons-${width}-profile`);
    await page
      .getByRole("combobox", { name: "赛季", exact: true })
      .selectOption("beta");
    await nav("联赛新闻").click();
    await capture(`news-${width}-index`);
    await page
      .getByRole("button")
      .filter({
        has: page.getByRole("heading", {
          name: report.article.title,
          exact: true,
        }),
      })
      .click();
    assert.equal(
      await page.locator(".news-profile").count(),
      report.top3.length,
    );
    assert.equal(
      await page.locator(".news-podium-grid, .news-podium .rank-score").count(),
      0,
    );
    for (const [i, story] of report.rankingStories.entries()) {
      const profile = page.locator(".news-profile").nth(i);
      assert.equal(
        await profile.locator(".news-profile-rank").innerText(),
        `TOP ${i + 1}`,
      );
      const byline = story.byline;
      assert.equal(
        await profile.locator("h3").innerText(),
        byline
          ? `${byline.surname} "${byline.nickname}" ${byline.givenName}`
          : report.top3[i].player.name,
      );
      assert.equal(
        await profile.locator(".news-profile-verse b").innerText(),
        story.verse,
      );
      assert.equal([...story.verse].length, 7);
      assert.deepEqual(
        await profile.locator(".news-paragraph").allTextContents(),
        story.body.split("\n\n"),
      );
      assert.doesNotMatch(
        story.body,
        /冠军|亚军|季军|铜牌|第一赛季|下[一赛]季/,
      );
    }
    await page
      .locator(".news-podium")
      .screenshot({ path: `${artifacts}/news-${width}-top3.png` });
    const profile = page.locator(".news-profile").first();
    assert.equal(
      await profile.evaluate(
        (el) => getComputedStyle(el, "::before").animationName,
      ),
      "news-profile-sheen",
    );
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(
      await profile.evaluate(
        (el) => getComputedStyle(el, "::before").animationName,
      ),
      "none",
    );
    assert.equal(
      await profile.evaluate(
        (el) => getComputedStyle(el, "::after").animationName,
      ),
      "none",
    );
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const own = report.awards.find((a) => a.id === "own-goal");
    if (own) {
      const section = page
        .locator(".news-award")
        .filter({ hasText: "金乌龙奖" });
      assert.ok((await section.innerText()).includes(own.winner));
      assert.ok((await section.innerText()).includes(own.evidence));
    }
    for (const id of ["attendance", "comeback"]) {
      const award = report.awards.find((a) => a.id === id);
      assert.ok(award, `${id} award should exist in the latest snapshot`);
      const section = page
        .locator(".news-award")
        .filter({ hasText: award.title });
      assert.ok((await section.innerText()).includes(award.winner));
      assert.ok((await section.innerText()).includes(award.evidence));
    }
    assert.equal(report.highlights.length, 5);
    assert.equal(
      await page.locator(".news-highlight").count(),
      report.highlights.length,
    );
    for (const highlight of report.highlights) {
      const section = page.locator(`[data-highlight="${highlight.id}"]`);
      assert.equal(await section.locator("h3").innerText(), highlight.title);
      assert.equal(
        await section.locator(".news-highlight-match b").innerText(),
        `${highlight.homeScore}:${highlight.awayScore}`,
      );
      assert.deepEqual(
        await section.locator(".news-score-moments b").allTextContents(),
        highlight.moments.map((m) => m.score),
      );
      assert.deepEqual(
        await section.locator(".news-paragraph").allTextContents(),
        highlight.paragraphs,
      );
    }
    assert.doesNotMatch(
      await page.locator(".news-reader").innerText(),
      /Beta|beta(?!赛季)/,
    );
    await capture(`news-${width}-report`);
    await page
      .locator(".news-highlight")
      .first()
      .screenshot({ path: `${artifacts}/news-${width}-highlight.png` });
    await page.locator(".news-highlight .text-btn").first().click();
    await page
      .getByRole("heading", { name: "本场段位分变化", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("combobox", { name: "赛季", exact: true })
        .inputValue(),
      "beta",
    );
    const first = before.matches.find(
      (m) => m.id === report.highlights[0].matchId,
    );
    assert.ok((await page.locator("main").innerText()).includes(first.round));
    await nav("联赛新闻").click();
    await page
      .getByRole("button")
      .filter({
        has: page.getByRole("heading", {
          name: report.article.title,
          exact: true,
        }),
      })
      .click();
    await page.locator(".news-evidence-matches summary").first().click();
    await page.locator(".news-evidence-matches .text-btn").first().click();
    await page
      .getByRole("heading", { name: "本场段位分变化", exact: true })
      .waitFor();
    assert.equal(
      await page
        .getByRole("combobox", { name: "赛季", exact: true })
        .inputValue(),
      "beta",
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() =>
    sessionStorage.setItem(
      "g-super-league:admin-token",
      "preview-only-admin-token-2026",
    ),
  );
  await page.reload();
  await nav("联赛新闻").click();
  await page.getByRole("button", { name: "发布新闻", exact: true }).click();
  const title = `新闻发布测试 ${Date.now()}`;
  await page.getByLabel("标题", { exact: true }).fill(title);
  await page.getByLabel("摘要", { exact: true }).fill("本地预览中的赛季新闻");
  await page
    .getByLabel("正文", { exact: true })
    .fill("第一段正文。\n\n第二段正文。<script>不会执行</script>");
  await page.getByRole("button", { name: "保存发布", exact: true }).click();
  await page.getByRole("heading", { name: title, exact: true }).waitFor();
  createdId = (await read()).news.find((a) => a.title === title).id;
  assert.equal(await page.locator(".news-body p").count(), 2);
  assert.equal(await page.locator(".news-body script").count(), 0);
  await page.getByRole("button", { name: "编辑新闻", exact: true }).click();
  await page.getByLabel("标题", { exact: true }).fill(`${title} 已编辑`);
  await page.getByRole("button", { name: "保存发布", exact: true }).click();
  await page
    .getByRole("heading", { name: `${title} 已编辑`, exact: true })
    .waitFor();
  await page.reload();
  await nav("联赛新闻").click();
  await page
    .getByRole("textbox", { name: "搜索新闻", exact: true })
    .fill(title);
  await page
    .getByRole("combobox", { name: "新闻赛季", exact: true })
    .selectOption("beta");
  assert.equal(await page.locator(".news-list-item").count(), 0);
  await page
    .getByRole("combobox", { name: "新闻赛季", exact: true })
    .selectOption("s1");
  await page.locator(".news-list-item").click();
  await page
    .getByRole("heading", { name: `${title} 已编辑`, exact: true })
    .waitFor();
  await capture("news-editor-saved");
  await nav("联赛设置").click();
  await page
    .getByRole("combobox", { name: "赛季", exact: true })
    .selectOption("s1");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出数据快照", exact: true }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(
    await readFile(await download.path(), "utf8"),
  ).league;
  assert.deepEqual(exported.matches, before.matches);
  assert.ok(exported.news.some((a) => a.id === createdId));
  assert.equal("ratingSeeds" in exported, false);
  await nav("联赛新闻").click();
  await page
    .getByRole("textbox", { name: "搜索新闻", exact: true })
    .fill(title);
  await page.locator(".news-list-item").click();
  await page.getByRole("button", { name: "删除新闻", exact: true }).click();
  await page.getByRole("heading", { name: "联赛新闻", exact: true }).waitFor();
  assert.ok(!(await read()).news.some((a) => a.id === createdId));
  assert.deepEqual((await read()).matches, before.matches);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: season inheritance and role rankings, Beta archive, award evidence and match links, news create/edit/persist/filter/delete, hidden MMR, desktop/390px/320px layouts",
  );
} finally {
  if (createdId)
    await fetch(api, {
      method: "POST",
      headers: {
        Authorization: "Bearer preview-only-admin-token-2026",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ type: "news.delete", id: createdId }),
    });
  await browser.close();
}
