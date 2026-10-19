import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../backend/src/index.ts';
import type {Env} from '../backend/src/index.ts';
const env={ALLOWED_ORIGINS:'https://junjieyu28.github.io',ADMIN_TOKEN:'test-only-32-character-admin-token'} as Env;
test('rejects unauthenticated writes and unapproved origins',async()=>{const a=await worker.fetch(new Request('https://api.example/api/league',{method:'POST'}),env);assert.equal(a.status,401);const b=await worker.fetch(new Request('https://api.example/api/auth',{method:'POST',headers:{Origin:'https://other.example',Authorization:`Bearer ${env.ADMIN_TOKEN}`}}),env);assert.equal(b.status,403)});
test('allows Pages CORS preflight and admin verification',async()=>{const headers={Origin:'https://junjieyu28.github.io',Authorization:`Bearer ${env.ADMIN_TOKEN}`};const preflight=await worker.fetch(new Request('https://api.example/api/league',{method:'OPTIONS',headers}),env);assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),headers.Origin);const r=await worker.fetch(new Request('https://api.example/api/auth',{method:'POST',headers}),env);assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true})});
