import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../backend/src/index.ts';
import type {Env} from '../backend/src/index.ts';
const env={ALLOWED_ORIGINS:'https://junjieyu28.github.io',ADMIN_TOKEN:'test-only-32-character-admin-token'} as Env;
test('rejects unauthenticated writes and unapproved origins',async()=>{const a=await worker.fetch(new Request('https://api.example/api/league',{method:'POST'}),env);assert.equal(a.status,401);const b=await worker.fetch(new Request('https://api.example/api/auth',{method:'POST',headers:{Origin:'https://other.example',Authorization:`Bearer ${env.ADMIN_TOKEN}`}}),env);assert.equal(b.status,403)});
test('allows Pages CORS preflight and admin verification',async()=>{const headers={Origin:'https://junjieyu28.github.io',Authorization:`Bearer ${env.ADMIN_TOKEN}`};const preflight=await worker.fetch(new Request('https://api.example/api/league',{method:'OPTIONS',headers}),env);assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),headers.Origin);const r=await worker.fetch(new Request('https://api.example/api/auth',{method:'POST',headers}),env);assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true})});
test('D1 avatars round-trip the uploaded bytes without an R2 subscription',async()=>{
 const images=new Map<string,{bytes:number[];content_type:string}>();
 const DB={prepare(sql:string){return {bind(...values:any[]){return {async run(){images.set(values[0],{bytes:Array.from(new Uint8Array(values[1])),content_type:values[2]});return {meta:{changes:1}}},async first(){return images.get(values[0])||null}}}}}} as unknown as D1Database;
 const photoEnv={...env,DB};const bytes=new Uint8Array([255,216,255,224,0,16]);
 const uploaded=await worker.fetch(new Request('https://api.example/api/photos',{method:'POST',headers:{Authorization:`Bearer ${env.ADMIN_TOKEN}`},body:bytes}),photoEnv);
 assert.equal(uploaded.status,200);const {url}=await uploaded.json() as {url:string};
 const downloaded=await worker.fetch(new Request(`https://api.example${url}`),photoEnv);
 assert.equal(downloaded.headers.get('Content-Type'),'image/jpeg');assert.deepEqual(new Uint8Array(await downloaded.arrayBuffer()),bytes);
 const missing=await worker.fetch(new Request('https://api.example/api/photos/abc'),photoEnv);assert.equal(missing.status,404);
});
