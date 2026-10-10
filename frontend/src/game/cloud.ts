import type {SaveEnvelope} from './saveEnvelope';
/** Owner bindings stay separate from gameplay and never change on sign-in/sign-out. */
const KEY='nn.campaign.cloud.v1';
export interface LocalCloudCopy {ownerId:string;revision:number;local:SaveEnvelope;remote?:unknown}
type Copies=Record<string,LocalCloudCopy>;
function read():Copies {
  const raw=localStorage.getItem(KEY);if(raw===null)return Object.create(null) as Copies;
  const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Cloud ownership records are unreadable. Export browser data before replacing them.');
  for(const [id,c] of Object.entries(value)) {
    if(!c||typeof c!=='object'||typeof c.ownerId!=='string'||!c.ownerId||!Number.isSafeInteger(c.revision)||c.revision<0||c.local?.runId!==id)throw Error('Cloud ownership records are unreadable.');
  }
  return value as Copies;
}
export function localCloudCopy(runId:string):LocalCloudCopy|undefined {const all=read();return Object.hasOwn(all,runId)?all[runId]:undefined;}
export function rememberCloud(copy:LocalCloudCopy) {
  const all=read(),previous=Object.hasOwn(all,copy.local.runId)?all[copy.local.runId]:undefined;
  if(previous&&previous.ownerId!==copy.ownerId)throw Error('This local run belongs to another account. Start a new guest company to attach a different run.');
  localStorage.setItem(KEY,JSON.stringify({...all,[copy.local.runId]:copy}));
}
export function checkpointCloud(envelope:SaveEnvelope) {
  const existing=localCloudCopy(envelope.runId);if(existing)rememberCloud({...existing,local:envelope});
}
export function exportCloudCopies():string {
  const copies:Record<string,string|null>={};
  for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i)!;if(key===KEY||key.startsWith('nn.campaign.before-cloud.')||key.startsWith('nn.campaign.conflict.'))copies[key]=localStorage.getItem(key);}
  return JSON.stringify(copies);
}
