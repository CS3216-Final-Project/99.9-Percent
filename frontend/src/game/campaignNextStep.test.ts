import { describe, expect, it } from "vitest";
import { newGame } from "@/sim";
import { advanceSteps } from "@/sim/step";
import { act, tick, spikeCompany, untilOffset } from "@/sim/__tests__/spikeFixtures";
import { preparedReliability, reliabilityCompany } from "@/sim/__tests__/reliabilityFixture";
import { combinedCompany } from "@/sim/__tests__/combinedFixture";
import { campaignNextStep } from "./campaignNextStep";
import { preparationEvidence } from "./preparationEvidence";
import { dataCompany } from "@/sim/__tests__/dataFixture";

it("permits observation in Opening but requires evidence during an unresolved incident", () => {
  expect(campaignNextStep(newGame()).runAllowed).toBe(true);
  const g = advanceSteps(newGame(), 7).state;
  const before = JSON.stringify(g);
  expect(campaignNextStep(g)).toMatchObject({ target: "db", runAllowed: false, eligible: true });
  expect(JSON.stringify(g)).toBe(before);
  const installing = act(g, { type: "start_db_upgrade" });
  expect(campaignNextStep(installing).runAllowed).toBe(true);
});

it("never directs Pause during measured recovery and does not change stage for a verification tick", () => {
  let g = act(advanceSteps(newGame(), 7).state, { type: "set_traffic_limit", enabled: true });
  while (!g.campaign!.incident?.stableSteps) g = tick(g);
  const a = campaignNextStep(g), b = campaignNextStep(tick(g), true);
  expect(a.message).toContain("Run to continue"); expect(b.message).toContain("Keep running");
  expect(b.message).not.toContain("Pause"); expect(a.key).toBe(b.key);
  expect(a.runAllowed).toBe(true); expect(a.eligible).toBe(false);
});

describe("Traffic Spikes", () => {
  let base = spikeCompany(false);
  base = tick(act(base,{type:"add_server"}),2);
  base = tick(act(base,{type:"scale_up",appId:"app-3"}),3);
  base = tick(act(base,{type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]}));
  it.each([0, 8, 28, 48, 68])("describes the actual pulse boundary at offset %s", offset => {
    const g = untilOffset(base, offset);
    const model = campaignNextStep(g);
    expect(g.campaign!.incident).toBeNull();
    const expected = offset === 0 ? "first traffic spike" : offset === 8 || offset === 48 ? "Traffic has increased" : offset === 28 ? "first spike has ended" : "Both traffic spikes are over";
    expect(model.message).toContain(expected);
    if (offset === 0 || offset === 28 || offset === 68) expect(model.message).toContain("Run");
  });
  it.each([false, true])("explains the last baseline observation (running=%s)", running => {
    const g = untilOffset(base, 71);
    expect(g.campaign!.spikeStage!.baselineStableSteps).toBe(4);
    expect(campaignNextStep(g,running).eligible).toBe(!running);
    expect(campaignNextStep(g, running).message).toContain("One more stable observation");
    expect(campaignNextStep(g, running).message).toContain(running ? "Keep running" : "Run your company");
  });
  it("requires the existing review at completion and Next after acknowledgement", () => {
    let g = untilOffset(base, 72);
    expect(campaignNextStep(g)).toMatchObject({ target: "review", runAllowed: false, eligible: false });
    g = act(g, { type: "acknowledge_spikes" });
    expect(campaignNextStep(g)).toMatchObject({ target: "next", runAllowed: false });
  });
});

