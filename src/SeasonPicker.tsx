import { CalendarDays } from "lucide-react";
import { SEASONS } from "../lib/seasons.ts";
import type { SeasonId } from "../lib/seasons.ts";
import { footballSeasonLabel } from "../lib/season-promos.ts";
import "./seasons.css";

export function SeasonPicker({
  value,
  onChange,
}: {
  value: SeasonId;
  onChange: (id: SeasonId) => void;
}) {
  return (
    <label className="season-picker" title={footballSeasonLabel(value)}>
      <CalendarDays size={15} aria-hidden="true" />
      <select
        aria-label="赛季"
        value={value}
        onChange={(event) => onChange(event.target.value as SeasonId)}
      >
        {SEASONS.map((season) => (
          <option key={season.id} value={season.id}>
            {season.name}
          </option>
        ))}
      </select>
    </label>
  );
}
