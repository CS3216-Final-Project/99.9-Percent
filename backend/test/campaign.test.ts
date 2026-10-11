import {fileURLToPath} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {migrate} from 'drizzle-orm/pglite/migrator';
import {eq} from 'drizzle-orm';
import request from 'supertest';
import {beforeAll,beforeEach,afterAll,it,expect,vi} from 'vitest';
import * as schema from '../src/db/schema.js';
import {hash,randomToken} from '../src/auth/session.js';
import {authorizationUrl,exchangeGoogle} from '../src/auth/google.js';
const client=new PGlite();
const db=drizzle({client,schema,casing:'snake_case'});
vi.mock('../src/db/client.js',()=>({getDb:()=>db,isDbConfigured:()=>true}));
vi.mock('../src/auth/google.js',()=>({authorizationUrl:vi.fn(async(state:string)=>`https://accounts.google.com/auth?state=${state}`),
  exchangeGoogle:vi.fn(async()=>({issuer:'https://accounts.google.com',subject:'google-1',displayName:'Player'}))}));
import app from '../src/app.js';
const origin='https://game.test';
const {gameAccounts,gameSessions,gameRuns,gameAuthAttempts}=schema;
beforeAll(async()=>{await migrate(db,{migrationsFolder:fileURLToPath(new URL('../drizzle',import.meta.url))});});
beforeEach(async()=>{
  vi.stubEnv('APP_ORIGIN',origin);vi.stubEnv('GOOGLE_CLIENT_ID','test-client');vi.stubEnv('GOOGLE_CLIENT_SECRET','test-secret');
  vi.stubEnv('GOOGLE_REDIRECT_URI',`${origin}/api/auth/google/callback`);
  await db.delete(gameAccounts);await db.delete(gameAuthAttempts);
  vi.mocked(exchangeGoogle).mockResolvedValue({issuer:'https://accounts.google.com',subject:'google-1',displayName:'Player'});
});
afterAll(async()=>{await client.close();vi.unstubAllEnvs();});
function envelope(runId='company') { return {schemaVersion:3,scenarioId:'opening-db',scenarioVersion:1,runId,
  seed:1,step:0,inputs:[] as {step:number;action:{type:string}}[],runtime:{remainderMs:0},savedAt:1}; }