describe("Stay Online", () => {
  it("distinguishes enabled arming, pending installation, scheduled failure and investigation", () => {
    const g = reliabilityCompany();
    expect(campaignNextStep(g)).toMatchObject({ target: "progression", runAllowed: false });
    const owned = act(g, { type: "unlock_reliability", tech: "health_checks" });
    expect(campaignNextStep(act(owned, { type: "deploy_health_checks" }))).toMatchObject({ target: "run", eligible: false });
    const scheduled = act(g, { type: "arm_reliability" });
    expect(campaignNextStep(scheduled).message).toContain("scheduled application failure");
    const failed = tick(scheduled, 8);
    expect(campaignNextStep(failed).target).toBe("app");
  });
  it.each([false, true])("uses actual stable progress after restoration (running=%s)", running => {
    let g = act(preparedReliability(), { type: "arm_reliability" });
    for (let i=0;i<100 && g.campaign!.reliabilityStage!.stableSteps!==4;i++) {
      if (g.phase === "review") g=act(g,{type:"acknowledge_review"});
      g=tick(g);
    }
    expect(g.campaign!.reliabilityStage!.stableSteps).toBe(4);
    expect(campaignNextStep(g,running).eligible).toBe(!running);
    expect(campaignNextStep(g,running).message).toContain("One more stable observation");
    expect(campaignNextStep(g,running).message).toContain(running ? "Keep running" : "Run your company");
    const complete=tick(g);
    expect(campaignNextStep(complete)).toMatchObject({target:"review",runAllowed:false});
  });
});

it("keeps stage identity stable across readiness counters and changes it for decisions", () => {
  const g = combinedCompany();
  expect(campaignNextStep(g).key).toBe(campaignNextStep(tick(g, 3)).key);
  expect(campaignNextStep(g).key).not.toBe(campaignNextStep(tick(g, 5)).key);
  expect(campaignNextStep(tick(g, 5)).target).toBe("progression");
});

it("explains actual growth-wave registrations while the company is preparing",()=>{
  const model=campaignNextStep(combinedCompany());
  expect(model.message).toContain("five stable full-traffic game seconds");
  expect(model.message).toContain("Registered users increase when that wave begins");
  expect(model.message).toContain("promotions are optional");
  expect(campaignNextStep(tick(combinedCompany(),5)).message).toContain("Growth waves bring registered users");
});

it("distinguishes research, deployment and automatic routing using actual action evidence", () => {
  const researched = act(spikeCompany(false), { type: "unlock_autoscaling" });
  expect(preparationEvidence(researched.campaign!, "spikes")?.notes.join(" ")).toContain("researched but no controller");
  let g = untilOffset(spikeCompany(true), 24);
  const before = JSON.stringify(g);
  expect(preparationEvidence(g.campaign!, "spikes")?.notes.join(" ")).toContain("automatic routing included");
  expect(JSON.stringify(g)).toBe(before);
  g = spikeCompany(false);
  expect(preparationEvidence(g.campaign!, "data")?.notes.join(" ")).toContain("eligible reads");
});

it("does not manufacture historic observations when snapshots are unavailable", () => {
  const g=spikeCompany(false),c=g.campaign!;
  c.recent=[]; c.reports=[];
  expect(preparationEvidence(c,"spikes")).toBeNull();
});

it("diagnoses installed but unrouted capacity before suggesting another server", () => {
  let g=act(dataCompany(),{type:"set_routing",mode:"balanced",targets:["app-1"]});
  for(let i=0;i<30&&!g.campaign!.incident;i++)g=tick(g);
  expect(g.campaign!.incident).toBeTruthy();
  expect(g.campaign!.apps.some(a=>!a.routed)).toBe(true);
  const advice=campaignNextStep(g);
  expect(advice).toMatchObject({target:"routing",runAllowed:false});
  expect(advice.message).toContain("aren't receiving traffic");
  expect(advice.message).not.toContain("Add server");
});

it("does not describe researched Health Checks as operational redundancy", () => {
  const g=act(reliabilityCompany(),{type:"unlock_reliability",tech:"health_checks"});
  const evidence=preparationEvidence(g.campaign!,"reliability");
  expect(evidence?.notes.join(" ")).toContain("researched but not deployed");
  expect(evidence?.notes.join(" ")).toContain("did not detect failed servers or create redundancy");
});

