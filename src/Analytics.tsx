import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeftRight,
  BarChart3,
  ChevronLeft,
  Crosshair,
  Goal,
  Info,
  Medal,
  Pencil,
  Search,
  Shield,
  Swords,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import {
  analyzeLeague,
  ELO_BASE,
  MIN_SAMPLE,
  radarAxes,
  relationships,
  matchRatings,
  positionContext,
  swapComparisons,
  teamHeadToHead,
} from "../lib/analytics.ts";
import type {
  Analytics,
  HeadToHead,
  Metrics,
  PlayerStats,
  Role,
} from "../lib/analytics.ts";
import {
  defenders,
  isTeamMember,
  matchTeam,
  playerTeamIds,
  score,
  scorers,
} from "../lib/league.ts";
import type { League, Match, Player } from "../lib/league.ts";
import { photoUrl } from "./api";

const num = (n: number | null, digits = 2) =>
  n === null ? "—" : n.toFixed(digits);
const pct = (n: number | null) =>
  n === null ? "—" : `${(n * 100).toFixed(0)}%`;
const signed = (n: number | null, digits = 1) =>
  n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(digits)}`;
const roleLabels: Record<Role, string> = {
  overall: "总览",
  forward: "前锋",
  defender: "后卫",
};
const resultLabels = { W: "胜", D: "平", L: "负" };
const byRating = (a: PlayerStats, b: PlayerStats) =>
  b.elo.overall - a.elo.overall ||
  b.overall.games - a.overall.games ||
  a.player.id.localeCompare(b.player.id);
const teamsFor = (s: League, p: Player) =>
  playerTeamIds(p)
    .map((id) => s.teams.find((t) => t.id === id)?.name)
    .filter(Boolean)
    .join(" / ");

function Person({
  player,
  compact = false,
}: {
  player: Player;
  compact?: boolean;
}) {
  return (
    <span className={`data-person ${compact ? "compact" : ""}`}>
      <span className="data-avatar">
        {player.photo ? (
          <img src={photoUrl(player.photo)} alt="" />
        ) : (
          player.name.slice(-2)
        )}
      </span>
      <span>
        <b>{player.name}</b>
        <small>
          #{String(player.number).padStart(2, "0")} · {player.position}
        </small>
      </span>
    </span>
  );
}

function Form({ stats }: { stats: PlayerStats }) {
  return (
    <span
      className="form-results"
      aria-label={`最近${stats.form.length}场：${stats.form.map((r) => resultLabels[r]).join("、")}`}
    >
      {stats.form.length ? (
        stats.form.map((r, i) => (
          <span
            key={i}
            className={r}
            title={`${stats.history.slice(-10)[i].gf}:${stats.history.slice(-10)[i].ga}`}
          >
            {resultLabels[r]}
          </span>
        ))
      ) : (
        <span className="form-empty">—</span>
      )}
    </span>
  );
}

function Sample({ games }: { games: number }) {
  return games > 0 && games < MIN_SAMPLE ? (
    <small className="sample-tag" title="不足 3 场，排名与评分仅供参考">
      小样本
    </small>
  ) : null;
}

function MetricsStrip({
  items,
}: {
  items: { label: string; value: ReactNode; sub?: string; tone?: string }[];
}) {
  return (
    <div className="data-metrics">
      {items.map((item) => (
        <div key={item.label} className={item.tone || ""}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.sub && <small>{item.sub}</small>}
        </div>
      ))}
    </div>
  );
}

export function EloLeaders({
  league,
  onPlayer,
  onAnalytics,
}: {
  league: League;
  onPlayer: (id: string) => void;
  onAnalytics: () => void;
}) {
  const data = useMemo(() => analyzeLeague(league), [league]);
  const leaders = data.players
    .filter((p) => p.ratedGames.overall > 0)
    .sort(byRating)
    .slice(0, 3);
  return (
    <section className="data-section overview-elo">
      <div className="data-section-heading">
        <h2>
          <TrendingUp size={18} />
          Elo 实力榜
        </h2>
        <button className="text-btn" onClick={onAnalytics}>
          全部数据
          <ArrowUpRight size={15} />
        </button>
      </div>
      <div className="rating-leaders">
        {leaders.map((p, i) => (
          <button
            className="rating-leader"
            key={p.player.id}
            onClick={() => onPlayer(p.player.id)}
          >
            <span className="leader-place">0{i + 1}</span>
            <Person player={p.player} />
            <div className="leader-rating">
              <strong>{Math.round(p.elo.overall)}</strong>
              <small>总 Elo · {p.overall.games} 场</small>
            </div>
            <ArrowUpRight size={16} />
          </button>
        ))}
      </div>
      {!leaders.length && (
        <DataEmpty text="完赛并记录双方位置后生成 Elo 排名" />
      )}
    </section>
  );
}

export function PlayerDirectory({
  league,
  query,
  setQuery,
  teamFilter,
  setTeamFilter,
  onPlayer,
  onEdit,
  onAdd,
}: {
  league: League;
  query: string;
  setQuery: (q: string) => void;
  teamFilter: string;
  setTeamFilter: (id: string) => void;
  onPlayer: (id: string) => void;
  onEdit: (p: Player) => void;
  onAdd: () => void;
}) {
  const stats = useMemo(() => analyzeLeague(league), [league]);
  const [role, setRole] = useState<Role>("overall");
  const players = stats.players.filter(
    (p) =>
      (!teamFilter || isTeamMember(p.player, teamFilter)) &&
      `${p.player.name}${p.player.nickname}`.includes(query),
  );
  return (
    <>
      <header className="data-page-heading">
        <div>
          <span className="eyebrow">THE PLAYERS</span>
          <h1>球员档案</h1>
        </div>
        <button className="btn primary" onClick={onAdd}>
          <Users size={16} />
          登记球员
        </button>
      </header>
      <div className="data-toolbar">
        <label className="data-search">
          <Search size={16} />
          <input
            aria-label="搜索球员"
            placeholder="搜索姓名或昵称"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          aria-label="按球队筛选"
          value={teamFilter}
          onChange={(e) => setTeamFilter(e.target.value)}
        >
          <option value="">全部球队</option>
          {league.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <RolePicker role={role} setRole={setRole} />
        <span className="data-caption">{players.length} 位球员</span>
      </div>
      <div className="data-player-grid">
        {players.map((p) => (
          <article className="data-player-card" key={p.player.id}>
            <button
              className="data-player-open"
              aria-label={`查看 ${p.player.name} 的球员档案`}
              onClick={() => onPlayer(p.player.id)}
            >
              <div className="data-player-top">
                <Person player={p.player} />
                <ArrowUpRight size={18} />
              </div>
              <p>{teamsFor(league, p.player) || "暂无所属球队"}</p>
              <div className="directory-metrics">
                <div>
                  <strong>
                    {p.ratedGames[role] ? Math.round(p.elo[role]) : "—"}
                  </strong>
                  <small>
                    {role === "overall" ? "总" : roleLabels[role]} Elo
                  </small>
                </div>
                <div>
                  <strong>{pct(p[role].winRate)}</strong>
                  <small>胜率</small>
                </div>
                <div>
                  <strong>{p[role].games}</strong>
                  <small>出场</small>
                </div>
              </div>
              <div className="directory-radar">
                <div className="directory-radar-heading">
                  <span>{roleLabels[role]}表现</span>
                  <Sample games={p[role].games} />
                </div>
                <Radar stats={p} role={role} />
              </div>
              <Form stats={p} />
            </button>
            <div className="data-player-actions">
              <span>{p.player.nickname || p.player.position}</span>
              <button
                className="icon-btn"
                title="编辑球员资料"
                aria-label={`编辑 ${p.player.name} 的资料`}
                onClick={() => onEdit(p.player)}
              >
                <Pencil size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>
      {!players.length && <DataEmpty text="暂无符合条件的球员" />}
    </>
  );
}

function Radar({ stats, role }: { stats: PlayerStats; role: Role }) {
  const axes = radarAxes(stats, role);
  const xy = (radius: number, i: number) => [
    180 + Math.sin((i * Math.PI) / 3) * radius,
    160 - Math.cos((i * Math.PI) / 3) * radius,
  ];
  const point = (radius: number, i: number) => xy(radius, i).join(",");
  const available = axes.filter((a) => a.value !== null).length;
  return (
    <div className={`performance-radar ${role}`}>
      <svg
        viewBox="0 0 360 330"
        role="img"
        aria-label={`${roleLabels[role]}雷达图：${axes.map((a) => `${a.label} ${a.raw}`).join("，")}`}
      >
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <polygon
            key={r}
            points={axes.map((_, i) => point(100 * r, i)).join(" ")}
            fill="none"
            className="radar-grid"
          />
        ))}
        {axes.map((_, i) => (
          <line
            key={i}
            x1="180"
            y1="160"
            x2={xy(100, i)[0]}
            y2={xy(100, i)[1]}
            className="radar-grid"
          />
        ))}
        {available === 6 && (
          <polygon
            className="radar-area"
            points={axes.map((a, i) => point(a.value!, i)).join(" ")}
          />
        )}
        {axes.map((a, i) => {
          const next = axes[(i + 1) % 6];
          return a.value !== null && next.value !== null ? (
            <line
              key={i}
              className="radar-edge"
              x1={xy(a.value, i)[0]}
              y1={xy(a.value, i)[1]}
              x2={xy(next.value, (i + 1) % 6)[0]}
              y2={xy(next.value, (i + 1) % 6)[1]}
            />
          ) : null;
        })}
        {axes.map((a, i) => (
          <g key={a.label}>
            {a.value !== null && (
              <circle
                className="radar-point"
                cx={xy(a.value, i)[0]}
                cy={xy(a.value, i)[1]}
                r="3.5"
              />
            )}
            <text
              x={xy(139, i)[0]}
              y={xy(139, i)[1] - 3}
              textAnchor="middle"
              className="radar-label"
            >
              {a.label}
            </text>
            <text
              x={xy(139, i)[0]}
              y={xy(139, i)[1] + 15}
              textAnchor="middle"
              className="radar-value"
            >
              {a.raw}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function RolePicker({
  role,
  setRole,
}: {
  role: Role;
  setRole: (role: Role) => void;
}) {
  return (
    <div className="data-segments" role="group" aria-label="统计位置">
      {(["overall", "forward", "defender"] as Role[]).map((r) => (
        <button key={r} aria-pressed={r === role} onClick={() => setRole(r)}>
          {roleLabels[r]}
        </button>
      ))}
    </div>
  );
}

export function PlayerProfile({
  league,
  player,
  onBack,
  onEdit,
  onDelete,
  onPlayer,
  matchCard,
}: {
  league: League;
  player: Player;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onPlayer: (id: string) => void;
  matchCard: (match: Match) => ReactNode;
}) {
  const data = useMemo(() => analyzeLeague(league), [league]);
  const stats = data.players.find((p) => p.player.id === player.id)!;
  const [role, setRole] = useState<Role>("overall");
  const m = stats[role];
  const partners = relationships(stats, "partner");
  const opponents = relationships(stats, "opponent");
  return (
    <div className="data-profile">
      <button className="back-btn" onClick={onBack}>
        <ChevronLeft size={17} />
        返回球员档案
      </button>
      <header className="data-profile-header">
        <div>
          <span className="eyebrow">
            PLAYER DOSSIER / #{String(player.number).padStart(2, "0")}
          </span>
          <h1>
            {player.name}
            <Sample games={stats.overall.games} />
          </h1>
          <p>
            {teamsFor(league, player)} · {player.nickname || player.position}
          </p>
        </div>
        <button className="btn secondary" onClick={onEdit}>
          <Pencil size={15} />
          编辑资料
        </button>
      </header>
      <div className="data-profile-controls">
        <RolePicker role={role} setRole={setRole} />
        <span className="data-caption">
          {m.games} 场完赛 · {m.wins} 胜 {m.draws} 平 {m.losses} 负
        </span>
      </div>
      <MetricsStrip
        items={[
          {
            label: `${role === "overall" ? "总" : roleLabels[role]} Elo`,
            value: stats.ratedGames[role] ? Math.round(stats.elo[role]) : "—",
            sub: `${stats.ratedGames[role]} 场有效定级`,
            tone: "blue",
          },
          {
            label: "胜率",
            value: pct(m.winRate),
            sub: `${m.wins} 胜 / ${m.games} 场`,
          },
          {
            label: "场均净胜球",
            value: signed(m.avgDifference),
            sub: `累计 ${signed(m.gd, 0)}`,
            tone: m.gd < 0 ? "coral" : undefined,
          },
          {
            label: "关键局胜率",
            value: pct(m.closeWinRate),
            sub: `${m.closeGames} 场分差 ≤ 2 球`,
          },
        ]}
      />
      <div className="data-profile-grid">
        <section className="data-section radar-section">
          <div className="data-section-heading">
            <h2>
              <Crosshair size={18} />
              {roleLabels[role]}表现雷达
            </h2>
            <span className="data-caption">赛果计算</span>
          </div>
          <Radar stats={stats} role={role} />
          <div className="radar-footnote">
            缺少样本的维度显示 —，不参与图形绘制。
          </div>
        </section>
        <section className="data-section">
          <div className="data-section-heading">
            <h2>
              <BarChart3 size={18} />
              比赛表现
            </h2>
            <Sample games={m.games} />
          </div>
          <dl className="data-detail-list">
            {[
              ["出场数", `${m.games} 场`],
              ["胜 / 平 / 负", `${m.wins} / ${m.draws} / ${m.losses}`],
              ["球队得分 / 失分", `${m.gf} / ${m.ga}`],
              ["球队场均得分", num(m.avgFor)],
              ["球队场均失分", num(m.avgAgainst)],
              [
                "最长连胜 / 当前连胜",
                `${m.longestStreak} / ${m.currentStreak}`,
              ],
              ["净胜球标准差", num(m.deviation)],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <div className="recent-form">
            <span>最近 {stats.form.length} 场 · 总体</span>
            <Form stats={stats} />
            <small>
              {stats.recent.wins} 胜 {stats.recent.draws} 平{" "}
              {stats.recent.losses} 负 · 胜率 {pct(stats.recent.winRate)}
            </small>
          </div>
        </section>
      </div>
      <section className="data-section">
        <div className="data-section-heading">
          <h2>位置对照</h2>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>位置</th>
                <th>出场</th>
                <th>胜 / 平 / 负</th>
                <th>胜率</th>
                <th>场均得分</th>
                <th>场均失分</th>
                <th>场均净胜</th>
                <th>Elo</th>
              </tr>
            </thead>
            <tbody>
              {(["forward", "defender"] as const).map((r) => (
                <tr key={r}>
                  <td>{roleLabels[r]}</td>
                  <td>{stats[r].games}</td>
                  <td>
                    {stats[r].wins} / {stats[r].draws} / {stats[r].losses}
                  </td>
                  <td>{pct(stats[r].winRate)}</td>
                  <td>{num(stats[r].avgFor)}</td>
                  <td>{num(stats[r].avgAgainst)}</td>
                  <td>{signed(stats[r].avgDifference)}</td>
                  <td>
                    {stats.ratedGames[r] ? Math.round(stats.elo[r]) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="data-profile-grid">
        <RelationshipTable
          title="搭档相性"
          rows={partners}
          league={league}
          onPlayer={onPlayer}
        />
        <RelationshipTable
          title="对手战绩"
          rows={opponents}
          league={league}
          onPlayer={onPlayer}
        />
      </div>
      <section className="data-section">
        <div className="data-section-heading">
          <h2>Elo 轨迹</h2>
          <span className="data-caption">按比赛时间 · {roleLabels[role]}</span>
        </div>
        <EloChart stats={stats} role={role} />
      </section>
      <section className="data-section">
        <div className="data-section-heading">
          <h2>出场记录</h2>
          <span className="data-caption">最近在前</span>
        </div>
        <div className="data-match-grid">
          {stats.history
            .slice()
            .reverse()
            .map((row) => matchCard(row.match))}
        </div>
        {!stats.history.length && <DataEmpty text="暂无已完赛记录" />}
      </section>
      <details className="data-methods">
        <summary>
          <Info size={15} />
          球员资料
        </summary>
        <p>{player.bio || "暂无球员介绍"}</p>
        <p>
          虚拟身价：{player.value.toLocaleString()} 万 G币。人工能力值：
          {player.skills.join(" / ")}。
        </p>
        <button className="text-btn danger" onClick={onDelete}>
          <Trash2 size={14} />
          删除档案
        </button>
      </details>
      <Methods />
    </div>
  );
}

function EloChart({ stats, role }: { stats: PlayerStats; role: Role }) {
  const values = stats.history
    .filter((r) =>
      role === "overall"
        ? r.elo !== undefined
        : r.role === role && r.roleElo !== undefined,
    )
    .map((r) => (role === "overall" ? r.elo! : r.roleElo!));
  if (!values.length) return <DataEmpty text="暂无有效定级比赛" />;
  const series = [ELO_BASE, ...values];
  const min = Math.min(...series) - 15,
    max = Math.max(...series) + 15;
  const x = (i: number) => 44 + (i / (series.length - 1)) * 580;
  const y = (v: number) => 155 - ((v - min) / (max - min)) * 120;
  return (
    <div className="elo-chart">
      <svg
        viewBox="0 0 660 190"
        role="img"
        aria-label={`Elo 从 ${ELO_BASE} 变化至 ${Math.round(values.at(-1)!)}，共 ${values.length} 场`}
      >
        <line
          x1="44"
          x2="624"
          y1={y(ELO_BASE)}
          y2={y(ELO_BASE)}
          stroke="#d7dddf"
          strokeDasharray="4 4"
        />
        <text x="3" y={y(ELO_BASE) + 4}>
          {ELO_BASE}
        </text>
        <path
          d={series.map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`).join(" ")}
          fill="none"
          stroke="#3977b9"
          strokeWidth="2.5"
        />
        {series.map((v, i) => (
          <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="#3977b9">
            <title>
              第 {i} 场：{Math.round(v)}
            </title>
          </circle>
        ))}
        <text x="44" y="181">
          初始
        </text>
        <text x="624" y="181" textAnchor="end">
          第 {values.length} 场 · {Math.round(values.at(-1)!)}
        </text>
      </svg>
    </div>
  );
}

