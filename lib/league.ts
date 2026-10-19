export type Team = {id:string;name:string;short:string;color:string;bio:string};
export const dimensions=['射门','传球','控球','防守','反应','配合'];
export type Player = {id:string;name:string;nickname:string;teamIds?:string[];teamId?:string;number:number;position:string;value:number;bio:string;photo:string;skills:number[]};
// Legacy single-team records remain readable; memberships are saved as an array on edit.
export function playerTeamIds(p:Pick<Player,'teamIds'|'teamId'>):string[]{return Array.isArray(p.teamIds)?[...new Set(p.teamIds)]:p.teamId?[p.teamId]:[]}
export function isTeamMember(p:Player,teamId:string){return playerTeamIds(p).includes(teamId)}
export type Goal={id:string;teamId:string;playerId:string;ownGoal:boolean;minute:number;createdAt:string};
export type MatchRoles={homeForwardId:string;homeDefenderId:string;awayForwardId:string;awayDefenderId:string};
export type MatchSummary={homeScore:number;awayScore:number;homeForwardId:string;homeDefenderId:string;awayForwardId:string;awayDefenderId:string;recordedAt:string};
export type Match={id:string;kind?:'regular'|'pickup';homeId:string;awayId:string;homePlayers:string[];awayPlayers:string[];time:string;round:string;status:'scheduled'|'live'|'finished';goals:Goal[];roles?:MatchRoles;summary?:MatchSummary};
export function matchTeam(teams:Team[],match:Match,id:string):Team|undefined{
 if(match.kind==='pickup'&&(id===match.homeId||id===match.awayId)){const home=id===match.homeId;return {id,name:home?'队伍A':'队伍B',short:home?'A':'B',color:home?'#365c49':'#275e9b',bio:'本场临时组队'}}
 return teams.find(t=>t.id===id);
}
export type League={teams:Team[];players:Player[];matches:Match[];settings:{season:string;win:number;draw:number;loss:number};updatedAt:string};
export const emptyLeague=():League=>({teams:[],players:[],matches:[],settings:{season:'2026 赛季',win:3,draw:1,loss:0},updatedAt:''});
export function score(m:Match){if(m.summary)return [m.summary.homeScore,m.summary.awayScore];return [m.goals.filter(g=>g.teamId===m.homeId).length,m.goals.filter(g=>g.teamId===m.awayId).length]}
export function standings(s:League){return s.teams.map(t=>{const r={...t,played:0,win:0,draw:0,loss:0,gf:0,ga:0,gd:0,points:0};s.matches.filter(m=>m.status==='finished'&&m.kind!=='pickup'&&(m.homeId===t.id||m.awayId===t.id)).forEach(m=>{const v=score(m);const a=m.homeId===t.id?v[0]:v[1],b=m.homeId===t.id?v[1]:v[0];r.played++;r.gf+=a;r.ga+=b;if(a>b)r.win++;else if(a===b)r.draw++;else r.loss++});r.gd=r.gf-r.ga;r.points=r.win*s.settings.win+r.draw*s.settings.draw+r.loss*s.settings.loss;return r}).sort((a,b)=>b.points-a.points||b.gd-a.gd||b.gf-a.gf||a.name.localeCompare(b.name,'zh'))}
export function matchRoles(m:Match):MatchRoles|undefined{return m.summary||m.roles}
export function playerGoals(m:Match,id:string){return m.summary?(m.summary.homeForwardId===id?m.summary.homeScore:0)+(m.summary.awayForwardId===id?m.summary.awayScore:0):m.goals.filter(g=>g.playerId===id&&!g.ownGoal).length}
export function scorers(s:League){return s.players.map(p=>{
 const ms=s.matches.filter(m=>m.status!=='scheduled'&&(m.homePlayers.includes(p.id)||m.awayPlayers.includes(p.id)));
 const goals=ms.reduce((total,m)=>total+playerGoals(m,p.id),0);
 const forwardMatches=ms.filter(m=>{const r=matchRoles(m);return m.status==='finished'&&r&&(r.homeForwardId===p.id||r.awayForwardId===p.id)});
 const forwardGoals=forwardMatches.reduce((total,m)=>total+playerGoals(m,p.id),0);
 const forwardGames=forwardMatches.length;
 return {...p,goals,appearances:ms.length,forwardGames,forwardGoals,average:forwardGames?forwardGoals/forwardGames:null};
 }).sort((a,b)=>b.goals-a.goals||(a.forwardGames||Infinity)-(b.forwardGames||Infinity)||a.name.localeCompare(b.name,'zh'));
}
export function defenders(s:League){return s.players.map(p=>{
 const matches=s.matches.filter(m=>{const r=matchRoles(m);return m.status==='finished'&&r&&(r.homeDefenderId===p.id||r.awayDefenderId===p.id)});
 let goalsFor=0,goalsAgainst=0,defensiveGoals=0;
 for(const m of matches){const r=matchRoles(m)!;const home=r.homeDefenderId===p.id;const [a,b]=score(m);goalsFor+=home?a:b;goalsAgainst+=home?b:a;defensiveGoals+=home?a-b:b-a}
 return {...p,defensiveGames:matches.length,defensiveGoals,goalsFor,goalsAgainst,averageDefense:matches.length?defensiveGoals/matches.length:0};
 }).filter(p=>p.defensiveGames>0).sort((a,b)=>b.defensiveGoals-a.defensiveGoals||b.averageDefense-a.averageDefense||b.defensiveGames-a.defensiveGames||a.name.localeCompare(b.name,'zh'));
}
// Only explicit goal events can establish an own goal; aggregate scores cannot.
export function ownGoalEvents(s:League){return s.matches.filter(m=>m.status!=='scheduled'&&!m.summary).flatMap(match=>match.goals.filter(goal=>goal.ownGoal).map(goal=>({match,goal}))).sort((a,b)=>b.goal.createdAt.localeCompare(a.goal.createdAt)||b.goal.id.localeCompare(a.goal.id))}
export function ownGoalRankings(s:League){const events=ownGoalEvents(s);return s.players.map(player=>{
 const own=events.filter(e=>e.goal.playerId===player.id);
 const games=s.matches.filter(m=>m.status!=='scheduled'&&!m.summary&&(m.homePlayers.includes(player.id)||m.awayPlayers.includes(player.id))).length;
 return {...player,ownGoals:own.length,affectedMatches:new Set(own.map(e=>e.match.id)).size,detailedGames:games,average:games?own.length/games:0};
 }).filter(p=>p.ownGoals>0).sort((a,b)=>b.ownGoals-a.ownGoals||a.name.localeCompare(b.name,'zh'))}

