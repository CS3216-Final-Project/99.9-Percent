import type { GameState } from "@/sim";
export type Payload = Record<string,string|number|boolean|null>;
export interface PlaytestEvent {
  eventId:string; eventVersion:1; name:string; runId:string; sessionId:string;
  buildId:string; scenarioId:string; scenarioVersion:number; physicalStep:number;
  occurredAt:string; payload:Payload;
}
export interface Session {
  id:string; startedAt:string; endedAt:string|null; activeMs:number; sequence:number;
  source:"unspecified"|"recruited"|"organic"; facilitatorInterventions:number;
}
export interface Measurement {
  origin:"fresh"|"phase1"; runStarted:boolean; openingStartedAt:string|null;
  activeMs:number; replayOf:string|null; session:Session|null; cursor:number;
  pending:PlaytestEvent[];
}
export const emptyMeasurement=():Measurement=>({
  origin:"fresh",runStarted:false,openingStartedAt:null,activeMs:0,replayOf:null,
  session:null,cursor:0,pending:[]
});
export const buildId=import.meta.env?.VITE_BUILD_ID || "dev/unrecorded";
export function event(m:Measurement,g:GameState,name:string,payload:Payload={},now=new Date().toISOString(),id?:string) {
  if(!m.session)return;
  const c=g.campaign!;
  const eventId=id??`${c.runId}:session:${m.session.id}:${++m.session.sequence}`;
  if(m.pending.some(e=>e.eventId===eventId))return;
  m.pending.push({eventId,eventVersion:1,name,runId:c.runId,sessionId:m.session.id,
    buildId,scenarioId:c.scenarioId,scenarioVersion:c.scenarioVersion,physicalStep:c.step,occurredAt:now,
    payload:{...payload,activeMs:m.activeMs,source:m.session.source}});
}
export function beginSession(previous:Measurement,g:GameState,id:string,now:string):Measurement {
  const m=structuredClone(previous);
  if(!m.session||m.session.endedAt)m.session={id,startedAt:now,endedAt:null,activeMs:0,sequence:0,source:"unspecified",facilitatorInterventions:0};
  const first=!m.runStarted && m.origin==="fresh";
  if(first)m.openingStartedAt=now;
  m.runStarted=true;
  event(m,g,first?"run_started":"run_resumed",{},now);
  return m;
}
export function projectEvents(previous:Measurement,g:GameState,now:string):Measurement {
  const m=structuredClone(previous),c=g.campaign!;
  if(!m.session || m.session.endedAt)return m;
  const timing=()=>({wallMs:m.openingStartedAt?Math.max(0,Date.parse(now)-Date.parse(m.openingStartedAt)):null,timingKnown:m.openingStartedAt!==null});
  for(const t of c.trace.filter(t=>t.id>m.cursor)) {
    const id=`${c.runId}:trace:${t.id}`;
    const emit=(name:string,payload:Payload=t.data,suffix="")=>{event(m,g,name,payload,now,id+suffix);m.pending[m.pending.length-1].physicalStep=t.step;};
    switch(t.type) {
      case "inspection": emit("component_inspected",{component:t.data.component,snapshotStep:t.step});break;
      case "incident-opened":emit("incident_opened");break;
      case "incident-recovered":emit("incident_recovered",{...t.data,...timing()});break;
      case "bankruptcy":emit("run_failed",{...t.data,...timing()});break;
      case "action-requested": {
        const a=c.actions.find(a=>a.id===t.data.actionId)!;
        emit(a.type==="add-app"?"app_instance_requested":a.type==="upgrade-db"?"database_upgrade_requested":"traffic_limit_requested",
          {...t.data,action_requested_step:a.requestedStep});
        emit("gameplay_decision",{actionId:a.id,replayOf:m.replayOf},":decision");break;
      }
      case "action-activated": {
        const a=c.actions.find(a=>a.id===t.data.actionId)!;
        emit(a.type==="limit"?"traffic_limit_applied":a.type==="unlimit"?"traffic_limit_removed":"action_activated",
          {...t.data,action_requested_step:a.requestedStep,action_activated_step:a.activatedStep});
        break;
      }
      case "milestone-awarded":
        emit("run_completed_opening",{...t.data,...timing()});
        emit("opening_completion_time",timing(),":time");break;
      case "milestone-acknowledged":emit("opening_milestone_acknowledged");break;
    }
    m.cursor=t.id;
  }
  return m;
}
export function measurementValid(m:Measurement):boolean {
  if(!m || !["fresh","phase1"].includes(m.origin) || typeof m.runStarted!=="boolean" ||
    !(m.openingStartedAt===null||Number.isFinite(Date.parse(m.openingStartedAt))) ||
    !(m.replayOf===null||typeof m.replayOf==="string") ||
    !Number.isFinite(m.activeMs)||m.activeMs<0||!Number.isSafeInteger(m.cursor)||m.cursor<0||!Array.isArray(m.pending))return false;
  if(m.session && (typeof m.session.id!=="string"||!m.session.id||!Number.isFinite(Date.parse(m.session.startedAt))||
    !(m.session.endedAt===null||Number.isFinite(Date.parse(m.session.endedAt)))||
    !Number.isFinite(m.session.activeMs)||m.session.activeMs<0||!Number.isSafeInteger(m.session.sequence)||m.session.sequence<0||
    !["unspecified","organic","recruited"].includes(m.session.source)||!Number.isSafeInteger(m.session.facilitatorInterventions)||m.session.facilitatorInterventions<0))return false;
  return m.pending.every(e=>e.eventVersion===1&&typeof e.eventId==="string"&&typeof e.name==="string"&&
    typeof e.runId==="string"&&typeof e.sessionId==="string"&&typeof e.buildId==="string"&&
    e.scenarioId==="opening-db"&&e.scenarioVersion===1&&Number.isSafeInteger(e.physicalStep)&&e.physicalStep>=0&&
    Number.isFinite(Date.parse(e.occurredAt))&&e.payload&&typeof e.payload==="object");
}
