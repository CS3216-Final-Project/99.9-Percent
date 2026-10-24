import type { Campaign } from "./campaignTypes";
import type { Action, ActionResult, GameState } from "./types";
import { trace } from "./trace";

export const INTRODUCTION_COMPONENTS = ["gateway", "app", "db", "monitoring"] as const;
export function introductionActive(c: Campaign | undefined): boolean {
 return !!c?.launchWeek?.introduction && !c.launchWeek.introduction.completed;
}
export function nextIntroductionComponent(c: Campaign) {
 return INTRODUCTION_COMPONENTS[c.launchWeek?.introduction?.explored.length ?? 0];
}
/** Replayable tutorial inputs. The engine never depends on a modal, storage or wall time. */
export function introductionAction(s: GameState, action: Action): Extract<ActionResult,{ok:false}> | null | undefined {
 const c=s.campaign!,lw=c.launchWeek;
 const fail=(message:string):Extract<ActionResult,{ok:false}>=>({ok:false,reason:"invalid",message});
 if(action.type==="begin_introduction") {
  if(!lw || lw.introduction || c.step!==0 || c.inputs.length!==0 || s.phase!=="management")return fail("The introduction starts only on a new company.");
  lw.introduction={version:1,explored:[],inspected:null,completed:false};
  trace(c,"introduction-started");return null;
 }
 if(action.type==="acknowledge_introduction") {
  const intro=lw?.introduction;
  if(!intro || intro.completed || intro.inspected!==action.equipment || nextIntroductionComponent(c)!==action.equipment)return fail("Inspect and acknowledge the current introduction component first.");
  intro.explored.push(action.equipment as typeof INTRODUCTION_COMPONENTS[number]);intro.inspected=null;
  trace(c,"introduction-component-explored",{component:action.equipment});return null;
 }
 if(action.type==="complete_introduction") {
  const intro=lw?.introduction;
  if(!lw || !intro || intro.completed || intro.explored.length!==INTRODUCTION_COMPONENTS.length)return fail("Explore Network, App Servers, Database and Monitoring before completing the introduction.");
  if(action.handoff==="opening") {
   intro.completed=true;intro.inspected=null;
   trace(c,"introduction-completed",{handoff:"opening"});return null;
  }
  // Unversioned completion inputs keep their historical direct-to-Scaling replay.
  intro.completed=true;intro.inspected=null;lw.completedStep=c.step;lw.researchEarned=1;lw.doorsOpened=true;
  c.openingMilestone={id:"launch-week",incidentId:null,awardedStep:c.step,acknowledged:true};
  trace(c,"introduction-completed");return null;
 }
 if(introductionActive(c)) {
  if(action.type==="incident_inspect") {
   // Opening a different component never counts as completing the requested step.
   lw!.introduction!.inspected=action.equipment;
   return undefined;
  }
  return fail("Explore the infrastructure before making business decisions in Chapter 1.");
 }
 return undefined;
}
