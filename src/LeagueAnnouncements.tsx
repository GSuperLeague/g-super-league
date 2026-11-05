import { Megaphone } from "lucide-react";
import { firstWinAnnouncements } from "../lib/rule-announcements.ts";
import "./league-announcements.css";

export function LeagueAnnouncements({
  sport,
}: {
  sport?: "football" | "badminton";
}) {
  const entries = firstWinAnnouncements.filter(
    (entry) => !sport || entry.sport === sport,
  );
  return (
    <section className="league-announcements" aria-label="联赛公告">
      <header>
        <Megaphone size={18} aria-hidden="true" />
        <h2>联赛公告</h2>
        <span>参与有奖励，首胜不叠加参与分。</span>
      </header>
      <div className={`league-announcement-grid${sport ? " is-single" : ""}`}>
        {entries.map(({ label, effectiveLabel, article }) => (
          <article className="league-announcement-card" key={article.id}>
            <span className="league-announcement-label">{label}</span>
            <h3>{article.title}</h3>
            <p className="league-announcement-summary">{article.summary}</p>
            <p className="league-announcement-date">
              {effectiveLabel} · 北京时间每日00:00刷新资格
            </p>
            <details>
              <summary>奖励说明与计算示例</summary>
              {article.body.split("\n\n").map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </details>
          </article>
        ))}
      </div>
    </section>
  );
}
