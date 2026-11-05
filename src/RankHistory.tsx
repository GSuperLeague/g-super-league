import { useState } from "react";
import { ArrowRight, ChevronDown, ChevronRight, History } from "lucide-react";
import { rankHistorySummary } from "../lib/rank-history.ts";
import type { RankHistoryEntry } from "../lib/rank-history.ts";
import { DailyRewardBreakdown } from "./DailyRewardBreakdown";
import "./rank-history.css";

const signed = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${value}`;
const tone = (value: number | null) =>
  value === null || value === 0
    ? "neutral"
    : value > 0
      ? "positive"
      : "negative";
const resultLabels = { W: "胜", D: "平", L: "负" };
const dates = new Intl.DateTimeFormat("zh-CN", {
  timeZone: "Asia/Shanghai",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function RankHistory({
  entries,
  label,
  playerName,
  onMatch,
}: {
  entries: RankHistoryEntry[];
  label: string;
  playerName: (id: string) => string;
  onMatch: (id: string) => void;
}) {
  const [limit, setLimit] = useState(10);
  const summary = rankHistorySummary(entries);
  const firstWinPoints = entries.reduce(
    (sum, entry) => sum + (entry.firstWinBonus || 0),
    0,
  );
  const participationPoints = entries.reduce(
    (sum, entry) => sum + (entry.participationBonus || 0), 0,
  );
  return (
    <section className="rank-history" aria-label="每场加减分">
      <header className="rank-history-heading">
        <div>
          <h2>
            <History size={18} />
            每场加减分
          </h2>
          <p>{label} · 当前赛季 · 最近在前</p>
        </div>
        <span className="rank-history-count">{entries.length} 场完赛</span>
      </header>
      <dl className="rank-history-summary">
        <div>
          <dt>最近一场</dt>
          <dd className={tone(summary.latest)}>{signed(summary.latest)}</dd>
        </div>
        <div>
          <dt>本赛季累计</dt>
          <dd className={tone(summary.total)}>{signed(summary.total)}</dd>
        </div>
        <div>
          <dt>有效计分</dt>
          <dd>
            {summary.ratedGames}
            <small> 场</small>
          </dd>
        </div>
      </dl>
      {entries.length ? (
        <ol className="rank-history-list">
          {entries.slice(0, limit).map((entry, index) => (
            <li key={entry.matchId}>
              <button
                type="button"
                className="rank-history-row"
                onClick={() => onMatch(entry.matchId)}
                aria-label={`最近第 ${index + 1} 场，${entry.round || dates.format(new Date(entry.time))}，${resultLabels[entry.result]} ${entry.gf} 比 ${entry.ga}，段位分 ${signed(entry.delta)}，查看比赛`}
              >
                <span className="rank-history-order">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="rank-history-match">
                  <span className="rank-history-meta">
                    <span className={`rank-history-result ${entry.result}`}>
                      {resultLabels[entry.result]}
                    </span>
                    <b>
                      {entry.gf} : {entry.ga}
                    </b>
                    <time dateTime={entry.time}>
                      {dates.format(new Date(entry.time))}
                    </time>
                    {index === 0 && (
                      <span className="rank-history-latest">最近一场</span>
                    )}
                  </span>
                  <span className="rank-history-opponents">
                    对阵{" "}
                    {entry.opponentIds.map(playerName).join(" / ") ||
                      "未知球员"}
                  </span>
                  <span className="rank-history-context">
                    {entry.partnerIds.length > 0 &&
                      `搭档 ${entry.partnerIds.map(playerName).join(" / ")} · `}
                    {entry.role
                      ? `本场${entry.role === "forward" ? "前锋" : "后卫"}`
                      : entry.round || "单场结算"}
                  </span>
                  {entry.role && entry.round && (
                    <span className="rank-history-round">{entry.round}</span>
                  )}
                </span>
                <span className="rank-history-points">
                  <strong className={tone(entry.delta)}>
                    {signed(entry.delta)}
                  </strong>
                  <DailyRewardBreakdown
                    baseDelta={entry.baseDelta ?? (entry.delta === null ? null : entry.delta - (entry.firstWinBonus || 0) - (entry.participationBonus || 0))}
                    firstWinBonus={entry.firstWinBonus}
                    participationBonus={entry.participationBonus}
                    firstWinLabel={entry.role === "forward" ? "前锋首胜" : entry.role === "defender" ? "后卫首胜" : "每日首胜"}
                  />
                  {entry.delta === null ? (
                    <small>未计分</small>
                  ) : (
                    <span className="rank-history-transition">
                      <span>
                        <small>赛前</small>
                        {entry.before}
                      </span>
                      <ArrowRight size={12} aria-hidden="true" />
                      <span>
                        <small>赛后</small>
                        {entry.after}
                      </span>
                    </span>
                  )}
                </span>
                <ChevronRight
                  className="rank-history-open"
                  size={16}
                  aria-hidden="true"
                />
              </button>
            </li>
          ))}
        </ol>
      ) : (
        <p className="rank-history-empty">
          当前赛季暂无
          {label === "总段位分" || label === "单打段位分"
            ? ""
            : label.replace("段位分", "") + "位置的"}
          已完赛记录
        </p>
      )}
      <footer className="rank-history-footer">
        <p>
          仅累计本赛季的完赛结算，不含赛季继承。
          {firstWinPoints > 0 && (
            <span className="rank-history-first-win-total">
              已含首胜奖励 +{firstWinPoints}
            </span>
          )}
          {participationPoints > 0 && (
            <span className="rank-history-first-win-total">
              已含参与奖励 +{participationPoints}
            </span>
          )}
          {entries.some((entry) => entry.delta === null) &&
            "未计分的比赛显示“—”，不计入累计变动。"}
        </p>
        {entries.length > limit && (
          <button type="button" onClick={() => setLimit((value) => value + 10)}>
            再看 {Math.min(10, entries.length - limit)} 场{" "}
            <ChevronDown size={14} />
          </button>
        )}
      </footer>
    </section>
  );
}
