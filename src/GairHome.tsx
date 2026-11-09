import { useEffect, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Users,
  Trophy,
  Activity,
  Images,
} from "lucide-react";
import { apiBase } from "./api";
import { badmintonApiBase } from "./badminton-api";
import gbLeagueLogo from "./assets/gb-league-logo-640.png";
import gSuperLeagueLogo from "./assets/g-super-league-logo-640.png";
import { LeagueAnnouncements } from "./LeagueAnnouncements";
import { SeasonTrailers } from "./SeasonTrailers";
import { FOOTBALL_CURRENT_THEME } from "../lib/season-promos.ts";
import "./gair.css";
export function ShuttleIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="m11 20 1-15 5 3 5-1 4 5-1 5 3 5-15 1"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m12 20 5-12m-3 13 8-14m-7 15 11-10m-10 11 9-6"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M12 20c-3-3-6-2-8 0-2 2-2 5 0 7s5 2 7 0 3-4 1-7Z"
        fill="currentColor"
      />
    </svg>
  );
}
function CourtArt({ badminton = false }: { badminton?: boolean }) {
  return (
    <svg
      viewBox="0 0 560 300"
      fill="none"
      aria-hidden="true"
      className="gair-court-art"
    >
      <g transform="translate(55 52) rotate(-11 220 100)">
        <rect
          width="450"
          height="210"
          rx="3"
          stroke="currentColor"
          strokeWidth="2"
        />
        <path
          d="M225 0v210M0 105h450M35 0v210M415 0v210"
          stroke="currentColor"
          strokeWidth="1.2"
        />
        {badminton ? (
          <path
            d="M0 65h450M0 145h450M70 0v65m0 80v65M380 0v65m0 80v65"
            stroke="currentColor"
          />
        ) : (
          <>
            <circle cx="225" cy="105" r="37" stroke="currentColor" />
            <path
              d="M0 40h70v130H0m450-130h-70v130h70M0 75h25v60H0m450-60h-25v60h25"
              stroke="currentColor"
            />
          </>
        )}
        <circle cx="310" cy="60" r="7" fill="currentColor" />
        <circle cx="145" cy="145" r="7" fill="currentColor" opacity=".6" />
      </g>
    </svg>
  );
}
type Counts = { players: number; matches: number } | null;
export default function GairHome() {
  const [football, setFootball] = useState<Counts>(null),
    [badminton, setBadminton] = useState<Counts>(null);
  useEffect(() => {
    const controller = new AbortController();
    const load = async (url: string, set: (v: Counts) => void) => {
      try {
        const r = await fetch(url, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!r.ok) return;
        const { data } = (await r.json()) as {
          data?: { players: unknown[]; matches: { status: string }[] };
        };
        if (Array.isArray(data?.players) && Array.isArray(data?.matches))
          set({
            players: data.players.length,
            matches: data.matches.filter((m) => m.status === "finished").length,
          });
      } catch {}
    };
    void load(`${apiBase}/api/league`, setFootball);
    void load(`${badmintonApiBase}/api/badminton/league`, setBadminton);
    return () => controller.abort();
  }, []);
  return (
    <div className="gair-home">
      <header className="gair-header">
        <a className="gair-wordmark" href="#home">
          <span className="gair-mark">
            G<span>★</span>
          </span>
          <span>
            <b>GAIR 超级联赛</b>
            <small>ONE LEAGUE. MORE POSSIBILITIES.</small>
          </span>
        </a>
        <div className="gair-header-note">
          <i /> 为热爱，打出下一场。
        </div>
        <nav className="gair-header-actions" aria-label="联赛入口">
          <a className="gair-nav-link" href="#gallery/football">
            联赛图库 <Images size={16} />
          </a>
          <a className="gair-nav-link" href="#badminton">
            进入 GB 联赛 <ArrowUpRight size={16} />
          </a>
        </nav>
      </header>
      <div className="gair-home-content">
        <section className="gair-welcome">
          <div className="gair-welcome-copy">
            <span className="gair-eyebrow">GAIR SUPER LEAGUE / EST. 2026</span>
            <h1>
              热爱，不止一场<span>THE GAME GOES ON.</span>
            </h1>
            <p>
              从球桌到球场，把每一次对决，
              <br />
              变成我们共同的联赛。
            </p>
            <a href="#badminton" className="gair-primary">
              GB 羽毛球联赛，全新开场 <ArrowRight size={18} />
            </a>
            <div className="gair-hero-bottom">
              <span>01 桌上足球</span>
              <span>02 羽毛球</span>
              <span>更多热爱，正在发生</span>
            </div>
          </div>
          <div className="gair-hero-visual">
            <div className="gair-orbit" />
            <CourtArt badminton />
            <span className="gair-visual-word">
              PLAY
              <br />
              TOGETHER.
            </span>
            <ShuttleIcon size={82} />
            <span className="gair-visual-caption">小小球场，大大热爱。</span>
          </div>
        </section>
        <SeasonTrailers />
        <LeagueAnnouncements />
        <div className="gair-section-heading">
          <div>
            <span className="gair-eyebrow">CHOOSE YOUR GAME</span>
            <h2>找到你的主场</h2>
          </div>
          <p>同一个联赛大家庭，每项运动各有精彩。</p>
        </div>
        <section className="gair-league-grid" aria-label="旗下联赛">
          <article className="gair-league-card gair-football">
            <div className="gair-card-top">
              <span className="gair-card-icon gair-card-g-super-logo">
                <img src={gSuperLeagueLogo} alt="" width={1254} height={1254} />
              </span>
              <span className="gair-card-badge">
                <i /> 第一赛季 · {FOOTBALL_CURRENT_THEME}
              </span>
            </div>
            <div className="gair-card-body">
              <span className="gair-eyebrow">TABLE FOOTBALL</span>
              <h2>G超 · 桌足联赛</h2>
              <p>
                每一球，都算数。
                <br />
                第一赛季「{FOOTBALL_CURRENT_THEME}」：借对手来球的力量，弹回去。
              </p>
              <div className="gair-card-counts">
                <span>
                  <b>{football?.players ?? "—"}</b> 位球员
                </span>
                <span>
                  <b>{football?.matches ?? "—"}</b> 场已完赛
                </span>
              </div>
              <div className="gair-card-actions">
                <a href="#doubles">
                  进入桌足联赛 <ArrowUpRight size={17} />
                </a>
                <span className="gair-card-caption">战绩 · 球员 · 精彩对决</span>
              </div>
            </div>
            <img
              className="gair-card-background-logo"
              src={gSuperLeagueLogo}
              alt=""
              aria-hidden="true"
              width={1254}
              height={1254}
              decoding="async"
            />
          </article>
          <article className="gair-league-card gair-badminton">
            <div className="gair-card-top">
              <span className="gair-card-icon gair-card-logo">
                <img src={gbLeagueLogo} alt="" width={1254} height={1254} />
              </span>
              <span className="gair-card-badge">NEW SEASON</span>
            </div>
            <div className="gair-card-body">
              <span className="gair-eyebrow">GAIR BADMINTON</span>
              <h2>GB · 羽毛球联赛</h2>
              <p>
                挥拍上场，来真的。
                <br />
                11分，一局决胜。单打的锋芒，双打的默契。
              </p>
              <div className="gair-card-counts">
                <span>
                  <b>{badminton?.players ?? "—"}</b> 位球员
                </span>
                <span>
                  <b>{badminton?.matches ?? "—"}</b> 场已完赛
                </span>
              </div>
              <div className="gair-card-actions">
                <a href="#badminton/doubles">
                  进入双打 <ArrowUpRight size={17} />
                </a>
                <a href="#badminton/singles">
                  羽毛球单打 <ArrowRight size={16} />
                </a>
              </div>
            </div>
            <img
              className="gair-card-background-logo"
              src={gbLeagueLogo}
              alt=""
              aria-hidden="true"
              width={1254}
              height={1254}
              decoding="async"
            />
          </article>
        </section>
        <section className="gair-values">
          <div>
            <Trophy size={22} />
            <b>各有主场</b>
            <span>桌足与羽毛球，分别记录战绩与段位。</span>
          </div>
          <div>
            <Users size={22} />
            <b>一起上场</b>
            <span>老朋友可以继续加入，新朋友随时欢迎。</span>
          </div>
          <div>
            <Activity size={22} />
            <b>每场留痕</b>
            <span>比分、搭档、对手和每场加减分，都有记录。</span>
          </div>
        </section>
        <footer className="gair-home-footer">
          <b>GAIR SUPER LEAGUE</b>
          <span>小小球场，大大热爱。</span>
          <span>THE GAME IS ON. ●</span>
        </footer>
      </div>
    </div>
  );
}
