import { lazy, Suspense, useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, UserRound, Users } from "lucide-react";
import Doubles from "./App";
import Singles from "./Singles";
import "./gair.css";
import gbLeagueFavicon from "./assets/gb-league-favicon.png";
import "./gb-logo.css";
const GairHome = lazy(() => import("./GairHome"));
const Badminton = lazy(() => import("./Badminton"));

function initialRoute() {
  if (window.location.hash) return window.location.hash;
  return "#home";
}
export default function LeagueApp() {
  const [route, setRoute] = useState(initialRoute);
  useEffect(() => {
    const update = () => setRoute(window.location.hash || "#home");
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const parts = route.replace(/^#/, "").split("/");
  const mode = parts[0] === "singles" ? "singles" : "doubles";
  const isBadminton = parts[0] === "badminton";
  const isHome = !["doubles", "singles", "badminton"].includes(parts[0]);
  useEffect(() => {
    document.title = isHome
      ? "GAIR超级联赛"
      : isBadminton
        ? "GB羽毛球联赛 · GAIR超级联赛"
        : "G超桌足联赛 · GAIR超级联赛";
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) {
      favicon.href = isBadminton
        ? gbLeagueFavicon
        : `${import.meta.env.BASE_URL}favicon.svg`;
      favicon.type = isBadminton ? "image/png" : "image/svg+xml";
    }
  }, [isHome, isBadminton]);
  useEffect(() => {
    if (isHome || isBadminton) return;
    try {
      localStorage.setItem("g-super-league:mode", mode);
    } catch {}
  }, [mode, isHome, isBadminton]);
  const switcher = (
    <div className="gair-football-switch">
      <a className="gair-parent-link" href="#home">
        <ArrowLeft size={13} /> GAIR 超级联赛
      </a>
      <nav className="league-mode-switch" aria-label="赛事板块">
        <a
          href="#doubles"
          aria-current={mode === "doubles" ? "page" : undefined}
        >
          <Users size={17} />
          双打
        </a>
        <a
          href="#singles"
          aria-current={mode === "singles" ? "page" : undefined}
        >
          <UserRound size={17} />
          单打
        </a>
      </nav>
      <a className="gair-other-sport" href="#badminton">
        GB 羽毛球联赛 <ArrowUpRight size={13} />
      </a>
    </div>
  );
  if (isHome)
    return (
      <Suspense
        fallback={<div className="gair-loading">正在打开 GAIR 超级联赛…</div>}
      >
        <GairHome />
      </Suspense>
    );
  if (isBadminton)
    return (
      <Suspense
        fallback={<div className="gair-loading">正在连接 GB 羽毛球联赛…</div>}
      >
        <Badminton route={parts.slice(1)} />
      </Suspense>
    );
  return mode === "singles" ? (
    <Singles route={parts.slice(1)} modeSwitch={switcher} />
  ) : (
    <Doubles modeSwitch={switcher} />
  );
}
