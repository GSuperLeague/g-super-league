import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildSync } from "esbuild";
import { Miniflare } from "miniflare";
import { emptyBadmintonLeague } from "../lib/badminton.ts";
import { GALLERY_MAX_BYTES, type GalleryPage, type GalleryPhoto } from "../lib/gallery.ts";

let runtime: Miniflare;
let serial = 0;
const key = "local-fixture-admin-key-not-for-production";
before(async () => {
  const output = buildSync({
    entryPoints: ["badminton-api/src/index.ts"],
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
    target: "es2022",
  }).outputFiles[0].text;
  runtime = new Miniflare({
    workers: [
      {
        name: "gb",
        modules: true,
        script: output,
        compatibilityDate: "2026-05-15",
        d1Databases: { DB: "gb-test-db" },
        serviceBindings: { AUTH_SERVICE: "football-auth" },
        bindings: { ALLOWED_ORIGINS: "https://league.example" },
      },
      {
        name: "football-auth",
        modules: true,
        compatibilityDate: "2026-05-15",
        script: `export default { async fetch(request) {
    if(new URL(request.url).pathname==='/api/auth')return Response.json({ok:true},{status:request.headers.get('Authorization')===${JSON.stringify(`Bearer ${key}`)}?200:401});
    return Response.json({data:{players:[{id:'source-a',name:'Source A',nickname:'A',photo:''},{id:'source-b',name:'Source B',nickname:'B',photo:''}]}});
  }};`,
      },
    ],
  });
  const db = await runtime.getD1Database("DB", "gb");
  await db
    .prepare(
      "CREATE TABLE badminton_league(id TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0)",
    )
    .run();
  await db
    .prepare(
      "CREATE TABLE league(id TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0)",
    )
    .run();
  await db
    .prepare("INSERT INTO league VALUES (?,?,?)")
    .bind("main", '{"preserve":"football-data"}', 713)
    .run();
  const gallery = await readFile("badminton-api/migrations/0002_gallery.sql", "utf8");
  await db.batch(gallery.split(";").map((sql) => sql.trim()).filter(Boolean).map((sql) => db.prepare(sql)));
});
beforeEach(async () => {
  const db = await runtime.getD1Database("DB", "gb");
  await db.prepare("DELETE FROM badminton_league").run();
  await db
    .prepare("INSERT INTO badminton_league VALUES (?,?,0)")
    .bind("main", JSON.stringify(emptyBadmintonLeague()))
    .run();
});
after(async () => {
  await runtime?.dispose();
});
const call = (
  path: string,
  init: NonNullable<Parameters<Miniflare["dispatchFetch"]>[1]> = {},
) => runtime.dispatchFetch(`https://league.example/api/badminton${path}`, init);
test("gallery uploads are bounded, idempotent, and separated by league", async () => {
  const db = await runtime.getD1Database("DB", "gb");
  const jpeg = await readFile("tests/fixtures/gallery.jpg");
  const gallery = (path: string, init?: Parameters<Miniflare["dispatchFetch"]>[1]) =>
    runtime.dispatchFetch(`https://league.example/api/gallery/${path}`, init);
  const upload = (league: string, body: Uint8Array = jpeg, origin = "https://league.example") =>
    gallery(league, { method: "POST", headers: { Origin: origin, "Content-Type": "image/jpeg" }, body });
  const snapshot = await db.prepare("SELECT data,revision FROM badminton_league WHERE id='main'").first();
  assert.equal((await upload("football", jpeg, "https://other.example")).status, 403);
  assert.equal((await upload("football", new Uint8Array(GALLERY_MAX_BYTES + 1))).status, 413);
  assert.equal((await upload("football", new TextEncoder().encode("not a jpeg"))).status, 415);

  const uploads = await Promise.all([upload("football"), upload("football")]);
  assert.deepEqual(uploads.map((response) => response.status).sort(), [200, 201]);
  const photo = (await uploads[0].json()) as GalleryPhoto;
  assert.deepEqual(await uploads[1].json(), photo);
  const football = (await (await gallery("football")).json()) as GalleryPage;
  assert.deepEqual(football.photos, [photo]);
  assert.equal((await gallery(`badminton/${photo.id}`)).status, 404);
  assert.equal((await upload("badminton")).status, 201);
  const stored = await gallery(`football/${photo.id}`);
  assert.equal(stored.headers.get("Content-Type"), "image/jpeg");
  assert.deepEqual(Buffer.from(await stored.arrayBuffer()), jpeg);

  assert.equal((await gallery(`football/${photo.id}`, { method: "DELETE" })).status, 401);
  const removed = await gallery(`football/${photo.id}`, {
    method: "DELETE", headers: { Authorization: `Bearer ${key}` },
  });
  assert.equal(removed.status, 204);
  assert.equal((await gallery(`football/${photo.id}`)).status, 404);
  assert.equal((await gallery(`badminton/${photo.id}`)).status, 200);
  assert.deepEqual(await db.prepare("SELECT data,revision FROM badminton_league WHERE id='main'").first(), snapshot);
  assert.equal(await db.prepare("SELECT revision FROM league WHERE id='main'").first("revision"), 713);
});
const post = (
  type: string,
  id: string,
  data: unknown,
  revision: number,
  actionId = `api-test-${++serial}`,
) =>
  call("/league", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type,
      id,
      data,
      expectedRevision: revision,
      actionId,
    }),
  });
