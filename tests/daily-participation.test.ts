import test from "node:test";
import assert from "node:assert/strict";
import { emptyLeague, applyAction } from "../lib/league.ts";
import type { League } from "../lib/league.ts";
import { analyzeLeague, leagueForSeason, matchRatings } from "../lib/analytics.ts";
import { FIRST_WIN_POLICY } from "../lib/seasons.ts";
import { doublesRankHistory } from "../lib/rank-history.ts";
import { emptyBadmintonLeague, applyBadmintonAction, analyzeBadminton } from "../lib/badminton.ts";
import type { BadmintonLeague, BadmintonMode } from "../lib/badminton.ts";
import { emptySinglesLeague, applySinglesAction, analyzeSingles, singlesForSeason } from "../lib/singles.ts";
import type { SinglesLeague } from "../lib/singles.ts";

function football(): League {
  return {
    ...emptyLeague(), firstWinPolicy: { ...FIRST_WIN_POLICY },
    players: ["a", "b", "c", "d"].map((id, i) => ({ id, name: id, nickname: "", number: i + 1, position: "全能型", value: 0, bio: "", photo: "", skills: [50,50,50,50,50,50], teamIds: [] })),
  };
}
function fGame(s: League, id: string, time: string, options: {win?: boolean; draw?: boolean; swap?: boolean} = {}) {
  const [homeScore, awayScore] = options.draw ? [5, 5] : options.win === false ? [4, 7] : [7, 4];
  return applyAction(structuredClone(s), { type: "match.result", id, data: {
    kind: "pickup", time, round: id, homeScore, awayScore,
    homeForwardId: options.swap ? "b" : "a", homeDefenderId: options.swap ? "a" : "b", awayForwardId: "c", awayDefenderId: "d",
  }});
}
const fPlayer = (s: League, id = "a") => analyzeLeague(leagueForSeason(s, "s1")).players.find(p => p.player.id === id)!;
let operation = 0;
function gAction(s: BadmintonLeague, type: string, id: string, data?: unknown) {
  return applyBadmintonAction(s, {type, id, data, actionId: `participation-${++operation}`});
}
function badminton() {
  let s = emptyBadmintonLeague();
  for (const id of ["a", "b", "c", "d"]) s = gAction(s, "player.save", id, {name: id, nickname: "", bio: "", hand: "unknown"});
  return s;
}
function gGame(s: BadmintonLeague, id: string, time: string, win = true, mode: BadmintonMode = "singles") {
  return gAction(s, "match.result", id, {mode, time, round: id, homePlayers: mode === "singles" ? ["a"] : ["a", "b"], awayPlayers: mode === "singles" ? ["c"] : ["c", "d"], format: {pointsToWin:11,bestOf:1,winBy:2}, games: [win ? {home:11,away:8} : {home:8,away:11}]});
}
const gPlayer = (s: BadmintonLeague, mode: BadmintonMode = "singles", id = "a") => analyzeBadminton(s,mode).find(p=>p.player.id===id)!;

test("football loss-only participation is once per day, overall only, across both positions", () => {
  let s = fGame(football(), "one", "2026-11-02T10:00:00+08:00", {win:false});
  s = fGame(s, "two", "2026-11-02T11:00:00+08:00", {win:false,swap:true});
  const p = fPlayer(s), plain = fPlayer({...s,firstWinPolicy:undefined});
  assert.equal(p.participationPoints,5);
  assert.equal(p.rankPoints.overall,plain.rankPoints.overall+5);
  assert.equal(p.rankPoints.forward,plain.rankPoints.forward);
  assert.equal(p.rankPoints.defender,plain.rankPoints.defender);
  assert.deepEqual(p.history.map(h=>h.participationBonus),[5,0]);
  assert.deepEqual(p.mmr,plain.mmr);
  assert.equal(doublesRankHistory(p.history,"overall").at(-1)!.participationBonus,5);
  assert.equal(doublesRankHistory(p.history,"forward")[0].participationBonus,0);
  const full = leagueForSeason(s,"s1");
  assert.equal(analyzeLeague({...full,matches:full.matches.filter(m=>m.id==="two")}).players.find(p=>p.player.id==="a")!.participationPoints,0);
});