it("recognises preparation before the first pulse without claiming automatic scaling", () => {
  let g=spikeCompany(false);
  g=tick(act(g,{type:"add_server"}),2);
  g=tick(act(g,{type:"scale_up",appId:"app-3"}),3);
  g=tick(act(g,{type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]}));
  g=untilOffset(g,24);
  const evidence=preparationEvidence(g.campaign!,"spikes");
  expect(evidence?.title).toContain("existing preparation");
  expect(evidence?.notes.join(" ")).toContain("During pulse 1");
  expect(evidence?.notes.join(" ")).not.toContain("Autoscaling installed");
});

it("does not credit spare capacity for a pulse served under a traffic limit", () => {
  const g=untilOffset(tick(act(spikeCompany(false),{type:"set_traffic_limit",enabled:true})),24);
  expect(g.campaign!.snapshot.rejected).toBeGreaterThan(0);
  expect(preparationEvidence(g.campaign!,"spikes")).toBeNull();
});

it("credits surviving capacity only while a real failed server and completed work were observed", () => {
  let g=act(preparedReliability(),{type:"arm_reliability"});
  for(let i=0;i<100&&!g.campaign!.reliabilityStage!.completedStep;i++){
    if(g.phase==="review")g=act(g,{type:"acknowledge_review"});
    g=tick(g);
  }
  const c=g.campaign!, before=JSON.stringify(c);
  expect(preparationEvidence(c,"reliability")?.notes.join(" ")).toContain("Healthy servers continued completing requests");
  expect(JSON.stringify(c)).toBe(before);
  c.recent=[];c.reports=[];
  expect(preparationEvidence(c,"reliability")).toBeNull();
});

it("directs attention to application pressure before overload becomes an incident", () => {
  const g=untilOffset(spikeCompany(false),8);
  expect(g.campaign!.incident).toBeNull();
  expect(g.campaign!.snapshot.app.backlog).toBeGreaterThan(0);
  expect(campaignNextStep(g)).toMatchObject({target:"app",runAllowed:false});
});

it("directs attention to database pressure even when application capacity is sufficient", () => {
  let g=spikeCompany(false,"write-heavy");
  g=tick(act(g,{type:"add_server"}),2);
  g=tick(act(g,{type:"scale_up",appId:"app-3"}),3);
  g=tick(act(g,{type:"set_routing",mode:"balanced",targets:["app-1","app-2","app-3"]}));
  g=untilOffset(g,8);
  expect(g.campaign!.incident).toBeNull();
  expect(g.campaign!.snapshot.app.backlog).toBe(0);
  expect(g.campaign!.snapshot.db.backlog).toBeGreaterThan(0);
  expect(campaignNextStep(g)).toMatchObject({target:"db",runAllowed:false});
});

it.each(["read-heavy","write-heavy"] as const)("uses measured Data Strategy pressure before an incident (%s)",profile=>{
  let g=dataCompany(profile);
  for(let i=0;i<30&&g.campaign!.snapshot.db.demand<=g.campaign!.snapshot.db.capacity&&!g.campaign!.snapshot.db.backlog;i++)g=tick(g);
  expect(g.campaign!.incident).toBeNull();
  const model=campaignNextStep(g);
  expect(model).toMatchObject({target:"db",eligible:true,runAllowed:false});
  expect(model.message).toContain("read/write composition");
  expect(model.message).toContain("writes still reach the database");
});

it("spots unrouted capacity before an incident without prescribing additional servers",()=>{
  let g=tick(act(dataCompany(),{type:"start_db_upgrade"}),4);
  g=act(g,{type:"set_routing",mode:"balanced",targets:["app-1"]});
  for(let i=0;i<30&&g.campaign!.snapshot.app.demand<=g.campaign!.snapshot.app.capacity;i++)g=tick(g);
  expect(g.campaign!.incident).toBeNull();
  expect(g.campaign!.pending).toHaveLength(0);
  expect(campaignNextStep(g)).toMatchObject({target:"routing",eligible:true,runAllowed:false});
  expect(campaignNextStep(g).message).toContain("not receiving traffic");
});
