/** Saved Phase 7 configuration; preceding scenario versions are immutable. */
export const COMBINED_CAMPAIGN = {
 id:"combined-campaign", version:1, poolId:"combined-pool", poolVersion:1,
 finalUserTarget:50000, initialUsers:2000, initialDemand:2400, finalDemand:3000,
 warningSteps:8, stableSteps:5, promotionCostCents:50000, promotionDelay:1,
 promotionIncrement:400, promotionDuration:12, promotionCooldown:30,
} as const;
export type CombinedTemplate="read-growth-pulse"|"write-pressure"|"failure-under-load";
export interface CombinedScenario { template:CombinedTemplate; peak:number; duration:12|16 }
export function targetValid(target:number):boolean {
 return Number.isSafeInteger(target)&&target>=2008&&Number.isSafeInteger((target-2000)*600);
}
export function growthUsers(target:number,index:number):number {
 if(!targetValid(target)||!Number.isInteger(index)||index<0||index>2)throw Error("Invalid growth target");
 return index===2?target:2000+Math.floor((target-2000)*(index===0?3/8:11/16));
}
export function baselineDemand(users:number,target:number):number {
 if(!targetValid(target)||!Number.isSafeInteger(users)||users<2000||users>target)throw Error("Invalid user count");
 return 2400+Math.floor((users-2000)*600/(target-2000));
}
export function scenarioValid(s:CombinedScenario):boolean {
 return !!s&&[12,16].includes(s.duration)&&
 (s.template==="read-growth-pulse"?[3800,4000]:s.template==="write-pressure"?[3000]:s.template==="failure-under-load"?[3400,3600]:[]).includes(s.peak);
}
export function sequenceValid(xs:CombinedScenario[]):boolean {
 return Array.isArray(xs)&&xs.length===3&&new Set(xs.map(x=>x?.template)).size===3&&xs.every(scenarioValid);
}
