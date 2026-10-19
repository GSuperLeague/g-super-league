import { useState } from 'react';
import { ArrowRight, Play, Goal, Users, Undo2 } from 'lucide-react';
import { isTeamMember, matchRoles, matchTeam, ownGoalEvents, ownGoalRankings, score } from '../lib/league';
import type { League, Match, MatchRoles, Player, Team } from '../lib/league';
import { photoUrl } from './api';
import './live-match.css';

const dateInput = (time?:string) => new Date(time || Date.now()).toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'}).slice(0,16).replace(' ','T');
const dateLabel = (time:string) => new Date(time).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
const emptyRoles:MatchRoles={homeForwardId:'',homeDefenderId:'',awayForwardId:'',awayDefenderId:''};

export function LiveMatchForm({initial,teams,players,busy,onSave}:{initial?:Match;teams:Team[];players:Player[];busy:boolean;onSave:(data:any)=>void}){
 const [matchId]=useState(()=>initial?.id||crypto.randomUUID());
 const [kind,setKind]=useState<'regular'|'pickup'>(initial?.kind||(teams.length>=2?'regular':'pickup'));
 const [home,setHome]=useState(initial?.homeId||teams[0]?.id||'');
 const [away,setAway]=useState(initial?.awayId||teams[1]?.id||'');
 const [roles,setRoles]=useState<MatchRoles>(()=>(initial?matchRoles(initial):undefined)||{...emptyRoles});
 const ids=Object.values(roles), valid=ids.every(Boolean)&&new Set(ids).size===4&&(kind==='pickup'||Boolean(home&&away&&home!==away));
 return <form className="entity-form" onSubmit={e=>{
  e.preventDefault(); if(!valid)return;
  const f=new FormData(e.currentTarget);
  onSave({matchId,kind,homeId:home,awayId:away,roles,homePlayers:[roles.homeForwardId,roles.homeDefenderId],awayPlayers:[roles.awayForwardId,roles.awayDefenderId],round:f.get('round'),time:new Date(`${f.get('time')}:00+08:00`).toISOString(),startNow:(e.nativeEvent as SubmitEvent).submitter?.getAttribute('value')==='live'});
 }}>
  <div className="live-intro"><Play size={20}/><div><b>先定阵容，再开球</b><p>每队一名前锋、一名后卫。逐球记录真实进球人；完赛后更新 Elo、搭档数据和榜单。</p></div></div>
  <div className="tabs live-kind" aria-label="比赛类型">{(['regular','pickup'] as const).map(k=><button key={k} type="button" disabled={!!initial} aria-pressed={kind===k} className={kind===k?'active':''} onClick={()=>{setKind(k);setRoles({...emptyRoles})}}>{k==='regular'?'常驻球队对决':'临时组队 · A / B'}</button>)}</div>
  <div className="form-grid"><label>比赛名称<input name="round" defaultValue={initial?.round||'常规赛'} maxLength={30} required/></label><label>开赛时间（北京时间）<input name="time" type="datetime-local" defaultValue={dateInput(initial?.time)} required/></label></div>
  <div className="form-grid live-lineups">{(['home','away'] as const).map(side=>{
   const isHome=side==='home',teamId=isHome?home:away,other=isHome?away:home;
   const eligible=players.filter(p=>kind==='pickup'||isTeamMember(p,teamId));
   return <section className="live-lineup" key={side}><h3>{kind==='pickup'?(isHome?'队伍A':'队伍B'):(isHome?'主队':'客队')}</h3>
    {kind==='regular'&&<label>常驻球队<select required value={teamId} onChange={e=>{(isHome?setHome:setAway)(e.target.value);setRoles(r=>({...r,[`${side}ForwardId`]:'',[`${side}DefenderId`]:''}))}}><option value="">请选择球队</option>{teams.map(t=><option key={t.id} value={t.id} disabled={t.id===other}>{t.name}</option>)}</select></label>}
    {(['Forward','Defender'] as const).map(position=>{const key=`${side}${position}Id` as keyof MatchRoles;return <label key={key}>{position==='Forward'?'前锋':'后卫'}<select aria-label={`${isHome?'主队':'客队'}${position==='Forward'?'前锋':'后卫'}`} required value={roles[key]} onChange={e=>setRoles(r=>({...r,[key]:e.target.value}))}><option value="">请选择出场球员</option>{eligible.map(p=><option key={p.id} value={p.id} disabled={roles[key]!==p.id&&ids.includes(p.id)}>#{p.number} {p.name}</option>)}</select></label>})}
    {!eligible.length&&<p className="help-text">暂无可选球员，请先登记球队和球员。</p>}
   </section>;
  })}</div>
  <p className="help-text">同一球员不能重复出场。临时组队可自由混搭，只计个人和组合数据，不计球队积分。</p>
  <div className="form-footer live-form-footer"><button type="submit" name="mode" value="scheduled" className="btn secondary" disabled={busy||!valid}>{initial?'保存赛程':'先保存赛程'}</button><button type="submit" name="mode" value="live" className="btn primary" disabled={busy||!valid}><Play size={16}/>{busy?'保存中…':'登记并开始比赛'}<ArrowRight size={16}/></button></div>
 </form>;
}

export function OwnGoalsPage({league,onMatch,onPlayer}:{league:League;onMatch:(id:string)=>void;onPlayer:(id:string)=>void}){
 const [query,setQuery]=useState('');
 const events=ownGoalEvents(league),ranking=ownGoalRankings(league);
 const rows=ranking.filter(p=>`${p.name} ${p.nickname}`.toLowerCase().includes(query.toLowerCase()));
 const detail=events.filter(e=>`${league.players.find(p=>p.id===e.goal.playerId)?.name||''} ${league.players.find(p=>p.id===e.goal.playerId)?.nickname||''}`.toLowerCase().includes(query.toLowerCase()));
 const games=league.matches.filter(m=>m.status!=='scheduled'&&!m.summary).length;
 return <>
  <div className="page-heading"><div><span className="eyebrow">OWN GOAL RECORDS</span><h1>乌龙球记录<span>.</span></h1><p>每一球都有记录，也包括意外的那一球。</p></div></div>
  <div className="own-goal-metrics"><div><Goal/><span>已记录乌龙球</span><strong>{events.length}<small>球</small></strong></div><div><Users/><span>涉及球员</span><strong>{ranking.length}<small>位</small></strong></div><div><Undo2/><span>逐球记录比赛</span><strong>{games}<small>场</small></strong></div></div>
  <div className="own-goal-rule"><b>统计规则</b><p>乌龙球给对方加 1 分，记在实际踢出乌龙球的球员名下，不计入其正常进球。包括进行中和已完赛的常驻队、临时组队比赛；只记录已明确登记的乌龙球，不从赛后总比分推算。撤销进球或删除比赛后同步扣除。</p></div>
  <section className="panel"><div className="panel-heading"><h2>乌龙球榜</h2><label className="own-search">搜索球员<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="姓名 / 昵称"/></label></div>
   {rows.length?<div className="own-table-scroll"><table className="own-table"><thead><tr><th>排名</th><th>球员</th><th>发生场次</th><th>乌龙球</th></tr></thead><tbody>{rows.map(p=>{const rank=1+ranking.filter(x=>x.ownGoals>p.ownGoals).length;return <tr key={p.id}><td>{rank}</td><td><button className="own-person" onClick={()=>onPlayer(p.id)}><span className="avatar">{p.photo?<img src={photoUrl(p.photo)} alt=""/>:p.name.slice(-2)}</span><span><b>{p.name}</b><small>#{p.number} · {p.nickname||p.position}</small></span></button></td><td>{p.affectedMatches}</td><td><strong>{p.ownGoals}</strong></td></tr>})}</tbody></table></div>:<div className="empty"><Goal size={28}/><h3>{query?'没有匹配的球员':'还没有乌龙球记录'}</h3><p>实时计分时勾选「这是对方乌龙球」并选择球员，记录后会自动出现在这里。</p></div>}
   <div className="panel-note">按乌龙球总数由多到少排列，同数并列；这是事件记录，不是能力评价。</div>
  </section>
  <section className="panel own-events"><div className="panel-heading"><h2>乌龙球明细</h2><span className="muted">{detail.length} 条记录 · 最近记录在前</span></div>{detail.length?<div>{detail.map(({match,goal})=>{const p=league.players.find(p=>p.id===goal.playerId),v=score(match);return <button className="own-event" key={`${match.id}:${goal.id}`} onClick={()=>onMatch(match.id)}><span className="own-event-icon"><Goal size={18}/></span><span><b>{p?.name||'已归档球员'} · 乌龙球</b><small>{matchTeam(league.teams,match,match.homeId)?.name} {v[0]} : {v[1]} {matchTeam(league.teams,match,match.awayId)?.name} · {dateLabel(match.time)}（北京时间）</small><small>第 {goal.minute} 分钟 · {matchTeam(league.teams,match,goal.teamId)?.name} 得分{match.status==='live'?' · 进行中':''}</small></span><ArrowRight size={17}/></button>})}</div>:<div className="empty"><p>暂无符合条件的逐球记录。</p></div>}</section>
 </>;
}
