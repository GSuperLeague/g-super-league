import type {
  BadmintonAction,
  BadmintonLeague,
  BadmintonPlayer,
} from "../lib/badminton.ts";
export const badmintonApiBase = (
  import.meta.env.VITE_BADMINTON_API_BASE_URL ||
  (import.meta.env.DEV
    ? new URL(import.meta.env.BASE_URL, window.location.origin).href
    : "https://gair-badminton-api.jason-brown-20-28-2023.workers.dev")
).replace(/\/$/, "");
const tokenKey = "gair-super-league:badminton-admin";
export const badmintonToken = () => sessionStorage.getItem(tokenKey) || "";
export const badmintonLogout = () => sessionStorage.removeItem(tokenKey);
export type BadmintonSnapshot = { data: BadmintonLeague; revision: number };
export async function badmintonRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (!headers.has("Authorization") && badmintonToken())
    headers.set("Authorization", `Bearer ${badmintonToken()}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${badmintonApiBase}/api/badminton${path}`, {
    ...init,
    headers,
    credentials: "omit",
    cache: "no-store",
  });
  const body = (await response.json().catch(() => null)) as {
    error?: string;
  } | null;
  if (!response.ok) {
    const error = new Error(
      body?.error || "暂时无法连接 GB 联赛，请重试",
    ) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body as T;
}
export async function badmintonLogin(token: string) {
  await badmintonRequest("/auth", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  sessionStorage.setItem(tokenKey, token);
}
export const saveBadmintonAction = (
  action: BadmintonAction,
  revision: number,
) =>
  badmintonRequest<BadmintonSnapshot>("/league", {
    method: "POST",
    body: JSON.stringify({ ...action, expectedRevision: revision }),
  });
export const sourceBadmintonPlayers = () =>
  badmintonRequest<{
    players: Pick<BadmintonPlayer, "id" | "name" | "nickname" | "photo">[];
  }>("/source-players");
