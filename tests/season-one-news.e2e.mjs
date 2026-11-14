import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { seasonOneReport } from "../lib/season-one-news.ts";

const base = process.env.E2E_BASE_URL;
assert.ok(base && ["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Set E2E_BASE_URL to a local snapshot preview");
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const artifacts = ".migration/browser-checks";
await mkdir(artifacts, { recursive: true });
const readLeague = async () => (await (await fetch(new URL("api/league", base))).json()).data;
const before = await readLeague();
let overrideSaved = false;
const openReport = async () => {
  await page.goto(`${base}#doubles`);
  await page.locator(".sidebar").getByRole("button", { name: "联赛新闻", exact: true }).click();
  await page.getByRole("button").filter({ has: page.getByRole("heading", { name: seasonOneReport.article.title, exact: true }) }).click();
  await page.locator(".news-season-final").waitFor();
};
try {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await openReport();
    assert.equal(await page.locator(".news-profile").count(), 3);
    assert.equal(await page.locator(".news-rookie").count(), 4);
    assert.equal(await page.locator(".news-player-title").count(), seasonOneReport.titleEdition.players.length);
    assert.deepEqual(await page.locator(".news-player-title h3").allTextContents(), seasonOneReport.titleEdition.players.map(p => p.title));
    assert.equal(await page.locator(".news-rookies").evaluate(el => !!(el.compareDocumentPosition(document.querySelector(".news-podium")) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
    assert.equal(await page.locator(".news-titles").evaluate(el => !!(el.compareDocumentPosition(document.querySelector(".news-next-season")) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
    assert.equal(await page.locator(".news-highlights").evaluate(el => !!(el.compareDocumentPosition(document.querySelector(".news-titles")) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
    assert.equal(await page.locator(".news-award").count(), seasonOneReport.awards.length);
    assert.equal(await page.locator(".news-highlight").count(), seasonOneReport.highlights.length);
    assert.equal(await page.locator(".news-record").count(), 4);
    assert.equal(await page.locator(".news-leader-days li").count(), 13);
    assert.deepEqual(await page.locator(".news-leader-totals b").allTextContents(), ["7天", "1天", "1天", "4天"]);
    assert.deepEqual(await page.locator(".news-profile-score strong").allTextContents(), ["1634", "1535", "1507"]);
    assert.equal(await page.locator(".news-final-masthead img").evaluate(el => el.complete && el.naturalWidth > 0), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    for (const profile of await page.locator(".news-profile").all()) {
      assert.equal(await profile.evaluate(el => [...el.querySelectorAll("*")].some(child => child.scrollWidth > child.clientWidth + 1)), false);
      const heading = await profile.locator(".news-profile-heading").boundingBox();
      const facts = await profile.locator(".news-profile-facts").boundingBox();
      const copy = await profile.locator(".news-profile-copy").boundingBox();
      assert.ok(heading.y + heading.height <= facts.y + 1);
      assert.ok(facts.y + facts.height <= copy.y + 1);
    }
    await page.screenshot({ path: `${artifacts}/s1-final-${width}-heading.png` });
    await page.locator(".news-profile").first().screenshot({ path: `${artifacts}/s1-final-${width}-champion.png` });
    await page.locator(".news-rookies").screenshot({ path: `${artifacts}/s1-final-${width}-rookies.png` });
    await page.locator(".news-record-book").screenshot({ path: `${artifacts}/s1-final-${width}-records.png` });
    await page.locator(".news-titles").screenshot({ path: `${artifacts}/s1-final-${width}-titles.png` });
    for (const title of await page.locator(".news-player-title").all())
      assert.equal(await title.evaluate(el => [...el.querySelectorAll("*")].some(child => child.scrollWidth > child.clientWidth + 1)), false);
    assert.equal(await page.locator(".news-record-book").evaluate(el => [...el.querySelectorAll("*")].some(child => child.scrollWidth > child.clientWidth + 1)), false);
    for (const highlight of await page.locator(".news-highlight").all())
      assert.equal(await highlight.evaluate(el => [...el.querySelectorAll("*")].some(child => child.scrollWidth > child.clientWidth + 1)), false);
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await page.locator(".news-profile").first().evaluate(el => getComputedStyle(el, "::before").animationName), "none");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.getByRole("button", { name: "全部新闻", exact: true }).click();
    await page.getByRole("combobox", { name: "新闻赛季" }).selectOption("beta");
    assert.equal(await page.locator(".news-list-item").filter({ hasText: seasonOneReport.article.title }).count(), 0);
    await page.getByRole("combobox", { name: "新闻赛季" }).selectOption("s1");
    await page.getByRole("textbox", { name: "搜索新闻" }).fill("十七连败");
    assert.equal(await page.locator(".news-list-item").count(), 1);
    await page.getByRole("textbox", { name: "搜索新闻" }).fill("");
    await page.getByRole("button").filter({ has: page.getByRole("heading", { name: seasonOneReport.article.title }) }).click();
    await page.getByRole("button", { name: "查看纪录比赛：赛季最低总榜积分", exact: true }).click();
    await page.locator(".news-season-final").waitFor({ state: "detached" });
    console.log(`${width}px: report, standings, rookies, filters, image, motion and match navigation passed`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(() => sessionStorage.setItem("g-super-league:admin-token", "preview-only-admin-token-2026"));
  await page.reload();
  await openReport();
  await page.getByRole("button", { name: "编辑新闻", exact: true }).click();
  assert.equal(await page.locator('textarea[name="body"]').inputValue(), seasonOneReport.article.body);
  await page.locator('textarea[name="body"]').fill(`${seasonOneReport.article.body}\n\n本地编辑验证。`);
  await page.getByRole("button", { name: "保存发布", exact: true }).click();
  await page.locator(".news-body").waitFor();
  overrideSaved = true;
  assert.ok((await page.locator(".news-body").innerText()).includes("本地编辑验证。"));
  await openReportWithoutStructure();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "恢复默认定榜稿", exact: true }).click();
  await page.getByRole("heading", { name: "联赛新闻", exact: true }).waitFor();
  overrideSaved = false;
  await openReport();
  assert.equal(await page.locator(".news-profile").count(), 3);
  assert.deepEqual((await readLeague()).matches, before.matches);
  assert.deepEqual((await readLeague()).players, before.players);
  console.log("Final report edit, persistence and restoration passed; match data unchanged");
  assert.deepEqual(errors, []);
} finally {
  if (overrideSaved) {
    const original = before.news?.find(article => article.id === seasonOneReport.article.id);
    await fetch(new URL("api/league", base), {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer preview-only-admin-token-2026" },
      body: JSON.stringify(original ? { type: "news.save", id: original.id, data: original } : { type: "news.delete", id: seasonOneReport.article.id }),
    });
  }
  await browser.close();
}

async function openReportWithoutStructure() {
  await page.reload();
  await page.locator(".sidebar").getByRole("button", { name: "联赛新闻", exact: true }).click();
  await page.getByRole("button").filter({ has: page.getByRole("heading", { name: seasonOneReport.article.title, exact: true }) }).click();
  await page.locator(".news-body").waitFor();
}
