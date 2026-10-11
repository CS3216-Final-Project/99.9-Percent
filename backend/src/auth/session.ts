import {createHash, randomBytes} from 'node:crypto';
import {and, eq, gt} from 'drizzle-orm';
import type {Request, Response, NextFunction} from 'express';
import type {AppSession} from '../../../shared/campaign.ts';
import {getDb, isDbConfigured} from '../db/client.js';
import {gameSessions, gameAccounts} from '../db/schema.js';
export const randomToken=() => randomBytes(32).toString('base64url');
export const hash=(value:string) => createHash('sha256').update(value).digest('hex');
export function appOrigin():string {
  const url=new URL(process.env.APP_ORIGIN ?? '');
  if(url.protocol!=='https:' && !(url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname))) throw Error('Invalid app origin');
  if(url.href!==`${url.origin}/`) throw Error('APP_ORIGIN must be an origin');
  return url.origin;
}
export function cookie(req:Request,name:string):string {
  const values=(req.headers.cookie??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith(`${name}=`));
  return values.length===1?values[0].slice(name.length+1):'';
}
export function setCookie(res:Response,name:string,value:string,maxAge:number) {
  res.cookie(name,value,{httpOnly:true,secure:appOrigin().startsWith('https:'),sameSite:'lax',path:'/',maxAge});
}
export function privateResponse(_req:Request,res:Response,next:NextFunction) {
  res.set({'Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','Vercel-CDN-Cache-Control':'no-store'}); next();
}
export function databaseReady(_req:Request,res:Response,next:NextFunction) {
  if(!isDbConfigured()) {res.status(503).json({error:'Accounts are temporarily unavailable. Local play is available.'});return;} next();
}
export async function readSession(req:Request):Promise<AppSession|null> {
  const token=cookie(req,'nn_session'); if(!/^[A-Za-z0-9_-]{43}$/.test(token))return null;
  const [row]=await getDb().select({id:gameAccounts.id,displayName:gameAccounts.displayName,csrfToken:gameSessions.csrfToken})
    .from(gameSessions).innerJoin(gameAccounts,eq(gameAccounts.id,gameSessions.accountId))
    .where(and(eq(gameSessions.tokenHash,hash(token)),gt(gameSessions.expiresAt,new Date())));
  return row?{account:{id:row.id,displayName:row.displayName},csrfToken:row.csrfToken}:null;
}
const SESSION_MS=30*86400_000;
/** Issue a fresh app session for this browser, revoking the one it held, and return what the client needs. */
export async function startSession(req:Request,res:Response,account:{id:string;displayName:string}):Promise<AppSession> {
  const db=getDb(),token=randomToken(),csrfToken=randomToken();
  await db.insert(gameSessions).values({tokenHash:hash(token),accountId:account.id,csrfToken,expiresAt:new Date(Date.now()+SESSION_MS)});
  const previous=cookie(req,'nn_session');
  if(previous)await db.delete(gameSessions).where(eq(gameSessions.tokenHash,hash(previous)));
  setCookie(res,'nn_session',token,SESSION_MS);
  return {account:{id:account.id,displayName:account.displayName},csrfToken};
}
export async function requireSession(req:Request,res:Response,next:NextFunction) {
  const session=await readSession(req); if(!session){res.status(401).json({error:'Sign in to access cloud saves.'});return;}
  res.locals.session=session;
  if(!['GET','HEAD'].includes(req.method) && (req.get('origin')!==appOrigin() || req.get('x-csrf-token')!==session.csrfToken)) {
    res.status(403).json({error:'Invalid request origin or CSRF token.'});return;
  }
  next();
}
