import type { SeasonId } from "./seasons.ts";

export type NewsArticle = {
  id: string;
  title: string;
  summary: string;
  body: string;
  season: SeasonId;
  publishedAt: string;
};

export function applyNewsAction(
  articles: NewsArticle[],
  action: { type: string; id: string; data?: unknown },
): NewsArticle[] {
  if (action.type === "news.delete")
    return articles.filter((a) => a.id !== action.id);
  const value = action.data;
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("新闻内容无效");
  const data = value as Record<string, unknown>;
  function text(key: string, max: number, required = true): string {
    const value = data[key];
    if (
      typeof value !== "string" ||
      value.length > max ||
      (required && !value.trim())
    )
      throw new Error("请检查新闻标题、摘要和正文长度");
    return value.trim();
  }
  const season = data.season;
  if (season !== "beta" && season !== "s1")
    throw new Error("请选择新闻所属赛季");
  const publishedAt = text("publishedAt", 50);
  if (!Number.isFinite(Date.parse(publishedAt)))
    throw new Error("新闻日期无效");
  const article: NewsArticle = {
    id: action.id,
    title: text("title", 100),
    summary: text("summary", 300, false),
    body: text("body", 12000),
    season,
    publishedAt,
  };
  const result = [...articles.filter((a) => a.id !== article.id), article];
  if (result.length > 200) throw new Error("新闻数量已达上限");
  return result;
}
