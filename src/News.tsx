import { Fragment, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Award,
  CalendarDays,
  Check,
  ChevronRight,
  Flame,
  Medal,
  Newspaper,
  Pencil,
  Plus,
  Search,
  Trash2,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import type { League } from "../lib/league.ts";
import type { SinglesLeague } from "../lib/singles.ts";
import type { NewsArticle } from "../lib/news.ts";
import { betaReport } from "../lib/season-news.ts";
import { seasonOneReport } from "../lib/season-one-news.ts";
import { rankTier } from "../lib/rating.ts";
import leagueLogo from "./assets/g-super-league-logo-640.png";
import { footballFirstWinArticle } from "../lib/rule-announcements.ts";
import { CURRENT_SEASON, FIRST_WIN_POLICY, SEASONS } from "../lib/seasons.ts";
import { footballSeasonPromos, footballSeasonLabel } from "../lib/season-promos.ts";
import { SeasonTrailers } from "./SeasonTrailers";
import "./news.css";

const dateLabel = (time: string) =>
  new Date(time).toLocaleDateString("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
const dateInput = (time: string) =>
  new Date(time)
    .toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" })
    .slice(0, 16)
    .replace(" ", "T");
type NewsAction = { type: string; id: string; data?: unknown };
const newsSeasonLabel = (article: NewsArticle) =>
  footballSeasonLabel(article.season);

export function News({
  league,
  admin,
  busy,
  onSave,
  onMatch,
}: {
  league: League | SinglesLeague;
  admin: boolean;
  busy: boolean;
  onSave: (action: NewsAction) => Promise<boolean>;
  onMatch?: (id: string) => void;
}) {
  const report = useMemo(
    () => ("mode" in league ? null : betaReport(league)),
    [league],
  );
  const reports = useMemo(
    () => "mode" in league ? [] : [seasonOneReport, ...(report ? [report] : [])],
    [league, report],
  );
  const articles = useMemo(() => {
    const result = new Map<string, NewsArticle>();
    for (const entry of reports) result.set(entry.article.id, entry.article);
    for (const promo of footballSeasonPromos) result.set(promo.article.id, promo.article);
    if (league.firstWinPolicy?.version === FIRST_WIN_POLICY.version)
      result.set(footballFirstWinArticle.id, footballFirstWinArticle);
    for (const article of league.news || []) result.set(article.id, article);
    return [...result.values()].sort(
      (a, b) =>
        Date.parse(b.publishedAt) - Date.parse(a.publishedAt) ||
        a.id.localeCompare(b.id),
    );
  }, [league.news, league.firstWinPolicy, reports]);
  const [selected, setSelected] = useState("");
  const [query, setQuery] = useState("");
  const [season, setSeason] = useState("all");
  const [editing, setEditing] = useState<NewsArticle | null>(null);
  const [formError, setFormError] = useState("");
  const article = articles.find((a) => a.id === selected);
  const selectedPromo = footballSeasonPromos.find((promo) => promo.article.id === article?.id);
  const structured =
    article &&
    !league.news?.some((a) => a.id === article.id)
      ? reports.find((entry) => entry.article.id === article.id)
      : null;
  const visible = articles.filter(
    (a) =>
      (season === "all" || a.season === season) &&
      `${a.title} ${a.summary} ${a.body}`.includes(query),
  );
  const edit = (value?: NewsArticle) => {
    setFormError("");
    setEditing(
      value || {
        id: crypto.randomUUID(),
        title: "",
        summary: "",
        body: "",
        season: CURRENT_SEASON,
        publishedAt: new Date().toISOString(),
      },
    );
  };
  const saved = Boolean(
    article && league.news?.some((a) => a.id === article.id),
  );
  const restoreLabel = !article
    ? ""
    : reports.some((entry) => entry.article.id === article.id)
      ? "恢复默认定榜稿"
      : league.firstWinPolicy?.version === FIRST_WIN_POLICY.version &&
          article.id === footballFirstWinArticle.id
        ? "恢复默认每日奖励公告"
        : selectedPromo
          ? "恢复默认赛季介绍"
          : "";
  return (
    <div className={`news-page${article?.id === seasonOneReport.article.id && !editing ? " news-page-final" : ""}`}>
      {editing && admin ? (
        <>
          <header className="page-heading">
            <div>
              <span className="eyebrow">G SUPER LEAGUE / NEWSROOM</span>
              <h1>
                {articles.some((a) => a.id === editing.id)
                  ? "编辑新闻"
                  : "发布新闻"}
              </h1>
            </div>
          </header>
          <form
            className="entity-form news-editor"
            key={editing.id}
            onSubmit={async (event) => {
              event.preventDefault();
              const form = new FormData(event.currentTarget);
              const time = String(form.get("publishedAt"));
              if (!Number.isFinite(Date.parse(`${time}+08:00`))) {
                setFormError("请填写有效的发布时间");
                return;
              }
              const ok = await onSave({
                type: "news.save",
                id: editing.id,
                data: {
                  title: form.get("title"),
                  summary: form.get("summary"),
                  body: form.get("body"),
                  season: form.get("season"),
                  publishedAt: new Date(`${time}+08:00`).toISOString(),
                },
              });
              if (ok) {
                setSelected(editing.id);
                setEditing(null);
              }
            }}
          >
            <fieldset disabled={busy}>
              <label>
                标题
                <input
                  name="title"
                  required
                  maxLength={100}
                  defaultValue={editing.title}
                />
              </label>
              <div className="form-grid">
                <label>
                  所属赛季
                  <select name="season" defaultValue={editing.season}>
                    {SEASONS.map((s) => (
                      <option value={s.id} key={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  发布时间（北京时间）
                  <input
                    name="publishedAt"
                    type="datetime-local"
                    required
                    defaultValue={dateInput(editing.publishedAt)}
                  />
                </label>
              </div>
              <label>
                摘要
                <textarea
                  name="summary"
                  rows={2}
                  maxLength={300}
                  defaultValue={editing.summary}
                />
              </label>
              <label>
                正文
                <textarea
                  name="body"
                  rows={18}
                  required
                  maxLength={12000}
                  defaultValue={editing.body}
                />
              </label>
              {formError && <p role="alert">{formError}</p>}
              <div className="news-actions">
                <button className="btn primary" type="submit">
                  <Check size={16} />
                  保存发布
                </button>
                <button
                  className="btn secondary"
                  type="button"
                  onClick={() => setEditing(null)}
                >
                  <X size={16} />
                  取消
                </button>
              </div>
            </fieldset>
          </form>
        </>
      ) : article ? (
        <>
          <div className="news-reader-tools">
            <button className="text-btn" onClick={() => setSelected("")}>
              <ArrowLeft size={16} />
              全部新闻
            </button>
            {admin && (
              <div className="news-actions">
                <button
                  className="icon-btn"
                  title="编辑新闻"
                  aria-label="编辑新闻"
                  disabled={busy}
                  onClick={() => edit(article)}
                >
                  <Pencil size={17} />
                </button>
                {saved && (
                  <button
                    className="icon-btn danger"
                    title={restoreLabel || "删除新闻"}
                    aria-label={restoreLabel || "删除新闻"}
                    disabled={busy}
                    onClick={async () => {
                      if (
                        confirm(
                          restoreLabel
                            ? `${restoreLabel}？`
                            : "删除这篇新闻？",
                        )
                      ) {
                        if (
                          await onSave({ type: "news.delete", id: article.id })
                        )
                          setSelected("");
                      }
                    }}
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
            )}
          </div>
          <article className={`news-reader${structured?.article.id === "s1-final" ? " news-season-final" : ""}`}>
            <header className="news-article-heading">
              {structured?.article.id === "s1-final" && (
                <div className="news-final-masthead">
                  <img src={leagueLogo} alt="G超联赛" width={52} height={52} />
                  <span>G SUPER LEAGUE<small>SEASON 01 / FINAL EDITION</small></span>
                  <b>2026.11.02 — 11.14</b>
                </div>
              )}
              <div className="news-meta">
                <span>{newsSeasonLabel(article)}</span>
                <time dateTime={article.publishedAt}>
                  <CalendarDays size={13} />
                  {dateLabel(article.publishedAt)}
                </time>
              </div>
              <h1>{article.title}</h1>
              {article.summary && (
                <p className="news-deck">{article.summary}</p>
              )}
            </header>
            {selectedPromo && <SeasonTrailers season={selectedPromo.id} withHeading={false} />}
            {structured ? (
              <>
                {structured.numbers && (
                  <dl className="news-season-numbers" aria-label="赛季总览">
                    {structured.numbers.map((number) => (
                      <div key={number.label}><dt>{number.label}</dt><dd>{number.value}</dd></div>
                    ))}
                  </dl>
                )}
                <p className="news-paragraph">
                  {article.body.split("\n\n")[0]}
                </p>
                {structured.rookies && (
                  <section className="news-rookies">
                    <header>
                      <span className="news-section-kicker">NEW FACES / SEASON 01</span>
                      <h2><UsersRound size={20} />新面孔，第一份赛季履历</h2>
                      <p>Beta 无完赛、第一赛季首次出场的四位球员。陈渔在 Beta 已出场两次，不列入本栏。</p>
                    </header>
                    <div className="news-rookie-grid">
                      {structured.rookies.map((rookie, i) => (
                        <article className="news-rookie" key={rookie.name}>
                          <span className="news-rookie-number">{String(i + 1).padStart(2, "0")}</span>
                          <div className="news-rookie-meta"><h3>{rookie.name}</h3><time>{rookie.debut}</time></div>
                          <b className="news-rookie-record">{rookie.record}</b>
                          <h4>{rookie.title}</h4>
                          <p>{rookie.body}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
                <section className="news-podium">
                  <h2>
                    <Trophy size={19} />
                    {structured.seasonLabel || "beta赛季终榜"} TOP 3
                  </h2>
                  <div className="news-podium-stories">
                    {structured.rankingStories.map((story, i) => {
                      const p = structured.top3[i];
                      return (
                        <article
                          className={`news-profile news-profile-${i + 1}`}
                          key={p.player.id}
                          aria-labelledby={`news-profile-${p.player.id}`}
                        >
                          <header className="news-profile-heading">
                            <div className="news-profile-meta">
                              <span className="news-profile-rank">
                                TOP {i + 1}
                              </span>
                              <span className="news-profile-season">
                                {structured.seasonLabel || "beta赛季终榜"}
                              </span>
                            </div>
                            <div className="news-profile-identity">
                              <div>
                                {story.distinction && <p className="news-profile-distinction">{story.distinction}</p>}
                                <h3
                                  id={`news-profile-${p.player.id}`}
                                  className="news-profile-name"
                                >
                                  {story.byline ? (
                                    <>
                                      {story.byline.surname}{" "}
                                      <strong>"{story.byline.nickname}"</strong>{" "}
                                      {story.byline.givenName}
                                    </>
                                  ) : (
                                    p.player.name
                                  )}
                                </h3>
                                <p className="news-profile-verse">
                                  <span>{p.player.name}</span>
                                  <b>{story.verse}</b>
                                </p>
                              </div>
                              {story.facts && (
                                <div className="news-profile-score">
                                  <Trophy size={24} aria-hidden="true" />
                                  <span>终榜段位分</span>
                                  <strong>{p.rankPoints.overall}</strong>
                                  <small>{rankTier(p.rankPoints.overall).name}</small>
                                </div>
                              )}
                            </div>
                          </header>
                          {story.facts && (
                            <dl className="news-profile-facts">
                              {story.facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
                            </dl>
                          )}
                          <div className="news-profile-copy">
                            {story.body
                              .split("\n\n")
                              .map((paragraph, index) => (
                                <p className="news-paragraph" key={index}>
                                  {paragraph}
                                </p>
                              ))}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
                <p className="news-coverage">
                  赛季档案：{structured.finished} 场完赛，其中{" "}
                  {structured.detailed}{" "}
                  场有逐球记录。乌龙场均、逆转与被逆转仅使用逐球完赛样本。
                  {structured.methodology && <span>{structured.methodology}</span>}
                </p>
                {structured.recordBook && (
                  <section className="news-record-book" aria-labelledby="news-record-title">
                    <header>
                      <span className="news-section-kicker">THE RECORD BOOK / SEASON 01</span>
                      <h2 id="news-record-title"><Trophy size={20} />赛季纪录册</h2>
                    </header>
                    <div className="news-record-grid">
                      {structured.recordBook.entries.map(entry => (
                        <article className="news-record" key={entry.label}>
                          <span>{entry.label}</span>
                          <strong>{entry.value}<small>分</small></strong>
                          <b>{entry.name}</b>
                          <p>{entry.note}</p>
                          {onMatch && <button className="text-btn" onClick={() => onMatch(entry.matchId)} aria-label={`查看纪录比赛：${entry.label}`} title="查看纪录比赛"><ArrowUpRight size={17} /></button>}
                        </article>
                      ))}
                    </div>
                    <h3 className="news-leaders-title"><CalendarDays size={18} />榜首的十三天</h3>
                    <div className="news-leader-totals">
                      {[...new Set(structured.recordBook.days.map(d => d.name))].map(name => (
                        <span key={name}>{name}<b>{structured.recordBook!.days.filter(d => d.name === name).length}<small>天</small></b></span>
                      ))}
                    </div>
                    <ol className="news-leader-days" aria-label="每日收盘榜首">
                      {structured.recordBook.days.map(day => (
                        <li key={day.date} data-leader={day.name}>
                          <time dateTime={day.date}>{day.date.slice(5).replace("-", ".")}</time>
                          <b>{day.name}</b><span>{day.points} 分</span>
                        </li>
                      ))}
                    </ol>
                    <p className="news-evidence">{structured.recordBook.note}</p>
                  </section>
                )}
                <div className="news-awards">
                  {structured.awards.map((award, index) => (
                    <Fragment key={award.id}>
                    {award.category && award.category !== structured.awards[index - 1]?.category && <h2 className="news-award-group"><Award size={20} />{award.category}</h2>}
                    <section className="news-award" key={award.id}>
                      <div className="news-award-label">
                        <Award size={21} />
                        <span>
                          {award.title}
                          <small>{award.subtitle}</small>
                        </span>
                      </div>
                      <div className="news-award-story">
                        <h2>{award.winner}</h2>
                        <p>{award.story}</p>
                        <small className="news-evidence">
                          {award.evidence}
                        </small>
                        {onMatch && award.matchIds.length > 0 && (
                          <details className="news-evidence-matches">
                            <summary>
                              相关比赛 · {award.matchIds.length} 场
                            </summary>
                            <div>
                              {award.matchIds.map((id) => {
                                const match = league.matches.find(
                                  (m) => m.id === id,
                                );
                                return (
                                  <button
                                    className="text-btn"
                                    key={id}
                                    onClick={() => onMatch(id)}
                                  >
                                    {match
                                      ? `${dateLabel(match.time)} · ${match.round}`
                                      : "查看比赛"}
                                    <ArrowUpRight size={13} />
                                  </button>
                                );
                              })}
                            </div>
                          </details>
                        )}
                      </div>
                    </section>
                    </Fragment>
                  ))}
                </div>
                {structured.highlights.length > 0 && (
                  <section className="news-highlights">
                    <h2>
                      <Flame size={19} />
                      单场高光
                    </h2>
                    {structured.highlights.map((highlight, index) => (
                      <section
                        className="news-highlight"
                        key={highlight.id}
                        data-highlight={highlight.id}
                      >
                        <div className="news-highlight-meta">
                          <span>高光 {String(index + 1).padStart(2, "0")}</span>
                          <time dateTime={highlight.time}>
                            {new Date(highlight.time).toLocaleString("zh-CN", {
                              timeZone: "Asia/Shanghai",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })}
                          </time>
                          {onMatch && (
                            <button
                              className="text-btn"
                              aria-label={`查看比赛：${highlight.home}对${highlight.away}`}
                              onClick={() => onMatch(highlight.matchId)}
                            >
                              查看比赛
                              <ArrowUpRight size={14} />
                            </button>
                          )}
                        </div>
                        <h3>{highlight.title}</h3>
                        <div className="news-highlight-match">
                          <span>{highlight.home}</span>
                          <b>
                            {highlight.homeScore}:{highlight.awayScore}
                          </b>
                          <span>{highlight.away}</span>
                        </div>
                        <ol
                          className="news-score-moments"
                          aria-label="关键比分"
                        >
                          {highlight.moments.map((moment, i) => (
                            <li key={i}>
                              <b>{moment.score}</b>
                              <span>{moment.label}</span>
                            </li>
                          ))}
                        </ol>
                        {highlight.paragraphs.map((paragraph, i) => (
                          <p className="news-paragraph" key={i}>
                            {paragraph}
                          </p>
                        ))}
                      </section>
                    ))}
                  </section>
                )}
                {structured.titleEdition && (
                  <section className="news-titles" aria-labelledby="news-titles-heading">
                    <header>
                      <span className="news-section-kicker">SEASON 01 / THE FINAL TITLES</span>
                      <h2 id="news-titles-heading"><Medal size={22} />{structured.titleEdition.label}</h2>
                      <p>{structured.titleEdition.note}</p>
                    </header>
                    <div className="news-title-grid">
                      {structured.titleEdition.players.map((player, index) => (
                        <article className="news-player-title" key={player.playerId}>
                          <div className="news-title-meta"><span>{String(index + 1).padStart(2, "0")} / S1</span><b>{player.name}</b></div>
                          <h3>{player.title}</h3>
                          <dl>
                            {player.facts.map(fact => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}
                          </dl>
                          <p>{player.reason}</p>
                        </article>
                      ))}
                    </div>
                  </section>
                )}
                <section className="news-next-season">
                  <h2>{structured.closingTitle || "第一赛季，重新开场"}</h2>
                  <p>{article.body.split("\n\n").at(-1)}</p>
                </section>
              </>
            ) : (
              <div className="news-body">
                {article.body.split(/\n\s*\n/).map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            )}
          </article>
        </>
      ) : (
        <>
          <header className="page-heading">
            <div>
              <span className="eyebrow">G SUPER LEAGUE / NEWSROOM</span>
              <h1>联赛新闻</h1>
            </div>
            {admin && (
              <button className="btn primary" onClick={() => edit()}>
                <Plus size={16} />
                发布新闻
              </button>
            )}
          </header>
          <div className="news-toolbar">
            <label className="searchbox">
              <Search size={16} />
              <input
                aria-label="搜索新闻"
                placeholder="搜索新闻"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select
              aria-label="新闻赛季"
              value={season}
              onChange={(event) => setSeason(event.target.value)}
            >
              <option value="all">全部赛季</option>
              {SEASONS.map((s) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <span>{visible.length} 篇新闻</span>
          </div>
          <div className="news-list">
            {visible.map((a) => (
              <button
                className="news-list-item"
                key={a.id}
                onClick={() => setSelected(a.id)}
              >
                <div className="news-list-date">
                  <time dateTime={a.publishedAt}>
                    {dateLabel(a.publishedAt)}
                  </time>
                  <span>{newsSeasonLabel(a)}</span>
                </div>
                <div>
                  <h2>{a.title}</h2>
                  <p>{a.summary}</p>
                </div>
                <ChevronRight size={19} />
              </button>
            ))}
          </div>
          {!visible.length && (
            <div className="news-empty">
              <Newspaper size={30} />
              <p>{articles.length ? "没有符合条件的新闻" : "暂无新闻"}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
