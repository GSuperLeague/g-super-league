import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyLeague,applyAction,score,scorers,defenders,standings,ownGoalRankings,ownGoalEvents} from '../lib/league.ts';
import {analyzeLeague,swapComparisons} from '../lib/analytics.ts';
function fixture(kind='regular',startNow=true){let s=emptyLeague();for(const id of ['a','b'])s=applyAction(s,{type:'team.save',id,data:{name:id,short:id,color:'#365c49',bio:''}});for(let i=1;i<=4;i++)s=applyAction(s,{type:'player.save',id:`p${i}`,data:{name:`p${i}`,nickname:'',teamIds:['a','b'],number:i,position:'全能型',value:0,bio:'',photo:'',skills:[50,50,50,50,50,50]}});return applyAction(s,{type:'match.save',id:'m',data:{kind,homeId:'a',awayId:'b',homePlayers:['p1','p2'],awayPlayers:['p3','p4'],roles:{homeForwardId:'p1',homeDefenderId:'p2',awayForwardId:'p3',awayDefenderId:'p4'},startNow,time:'2026-10-19T10:00:00Z',round:'实时测试'}})}
function goal(s:ReturnType<typeof fixture>,id:string,playerId:string,home=true,ownGoal=false){return applyAction(s,{type:'goal.add',id:'m',data:{id,playerId,ownGoal,teamId:home?s.matches[0].homeId:s.matches[0].awayId,minute:1}})}
test('live goals preserve individual attribution, own goals and role-based Elo',()=>{
 let s=fixture();assert.equal(s.matches[0].status,'live');
 s=goal(s,'g1','p1');s=goal(s,'g2','p2');s=goal(s,'g3','p4',true,true);s=goal(s,'g4','p3',false);
 assert.deepEqual(score(s.matches[0]),[3,1]);assert.equal(scorers(s).find(p=>p.id==='p1')!.goals,1);assert.equal(scorers(s).find(p=>p.id==='p2')!.goals,1);assert.equal(scorers(s).find(p=>p.id==='p4')!.goals,0);
 assert.equal(ownGoalRankings(s)[0].id,'p4');assert.equal(ownGoalRankings(s)[0].ownGoals,1);assert.equal(standings(s)[0].played,0);assert.equal(analyzeLeague(s).ratedMatches,0);
 s=applyAction(s,{type:'match.finish',id:'m'});assert.equal(s.matches[0].summary,undefined);assert.equal(s.matches[0].goals.length,4);
 assert.equal(standings(s)[0].points,3);assert.equal(scorers(s).find(p=>p.id==='p1')!.average,1);assert.equal(defenders(s).find(p=>p.id==='p2')!.averageDefense,2);assert.equal(defenders(s).find(p=>p.id==='p4')!.averageDefense,-2);
 const a=analyzeLeague(s);assert.equal(a.ratedMatches,1);assert.equal(a.players.find(p=>p.player.id==='p1')!.forward.games,1);assert.equal(a.positionPairs.length,2);assert.equal(swapComparisons(a).length,0);
});
test('pickup own goals count personally, duplicate event is idempotent, undo and reopen recalculate',()=>{
 let s=fixture('pickup');s=goal(s,'og','p1',false,true);s=goal(s,'og','p1',false,true);
 assert.deepEqual(score(s.matches[0]),[0,1]);assert.equal(ownGoalEvents(s).length,1);
 s=applyAction(s,{type:'match.finish',id:'m'});assert.equal(standings(s)[0].played,0);assert.equal(scorers(s).find(p=>p.id==='p1')!.forwardGames,1);assert.equal(scorers(s).find(p=>p.id==='p1')!.average,0);
 assert.throws(()=>goal(s,'invalid','p2'),/开始比赛/);
 s=applyAction(s,{type:'match.reopen',id:'m'});assert.equal(analyzeLeague(s).ratedMatches,0);
 s=applyAction(s,{type:'goal.delete',id:'m',goalId:'og'});assert.equal(ownGoalRankings(s).length,0);assert.deepEqual(score(s.matches[0]),[0,0]);
 s=goal(s,'new','p3',true,true);s=applyAction(s,{type:'match.delete',id:'m'});assert.equal(ownGoalEvents(s).length,0);
});
test('rosters, roles and scoring side are validated; scheduled games cannot receive goals',()=>{
 const s=fixture('regular',false);assert.throws(()=>goal(s,'g','p1'),/开始比赛/);
 const base={...s.matches[0],roles:{homeForwardId:'p1',homeDefenderId:'p1',awayForwardId:'p3',awayDefenderId:'p4'}};
 assert.throws(()=>applyAction(s,{type:'match.save',id:'m',data:base}),/四位不同球员/);
 assert.throws(()=>applyAction(s,{type:'match.save',id:'m',data:{...base,roles:{homeForwardId:'p1',homeDefenderId:'p3',awayForwardId:'p2',awayDefenderId:'p4'}}}),/阵容一致/);
 applyAction(s,{type:'match.start',id:'m'});
 assert.throws(()=>goal(s,'g',''),/请选择进球球员/);assert.throws(()=>goal(s,'g','p3'),/正确队伍/);assert.throws(()=>goal(s,'g','p1',true,true),/正确队伍/);
});
test('score-only results never fabricate own goals and replacing details removes events',()=>{
 let s=fixture();s=goal(s,'g','p4',true,true);s=applyAction(s,{type:'match.result',id:'m',data:{...s.matches[0],...s.matches[0].roles,homeScore:8,awayScore:5,replaceDetailed:true}});
 assert.equal(ownGoalEvents(s).length,0);assert.equal(ownGoalRankings(s).length,0);assert.equal(scorers(s).find(p=>p.id==='p1')!.goals,8);
});
