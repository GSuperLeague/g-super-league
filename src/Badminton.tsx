import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  Download,
  LayoutDashboard,
  LogIn,
  LogOut,
  Plus,
  RefreshCw,
  Settings,
  Trophy,
  Undo2,
  UserRound,
  Users,
  X,
  CalendarDays,
  Pencil,
  ShieldCheck,
} from "lucide-react";
import {
  analyzeBadminton,
  badmintonPairs,
  badmintonScore,
  badmintonWinner,
  badmintonRuleLabel,
  emptyBadmintonLeague,
} from "../lib/badminton.ts";
import type {
  BadmintonLeague,
  BadmintonMatch,
  BadmintonMode,
  BadmintonPlayer,
  BadmintonStats,
  GameScore,
} from "../lib/badminton.ts";
import {
  badmintonLogin,
  badmintonLogout,
  badmintonRequest,
  badmintonToken,
  saveBadmintonAction,
  sourceBadmintonPlayers,
} from "./badminton-api";
import type { BadmintonSnapshot } from "./badminton-api";
import { photoUrl } from "./api";
import { RankScore } from "./RankScore";
import { LeagueAnnouncements } from "./LeagueAnnouncements";
import { DailyRewardBreakdown } from "./DailyRewardBreakdown";
import { ShuttleIcon } from "./GairHome";
import "./badminton.css";
import gbLeagueLogo from "./assets/gb-league-logo-640.png";
import gbLeagueLogoFull from "./assets/gb-league-logo.png";

const empty = emptyBadmintonLeague();
const when = (time: string) =>
  new Date(time).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
const inputDate = (time?: string) =>
  new Date(time || Date.now())
    .toLocaleString("sv-SE", { timeZone: "Asia/Shanghai" })
    .slice(0, 16)
    .replace(" ", "T");
const modeName = (mode: BadmintonMode) =>
  mode === "singles" ? "单打" : "双打";
const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
const navItems = [
  ["overview", "联赛总览", LayoutDashboard],
  ["matches", "赛程与比分", CalendarDays],
  ["rankings", "个人排行榜", Trophy],
  ["players", "球员档案", Users],
  ["settings", "联赛设置", Settings],
] as const;
type Dialog =
  | { kind: "login" }
  | { kind: "player"; player?: BadmintonPlayer }
  | { kind: "match"; match?: BadmintonMatch; result?: boolean }
  | { kind: "import" }
  | { kind: "settings" }
  | {
      kind: "confirm";
      title: string;
      message: string;
      run: () => Promise<boolean>;
    };
type Save = (
  type: string,
  id: string,
  data?: unknown,
  close?: boolean,
) => Promise<boolean>;

function Avatar({
  player,
  large = false,
}: {
  player: BadmintonPlayer;
  large?: boolean;
}) {
  const image = /^\/api\/photos\/[a-f0-9-]+$/.test(player.photo)
    ? photoUrl(player.photo)
    : "";
  return (
    <span className={`gb-avatar${large ? " gb-avatar-large" : ""}`}>
      <span>{player.name.slice(-2)}</span>
      {image && (
        <img
          src={image}
          alt={`${player.name}头像`}
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
    </span>
  );
}
function Modal({
  title,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const old = document.activeElement as HTMLElement | null;
    ref.current
      ?.querySelector<HTMLElement>(
        ".gb-form input,.gb-form select,.gb-form textarea,.gb-form button",
      )
      ?.focus();
    return () => old?.focus();
  }, []);
  return (
    <div
      className="gb-modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="gb-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) onClose();
          if (e.key === "Tab") {
            const nodes = ref.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled)",
            );
            if (!nodes?.length) return;
            const first = nodes[0],
              last = nodes[nodes.length - 1];
            if (e.shiftKey && document.activeElement === first) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
        }}
      >
        <header>
          <h2>{title}</h2>
          <button
            className="gb-icon-btn"
            aria-label="关闭窗口"
            disabled={busy}
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="gb-empty">
      <span className="gb-empty-symbol">
        <ShuttleIcon size={34} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
