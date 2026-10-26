import { useEffect, useState } from "react";
import { UserRound, Users } from "lucide-react";
import Doubles from "./App";
import Singles from "./Singles";

function initialRoute() {
  if (window.location.hash) return window.location.hash;
  try {
    return localStorage.getItem("g-super-league:mode") === "singles"
      ? "#singles"
      : "#doubles";
  } catch {
    return "#doubles";
  }
}
export default function LeagueApp() {
  const [route, setRoute] = useState(initialRoute);
  useEffect(() => {
    const update = () => setRoute(window.location.hash || "#doubles");
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  const parts = route.replace(/^#/, "").split("/");
  const mode = parts[0] === "singles" ? "singles" : "doubles";
  useEffect(() => {
    try {
      localStorage.setItem("g-super-league:mode", mode);
    } catch {}
  }, [mode]);
  const switcher = (
    <nav className="league-mode-switch" aria-label="赛事板块">
      <a href="#doubles" aria-current={mode === "doubles" ? "page" : undefined}>
        <Users size={17} />
        双打
      </a>
      <a href="#singles" aria-current={mode === "singles" ? "page" : undefined}>
        <UserRound size={17} />
        单打
      </a>
    </nav>
  );
  return mode === "singles" ? (
    <Singles route={parts.slice(1)} modeSwitch={switcher} />
  ) : (
    <Doubles modeSwitch={switcher} />
  );
}
