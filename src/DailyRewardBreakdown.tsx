export function DailyRewardBreakdown({
  baseDelta,
  firstWinBonus = 0,
  participationBonus = 0,
  firstWinLabel = "首胜",
  className = "first-win-breakdown",
}: {
  baseDelta: number | null;
  firstWinBonus?: number;
  participationBonus?: number;
  firstWinLabel?: string;
  className?: string;
}) {
  if (!firstWinBonus && !participationBonus) return null;
  const rewards = [
    firstWinBonus ? `${firstWinLabel} +${firstWinBonus}` : "",
    participationBonus ? `每日参与 +${participationBonus}` : "",
  ].filter(Boolean);
  return (
    <small className={className}>
      基础 {baseDelta === null ? "—" : `${baseDelta > 0 ? "+" : ""}${baseDelta}`} ·{" "}
      {rewards.join(" · ")}
    </small>
  );
}