function LoginForm({
  onLogged,
  busy,
  setBusy,
}: {
  onLogged: () => void;
  busy: boolean;
  setBusy: (v: boolean) => void;
}) {
  const [token, setToken] = useState(""),
    [error, setError] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await badmintonLogin(token);
      onLogged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="gb-form">
      <div className="gb-form-intro">
        <ShieldCheck size={22} />
        <p>
          使用现有 G超管理员密码登录，即可登记 GB
          球员和比赛。所有人都能查看战绩。
        </p>
      </div>
      <label>
        管理员密码
        <input
          aria-label="管理员密码"
          type="password"
          autoComplete="current-password"
          required
          maxLength={1024}
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
      </label>
      {error && (
        <p className="gb-form-error" role="alert">
          {error}
        </p>
      )}
      <button className="gb-btn gb-primary gb-full" disabled={busy}>
        {busy ? "正在验证…" : "登录并继续"}
      </button>
      <p className="gb-help">登录仅保留在当前浏览器标签页，退出管理后清除。</p>
    </form>
  );
}
function PlayerForm({
  player,
  onSave,
  busy,
}: {
  player?: BadmintonPlayer;
  onSave: Save;
  busy: boolean;
}) {
  const [name, setName] = useState(player?.name || ""),
    [nickname, setNickname] = useState(player?.nickname || ""),
    [bio, setBio] = useState(player?.bio || ""),
    [hand, setHand] = useState(player?.hand || "unknown");
  return (
    <form
      className="gb-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(
          "player.save",
          player?.id || crypto.randomUUID(),
          { name, nickname, bio, hand },
          true,
        );
      }}
    >
      <div className="gb-form-grid">
        <label>
          姓名
          <input
            aria-label="球员姓名"
            required
            maxLength={30}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          昵称
          <input
            maxLength={30}
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
          />
        </label>
        <label>
          惯用手
          <select
            value={hand}
            onChange={(e) => setHand(e.target.value as BadmintonPlayer["hand"])}
          >
            <option value="unknown">暂未填写</option>
            <option value="right">右手</option>
            <option value="left">左手</option>
          </select>
        </label>
      </div>
      <label>
        个人简介
        <textarea
          maxLength={300}
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="写下你的羽毛球宣言…"
        />
      </label>
      <button className="gb-btn gb-primary gb-full" disabled={busy}>
        {busy ? "正在保存…" : player ? "保存资料" : "登记球员"}
      </button>
    </form>
  );
}
function MatchForm({
  league,
  mode,
  match,
  result = false,
  onSave,
  busy,
}: {
  league: BadmintonLeague;
  mode: BadmintonMode;
  match?: BadmintonMatch;
  result?: boolean;
  onSave: Save;
  busy: boolean;
}) {
  const [kind, setKind] = useState<BadmintonMode>(match?.mode || mode),
    [time, setTime] = useState(inputDate(match?.time)),
    [round, setRound] = useState(match?.round || "日常对局");
  const [points, setPoints] = useState(
      match?.format.pointsToWin || league.settings.pointsToWin,
    ),
    [bestOf, setBestOf] = useState<1 | 3>(
      match?.format.bestOf || league.settings.bestOf,
    );
  const [home, setHome] = useState<string[]>(match?.homePlayers || ["", ""]),
    [away, setAway] = useState<string[]>(match?.awayPlayers || ["", ""]);
  const [games, setGames] = useState<GameScore[]>(
      match?.games || [{ home: 0, away: 0 }],
    ),
    [startNow, setStartNow] = useState(true),
    [replace, setReplace] = useState(false);
  const winBy = match ? (match.format.winBy ?? 1) : (league.settings.winBy ?? 2);
  const count = kind === "singles" ? 1 : 2;
  const roster = (side: "home" | "away") =>
    Array.from({ length: count }, (_, index) => {
      const current = side === "home" ? home : away,
        set = side === "home" ? setHome : setAway;
      const taken = [...home.slice(0, count), ...away.slice(0, count)].filter(
        (_, i) => i !== (side === "home" ? index : count + index),
      );
      return (
        <label key={index}>
          {kind === "singles" ? "出场球员" : `球员 ${index + 1}`}
          <select
            aria-label={`${side === "home" ? "A" : "B"}方球员${index + 1}`}
            required
            value={current[index] || ""}
            onChange={(e) =>
              set((values) => {
                const next = [...values];
                next[index] = e.target.value;
                return next;
              })
            }
          >
            <option value="">请选择球员</option>
            {league.players
              .filter(
                (p) =>
                  p.active ||
                  match?.homePlayers.includes(p.id) ||
                  match?.awayPlayers.includes(p.id),
              )
              .map((p) => (
                <option key={p.id} value={p.id} disabled={taken.includes(p.id)}>
                  {p.name}
                  {p.nickname ? ` · ${p.nickname}` : ""}
                </option>
              ))}
          </select>
        </label>
      );
    });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const selected = Array.from(
      { length: bestOf },
      (_, i) => games[i] || { home: 0, away: 0 },
    );
    while (
      selected.length > 1 &&
      selected.at(-1)!.home === 0 &&
      selected.at(-1)!.away === 0
    )
      selected.pop();
    void onSave(
      result ? "match.result" : "match.save",
      match?.id || crypto.randomUUID(),
      {
        mode: kind,
        time: `${time}:00+08:00`,
        round,
        homePlayers: home.slice(0, count),
        awayPlayers: away.slice(0, count),
        format: { pointsToWin: points, bestOf, winBy },
        games: selected,
        startNow,
        replaceDetailed: replace,
      },
      true,
    );
  };
  return (
    <form className="gb-form" onSubmit={submit}>
      <div className="gb-form-grid">
        <label>
          项目
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as BadmintonMode)}
          >
            <option value="doubles">双打 · 2 对 2</option>
            <option value="singles">单打 · 1 对 1</option>
          </select>
        </label>
        <label>
          比赛时间（北京时间）
          <input
            type="datetime-local"
            required
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        <label>
          比赛名称
          <input
            required
            maxLength={40}
            value={round}
            onChange={(e) => setRound(e.target.value)}
          />
        </label>
        <label>
          每局目标分
          <select
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
          >
            {[...new Set([11, 15, 21, points])]
              .sort((a, b) => a - b)
              .map((n) => (
                <option key={n} value={n}>
                  抢 {n} 分
                </option>
              ))}
          </select>
        </label>
        <label>
          局数
          <select
            value={bestOf}
            onChange={(e) => setBestOf(Number(e.target.value) as 1 | 3)}
          >
            <option value={1}>一局决胜</option>
            <option value={3}>三局两胜</option>
          </select>
        </label>
      </div>
      <p className="gb-help">
        默认11分、一局决胜；
        {badmintonRuleLabel({ pointsToWin: points, bestOf, winBy })}。
      </p>
      <div className="gb-roster-grid">
        <fieldset>
          <legend>A 方</legend>
          {roster("home")}
        </fieldset>
        <fieldset>
          <legend>B 方</legend>
          {roster("away")}
        </fieldset>
      </div>
      {result ? (
        <div className="gb-game-inputs">
          {Array.from({ length: bestOf }, (_, index) => (
            <fieldset key={index}>
              <legend>
                第 {index + 1} 局{index === 2 ? "（如有）" : ""}
              </legend>
              <div>
                <label>
                  A 方得分
                  <input
                    aria-label={`第${index + 1}局A方得分`}
                    type="number"
                    min={0}
                    max={winBy === 2 ? undefined : points}
                    required
                    value={games[index]?.home ?? 0}
                    onChange={(e) =>
                      setGames((g) => {
                        const a = [...g];
                        a[index] = {
                          ...(a[index] || { home: 0, away: 0 }),
                          home: Number(e.target.value),
                        };
                        return a;
                      })
                    }
                  />
                </label>
                <span>:</span>
                <label>
                  B 方得分
                  <input
                    aria-label={`第${index + 1}局B方得分`}
                    type="number"
                    min={0}
                    max={winBy === 2 ? undefined : points}
                    required
                    value={games[index]?.away ?? 0}
                    onChange={(e) =>
                      setGames((g) => {
                        const a = [...g];
                        a[index] = {
                          ...(a[index] || { home: 0, away: 0 }),
                          away: Number(e.target.value),
                        };
                        return a;
                      })
                    }
                  />
                </label>
              </div>
            </fieldset>
          ))}
          {match && match.pointEvents.length > 0 && (
            <label className="gb-check">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
                required
              />
              确认用本次填写的比分替换原逐分记录。
            </label>
          )}
        </div>
      ) : (
        <label className="gb-check">
          <input
            type="checkbox"
            checked={startNow}
            onChange={(e) => setStartNow(e.target.checked)}
          />
          保存后立即开始比赛
        </label>
      )}
      <button className="gb-btn gb-primary gb-full" disabled={busy}>
        {busy
          ? "正在保存…"
          : result
            ? "保存赛果并结算段位分"
            : startNow
              ? "开始比赛"
              : "保存赛程"}
      </button>
    </form>
  );
}
function ImportPlayers({
  league,
  onSave,
  busy,
}: {
  league: BadmintonLeague;
  onSave: Save;
  busy: boolean;
}) {
  const [source, setSource] = useState<
      Awaited<ReturnType<typeof sourceBadmintonPlayers>>["players"] | null
    >(null),
    [selected, setSelected] = useState<string[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    void sourceBadmintonPlayers()
      .then((r) => setSource(r.players))
      .catch((e) => setError(e.message));
  }, []);
  const registered = (id: string) =>
    league.players.some((p) => p.id === id || p.sourcePlayerId === id);
  return (
    <div className="gb-form">
      <p className="gb-help">
        选择 G超 的老朋友加入
        GB。仅沿用姓名、昵称和头像；羽毛球战绩与段位从零开始。
      </p>
      {error && <p className="gb-form-error">{error}</p>}
      {!source && !error && <p>正在读取球员名单…</p>}
      <div className="gb-import-list">
        {source?.map((p) => (
          <label className="gb-check" key={p.id}>
            <input
              type="checkbox"
              disabled={registered(p.id)}
              checked={registered(p.id) || selected.includes(p.id)}
              onChange={(e) =>
                setSelected((a) =>
                  e.target.checked ? [...a, p.id] : a.filter((x) => x !== p.id),
                )
              }
            />
            <span>
              {p.name}
              <small>{registered(p.id) ? "已加入 GB" : p.nickname}</small>
            </span>
          </label>
        ))}
      </div>
      <button
        className="gb-btn gb-primary gb-full"
        disabled={busy || selected.length === 0}
        onClick={() =>
          void onSave(
            "player.import",
            crypto.randomUUID(),
            { ids: selected },
            true,
          )
        }
      >
        登记选中的 {selected.length} 位球员
      </button>
    </div>
  );
}
function SettingsForm({
  league,
  onSave,
  busy,
}: {
  league: BadmintonLeague;
  onSave: Save;
  busy: boolean;
}) {
  const [season, setSeason] = useState(league.settings.season),
    [points, setPoints] = useState(league.settings.pointsToWin),
    [bestOf, setBestOf] = useState<1 | 3>(league.settings.bestOf);
  return (
    <form
      className="gb-form"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave(
          "settings.save",
          "settings",
          { season, pointsToWin: points, bestOf, winBy: 2 },
          true,
        );
      }}
    >
      <label>
        联赛标签
        <input
          required
          maxLength={30}
          value={season}
          onChange={(e) => setSeason(e.target.value)}
        />
      </label>
      <div className="gb-form-grid">
        <label>
          默认目标分
          <select
            value={points}
            onChange={(e) => setPoints(Number(e.target.value))}
          >
            {[11, 15, 21].map((n) => (
              <option key={n} value={n}>
                抢 {n} 分
              </option>
            ))}
          </select>
        </label>
        <label>
          默认局数
          <select
            value={bestOf}
            onChange={(e) => setBestOf(Number(e.target.value) as 1 | 3)}
          >
            <option value={1}>一局决胜</option>
            <option value={3}>三局两胜</option>
          </select>
        </label>
      </div>
      <p className="gb-help">
        默认赛制只影响之后创建的比赛。修改联赛标签不清空历史，也不重置段位。
      </p>
      <button className="gb-btn gb-primary gb-full" disabled={busy}>
        保存设置
      </button>
    </form>
  );
}

