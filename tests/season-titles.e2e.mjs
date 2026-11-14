import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { seasonOneTitles } from "../lib/season-one-titles.ts";

const base = process.env.E2E_BASE_URL;
assert.ok(base && ["127.0.0.1", "localhost"].includes(new URL(base).hostname), "Set E2E_BASE_URL to a local snapshot preview");
const read = async () => (await (await fetch(new URL("api/league", base))).json()).data;
const before = await read();
const titles = new Map(seasonOneTitles.map(p => [p.name, p.title]));
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", error => errors.push(error.message));
const nav = name => page.locator(".sidebar").getByRole("button", { name, exact: true });
const artifacts = ".migration/browser-checks";
await mkdir(artifacts, { recursive: true });
async function checkPeople(season) {
  const rows = await page.locator(".data-person").evaluateAll(nodes => nodes.map(el => ({
    name: el.querySelector("b").textContent,
    title: el.querySelector("small").textContent.split(" · ").at(-1),
  })));
  assert.ok(rows.length > 0);
  for (const row of rows)
    assert.equal(row.title, season === "s1" ? titles.get(row.name) ?? "全能型" : "全能型", `${season}: ${row.name}`);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
}
try {
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${base}#doubles`);
    await nav("联赛总览").click();
    await page.getByRole("heading", { name: "个人段位榜", exact: true }).waitFor();
    for (const season of ["s1", "beta", "s1"]) {
      await page.getByRole("combobox", { name: "赛季", exact: true }).selectOption(season);
      await nav("赛场数据").click();
      for (const name of ["球员表现", "射手与防守", "位置对照", "赛场荣誉"]) {
        await page.getByRole("tab", { name, exact: true }).click();
        await checkPeople(season);
        if (name === "射手与防守") {
          await page.getByRole("button", { name: "防守榜", exact: true }).click();
          await checkPeople(season);
        }
      }
      await page.getByRole("tab", { name: "球员表现", exact: true }).click();
      await page.screenshot({ path: `${artifacts}/season-titles-${season}-${width}.png` });
      await page.locator(".ranking-table .data-name-button").filter({ hasText: "雷可洋" }).click();
      const heading = await page.locator(".data-profile-header").innerText();
      assert.ok(heading.includes(season === "s1" ? "三榜球王" : "全能型"));
      if (season === "beta") assert.ok(!heading.includes("三榜球王"));
      await page.getByRole("button", { name: "返回球员档案", exact: true }).click();
      await checkPeople(season);
    }
    console.log(`${width}px: Beta defaults, S1 titles, all data views, profiles and repeated season switching passed`);
  }
  const after = await read();
  assert.deepEqual(after.players, before.players);
  assert.deepEqual(after.matches, before.matches);
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
