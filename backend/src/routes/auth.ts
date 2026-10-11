import {Router} from 'express';
import {and, eq, gt, lt} from 'drizzle-orm';
import {getDb} from '../db/client.js';
import {gameAccounts, gameAuthAttempts, gameSessions} from '../db/schema.js';
import {appOrigin,cookie,hash,randomToken,setCookie,privateResponse,databaseReady,requireSession,readSession} from '../auth/session.js';
import {authorizationUrl,exchangeGoogle} from '../auth/google.js';
export const authRouter=Router();
authRouter.use((req,res,next)=> { if(req.path==='/session'||req.path.startsWith('/auth/')) privateResponse(req,res,()=>databaseReady(req,res,next)); else next('router'); });
authRouter.get('/session',async(req,res)=>{
  const session=await readSession(req);
  if(!session){res.status(401).json({error:'No active session.'});return;} res.json(session);
});
authRouter.get('/auth/google',async(_req,res)=>{
  let origin:string;
  try {
    origin=appOrigin();
    if(!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_REDIRECT_URI!==`${origin}/api/auth/google/callback`)throw Error('Missing OAuth configuration');
  } catch {res.status(503).json({error:'Google sign-in is not configured. Local play is available.'});return;}
  const state=randomToken(),binding=randomToken(),nonce=randomToken(),verifier=randomToken();
  const redirect=await authorizationUrl(state,{nonce,verifier});
  const db=getDb();
  await db.delete(gameAuthAttempts).where(lt(gameAuthAttempts.expiresAt,new Date()));
  await db.insert(gameAuthAttempts).values({stateHash:hash(state),bindingHash:hash(binding),nonce,verifier,expiresAt:new Date(Date.now()+600_000)});
  setCookie(res,'nn_auth',binding,600_000);res.redirect(redirect);
});
authRouter.get('/auth/google/callback',async(req,res)=>{
  const origin=appOrigin(),state=req.query.state,binding=cookie(req,'nn_auth');
  if(typeof state!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(state) || !/^[A-Za-z0-9_-]{43}$/.test(binding)) {
    res.status(400).json({error:'Invalid sign-in callback.'});return;
  }
  // Atomic consumption makes state single-use across serverless requests and concurrent callbacks.
  const db=getDb();
  const [attempt]=await db.delete(gameAuthAttempts).where(and(eq(gameAuthAttempts.stateHash,hash(state)),eq(gameAuthAttempts.bindingHash,hash(binding)),gt(gameAuthAttempts.expiresAt,new Date()))).returning();
  if(!attempt){res.status(400).json({error:'Expired or already used sign-in callback.'});return;}
  setCookie(res,'nn_auth','',0);
  if(req.query.error){res.redirect(`${origin}/?auth=cancelled`);return;}
  let identity;
  try { identity=await exchangeGoogle(new URL(req.originalUrl,origin),state,attempt); }
  catch {res.redirect(`${origin}/?auth=failed`);return;}
  const [account]=await db.insert(gameAccounts).values(identity).onConflictDoUpdate({target:[gameAccounts.issuer,gameAccounts.subject],set:{displayName:identity.displayName}}).returning();
  const token=randomToken(),csrfToken=randomToken();
  await db.insert(gameSessions).values({tokenHash:hash(token),accountId:account.id,csrfToken,expiresAt:new Date(Date.now()+30*86400_000)});
  const previous=cookie(req,'nn_session');
  if(previous)await db.delete(gameSessions).where(eq(gameSessions.tokenHash,hash(previous)));
  setCookie(res,'nn_session',token,30*86400_000);res.redirect(`${origin}/?auth=signed-in`);
});
authRouter.post('/auth/logout',requireSession,async(req,res)=>{
  await getDb().delete(gameSessions).where(eq(gameSessions.tokenHash,hash(cookie(req,'nn_session'))));
  setCookie(res,'nn_session','',0);res.status(204).end();
});