export default function Badminton({ route }: { route: string[] }) {
  const mode: BadmintonMode = route[0] === "singles" ? "singles" : "doubles",
    page = route[1] || "overview",
    detailId = route[2];
  const [snapshot, setSnapshot] = useState<BadmintonSnapshot | null>(null),
    [connected, setConnected] = useState(false),
    [loadError, setLoadError] = useState("");
  const [admin, setAdmin] = useState(() => Boolean(badmintonToken())),
    [busy, setBusy] = useState(false),
    [dialog, setDialog] = useState<Dialog | null>(null),
    [toast, setToast] = useState(""),
    [search, setSearch] = useState(""),
    [statusFilter, setStatusFilter] = useState("all");
  const current = useRef(snapshot);
  current.current = snapshot;
  const busyRef = useRef(false),
    pending = useRef<(() => void) | null>(null),
    mounted = useRef(true);
  const league = snapshot?.data || empty;
  const refresh = useCallback(async () => {
    try {
      const next = await badmintonRequest<BadmintonSnapshot>("/league");
      if (!mounted.current) return;
      setSnapshot((old) =>
        !old || next.revision >= old.revision ? next : old,
      );
      setConnected(true);
      setLoadError("");
    } catch (e) {
      if (mounted.current) {
        setConnected(false);
        setLoadError((e as Error).message);
      }
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(() => {
      if (!busyRef.current && document.visibilityState === "visible")
        void refresh();
    }, 5000);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [refresh]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    setSearch("");
  }, [page, mode]);
  const navigate = (next: string, id?: string) => {
    window.location.hash = `badminton/${mode}/${next}${id ? "/" + id : ""}`;
  };
  const withAdmin = (run: () => void) => {
    if (badmintonToken()) run();
    else {
      pending.current = run;
      setDialog({ kind: "login" });
    }
  };
  const open = (value: Dialog) => withAdmin(() => setDialog(value));
  const submit: Save = async (type, id, data, close = false) => {
    if (busyRef.current || !current.current) return false;
    busyRef.current = true;
    setBusy(true);
    try {
      const next = await saveBadmintonAction(
        { type, id, data, actionId: crypto.randomUUID() },
        current.current.revision,
      );
      setSnapshot((old) =>
        !old || next.revision >= old.revision ? next : old,
      );
      current.current = next;
      setConnected(true);
      if (close) setDialog(null);
      setToast(
        type === "point.add"
          ? "比分已记录"
          : type === "point.undo"
            ? "已撤销上一分"
            : "保存成功",
      );
      return true;
    } catch (e) {
      const error = e as Error & { status?: number };
      if (error.status === 401) {
        badmintonLogout();
        setAdmin(false);
      }
      if (error.status === 409) await refresh();
      setToast(error.message);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const act = (type: string, id: string, data?: unknown) =>
    withAdmin(() => void submit(type, id, data));
  const stats = useMemo(() => analyzeBadminton(league, mode), [league, mode]);
  const otherStats = useMemo(
    () => analyzeBadminton(league, mode === "singles" ? "doubles" : "singles"),
    [league, mode],
  );
  const matches = useMemo(
    () =>
      league.matches
        .filter((m) => m.mode === mode)
        .sort(
          (a, b) =>
            Date.parse(b.time) - Date.parse(a.time) ||
            b.createdAt.localeCompare(a.createdAt),
        ),
    [league, mode],
  );
  const finished = matches.filter((m) => m.status === "finished"),
    live = matches.filter((m) => m.status === "live");
  const player = (id: string) => league.players.find((p) => p.id === id);
  const names = (ids: string[]) =>
    ids.map((id) => player(id)?.name || "已归档球员").join(" / ");
  const formatLabel = (m: BadmintonMatch) =>
    `${m.format.pointsToWin}分 · ${m.format.bestOf === 1 ? "一局决胜" : "三局两胜"}`;
  const newMatch = (result = false) => open({ kind: "match", result });
  const matchCard = (match: BadmintonMatch) => {
    const score = badmintonScore(match),
      h = match.format.bestOf === 1 ? score.homePoints : score.homeGames,
      a = match.format.bestOf === 1 ? score.awayPoints : score.awayGames;
    return (
      <button
        className="gb-match-card"
        key={match.id}
        onClick={() => navigate("match", match.id)}
      >
        <div className="gb-match-meta">
          <span>{match.round}</span>
          <span className={`gb-status gb-status-${match.status}`}>
            {match.status === "live"
              ? "进行中"
              : match.status === "finished"
                ? "已完赛"
                : "待开赛"}
          </span>
        </div>
        <div className="gb-match-versus">
          <span>{names(match.homePlayers)}</span>
          <strong>
            {match.status === "scheduled" ? (
              "VS"
            ) : (
              <>
                {h}
                <em>:</em>
                {a}
              </>
            )}
          </strong>
          <span>{names(match.awayPlayers)}</span>
        </div>
        <div className="gb-match-subscore">
          {match.format.bestOf === 3 ? (
            match.games.map((g, i) => (
              <span key={i}>
                {g.home}:{g.away}
              </span>
            ))
          ) : (
            <span>{formatLabel(match)}</span>
          )}
        </div>
        <div className="gb-match-foot">
          <span>{when(match.time)}</span>
          <span>
            查看比赛 <ArrowUpRight size={14} />
          </span>
        </div>
      </button>
    );
  };
  const showRankTable = (rows: BadmintonStats[], compact = false) => (
    <div className="gb-table-wrap">
      <table className="gb-table">
        <thead>
          <tr>
            <th>排名</th>
            <th>球员</th>
            <th>段位分</th>
            <th>胜 / 负</th>
            {!compact && (
              <>
                <th>胜率</th>
                <th>最近一场</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.player.id}>
              <td>
                <span className={`gb-place ${i < 3 ? "gb-place-top" : ""}`}>
                  {i + 1}
                </span>
              </td>
              <td>
                <button
                  className="gb-player-link"
                  onClick={() => navigate("players", p.player.id)}
                >
                  <Avatar player={p.player} />
                  <span>
                    <b>{p.player.name}</b>
                    <small>
                      {p.player.nickname || modeName(mode) + "球员"}
                    </small>
                  </span>
                </button>
              </td>
              <td>
                <RankScore points={p.rankPoints} />
              </td>
              <td>
                {p.wins}
                <span className="gb-muted"> / {p.losses}</span>
              </td>
              {!compact && (
                <>
                  <td>
                    {p.games ? `${Math.round((p.wins / p.games) * 100)}%` : "—"}
                  </td>
                  <td>
                    <span
                      className={
                        p.history.at(-1)!.delta > 0
                          ? "gb-positive"
                          : "gb-negative"
                      }
                    >
                      {signed(p.history.at(-1)!.delta)}
                    </span>
                  </td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const ranked = stats.filter((p) => p.games > 0),
    selected =
      page === "match"
        ? league.matches.find((m) => m.id === detailId)
        : undefined;
  const profile =
    page === "players" && detailId
      ? stats.find((p) => p.player.id === detailId)
      : undefined;
  const activePlayers = league.players.filter((p) => p.active);
  const exportData = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            exportedAt: new Date().toISOString(),
            data: league,
            revision: snapshot?.revision,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `GB联赛-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <div className="gb-app">
      <aside className="gb-sidebar">
        <a className="gb-parent" href="#home">
          <ArrowLeft size={14} /> GAIR 超级联赛
        </a>
        <a className="gb-brand" href="#badminton">
          <span className="gb-brand-mark gb-brand-logo">
            <img src={gbLeagueLogo} alt="" width={1254} height={1254} />
          </span>
          <span>
            <b>GB 羽毛球联赛</b>
            <small>GAIR BADMINTON</small>
          </span>
        </a>
        <nav className="gb-mode-switch" aria-label="羽毛球项目">
          <a
            href="#badminton/doubles"
            aria-current={mode === "doubles" ? "page" : undefined}
          >
            <Users size={17} /> 双打
          </a>
          <a
            href="#badminton/singles"
            aria-current={mode === "singles" ? "page" : undefined}
          >
            <UserRound size={17} /> 单打
          </a>
        </nav>
        <span className="gb-side-label">YOUR COURT. YOUR GAME.</span>
        <nav className="gb-navigation" aria-label="羽毛球联赛导航">
          {navItems.map(([key, label, Icon]) => (
            <button
              key={key}
              aria-current={
                page === key || (page === "match" && key === "matches")
                  ? "page"
                  : undefined
              }
              onClick={() => navigate(key)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {key === "matches" && live.length > 0 && <i>{live.length}</i>}
            </button>
          ))}
        </nav>
        <div className="gb-side-bottom">
          <ShuttleIcon size={37} />
          <p>轻盈一拍，认真热爱。</p>
          <small>THE NEXT POINT IS YOURS.</small>
          <a href="#doubles">
            切换到 G超桌足 <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>
      <div className="gb-workspace">
        <header className="gb-topbar">
          <div>
            <span>羽毛球 · {modeName(mode)}</span>
            <ChevronRight size={14} />
            <b>
              {page === "match"
                ? "比赛详情"
                : profile
                  ? "球员档案"
                  : navItems.find((n) => n[0] === page)?.[1] || "联赛总览"}
            </b>
          </div>
          <div>
            <span
              className={`gb-connection ${connected ? "is-connected" : ""}`}
            >
              <i />
              {connected ? "实时同步" : "连接中"}
            </span>
            <button
              className="gb-text-btn"
              onClick={() => {
                if (admin) {
                  badmintonLogout();
                  setAdmin(false);
                  setToast("已退出管理");
                } else setDialog({ kind: "login" });
              }}
            >
              {admin ? <LogOut size={15} /> : <LogIn size={15} />}
              <span>{admin ? "退出管理" : "管理员登录"}</span>
            </button>
          </div>
        </header>
        <main className="gb-main">
          <div className="gb-season-strip">
            <span>{league.settings.season}</span>
            <span>
              {modeName(mode)} · {league.settings.pointsToWin}分 ·{" "}
              {league.settings.bestOf === 1 ? "一局决胜" : "三局两胜"}
            </span>
          </div>
          {!snapshot ? (
            <div className="gb-panel">
              <Empty
                title={loadError ? "暂时无法连接赛场" : "正在连接 GB 联赛…"}
                description={loadError || "正在获取最新的球员与比赛记录。"}
                action={
                  loadError ? (
                    <button className="gb-btn" onClick={() => void refresh()}>
                      <RefreshCw size={16} />
                      重新连接
                    </button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              {!connected && (
                <div className="gb-notice" role="alert">
                  连接暂时中断，当前显示上次同步的数据。
                  <button onClick={() => void refresh()}>重试</button>
                </div>
              )}
              {page === "overview" && (
                <>
                  <section className="gb-hero gb-hero-with-logo">
                    <div>
                      <span className="gb-eyebrow">
                        GAIR BADMINTON /{" "}
                        {modeName(mode) === "双打" ? "DOUBLES" : "SINGLES"}
                      </span>
                      <h1>
                        挥拍上场，
                        <br />
                        来真的。
                      </h1>
                      <p>
                        {mode === "doubles"
                          ? "把默契交给搭档，把下一分留给自己。"
                          : "一个人的球场，也能打出两个人的精彩。"}
                        <br />
                        {league.settings.pointsToWin}分，
                        {league.settings.bestOf === 1 ? "一局决胜" : "三局两胜"}
                        。下一场，轮到你。
                      </p>
                      <div className="gb-hero-actions">
                        <button
                          className="gb-btn gb-lime"
                          onClick={() => newMatch(false)}
                        >
                          <Plus size={17} /> 开始一场比赛
                        </button>
                        <button
                          className="gb-hero-link"
                          onClick={() => newMatch(true)}
                        >
                          赛后补录 <ArrowUpRight size={16} />
                        </button>
                      </div>
                    </div>
                    <a
                      className="gb-hero-art gb-hero-logo"
                      href={gbLeagueLogoFull}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="查看 GB 联赛 Logo 大图"
                    >
                      <img
                        src={gbLeagueLogo}
                        alt="GB 羽毛球联赛 Logo：九人彩虹热气球"
                        width={1254}
                        height={1254}
                      />
                    </a>
                  </section>
                  <LeagueAnnouncements sport="badminton" />
                  <section className="gb-stat-grid">
                    <div>
                      <span>
                        <Users size={17} /> 登记球员
                      </span>
                      <strong>
                        {activePlayers.length}
                        <small>位</small>
                      </strong>
                      <p>随时组队，随时上场</p>
                    </div>
                    <div>
                      <span>
                        <Trophy size={17} /> {modeName(mode)}完赛
                      </span>
                      <strong>
                        {finished.length}
                        <small>场</small>
                      </strong>
                      <p>每一场都留下记录</p>
                    </div>
                    <div>
                      <span>
                        <ShuttleIcon size={19} /> 正在进行
                      </span>
                      <strong>
                        {live.length}
                        <small>场</small>
                      </strong>
                      <p>{live.length ? "精彩正在发生" : "下一场由你开启"}</p>
                    </div>
                    <div>
                      <span>
                        <UserRound size={17} /> 参赛球员
                      </span>
                      <strong>
                        {ranked.length}
                        <small>位</small>
                      </strong>
                      <p>当前项目有完赛记录的球员</p>
                    </div>
                  </section>
                  <div className="gb-overview-grid">
                    <section className="gb-panel">
                      <div className="gb-panel-heading">
                        <h2>{live.length ? "正在进行" : "最近比赛"}</h2>
                        <button
                          className="gb-text-btn"
                          onClick={() => navigate("matches")}
                        >
                          全部比赛 <ArrowRight size={15} />
                        </button>
                      </div>
                      {matches.length ? (
                        <div className="gb-match-grid gb-match-grid-inner">
                          {(live.length ? live : matches)
                            .slice(0, 2)
                            .map(matchCard)}
                        </div>
                      ) : (
                        <Empty
                          title="第一场，等你开拍"
                          description={`${modeName(mode)}赛场已经准备好，登记阵容就能开始实时记分，也可以赛后补录比分。`}
                          action={
                            <button
                              className="gb-btn gb-primary"
                              onClick={() => newMatch()}
                            >
                              登记第一场 <ArrowRight size={16} />
                            </button>
                          }
                        />
                      )}
                    </section>
                    <section className="gb-panel">
                      <div className="gb-panel-heading">
                        <h2>{modeName(mode)}段位榜</h2>
                        <button
                          className="gb-text-btn"
                          onClick={() => navigate("rankings")}
                        >
                          完整榜单 <ArrowRight size={15} />
                        </button>
                      </div>
                      {ranked.length ? (
                        showRankTable(ranked.slice(0, 5), true)
                      ) : (
                        <Empty
                          title="你的段位，由下一场开启"
                          description="每位球员从1200分出发。确认完赛后，按对手实力和胜负结算；单打、双打独立排名。"
                        />
                      )}
                    </section>
                  </div>
                  <section className="gb-player-preview">
                    <div className="gb-section-heading">
                      <div>
                        <span className="gb-eyebrow">MEET THE PLAYERS</span>
                        <h2>一起上场的人</h2>
                      </div>
                      <button
                        className="gb-text-btn"
                        onClick={() => navigate("players")}
                      >
                        全部球员 <ArrowRight size={16} />
                      </button>
                    </div>
                    <div className="gb-player-grid">
                      {activePlayers.slice(0, 4).map((p) => (
                        <button
                          className="gb-player-card"
                          key={p.id}
                          onClick={() => navigate("players", p.id)}
                        >
                          <Avatar player={p} />
                          <b>{p.name}</b>
                          <span>{p.nickname || "期待下一场相遇"}</span>
                          <ArrowUpRight size={18} />
                        </button>
                      ))}
                    </div>
                    {!activePlayers.length && (
                      <div className="gb-panel">
                        <Empty
                          title="邀请你的第一位搭档"
                          description="可以直接登记新球员，也可以从 G超 名单中选择老朋友加入。"
                          action={
                            <button
                              className="gb-btn"
                              onClick={() => open({ kind: "import" })}
                            >
                              从 G超 名单加入
                            </button>
                          }
                        />
                      </div>
                    )}
                  </section>
                </>
              )}
              {page === "matches" && (
                <>
                  <div className="gb-page-heading">
                    <div>
                      <span className="gb-eyebrow">MATCH CENTER</span>
                      <h1>下一分，见真章。</h1>
                      <p>赛前登记，现场记分；赛后也能把精彩补上。</p>
                    </div>
                    <div className="gb-heading-actions">
                      <button className="gb-btn" onClick={() => newMatch(true)}>
                        录入赛后比分
                      </button>
                      <button
                        className="gb-btn gb-primary"
                        onClick={() => newMatch()}
                      >
                        <Plus size={16} />
                        新建比赛
                      </button>
                    </div>
                  </div>
                  <div className="gb-filterbar">
                    <div className="gb-tabs" aria-label="比赛状态">
                      {[
                        ["all", "全部"],
                        ["live", "进行中"],
                        ["scheduled", "待开赛"],
                        ["finished", "已完赛"],
                      ].map(([v, label]) => (
                        <button
                          key={v}
                          aria-pressed={statusFilter === v}
                          onClick={() => setStatusFilter(v)}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <span>
                      {
                        matches.filter(
                          (m) =>
                            statusFilter === "all" || m.status === statusFilter,
                        ).length
                      }{" "}
                      场{modeName(mode)}比赛
                    </span>
                  </div>
                  {matches.some(
                    (m) => statusFilter === "all" || m.status === statusFilter,
                  ) ? (
                    <div className="gb-match-grid">
                      {matches
                        .filter(
                          (m) =>
                            statusFilter === "all" || m.status === statusFilter,
                        )
                        .map(matchCard)}
                    </div>
                  ) : (
                    <div className="gb-panel">
                      <Empty
                        title="这里还没有比赛"
                        description="登记一场对决，赛程、比分和个人战绩就会同步更新。"
                        action={
                          <button
                            className="gb-btn gb-primary"
                            onClick={() => newMatch()}
                          >
                            新建比赛
                          </button>
                        }
                      />
                    </div>
                  )}
                </>
              )}
              {page === "match" &&
                (selected ? (
                  <>
                    <button
                      className="gb-back"
                      onClick={() => navigate("matches")}
                    >
                      <ArrowLeft size={16} />
                      返回赛程与比分
                    </button>
                    <section className="gb-scoreboard">
                      <div className="gb-match-meta">
                        <span>
                          {selected.round} · {when(selected.time)}（北京时间）
                        </span>
                        <span
                          className={`gb-status gb-status-${selected.status}`}
                        >
                          {selected.status === "finished"
                            ? "全场结束"
                            : selected.status === "live"
                              ? "正在进行"
                              : "即将开始"}
                        </span>
                      </div>
                      <div className="gb-format-tag">
                        {modeName(selected.mode)} · {formatLabel(selected)} ·
                        {badmintonRuleLabel(selected.format)}
                      </div>
                      <div className="gb-large-versus">
                        <div>
                          {selected.homePlayers.map((id) => (
                            <button
                              key={id}
                              onClick={() => navigate("players", id)}
                            >
                              {player(id) && <Avatar player={player(id)!} />}
                              <b>{player(id)?.name}</b>
                            </button>
                          ))}
                          <small>A 方</small>
                        </div>
                        <strong>
                          {selected.format.bestOf === 1
                            ? badmintonScore(selected).homePoints
                            : badmintonScore(selected).homeGames}
                          <em>:</em>
                          {selected.format.bestOf === 1
                            ? badmintonScore(selected).awayPoints
                            : badmintonScore(selected).awayGames}
                        </strong>
                        <div>
                          {selected.awayPlayers.map((id) => (
                            <button
                              key={id}
                              onClick={() => navigate("players", id)}
                            >
                              {player(id) && <Avatar player={player(id)!} />}
                              <b>{player(id)?.name}</b>
                            </button>
                          ))}
                          <small>B 方</small>
                        </div>
                      </div>
                      <div className="gb-set-scores">
                        {selected.games.map((g, i) => (
                          <span key={i}>
                            第{i + 1}局{" "}
                            <b>
                              {g.home}:{g.away}
                            </b>
                          </span>
                        ))}
                      </div>
                      {selected.status === "live" &&
                        selected.recording === "points" && (
                          <div className="gb-live-controls">
                            <button
                              className="gb-btn gb-score-plus"
                              disabled={
                                busy || Boolean(badmintonWinner(selected))
                              }
                              onClick={() =>
                                act("point.add", selected.id, { side: "home" })
                              }
                            >
                              <Plus size={19} /> A 方得分
                            </button>
                            <button
                              className="gb-btn gb-score-plus"
                              disabled={
                                busy || Boolean(badmintonWinner(selected))
                              }
                              onClick={() =>
                                act("point.add", selected.id, { side: "away" })
                              }
                            >
                              <Plus size={19} /> B 方得分
                            </button>
                          </div>
                        )}
                      <div className="gb-scoreboard-actions">
                        {selected.status === "scheduled" && (
                          <>
                            <button
                              className="gb-btn gb-primary"
                              disabled={busy}
                              onClick={() => act("match.start", selected.id)}
                            >
                              开始比赛
                            </button>
                            <button
                              className="gb-btn"
                              onClick={() =>
                                open({ kind: "match", match: selected })
                              }
                            >
                              编辑赛程
                            </button>
                          </>
                        )}
                        {selected.status === "live" && (
                          <>
                            {selected.recording === "points" && (
                              <button
                                className="gb-btn"
                                disabled={busy || !selected.pointEvents.length}
                                onClick={() => act("point.undo", selected.id)}
                              >
                                <Undo2 size={16} />
                                撤销上一分
                              </button>
                            )}
                            <button
                              className="gb-btn gb-primary"
                              disabled={busy || !badmintonWinner(selected)}
                              onClick={() =>
                                open({
                                  kind: "confirm",
                                  title: "确认完赛",
                                  message: `${names(selected.homePlayers)} 对 ${names(selected.awayPlayers)}，各局比分 ${selected.games.map((g) => `${g.home}:${g.away}`).join("、")}。确认后将结算本场战绩和段位分。`,
                                  run: () =>
                                    submit(
                                      "match.finish",
                                      selected.id,
                                      undefined,
                                      true,
                                    ),
                                })
                              }
                            >
                              <Check size={16} />
                              确认完赛
                            </button>
                          </>
                        )}
                        {selected.status === "finished" &&
                          selected.recording === "points" && (
                            <button
                              className="gb-btn"
                              onClick={() =>
                                open({
                                  kind: "confirm",
                                  title: "重新打开比赛",
                                  message:
                                    "重新打开后，本场暂时退出战绩和段位结算。修正比分并再次确认完赛即可重新计算。",
                                  run: () =>
                                    submit(
                                      "match.reopen",
                                      selected.id,
                                      undefined,
                                      true,
                                    ),
                                })
                              }
                            >
                              重新打开比赛
                            </button>
                          )}
                        <button
                          className="gb-btn"
                          onClick={() =>
                            open({
                              kind: "match",
                              match: selected,
                              result: true,
                            })
                          }
                        >
                          <Pencil size={15} />
                          {selected.status === "finished"
                            ? "修正赛后比分"
                            : "直接录入赛果"}
                        </button>
                      </div>
                      {selected.status === "live" &&
                        badmintonWinner(selected) && (
                          <p className="gb-score-hint">
                            已达到完赛条件，请核对比分并点击「确认完赛」。
                          </p>
                        )}
                    </section>
                    {selected.status === "finished" && (
                      <section className="gb-panel">
                        <div className="gb-panel-heading">
                          <h2>本场段位分变化</h2>
                          <span>{modeName(selected.mode)}独立结算</span>
                        </div>
                        <div className="gb-table-wrap">
                          <table className="gb-table">
                            <thead>
                              <tr>
                                <th>球员</th>
                                <th>赛果</th>
                                <th>赛前</th>
                                <th>赛后</th>
                                <th>变化</th>
                              </tr>
                            </thead>
                            <tbody>
                              {analyzeBadminton(league, selected.mode)
                                .filter((p) =>
                                  [
                                    ...selected.homePlayers,
                                    ...selected.awayPlayers,
                                  ].includes(p.player.id),
                                )
                                .map((p) => {
                                  const h = p.history.find(
                                    (h) => h.match.id === selected.id,
                                  );
                                  return h ? (
                                    <tr key={p.player.id}>
                                      <td>
                                        <button
                                          className="gb-player-link"
                                          onClick={() =>
                                            navigate("players", p.player.id)
                                          }
                                        >
                                          {p.player.name}
                                        </button>
                                      </td>
                                      <td>{h.result === "W" ? "胜" : "负"}</td>
                                      <td>{h.before}</td>
                                      <td>{h.after}</td>
                                      <td
                                        className={
                                          h.delta > 0
                                            ? "gb-positive"
                                            : "gb-negative"
                                        }
                                      >
                                        {signed(h.delta)}
                                        <DailyRewardBreakdown
                                          baseDelta={h.baseDelta}
                                          firstWinBonus={h.firstWinBonus}
                                          participationBonus={h.participationBonus}
                                          className="gb-first-win-breakdown"
                                        />
                                      </td>
                                    </tr>
                                  ) : null;
                                })}
                            </tbody>
                          </table>
                        </div>
                      </section>
                    )}
                    <section className="gb-panel">
                      <div className="gb-panel-heading">
                        <h2>逐分记录</h2>
                        <span>{selected.pointEvents.length} 条</span>
                      </div>
                      {selected.recording === "summary" ? (
                        <p className="gb-panel-note">
                          本场使用赛后比分登记，保留每局最终比分；没有推测逐分过程。
                        </p>
                      ) : selected.pointEvents.length ? (
                        <div className="gb-point-log">
                          {selected.pointEvents.map((event, i) => {
                            const next =
                                selected.pointEvents[i + 1]?.previousGames ||
                                selected.games,
                              currentGame = next.at(-1)!;
                            return (
                              <div key={event.id}>
                                <span>{i + 1}</span>
                                <b>
                                  {event.side === "home" ? "A" : "B"} 方得分
                                </b>
                                <small>第 {next.length} 局</small>
                                <strong>
                                  {currentGame.home} : {currentGame.away}
                                </strong>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="gb-panel-note">
                          比赛开始后，点击得分方 +1 即可记分。
                        </p>
                      )}
                    </section>
                    <div className="gb-delete-row">
                      <span>误建比赛可以删除，相关战绩和段位将重新计算。</span>
                      <button
                        className="gb-text-btn gb-danger"
                        onClick={() =>
                          open({
                            kind: "confirm",
                            title: "删除这场比赛",
                            message:
                              "确认删除此比赛及其逐分记录？相关球员的后续段位将重新计算。",
                            run: async () => {
                              const ok = await submit(
                                "match.delete",
                                selected.id,
                                undefined,
                                true,
                              );
                              if (ok) navigate("matches");
                              return ok;
                            },
                          })
                        }
                      >
                        删除比赛
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="gb-panel">
                    <Empty
                      title="找不到这场比赛"
                      description="比赛可能已经被移除，请返回赛程查看。"
                      action={
                        <button
                          className="gb-btn"
                          onClick={() => navigate("matches")}
                        >
                          返回赛程
                        </button>
                      }
                    />
                  </div>
                ))}
              {page === "rankings" && (
                <>
                  <div className="gb-page-heading">
                    <div>
                      <span className="gb-eyebrow">PLAYER RANKINGS</span>
                      <h1>实力，一场场打出来。</h1>
                      <p>
                        {modeName(mode)}独立排名 · 初始1200分 ·
                        每日参与 +5 或首胜 +10，按项目互斥计算。
                      </p>
                    </div>
                  </div>
                  <section className="gb-panel">
                    {ranked.length ? (
                      showRankTable(ranked)
                    ) : (
                      <Empty
                        title="还没有已完赛的对局"
                        description="确认首场比赛后，这里会出现排名。未出场球员保留1200起始分，不参与比赛排名。"
                      />
                    )}
                  </section>
                  {mode === "doubles" && (
                    <section className="gb-panel">
                      <div className="gb-panel-heading">
                        <h2>默契搭档榜</h2>
                        <span>按组合胜率排序，少于3场标注小样本</span>
                      </div>
                      {badmintonPairs(league).length ? (
                        <div className="gb-table-wrap">
                          <table className="gb-table">
                            <thead>
                              <tr>
                                <th>搭档</th>
                                <th>场次</th>
                                <th>胜 / 负</th>
                                <th>胜率</th>
                              </tr>
                            </thead>
                            <tbody>
                              {badmintonPairs(league).map((p) => (
                                <tr key={p.ids.join(":")}>
                                  <td>
                                    {names(p.ids)}
                                    {p.games < 3 && (
                                      <small className="gb-sample">
                                        小样本
                                      </small>
                                    )}
                                  </td>
                                  <td>{p.games}</td>
                                  <td>
                                    {p.wins} / {p.games - p.wins}
                                  </td>
                                  <td>
                                    {Math.round((p.wins / p.games) * 100)}%
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="gb-panel-note">
                          双打完赛后，自动统计搭档组合的出场、胜负和胜率。
                        </p>
                      )}
                    </section>
                  )}
                </>
              )}
              {page === "players" &&
                (detailId ? (
                  profile ? (
                    <>
                      <button
                        className="gb-back"
                        onClick={() => navigate("players")}
                      >
                        <ArrowLeft size={16} />
                        返回球员档案
                      </button>
                      <section className="gb-profile-hero">
                        <div className="gb-profile-person">
                          <Avatar player={profile.player} large />
                          <div>
                            <span className="gb-eyebrow">
                              GAIR BADMINTON PLAYER
                            </span>
                            <h1>{profile.player.name}</h1>
                            <p>
                              {profile.player.nickname ||
                                "热爱，就是最好的开场。"}
                            </p>
                            <span className="gb-tag">
                              {profile.player.hand === "unknown"
                                ? "惯用手待填写"
                                : profile.player.hand === "right"
                                  ? "右手持拍"
                                  : "左手持拍"}
                            </span>
                            {!profile.player.active && (
                              <span className="gb-tag">已暂停登记</span>
                            )}
                          </div>
                        </div>
                        <div className="gb-profile-rank">
                          <span>{modeName(mode)}段位分</span>
                          <RankScore points={profile.rankPoints} showTier />
                          {profile.firstWinPoints > 0 && (
                            <small>已含首胜奖励 +{profile.firstWinPoints}</small>
                          )}
                          {profile.participationPoints > 0 && (
                            <small>已含参与奖励 +{profile.participationPoints}</small>
                          )}
                          <small>
                            {profile.games
                              ? `${profile.games} 场比赛 · ${profile.wins} 胜 ${profile.losses} 负`
                              : "尚未参加本项目比赛"}
                          </small>
                          <button
                            className="gb-btn"
                            onClick={() =>
                              open({ kind: "player", player: profile.player })
                            }
                          >
                            <Pencil size={14} />
                            编辑资料
                          </button>
                        </div>
                      </section>
                      {profile.player.bio && (
                        <p className="gb-bio">{profile.player.bio}</p>
                      )}
                      <div className="gb-profile-numbers">
                        <div>
                          <span>胜率</span>
                          <b>
                            {profile.games
                              ? `${Math.round((profile.wins / profile.games) * 100)}%`
                              : "—"}
                          </b>
                        </div>
                        <div>
                          <span>最近一场</span>
                          <b
                            className={
                              profile.history.at(-1)?.delta &&
                              profile.history.at(-1)!.delta > 0
                                ? "gb-positive"
                                : ""
                            }
                          >
                            {profile.history.length
                              ? signed(profile.history.at(-1)!.delta)
                              : "—"}
                          </b>
                        </div>
                        <div>
                          <span>累计段位变化</span>
                          <b>{signed(profile.rankPoints - 1200)}</b>
                        </div>
                        <div>
                          <span>
                            {mode === "singles" ? "双打" : "单打"}段位分
                          </span>
                          <b>
                            {otherStats.find(
                              (p) => p.player.id === profile.player.id,
                            )?.rankPoints ?? 1200}
                          </b>
                        </div>
                      </div>
                      <section className="gb-panel">
                        <div className="gb-panel-heading">
                          <h2>每场加减分</h2>
                          <span>{modeName(mode)} · 最近比赛在前</span>
                        </div>
                        {profile.history.length ? (
                          <div className="gb-history-list">
                            {[...profile.history].reverse().map((h) => (
                              <button
                                key={h.match.id}
                                onClick={() => navigate("match", h.match.id)}
                              >
                                <span
                                  className={`gb-result gb-result-${h.result}`}
                                >
                                  {h.result === "W" ? "胜" : "负"}
                                </span>
                                <span>
                                  <b>{h.match.round}</b>
                                  <small>
                                    {when(h.match.time)} ·{" "}
                                    {h.match.games
                                      .map((g) => `${g.home}:${g.away}`)
                                      .join(" / ")}
                                  </small>
                                  <small>
                                    {h.partnerIds.length
                                      ? `搭档：${names(h.partnerIds)} · `
                                      : ""}
                                    对手：{names(h.opponentIds)}
                                  </small>
                                </span>
                                <span className="gb-history-change">
                                  <b
                                    className={
                                      h.delta > 0
                                        ? "gb-positive"
                                        : "gb-negative"
                                    }
                                  >
                                    {signed(h.delta)}
                                  </b>
                                  <small>
                                    {h.before} → {h.after}
                                  </small>
                                  <DailyRewardBreakdown
                                    baseDelta={h.baseDelta}
                                    firstWinBonus={h.firstWinBonus}
                                    participationBonus={h.participationBonus}
                                    className="gb-first-win-breakdown"
                                  />
                                </span>
                                <ChevronRight size={16} />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <Empty
                            title="下一场，写下你的第一笔战绩"
                            description="确认完赛后，这里会逐场显示比分、搭档、对手，以及赛前、赛后段位和加减分。"
                          />
                        )}
                      </section>
                      <div className="gb-delete-row">
                        <span>
                          {profile.player.active
                            ? "暂停登记后，历史记录保留，之后可恢复。"
                            : "恢复登记后，即可再次选择该球员参加比赛。"}
                        </span>
                        <button
                          className="gb-text-btn"
                          onClick={() =>
                            open({
                              kind: "confirm",
                              title: profile.player.active
                                ? "暂停球员登记"
                                : "恢复球员登记",
                              message: profile.player.active
                                ? "历史比赛和段位不会删除，暂不出现在新比赛名单中。"
                                : "恢复后可继续参加 GB 比赛。",
                              run: () =>
                                submit(
                                  "player.active",
                                  profile.player.id,
                                  { active: !profile.player.active },
                                  true,
                                ),
                            })
                          }
                        >
                          {profile.player.active ? "暂停登记" : "恢复登记"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="gb-panel">
                      <Empty
                        title="球员档案不存在"
                        description="请返回球员列表查看。"
                        action={
                          <button
                            className="gb-btn"
                            onClick={() => navigate("players")}
                          >
                            返回球员列表
                          </button>
                        }
                      />
                    </div>
                  )
                ) : (
                  <>
                    <div className="gb-page-heading">
                      <div>
                        <span className="gb-eyebrow">OUR PLAYERS</span>
                        <h1>一起上场的人。</h1>
                        <p>点开球员，查看胜负、搭档和每场段位加减分。</p>
                      </div>
                      <div className="gb-heading-actions">
                        <button
                          className="gb-btn"
                          onClick={() => open({ kind: "import" })}
                        >
                          从 G超 名单加入
                        </button>
                        <button
                          className="gb-btn gb-primary"
                          onClick={() => open({ kind: "player" })}
                        >
                          <Plus size={16} />
                          登记新球员
                        </button>
                      </div>
                    </div>
                    <div className="gb-filterbar">
                      <input
                        aria-label="搜索球员"
                        placeholder="搜索姓名或昵称…"
                        className="gb-search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                      <span>{league.players.length} 位登记球员</span>
                    </div>
                    <div className="gb-player-grid">
                      {stats
                        .filter((p) =>
                          `${p.player.name} ${p.player.nickname}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                        )
                        .map((p) => (
                          <button
                            className="gb-player-card gb-player-card-full"
                            key={p.player.id}
                            onClick={() => navigate("players", p.player.id)}
                          >
                            <Avatar player={p.player} large />
                            <b>{p.player.name}</b>
                            <span>
                              {p.player.nickname || "GB 联赛球员"}
                              {!p.player.active ? " · 已暂停" : ""}
                            </span>
                            <div>
                              <span>
                                <small>{modeName(mode)}段位</small>
                                <strong>{p.rankPoints}</strong>
                              </span>
                              <span>
                                <small>出场</small>
                                <strong>{p.games}</strong>
                              </span>
                              <span>
                                <small>胜率</small>
                                <strong>
                                  {p.games
                                    ? `${Math.round((p.wins / p.games) * 100)}%`
                                    : "—"}
                                </strong>
                              </span>
                            </div>
                          </button>
                        ))}
                    </div>
                    {!league.players.length && (
                      <div className="gb-panel">
                        <Empty
                          title="欢迎第一位 GB 球员"
                          description="登记后即可参加单打和双打，两个项目分别记录战绩。"
                          action={
                            <button
                              className="gb-btn gb-primary"
                              onClick={() => open({ kind: "player" })}
                            >
                              登记球员
                            </button>
                          }
                        />
                      </div>
                    )}
                  </>
                ))}
              {page === "settings" && (
                <>
                  <div className="gb-page-heading">
                    <div>
                      <span className="gb-eyebrow">LEAGUE SETTINGS</span>
                      <h1>约好规则，尽情开打。</h1>
                      <p>让每一场比赛都有清楚的记分方式。</p>
                    </div>
                  </div>
                  <div className="gb-settings-grid">
                    <section className="gb-panel gb-settings-card">
                      <Settings size={24} />
                      <h2>联赛与默认赛制</h2>
                      <dl>
                        <div>
                          <dt>联赛标签</dt>
                          <dd>{league.settings.season}</dd>
                        </div>
                        <div>
                          <dt>每局目标</dt>
                          <dd>
                            {league.settings.pointsToWin}分，
                            {badmintonRuleLabel({ ...league.settings, winBy: league.settings.winBy ?? 2 })}
                          </dd>
                        </div>
                        <div>
                          <dt>局数</dt>
                          <dd>
                            {league.settings.bestOf === 1
                              ? "一局决胜"
                              : "三局两胜"}
                          </dd>
                        </div>
                      </dl>
                      <p>每场可单独选择赛制。修改默认设置不会改变已有比赛。</p>
                      <button
                        className="gb-btn"
                        onClick={() => open({ kind: "settings" })}
                      >
                        修改默认设置
                      </button>
                    </section>
                    <section className="gb-panel gb-settings-card">
                      <Download size={24} />
                      <h2>导出比赛记录</h2>
                      <p>
                        导出 GB
                        全部球员、比赛、逐分记录和设置。头像以来源链接保留。
                      </p>
                      <button className="gb-btn" onClick={exportData}>
                        <Download size={16} />
                        导出 GB 数据
                      </button>
                    </section>
                  </div>
                  <section className="gb-panel gb-rules">
                    <h2>战绩与段位，怎么算？</h2>
                    <p>
                      单双打分别从1200分开始，桌足成绩不参与羽毛球计算。只结算已确认完赛的比赛；正在进行的比分不提前计入战绩。
                    </p>
                    <p>
                      Elo 计分：胜方获得、负方扣除 32 ×（实际赛果 −
                      赛前预期胜率）。单打比较两人的基础段位，双打比较两位搭档的平均基础段位；同队的基础加减分相同，四舍五入到整数，基础段位最低0分。
                    </p>
                    <p>
                      每日奖励从首场有效比赛开始补算，按北京时间00:00刷新资格，单打、双打分别计算。当日完成有效比赛但没有获胜，领取参与 +5；当日取得首胜则仅领取首胜 +10，参与分自动取消，不叠加成 +15。同队球员各自判断资格；每日奖励单独累加，不参与正常胜负加减分的计算，逐场记录显示奖励明细。
                    </p>
                    <p>
                      战胜更强的对手加分更多。比分只用于判断每局和整场胜负，不因多赢几分额外加成。修改、重新打开或删除历史比赛后，后续段位按比赛时间重新计算。
                    </p>
                    <p>
                      羽毛球按每回合得分记账，没有桌足的前锋、后卫或乌龙球分类。少于3场的搭档组合标为小样本，胜率不代表稳定实力。
                    </p>
                    <p>
                      所有人都可以查看；登记和修正数据需要管理员登录。球员可暂停登记，历史比赛与段位保留。
                    </p>
                  </section>
                </>
              )}
            </>
          )}
          <footer className="gb-footer">
            <b>GB · GAIR BADMINTON</b>
            <span>轻盈一拍，认真热爱。</span>
            <a href="#home">
              GAIR 超级联赛 <ArrowUpRight size={13} />
            </a>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="gb-toast" role="status">
          {toast}
        </div>
      )}
      {dialog && (
        <Modal
          title={
            dialog.kind === "login"
              ? "管理员登录"
              : dialog.kind === "player"
                ? dialog.player
                  ? "编辑球员资料"
                  : "登记 GB 球员"
                : dialog.kind === "match"
                  ? dialog.result
                    ? "录入赛后比分"
                    : dialog.match
                      ? "编辑比赛"
                      : "新建比赛"
                  : dialog.kind === "import"
                    ? "从 G超 名单加入"
                    : dialog.kind === "settings"
                      ? "联赛默认设置"
                      : dialog.title
          }
          busy={busy}
          onClose={() => {
            pending.current = null;
            setDialog(null);
          }}
        >
          {dialog.kind === "login" ? (
            <LoginForm
              busy={busy}
              setBusy={setBusy}
              onLogged={() => {
                setAdmin(true);
                setDialog(null);
                const run = pending.current;
                pending.current = null;
                run?.();
              }}
            />
          ) : dialog.kind === "player" ? (
            <PlayerForm player={dialog.player} busy={busy} onSave={submit} />
          ) : dialog.kind === "match" ? (
            <MatchForm
              league={league}
              mode={mode}
              match={dialog.match}
              result={dialog.result}
              busy={busy}
              onSave={async (...args) => {
                const ok = await submit(...args);
                if (ok) navigate("matches");
                return ok;
              }}
            />
          ) : dialog.kind === "import" ? (
            <ImportPlayers league={league} busy={busy} onSave={submit} />
          ) : dialog.kind === "settings" ? (
            <SettingsForm league={league} busy={busy} onSave={submit} />
          ) : (
            <div className="gb-form">
              <p className="gb-confirm-text">{dialog.message}</p>
              <button
                className="gb-btn gb-primary gb-full"
                disabled={busy}
                onClick={() => void dialog.run()}
              >
                {busy ? "正在保存…" : "确认"}
              </button>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