test("either football position's first win cancels the day's participation, with a 20-point cap", () => {
  let s = fGame(football(), "loss", "2026-11-02T09:00:00+08:00", {win:false});
  assert.equal(fPlayer(s).participationPoints,5);
  s = fGame(s, "defender-win", "2026-11-02T10:00:00+08:00", {swap:true});
  let p = fPlayer(s);
  assert.equal(p.participationPoints,0);
  assert.deepEqual(p.history.map(h=>h.participationBonus),[0,0]);
  assert.equal(p.firstWinPoints.overall,10);
  assert.equal(p.firstWinPoints.defender,10);
  assert.equal(p.firstWinPoints.forward,0);
  s = fGame(s, "forward-win", "2026-11-02T11:00:00+08:00");
  p = fPlayer(s);
  assert.equal(p.firstWinPoints.overall+p.participationPoints,20);
  assert.ok(p.history.every(h=>!(h.participationBonus && h.firstWinBonus)));
});

test("football draws count as participation; future same-day wins suppress it in filters and settlements", () => {
  let s = fGame(football(), "draw", "2026-11-02T09:00:00+08:00", {draw:true});
  const season = leagueForSeason(s,"s1"), p = fPlayer(s);
  assert.equal(p.participationPoints,5);
  const settled = matchRatings(season,season.matches[0]).players.find(p=>p.playerId==="a")!;
  assert.equal(settled.overall.participationBonus,5);
  assert.equal(settled.position!.participationBonus,0);
  assert.equal(settled.overall.delta,settled.overall.baseDelta!+5);
  s = fGame(s, "later-win", "2026-11-02T11:00:00+08:00");
  const full = leagueForSeason(s,"s1");
  const filtered = analyzeLeague({...full,matches:full.matches.filter(m=>m.id==="draw")}).players.find(p=>p.player.id==="a")!;
  assert.equal(filtered.participationPoints,0);
  assert.equal(matchRatings(s,s.matches.find(m=>m.id==="draw")!).players.find(p=>p.playerId==="a")!.overall.participationBonus,0);
});

test("football beta and snapshots without the first-win policy never receive participation", () => {
  let s = fGame(football(), "beta", "2026-10-31T12:00:00+08:00", {win:false});
  s = fGame(s, "s1", "2026-11-02T12:00:00+08:00", {win:false});
  const source = JSON.stringify(s);
  assert.ok(analyzeLeague(leagueForSeason(s,"beta")).players.every(p=>p.participationPoints===0));
  assert.equal(fPlayer({...s,firstWinPolicy:undefined}).participationPoints,0);
  assert.equal(fPlayer(s).participationPoints,5);
  assert.equal(JSON.stringify(s),source);
});

test("football incomplete positions and unfinished matches cannot receive or consume participation", () => {
  const s = fGame(football(), "valid", "2026-11-02T12:00:00+08:00", {win:false});
  for (const status of ["live","scheduled"] as const) {
    const m = structuredClone(s.matches[0]); m.id=status; m.time="2026-11-02T09:00:00+08:00"; m.status=status; s.matches.push(m);
  }
  const invalid = structuredClone(s.matches[0]); invalid.id="invalid"; invalid.time="2026-11-02T10:00:00+08:00"; invalid.summary!.homeForwardId="unknown"; s.matches.push(invalid);
  const p=fPlayer(s);
  assert.equal(p.participationPoints,5);
  assert.equal(p.history.find(h=>h.match.id==="valid")!.participationBonus,5);
  assert.ok(p.history.filter(h=>h.match.id!=="valid").every(h=>!h.participationBonus));
});

