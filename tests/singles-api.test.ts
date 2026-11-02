import test from "node:test";
import assert from "node:assert/strict";
import worker from "../backend/src/index.ts";
import type { Env } from "../backend/src/index.ts";
import { applySinglesAction, emptySinglesLeague } from "../lib/singles.ts";
import { emptyLeague } from "../lib/league.ts";

class Database {
  document: { data: string; revision: number } | null = null;
  photos = new Map<string, { bytes: number[]; content_type: string }>();
  conflict: (() => void) | null = null;
  binding() {
    return this as unknown as D1Database;
  }
  prepare(sql: string) {
    return {
      bind: (...values: unknown[]) => ({
        run: async () => {
          if (sql.startsWith("INSERT OR IGNORE INTO league")) {
            this.document ??= { data: values[1] as string, revision: 0 };
          } else if (sql.startsWith("UPDATE league")) {
            if (this.conflict) {
              const fn = this.conflict;
              this.conflict = null;
              fn();
            }
            if (this.document!.revision !== values[2])
              return { meta: { changes: 0 } };
            this.document = {
              data: values[0] as string,
              revision: this.document!.revision + 1,
            };
          } else if (sql.startsWith("INSERT INTO photos")) {
            this.photos.set(values[0] as string, {
              bytes: [...new Uint8Array(values[1] as ArrayBuffer)],
              content_type: values[2] as string,
            });
          } else throw Error(`Unexpected SQL: ${sql}`);
          return { meta: { changes: 1 } };
        },
        first: async () =>
          sql.includes("FROM league")
            ? this.document
            : (this.photos.get(values[0] as string) ?? null),
      }),
    };
  }
}
function setup() {
  const doubles = new Database(),
    singles = new Database();
  const env: Env = {
    DB: doubles.binding(),
    DB_SINGLES: singles.binding(),
    ADMIN_TOKEN: "test-only-32-character-admin-token",
    ALLOWED_ORIGINS: "https://gsuperleague.github.io",
  };
  const request = (path: string, action?: unknown, auth = true) =>
    worker.fetch(
      new Request(
        `https://api.example${path}`,
        action === undefined
          ? undefined
          : {
              method: "POST",
              headers: auth
                ? { Authorization: `Bearer ${env.ADMIN_TOKEN}` }
                : {},
              body: JSON.stringify(action),
            },
      ),
      env,
    );
  return { doubles, singles, env, request };
}
const player = (id: string) => ({
  type: "player.save",
  id,
  data: {
    name: id,
    nickname: "",
    number: id === "a" ? 1 : 2,
    bio: "",
    photo: "",
  },
});
test("news actions validate content, require authentication, and persist separately in both modes", async () => {
  const { request } = setup();
  const data = {
    title: "赛季新闻",
    summary: "摘要",
    body: "正文\n\n第二段",
    season: "beta",
    publishedAt: "2026-11-02T00:00:00+08:00",
  };
  for (const path of ["/api/league", "/api/singles/league"]) {
    assert.equal(
      (await request(path, { type: "news.save", id: "story", data }, false))
        .status,
      401,
    );
    for (const invalid of [
      { title: " " },
      { body: "" },
      { body: "a".repeat(12001) },
      { season: "other" },
      { publishedAt: "bad" },
    ])
      assert.equal(
        (
          await request(path, {
            type: "news.save",
            id: "story",
            data: { ...data, ...invalid },
          })
        ).status,
        400,
      );
    assert.equal(
      (
        await request(path, {
          type: "news.save",
          id: "story",
          data: { ...data, title: path },
        })
      ).status,
      200,
    );
  }
  for (const path of ["/api/league", "/api/singles/league"]) {
    const read = async () =>
      (
        (await (await request(path)).json()) as {
          data: { news: { title: string }[] };
        }
      ).data.news;
    assert.equal((await read())[0].title, path);
    assert.equal(
      (
        await request(path, {
          type: "news.save",
          id: "story",
          data: { ...data, title: "更新" },
        })
      ).status,
      200,
    );
    assert.deepEqual(
      (await read()).map((a) => a.title),
      ["更新"],
    );
    assert.equal(
      (await request(path, { type: "news.delete", id: "story" })).status,
      200,
    );
    assert.deepEqual(await read(), []);
  }
});
test("singles CRUD and settings never read or mutate the doubles document", async () => {
  const { doubles, singles, request } = setup();
  doubles.document = {
    data: JSON.stringify({
      ...emptyLeague(),
      players: [{ id: "doubles-only" }],
    }),
    revision: 7,
  };
  const before = structuredClone(doubles.document);
  assert.equal(
    (await request("/api/singles/league", player("a"), false)).status,
    401,
  );
  assert.equal((await request("/api/singles/league", player("a"))).status, 200);
  assert.equal((await request("/api/singles/league", player("b"))).status, 200);
  assert.equal(
    (
      await request("/api/singles/league", {
        type: "settings.save",
        id: "settings",
        data: { season: "Solo", win: 5, draw: 2, loss: 0 },
      })
    ).status,
    200,
  );
  const body = (await (await request("/api/singles/league")).json()) as {
    data: { mode: string; players: { id: string }[] };
  };
  assert.equal(body.data.mode, "singles");
  assert.deepEqual(
    body.data.players.map((p) => p.id),
    ["a", "b"],
  );
  assert.equal(
    (
      await request("/api/singles/league", {
        type: "match.save",
        id: "m",
        data: {
          homeId: "a",
          awayId: "doubles-only",
          time: new Date().toISOString(),
          round: "1",
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (await request("/api/singles/league", { type: "player.delete", id: "a" }))
      .status,
    200,
  );
  assert.deepEqual(doubles.document, before);
  assert.equal(singles.document!.revision, 4);
});
test("missing, identical, and incorrectly aliased singles databases fail closed", async () => {
  const { doubles, singles, env } = setup();
  const read = (e: Env, path = "/api/singles/league") =>
    worker.fetch(new Request(`https://api.example${path}`), e);
  assert.equal((await read({ ...env, DB_SINGLES: undefined })).status, 503);
  assert.equal((await read({ ...env, DB_SINGLES: env.DB })).status, 503);
  assert.equal(doubles.document, null);
  singles.document = { data: JSON.stringify(emptyLeague()), revision: 10 };
  assert.equal((await read(env)).status, 503);
  assert.equal((await read(env, "/api/singles/photos/abc")).status, 503);
  assert.equal(singles.document.revision, 10);
  assert.equal((await read(env, "/api/league")).status, 200);
});
test("singles avatar bytes stay in singles D1, including when doubles uses R2", async () => {
  const { doubles, singles, env } = setup();
  env.BUCKET = {
    get() {
      throw Error("Singles must not use doubles R2");
    },
    put() {
      throw Error("Singles must not use doubles R2");
    },
  } as unknown as R2Bucket;
  const bytes = new Uint8Array([255, 216, 255, 224, 0, 16]);
  const uploaded = await worker.fetch(
    new Request("https://api.example/api/singles/photos", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.ADMIN_TOKEN}` },
      body: bytes,
    }),
    env,
  );
  assert.equal(uploaded.status, 200);
  const { url } = (await uploaded.json()) as { url: string };
  assert.match(url, /^\/api\/singles\/photos\//);
  assert.equal(singles.photos.size, 1);
  assert.equal(doubles.photos.size, 0);
  const read = await worker.fetch(
    new Request(`https://api.example${url}`),
    env,
  );
  assert.deepEqual(new Uint8Array(await read.arrayBuffer()), bytes);
  singles.photos.clear();
  doubles.photos.set(url.split("/").at(-1)!, {
    bytes: [...bytes],
    content_type: "image/jpeg",
  });
  assert.equal(
    (await worker.fetch(new Request(`https://api.example${url}`), env)).status,
    404,
  );
});
test("singles supports separate admin credentials and the same CORS restrictions", async () => {
  const { env } = setup();
  env.SINGLES_ADMIN_TOKEN = "separate-singles-admin-token-123456";
  const login = (token: string, path: string) =>
    worker.fetch(
      new Request(`https://api.example${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }),
      env,
    );
  assert.equal((await login(env.ADMIN_TOKEN, "/api/singles/auth")).status, 401);
  assert.equal(
    (await login(env.SINGLES_ADMIN_TOKEN, "/api/singles/auth")).status,
    200,
  );
  assert.equal((await login(env.ADMIN_TOKEN, "/api/auth")).status, 200);
  assert.equal(
    (
      await worker.fetch(
        new Request("https://api.example/api/singles/league", {
          headers: { Origin: "https://unapproved.example" },
        }),
        env,
      )
    ).status,
    403,
  );
});
test("optimistic retries preserve another singles writer and leave doubles revisions alone", async () => {
  const { singles, doubles, request } = setup();
  singles.document = {
    data: JSON.stringify(emptySinglesLeague()),
    revision: 0,
  };
  singles.conflict = () => {
    singles.document = {
      data: JSON.stringify(
        applySinglesAction(JSON.parse(singles.document!.data), player("b")),
      ),
      revision: 1,
    };
  };
  assert.equal((await request("/api/singles/league", player("a"))).status, 200);
  assert.deepEqual(
    JSON.parse(singles.document.data).players.map((p: { id: string }) => p.id),
    ["b", "a"],
  );
  assert.equal(singles.document.revision, 2);
  assert.equal(doubles.document, null);
});
