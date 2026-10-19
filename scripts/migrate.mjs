// Snapshots and images stay in ignored .migration/, never in the public repository.
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const dir=resolve('.migration');
const run=(args)=>{const p=spawnSync('npx',['wrangler',...args,'--config','backend/wrangler.jsonc'],{stdio:'inherit'});if(p.status!==0)throw Error('Wrangler 命令失败，迁移已停止')};
const mode=process.argv[2];
if(mode==='export'){
 const base=process.env.SOURCE_URL?.replace(/\/$/,'');if(!base)throw Error('请设置 SOURCE_URL 为原网站地址');
 const response=await fetch(`${base}/api/league`);if(!response.ok)throw Error(`读取失败 ${response.status}`);
 const {data,revision}=await response.json();
 if(!Array.isArray(data?.teams)||!Array.isArray(data?.players)||!Array.isArray(data?.matches))throw Error('原站返回格式不正确');
 await mkdir(`${dir}/photos`,{recursive:true});
 const photos=[];
 for(const path of new Set(data.players.map(p=>p.photo).filter(Boolean))){
  if(!/^\/api\/photos\/[a-f0-9-]+$/.test(path))throw Error('不支持的头像路径');
  const r=await fetch(`${base}${path}`);if(!r.ok)throw Error(`头像下载失败 ${r.status}`);
  const type=r.headers.get('content-type')?.split(';')[0];if(!['image/jpeg','image/png','image/webp'].includes(type))throw Error('头像类型不正确');
  const bytes=new Uint8Array(await r.arrayBuffer());const id=path.split('/').at(-1);await writeFile(`${dir}/photos/${id}`,bytes);photos.push({id,type});
 }
 await writeFile(`${dir}/backup.json`,JSON.stringify({data,revision,photos,exportedAt:new Date().toISOString()},null,2));
 console.log(`已备份 ${data.teams.length} 支球队、${data.players.length} 名球员、${data.matches.length} 场比赛、${photos.length} 张头像到 .migration/`);
}else if(mode==='import'){
 const backup=JSON.parse(await readFile(`${dir}/backup.json`,'utf8'));
 const config=JSON.parse(await readFile('backend/wrangler.jsonc','utf8'));
 const bucket=config.r2_buckets?.find(x=>x.binding==='BUCKET')?.bucket_name;
 const readRemote=(args)=>{const p=spawnSync('npx',['wrangler',...args,'--config','backend/wrangler.jsonc','--json'],{encoding:'utf8'});if(p.status!==0)throw Error(p.stderr||'数据库操作失败');return JSON.parse(p.stdout)};
 const current=readRemote(['d1','execute','DB','--remote','--command',"SELECT data FROM league WHERE id='main'"])[0]?.results?.[0];
 if(current){const d=JSON.parse(current.data);if(d.teams.length||d.players.length||d.matches.length)throw Error('目标联赛已有记录，拒绝覆盖；请使用空数据库迁移')}
 const data=JSON.stringify(backup.data).replaceAll("'","''");
 const sql=`INSERT INTO league (id,data,revision) VALUES ('main','${data}',1)
ON CONFLICT(id) DO UPDATE SET data=excluded.data, revision=league.revision+1
WHERE json_array_length(league.data,'$.teams')=0 AND json_array_length(league.data,'$.players')=0 AND json_array_length(league.data,'$.matches')=0;
SELECT changes() AS imported;`;
 // Upload original keys before exposing the snapshot; existing target data is guarded by SQL.
 for(const p of backup.photos){
  if(!/^[a-f0-9-]+$/.test(p.id)||!['image/jpeg','image/png','image/webp'].includes(p.type))throw Error('头像清单有误');
  if(bucket)run(['r2','object','put',`${bucket}/photos/${p.id}`,'--file',`${dir}/photos/${p.id}`,'--content-type',p.type,'--remote']);
  else {
   const bytes=await readFile(`${dir}/photos/${p.id}`);if(bytes.length>1048576)throw Error('头像超过数据库模式 1MB 限制');
   const photoSql=`INSERT OR IGNORE INTO photos (id,bytes,content_type) VALUES ('${p.id}',X'${bytes.toString('hex')}','${p.type}');`;
   await writeFile(`${dir}/photo.sql`,photoSql);run(['d1','execute','DB','--remote','--file',`${dir}/photo.sql`]);
  }
 }
 await writeFile(`${dir}/restore.sql`,sql);
 const result=readRemote(['d1','execute','DB','--remote','--file',`${dir}/restore.sql`]);
 if(!result.some(r=>r.results?.some(row=>row.imported===1)))throw Error('未导入数据：目标可能已被其他记录员更新，请检查数据库');
 console.log('迁移完成，请核对网站数据；原网站保持不变。');
}else throw Error('用法: npm run backup 或 npm run restore');
