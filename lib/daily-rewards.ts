export const DAILY_PARTICIPATION_POINTS = 5;

export type ParticipationCandidate = {
  id: string;
  time: string;
  playerIds: string[];
  winnerIds: string[];
};

export const participationKey = (matchId: string, playerId: string) =>
  JSON.stringify([matchId, playerId]);

// Candidates are valid scoring matches in settlement order, before UI filtering.
// Looking at the complete day makes a later win replace the participation award.
export function buildParticipationAwards(
  candidates: ParticipationCandidate[],
  options: { timeZone: string; startsAt?: string },
): Record<string, number> {
  const days = new Intl.DateTimeFormat("sv-SE", {
    timeZone: options.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const eligible = candidates.flatMap((match) => {
    const time = Date.parse(match.time);
    if (!Number.isFinite(time) || (options.startsAt && time < Date.parse(options.startsAt)))
      return [];
    return [{ ...match, day: days.format(new Date(time)) }];
  });
  const winningDays = new Set<string>();
  for (const match of eligible)
    for (const id of match.winnerIds)
      winningDays.add(JSON.stringify([id, match.day]));
  const awarded = new Set<string>();
  const awards: Record<string, number> = {};
  for (const match of eligible)
    for (const id of match.playerIds) {
      const dayKey = JSON.stringify([id, match.day]);
      if (winningDays.has(dayKey) || awarded.has(dayKey)) continue;
      awarded.add(dayKey);
      awards[participationKey(match.id, id)] = DAILY_PARTICIPATION_POINTS;
    }
  return awards;
}
