import {fileURLToPath} from 'node:url';
import {PGlite} from '@electric-sql/pglite';
import {drizzle} from 'drizzle-orm/pglite';
import {migrate} from 'drizzle-orm/pglite/migrator';
import request from 'supertest';
import {beforeAll,beforeEach,afterAll,describe,it,expect,vi} from 'vitest';
import * as schema from '../src/db/schema.js';
import {displayName,hashPassword,normaliseEmail,verifyPassword} from '../src/auth/password.js';
const client=new PGlite();
const db=drizzle({client,schema,casing:'snake_case'});
vi.mock('../src/db/client.js',()=>({getDb:()=>db,isDbConfigured:()=>true}));
import app from '../src/app.js';
const origin='https://game.test';
const {gameAccounts,gameSessions,gameEmailCredentials}=schema;
beforeAll(async()=>{await migrate(db,{migrationsFolder:fileURLToPath(new URL('../drizzle',import.meta.url))});});
beforeEach(async()=>{vi.stubEnv('APP_ORIGIN',origin);await db.delete(gameAccounts);});
afterAll(async()=>{await client.close();vi.unstubAllEnvs();});
const register=(body:object,from=origin)=>request(app).post('/api/auth/email/register').set('Origin',from).send(body);
const login=(body:object,cookie='')=>request(app).post('/api/auth/email/login').set('Origin',origin).set('Cookie',cookie).send(body);
const sessionCookie=(r:request.Response)=>(r.headers['set-cookie'] as unknown as string[]).find(x=>x.startsWith('nn_session='))!;

describe('password helpers',()=>{
  it('hashes with a per-password salt and verifies only the original password',async()=>{
    const a=await hashPassword('correct horse'),b=await hashPassword('correct horse');
    expect(a).toMatch(/^scrypt\$16384\$8\$1\$/);expect(a).not.toBe(b);expect(a).not.toContain('correct');
    expect(await verifyPassword('correct horse',a)).toBe(true);
    expect(await verifyPassword('correct horsf',a)).toBe(false);
    expect(await verifyPassword('correct horse','md5$whatever')).toBe(false);
  });
  it('normalises emails and names',()=>{
    expect(normaliseEmail('  Player@Example.COM ')).toBe('player@example.com');
    for(const bad of ['', 'player', 'player@', '@example.com', 'a b@example.com', 'player@example', 42, `${'a'.repeat(250)}@example.com`])expect(normaliseEmail(bad)).toBeNull();
    expect(displayName(undefined,'ada@example.com')).toBe('ada');
    expect(displayName('  Ada   Lovelace ','ada@example.com')).toBe('Ada Lovelace');
    expect(displayName('x'.repeat(61),'ada@example.com')).toBeNull();
    expect(displayName(7,'ada@example.com')).toBeNull();
  });
});

