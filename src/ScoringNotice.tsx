import { Award, LockKeyhole } from "lucide-react";
import type { FirstWinPolicy, SeasonId } from "../lib/seasons.ts";
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
  if (season === "s1" && policy)
    return (
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
          · 按北京时间，从11月2日起补算。
        </span>
      </div>
    );
  return null;
}
