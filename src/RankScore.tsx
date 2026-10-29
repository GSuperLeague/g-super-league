import {
  Award,
  Crown,
  Diamond,
  Gem,
  Hexagon,
  Shield,
  ShieldHalf,
  Sparkles,
  Swords,
} from "lucide-react";
import type { CSSProperties } from "react";
import { RANK_TIERS, rankTier } from "../lib/rating.ts";
import type { RankTier } from "../lib/rating.ts";
import "./rank.css";

const icons = {
  iron: Shield,
  bronze: ShieldHalf,
  silver: Hexagon,
  gold: Award,
  platinum: Diamond,
  diamond: Gem,
  master: Sparkles,
  grandmaster: Swords,
  king: Crown,
};

function TierEmblem({ tier, phase = 0 }: { tier: RankTier; phase?: number }) {
  const Icon = icons[tier.id];
  const crowned = tier.id === "grandmaster" || tier.id === "king";
  return (
    <span
      className={`tier-emblem tier-${tier.id}`}
      style={{ "--shine-phase": `${-phase * 0.53}s` } as CSSProperties}
      aria-hidden="true"
    >
      <span className="tier-emblem-aura" />
      <span className="tier-emblem-wings" />
      <span className="tier-emblem-mantle" />
      <span className="tier-emblem-frame">
        <span className="tier-emblem-face">
          <Icon strokeWidth={1.7} />
          <span className="tier-emblem-sheen" />
        </span>
      </span>
      <span className="tier-emblem-collar" />
      {crowned && (
        <span className="tier-emblem-coronet">
          <Crown strokeWidth={1.7} />
        </span>
      )}
      <span className="tier-emblem-jewel" />
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
        <div key={tier.id}>
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