function RelationshipTable({
  title,
  rows,
  league,
  onPlayer,
}: {
  title: string;
  rows: HeadToHead[];
  league: League;
  onPlayer: (id: string) => void;
}) {
  return (
    <section className="data-section">
      <div className="data-section-heading">
        <h2>{title}</h2>
        <span className="data-caption">总览 · 含临时组队</span>
      </div>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>球员</th>
              <th>场次</th>
              <th>胜 / 平 / 负</th>
              <th>胜率</th>
              <th>场均净胜</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <button
                    className="data-name-button"
                    onClick={() => onPlayer(row.id)}
                  >
                    {league.players.find((p) => p.id === row.id)?.name ||
                      "已归档球员"}
                  </button>
                </td>
                <td>
                  {row.games}
                  <Sample games={row.games} />
                </td>
                <td>
                  {row.wins} / {row.draws} / {row.losses}
                </td>
                <td>{pct(row.winRate)}</td>
                <td>{signed(row.avgDifference)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <DataEmpty text="暂无已完赛记录" />}
    </section>
  );
}

export function AnalyticsPage({
  league,
  initialTab = "players",
  onPlayer,
  onMatch,
}: {
  league: League;
  initialTab?: "players" | "pairs" | "rivals";
  onPlayer: (id: string) => void;
  onMatch: (id: string) => void;
}) {
  const [tab, setTab] = useState<
    "players" | "scorers" | "positions" | "pairs" | "rivals" | "honors"
  >(initialTab);
  const [role, setRole] = useState<Role>("overall");
  const [query, setQuery] = useState("");
  const [minimum, setMinimum] = useState(1);
  const [sort, setSort] = useState("elo");
  const [scope, setScope] = useState("all");
  const [month, setMonth] = useState("");
  const [pairMode, setPairMode] = useState("overall");
  const selected = useMemo(
    () => ({
      ...league,
      matches: league.matches.filter(
        (m) =>
          (scope === "all" ||
            (scope === "pickup" ? m.kind === "pickup" : m.kind !== "pickup")) &&
          (!month ||
            new Date(Date.parse(m.time) + 8 * 60 * 60 * 1000)
              .toISOString()
              .startsWith(month)),
      ),
    }),
    [league, scope, month],
  );
  const data = useMemo(() => analyzeLeague(selected), [selected]);
  return (
    <div className="analytics-page">
      <header className="data-page-heading">
        <div>
          <span className="eyebrow">G SUPER LEAGUE / ANALYTICS</span>
          <h1>赛场数据</h1>
          <p>
            {data.finished.length} 场完赛 · {data.ratedMatches} 场有效定级
          </p>
        </div>
        <span className="data-status">
          <span />
          赛果实时计算
        </span>
      </header>
      <div className="data-view-tabs" role="tablist" aria-label="数据视图">
        {[
          { id: "players" as const, label: "球员表现", Icon: BarChart3 },
          { id: "scorers" as const, label: "射手与防守", Icon: Goal },
          { id: "positions" as const, label: "位置对照", Icon: ArrowLeftRight },
          { id: "pairs" as const, label: "搭档默契", Icon: Users },
          { id: "rivals" as const, label: "历史交手", Icon: Swords },
          { id: "honors" as const, label: "赛场荣誉", Icon: Medal },
        ].map(({ id, label, Icon }) => (
          <button
            key={id}
            id={`stats-tab-${id}`}
            role="tab"
            aria-selected={tab === id}
            aria-controls={`stats-panel-${id}`}
            onClick={() => setTab(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      <div className="data-toolbar data-global-filters">
        <label>
          比赛范围
          <select
            aria-label="比赛范围"
            value={scope}
            onChange={(e) => setScope(e.target.value)}
          >
            <option value="all">全部比赛</option>
            <option value="regular">常驻队比赛</option>
            <option value="pickup">临时组队</option>
          </select>
        </label>
        <label>
          比赛月份
          <input
            aria-label="比赛月份"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
        {month && (
          <button className="text-btn" onClick={() => setMonth("")}>
            全部月份
          </button>
        )}
        <label className="minimum-filter">
          最少出场
          <select
            aria-label="最少出场"
            value={minimum}
            onChange={(e) => setMinimum(Number(e.target.value))}
          >
            {[1, 3, 5, 10].map((n) => (
              <option key={n} value={n}>
                {n} 场
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        role="tabpanel"
        id={`stats-panel-${tab}`}
        aria-labelledby={`stats-tab-${tab}`}
      >
        {tab === "players" && (
          <>
            <div className="data-toolbar">
              <RolePicker role={role} setRole={setRole} />
              <label className="data-search">
                <Search size={16} />
                <input
                  aria-label="搜索榜单球员"
                  placeholder="搜索球员"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <select
                aria-label="榜单排序"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="elo">Elo 从高到低</option>
                <option value="winRate">胜率从高到低</option>
                <option value="avgDifference">场均净胜从高到低</option>
                <option value="avgFor">场均得分从高到低</option>
                <option value="avgAgainst">场均失分从低到高</option>
              </select>
            </div>
            <PlayerRanking
              data={data}
              role={role}
              minimum={minimum}
              query={query}
              sort={sort}
              onPlayer={onPlayer}
            />
          </>
        )}
        {tab === "scorers" && (
          <ScoringRankings
            league={selected}
            minimum={minimum}
            onPlayer={onPlayer}
          />
        )}
        {tab === "positions" && (
          <PositionAnalysis
            data={data}
            minimum={minimum}
            onPlayer={onPlayer}
            onMatch={onMatch}
          />
        )}
        {tab === "pairs" && (
          <>
            <div className="data-toolbar">
              <div
                className="data-segments"
                role="group"
                aria-label="搭档统计方式"
              >
                <button
                  aria-pressed={pairMode === "overall"}
                  onClick={() => setPairMode("overall")}
                >
                  整体组合
                </button>
                <button
                  aria-pressed={pairMode === "position"}
                  onClick={() => setPairMode("position")}
                >
                  前后位置
                </button>
              </div>
            </div>
            {pairMode === "overall" ? (
              <Partnerships data={data} minimum={minimum} onPlayer={onPlayer} />
            ) : (
              <PositionPartnerships
                data={data}
                minimum={minimum}
                onPlayer={onPlayer}
                onMatch={onMatch}
              />
            )}
          </>
        )}
        {tab === "rivals" && (
          <Rivals league={selected} data={data} onMatch={onMatch} />
        )}
        {tab === "honors" && (
          <Honors
            league={league}
            data={data}
            minimum={minimum}
            month={month}
            onPlayer={onPlayer}
          />
        )}
      </div>
      <Methods />
    </div>
  );
}

function ScoringRankings({
  league,
  minimum,
  onPlayer,
}: {
  league: League;
  minimum: number;
  onPlayer: (id: string) => void;
}) {
  const [board, setBoard] = useState("scorers");
  const [query, setQuery] = useState("");
  const rows = (
    board === "scorers"
      ? scorers(league)
          .filter((p) => p.goals > 0)
          .map((p) => ({
            player: p,
            total: p.goals,
            games: p.forwardGames,
            average: p.average,
            appearances: p.appearances,
          }))
      : defenders(league).map((p) => ({
          player: p,
          total: p.defensiveGoals,
          games: p.defensiveGames,
          average: p.averageDefense,
          appearances: p.defensiveGames,
        }))
  ).filter(
    (r) =>
      r.appearances >= minimum &&
      `${r.player.name}${r.player.nickname}`.includes(query),
  );
  return (
    <>
      <div className="data-toolbar">
        <div className="data-segments" role="group" aria-label="传统榜单">
          <button
            aria-pressed={board === "scorers"}
            onClick={() => setBoard("scorers")}
          >
            <Goal size={14} />
            射手榜
          </button>
          <button
            aria-pressed={board === "defenders"}
            onClick={() => setBoard("defenders")}
          >
            <Shield size={14} />
            防守榜
          </button>
        </div>
        <label className="data-search">
          <Search size={16} />
          <input
            aria-label="搜索射手或后卫"
            placeholder="搜索球员"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <span className="data-caption">
          {board === "scorers"
            ? "沿用原射手榜 · 含进行中比赛"
            : "沿用原防守榜 · 已完赛"}
        </span>
      </div>
      {board === "scorers" && rows.length > 0 && (
        <div className="top-scorers">
          {rows.slice(0, 3).map((row, i) => (
            <button
              className={`scorer-podium pos-${i}`}
              key={row.player.id}
              onClick={() => onPlayer(row.player.id)}
            >
              <span className="podium-rank">0{i + 1}</span>
              <Person player={row.player} />
              <strong>
                {row.total}
                <small>进球</small>
              </strong>
            </button>
          ))}
        </div>
      )}
      <section className="data-section">
        <div className="data-table-wrap">
          <table className="data-table legacy-ranking">
            <thead>
              <tr>
                <th>排名</th>
                <th>球员</th>
                <th>所属球队</th>
                <th>{board === "scorers" ? "前锋场次" : "后卫场次"}</th>
                <th>{board === "scorers" ? "场均进球" : "场均防守球"}</th>
                <th>{board === "scorers" ? "进球数" : "累计防守球"}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={row.player.id}>
                  <td>
                    <span className={`data-rank ${i < 3 ? "top" : ""}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </td>
                  <td>
                    <button
                      className="data-name-button"
                      onClick={() => onPlayer(row.player.id)}
                    >
                      <Person player={row.player} compact />
                    </button>
                  </td>
                  <td>{teamsFor(league, row.player)}</td>
                  <td>
                    {row.games}
                    <Sample games={row.games} />
                  </td>
                  <td>
                    {board === "scorers"
                      ? num(row.average)
                      : signed(row.average, 2)}
                  </td>
                  <td>
                    <b className="data-elo">
                      {board === "scorers" ? row.total : signed(row.total, 0)}
                    </b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && <DataEmpty text="暂无符合条件的榜单记录" />}
        <p className="data-table-note">
          {board === "scorers"
            ? "沿用原射手榜记账口径：赛后汇总将本队全部进球计给本场前锋；逐球记录按实际指定球员统计，乌龙球不计个人进球。场均进球使用已完赛且记录前锋位置的比赛，实时计分按本人实际进球统计；最少出场按全部有效出场筛选。"
            : "防守球沿用原口径：本队进球 − 对方进球；累计防守球按后卫出场求和，场均防守球除以后卫场次。该指标属于担任后卫时的全队分差。"}
        </p>
      </section>
    </>
  );
}

export function MatchElo({
  league,
  match,
  onPlayer,
}: {
  league: League;
  match: Match;
  onPlayer: (id: string) => void;
}) {
  const result = useMemo(() => matchRatings(league, match), [league, match]);
  const [mode, setMode] = useState<"overall" | "position">("overall");
  return (
    <section className="data-section match-elo" aria-label="本场 Elo 变化">
      <div className="data-section-heading">
        <h2>
          <TrendingUp size={18} />
          本场 Elo 变化
        </h2>
        <div className="data-segments" role="group" aria-label="本场 Elo 类型">
          <button
            aria-pressed={mode === "overall"}
            onClick={() => setMode("overall")}
          >
            总 Elo
          </button>
          <button
            aria-pressed={mode === "position"}
            onClick={() => setMode("position")}
          >
            位置 Elo
          </button>
        </div>
      </div>
      <div className="match-elo-teams">
        {(["home", "away"] as const).map((side) => (
          <div className="match-elo-team" key={side}>
            <h3>
              {
                matchTeam(
                  league.teams,
                  match,
                  side === "home" ? match.homeId : match.awayId,
                )?.name
              }
            </h3>
            <div className="data-table-wrap">
              <table className="data-table match-elo-table">
                <thead>
                  <tr>
                    <th>球员 / 本场位置</th>
                    <th>赛前</th>
                    <th>赛后</th>
                    <th>变化</th>
                  </tr>
                </thead>
                <tbody>
                  {result.players
                    .filter((p) => p.side === side)
                    .map((row) => {
                      const rating = row[mode];
                      return (
                        <tr key={row.playerId}>
                          <td>
                            <button
                              className="elo-player-name"
                              onClick={() => onPlayer(row.playerId)}
                            >
                              <b>
                                {
                                  league.players.find(
                                    (p) => p.id === row.playerId,
                                  )?.name
                                }
                              </b>
                              <small>
                                {row.role ? roleLabels[row.role] : "未记录位置"}
                              </small>
                            </button>
                          </td>
                          <td className="elo-number">
                            {rating ? num(rating.before, 1) : "—"}
                          </td>
                          <td className="elo-number">
                            {rating ? num(rating.after, 1) : "—"}
                          </td>
                          <td
                            className={`elo-number ${rating?.delta ? (rating.delta > 0 ? "positive" : "negative") : ""}`}
                          >
                            {rating ? signed(rating.delta, 1) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
      <p className="data-table-note">
        {result.rated
          ? "按完整历史回算至本场；总 Elo 与本场位置 Elo 独立结算。之后的比赛和数据页筛选不改变本场数值；修正历史赛果后重新回算。"
          : match.status === "finished"
            ? "本场未定级：Elo 结算需要完整记录双方前锋、后卫的 2 对 2 赛果。"
            : "赛前评分按本场之前的完赛记录回算，完赛并记录四个位置后结算。"}
      </p>
    </section>
  );
}

function PositionMatchRows({
  matches,
  forwardId,
  onMatch,
}: {
  matches: Match[];
  forwardId: string;
  onMatch: (id: string) => void;
}) {
  return (
    <div className="data-table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>比赛时间 · 北京时间</th>
            <th>比赛</th>
            <th>本方比分</th>
            <th>赛果</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          {matches
            .slice()
            .reverse()
            .map((match) => {
              const home = match.homePlayers.includes(forwardId),
                scores = score(match);
              const gf = scores[home ? 0 : 1],
                ga = scores[home ? 1 : 0];
              return (
                <tr key={match.id}>
                  <td>
                    {new Date(match.time).toLocaleString("zh-CN", {
                      timeZone: "Asia/Shanghai",
                      hour12: false,
                    })}
                  </td>
                  <td>{match.round}</td>
                  <td>
                    {gf} : {ga}
                  </td>
                  <td
                    className={gf > ga ? "positive" : gf < ga ? "negative" : ""}
                  >
                    {gf > ga ? "胜" : gf < ga ? "负" : "平"}
                  </td>
                  <td>
                    <button
                      className="icon-btn"
                      title="查看比赛与 Elo"
                      aria-label={`查看${match.round}比赛与Elo`}
                      onClick={() => onMatch(match.id)}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
        </tbody>
      </table>
    </div>
  );
}

function PositionPartnerships({
  data,
  minimum,
  onPlayer,
  onMatch,
}: {
  data: Analytics;
  minimum: number;
  onPlayer: (id: string) => void;
  onMatch: (id: string) => void;
}) {
  const [selectedKey, setSelectedKey] = useState("");
  const pairs = data.positionPairs
    .filter((p) => p.games >= minimum)
    .sort(
      (a, b) => b.winRate! - a.winRate! || b.games - a.games || b.gd - a.gd,
    );
  const people = data.players.filter((p) => p.ratedGames.overall > 0);
  const key = (p: { forwardId: string; defenderId: string }) =>
    JSON.stringify([p.forwardId, p.defenderId]);
  const selected = pairs.find((p) => key(p) === selectedKey);
  const name = (id: string) =>
    data.players.find((p) => p.player.id === id)?.player.name || "已归档球员";
  return (
    <>
      <section className="data-section matrix-section">
        <div className="data-section-heading">
          <h2>
            <Users size={18} />
            前后位置搭档矩阵
          </h2>
          <span className="data-caption">行：前锋 · 列：后卫</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table synergy-matrix position-matrix">
            <thead>
              <tr>
                <th>前锋 / 后卫</th>
                {people.map((p) => (
                  <th key={p.player.id}>{p.player.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.player.id}>
                  <th>{p.player.name}</th>
                  {people.map((other) => {
                    const pair = pairs.find(
                      (r) =>
                        r.forwardId === p.player.id &&
                        r.defenderId === other.player.id,
                    );
                    return (
                      <td key={other.player.id}>
                        {p.player.id === other.player.id ? (
                          <span className="matrix-self">/</span>
                        ) : pair ? (
                          <button
                            className={`matrix-cell ${pair.winRate! >= 0.5 ? "winning" : "losing"}`}
                            aria-pressed={key(pair) === selectedKey}
                            aria-label={`${name(pair.forwardId)}前锋、${name(pair.defenderId)}后卫：${pct(pair.winRate)}，${pair.games}场`}
                            onClick={() => setSelectedKey(key(pair))}
                          >
                            <strong>{pct(pair.winRate)}</strong>
                            <small>{pair.games} 场</small>
                          </button>
                        ) : (
                          <span className="data-caption">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!pairs.length && <DataEmpty text="暂无符合出场门槛的位置组合" />}
      </section>
      <section className="data-section">
        <div className="data-section-heading">
          <h2>位置组合表现</h2>
        </div>
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>前锋</th>
                <th>后卫</th>
                <th>场次</th>
                <th>胜 / 平 / 负</th>
                <th>胜率</th>
                <th>得分占比</th>
                <th>场均净胜</th>
                <th>比赛</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((p) => (
                <tr key={key(p)}>
                  <td>
                    <button
                      className="data-name-button"
                      onClick={() => onPlayer(p.forwardId)}
                    >
                      {name(p.forwardId)}
                    </button>
                  </td>
                  <td>
                    <button
                      className="data-name-button"
                      onClick={() => onPlayer(p.defenderId)}
                    >
                      {name(p.defenderId)}
                    </button>
                  </td>
                  <td>
                    {p.games}
                    <Sample games={p.games} />
                  </td>
                  <td>
                    {p.wins} / {p.draws} / {p.losses}
                  </td>
                  <td>{pct(p.winRate)}</td>
                  <td>{pct(p.goalShare)}</td>
                  <td>{signed(p.avgDifference)}</td>
                  <td>
                    <button
                      className="icon-btn"
                      title="组合比赛记录"
                      aria-label={`查看${name(p.forwardId)}前锋与${name(p.defenderId)}后卫的比赛`}
                      onClick={() => setSelectedKey(key(p))}
                    >
                      <ArrowUpRight size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      {selected && (
        <section className="data-section">
          <div className="data-section-heading">
            <h2>
              {name(selected.forwardId)} · 前锋 <ArrowRight size={15} />{" "}
              {name(selected.defenderId)} · 后卫
            </h2>
            <span className="data-caption">{selected.games} 场</span>
          </div>
          <PositionMatchRows
            matches={selected.matches}
            forwardId={selected.forwardId}
            onMatch={onMatch}
          />
        </section>
      )}
    </>
  );
}

function PositionAnalysis({
  data,
  minimum,
  onPlayer,
  onMatch,
}: {
  data: Analytics;
  minimum: number;
  onPlayer: (id: string) => void;
  onMatch: (id: string) => void;
}) {
  const [role, setRole] = useState<Role>("forward");
  const [selectedSwap, setSelectedSwap] = useState<{
    id: string;
    forwardId: string;
  } | null>(null);
  const rows = data.players
    .filter((p) => p[role].games >= minimum)
    .sort((a, b) => b[role].games - a[role].games);
  const comparisons = swapComparisons(data).filter((g) =>
    g.variants.every((v) => v.games >= minimum),
  );
  const selected = comparisons
    .find((g) => g.id === selectedSwap?.id)
    ?.variants.find((v) => v.forwardId === selectedSwap?.forwardId);
  const name = (id: string) =>
    data.players.find((p) => p.player.id === id)?.player.name || "已归档球员";
  return (
    <>
      <div className="data-toolbar">
        <RolePicker role={role} setRole={setRole} />
        <span className="data-caption">位置表现与样本背景</span>
      </div>
      <section className="data-section">
        <div className="data-table-wrap">
          <table className="data-table position-context-table">
            <thead>
              <tr>
                <th>球员</th>
                <th>胜 / 场次</th>
                <th>胜率</th>
                <th>95% 胜率区间</th>
                <th>得分占比</th>
                <th>搭档人数</th>
                <th>对手人数</th>
                <th>搭档赛前 Elo</th>
                <th>对手赛前 Elo</th>
                <th>Elo 样本</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const metrics = p[role],
                  context = positionContext(p, role);
                return (
                  <tr key={p.player.id}>
                    <td>
                      <button
                        className="data-name-button"
                        onClick={() => onPlayer(p.player.id)}
                      >
                        <Person player={p.player} compact />
                      </button>
                    </td>
                    <td>
                      {metrics.wins} / {metrics.games}
                      <Sample games={metrics.games} />
                    </td>
                    <td>
                      <b>{pct(metrics.winRate)}</b>
                    </td>
                    <td>
                      {metrics.winInterval
                        ? `${pct(metrics.winInterval[0])} – ${pct(metrics.winInterval[1])}`
                        : "—"}
                    </td>
                    <td>{pct(metrics.goalShare)}</td>
                    <td>{context.partners}</td>
                    <td>{context.opponents}</td>
                    <td>{num(context.partnerElo, 0)}</td>
                    <td>{num(context.opponentElo, 0)}</td>
                    <td>{context.ratedGames} 场</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!rows.length && <DataEmpty text="暂无符合条件的位置样本" />}
        <p className="data-table-note">
          得分占比逐场计算本方得分 ÷ 双方总得分，再取平均；0:0
          不参与该项。胜率区间使用 Wilson 95%
          区间；搭档、对手强度为有效定级比赛中各场赛前总 Elo
          的平均值，对手先取两人均值。区间宽、搭档少时需结合具体阵容判断。
        </p>
      </section>
      <section className="data-section">
        <div className="data-section-heading">
          <h2>
            <ArrowLeftRight size={18} />
            同阵容换位对照
          </h2>
          <span className="data-caption">固定搭档、对手及对方位置</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table swap-table">
            <thead>
              <tr>
                <th>固定对手 · 前锋 / 后卫</th>
                <th>本方前锋</th>
                <th>本方后卫</th>
                <th>场次</th>
                <th>胜 / 平 / 负</th>
                <th>胜率</th>
                <th>得分占比</th>
                <th>场均净胜</th>
                <th>记录</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.flatMap((group) =>
                group.variants.map((variant, index) => (
                  <tr
                    className={index === 0 ? "swap-group-start" : ""}
                    key={`${group.id}-${variant.forwardId}`}
                  >
                    <td>
                      {name(group.opponents[0])} / {name(group.opponents[1])}
                    </td>
                    <td>
                      <button
                        className="data-name-button"
                        onClick={() => onPlayer(variant.forwardId)}
                      >
                        {name(variant.forwardId)}
                      </button>
                    </td>
                    <td>
                      <button
                        className="data-name-button"
                        onClick={() => onPlayer(variant.defenderId)}
                      >
                        {name(variant.defenderId)}
                      </button>
                    </td>
                    <td>
                      {variant.games}
                      <Sample games={variant.games} />
                    </td>
                    <td>
                      {variant.wins} / {variant.draws} / {variant.losses}
                    </td>
                    <td>{pct(variant.winRate)}</td>
                    <td>{pct(variant.goalShare)}</td>
                    <td>{signed(variant.avgDifference)}</td>
                    <td>
                      <button
                        className="icon-btn"
                        title="换位对照比赛"
                        aria-label={`查看${name(variant.forwardId)}前锋的换位对照比赛`}
                        onClick={() =>
                          setSelectedSwap({
                            id: group.id,
                            forwardId: variant.forwardId,
                          })
                        }
                      >
                        <ArrowUpRight size={16} />
                      </button>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
        {!comparisons.length && (
          <DataEmpty text="暂无两种站位都达到出场门槛的同阵容比赛" />
        )}
        <p className="data-table-note">
          仅比较同一对搭档交换前后位置、对方两人及位置保持一致的记录。两种站位分别满足最少出场条件；比赛分制、球桌及先后手未记录，当前对照不能完全排除这些因素。
        </p>
      </section>
      {selected && (
        <section className="data-section">
          <div className="data-section-heading">
            <h2>
              {name(selected.forwardId)} · 前锋 / {name(selected.defenderId)} ·
              后卫
            </h2>
          </div>
          <PositionMatchRows
            matches={selected.matches}
            forwardId={selected.forwardId}
            onMatch={onMatch}
          />
        </section>
      )}
    </>
  );
}

function PlayerRanking({
  data,
  role,
  minimum,
  query,
  sort,
  onPlayer,
}: {
  data: Analytics;
  role: Role;
  minimum: number;
  query: string;
  sort: string;
  onPlayer: (id: string) => void;
}) {
  const ordered = data.players
    .filter((p) => p[role].games >= minimum)
    .sort((a, b) => {
      const value = (p: PlayerStats) =>
        sort === "elo"
          ? p.ratedGames[role]
            ? p.elo[role]
            : -Infinity
          : (p[role][
              sort as "winRate" | "avgDifference" | "avgFor" | "avgAgainst"
            ] ?? -Infinity) * (sort === "avgAgainst" ? -1 : 1);
      return (
        value(b) - value(a) ||
        b[role].games - a[role].games ||
        a.player.id.localeCompare(b.player.id)
      );
    });
  const rows = ordered.filter((p) =>
    `${p.player.name}${p.player.nickname}`.includes(query),
  );
  return (
    <section className="data-section">
      <div className="data-table-wrap">
        <table className="data-table ranking-table">
          <thead>
            <tr>
              <th>排名</th>
              <th>球员</th>
              <th>Elo</th>
              <th>出场</th>
              <th>胜 / 平 / 负</th>
              <th>胜率</th>
              <th>得分占比</th>
              <th>得 / 失</th>
              <th>净胜球</th>
              <th>场均得分</th>
              <th>场均失分</th>
              <th>场均净胜</th>
              <th>关键局胜率</th>
              <th>最长连胜</th>
              <th>近 10 场 · 总体</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.player.id}>
                <td>
                  <span
                    className={`data-rank ${ordered.indexOf(p) < 3 ? "top" : ""}`}
                  >
                    {String(ordered.indexOf(p) + 1).padStart(2, "0")}
                  </span>
                </td>
                <td>
                  <button
                    className="data-name-button"
                    onClick={() => onPlayer(p.player.id)}
                  >
                    <Person player={p.player} compact />
                  </button>
                </td>
                <td>
                  <b className="data-elo">
                    {p.ratedGames[role] ? Math.round(p.elo[role]) : "—"}
                  </b>
                </td>
                <td>
                  {p[role].games}
                  <Sample games={p[role].games} />
                </td>
                <td>
                  {p[role].wins} / {p[role].draws} / {p[role].losses}
                </td>
                <td>
                  <b>{pct(p[role].winRate)}</b>
                </td>
                <td>{pct(p[role].goalShare)}</td>
                <td>
                  {p[role].gf} / {p[role].ga}
                </td>
                <td>{signed(p[role].gd, 0)}</td>
                <td>{num(p[role].avgFor)}</td>
                <td>{num(p[role].avgAgainst)}</td>
                <td className={p[role].gd >= 0 ? "positive" : "negative"}>
                  {signed(p[role].avgDifference)}
                </td>
                <td>
                  {pct(p[role].closeWinRate)}{" "}
                  <small className="data-caption">
                    / {p[role].closeGames} 场
                  </small>
                </td>
                <td>{p[role].longestStreak}</td>
                <td>
                  <Form stats={p} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <DataEmpty text="暂无符合条件的已完赛记录" />}
      <div className="data-table-note">
        球队得失分按该球员在场时统计；前锋、后卫只统计明确记录的位置。射手榜单独沿用原版前锋进球分配口径。
      </div>
    </section>
  );
}

function Partnerships({
  data,
  minimum,
  onPlayer,
}: {
  data: Analytics;
  minimum: number;
  onPlayer: (id: string) => void;
}) {
  const [sort, setSort] = useState<
    "winRate" | "avgFor" | "avgAgainst" | "avgDifference"
  >("winRate");
  const [selectedPair, setSelectedPair] = useState<string[] | null>(null);
  const pairs = data.pairs
    .filter((p) => p.games >= minimum)
    .sort(
      (a, b) =>
        (sort === "avgAgainst" ? a[sort]! - b[sort]! : b[sort]! - a[sort]!) ||
        b.games - a.games ||
        b.gd - a.gd ||
        JSON.stringify(a.ids).localeCompare(JSON.stringify(b.ids)),
    );
  const people = data.players.filter((p) => p.overall.games > 0);
  return (
    <>
      <div className="data-toolbar">
        <h2 className="data-subheading">双人组合榜</h2>
        <select
          aria-label="组合榜排序"
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
        >
          <option value="winRate">最佳搭档 · 胜率</option>
          <option value="avgFor">进攻组合 · 场均得分</option>
          <option value="avgAgainst">防守组合 · 场均失分</option>
          <option value="avgDifference">组合强度 · 场均净胜</option>
        </select>
      </div>
      <section className="data-section">
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>排名</th>
                <th>双人组合</th>
                <th>场次</th>
                <th>胜 / 平 / 负</th>
                <th>胜率</th>
                <th>场均得分</th>
                <th>场均失分</th>
                <th>场均净胜</th>
              </tr>
            </thead>
            <tbody>
              {pairs.map((pair, i) => (
                <tr key={JSON.stringify(pair.ids)}>
                  <td>
                    <span className="data-rank">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </td>
                  <td>
                    <div className="pair-names">
                      {pair.ids.map((id) => (
                        <button key={id} onClick={() => onPlayer(id)}>
                          {
                            data.players.find((p) => p.player.id === id)?.player
                              .name
                          }
                        </button>
                      ))}
                    </div>
                  </td>
                  <td>
                    {pair.games}
                    <Sample games={pair.games} />
                  </td>
                  <td>
                    {pair.wins} / {pair.draws} / {pair.losses}
                  </td>
                  <td>
                    <b>{pct(pair.winRate)}</b>
                  </td>
                  <td>{num(pair.avgFor)}</td>
                  <td>{num(pair.avgAgainst)}</td>
                  <td>{signed(pair.avgDifference)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!pairs.length && <DataEmpty text="暂无符合出场门槛的双人组合" />}
      </section>
      <section className="data-section matrix-section">
        <div className="data-section-heading">
          <h2>
            <Users size={18} />
            搭档默契矩阵
          </h2>
          <span className="data-caption">组合胜率 / 场次</span>
        </div>
        <div className="data-table-wrap">
          <table className="data-table synergy-matrix">
            <thead>
              <tr>
                <th>球员</th>
                {people.map((p) => (
                  <th key={p.player.id}>{p.player.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((p) => (
                <tr key={p.player.id}>
                  <th>{p.player.name}</th>
                  {people.map((other) => {
                    const pair = pairs.find(
                      (row) =>
                        row.ids.includes(p.player.id) &&
                        row.ids.includes(other.player.id),
                    );
                    return (
                      <td key={other.player.id}>
                        {other.player.id === p.player.id ? (
                          <span className="matrix-self">/</span>
                        ) : pair ? (
                          <button
                            className={`matrix-cell ${pair.winRate! >= 0.5 ? "winning" : "losing"}`}
                            onClick={() => setSelectedPair(pair.ids)}
                            aria-label={`${p.player.name}与${other.player.name}搭档：${pct(pair.winRate)}，${pair.games}场`}
                          >
                            <strong>{pct(pair.winRate)}</strong>
                            <small>{pair.games} 场</small>
                          </button>
                        ) : (
                          <span className="data-caption">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!people.length && <DataEmpty text="暂无组合数据" />}
      </section>
      {selectedPair && (
        <section className="data-section">
          <div className="data-section-heading">
            <h2>
              {selectedPair
                .map(
                  (id) =>
                    data.players.find((p) => p.player.id === id)?.player.name,
                )
                .join(" × ")}
            </h2>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>比赛</th>
                  <th>比分</th>
                  <th>赛果</th>
                </tr>
              </thead>
              <tbody>
                {data.players
                  .find((p) => p.player.id === selectedPair[0])
                  ?.history.filter(
                    (r) =>
                      r.partners.length === 1 &&
                      r.partners.includes(selectedPair[1]),
                  )
                  .slice()
                  .reverse()
                  .map((row) => (
                    <tr key={row.match.id}>
                      <td>
                        {row.match.round} ·{" "}
                        {new Date(row.match.time).toLocaleDateString("zh-CN", {
                          timeZone: "Asia/Shanghai",
                        })}
                      </td>
                      <td>
                        {row.gf} : {row.ga}
                      </td>
                      <td>{resultLabels[row.result]}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}

function Rivals({
  league,
  data,
  onMatch,
}: {
  league: League;
  data: Analytics;
  onMatch: (id: string) => void;
}) {
  const [mode, setMode] = useState("player");
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const choices = mode === "player" ? league.players : league.teams;
  const left = choices.some((p) => p.id === first)
    ? first
    : choices[0]?.id || "";
  const right = choices.some((p) => p.id === second && p.id !== left)
    ? second
    : choices.find((p) => p.id !== left)?.id || "";
  const player = data.players.find((p) => p.player.id === left);
  const record =
    mode === "player"
      ? player
        ? relationships(player, "opponent").find((r) => r.id === right)
        : undefined
      : left && right
        ? teamHeadToHead(league, left, right)
        : undefined;
  return (
    <>
      <div className="data-toolbar">
        <div className="data-segments" role="group" aria-label="交手类型">
          <button
            aria-pressed={mode === "player"}
            onClick={() => {
              setMode("player");
              setFirst("");
              setSecond("");
            }}
          >
            球员交手
          </button>
          <button
            aria-pressed={mode === "team"}
            onClick={() => {
              setMode("team");
              setFirst("");
              setSecond("");
            }}
          >
            球队交手
          </button>
        </div>
        <span className="data-caption">
          {mode === "player" ? "双方作为对手出场" : "仅常驻队比赛"}
        </span>
      </div>
      <div className="rival-selectors">
        <select
          aria-label="交手一方"
          value={left}
          onChange={(e) => setFirst(e.target.value)}
        >
          {choices.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <Swords size={22} />
        <select
          aria-label="交手另一方"
          value={right}
          onChange={(e) => setSecond(e.target.value)}
        >
          {choices
            .filter((p) => p.id !== left)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </div>
      <MetricsStrip
        items={[
          { label: "历史交手", value: record?.games || 0, sub: "场" },
          {
            label: `${choices.find((p) => p.id === left)?.name || "一方"}胜`,
            value: record?.wins || 0,
            tone: "blue",
          },
          { label: "平局", value: record?.draws || 0 },
          {
            label: `${choices.find((p) => p.id === right)?.name || "另一方"}胜`,
            value: record?.losses || 0,
            tone: "coral",
          },
        ]}
      />
      {record && record.games > 0 ? (
        <section className="data-section">
          <div className="data-section-heading">
            <h2>交手记录</h2>
            <span className="data-caption">从左侧球员 / 球队视角</span>
          </div>
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>比赛时间 · 北京时间</th>
                  <th>轮次</th>
                  <th>比分</th>
                  <th>赛果</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody>
                {record.matches
                  .slice()
                  .reverse()
                  .map((m) => {
                    const home =
                      mode === "player"
                        ? m.homePlayers.includes(left)
                        : m.homeId === left;
                    const scores = score(m);
                    const gf = scores[home ? 0 : 1],
                      ga = scores[home ? 1 : 0];
                    return (
                      <tr key={m.id}>
                        <td>
                          {new Date(m.time).toLocaleString("zh-CN", {
                            timeZone: "Asia/Shanghai",
                            hour12: false,
                          })}
                        </td>
                        <td>{m.round}</td>
                        <td>
                          <b>
                            {gf} : {ga}
                          </b>
                        </td>
                        <td>
                          <span
                            className={`result-word ${gf > ga ? "positive" : gf < ga ? "negative" : ""}`}
                          >
                            {gf > ga ? "胜" : gf < ga ? "负" : "平"}
                          </span>
                        </td>
                        <td>
                          <button
                            className="icon-btn"
                            title="查看比赛"
                            aria-label={`查看${m.round}比赛详情`}
                            onClick={() => onMatch(m.id)}
                          >
                            <ArrowUpRight size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <DataEmpty text="双方暂无已完赛交手记录" />
      )}
    </>
  );
}

function Honors({
  league,
  data,
  minimum,
  month,
  onPlayer,
}: {
  league: League;
  data: Analytics;
  minimum: number;
  month: string;
  onPlayer: (id: string) => void;
}) {
  const [club, setClub] = useState(league.teams[0]?.id || "");
  const threshold = Math.max(MIN_SAMPLE, minimum);
  const overall = data.players
    .filter((p) => p.ratedGames.overall >= threshold)
    .sort(byRating)[0];
  const forward = data.players
    .filter((p) => p.ratedGames.forward >= threshold)
    .sort(
      (a, b) =>
        b.elo.forward - a.elo.forward ||
        b.forward.games - a.forward.games ||
        a.player.id.localeCompare(b.player.id),
    )[0];
  const defender = data.players
    .filter((p) => p.ratedGames.defender >= threshold)
    .sort(
      (a, b) =>
        b.elo.defender - a.elo.defender ||
        b.defender.games - a.defender.games ||
        a.player.id.localeCompare(b.player.id),
    )[0];
  const pair = data.pairs
    .filter((p) => p.games >= threshold)
    .sort(
      (a, b) => b.winRate! - a.winRate! || b.gd - a.gd || b.games - a.games,
    )[0];
  const clubBest = data.players
    .filter(
      (p) => isTeamMember(p.player, club) && p.ratedGames.overall >= threshold,
    )
    .sort(byRating)[0];
  return (
    <>
      <div className="data-section-heading">
        <h2>{month ? `${month} 月度荣誉` : "赛季荣誉"}</h2>
        <span className="data-caption">
          至少 {threshold} 场 · 按当前筛选范围
        </span>
      </div>
      <div className="honors-grid">
        {[
          {
            label: month ? "月度 MVP" : "赛季领跑者",
            sub: "总 Elo",
            stats: overall,
            role: "overall" as const,
            Icon: Trophy,
          },
          {
            label: "最佳前锋",
            sub: "前锋 Elo",
            stats: forward,
            role: "forward" as const,
            Icon: Target,
          },
          {
            label: "最佳后卫",
            sub: "后卫 Elo",
            stats: defender,
            role: "defender" as const,
            Icon: Shield,
          },
        ].map(({ label, sub, stats, role, Icon }) => (
          <article className="honor-item" key={label}>
            <div className="honor-label">
              <Icon size={20} />
              <span>{label}</span>
            </div>
            {stats ? (
              <>
                <button onClick={() => onPlayer(stats.player.id)}>
                  <Person player={stats.player} />
                  <ArrowUpRight size={15} />
                </button>
                <strong>
                  {Math.round(stats.elo[role])}
                  <small>
                    {sub} · {stats[role].games} 场
                  </small>
                </strong>
              </>
            ) : (
              <p className="honor-pending">等待足够比赛样本</p>
            )}
          </article>
        ))}
        <article className="honor-item">
          <div className="honor-label">
            <Users size={20} />
            <span>最佳搭档</span>
          </div>
          {pair ? (
            <>
              <div className="pair-names">
                {pair.ids.map((id) => (
                  <button key={id} onClick={() => onPlayer(id)}>
                    {data.players.find((p) => p.player.id === id)?.player.name}
                  </button>
                ))}
              </div>
              <strong>
                {pct(pair.winRate)}
                <small>组合胜率 · {pair.games} 场</small>
              </strong>
            </>
          ) : (
            <p className="honor-pending">等待足够比赛样本</p>
          )}
        </article>
      </div>
      <section className="data-section">
        <div className="data-toolbar">
          <h2 className="data-subheading">队内最佳</h2>
          <select
            aria-label="队内最佳球队"
            value={club}
            onChange={(e) => setClub(e.target.value)}
          >
            {league.teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        {clubBest ? (
          <button
            className="club-best"
            onClick={() => onPlayer(clubBest.player.id)}
          >
            <Person player={clubBest.player} />
            <span>
              <strong>{Math.round(clubBest.elo.overall)}</strong>
              <small>总 Elo · 当前成员个人赛果</small>
            </span>
            <ArrowUpRight size={17} />
          </button>
        ) : (
          <DataEmpty text="当前球队暂无达到出场门槛的球员" />
        )}
      </section>
    </>
  );
}

function DataEmpty({ text }: { text: string }) {
  return (
    <div className="data-empty">
      <BarChart3 size={25} />
      <p>{text}</p>
    </div>
  );
}

function Methods() {
  return (
    <details className="data-methods">
      <summary>
        <Info size={15} />
        统计口径与评分
      </summary>
      <div className="method-grid">
        <div>
          <h3>比赛与位置</h3>
          <p>
            仅统计已完赛比赛。总体按出场阵容统计；位置指标只使用明确记录的本场前锋、后卫，不以球员常用位置推测。球队得失分属于在场表现，不是个人进球。临时组队计个人及组合数据，不计球队战绩。
          </p>
        </div>
        <div>
          <h3>Elo</h3>
          <p>
            初始 {ELO_BASE}，K = 32；仅完整记录四个位置的 2 对 2
            比赛定级。队伍强度为两名球员赛前评分均值，预期胜率 E = 1 / (1 +
            10^((对方均分 − 本方均分) / 400))；每位球员加分 32 × (赛果 − E)，胜
            / 平 / 负为 1 / 0.5 / 0。总 Elo 和位置 Elo
            独立计算，按比赛时间排序，同时间按记录时间及 ID
            排序。筛选范围改变时从 {ELO_BASE} 重算。
          </p>
        </div>
        <div>
          <h3>关键局与样本</h3>
          <p>
            关键局为最终分差不超过 2 球的比赛。胜率 = 胜场 /
            完赛场次，平局计入分母。不足 3
            场标记小样本；无出场、无关键局或未定级显示
            —。组合只统计同侧恰好两人的比赛，不拆分多人阵容。
          </p>
        </div>
        <div>
          <h3>数据雷达</h3>
          <p>
            维度映射为 0–100：胜率直接取百分数；净胜球为 50 + 50 × tanh(场均净胜
            / 5)；位置表现为胜率与净胜球映射的均值；稳定性为 100 / (1 +
            净胜球标准差 / 5)，至少 2 场；Elo 为 50 + 50 × tanh((评分 −{" "}
            {ELO_BASE}) / 200)；得分为 100 × 场均得分 / (场均得分 +
            5)，失球控制为 100 / (1 + 场均失分 /
            5)。搭档适配性取不同搭档场均净胜球标准差的反向分数，至少两位各合作 2
            场的搭档。稳定性与适配性描述波动，不代表绝对实力。
          </p>
        </div>
        <div>
          <h3>近期、交手与荣誉</h3>
          <p>
            近期状态按时间取最近 10
            场，左旧右新；平局或负场中断连胜。球员交手只计算双方作为对手的比赛。荣誉至少
            3 场有效样本，MVP / 最佳位置按相应
            Elo，最佳搭档按胜率、净胜球、出场数排序。月份按北京时间筛选。
          </p>
        </div>
        <div>
          <h3>位置对照与样本背景</h3>
          <p>
            前后位置组合按明确记录的前锋和后卫分别统计，交换位置视为不同组合。换位对照要求搭档和对方两人不变，且对方位置不变。得分占比为逐场本方得分
            / 双方总得分的平均值，0:0 不参与该项；它不等于进球效率。Wilson 95%
            胜率区间描述抽样不确定性，不能消除固定搭档等比赛安排的影响。搭档与对手强度使用各场赛前总
            Elo，不使用最新评分回填。
          </p>
        </div>
        <div>
          <h3>射手榜与防守榜</h3>
          <p>
            沿用原版记账规则：赛后汇总的本队进球计给本场前锋；真实逐球记录按指定球员计入，乌龙球不计个人进球。射手总数含进行中比赛，场均进球按已完赛、记录前锋位置的比赛计算，实时比赛仅统计本人实际进球。防守球为担任后卫时本队进球减失球，场均除以后卫场次。前锋分配进球属于展示口径，不证明实际进球归属。
          </p>
        </div>
        <div>
          <h3>原始事件与资料</h3>
          <p>
            保留已有逐球记录和人工资料；没有事件记录的实际个人进球、助攻、扑救、射门转化率和逆转不作推算，射手榜沿用前述分配规则。编辑或删除比赛后，统计与评分从剩余记录重新计算。
          </p>
        </div>
      </div>
    </details>
  );
}
