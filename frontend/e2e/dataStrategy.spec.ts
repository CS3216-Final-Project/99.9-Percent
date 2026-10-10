import {test,expect,seedSave,savedGame,expectRoom} from "./fixtures";
import {newGame,applyAction,type Action,type GameState} from "../src/sim";
import {advanceSteps} from "../src/sim/step";
function act(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function prepared(){
 let g=advanceSteps(newGame(0,"data-browser"),6).state;
 g=advanceSteps(act(g,{type:"start_db_upgrade"}),30).state;g=act(g,{type:"acknowledge_review"});g=act(g,{type:"acknowledge_milestone"});
 const install=(a:Action,n:number)=>{g=advanceSteps(act(g,a),n).state;};
 install({type:"set_traffic_limit",enabled:true},1);install({type:"start_db_upgrade"},3);install({type:"add_server"},2);
 install({type:"scale_up",appId:"app-1"},3);install({type:"scale_up",appId:"app-2"},3);
 install({type:"deploy_load_balancer"},2);install({type:"set_routing",mode:"balanced",targets:["app-1","app-2"]},1);
 install({type:"set_traffic_limit",enabled:false},1);return g;
}
for(const strategy of ["cache","database"] as const)test(`data strategy: ${strategy}, continuity and reload`,async({page})=>{
 test.setTimeout(150000);const api:string[]=[];page.on("request",r=>{if(new URL(r.url()).pathname.startsWith("/api/"))api.push(r.url());});await page.route("**/api/**",r=>r.abort());
 await seedSave(page,prepared());await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
 const guidance=page.getByRole("region",{name:"Campaign guidance"});
 await expect(page.getByRole("navigation",{name:"Campaign progression"})).toContainText("Data Strategy Available next");
 await page.getByRole("button",{name:"Continue to data strategy",exact:true}).click();
 await expect(guidance).toContainText("Current stage: Data Strategy");
 await expect(guidance).toContainText("80% reads / 20% writes");
 expect((await savedGame(page)).campaign!.dataStage!.profile).toBe("read-heavy");
 for(let i=0;i<6;i++)await page.getByRole("button",{name:"Advance step",exact:true}).click();
 expect((await savedGame(page)).campaign!.incident!.primaryComponent).toBe("db");
 const data=page.getByRole("region",{name:"Data strategy"});
 if(strategy==="cache")await data.getByRole("button",{name:/Deploy Read Cache/}).click();
 else await page.getByRole("button",{name:/Upgrade database/}).click();
 await page.getByRole("button",{name:"Run",exact:true}).click();await expect(page.getByRole("dialog",{name:"Incident postmortem"})).toBeVisible({timeout:30000});
 let c=(await savedGame(page)).campaign!;expect(c.runId).toBe("data-browser");
 if(strategy==="cache") {
  expect(c.snapshot.data!.effectiveHitRateUsed).toBe(6000);expect(c.snapshot.db.demand).toBe(1248);
  await expect(page.getByRole("dialog")).toContainText("writes");
 } else expect(c.dbCapacity).toBe(3000);
 await page.getByRole("button",{name:"Continue company",exact:true}).click();
 if(strategy==="cache") {
  await page.getByRole("navigation",{name:"Request dependencies"}).getByRole("button",{name:/Read Cache/}).click();
  await expect(page.getByRole("status").filter({hasText:"Selected component"})).toContainText("Read Cache");
  await data.getByRole("button",{name:"Observe contrasting workload",exact:true}).click();
  await page.getByRole("button",{name:"Run",exact:true}).click();await expect.poll(async()=>(await savedGame(page)).campaign!.snapshot.db.demand).toBe(2112);
  await expect.poll(async()=>!!(await savedGame(page)).campaign!.incident).toBe(true);await page.getByRole("button",{name:"Pause",exact:true}).click();
  await expect(data).toContainText("write-heavy");expect((await savedGame(page)).campaign!.snapshot.data!.writes).toBe(1920);
  await page.getByRole("button",{name:/Upgrade database/}).click();await page.getByRole("button",{name:"Run",exact:true}).click();
  await expect(page.getByRole("dialog",{name:"Incident postmortem"})).toBeVisible({timeout:30000});
  expect((await savedGame(page)).campaign!.dbCapacity).toBe(3000);await page.getByRole("button",{name:"Continue company",exact:true}).click();
 }
 await expect(page.getByRole("navigation",{name:"Campaign progression"})).toBeInViewport();
 await page.screenshot({path:`test-results/phase4-${strategy}.png`});c=(await savedGame(page)).campaign!;
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();expect((await savedGame(page)).campaign).toEqual(c);await expect(guidance).toContainText("Current stage: Data Strategy");expect(api).toEqual([]);
});
