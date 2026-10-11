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
export async function requireSession(req:Request,res:Response,next:NextFunction) {
  const session=await readSession(req); if(!session){res.status(401).json({error:'Sign in to access cloud saves.'});return;}
  res.locals.session=session;
  if(!['GET','HEAD'].includes(req.method) && (req.get('origin')!==appOrigin() || req.get('x-csrf-token')!==session.csrfToken)) {
    res.status(403).json({error:'Invalid request origin or CSRF token.'});return;
  }
  next();
}
