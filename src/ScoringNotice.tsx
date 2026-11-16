import { Award, LockKeyhole, Zap } from "lucide-react";
import { spinTrialActive } from "../lib/seasons.ts";
import type { FirstWinPolicy, SeasonId } from "../lib/seasons.ts";
import { FOOTBALL_SPIN_TRIAL_PERIOD } from "../lib/season-promos.ts";
import "./scoring-policy.css";
export function ScoringNotice({
  season,
  locked,
  policy,
  singles = false,
}: {
  season: SeasonId;
  locked: boolean;
  policy?: FirstWinPolicy;
  singles?: boolean;
}) {
  if (season === "beta" && locked)
    return (
      <div className="scoring-policy-notice archived" role="note">
        <LockKeyhole size={16} />
        <span>
          <b>beta赛季已封存</b> · 分数与旧计分规则保持不变，赛果仅供查看。
        </span>
      </div>
    );
  if (season === "beta") return null;
  return (
    <>
      {season === "s2" && (
        <div className="scoring-policy-notice spin-trial" role="note">
          <Zap size={16} aria-hidden="true" />
          <span>
            <b>{spinTrialActive() ? "爆冲试行中" : "爆冲试行已结束"}</b>
            {" · "}北京时间 {FOOTBALL_SPIN_TRIAL_PERIOD}允许爆冲，11 月 19 日 00:00 起恢复常规规则。
          </span>
        </div>
      )}
      {policy && (
        <div className="scoring-policy-notice" role="note">
          <Award size={16} />
          <span>
            {singles ? (
              <>
                <b>每日首胜 +10 / 参与 +5</b> · 每天二选一，首胜替代参与分
              </>
            ) : (
              <>
                <b>前锋首胜 +10，后卫首胜 +10</b> · 当天没有首胜时参与 +5，二者互斥
              </>
            )}{" "}
            · 按北京时间 {season === "s2" ? "每天 00:00 刷新。" : "从 11 月 2 日起补算。"}
          </span>
        </div>
      )}
    </>
  );
}
