import { readFile, mkdir, writeFile } from "node:fs/promises";
import { spawn, spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const snapshotPath = process.argv[2];
if (!snapshotPath)
  throw new Error("用法: npm run dev:snapshot -- <导出的 JSON 文件>");
const snapshot = JSON.parse(await readFile(snapshotPath, "utf8"));
const league = snapshot.league ?? snapshot.data;
if (
  !league ||
  !["teams", "players", "matches"].every((key) => Array.isArray(league[key])) ||
  !league.settings
) {
  throw new Error(
    "快照格式无效，需要 league（或 data）中的球队、球员、比赛和设置",
  );
}
const { createServer } = await import("node:net");
async function availablePort(preferred) {
  for (let port = preferred; port < preferred + 30; port++) {
    const available = await new Promise((accept) => {
      const server = createServer();
      server.on("error", () => accept(false));
      server.listen(port, "0.0.0.0", () => server.close(() => accept(true)));
    });
    if (available) return port;
  }
  throw new Error(`无法找到空闲端口（${preferred} 起）`);
}
const frontPort = await availablePort(5173);
const apiPort = await availablePort(8787);
const dir = resolve(".migration/local-preview");
await mkdir(dir, { recursive: true });
const config = resolve(dir, "wrangler.jsonc");
const adminToken = "preview-only-admin-token-2026";
await writeFile(
  config,
  JSON.stringify(
    {
      name: "g-super-league-local-preview",
      main: resolve("backend/src/index.ts"),
      compatibility_date: "2026-05-15",
      workers_dev: false,
      vars: {
        ALLOWED_ORIGINS: `http://localhost:${frontPort},http://127.0.0.1:${frontPort}`,
      },
      d1_databases: [
        {
          binding: "DB",
          database_name: "g-super-league-local-preview",
          database_id: "00000000-0000-0000-0000-000000000000",
          migrations_dir: resolve("backend/migrations"),
        },
      ],
    },
    null,
    2,
  ),
);
await writeFile(resolve(dir, ".dev.vars"), `ADMIN_TOKEN=${adminToken}\n`);
const wrangler = resolve("node_modules/wrangler/bin/wrangler.js");
const storage = resolve(dir, "storage");
const localArgs = ["--local", "--persist-to", storage, "--config", config];
const run = (args) => {
  const result = spawnSync(process.execPath, [wrangler, ...args], {
    stdio: "inherit",
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
  if (result.status !== 0) throw new Error("本地数据库初始化失败");
};
run(["d1", "migrations", "apply", "DB", ...localArgs]);
const encoded = JSON.stringify(league).replaceAll("'", "''");
const sql = resolve(dir, "snapshot.sql");
await writeFile(
  sql,
  `INSERT INTO league (id,data,revision) VALUES ('main','${encoded}',0) ON CONFLICT(id) DO UPDATE SET data=excluded.data, revision=league.revision+1;`,
);
run(["d1", "execute", "DB", "--file", sql, ...localArgs]);
const children = [];
let closing = false;
const stop = () => {
  if (closing) return;
  closing = true;
  for (const child of children) child.kill("SIGTERM");
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
const start = (args, env) => {
  const child = spawn(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
    stop();
  });
  child.on("exit", (code) => {
    if (!closing) {
      process.exitCode = code || 1;
      stop();
    }
  });
  return child;
};
start(
  [
    wrangler,
    "dev",
    "--local",
    "--ip",
    "127.0.0.1",
    "--port",
    String(apiPort),
    "--persist-to",
    storage,
    "--config",
    config,
  ],
  { WRANGLER_SEND_METRICS: "false" },
);
let ready = false;
for (let i = 0; i < 60 && !closing; i++) {
  try {
    const response = await fetch(`http://127.0.0.1:${apiPort}/api/league`, {
      signal: AbortSignal.timeout(1000),
    });
    if (response.ok) {
      ready = true;
      break;
    }
  } catch {}
  await delay(500);
}
if (!ready) {
  stop();
  throw new Error("本地 Worker 未能启动");
}
if (!closing) {
  start(
    [
      resolve("node_modules/vite/bin/vite.js"),
      "--host",
      "0.0.0.0",
      "--port",
      String(frontPort),
      "--strictPort",
    ],
    {
      VITE_API_BASE_URL: "",
      VITE_BASE_PATH: "/g-super-league/",
      GSL_LOCAL_API_PORT: String(apiPort),
      GSL_LOCAL_FRONT_PORT: String(frontPort),
    },
  );
  console.log(
    `\n本地快照: ${league.teams.length} 支球队 / ${league.players.length} 名球员 / ${league.matches.length} 场比赛`,
  );
  console.log(`预览: http://localhost:${frontPort}/g-super-league/`);
  if (process.env.VC_PREFIX) {
    console.log(
      `Notebook 预览: https://nat2-notebook-inspire.sii.edu.cn${process.env.VC_PREFIX.replace(/\/$/, "")}/proxy/${frontPort}/g-super-league/`,
    );
  }
  console.log(`仅供本地的管理密钥: ${adminToken}`);
}