const fail=(message:string):never=>{throw new Error(message)};
const str=(x:unknown,max=80,required=false)=>{if(typeof x!=='string'||x.length>max||(required&&!x.trim()))return fail('请检查必填文字及长度');return x.trim()};
const num=(x:unknown,min=0,max=100)=>{if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)return fail('数值超出允许范围');return x};
const int=(x:unknown,min=0,max=100)=>{const n=num(x,min,max);if(!Number.isInteger(n))return fail('请输入整数');return n};
function matchIdentity(s:League,id:string,p:any,old?:Match){
 const kind=p.kind??old?.kind??'regular';if(kind!=='regular'&&kind!=='pickup')fail('比赛类型无效');
 if(old&&kind!==(old.kind??'regular'))fail('已有比赛不能更换比赛类型，请重新创建比赛');
 if(kind==='pickup')return {kind:'pickup' as const,homeId:`pickup:${id}:a`,awayId:`pickup:${id}:b`};
 const homeId=str(p.homeId,80,true),awayId=str(p.awayId,80,true);
 if(homeId===awayId||![homeId,awayId].every(t=>s.teams.some(x=>x.id===t)))fail('请选择两支不同的常驻球队');
 return {kind:'regular' as const,homeId,awayId};
}
export function applyAction(s:League,a:any):League{
 const id=str(a.id,80,true);
 if(a.type==='team.save'){
  const p=a.data;const name=str(p.name,24,true),short=str(p.short,4,true),color=str(p.color,7,true);if(!/^#[\da-f]{6}$/i.test(color))fail('请选择有效的队伍颜色');
  if(s.teams.some(t=>t.id!==id&&t.name===name))fail('球队名称已存在');
  const team={id,name,short,color,bio:str(p.bio,300)};const i=s.teams.findIndex(t=>t.id===id);if(i>=0)s.teams[i]=team;else s.teams.push(team);
 }else if(a.type==='team.delete'){
  if(s.players.some(p=>isTeamMember(p,id))||s.matches.some(m=>m.homeId===id||m.awayId===id))fail('请先在球员资料中取消该球队的成员关系，并移除相关比赛');s.teams=s.teams.filter(t=>t.id!==id);
 }else if(a.type==='player.save'){
  const p=a.data;const existing=s.players.find(x=>x.id===id);
  if(p.teamIds===undefined&&existing&&playerTeamIds(existing).length>1)fail('球员已加入多个球队，请刷新页面后再编辑');
  const input=p.teamIds??(p.teamId?[p.teamId]:[]);if(!Array.isArray(input)||input.length===0||input.length>200)fail('请至少选择一支所属球队');
  const teamIds=[...new Set<string>((input as unknown[]).map((x:unknown)=>str(x,80,true)))];if(!teamIds.every(t=>s.teams.some(x=>x.id===t)))fail('所选球队不存在，请刷新后重新选择');
  if(!Array.isArray(p.skills)||p.skills.length!==6)fail('需要六项能力值');
  const number=int(p.number,0,99);for(const t of teamIds){if(s.players.some(x=>x.id!==id&&isTeamMember(x,t)&&x.number===number))fail(`${s.teams.find(x=>x.id===t)?.name} 的 ${number} 号已被使用，请更换球衣号码`)}
  const photo=str(p.photo,150);if(photo&&!/^\/api\/photos\/[a-f0-9-]+$/.test(photo))fail('请重新上传头像');
  const player={id,name:str(p.name,30,true),nickname:str(p.nickname,30),teamIds,number,position:str(p.position,12,true),value:num(p.value,0,1000000),bio:str(p.bio,500),photo,skills:p.skills.map((x:unknown)=>int(x))};
  const i=s.players.findIndex(x=>x.id===id);if(i>=0)s.players[i]=player;else s.players.push(player);
 }else if(a.type==='player.delete'){
  if(s.matches.some(m=>m.homePlayers.includes(id)||m.awayPlayers.includes(id)))fail('球员已有比赛记录，不能删除；可修改档案或转队');s.players=s.players.filter(p=>p.id!==id);
 }else if(a.type==='match.save'){
  const p=a.data;const old=s.matches.find(m=>m.id===id);if(old&&old.status!=='scheduled')fail('仅未开赛的赛程可以编辑');
  const {kind,homeId,awayId}=matchIdentity(s,id,p,old);
  const time=str(p.time,50,true);if(!Number.isFinite(Date.parse(time)))fail('比赛时间无效');
  function roster(key:string,team:string){if(!Array.isArray(p[key])||p[key].length<1||p[key].length>4)fail('每队请选择 1–4 位出场球员');const ids=[...new Set(p[key])] as string[];if(!ids.every(x=>s.players.some(y=>y.id===x&&(kind==='pickup'||isTeamMember(y,team)))))fail('出场球员必须属于本队');return ids}
  const m:Match={id,kind,homeId,awayId,time,round:str(p.round,30,true),homePlayers:roster('homePlayers',homeId),awayPlayers:roster('awayPlayers',awayId),status:'scheduled',goals:[]};if(m.homePlayers.some(pid=>m.awayPlayers.includes(pid)))fail('同一场比赛中，一位球员只能代表一支球队出场');if(p.roles!==undefined){
   const r=p.roles;if(!r||typeof r!=='object')fail('请登记双方前锋和后卫');const roles:MatchRoles={homeForwardId:str(r.homeForwardId,80,true),homeDefenderId:str(r.homeDefenderId,80,true),awayForwardId:str(r.awayForwardId,80,true),awayDefenderId:str(r.awayDefenderId,80,true)};
   if(new Set(Object.values(roles)).size!==4)fail('双方前锋和后卫须为四位不同球员');
   if(m.homePlayers.length!==2||m.awayPlayers.length!==2||![roles.homeForwardId,roles.homeDefenderId].every(pid=>m.homePlayers.includes(pid))||![roles.awayForwardId,roles.awayDefenderId].every(pid=>m.awayPlayers.includes(pid)))fail('前锋和后卫必须与本场两人阵容一致');
   m.roles=roles;
  }
  if(p.startNow===true)m.status='live';
  if(old)s.matches[s.matches.indexOf(old)]=m;else s.matches.push(m);
 }else if(a.type==='match.result'){
  const p=a.data;const old=s.matches.find(m=>m.id===id);
  const {kind,homeId,awayId}=matchIdentity(s,id,p,old);
  if(old&&(old.homeId!==homeId||old.awayId!==awayId))fail('已有比赛不能更换参赛球队，请新建比赛');
  if(old&&old.goals.length>0&&p.replaceDetailed!==true)fail('请确认将原逐球记录替换为赛后汇总，全部进球计给所选前锋');
  const time=str(p.time,50,true);if(!Number.isFinite(Date.parse(time)))fail('比赛时间无效');
  const homeForwardId=str(p.homeForwardId,80,true),homeDefenderId=str(p.homeDefenderId,80,true),awayForwardId=str(p.awayForwardId,80,true),awayDefenderId=str(p.awayDefenderId,80,true);
  const allIds=[homeForwardId,homeDefenderId,awayForwardId,awayDefenderId];if(new Set(allIds).size!==4)fail('双方前锋和后卫须为四位不同球员，同一球员不能重复出场');
  for(const [ids,teamId,oldRoster] of [[[homeForwardId,homeDefenderId],homeId,old?.homePlayers||[]],[[awayForwardId,awayDefenderId],awayId,old?.awayPlayers||[]]] as [string[],string,string[]][]){
   if(!ids.every(pid=>s.players.some(player=>player.id===pid&&(kind==='pickup'||isTeamMember(player,teamId)||oldRoster.includes(pid)))))fail('请选择所属球队的球员，或该场比赛已有的出场球员');
  }
  const summary:MatchSummary={homeScore:int(p.homeScore,0,999),awayScore:int(p.awayScore,0,999),homeForwardId,homeDefenderId,awayForwardId,awayDefenderId,recordedAt:new Date().toISOString()};
  const m:Match={id,kind,homeId,awayId,time,round:str(p.round,30,true),homePlayers:[homeForwardId,homeDefenderId],awayPlayers:[awayForwardId,awayDefenderId],status:'finished',goals:[],summary};
  if(old)s.matches[s.matches.indexOf(old)]=m;else s.matches.push(m);
 }else if(a.type==='match.delete'){s.matches=s.matches.filter(m=>m.id!==id)
 }else if(a.type==='settings.save'){
  const p=a.data;s.settings={season:str(p.season,30,true),win:int(p.win,0,10),draw:int(p.draw,0,10),loss:int(p.loss,0,10)};
 }else{
  const m=s.matches.find(m=>m.id===id);if(!m)fail('找不到比赛');const match=m!;
  if(match.summary)fail('这场比赛使用赛后汇总，请通过编辑赛后结果修改比分与位置');
  if(a.type==='match.start'){if(match.status!=='scheduled')fail('比赛已经开始');match.status='live'}
  else if(a.type==='match.finish'){if(match.status!=='live')fail('只有进行中的比赛可以完赛');match.status='finished'}
  else if(a.type==='match.reopen'){if(match.status!=='finished')fail('只有已完赛比赛可以重新打开');match.status='live'}
  else if(a.type==='goal.add'){
   const p=a.data;const eventId=str(p.id,80,true);if(match.goals.some(g=>g.id===eventId))return s;
   if(match.status!=='live')fail('请先开始比赛，或重新打开已完赛比赛');const teamId=str(p.teamId,80,true);if(teamId!==match.homeId&&teamId!==match.awayId)fail('进球队伍不在本场比赛中');
   const playerId=str(p.playerId,80),ownGoal=p.ownGoal===true;const roster=(teamId===match.homeId)!==ownGoal?match.homePlayers:match.awayPlayers;if(playerId&&!roster.includes(playerId))fail('请选择本场正确队伍的出场球员');if(!playerId)fail('请选择进球球员');
   match.goals.push({id:eventId,teamId,playerId,ownGoal,minute:int(p.minute,0,999),createdAt:new Date().toISOString()});
  }else if(a.type==='goal.delete'){if(match.status!=='live')fail('请先重新打开比赛，再修改进球');match.goals=match.goals.filter(g=>g.id!==a.goalId)}
  else fail('未知操作');
 }
 if(s.teams.length>200||s.players.length>2000||s.matches.length>5000)fail('已达到联赛容量上限');s.updatedAt=new Date().toISOString();return s;
}