test("GB runtime exposes public data and rejects writes without a valid existing-service administrator", async () => {
  assert.equal((await call("/league")).status, 200);
  assert.equal((await call("/league", { method: "POST" })).status, 401);
  assert.equal(
    (
      await call("/auth", {
        method: "POST",
        headers: { Authorization: "Bearer invalid" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call("/auth", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}` },
      })
    ).status,
    200,
  );
});
test("GB CORS permits the league origin and rejects an unrelated website", async () => {
  const good = await call("/league", {
    method: "OPTIONS",
    headers: { Origin: "https://league.example" },
  });
  assert.equal(good.status, 204);
  assert.equal(
    good.headers.get("Access-Control-Allow-Origin"),
    "https://league.example",
  );
  const bad = await call("/league", {
    headers: { Origin: "https://unapproved.example" },
  });
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get("Access-Control-Allow-Origin"), null);
});
test("expected revisions prevent lost updates and a retry returns the committed result", async () => {
  const data = { name: "Test player", nickname: "", bio: "", hand: "unknown" },
    requestId = "retry-player-creation";
  const first = await post("player.save", "a", data, 0, requestId);
  assert.equal(first.status, 200);
  assert.equal(((await first.json()) as { revision: number }).revision, 1);
  const retry = await post("player.save", "a", data, 0, requestId);
  assert.equal(retry.status, 200);
  const stale = await post(
    "player.save",
    "b",
    { ...data, name: "Other player" },
    0,
  );
  assert.equal(stale.status, 409);
  const current = (await (await call("/league")).json()) as {
    data: { players: unknown[] };
    revision: number;
  };
  assert.equal(current.revision, 1);
  assert.equal(current.data.players.length, 1);
});
test("import reads identity from the bound authority and refuses client-supplied forged roster objects", async () => {
  const forged = await post(
    "player.import",
    "import",
    { players: [{ id: "forged", name: "Forged" }] },
    0,
  );
  assert.equal(forged.status, 400);
  const absent = await post(
    "player.import",
    "import",
    { ids: ["not-in-source"] },
    0,
  );
  assert.equal(absent.status, 400);
  const good = await post(
    "player.import",
    "import",
    { ids: ["source-a", "source-b"] },
    0,
  );
  assert.equal(good.status, 200);
  const body = (await good.json()) as {
    data: { players: { id: string; name: string }[]; matches: unknown[] };
  };
  assert.deepEqual(
    body.data.players.map((p) => p.name),
    ["Source A", "Source B"],
  );
  assert.equal(body.data.matches.length, 0);
});
test("oversized request bodies are bounded before JSON processing", async () => {
  const response = await post(
    "player.save",
    "a",
    { name: "a".repeat(34000) },
    0,
  );
  assert.equal(response.status, 400);
});
test("GB runtime persists a 16:14 deuce result and rejects 11:10 and a score beyond the first two-point lead", async () => {
  let revision = 0;
  for (const id of ["a", "b", "c", "d"]) {
    const response = await post("player.save", id, {
      name: `Deuce ${id}`, nickname: "", bio: "", hand: "unknown",
    }, revision++);
    assert.equal(response.status, 200);
  }
  const details = {
    mode: "doubles", time: "2026-11-04T19:00:00+08:00", round: "Deuce test",
    homePlayers: ["a", "b"], awayPlayers: ["c", "d"],
    format: { pointsToWin: 11, bestOf: 1, winBy: 2 },
  };
  for (const game of [{ home: 11, away: 10 }, { home: 16, away: 13 }]) {
    const bad = await post("match.result", "m", { ...details, games: [game] }, revision);
    assert.equal(bad.status, 400);
  }
  const good = await post("match.result", "m", {
    ...details, games: [{ home: 16, away: 14 }],
  }, revision);
  assert.equal(good.status, 200);
  const current = (await (await call("/league")).json()) as {
    data: { matches: { status: string; format: { winBy: number }; games: { home: number; away: number }[] }[] };
    revision: number;
  };
  assert.equal(current.revision, revision + 1);
  assert.equal(current.data.matches.length, 1);
  assert.equal(current.data.matches[0].status, "finished");
  assert.equal(current.data.matches[0].format.winBy, 2);
  assert.deepEqual(current.data.matches[0].games, [{ home: 16, away: 14 }]);
});
test("real D1 writes modify only badminton storage and leave table-football records and revision intact", async () => {
  await post(
    "player.save",
    "a",
    { name: "API player", nickname: "", bio: "", hand: "right" },
    0,
  );
  const db = await runtime.getD1Database("DB", "gb");
  assert.deepEqual(
    await db
      .prepare("SELECT data,revision FROM league WHERE id='main'")
      .first(),
    { data: '{"preserve":"football-data"}', revision: 713 },
  );
  assert.equal(
    (await db
      .prepare("SELECT revision FROM badminton_league WHERE id='main'")
      .first<{ revision: number }>())!.revision,
    1,
  );
});
