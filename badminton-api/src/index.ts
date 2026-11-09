import {
  applyBadmintonAction,
  emptyBadmintonLeague,
} from "../../lib/badminton.ts";
import type { BadmintonAction, BadmintonLeague } from "../../lib/badminton.ts";
import type { InferEnv } from "cf/config";
import type config from "../cloudflare.config.ts";
import { handleGallery } from "./gallery.ts";
type GBEnv = InferEnv<typeof config.worker>;

const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
const maximumBody = 32768;
async function boundedJSON(request: Request): Promise<Record<string, unknown>> {
  if (Number(request.headers.get("Content-Length") || 0) > maximumBody)
    throw Error("提交内容过大");
  const reader = request.body?.getReader();
  if (!reader) throw Error("提交内容为空");
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > maximumBody) {
      await reader.cancel();
      throw Error("提交内容过大");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw Error("无效的提交内容");
  return value as Record<string, unknown>;
}
async function row(
  env: GBEnv,
): Promise<{ data: BadmintonLeague; revision: number }> {
  const stored = await env.DB.prepare(
    "SELECT data,revision FROM badminton_league WHERE id='main'",
  ).first<{ data: string; revision: number }>();
  if (!stored) return { data: emptyBadmintonLeague(), revision: 0 };
  const data = JSON.parse(stored.data) as BadmintonLeague;
  if (data.sport !== "badminton" || data.schemaVersion !== 1)
    throw Error("Badminton storage identity mismatch");
  return { data, revision: stored.revision };
}
async function administrator(request: Request, env: GBEnv): Promise<boolean> {
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ") || authorization.length > 1024)
    return false;
  const response = await env.AUTH_SERVICE.fetch(
    new Request("https://g-super-league-api.internal/api/auth", {
      method: "POST",
      headers: { Authorization: authorization },
    }),
  );
  await response.body?.cancel();
  if (response.status >= 500)
    throw Error("Authentication authority unavailable");
  return response.ok;
}
async function sourcePlayers(env: GBEnv) {
  const response = await env.AUTH_SERVICE.fetch(
    "https://g-super-league-api.internal/api/league",
  );
  if (!response.ok) throw Error("Source roster unavailable");
  const source = (await response.json()) as { data?: { players?: unknown[] } };
  if (!Array.isArray(source.data?.players) || source.data.players.length > 2000)
    throw Error("Source roster invalid");
  return source.data.players.map((raw) => {
    if (!raw || typeof raw !== "object") throw Error("Source player invalid");
    const p = raw as Record<string, unknown>;
    if (typeof p.id !== "string" || typeof p.name !== "string")
      throw Error("Source identity invalid");
    return {
      id: p.id,
      name: p.name,
      nickname: typeof p.nickname === "string" ? p.nickname : "",
      photo: typeof p.photo === "string" ? p.photo : "",
    };
  });
}
export async function handleBadminton(
  request: Request,
  env: GBEnv,
): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (request.method === "GET" && path === "/api/badminton/league")
    return json(await row(env));
  if (request.method === "GET" && path === "/api/badminton/health") {
    const snapshot = await row(env);
    return json({
      ok: true,
      service: "GB league",
      sport: "badminton",
      revision: snapshot.revision,
    });
  }
  if (!["POST", "GET"].includes(request.method))
    return json({ error: "此操作不受支持" }, 405);
  if (
    ![
      "/api/badminton/auth",
      "/api/badminton/league",
      "/api/badminton/source-players",
    ].includes(path)
  )
    return json({ error: "接口不存在" }, 404);
  if (!(await administrator(request, env)))
    return json({ error: "请使用 G超管理员密码登录" }, 401);
  if (path === "/api/badminton/auth" && request.method === "POST")
    return json({ ok: true });
  if (path === "/api/badminton/source-players" && request.method === "GET")
    return json({ players: await sourcePlayers(env) });
  if (path !== "/api/badminton/league" || request.method !== "POST")
    return json({ error: "此操作不受支持" }, 405);
  let input: Record<string, unknown>;
  try {
    input = await boundedJSON(request);
  } catch {
    return json({ error: "提交内容无效或超过32KB" }, 400);
  }
  const expectedRevision = input.expectedRevision;
  if (
    typeof expectedRevision !== "number" ||
    !Number.isInteger(expectedRevision) ||
    expectedRevision < 0
  )
    return json({ error: "请刷新后重试" }, 400);
  if (
    typeof input.id !== "string" ||
    typeof input.type !== "string" ||
    typeof input.actionId !== "string"
  )
    return json({ error: "提交内容不完整" }, 400);
  const action: BadmintonAction = {
    id: input.id,
    type: input.type,
    actionId: input.actionId,
    data: input.data,
  };
  const current = await row(env);
  if (current.data.recentActions.includes(action.actionId))
    return json(current);
  if (current.revision !== expectedRevision)
    return json(
      { error: "另一位记录员刚更新了数据，已为你刷新，请核对后重试" },
      409,
    );
  if (action.type === "player.import") {
    const ids = (action.data as { ids?: unknown })?.ids;
    if (
      !Array.isArray(ids) ||
      ids.length < 1 ||
      ids.length > 200 ||
      !ids.every((id) => typeof id === "string")
    )
      return json({ error: "请选择要登记的球员" }, 400);
    const players = (await sourcePlayers(env)).filter((p) =>
      ids.includes(p.id),
    );
    if (players.length !== new Set(ids).size)
      return json({ error: "来源球员已发生变化，请重新选择" }, 400);
    action.data = { players };
  }
  let data: BadmintonLeague;
  try {
    data = applyBadmintonAction(current.data, action);
  } catch (e) {
    return json(
      { error: e instanceof Error ? e.message : "请检查提交内容" },
      400,
    );
  }
  const encoded = JSON.stringify(data);
  if (new TextEncoder().encode(encoded).byteLength > 1500000)
    return json({ error: "联赛记录容量已满，请先导出备份" }, 413);
  await env.DB.prepare(
    "INSERT OR IGNORE INTO badminton_league (id,data,revision) VALUES (?,?,0)",
  )
    .bind("main", JSON.stringify(emptyBadmintonLeague()))
    .run();
  const result = await env.DB.prepare(
    "UPDATE badminton_league SET data=?,revision=revision+1 WHERE id='main' AND revision=?",
  )
    .bind(encoded, current.revision)
    .run();
  if (result.meta.changes !== 1)
    return json({ error: "记录刚被更新，已为你刷新，请核对后重试" }, 409);
  return json({ data, revision: current.revision + 1 });
}
export default {
  async fetch(request: Request, env: GBEnv): Promise<Response> {
    const origin = request.headers.get("Origin"),
      allowed = env.ALLOWED_ORIGINS.split(",").map((x) => x.trim());
    if (origin && !allowed.includes(origin))
      return json({ error: "当前网站来源未获允许" }, 403);
    const path = new URL(request.url).pathname;
    const gallery = path.startsWith("/api/gallery/");
    let response: Response;
    try {
      response =
        request.method === "OPTIONS"
          ? new Response(null, { status: 204 })
          : gallery
            ? await handleGallery(request, env.DB, () => administrator(request, env))
            : await handleBadminton(request, env);
    } catch (e) {
      console.error(
        JSON.stringify({
          message: gallery ? "Gallery request failed" : "GB request failed",
          path,
          error: e instanceof Error ? e.message : "unknown",
        }),
      );
      response = json({ error: gallery ? "图库暂时无法连接，请稍后重试" : "GB 联赛暂时无法连接，请稍后重试" }, 503);
    }
    const headers = new Headers(response.headers);
    headers.set("Vary", "Origin");
    headers.set("X-Content-Type-Options", "nosniff");
    if (origin) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Methods", gallery ? "GET, POST, DELETE, OPTIONS" : "GET, POST, OPTIONS");
      headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization",
      );
    }
    return new Response(response.body, { status: response.status, headers });
  },
} satisfies ExportedHandler<GBEnv>;
