// A disposable, entirely local preview of both sports. No production writes.
import { Miniflare } from "miniflare";
import { buildSync } from "esbuild";
import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { emptyLeague } from "../lib/league.ts";
import { emptySinglesLeague } from "../lib/singles.ts";
import {
  applyBadmintonAction,
  emptyBadmintonLeague,
} from "../lib/badminton.ts";
const root = fileURLToPath(new URL("..", import.meta.url));
process.chdir(root);
const frontendPort = Number(process.env.GSL_LOCAL_FRONT_PORT || 5191),
  apiPort = Number(process.env.GSL_LOCAL_API_PORT || 8799);
const bundle = (path) =>
  buildSync({
    entryPoints: [path],
    bundle: true,
    format: "esm",
    platform: "browser",
    write: false,
    target: "es2022",
  }).outputFiles[0].text;
const key = "preview-only-admin-token-2026";
const mf = new Miniflare({
  host: "127.0.0.1",
  port: apiPort,
  workers: [
    {
      name: "gb",
      compatibilityDate: "2026-05-15",
      modules: [
        {
          type: "ESModule",
          path: "entry.mjs",
          contents:
            'import worker from "./gb.mjs"; export default {fetch(r,e,c){const p=new URL(r.url).pathname;return p.startsWith("/api/badminton/")||p.startsWith("/api/gallery/")?worker.fetch(r,e,c):e.AUTH_SERVICE.fetch(r);}}',
        },
        {
          type: "ESModule",
          path: "gb.mjs",
          contents: bundle("badminton-api/src/index.ts"),
        },
      ],
      d1Databases: { DB: "preview-gb" },
      serviceBindings: { AUTH_SERVICE: "football" },
      bindings: {
        ALLOWED_ORIGINS: `http://localhost:${frontendPort},http://127.0.0.1:${frontendPort}`,
      },
    },
    {
      name: "football",
      compatibilityDate: "2026-05-15",
      modules: true,
      script: bundle("backend/src/index.ts"),
      d1Databases: { DB: "preview-football", DB_SINGLES: "preview-singles" },
      bindings: {
        ADMIN_TOKEN: key,
        ALLOWED_ORIGINS: `http://localhost:${frontendPort},http://127.0.0.1:${frontendPort}`,
      },
    },
  ],
});
const footballDb = await mf.getD1Database("DB", "football"),
  singlesDb = await mf.getD1Database("DB_SINGLES", "football"),
  gbDb = await mf.getD1Database("DB", "gb");
for (const db of [footballDb, singlesDb]) {
  await db
    .prepare(
      "CREATE TABLE league (id TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0)",
    )
    .run();
  await db
    .prepare(
      "CREATE TABLE photos (id TEXT PRIMARY KEY,bytes BLOB,content_type TEXT)",
    )
    .run();
}
let football = emptyLeague();
if (process.argv[2]) {
  const raw = JSON.parse(await readFile(process.argv[2], "utf8"));
  football = raw.data || raw;
}
await footballDb
  .prepare("INSERT INTO league VALUES (?,?,0)")
  .bind("main", JSON.stringify(football))
  .run();
await singlesDb
  .prepare("INSERT INTO league VALUES (?,?,0)")
  .bind("main", JSON.stringify(emptySinglesLeague()))
  .run();
await gbDb
  .prepare(
    "CREATE TABLE badminton_league (id TEXT PRIMARY KEY,data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0)",
  )
  .run();
for (const migration of ["0002_gallery.sql", "0003_gallery_photo_variants.sql"]) {
  const sql = await readFile(`badminton-api/migrations/${migration}`, "utf8");
  await gbDb.batch(sql.split(";").map((statement) => statement.trim()).filter(Boolean).map((statement) => gbDb.prepare(statement)));
}
let gb = emptyBadmintonLeague();
if (football.players.length)
  gb = applyBadmintonAction(gb, {
    type: "player.import",
    id: "preview-roster",
    actionId: "preview-roster",
    data: { players: football.players },
  });
await gbDb
  .prepare("INSERT INTO badminton_league VALUES (?,?,0)")
  .bind("main", JSON.stringify(gb))
  .run();
const vite = spawn(
  process.execPath,
  [
    "node_modules/vite/bin/vite.js",
    "--host",
    "127.0.0.1",
    "--port",
    String(frontendPort),
    "--strictPort",
  ],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      GSL_LOCAL_API_PORT: String(apiPort),
      GSL_LOCAL_FRONT_PORT: String(frontendPort),
      VITE_API_BASE_URL: "",
      VITE_BADMINTON_API_BASE_URL: "",
    },
  },
);
console.log(`Local preview: http://127.0.0.1:${frontendPort}/g-super-league/`);
const stop = async () => {
  vite.kill();
  await mf.dispose();
  process.exit();
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
vite.on("exit", async () => {
  await mf.dispose();
});
