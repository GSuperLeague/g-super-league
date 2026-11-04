import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";

test("database triggers protect frozen beta even when an older API bypasses the new client checks", async () => {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("test")}}',
    compatibilityDate: "2026-05-15",
    d1Databases: { DB: "frozen-beta-test" },
  });
  try {
    const db = await mf.getD1Database("DB");
    await db
      .prepare(
        "CREATE TABLE league (id TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0)",
      )
      .run();
    const data = {
      matches: [
        {
          id: "beta",
          time: "2026-11-01T15:59:59Z",
          summary: { homeScore: 7, awayScore: 4 },
        },
        {
          id: "s1",
          time: "2026-11-01T16:00:00Z",
          summary: { homeScore: 7, awayScore: 4 },
        },
      ],
      seasonArchives: {
        beta: {
          lockedAt: "2026-11-04T08:00:00Z",
          ruleVersion: "gsl-beta-v1",
          finalRatings: { a: 1239 },
        },
      },
    };
    await db
      .prepare("INSERT INTO league VALUES (?,?,0)")
      .bind("main", JSON.stringify(data))
      .run();
    const sql = await readFile(
      new URL(
        "../backend/migrations/0003_beta_archive_lock.sql",
        import.meta.url,
      ),
      "utf8",
    );
    const triggers = sql.match(/CREATE TRIGGER[\s\S]*?END;/g)!;
    assert.equal(triggers.length, 3);
    for (const trigger of triggers) await db.prepare(trigger).run();
    for (const change of [
      "json_set(data,'$.matches[0].summary.homeScore',99)",
      "json_remove(data,'$.matches[0]')",
      "json_set(data,'$.matches[1].time','2026-10-31T00:00:00+08:00')",
    ]) {
      await assert.rejects(
        db
          .prepare(
            `UPDATE league SET data=${change},revision=revision+1 WHERE id='main'`,
          )
          .run(),
        /BETA_MATCHES_LOCKED/,
      );
    }
    for (const change of [
      "json_set(data,'$.seasonArchives.beta.finalRatings.a',9999)",
      "json_remove(data,'$.seasonArchives.beta')",
    ]) {
      await assert.rejects(
        db
          .prepare(
            `UPDATE league SET data=${change},revision=revision+1 WHERE id='main'`,
          )
          .run(),
        /BETA_ARCHIVE_LOCKED/,
      );
    }
    await assert.rejects(
      db.prepare("DELETE FROM league WHERE id='main'").run(),
      /BETA_ARCHIVE_LOCKED/,
    );
    const before = await db
      .prepare("SELECT data,revision FROM league WHERE id='main'")
      .first<{ data: string; revision: number }>();
    assert.equal(before!.revision, 0);
    assert.deepEqual(JSON.parse(before!.data), data);
    await db
      .prepare(
        "UPDATE league SET data=json_set(data,'$.matches[1].summary.homeScore',8),revision=revision+1 WHERE id='main'",
      )
      .run();
    const after = await db
      .prepare("SELECT data,revision FROM league WHERE id='main'")
      .first<{ data: string; revision: number }>();
    assert.equal(after!.revision, 1);
    assert.equal(JSON.parse(after!.data).matches[1].summary.homeScore, 8);
    assert.deepEqual(
      JSON.parse(after!.data).seasonArchives,
      data.seasonArchives,
    );
  } finally {
    await mf.dispose();
  }
});
