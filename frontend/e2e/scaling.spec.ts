import {test,expect,seedSave,savedGame,expectRoom} from "./fixtures";
import {newGame,applyAction,type GameState,type Action} from "../src/sim";
import {advanceSteps} from "../src/sim/step";
function act(g:GameState,a:Action){const r=applyAction(g,a);if(!r.ok)throw Error(r.message);return r.state;}
function company(){let g=advanceSteps(newGame(3,"browser-scaling"),6).state;g=act(g,{type:"start_db_upgrade"});g=advanceSteps(g,30).state;g=act(g,{type:"acknowledge_review"});return act(g,{type:"acknowledge_milestone"});}
for(const path of ["vertical","horizontal"] as const)test(`scaling continuation: ${path}`,async({page})=>{
 test.setTimeout(150000);
 const apiRequests:string[]=[];page.on("request",r=>{if(new URL(r.url()).pathname.startsWith("/api/"))apiRequests.push(r.url());});
 await page.route("**/api/**",route=>route.abort());
 await seedSave(page,company());await page.goto("/");await page.getByRole("button",{name:"Continue company",exact:true}).click();await expectRoom(page);
 const id=(await savedGame(page)).campaign!.runId;
 await page.getByRole("button",{name:/Upgrade database/}).click();
 for(let i=0;i<8;i++)await page.getByRole("button",{name:"Advance step",exact:true}).click();
 await page.getByRole("button",{name:"Run",exact:true}).click();
 await expect.poll(async()=>!!(await savedGame(page)).campaign!.incident).toBe(true);
 await page.getByRole("button",{name:"Pause",exact:true}).click();
 expect((await savedGame(page)).campaign!.incident!.primaryComponent).toBe("app-1");
 if(path==="horizontal") {
  await page.getByRole("button",{name:/Add server/}).click();await page.getByRole("button",{name:"Run",exact:true}).click();
  await expect.poll(async()=>(await savedGame(page)).campaign!.apps.length).toBe(2);await page.getByRole("button",{name:"Pause",exact:true}).click();
  const c=(await savedGame(page)).campaign!;expect(c.snapshot.instances!.map(a=>a.demand)).toEqual([1400,0]);expect(c.incident).not.toBeNull();
  await page.getByRole("main").getByRole("button",{name:"App 2",exact:true}).click();
  await expect(page.getByRole("region",{name:"Application instances"}).getByRole("button",{name:/App 2:/})).toHaveAttribute("aria-pressed","true");
  await page.getByRole("button",{name:/Deploy load balancing/}).click();await page.getByRole("button",{name:"Run",exact:true}).click();
  await expect.poll(async()=>(await savedGame(page)).campaign!.loadBalancer).toBe(true);await page.getByRole("button",{name:"Pause",exact:true}).click();
  expect((await savedGame(page)).campaign!.routing.mode).toBe("single");
  await page.getByText("Configure routing · single",{exact:true}).click();
  await page.getByRole("button",{name:"Balance across installed apps"}).click();
 }else await page.getByRole("button",{name:/Scale up App 1/}).click();
 await page.getByRole("button",{name:"Run",exact:true}).click();
 await expect(page.getByRole("dialog",{name:"Incident postmortem"})).toBeVisible({timeout:30000});
 if(path==="horizontal")expect((await savedGame(page)).campaign!.snapshot.instances!.map(a=>a.demand)).toEqual([700,700]);
 await page.getByRole("button",{name:"Continue company",exact:true}).click();await page.screenshot({path:`test-results/phase3-${path}.png`});
 const before=(await savedGame(page)).campaign!;expect(before.runId).toBe(id);expect(before.dbCapacity).toBe(2000);
 await page.reload();await page.getByRole("button",{name:"Continue company",exact:true}).click();expect((await savedGame(page)).campaign).toEqual(before);expect(apiRequests.every(url=>new URL(url).pathname==='/api/session')).toBe(true);
});
