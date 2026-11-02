import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const port = process.env.GSL_LOCAL_FRONT_PORT || "5173";
const prefix = process.env.VC_PREFIX
  ? `${process.env.VC_PREFIX.replace(/\/$/, "")}/proxy/${port}`
  : "";
const base =
  process.env.E2E_BASE_URL ||
  `http://127.0.0.1:${port}${prefix}/g-super-league/`;
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw Error("浏览器测试仅允许连接本地预览");
const api = new URL("api/", base).href;
const token = "preview-only-admin-token-2026";
const headers = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
};
const read = async (mode) => {
  const response = await fetch(
    `${api}${mode === "singles" ? "singles/" : ""}league`,
  );
  assert.equal(response.status, 200);
  return response.json();
};
const write = async (action) => {
  const response = await fetch(`${api}singles/league`, {
    method: "POST",
    headers,
    body: JSON.stringify(action),
  });
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
};
const initial = await read("singles"),
  doublesBefore = await read("doubles");
const initialIds = new Set(initial.data.players.map((p) => p.id));
const matchIds = new Set(),
  playerIds = new Set();
const stamp = Date.now().toString().slice(-6);
const names = [
  `单打测试甲${stamp}`,
  `单打测试乙${stamp}`,
  `长名字测试球员${stamp}`,
];
const artifacts = ".migration/browser-checks";
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
page.setDefaultTimeout(15000);
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("dialog", (dialog) => dialog.accept());
const waitFor = async (check) => {
  for (let i = 0; i < 80; i++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw Error("Timed out waiting for saved data");
};
const capture = async (name) => {
  await page.screenshot({ path: `${artifacts}/${name}.png`, fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth + 1,
  );
  assert.equal(overflow, false, `${name}: page overflows horizontally`);
};
try {
  await page.goto(`${base}#singles`);
  await page
    .getByRole("heading", { name: "单打赛事总览", exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "单打管理员登录", exact: true })
    .click();
  await page.getByLabel("管理密钥", { exact: true }).fill(token);
  await page.getByRole("button", { name: "登录", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  await page
    .getByRole("navigation", { name: "单打导航" })
    .getByRole("link", { name: "球员档案", exact: true })
    .click();
  for (const name of names) {
    await page.getByRole("button", { name: "登记球员", exact: true }).click();
    await page.getByLabel("姓名", { exact: true }).fill(name);
    await page.getByLabel("昵称", { exact: true }).fill("本地测试");
    await page.getByRole("button", { name: "保存球员", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
  }
  const players = (await read("singles")).data.players.filter(
    (p) => !initialIds.has(p.id),
  );
  players.forEach((p) => playerIds.add(p.id));
  assert.equal(players.length, 3);
  const [a, b, c] = names.map((name) => players.find((p) => p.name === name));
  // Upload a bitmap through the form and verify the image really decodes.
  await page.getByRole("button").filter({ hasText: a.name }).first().click();
  await page.getByRole("button", { name: "编辑资料", exact: true }).click();
  const bitmap = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#23637e";
    ctx.fillRect(0, 0, 128, 128);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 60px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("A", 64, 86);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.locator("input[type=file]").setInputFiles({
    name: "avatar.png",
    mimeType: "image/png",
    buffer: Buffer.from(bitmap, "base64"),
  });
  await page.getByAltText("球员头像").waitFor();
  await page.getByRole("button", { name: "保存球员", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.ok(
    (await read("singles")).data.players
      .find((p) => p.id === a.id)
      .photo.startsWith("/api/singles/photos/"),
  );
  await page
    .getByRole("navigation", { name: "单打导航" })
    .getByRole("link", { name: "赛程与比分", exact: true })
    .click();
  await page.getByRole("button", { name: "新建比赛", exact: true }).click();
  await page.getByLabel("球员 A", { exact: true }).selectOption(a.id);
  await page.getByLabel("球员 B", { exact: true }).selectOption(b.id);
  await page.getByRole("button", { name: "直接开赛", exact: true }).click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  const live = (await read("singles")).data.matches.find(
    (m) => m.homeId === a.id && m.awayId === b.id,
  );
  assert.ok(live);
  matchIds.add(live.id);
  await page
    .getByRole("button", { name: `${a.name} 加一分`, exact: true })
    .click();
  await waitFor(
    async () =>
      (await read("singles")).data.matches.find((m) => m.id === live.id).goals
        .length === 1,
  );
  await page.getByLabel("对方乌龙球", { exact: true }).check();
  await page
    .getByRole("button", { name: `${a.name} 加一分`, exact: true })
    .click();
  await waitFor(
    async () =>
      (await read("singles")).data.matches.find((m) => m.id === live.id).goals
        .length === 2,
  );
  assert.equal(
    (await read("singles")).data.matches.find((m) => m.id === live.id).goals[1]
      .playerId,
    b.id,
  );
  await page.getByRole("button", { name: "撤销上一球", exact: true }).click();
  await waitFor(
    async () =>
      (await read("singles")).data.matches.find((m) => m.id === live.id).goals
        .length === 1,
  );
  await page.getByLabel("对方乌龙球", { exact: true }).uncheck();
  await capture("desktop-live");
  await page.getByRole("button", { name: "结束比赛", exact: true }).click();
  await page
    .getByRole("heading", { name: "本场段位分变化", exact: true })
    .waitFor();
  assert.ok(
    (await page.locator(".singles-elo-result").innerText()).includes("1248"),
  );
  await page.getByRole("button", { name: "编辑最终比分", exact: true }).click();
  await page.getByLabel("球员 A 得分", { exact: true }).fill("2");
  await page.getByLabel("球员 B 得分", { exact: true }).fill("5");
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "保存比分并完赛", exact: true })
    .click();
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.ok(
    (await page.locator(".singles-elo-result").innerText()).includes("1182"),
  );
  // Additional results give the comparison and mobile views realistic content.
  for (let i = 0; i < 3; i++) {
    const id = crypto.randomUUID();
    matchIds.add(id);
    await write({
      type: "match.result",
      id,
      data: {
        homeId: i % 2 ? c.id : a.id,
        awayId: b.id,
        time: `2026-10-${20 + i}T10:00:00+08:00`,
        round: `测试第 ${i + 1} 轮`,
        homeScore: 10,
        awayScore: 7 + i,
      },
    });
  }
  await page.goto(`${base}#singles/overview`);
  await page.reload();
  await page
    .getByRole("heading", { name: "单打赛事总览", exact: true })
    .waitFor();
  await capture("desktop-overview");
  const avatars = await page
    .locator(".singles-shell img")
    .evaluateAll((images) =>
      images.every((img) => img.complete && img.naturalWidth > 0),
    );
  assert.equal(avatars, true);
  await page.goto(`${base}#singles/players/${a.id}`);
  await page.getByRole("heading", { name: a.name, exact: true }).waitFor();
  await page.getByLabel("历史交手对手").selectOption(b.id);
  await capture("desktop-player");
  const archivedMatch = (await read("singles")).data.matches.find(
    (m) => matchIds.has(m.id) && m.time.startsWith("2026-10-"),
  );
  await page.goto(`${base}#singles/matches/${archivedMatch.id}`);
  await page.getByRole("heading", { name: "单打比赛", exact: true }).waitFor();
  await waitFor(
    async () =>
      (await page
        .getByRole("combobox", { name: "赛季", exact: true })
        .inputValue()) === "beta",
  );
  await page.locator(".singles-elo-result").waitFor();
  await page.getByRole("link", { name: "双打", exact: true }).click();
  await page.getByRole("heading", { name: "联赛总览", exact: false }).waitFor();
  assert.equal(await page.getByText(a.name, { exact: true }).count(), 0);
  assert.equal(
    await page.getByRole("button", { name: "管理员登录", exact: true }).count(),
    1,
  );
  await page.getByRole("link", { name: "单打", exact: true }).click();
  await page
    .getByRole("heading", { name: "单打赛事总览", exact: true })
    .waitFor();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of [
      "overview",
      "rankings",
      "players",
      `players/${a.id}`,
      `matches/${live.id}`,
      "analytics",
      "news",
      "settings",
    ]) {
      await page.goto(`${base}#singles/${path}`);
      await page.locator(".singles-shell main .page-heading").waitFor();
      await capture(`mobile-${width}-${path.replaceAll("/", "-")}`);
    }
  }
  await page.goto(`${base}#singles/players`);
  await page.getByRole("button", { name: "登记球员", exact: true }).click();
  await capture("mobile-320-player-form");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.goto(`${base}#singles/matches`);
  await page.getByRole("button", { name: "新建比赛", exact: true }).click();
  await capture("mobile-320-match-form");
  await page.getByRole("button", { name: "关闭", exact: true }).click();
  await page.goto(`${base}#singles/settings`);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出单打数据", exact: true }).click();
  const download = await downloadPromise;
  assert.ok(download.suggestedFilename().includes("单打"));
  assert.deepEqual(await read("doubles"), doublesBefore);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: real Worker/D1, player CRUD/avatar, live scoring/own goal/undo, finish/edit/rank points, history, mode isolation, export, desktop/390px/320px layouts",
  );
  console.log(`Screenshots: ${artifacts}`);
} finally {
  await browser.close();
  // Only delete records created by this test; preserve all pre-existing local data.
  const current = (await read("singles")).data;
  for (const p of current.players)
    if (names.includes(p.name) && !initialIds.has(p.id)) playerIds.add(p.id);
  for (const m of current.matches)
    if (playerIds.has(m.homeId) || playerIds.has(m.awayId)) matchIds.add(m.id);
  for (const id of matchIds) await write({ type: "match.delete", id });
  for (const id of playerIds) await write({ type: "player.delete", id });
}
