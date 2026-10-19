import {applyAction,emptyLeague} from '../../lib/league.ts';
export interface Env { DB:D1Database; BUCKET:R2Bucket; ALLOWED_ORIGINS:string; ADMIN_TOKEN:string }
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
async function row(env:Env){
 await env.DB.prepare('INSERT OR IGNORE INTO league (id,data,revision) VALUES (?,?,0)').bind('main',JSON.stringify(emptyLeague())).run();
 return (await env.DB.prepare('SELECT data,revision FROM league WHERE id=?').bind('main').first<{data:string;revision:number}>())!;
}
async function authorized(request:Request,env:Env){
 if(!env.ADMIN_TOKEN||env.ADMIN_TOKEN.length<24)return false;
 const token=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
 const hash=async(s:string)=>new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
 const [a,b]=await Promise.all([hash(token),hash(env.ADMIN_TOKEN)]);
 let diff=0;for(let i=0;i<a.length;i++)diff|=a[i]^b[i];return diff===0;
}
export async function handle(request:Request,env:Env):Promise<Response>{
 const url=new URL(request.url),path=url.pathname;
 if(request.method==='GET'&&path==='/api/league'){const r=await row(env);return json({data:JSON.parse(r.data),revision:r.revision})}
 if(request.method==='GET'&&/^\/api\/photos\/[a-f0-9-]+$/.test(path)){
  const object=await env.BUCKET.get(path.replace('/api/',''));
  if(!object)return json({error:'头像不存在'},404);
  return new Response(object.body,{headers:{'Content-Type':object.httpMetadata?.contentType||'image/jpeg','Cache-Control':'public, max-age=86400','X-Content-Type-Options':'nosniff'}});
 }
 if(request.method!=='POST')return json({error:'接口不存在'},404);
 if(!await authorized(request,env))return json({error:'请使用有效的管理密钥登录'},401);
 if(path==='/api/auth')return json({ok:true});
 if(path==='/api/photos'){
  if(Number(request.headers.get('Content-Length')||0)>2097152)return json({error:'头像不能超过 2MB'},413);
  const b=await request.arrayBuffer(),v=new Uint8Array(b);
  if(b.byteLength>2097152)return json({error:'头像不能超过 2MB'},413);
  const type=v[0]===255&&v[1]===216&&v[2]===255?'image/jpeg':v[0]===137&&v[1]===80&&v[2]===78&&v[3]===71?'image/png':String.fromCharCode(...v.slice(0,4))==='RIFF'&&String.fromCharCode(...v.slice(8,12))==='WEBP'?'image/webp':null;
  if(!type)return json({error:'请上传 JPG、PNG 或 WebP 图片'},400);
  const id=crypto.randomUUID();await env.BUCKET.put(`photos/${id}`,b,{httpMetadata:{contentType:type}});return json({url:`/api/photos/${id}`});
 }
 if(path==='/api/league'){
  const raw=await request.text();if(raw.length>20000)return json({error:'提交内容过大'},413);
  let action;try{action=JSON.parse(raw)}catch{return json({error:'无效 JSON'},400)}
  for(let i=0;i<5;i++){
   const r=await row(env);let data;
   try{data=applyAction(JSON.parse(r.data),action)}catch(e){return json({error:e instanceof Error?e.message:'提交信息有误'},400)}
   const encoded=JSON.stringify(data);if(encoded.length>1800000)return json({error:'记录容量已满，请导出备份'},400);
   const result=await env.DB.prepare('UPDATE league SET data=?,revision=revision+1 WHERE id=? AND revision=?').bind(encoded,'main',r.revision).run();
   if(result.meta.changes===1)return json({data,revision:r.revision+1});
  }
  return json({error:'另一位记录员正在更新，请重试'},409);
 }
 return json({error:'接口不存在'},404);
}
export default {async fetch(request:Request,env:Env):Promise<Response>{
 const origin=request.headers.get('Origin');
 const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 if(origin&&!allowed.includes(origin))return json({error:'来源不被允许'},403);
 let response:Response;
 if(request.method==='OPTIONS')response=new Response(null,{status:204});
 else try{response=await handle(request,env)}catch{response=json({error:'数据服务暂时不可用，请稍后重试'},503)}
 const headers=new Headers(response.headers);headers.set('Vary','Origin');headers.set('X-Content-Type-Options','nosniff');
 if(origin){headers.set('Access-Control-Allow-Origin',origin);headers.set('Access-Control-Allow-Methods','GET, POST, OPTIONS');headers.set('Access-Control-Allow-Headers','Content-Type, Authorization');headers.set('Access-Control-Max-Age','600')}
 return new Response(response.body,{status:response.status,headers});
}};
