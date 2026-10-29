import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Download,
  LayoutDashboard,
  Loader2,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Trophy,
  Undo2,
  Upload,
  UserRound,
  Users,
} from "lucide-react";
import { Modal } from "./App";
import { RankLegend, RankScore } from "./RankScore";
import {
  analyzeSingles,
  emptySinglesLeague,
  singlesScore,
  singlesStandings,
} from "../lib/singles";
import type {
  SinglesAction,
  SinglesLeague,
  SinglesMatch,
  SinglesPlayer,
  SinglesStats,
} from "../lib/singles";
import {
  clearSinglesAdmin,
  loginSinglesAdmin,
  singlesPhotoUrl,
  singlesRequest,
  singlesToken,
} from "./api";

const navigation = [
  { id: "overview", label: "赛事总览", icon: LayoutDashboard },
  { id: "matches", label: "赛程与比分", icon: CalendarDays },
  { id: "rankings", label: "个人排行榜", icon: Trophy },
  { id: "players", label: "球员档案", icon: Users },
  { id: "analytics", label: "赛场数据", icon: BarChart3 },
  { id: "settings", label: "单打设置", icon: Settings },
];
const dateLabel = (time: string) =>
  new Date(time).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
const dateInput = (time = new Date().toISOString()) =>
  new Date(time)
    .toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" })
    .slice(0, 16)
    .replace(" ", "T");
const signed = (n: number) => `${n > 0 ? "+" : ""}${n}`;
const percent = (n: number | null) =>
  n === null ? "—" : `${(n * 100).toFixed(0)}%`;