async function session(subject='one',expired=false) {
  const [account]=await db.insert(gameAccounts).values({issuer:'https://accounts.google.com',subject,displayName:subject}).returning();
  const token=randomToken(),csrf=randomToken();await db.insert(gameSessions).values({tokenHash:hash(token),accountId:account.id,csrfToken:csrf,expiresAt:new Date(Date.now()+(expired?-1000:60000))});
  return {account,cookie:`nn_session=${token}`,csrf};
}
async function put(s:Awaited<ReturnType<typeof session>>,revision:number,runId='company',value=envelope(runId)) {
  return request(app).put(`/api/runs/${runId}`).set('Cookie',s.cookie).set('Origin',origin).set('X-CSRF-Token',s.csrf).send({expectedRevision:revision,envelope:value});
}
async function attempt() {
  const start=await request(app).get('/api/auth/google');expect(start.status).toBe(302);
  return {state:new URL(start.headers.location).searchParams.get('state')!,cookie:start.headers['set-cookie'][0].split(';')[0]};
}
it('leaves health accessible without an app session',async()=>{expect((await request(app).get('/api/health')).status).toBe(200);});
it('rejects unauthenticated private operations and disables private caching',async()=>{
  for(const path of ['/api/session','/api/runs','/api/runs/company']) {
    const r=await request(app).get(path);expect(r.status).toBe(401);expect(r.headers['cache-control']).toBe('private, no-store');expect(r.headers['vercel-cdn-cache-control']).toBe('no-store');
  }
});
it('restores sessions, rejects expiry, and does not store raw session tokens',async()=>{
  const s=await session();const r=await request(app).get('/api/session').set('Cookie',s.cookie);
  expect(r.body).toEqual({account:{id:s.account.id,displayName:'one'},csrfToken:s.csrf});
  expect((await db.select().from(gameSessions))[0].tokenHash).not.toContain(s.cookie.split('=')[1]);
  const expired=await session('expired',true);expect((await request(app).get('/api/session').set('Cookie',expired.cookie)).status).toBe(401);
});
it('requires exact origin and CSRF for writes',async()=>{
  const s=await session();
  for(const headers of [{Origin:'https://game.test.evil', 'X-CSRF-Token':s.csrf},{Origin:origin,'X-CSRF-Token':'wrong'}])
    expect((await request(app).put('/api/runs/company').set('Cookie',s.cookie).set(headers).send({expectedRevision:0,envelope:envelope()})).status).toBe(403);
  expect(await db.select().from(gameRuns)).toEqual([]);
});
it('stores, lists and resumes only the owner’s run',async()=>{
  const a=await session('a'),b=await session('b');expect((await put(a,0)).body.revision).toBe(1);
  expect((await request(app).get('/api/runs/company').set('Cookie',a.cookie)).body.envelope).toEqual(envelope());
  expect((await request(app).get('/api/runs').set('Cookie',a.cookie)).body).toHaveLength(1);
  expect((await request(app).get('/api/runs').set('Cookie',b.cookie)).body).toEqual([]);
  expect((await request(app).get('/api/runs/company').set('Cookie',b.cookie)).status).toBe(404);
  const denied=await put(b,0);expect(denied.status).toBe(409);expect(denied.body.current).toBeUndefined();
  expect((await put(b,1)).status).toBe(409);expect((await db.select().from(gameRuns))[0].revision).toBe(1);
});
it.each([4,5,6])('accepts schema %s replay saves and preserves their payload',async(schemaVersion)=>{
  const s=await session(),value={...envelope(),schemaVersion,inputs:[{step:0,action:{type:'enter_data'}}]};
  const saved=await put(s,0,'company',value);expect(saved.status).toBe(200);expect(saved.body.envelope).toEqual(value);
  const resumed=await request(app).get('/api/runs/company').set('Cookie',s.cookie);
  expect(resumed.body.envelope).toEqual(value);
  expect((await put(s,1,'company',{...value,schemaVersion:7})).status).toBe(400);
  expect((await db.select().from(gameRuns))[0].revision).toBe(1);
});
it('atomically accepts one of two concurrent revisions and returns the winner on conflict',async()=>{
  const s=await session();await put(s,0);
  const [a,b]=await Promise.all([put(s,1,'company',{...envelope(),savedAt:2}),put(s,1,'company',{...envelope(),savedAt:3})]);
  expect([a.status,b.status].sort()).toEqual([200,409]);
  const winner=a.status===200?a:b,conflict=a.status===409?a:b;
  expect(conflict.body.current.envelope).toEqual(winner.body.envelope);expect(conflict.body.current.revision).toBe(2);
});
it('atomically claims a guest run once without reassignment',async()=>{
  const a=await session('a'),b=await session('b');const rs=await Promise.all([put(a,0),put(b,0)]);
  expect(rs.map(r=>r.status).sort()).toEqual([200,409]);expect(await db.select().from(gameRuns)).toHaveLength(1);
});
it('rejects incompatible saves, mismatched IDs and invalid revisions',async()=>{
  const s=await session();
  for(const e of [{...envelope(),schemaVersion:1}, {...envelope(),schemaVersion:7}, {...envelope(),runId:'other'}, {...envelope(),inputs:null}, {...envelope(),step:1_000_001}, {...envelope(),runtime:{remainderMs:1000}}])
    expect((await put(s,0,'company',e as ReturnType<typeof envelope>)).status).toBe(400);
  expect((await put(s,-1)).status).toBe(400);expect(await db.select().from(gameRuns)).toEqual([]);
});
it('enforces account identity uniqueness, revision constraints and owner cascades',async()=>{
  const s=await session();await put(s,0);
  await expect(db.insert(gameAccounts).values({issuer:'https://accounts.google.com',subject:'one',displayName:'duplicate'})).rejects.toThrow();
  await expect(db.update(gameRuns).set({revision:0})).rejects.toThrow();
  await db.delete(gameAccounts).where(eq(gameAccounts.id,s.account.id));
  expect(await db.select().from(gameRuns)).toEqual([]);expect(await db.select().from(gameSessions)).toEqual([]);
});
it('uses durable single-use bound attempts, signs in, and restores a returning account',async()=>{
  const first=await attempt();expect(authorizationUrl).toHaveBeenCalled();
  expect((await db.select().from(gameAuthAttempts))[0].stateHash).toBe(hash(first.state));
  const response=await request(app).get(`/api/auth/google/callback?state=${first.state}&code=valid`).set('Cookie',first.cookie);
  expect(response.headers.location).toBe(`${origin}/?auth=signed-in`);
  const cookies=response.headers['set-cookie'] as unknown as string[];
  expect(cookies.find(x=>x.startsWith('nn_session='))).toMatch(/HttpOnly; Secure; SameSite=Lax/);
  const sessionCookie=cookies.find(x=>x.startsWith('nn_session='))!.split(';')[0];
  expect((await request(app).get('/api/session').set('Cookie',sessionCookie)).status).toBe(200);
  expect((await request(app).get(`/api/auth/google/callback?state=${first.state}&code=valid`).set('Cookie',first.cookie)).status).toBe(400);
  const second=await attempt();await request(app).get(`/api/auth/google/callback?state=${second.state}&code=valid`).set('Cookie',`${second.cookie}; ${sessionCookie}`);
  expect(await db.select().from(gameAccounts)).toHaveLength(1);expect(await db.select().from(gameSessions)).toHaveLength(1);
});
it('rejects a mismatched browser binding without consuming the real attempt',async()=>{
  const a=await attempt();expect((await request(app).get(`/api/auth/google/callback?state=${a.state}&code=valid`).set('Cookie',`nn_auth=${randomToken()}`)).status).toBe(400);
  expect(await db.select().from(gameAuthAttempts)).toHaveLength(1);
});
it('rejects expired attempts and invalid identities; cancellation creates no account',async()=>{
  const a=await attempt();await db.update(gameAuthAttempts).set({expiresAt:new Date(0)});
  expect((await request(app).get(`/api/auth/google/callback?state=${a.state}&code=valid`).set('Cookie',a.cookie)).status).toBe(400);
  const b=await attempt();vi.mocked(exchangeGoogle).mockRejectedValueOnce(Error('invalid signature/nonce'));
  expect((await request(app).get(`/api/auth/google/callback?state=${b.state}&code=invalid`).set('Cookie',b.cookie)).headers.location).toBe(`${origin}/?auth=failed`);
  const c=await attempt();expect((await request(app).get(`/api/auth/google/callback?state=${c.state}&error=access_denied`).set('Cookie',c.cookie)).headers.location).toBe(`${origin}/?auth=cancelled`);
  expect(await db.select().from(gameAccounts)).toEqual([]);
});
it('revokes a session on sign-out and rejects subsequent access',async()=>{
  const s=await session();expect((await request(app).post('/api/auth/logout').set('Cookie',s.cookie).set('Origin',origin).set('X-CSRF-Token',s.csrf)).status).toBe(204);
  expect((await request(app).get('/api/session').set('Cookie',s.cookie)).status).toBe(401);
});
it('fails closed when Google configuration is absent or callback origin is wrong',async()=>{
  vi.stubEnv('GOOGLE_CLIENT_SECRET','');expect((await request(app).get('/api/auth/google')).status).toBe(503);
  vi.stubEnv('GOOGLE_CLIENT_SECRET','test');vi.stubEnv('GOOGLE_REDIRECT_URI','https://other.test/api/auth/google/callback');
  expect((await request(app).get('/api/auth/google')).status).toBe(503);
});
