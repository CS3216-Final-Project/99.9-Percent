import { advanceCampaignStep } from "./fixtures";
import {test,expect,seedSave,expectRoom,savedGame} from './fixtures';
import {newGame} from '../src/sim';
import type {AppSession,CloudRun} from '../../shared/campaign';
test('saves to the cloud only when asked, resolves conflicts, keeps owners apart and loads in a fresh browser',async({page,context})=>{
  test.setTimeout(150000);
  let session:AppSession|null={account:{id:'owner-a',displayName:'Player A'},csrfToken:'csrf-a'};
  let cloud:CloudRun|null=null,putCount=0;
  await context.route('**/api/**',async route=>{
    const req=route.request(),url=new URL(req.url()),path=url.pathname;
    if(path==='/api/session'){await route.fulfill({status:session?200:401,json:session??{error:'Sign in'}});return;}
    if(path==='/api/auth/logout'){session=null;await route.fulfill({status:204});return;}
    if(path==='/api/runs'&&req.method()==='GET'){await route.fulfill({json:cloud?[{runId:cloud.runId,revision:cloud.revision,updatedAt:cloud.updatedAt}]:[]});return;}
    if(path.startsWith('/api/runs/')&&req.method()==='GET'){await route.fulfill({status:cloud?200:404,json:cloud??{error:'missing'}});return;}
    if(path.startsWith('/api/runs/')&&req.method()==='PUT'){
      putCount++;const body=req.postDataJSON();expect(req.headers()['x-csrf-token']).toBe(session?.csrfToken);
      if(cloud&&body.expectedRevision!==cloud.revision){await route.fulfill({status:409,json:{error:'Cloud changed',current:cloud}});return;}
      cloud={runId:body.envelope.runId,revision:(cloud?.revision??0)+1,envelope:body.envelope,updatedAt:'2026-10-10T00:00:00Z'};
      await route.fulfill({json:cloud});return;
    }
    await route.fulfill({status:404,json:{error:'not found'}});
  });
  await seedSave(page,newGame(4,'account-browser-company'));await page.goto('/');
  await page.getByRole('button',{name:/Player A/}).click();
  let dialog=page.getByRole('dialog',{name:'Account'});
  await expect(dialog.getByText('Player A',{exact:true})).toBeVisible();await expect(dialog.getByText('No cloud saves yet.')).toBeVisible();
  expect(putCount).toBe(0);
  await dialog.getByRole('button',{name:'Save to cloud',exact:true}).click();await expect(dialog.getByText('Saved to the cloud.',{exact:true})).toBeVisible();
  expect(putCount).toBe(1);await expect(dialog.getByText('In the cloud as version 1')).toBeVisible();
  await expect(dialog.getByRole('listitem')).toContainText('Guided Mode save (this game)');
  await page.screenshot({path:'test-results/account-signed-in.png'});
  await dialog.getByRole('button',{name:'Close'}).click();
  await page.getByRole('button',{name:'Continue company',exact:true}).click();await expectRoom(page);
  await advanceCampaignStep(page);await page.getByRole('button',{name:'Menu',exact:true}).click();
  await page.getByRole('tab',{name:'Saves'}).click();
  const account=page.getByRole('region',{name:'Account and cloud saves'});
  // Another browser has saved revision 2 since this tab saved revision 1.
  cloud={...cloud!,revision:2};await account.getByRole('button',{name:'Save to cloud',exact:true}).click();
  await expect(account.getByText('The cloud has a different version of this save. Both are kept: choose which to continue.',{exact:true})).toBeVisible();
  await account.getByRole('button',{name:'Keep this browser’s version',exact:true}).click();await expect(account.getByText('Saved to the cloud.',{exact:true})).toBeVisible();
  expect(cloud!.revision).toBe(3);expect(cloud!.envelope.step).toBe(1);
  await page.screenshot({path:'test-results/phase3-account-menu.png'});
  await account.getByRole('button',{name:'Sign out',exact:true}).click();await expect(account.getByRole('link',{name:'Continue with Google'})).toBeVisible();
  session={account:{id:'owner-b',displayName:'Player B'},csrfToken:'csrf-b'};await page.reload();
  await page.getByRole('button',{name:/Player B/}).click();dialog=page.getByRole('dialog',{name:'Account'});
  await expect(dialog.getByText(/This local save belongs to another account/)).toBeVisible();
  await expect(dialog.getByRole('button',{name:'Save to cloud',exact:true})).toBeDisabled();expect((await savedGame(page)).campaign!.runId).toBe('account-browser-company');
  expect(putCount).toBe(3);
  // A fresh isolated context has no local save, but the same provider-backed app account.
  session={account:{id:'owner-a',displayName:'Player A'},csrfToken:'csrf-a'};
  // A fresh browser has no other tab drawing the room. Left open, this one keeps rendering it behind the home screen
  // in the same software renderer, which can stall the fresh tab for longer than an assertion waits. Its errors are
  // still checked when the test ends.
  await page.close();
  // The tabs share storage, so the fresh one drops the save before the game reads it.
  const fresh=await context.newPage();
  await fresh.addInitScript(()=>{for(const key of ['nn.campaign.save.v1','nn.campaign.cloud.v1'])localStorage.removeItem(key);});
  await fresh.goto('/');await fresh.getByRole('button',{name:/Player A/}).click();
  const freshDialog=fresh.getByRole('dialog',{name:'Account'});
  await expect(freshDialog.getByText(/No Guided Mode game in this browser yet/)).toBeVisible();
  await freshDialog.getByRole('button',{name:/^Load cloud save from/}).click();await expect(freshDialog).toBeHidden();
  await expect(fresh.getByRole('region',{name:'Guided Mode'})).toContainText('Last played');
  await fresh.getByRole('button',{name:'Continue company',exact:true}).click();await expectRoom(fresh);
  expect((await savedGame(fresh)).campaign!.step).toBe(1);await fresh.close();
});
test('cancelled Google sign-in keeps the guest save and says so',async({page})=>{
  await seedSave(page,newGame(5,'cancel-company'));
  await page.route('**/api/session',route=>route.fulfill({status:401,json:{error:'guest'}}));
  await page.route('**/api/auth/google',route=>route.fulfill({status:302,headers:{location:'/?auth=cancelled'}}));
  await page.goto('/');await page.getByRole('button',{name:/Sign in/}).click();
  await page.getByRole('dialog',{name:'Account'}).getByRole('link',{name:'Continue with Google'}).click();await expect(page).toHaveURL(/auth=cancelled/);
  await page.getByRole('button',{name:/Sign in/}).click();
  await expect(page.getByRole('dialog',{name:'Account'}).getByText('Google sign-in was cancelled. Your local save is unchanged.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Close'}).click();
  expect((await savedGame(page)).campaign!.runId).toBe('cancel-company');
  await page.getByRole('button',{name:'Continue company',exact:true}).click();await expectRoom(page);
});
test('signs in with email after a wrong password, and refuses a duplicate account',async({page,withoutRoom})=>{
  await withoutRoom();
  let session:AppSession|null=null;const posts:{path:string;origin?:string;body:Record<string,string>}[]=[];
  await page.route('**/api/**',async route=>{
    const req=route.request(),path=new URL(req.url()).pathname;
    if(path==='/api/session'){await route.fulfill({status:session?200:401,json:session??{error:'guest'}});return;}
    if(path.startsWith('/api/auth/email/')){
      const body=req.postDataJSON();posts.push({path,origin:req.headers().origin,body});
      if(path.endsWith('/register')){await route.fulfill({status:409,json:{error:'An account with this email already exists. Sign in instead.'}});return;}
      if(body.password!=='correct-horse'){await route.fulfill({status:401,json:{error:'Email or password is incorrect.'}});return;}
      session={account:{id:'email-ada',displayName:'Ada'},csrfToken:'csrf-email'};await route.fulfill({json:session});return;
    }
    if(path==='/api/runs'){await route.fulfill({json:[]});return;}
    await route.fulfill({status:404,json:{error:'not found'}});
  });
  await page.goto('/');await page.getByRole('button',{name:/Sign in/}).click();
  const dialog=page.getByRole('dialog',{name:'Account'});
  await dialog.getByRole('button',{name:'Create an account',exact:true}).click();
  await dialog.getByLabel(/^Name/).fill('Ada');await dialog.getByLabel('Email',{exact:true}).fill('ada@example.com');
  await dialog.getByLabel('Password',{exact:true}).fill('correct-horse');
  await dialog.getByRole('button',{name:'Create account',exact:true}).click();
  await expect(dialog.getByRole('alert')).toHaveText('An account with this email already exists. Sign in instead.');
  await dialog.getByRole('button',{name:'Sign in instead',exact:true}).click();
  await expect(dialog.getByLabel('Email',{exact:true})).toHaveValue('ada@example.com');
  await dialog.getByLabel('Password',{exact:true}).fill('wrong-horse');await dialog.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(dialog.getByRole('alert')).toHaveText('Email or password is incorrect.');
  await page.screenshot({path:'test-results/account-email-error.png'});
  await dialog.getByLabel('Password',{exact:true}).fill('correct-horse');await dialog.getByRole('button',{name:'Sign in',exact:true}).click();
  await expect(dialog.getByText('Ada',{exact:true})).toBeVisible();await expect(dialog.getByText('No cloud saves yet.')).toBeVisible();
  expect(posts.map(p=>p.path)).toEqual(['/api/auth/email/register','/api/auth/email/login','/api/auth/email/login']);
  expect(posts[0].body).toEqual({email:'ada@example.com',password:'correct-horse',name:'Ada'});
  expect(posts.every(p=>p.origin===new URL(page.url()).origin)).toBe(true);
  await dialog.getByRole('button',{name:'Close'}).click();await expect(page.getByRole('button',{name:/Ada/})).toBeVisible();
  // Signing in neither starts a game nor uploads anything.
  expect(await page.evaluate(()=>localStorage.getItem('nn.campaign.save.v1'))).toBeNull();
});
test('the landing page account link opens Sign in for a guest and nothing for a signed-in player',async({page,withoutRoom})=>{
  await withoutRoom();
  let session:AppSession|null=null;
  await page.route('**/api/session',route=>route.fulfill({status:session?200:401,json:session??{error:'guest'}}));
  await page.goto('/?signin=1');
  const dialog=page.getByRole('dialog',{name:'Account'});
  await expect(dialog.getByRole('link',{name:'Continue with Google'})).toBeVisible();
  await expect(page).toHaveURL(url=>!url.searchParams.has('signin'));
  await dialog.getByRole('button',{name:'Close'}).click();await expect(dialog).toBeHidden();
  // The flag is gone, so a reload stays on the home screen.
  await page.reload();await expect(page.getByRole('button',{name:/Sign in/})).toBeVisible();await expect(dialog).toBeHidden();
  session={account:{id:'landing-ada',displayName:'Ada'},csrfToken:'csrf-landing'};
  await page.goto('/?signin=1');await expect(page.getByRole('button',{name:/Ada/})).toBeVisible();
  await expect(page).toHaveURL(url=>!url.searchParams.has('signin'));await expect(dialog).toBeHidden();
});