const resultLabel = { W: "胜", D: "平", L: "负" };
const statusLabel = { scheduled: "未开赛", live: "进行中", finished: "已完赛" };
const go = (page: string, id = "") => {
  window.location.hash = `singles/${page}${id ? `/${encodeURIComponent(id)}` : ""}`;
};
function Person({ player }: { player?: SinglesPlayer }) {
  return (
    <span className="singles-person">
      <span className="avatar">
        {player?.photo ? (
          <img src={singlesPhotoUrl(player.photo)} alt="" />
        ) : (
          <UserRound size={20} />
        )}
      </span>
      <span>
        <b>{player?.name || "未知球员"}</b>
        <small>
          {player
            ? `#${String(player.number).padStart(2, "0")} ${player.nickname}`
            : ""}
        </small>
      </span>
    </span>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="singles-empty">
      <Activity size={25} />
      <p>{children}</p>
    </div>
  );
}
function Metrics({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="singles-metrics">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function FormResults({ stats }: { stats: SinglesStats }) {
  return (
    <span className="form-results">
      {stats.history.length
        ? stats.history.slice(-10).map((h) => (
            <span
              key={h.match.id}
              className={h.result}
              title={`${dateLabel(h.match.time)} · ${h.gf}:${h.ga}`}
            >
              {resultLabel[h.result]}
            </span>
          ))
        : "—"}
    </span>
  );
}
function Ranking({
  rows,
  kind,
  limit,
}: {
  rows: SinglesStats[];
  kind: "points" | "rank";
  limit?: number;
}) {
  return (
    <div
      className={`table-wrap singles-table${limit ? " singles-table-compact" : ""}`}
    >
      <table>
        <thead>
          <tr>
            <th>排名</th>
            <th className="align-left">球员</th>
            <th>{kind === "rank" ? "段位分" : "积分"}</th>
            <th>场次</th>
            {!limit && (
              <>
                <th>胜 / 平 / 负</th>
                <th>胜率</th>
                <th>进 / 失</th>
                <th>净胜球</th>
                <th>近期表现</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {singlesStandings(rows, kind)
            .slice(0, limit)
            .map((s, i) => (
              <tr key={s.player.id}>
                <td>{i + 1}</td>
                <td>
                  <button
                    className="singles-person-link"
                    onClick={() => go("players", s.player.id)}
                  >
                    <Person player={s.player} />
                  </button>
                </td>
                <td>
                  <strong>
                    {kind === "rank" ? (
                      <RankScore points={s.rankPoints} />
                    ) : (
                      s.points
                    )}
                  </strong>
                </td>
                <td>{s.games}</td>
                {!limit && (
                  <>
                    <td>
                      {s.wins} / {s.draws} / {s.losses}
                    </td>
                    <td>{percent(s.winRate)}</td>
                    <td>
                      {s.gf} / {s.ga}
                    </td>
                    <td>{s.gd}</td>
                    <td>
                      <FormResults stats={s} />
                    </td>
                  </>
                )}
              </tr>
            ))}
        </tbody>
      </table>
      {!rows.length && <Empty>暂无单打球员</Empty>}
    </div>
  );
}
type Dialog =
  | { kind: "login" }
  | { kind: "player"; player?: SinglesPlayer }
  | { kind: "match" | "result"; match?: SinglesMatch };
type LeagueResponse = { data: SinglesLeague; revision: number };

export default function Singles({
  route,
  modeSwitch,
}: {
  route: string[];
  modeSwitch: ReactNode;
}) {
  const page = navigation.some((n) => n.id === route[0])
    ? route[0]
    : "overview";
  let selectedId = "";
  try {
    selectedId = decodeURIComponent(route[1] || "");
  } catch {}
  const [league, setLeague] = useState<SinglesLeague>(emptySinglesLeague);
  const [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(false),
    [admin, setAdmin] = useState(() => Boolean(singlesToken()));
  const [dialog, setDialog] = useState<Dialog | null>(null),
    [toast, setToast] = useState("");
  const [query, setQuery] = useState(""),
    [status, setStatus] = useState("all"),
    [ranking, setRanking] = useState<"points" | "rank">("points");
  const [month, setMonth] = useState(""),
    [minimum, setMinimum] = useState(0),
    [opponentId, setOpponentId] = useState("");
  const revision = useRef(-1),
    mounted = useRef(false),
    saving = useRef(false);
  const accept = useCallback(
    (body: { data: SinglesLeague; revision: number }) => {
      if (body.data?.mode !== "singles") throw new Error("单打数据格式不正确");
      if (mounted.current && body.revision >= revision.current) {
        revision.current = body.revision;
        setLeague(body.data);
        setLoaded(true);
        setError("");
      }
    },
    [],
  );
  const refresh = useCallback(async () => {
    try {
      accept(await singlesRequest<LeagueResponse>("/league"));
    } catch (e) {
      if (mounted.current)
        setError(e instanceof Error ? e.message : "单打数据加载失败");
    }
  }, [accept]);
  useEffect(() => {
    mounted.current = true;
    refresh();
    const timer = window.setInterval(() => {
      if (!document.hidden) refresh();
    }, 3000);
    const visible = () => {
      if (!document.hidden) refresh();
    };
    document.addEventListener("visibilitychange", visible);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  useEffect(() => {
    setQuery("");
    setStatus("all");
    setOpponentId("");
  }, [page, selectedId]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const mutate = async (action: SinglesAction) => {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    try {
      accept(
        await singlesRequest<LeagueResponse>("/league", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(action),
        }),
      );
      if (mounted.current) setToast("单打数据已保存");
      return true;
    } catch (e) {
      if (mounted.current)
        setToast(e instanceof Error ? e.message : "保存失败");
      return false;
    } finally {
      saving.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const remove = async (type: "player.delete" | "match.delete", id: string) => {
    if (
      !window.confirm(
        type === "player.delete"
          ? "确认删除这位单打球员？"
          : "确认删除这场单打比赛？积分和段位分将重新计算。",
      )
    )
      return;
    if (await mutate({ type, id }))
      go(type === "player.delete" ? "players" : "matches");
  };
  const stats = useMemo(() => analyzeSingles(league), [league]);
  // Time filters affect the displayed ranking; match details always use the full history.
  const filteredStats = useMemo(
    () =>
      analyzeSingles({
        ...league,
        matches: league.matches.filter(
          (m) =>
            !month ||
            new Date(Date.parse(m.time) + 8 * 3600000)
              .toISOString()
              .startsWith(month),
        ),
      }).filter((s) => s.games >= minimum),
    [league, month, minimum],
  );
  const player = (id: string) => league.players.find((p) => p.id === id);
  const live = league.matches.filter((m) => m.status === "live");
  const recent = [...league.matches].sort(
    (a, b) => Date.parse(b.time) - Date.parse(a.time),
  );
  const current = league.matches.find((m) => m.id === selectedId);
  const profile = stats.find((s) => s.player.id === selectedId);
  const heading = navigation.find((n) => n.id === page)!.label;
  const matchCard = (m: SinglesMatch) => (
    <button
      key={m.id}
      className="singles-match"
      onClick={() => go("matches", m.id)}
    >
      <span className="singles-match-meta">
        <span>
          {m.round} · {dateLabel(m.time)}
        </span>
        <span className={`status ${m.status}`}>{statusLabel[m.status]}</span>
      </span>
      <span className="singles-versus">
        <Person player={player(m.homeId)} />
        <strong>
          {m.status === "scheduled" ? "VS" : singlesScore(m).join(" : ")}
        </strong>
        <Person player={player(m.awayId)} />
      </span>
    </button>
  );
  const newMatch = (kind: "match" | "result") => setDialog({ kind });
  const matchActions = admin && (
    <div className="singles-actions">
      <button
        className="btn primary"
        disabled={league.players.length < 2}
        onClick={() => newMatch("match")}
      >
        <Plus size={16} />
        新建比赛
      </button>
      <button
        className="btn secondary"
        disabled={league.players.length < 2}
        onClick={() => newMatch("result")}
      >
        <Pencil size={16} />
        录入比分
      </button>
    </div>
  );
  const filters = (
    <div className="singles-actions">
      <label>
        月份
        <input
          type="month"
          aria-label="统计月份"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </label>
      <label>
        最少出场
        <input
          type="number"
          aria-label="最少出场"
          min={0}
          max={5000}
          value={minimum}
          onChange={(e) => setMinimum(Math.max(0, Number(e.target.value)))}
        />
      </label>
      {month && (
        <button className="text-btn" onClick={() => setMonth("")}>
          全部月份
        </button>
      )}
    </div>
  );
  const download = () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { mode: "singles", league, exportedAt: new Date().toISOString() },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `G超联赛-单打-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="app-shell singles-shell">
      <aside className="sidebar">
        <a className="brand" href="#singles">
          <span className="brand-g">G</span>
          <span>
            <b>G超联赛</b>
            <small>TABLE FOOTBALL LEAGUE</small>
          </span>
        </a>
        {modeSwitch}
        <div className="side-label">单打赛事</div>
        <nav aria-label="单打导航">
          {navigation.map((n) => (
            <a
              href={`#singles/${n.id}`}
              key={n.id}
              className={`nav-item ${page === n.id ? "active" : ""}`}
              aria-current={page === n.id ? "page" : undefined}
            >
              <n.icon size={18} />
              <span>{n.label}</span>
              {n.id === "matches" && live.length > 0 && (
                <b className="nav-count">{live.length}</b>
              )}
            </a>
          ))}
        </nav>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            单打赛事
            <ChevronRight size={13} />
            <span>{heading}</span>
          </div>
          <div className="top-actions">
            <span className={`sync ${error ? "offline" : ""}`}>
              <i />
              {error ? "连接中断" : loaded ? "实时同步" : "正在连接"}
            </span>
            <button
              className="text-btn"
              onClick={() => {
                if (admin) {
                  clearSinglesAdmin();
                  setAdmin(false);
                } else setDialog({ kind: "login" });
              }}
            >
              {admin ? "退出单打管理" : "单打管理员登录"}
            </button>
          </div>
        </header>
        <main>
          {!loaded ? (
            <div className="loading-state">
              {error ? (
                <>
                  <Activity />
                  <h2>{error}</h2>
                  <button className="btn secondary" onClick={refresh}>
                    <RefreshCw size={16} />
                    重试
                  </button>
                </>
              ) : (
                <>
                  <Loader2 className="spin" />
                  <h2>正在加载单打赛事</h2>
                </>
              )}
            </div>
          ) : (
            <>
              {error && (
                <div className="notice" role="alert">
                  {error}
                  <button onClick={refresh}>
                    <RefreshCw size={16} />
                    重试
                  </button>
                </div>
              )}
              <header className="page-heading">
                <div>
                  <span className="eyebrow">G SUPER LEAGUE / SINGLES</span>
                  <h1>
                    {page === "players" && profile
                      ? profile.player.name
                      : page === "matches" && current
                        ? "单打比赛"
                        : `单打${heading.replace(/^单打/, "")}`}
                  </h1>
                  <p>{league.settings.season}</p>
                </div>
                {(page === "overview" || page === "matches") &&
                  !selectedId &&
                  matchActions}
                {page === "players" && !selectedId && admin && (
                  <button
                    className="btn primary"
                    onClick={() => setDialog({ kind: "player" })}
                  >
                    <Plus size={16} />
                    登记球员
                  </button>
                )}
              </header>
              {page === "overview" && (
                <>
                  <Metrics
                    items={[
                      ["参赛球员", league.players.length],
                      [
                        "已完赛",
                        league.matches.filter((m) => m.status === "finished")
                          .length,
                      ],
                      ["进行中", live.length],
                      [
                        "总进球",
                        league.matches
                          .filter((m) => m.status !== "scheduled")
                          .reduce(
                            (n, m) =>
                              n + singlesScore(m)[0] + singlesScore(m)[1],
                            0,
                          ),
                      ],
                    ]}
                  />
                  {!league.players.length && (
                    <section className="singles-section">
                      <Empty>暂无单打球员</Empty>
                      {admin && (
                        <button
                          className="btn primary"
                          onClick={() => setDialog({ kind: "player" })}
                        >
                          <Plus size={16} />
                          登记第一位单打球员
                        </button>
                      )}
                    </section>
                  )}
                  {live.length > 0 && (
                    <section className="singles-section">
                      <h2>正在进行</h2>
                      <div className="singles-match-grid">
                        {live.map(matchCard)}
                      </div>
                    </section>
                  )}
                  <div className="singles-columns">
                    <section className="singles-section">
                      <div className="singles-section-heading">
                        <h2>最近赛果</h2>
                        <button
                          className="text-btn"
                          onClick={() => go("matches")}
                        >
                          全部比赛
                          <ChevronRight size={15} />
                        </button>
                      </div>
                      <div className="singles-match-list">
                        {recent
                          .filter((m) => m.status === "finished")
                          .slice(0, 4)
                          .map(matchCard)}
                      </div>
                      {!recent.some((m) => m.status === "finished") && (
                        <Empty>暂无已完赛比赛</Empty>
                      )}
                    </section>
                    <section className="singles-section">
                      <div className="singles-section-heading">
                        <h2>单打段位分榜</h2>
                        <button
                          className="text-btn"
                          onClick={() => {
                            setRanking("rank");
                            go("rankings");
                          }}
                        >
                          完整排名
                          <ChevronRight size={15} />
                        </button>
                      </div>
                      <Ranking
                        rows={stats.filter((s) => s.games)}
                        kind="rank"
                        limit={5}
                      />
                    </section>
                  </div>
                  <section className="singles-section">
                    <h2>即将开始</h2>
                    <div className="singles-match-grid">
                      {recent
                        .filter((m) => m.status === "scheduled")
                        .reverse()
                        .slice(0, 4)
                        .map(matchCard)}
                    </div>
                    {!recent.some((m) => m.status === "scheduled") && (
                      <Empty>暂无待赛比赛</Empty>
                    )}
                  </section>
                </>
              )}
              {page === "matches" && !selectedId && (
                <>
                  <div className="singles-toolbar">
                    <div className="data-segments">
                      {[
                        ["all", "全部"],
                        ["scheduled", "未开赛"],
                        ["live", "进行中"],
                        ["finished", "已完赛"],
                      ].map(([key, label]) => (
                        <button
                          key={key}
                          aria-pressed={status === key}
                          className={status === key ? "active" : ""}
                          onClick={() => setStatus(key)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <label className="searchbox">
                      <Search size={16} />
                      <input
                        aria-label="搜索比赛"
                        placeholder="球员或轮次"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                  </div>
                  <div className="singles-match-grid">
                    {recent
                      .filter(
                        (m) =>
                          (status === "all" || m.status === status) &&
                          `${player(m.homeId)?.name} ${player(m.awayId)?.name} ${m.round}`.includes(
                            query,
                          ),
                      )
                      .map(matchCard)}
                  </div>
                  {!recent.some(
                    (m) =>
                      (status === "all" || m.status === status) &&
                      `${player(m.homeId)?.name} ${player(m.awayId)?.name} ${m.round}`.includes(
                        query,
                      ),
                  ) && <Empty>没有符合条件的比赛</Empty>}
                </>
              )}
              {page === "matches" &&
                selectedId &&
                (current ? (
                  <MatchDetail
                    match={current}
                    league={league}
                    stats={stats}
                    admin={admin}
                    busy={busy}
                    mutate={mutate}
                    onEdit={(kind) => setDialog({ kind, match: current })}
                    onDelete={() => remove("match.delete", current.id)}
                  />
                ) : (
                  <Empty>这场单打比赛不存在或已删除</Empty>
                ))}
              {page === "rankings" && (
                <>
                  <div className="singles-toolbar">
                    <div className="data-segments">
                      {(["points", "rank"] as const).map((key) => (
                        <button
                          key={key}
                          aria-pressed={ranking === key}
                          className={ranking === key ? "active" : ""}
                          onClick={() => setRanking(key)}
                        >
                          {key === "rank" ? "段位分实力榜" : "个人积分榜"}
                        </button>
                      ))}
                    </div>
                    {filters}
                  </div>
                  <Ranking rows={filteredStats} kind={ranking} />
                  <p className="singles-caption">
                    {month
                      ? "当前月份内的赛果从初始 1200 重新计算段位分。"
                      : "段位分初始 1200，黄金及以下有更高成长收益；钻石及以上基础胜负对称。实际按对手强弱、追赶修正和净胜球倍率结算。"}
                    积分同分依次比较净胜球、进球数。
                  </p>
                  {ranking === "rank" && <RankLegend />}
                </>
              )}
              {page === "players" && !selectedId && (
                <>
                  <div className="singles-toolbar">
                    <label className="searchbox">
                      <Search size={16} />
                      <input
                        aria-label="搜索球员"
                        placeholder="姓名或昵称"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </label>
                    <span>{league.players.length} 位单打球员</span>
                  </div>
                  <div className="singles-players">
                    {stats
                      .filter((s) =>
                        `${s.player.name} ${s.player.nickname}`.includes(query),
                      )
                      .map((s) => (
                        <button
                          className="singles-player"
                          key={s.player.id}
                          onClick={() => go("players", s.player.id)}
                        >
                          <Person player={s.player} />
                          <dl>
                            <div>
                              <dt>段位分</dt>
                              <dd>
                                <RankScore points={s.rankPoints} />
                              </dd>
                            </div>
                            <div>
                              <dt>场次</dt>
                              <dd>{s.games}</dd>
                            </div>
                            <div>
                              <dt>胜率</dt>
                              <dd>{percent(s.winRate)}</dd>
                            </div>
                          </dl>
                          <FormResults stats={s} />
                        </button>
                      ))}
                  </div>
                  {!stats.some((s) =>
                    `${s.player.name} ${s.player.nickname}`.includes(query),
                  ) && <Empty>没有符合条件的单打球员</Empty>}
                </>
              )}
              {page === "players" &&
                selectedId &&
                (profile ? (
                  <>
                    <div className="singles-toolbar">
                      <button
                        className="text-btn"
                        onClick={() => go("players")}
                      >
                        <ArrowLeft size={16} />
                        返回球员档案
                      </button>
                      {admin && (
                        <div className="singles-actions">
                          <button
                            className="btn secondary"
                            onClick={() =>
                              setDialog({
                                kind: "player",
                                player: profile.player,
                              })
                            }
                          >
                            <Pencil size={16} />
                            编辑资料
                          </button>
                          <button
                            className="icon-btn"
                            title="删除球员"
                            aria-label="删除球员"
                            disabled={
                              busy ||
                              league.matches.some(
                                (m) =>
                                  m.homeId === selectedId ||
                                  m.awayId === selectedId,
                              )
                            }
                            onClick={() => remove("player.delete", selectedId)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="singles-profile-identity">
                      <Person player={profile.player} />
                      <p>{profile.player.bio}</p>
                    </div>
                    <Metrics
                      items={[
                        [
                          "单打段位分",
                          <RankScore points={profile.rankPoints} showTier />,
                        ],
                        ["积分", profile.points],
                        ["胜率", percent(profile.winRate)],
                        [
                          "胜 / 平 / 负",
                          `${profile.wins} / ${profile.draws} / ${profile.losses}`,
                        ],
                      ]}
                    />
                    <div className="singles-columns">
                      <section className="singles-section">
                        <h2>赛场表现</h2>
                        <Metrics
                          items={[
                            [
                              "场均进球",
                              profile.games
                                ? (profile.gf / profile.games).toFixed(1)
                                : "—",
                            ],
                            [
                              "场均失球",
                              profile.games
                                ? (profile.ga / profile.games).toFixed(1)
                                : "—",
                            ],
                            ["净胜球", profile.gd],
                            ["最长连胜", profile.bestStreak],
                          ]}
                        />
                        <h3>最近 10 场</h3>
                        <FormResults stats={profile} />
                        {profile.games > 0 && profile.games < 3 && (
                          <p className="singles-caption">小样本 · 不足 3 场</p>
                        )}
                      </section>
                      <section className="singles-section">
                        <h2>段位分变化</h2>
                        <div className="singles-rating-history">
                          {profile.history
                            .slice(-10)
                            .reverse()
                            .map((h) => (
                              <button
                                key={h.match.id}
                                onClick={() => go("matches", h.match.id)}
                              >
                                <span>
                                  {dateLabel(h.match.time)} · 对阵{" "}
                                  {player(h.opponentId)?.name}
                                </span>
                                <b>
                                  <RankScore points={h.after} />
                                </b>
                                <span
                                  className={
                                    h.delta >= 0 ? "positive" : "negative"
                                  }
                                >
                                  {signed(h.delta)}
                                </span>
                              </button>
                            ))}
                        </div>
                        {!profile.games && <Empty>暂无单打比赛记录</Empty>}
                      </section>
                    </div>
                    <section className="singles-section">
                      <div className="singles-section-heading">
                        <h2>历史交手与比赛</h2>
                        <label>
                          对手
                          <select
                            aria-label="历史交手对手"
                            value={opponentId}
                            onChange={(e) => setOpponentId(e.target.value)}
                          >
                            <option value="">全部对手</option>
                            {league.players
                              .filter((p) => p.id !== selectedId)
                              .map((p) => (
                                <option value={p.id} key={p.id}>
                                  {p.name}
                                </option>
                              ))}
                          </select>
                        </label>
                      </div>
                      {opponentId && (
                        <Metrics
                          items={[
                            [
                              "交手场次",
                              profile.history.filter(
                                (h) => h.opponentId === opponentId,
                              ).length,
                            ],
                            [
                              "胜 / 平 / 负",
                              (["W", "D", "L"] as const)
                                .map(
                                  (r) =>
                                    profile.history.filter(
                                      (h) =>
                                        h.opponentId === opponentId &&
                                        h.result === r,
                                    ).length,
                                )
                                .join(" / "),
                            ],
                          ]}
                        />
                      )}
                      <div className="singles-match-grid">
                        {recent
                          .filter(
                            (m) =>
                              [m.homeId, m.awayId].includes(selectedId) &&
                              (!opponentId ||
                                [m.homeId, m.awayId].includes(opponentId)),
                          )
                          .map(matchCard)}
                      </div>
                    </section>
                  </>
                ) : (
                  <Empty>这位单打球员不存在或已删除</Empty>
                ))}
              {page === "analytics" && (
                <>
                  <div className="singles-toolbar">{filters}</div>
                  <div className="table-wrap singles-table">
                    <table>
                      <thead>
                        <tr>
                          <th className="align-left">球员</th>
                          <th>场次</th>
                          <th>胜率</th>
                          <th>场均进球</th>
                          <th>场均失球</th>
                          <th>净胜球</th>
                          <th>最长连胜</th>
                          <th>乌龙球</th>
                        </tr>
                      </thead>
                      <tbody>
                        {singlesStandings(filteredStats, "rank").map((s) => (
                          <tr key={s.player.id}>
                            <td>
                              <button
                                className="singles-person-link"
                                onClick={() => go("players", s.player.id)}
                              >
                                <Person player={s.player} />
                              </button>
                            </td>
                            <td>{s.games}</td>
                            <td>{percent(s.winRate)}</td>
                            <td>
                              {s.games ? (s.gf / s.games).toFixed(1) : "—"}
                            </td>
                            <td>
                              {s.games ? (s.ga / s.games).toFixed(1) : "—"}
                            </td>
                            <td>{s.gd}</td>
                            <td>{s.bestStreak}</td>
                            <td>{s.ownGoals}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!filteredStats.length && <Empty>暂无符合条件的数据</Empty>}
                  </div>
                  <p className="singles-caption">
                    战绩与得失分仅计已完赛比赛；乌龙球仅计进行中及已完赛的明确逐球事件，汇总比分不推算乌龙球。
                  </p>
                </>
              )}
              {page === "settings" && (
                <div className="singles-columns">
                  <section className="singles-section">
                    <h2>赛季与积分规则</h2>
                    <form
                      className="entity-form"
                      key={JSON.stringify(league.settings)}
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        await mutate({
                          type: "settings.save",
                          id: "settings",
                          data: {
                            season: f.get("season"),
                            win: Number(f.get("win")),
                            draw: Number(f.get("draw")),
                            loss: Number(f.get("loss")),
                          },
                        });
                      }}
                    >
                      <fieldset disabled={!admin || busy}>
                        <label>
                          赛季名称
                          <input
                            name="season"
                            required
                            maxLength={30}
                            defaultValue={league.settings.season}
                          />
                        </label>
                        <div className="form-grid three">
                          {(
                            [
                              ["win", "获胜积分"],
                              ["draw", "平局积分"],
                              ["loss", "失利积分"],
                            ] as const
                          ).map(([key, label]) => (
                            <label key={key}>
                              {label}
                              <input
                                name={key}
                                type="number"
                                required
                                min={0}
                                max={10}
                                defaultValue={league.settings[key]}
                              />
                            </label>
                          ))}
                        </div>
                        <button className="btn primary">
                          <Check size={16} />
                          保存规则
                        </button>
                      </fieldset>
                    </form>
                    <p className="singles-caption">
                      赛季名称仅作标签；修改积分规则会重新计算现有单打比赛。
                    </p>
                  </section>
                  <section className="singles-section">
                    <h2>单打数据快照</h2>
                    <button className="btn secondary" onClick={download}>
                      <Download size={16} />
                      导出单打数据
                    </button>
                    <p className="singles-caption">
                      包含单打球员、比赛和设置；头像以链接保存。
                    </p>
                  </section>
                </div>
              )}
              <footer className="footer">
                <span>
                  <b>G超联赛</b> · 单打赛事
                </span>
                <span>
                  {league.players.length} 位球员 · {league.matches.length}{" "}
                  场比赛
                </span>
              </footer>
            </>
          )}
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
      {dialog && (
        <Modal
          title={
            dialog.kind === "login"
              ? "单打管理员登录"
              : dialog.kind === "player"
                ? dialog.player
                  ? "编辑单打球员"
                  : "登记单打球员"
                : dialog.kind === "result"
                  ? "录入单打比分"
                  : dialog.match
                    ? "编辑单打赛程"
                    : "新建单打比赛"
          }
          onClose={() => {
            if (!busy) setDialog(null);
          }}
        >
          {dialog.kind === "login" ? (
            <LoginForm
              onLogin={() => {
                setAdmin(true);
                setDialog(null);
              }}
            />
          ) : dialog.kind === "player" ? (
            <PlayerForm
              initial={dialog.player}
              players={league.players}
              onSave={async (data) => {
                if (
                  await mutate({
                    type: "player.save",
                    id: dialog.player?.id || crypto.randomUUID(),
                    data,
                  })
                )
                  setDialog(null);
              }}
            />
          ) : (
            <MatchForm
              initial={dialog.match}
              result={dialog.kind === "result"}
              players={league.players}
              busy={busy}
              onSave={async (data) => {
                const id = dialog.match?.id || crypto.randomUUID();
                if (
                  await mutate({
                    type:
                      dialog.kind === "result" ? "match.result" : "match.save",
                    id,
                    data,
                  })
                ) {
                  setDialog(null);
                  go("matches", id);
                }
              }}
            />
          )}
        </Modal>
      )}
    </div>
  );
}

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="entity-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        try {
          await loginSinglesAdmin(String(f.get("token")));
          onLogin();
        } catch (e) {
          setError(e instanceof Error ? e.message : "登录失败");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label>
        管理密钥
        <input
          name="token"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      {error && <p role="alert">{error}</p>}
      <button className="btn primary" disabled={busy}>
        {busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />}
        登录
      </button>
    </form>
  );
}
function PlayerForm({
  initial,
  players,
  onSave,
}: {
  initial?: SinglesPlayer;
  players: SinglesPlayer[];
  onSave: (data: unknown) => Promise<void>;
}) {
  const [photo, setPhoto] = useState(initial?.photo || ""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const freeNumber = Array.from({ length: 100 }, (_, i) => i).find(
    (n) => !players.some((p) => p.number === n),
  );
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const image = await createImageBitmap(file);
      const canvas = document.createElement("canvas"),
        scale = Math.min(1, 512 / Math.max(image.width, image.height));
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      canvas
        .getContext("2d")!
        .drawImage(image, 0, 0, canvas.width, canvas.height);
      image.close();
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("图片处理失败"))),
          "image/jpeg",
          0.85,
        ),
      );
      const body = await singlesRequest<{ url: string }>("/photos", {
        method: "POST",
        body: blob,
      });
      setPhoto(body.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "头像上传失败");
    } finally {
      setBusy(false);
    }
  };
  return (
    <form
      className="entity-form"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const f = new FormData(e.currentTarget);
        try {
          await onSave({
            name: f.get("name"),
            nickname: f.get("nickname"),
            number: Number(f.get("number")),
            bio: f.get("bio"),
            photo,
          });
        } finally {
          setBusy(false);
        }
      }}
    >
      <fieldset disabled={busy}>
        <div className="singles-photo-editor">
          {photo && <img src={singlesPhotoUrl(photo)} alt="球员头像" />}
          <label className="btn secondary">
            <Upload size={16} />
            上传头像
            <input
              className="singles-file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </label>
          {photo && (
            <button
              type="button"
              className="icon-btn"
              title="移除头像"
              aria-label="移除头像"
              onClick={() => setPhoto("")}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
        <div className="form-grid">
          <label>
            姓名
            <input
              name="name"
              required
              maxLength={30}
              defaultValue={initial?.name}
            />
          </label>
          <label>
            昵称
            <input
              name="nickname"
              maxLength={30}
              defaultValue={initial?.nickname}
            />
          </label>
        </div>
        <label>
          号码
          <input
            name="number"
            type="number"
            min={0}
            max={99}
            required
            defaultValue={initial?.number ?? freeNumber}
          />
        </label>
        <label>
          球员介绍
          <textarea name="bio" maxLength={500} defaultValue={initial?.bio} />
        </label>
        {error && <p role="alert">{error}</p>}
        <button className="btn primary">
          <Check size={16} />
          {busy ? "保存中" : "保存球员"}
        </button>
      </fieldset>
    </form>
  );
}
function MatchForm({
  initial,
  result,
  players,
  busy,
  onSave,
}: {
  initial?: SinglesMatch;
  result: boolean;
  players: SinglesPlayer[];
  busy: boolean;
  onSave: (data: unknown) => Promise<void>;
}) {
  const [home, setHome] = useState(initial?.homeId || players[0]?.id || ""),
    [away, setAway] = useState(initial?.awayId || players[1]?.id || "");
  const [a, b] = initial ? singlesScore(initial) : [0, 0];
  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      startNow =
        (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
        "start";
    await onSave({
      homeId: home,
      awayId: away,
      time: new Date(`${f.get("time")}:00+08:00`).toISOString(),
      round: f.get("round"),
      homeScore: Number(f.get("homeScore")),
      awayScore: Number(f.get("awayScore")),
      replaceDetailed: f.get("replaceDetailed") === "on",
      startNow,
    });
  };
  return (
    <form className="entity-form" onSubmit={submit}>
      <fieldset disabled={busy}>
        <div className="form-grid">
          <label>
            球员 A
            <select
              aria-label="球员 A"
              required
              disabled={Boolean(initial)}
              value={home}
              onChange={(e) => setHome(e.target.value)}
            >
              {players.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === away}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            球员 B
            <select
              aria-label="球员 B"
              required
              disabled={Boolean(initial)}
              value={away}
              onChange={(e) => setAway(e.target.value)}
            >
              {players.map((p) => (
                <option key={p.id} value={p.id} disabled={p.id === home}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          比赛时间（北京时间）
          <input
            name="time"
            type="datetime-local"
            required
            defaultValue={dateInput(initial?.time)}
          />
        </label>
        <label>
          轮次 / 场次
          <input
            name="round"
            required
            maxLength={30}
            defaultValue={initial?.round || "单打友谊赛"}
          />
        </label>
        {result && (
          <>
            <div className="form-grid">
              <label>
                球员 A 得分
                <input
                  name="homeScore"
                  type="number"
                  required
                  min={0}
                  max={999}
                  defaultValue={a}
                />
              </label>
              <label>
                球员 B 得分
                <input
                  name="awayScore"
                  type="number"
                  required
                  min={0}
                  max={999}
                  defaultValue={b}
                />
              </label>
            </div>
            {Boolean(initial?.goals.length) && (
              <label className="singles-checkbox">
                <input name="replaceDetailed" type="checkbox" required />
                确认用最终比分替换全部逐球记录（含乌龙球事件）
              </label>
            )}
          </>
        )}
        <div className="singles-actions">
          <button
            className="btn primary"
            disabled={!home || !away || home === away}
          >
            <Check size={16} />
            {result ? "保存比分并完赛" : "保存赛程"}
          </button>
          {!result && (
            <button
              className="btn secondary"
              value="start"
              disabled={!home || !away || home === away}
            >
              <Play size={16} />
              直接开赛
            </button>
          )}
        </div>
      </fieldset>
    </form>
  );
}
function MatchDetail({
  match,
  league,
  stats,
  admin,
  busy,
  mutate,
  onEdit,
  onDelete,
}: {
  match: SinglesMatch;
  league: SinglesLeague;
  stats: SinglesStats[];
  admin: boolean;
  busy: boolean;
  mutate: (action: SinglesAction) => Promise<boolean>;
  onEdit: (kind: "match" | "result") => void;
  onDelete: () => void;
}) {
  const [ownGoal, setOwnGoal] = useState(false),
    [a, b] = singlesScore(match);
  const player = (id: string) => league.players.find((p) => p.id === id);
  const action = (type: string) => mutate({ type, id: match.id });
  const add = (id: string) =>
    mutate({
      type: "goal.add",
      id: match.id,
      data: {
        id: crypto.randomUUID(),
        teamId: id,
        playerId: ownGoal
          ? id === match.homeId
            ? match.awayId
            : match.homeId
          : id,
        ownGoal,
        minute: 0,
      },
    });
  return (
    <>
      <div className="singles-toolbar">
        <button className="text-btn" onClick={() => go("matches")}>
          <ArrowLeft size={16} />
          返回比赛列表
        </button>
        <span>
          {match.round} · {dateLabel(match.time)} · {statusLabel[match.status]}
        </span>
      </div>
      <section className="singles-scoreboard" aria-label="单打记分板">
        {([match.homeId, match.awayId] as const).map((id, i) => (
          <div key={id}>
            <button
              className="singles-person-link"
              onClick={() => go("players", id)}
            >
              <Person player={player(id)} />
            </button>
            <strong aria-label={`${i === 0 ? "球员 A" : "球员 B"} 比分`}>
              {i === 0 ? a : b}
            </strong>
            {admin && match.status === "live" && (
              <button
                className="btn primary"
                aria-label={`${player(id)?.name} 加一分`}
                disabled={busy}
                onClick={() => add(id)}
              >
                <Plus size={22} />1
              </button>
            )}
          </div>
        ))}
      </section>
      {admin && (
        <div className="singles-toolbar">
          <div className="singles-actions">
            {match.status === "scheduled" && (
              <>
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => action("match.start")}
                >
                  <Play size={16} />
                  开始比赛
                </button>
                <button
                  className="btn secondary"
                  onClick={() => onEdit("match")}
                >
                  <Pencil size={16} />
                  编辑赛程
                </button>
              </>
            )}
            {match.status === "live" && (
              <>
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`以 ${a}:${b} 结束这场单打比赛？`))
                      action("match.finish");
                  }}
                >
                  <Check size={16} />
                  结束比赛
                </button>
                <button
                  className="btn secondary"
                  disabled={busy || !match.goals.length}
                  onClick={() =>
                    mutate({
                      type: "goal.delete",
                      id: match.id,
                      goalId: match.goals.at(-1)!.id,
                    })
                  }
                >
                  <Undo2 size={16} />
                  撤销上一球
                </button>
                <label className="singles-checkbox">
                  <input
                    type="checkbox"
                    checked={ownGoal}
                    onChange={(e) => setOwnGoal(e.target.checked)}
                  />
                  对方乌龙球
                </label>
              </>
            )}
            {match.status === "finished" && !match.summary && (
              <button
                className="btn secondary"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      "重新打开比赛后，将暂时移出积分和段位分统计。确认继续？",
                    )
                  )
                    action("match.reopen");
                }}
              >
                <Play size={16} />
                重新打开
              </button>
            )}
            <button
              className="btn secondary"
              disabled={busy}
              onClick={() => onEdit("result")}
            >
              <Pencil size={16} />
              编辑最终比分
            </button>
          </div>
          <button
            className="icon-btn"
            title="删除比赛"
            aria-label="删除比赛"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 size={18} />
          </button>
        </div>
      )}
      {match.status === "finished" && (
        <section className="singles-section">
          <h2>本场段位分变化</h2>
          <div className="singles-elo-result">
            {[match.homeId, match.awayId].map((id) => {
              const h = stats
                .find((s) => s.player.id === id)
                ?.history.find((h) => h.match.id === match.id);
              return (
                h && (
                  <div key={id}>
                    <Person player={player(id)} />
                    <span className="rank-result-scores">
                      <RankScore points={h.before} /> →{" "}
                      <RankScore points={h.after} />
                    </span>
                    <b className={h.delta >= 0 ? "positive" : "negative"}>
                      {signed(h.delta)}
                    </b>
                  </div>
                )
              );
            })}
          </div>
        </section>
      )}
      <section className="singles-section">
        <h2>{match.summary ? "赛后汇总" : "逐球记录"}</h2>
        {match.summary ? (
          <p>
            最终比分 {a}:{b} · {dateLabel(match.summary.recordedAt)}
          </p>
        ) : (
          <ol className="singles-events">
            {[...match.goals].reverse().map((g, i) => (
              <li key={g.id}>
                <span>#{match.goals.length - i}</span>
                <b>
                  {player(g.playerId)?.name}
                  {g.ownGoal ? " · 乌龙球" : " · 进球"}
                </b>
                <span>{player(g.teamId)?.name} +1</span>
                {admin && match.status === "live" && (
                  <button
                    className="icon-btn"
                    title="撤销此球"
                    aria-label={`撤销第 ${match.goals.length - i} 球`}
                    disabled={busy}
                    onClick={() =>
                      mutate({
                        type: "goal.delete",
                        id: match.id,
                        goalId: g.id,
                      })
                    }
                  >
                    <Undo2 size={16} />
                  </button>
                )}
              </li>
            ))}
          </ol>
        )}
        {!match.summary && !match.goals.length && <Empty>暂无进球记录</Empty>}
      </section>
    </>
  );
}
