import type { CSSProperties } from "react";
import { RANK_TIERS, rankTier } from "../lib/rating.ts";
import type { RankTier } from "../lib/rating.ts";
import { TierBadgeSvg } from "./RankBadges.tsx";
import "./rank.css";

export function TierEmblem({
  tier,
  phase = 0,
  size,
}: {
  tier: RankTier;
  phase?: number;
  size?: number;
}) {
  const style: CSSProperties & {
    "--shine-phase"?: string;
    "--emblem-size"?: string;
  } = {
    "--shine-phase": `${-phase * 0.53}s`,
  };
  if (size) {
    style["--emblem-size"] = `${size}px`;
  }
  return (
    <span
      className={`tier-emblem tier-${tier.id}`}
      style={style}
      aria-hidden="true"
    >
      <span className="tier-emblem-aura" />
      <span className="tier-emblem-frame">
        <TierBadgeSvg tierId={tier.id} />
      </span>
    </span>
  );
}

export function RankScore({
  points,
  showTier = false,
}: {
  points: number;
  showTier?: boolean;
}) {
  const tier = rankTier(points);
  const label = `${tier.name} ${points - tier.min} · ${points} 段位分`;
  return (
    <span
      className={`rank-score${showTier ? " rank-score-labeled" : ""}`}
      data-tier={tier.id}
      title={label}
      aria-label={label}
    >
      <TierEmblem tier={tier} phase={points % 17} />
      <span className="rank-score-value">{points}</span>
      {showTier && <span className="rank-score-tier">{tier.name}</span>}
    </span>
  );
}

export function RankLegend() {
  return (
    <div className="rank-legend" aria-label="段位分数对照">
      {RANK_TIERS.map((tier, i) => (
        <div key={tier.id} className={`rank-legend-item tier-card-${tier.id}`}>
          <TierEmblem tier={tier} phase={i * 2} />
          <span>
            <b>{tier.name}</b>
            <small>
              {tier.min}
              {RANK_TIERS[i + 1] ? `–${RANK_TIERS[i + 1].min - 1}` : "+"}
            </small>
          </span>
        </div>
      ))}
    </div>
  );
}
