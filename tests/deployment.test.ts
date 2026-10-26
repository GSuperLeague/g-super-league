import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

test("deployment rejects missing or shared physical database IDs", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gsl-deploy-check-"));
  const script = resolve("scripts/check-db-config.mjs");
  try {
    await mkdir(join(dir, "backend"));
    const run = async (ids: (string | undefined)[]) => {
      await writeFile(
        join(dir, "backend/wrangler.jsonc"),
        JSON.stringify({
          d1_databases: ids.map((database_id, index) => ({
            binding: index ? "DB_SINGLES" : "DB",
            database_id,
          })),
        }),
      );
      return spawnSync(process.execPath, [script], {
        cwd: dir,
        encoding: "utf8",
      });
    };
    const a = "00000000-0000-0000-0000-000000000000",
      b = "00000000-0000-0000-0000-000000000001";
    assert.notEqual((await run([a])).status, 0);
    assert.notEqual((await run([a, "REPLACE_WITH_DATABASE_ID"])).status, 0);
    assert.notEqual((await run([a, a])).status, 0);
    assert.equal((await run([a, b])).status, 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