test("GB repeated losses give only one participation award; Beijing midnight refreshes it", () => {
  let s = gGame(badminton(),"one","2026-11-04T14:00:00Z",false);
  s = gGame(s,"two","2026-11-04T15:59:59Z",false);
  s = gGame(s,"midnight","2026-11-04T16:00:00Z",false);
  const p=gPlayer(s);
  assert.equal(p.firstWinPoints,0);
  assert.equal(p.participationPoints,10);
  assert.deepEqual(p.history.map(h=>h.participationBonus),[5,0,5]);
  assert.deepEqual(p.history.map(h=>h.baseDelta),[-16,-15,-13]);
});

test("GB first loss temporarily earns 5; a later win replaces it with 10 and replays history", () => {
  let s=gGame(badminton(),"loss","2026-11-04T10:00:00+08:00",false);
  assert.equal(gPlayer(s).rankPoints,1189);
  assert.equal(gPlayer(s).participationPoints,5);
  s=gGame(s,"win","2026-11-04T11:00:00+08:00");
  const p=gPlayer(s);
  assert.equal(p.rankPoints,1211);
  assert.equal(p.firstWinPoints,10);
  assert.equal(p.participationPoints,0);
  assert.deepEqual(p.history.map(h=>h.participationBonus),[0,0]);
  assert.deepEqual(p.history.map(h=>h.firstWinBonus),[0,10]);
  assert.deepEqual(p.history.map(h=>h.delta),[-16,27]);
});

test("GB singles and doubles have independent mutually-exclusive rewards", () => {
  let s=gGame(badminton(),"single-loss","2026-11-04T10:00:00+08:00",false);
  s=gGame(s,"double-win","2026-11-04T11:00:00+08:00",true,"doubles");
  assert.equal(gPlayer(s,"singles").participationPoints,5);
  assert.equal(gPlayer(s,"singles").firstWinPoints,0);
  assert.equal(gPlayer(s,"doubles").participationPoints,0);
  assert.equal(gPlayer(s,"doubles").firstWinPoints,10);
  assert.equal(gPlayer(s,"doubles","b").firstWinPoints,10);
});

test("GB result correction, deletion and reopening recalculate the correct participation match", () => {
  let s=gGame(badminton(),"first","2026-11-04T10:00:00+08:00",false);
  s=gGame(s,"second","2026-11-04T11:00:00+08:00");
  assert.equal(gPlayer(s).participationPoints,0);
  s=gGame(s,"second","2026-11-04T11:00:00+08:00",false);
  assert.equal(gPlayer(s).firstWinPoints,0);
  assert.deepEqual(gPlayer(s).history.map(h=>h.participationBonus),[5,0]);
  s=gAction(s,"match.delete","first");
  assert.equal(gPlayer(s).history[0].participationBonus,5);
  s=gAction(s,"match.reopen","second");
  assert.equal(gPlayer(s).participationPoints,0);
  assert.equal(gPlayer(s).games,0);
});

test("football singles participation and first win are exclusive and remain consistent under filters", () => {
  let s: SinglesLeague={...emptySinglesLeague(),firstWinPolicy:{...FIRST_WIN_POLICY},players:["a","b"].map((id,i)=>({id,name:id,nickname:"",number:i+1,bio:"",photo:""}))};
  const record=(id:string,time:string,win:boolean)=>{s=applySinglesAction(s,{type:"match.result",id,data:{homeId:"a",awayId:"b",time,round:id,homeScore:win?7:4,awayScore:win?4:7}});};
  record("loss","2026-11-02T09:00:00+08:00",false);
  assert.equal(analyzeSingles(singlesForSeason(s,"s1")).find(p=>p.player.id==="a")!.participationPoints,5);
  record("win","2026-11-02T11:00:00+08:00",true);
  const full=singlesForSeason(s,"s1"), p=analyzeSingles(full).find(p=>p.player.id==="a")!;
  assert.equal(p.participationPoints,0);
  assert.equal(p.firstWinPoints,10);
  assert.deepEqual(p.history.map(h=>h.participationBonus),[0,0]);
  assert.equal(analyzeSingles({...full,matches:full.matches.filter(m=>m.id==="loss")}).find(p=>p.player.id==="a")!.participationPoints,0);
});