it('creates an email account with a hashed password and an HttpOnly session',async()=>{
  const r=await register({email:' Ada@Example.com ',password:'analytical-engine',name:'Ada'});
  expect(r.status).toBe(201);expect(r.headers['cache-control']).toBe('private, no-store');
  expect(r.body).toEqual({account:{id:expect.any(String),displayName:'Ada'},csrfToken:expect.any(String),newAccount:true});
  expect(sessionCookie(r)).toMatch(/HttpOnly; Secure; SameSite=Lax/);
  const [account]=await db.select().from(gameAccounts);expect(account).toMatchObject({issuer:'email',subject:'ada@example.com'});
  const [credential]=await db.select().from(gameEmailCredentials);expect(credential.passwordHash).not.toContain('analytical');
  const restored=await request(app).get('/api/session').set('Cookie',sessionCookie(r).split(';')[0]);
  expect(restored.body).toEqual(r.body);
});
it('refuses a second registration for the same email without changing its password',async()=>{
  await register({email:'ada@example.com',password:'analytical-engine'});
  const again=await register({email:'ADA@example.com',password:'different-password'});
  expect(again.status).toBe(409);expect(again.body.error).toMatch(/already exists/);expect(again.headers['set-cookie']).toBeUndefined();
  expect((await login({email:'ada@example.com',password:'analytical-engine'})).status).toBe(200);
  expect((await login({email:'ada@example.com',password:'different-password'})).status).toBe(401);
  expect(await db.select().from(gameAccounts)).toHaveLength(1);
});
it('keeps an email account separate from a Google account with the same address',async()=>{
  await db.insert(gameAccounts).values({issuer:'https://accounts.google.com',subject:'google-sub',displayName:'Ada (Google)'});
  const r=await register({email:'ada@example.com',password:'analytical-engine'});
  expect(r.status).toBe(201);expect(await db.select().from(gameAccounts)).toHaveLength(2);
});
it('signs in, returns the session and rotates the browser’s previous session',async()=>{
  const first=await register({email:'ada@example.com',password:'analytical-engine',name:'Ada'});
  const previous=sessionCookie(first).split(';')[0];
  const r=await login({email:'Ada@example.com',password:'analytical-engine'},previous);
  expect(r.status).toBe(200);expect(r.body.account).toEqual(first.body.account);expect(r.body.csrfToken).not.toBe(first.body.csrfToken);
  // Signing in to an account that already exists is never a sign-up, even with no cloud saves yet.
  expect(r.body.newAccount).toBe(false);
  expect(await db.select().from(gameSessions)).toHaveLength(1);
  expect((await request(app).get('/api/session').set('Cookie',previous)).status).toBe(401);
  const restored=await request(app).get('/api/session').set('Cookie',sessionCookie(r).split(';')[0]);
  expect(restored.status).toBe(200);expect(restored.body.newAccount).toBe(false);
});
it('completes an interrupted registration as a new account',async()=>{
  await db.insert(gameAccounts).values({issuer:'email',subject:'ada@example.com',displayName:'ada'});
  const r=await register({email:'ada@example.com',password:'analytical-engine'});
  expect(r.status).toBe(201);expect(r.body.newAccount).toBe(true);
});
it('gives the same answer for a wrong password and an unknown email',async()=>{
  await register({email:'ada@example.com',password:'analytical-engine'});
  const wrong=await login({email:'ada@example.com',password:'difference-engine'}),unknown=await login({email:'nobody@example.com',password:'difference-engine'});
  expect([wrong.status,unknown.status]).toEqual([401,401]);expect(wrong.body).toEqual(unknown.body);
  expect(wrong.headers['set-cookie']).toBeUndefined();
});
it('locks an account for 15 minutes after ten wrong passwords, then lets the owner back in',async()=>{
  await register({email:'ada@example.com',password:'analytical-engine'});
  for(let i=0;i<10;i++)expect((await login({email:'ada@example.com',password:`guess-${i}-wrong`})).status).toBe(401);
  const [locked]=await db.select().from(gameEmailCredentials);
  expect(locked.lockedUntil!.getTime()).toBeGreaterThan(Date.now()+14*60_000);expect(locked.failedAttempts).toBe(0);
  const refused=await login({email:'ada@example.com',password:'analytical-engine'});
  expect(refused.status).toBe(429);expect(refused.headers['set-cookie']).toBeUndefined();
  await db.update(gameEmailCredentials).set({lockedUntil:new Date(Date.now()-1000),failedAttempts:3});
  expect((await login({email:'ada@example.com',password:'analytical-engine'})).status).toBe(200);
  expect((await db.select().from(gameEmailCredentials))[0]).toMatchObject({failedAttempts:0,lockedUntil:null});
});
it('rejects requests from other origins without creating or signing in anyone',async()=>{
  for(const from of ['https://game.test.evil','']) {
    expect((await register({email:'ada@example.com',password:'analytical-engine'},from)).status).toBe(403);
  }
  expect(await db.select().from(gameAccounts)).toEqual([]);
  await register({email:'ada@example.com',password:'analytical-engine'});
  const r=await request(app).post('/api/auth/email/login').set('Origin','https://evil.test').send({email:'ada@example.com',password:'analytical-engine'});
  expect(r.status).toBe(403);expect(r.headers['set-cookie']).toBeUndefined();
});
it('validates email, password and name before touching the database',async()=>{
  for(const body of [{email:'not-an-email',password:'analytical-engine'},{email:'ada@example.com',password:'short'},
    {email:'ada@example.com',password:'x'.repeat(201)},{email:'ada@example.com',password:'analytical-engine',name:'x'.repeat(61)},{email:'ada@example.com'}])
    expect((await register(body)).status).toBe(400);
  for(const body of [{email:'ada@example.com'},{email:'ada@example.com',password:''},{password:'analytical-engine'}])expect((await login(body)).status).toBe(400);
  expect(await db.select().from(gameAccounts)).toEqual([]);
});
it('fails closed when the app origin is not configured',async()=>{
  vi.stubEnv('APP_ORIGIN','');
  expect((await register({email:'ada@example.com',password:'analytical-engine'})).status).toBe(503);
  expect((await login({email:'ada@example.com',password:'analytical-engine'})).status).toBe(503);
});
