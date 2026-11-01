import {Router, type Request, type Response} from 'express';
import {and, eq, gt, lt, sql} from 'drizzle-orm';
import {getDb} from '../db/client.js';
import {gameAccounts, gameAuthAttempts, gameEmailCredentials, gameSessions} from '../db/schema.js';
import {appOrigin,cookie,hash,randomToken,setCookie,privateResponse,databaseReady,requireSession,readSession,startSession} from '../auth/session.js';
import {authorizationUrl,exchangeGoogle} from '../auth/google.js';
import {EMAIL_ISSUER,PASSWORD_MAX,PASSWORD_MIN,displayName,hashPassword,normaliseEmail,rejectUnknown,validPassword,verifyPassword} from '../auth/password.js';
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
  // Inserting first tells a sign-up from a returning sign-in; a concurrent callback for the same identity updates instead.
  const [created]=await db.insert(gameAccounts).values(identity).onConflictDoNothing().returning();
  const [account]=created?[created]:await db.update(gameAccounts).set({displayName:identity.displayName})
    .where(and(eq(gameAccounts.issuer,identity.issuer),eq(gameAccounts.subject,identity.subject))).returning();
  await startSession(req,res,account,!!created);res.redirect(`${origin}/?auth=signed-in`);
});
// Email accounts never merge with a Google account that shares the address: each issuer is its own identity.
const LOCK_AFTER=10, LOCK_MS=15*60_000;
/** Password requests set a session without one, so only the game's own page may send them (login CSRF). */
function fromApp(req:Request,res:Response):boolean {
  let origin:string;
  try {origin=appOrigin();} catch {res.status(503).json({error:'Email sign-in is not configured. Local play is available.'});return false;}
  if(req.get('origin')!==origin){res.status(403).json({error:'Invalid request origin.'});return false;}
  return true;
}
authRouter.post('/auth/email/register',async(req,res)=>{
  if(!fromApp(req,res))return;
  const email=normaliseEmail(req.body?.email);
  if(!email){res.status(400).json({error:'Enter a valid email address.'});return;}
  if(!validPassword(req.body?.password)){res.status(400).json({error:`Use a password of ${PASSWORD_MIN} to ${PASSWORD_MAX} characters.`});return;}
  const name=displayName(req.body?.name,email);
  if(!name){res.status(400).json({error:'Use a name of up to 60 characters.'});return;}
  const passwordHash=await hashPassword(req.body.password),db=getDb();
  // An account row without credentials (an interrupted earlier registration) can still be completed.
  const [created]=await db.insert(gameAccounts).values({issuer:EMAIL_ISSUER,subject:email,displayName:name}).onConflictDoNothing().returning();
  const [account]=created?[created]:await db.select().from(gameAccounts).where(and(eq(gameAccounts.issuer,EMAIL_ISSUER),eq(gameAccounts.subject,email)));
  const [credential]=await db.insert(gameEmailCredentials).values({accountId:account.id,passwordHash}).onConflictDoNothing().returning();
  if(!credential){res.status(409).json({error:'An account with this email already exists. Sign in instead.'});return;}
  // Without a credential nobody could have signed in to the account, so completing it is creating it.
  res.status(201).json(await startSession(req,res,account,true));
});
authRouter.post('/auth/email/login',async(req,res)=>{
  if(!fromApp(req,res))return;
  const email=normaliseEmail(req.body?.email),password=req.body?.password;
  if(!email||typeof password!=='string'||!password||password.length>PASSWORD_MAX){res.status(400).json({error:'Enter your email and password.'});return;}
  const db=getDb();
  const [row]=await db.select({id:gameAccounts.id,displayName:gameAccounts.displayName,passwordHash:gameEmailCredentials.passwordHash,lockedUntil:gameEmailCredentials.lockedUntil})
    .from(gameEmailCredentials).innerJoin(gameAccounts,eq(gameAccounts.id,gameEmailCredentials.accountId))
    .where(and(eq(gameAccounts.issuer,EMAIL_ISSUER),eq(gameAccounts.subject,email)));
  const incorrect=()=>res.status(401).json({error:'Email or password is incorrect.'});
  if(!row){await rejectUnknown(password);incorrect();return;}
  if(row.lockedUntil&&row.lockedUntil>new Date()){res.status(429).json({error:'Too many incorrect passwords. Try again in 15 minutes.'});return;}
  if(!await verifyPassword(password,row.passwordHash)) {
    // One statement counts the failure, so concurrent guesses cannot skip the lock.
    await db.update(gameEmailCredentials).set({
      failedAttempts:sql`case when ${gameEmailCredentials.failedAttempts} + 1 >= ${LOCK_AFTER} then 0 else ${gameEmailCredentials.failedAttempts} + 1 end`,
      lockedUntil:sql`case when ${gameEmailCredentials.failedAttempts} + 1 >= ${LOCK_AFTER} then ${new Date(Date.now()+LOCK_MS).toISOString()}::timestamptz else ${gameEmailCredentials.lockedUntil} end`,
    }).where(eq(gameEmailCredentials.accountId,row.id));
    incorrect();return;
  }
  await db.update(gameEmailCredentials).set({failedAttempts:0,lockedUntil:null}).where(eq(gameEmailCredentials.accountId,row.id));
  res.json(await startSession(req,res,row));
});
authRouter.post('/auth/logout',requireSession,async(req,res)=>{
  await getDb().delete(gameSessions).where(eq(gameSessions.tokenHash,hash(cookie(req,'nn_session'))));
  setCookie(res,'nn_session','',0);res.status(204).end();
});
