import {Router} from 'express';
import {and,eq,desc,sql} from 'drizzle-orm';
import type {AppSession,CampaignEnvelope} from '../../../shared/campaign.ts';
import {getDb} from '../db/client.js';
import {gameRuns} from '../db/schema.js';
import {privateResponse,databaseReady,requireSession} from '../auth/session.js';
export const runsRouter=Router();
runsRouter.use(privateResponse,databaseReady,requireSession);
const idValid=(value:unknown):value is string => typeof value==='string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
function finite(value:unknown,depth=0):boolean {
  if(depth>100)return false;
  if(typeof value==='number')return Number.isFinite(value);
  if(value&&typeof value==='object')return Object.values(value).every(x=>finite(x,depth+1));
  return true;
}
/** Transport validation only; gameplay clients validate the full versioned simulation before loading. */
export function envelopeValid(value:unknown,id:string):value is CampaignEnvelope {
  if(!value || typeof value!=='object')return false;
  const e=value as CampaignEnvelope;
  return [3,4,5,6].includes(e.schemaVersion) && e.scenarioId==='opening-db' && e.scenarioVersion===1 && e.runId===id &&
    Number.isSafeInteger(e.seed) && (e.seed|0)===e.seed && Number.isSafeInteger(e.step) && e.step>=0 && e.step<=1_000_000 &&
    Array.isArray(e.inputs) && e.inputs.length<=100_000 && e.inputs.every(i=>i&&Number.isSafeInteger(i.step)&&i.step>=0&&i.step<=e.step&&i.action&&typeof i.action.type==='string') &&
    !!e.runtime && Number.isSafeInteger(e.runtime.remainderMs) && e.runtime.remainderMs>=0 && e.runtime.remainderMs<1000 && Number.isFinite(e.savedAt) && finite(e);
}
runsRouter.get('/',async(_req,res)=>{
  const owner=(res.locals.session as AppSession).account.id;
  res.json(await getDb().select({runId:gameRuns.runId,revision:gameRuns.revision,updatedAt:gameRuns.updatedAt}).from(gameRuns).where(eq(gameRuns.accountId,owner)).orderBy(desc(gameRuns.updatedAt)).limit(100));
});
runsRouter.get('/:runId',async(req,res)=>{
  if(!idValid(req.params.runId)){res.status(400).json({error:'Invalid run ID.'});return;}
  const [run]=await getDb().select().from(gameRuns).where(and(eq(gameRuns.runId,req.params.runId),eq(gameRuns.accountId,(res.locals.session as AppSession).account.id)));
  if(!run){res.status(404).json({error:'Run not found.'});return;}
  res.json({runId:run.runId,revision:run.revision,envelope:run.envelope,updatedAt:run.updatedAt});
});
runsRouter.put('/:runId',async(req,res)=>{
  const id=req.params.runId,owner=(res.locals.session as AppSession).account.id;
  const {expectedRevision,envelope}=req.body??{};
  if(!idValid(id) || !Number.isSafeInteger(expectedRevision) || expectedRevision<0 || expectedRevision>=2147483647 || !envelopeValid(envelope,id)) {
    res.status(400).json({error:'Invalid revision or unsupported campaign snapshot. Local save has not been changed.'});return;
  }
  const db=getDb();
  const [saved]=expectedRevision===0
    ? await db.insert(gameRuns).values({runId:id,accountId:owner,revision:1,envelope}).onConflictDoNothing().returning()
    : await db.update(gameRuns).set({envelope,revision:sql`${gameRuns.revision}+1`,updatedAt:new Date()})
      .where(and(eq(gameRuns.runId,id),eq(gameRuns.accountId,owner),eq(gameRuns.revision,expectedRevision))).returning();
  if(saved){res.json({runId:saved.runId,revision:saved.revision,envelope:saved.envelope,updatedAt:saved.updatedAt});return;}
  const [current]=await db.select().from(gameRuns).where(and(eq(gameRuns.runId,id),eq(gameRuns.accountId,owner)));
  res.status(409).json({error:'Cloud save changed or this run cannot be attached.',...(current?{current:{runId:current.runId,revision:current.revision,envelope:current.envelope,updatedAt:current.updatedAt}}:{})});
});
