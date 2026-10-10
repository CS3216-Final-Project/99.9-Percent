import {test,expect,seedSave,expectRoom,savedGame} from './fixtures';
import {newGame} from '../src/sim';
import type {AppSession,CloudRun} from '../../shared/campaign';
test('explicit guest attachment, conflicts, owner switching and fresh-session cloud resume',async({page,context})=>{
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
  await page.getByText('Account and cloud saves',{exact:true}).click();await expect(page.getByText('Signed in as Player A')).toBeVisible();expect(putCount).toBe(0);
  await page.getByRole('button',{name:'Attach current guest company',exact:true}).click();await expect(page.getByText('Cloud save complete.',{exact:true})).toBeVisible();expect(putCount).toBe(1);
  await page.getByRole('button',{name:'Continue company',exact:true}).click();await expectRoom(page);
  await page.getByRole('button',{name:'Advance step',exact:true}).click();await page.getByRole('button',{name:'Menu',exact:true}).click();
  await page.getByText('Account and cloud saves',{exact:true}).click();
  // Another browser has saved revision 2 since this tab attached revision 1.
  cloud={...cloud!,revision:2};await page.getByRole('button',{name:'Save company to cloud',exact:true}).click();
  await expect(page.getByText('Cloud conflict: both copies are retained. Choose which to continue.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Keep local version in cloud',exact:true}).click();await expect(page.getByText('Cloud save complete.',{exact:true})).toBeVisible();
  expect(cloud!.revision).toBe(3);expect(cloud!.envelope.step).toBe(1);
  await page.screenshot({path:'test-results/phase3-account-menu.png'});
  await page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(page.getByRole('link',{name:'Sign in with Google'})).toBeVisible();
  session={account:{id:'owner-b',displayName:'Player B'},csrfToken:'csrf-b'};await page.reload();
  await page.getByText('Account and cloud saves',{exact:true}).click();await expect(page.getByText('Signed in as Player B')).toBeVisible();
  await expect(page.getByRole('button',{name:'Save company to cloud',exact:true})).toBeDisabled();expect((await savedGame(page)).campaign!.runId).toBe('account-browser-company');
  expect(putCount).toBe(3);
  // A fresh isolated context has no local save, but the same provider-backed app account.
  session={account:{id:'owner-a',displayName:'Player A'},csrfToken:'csrf-a'};
  await page.evaluate(()=>{for(const key of ['nn.campaign.save.v1','nn.campaign.cloud.v1'])localStorage.removeItem(key);});
  const fresh=await context.newPage();await fresh.goto('/');await fresh.getByText('Account and cloud saves',{exact:true}).click();
  await expect(fresh.getByText('Signed in as Player A')).toBeVisible();await fresh.getByRole('button',{name:'Refresh cloud companies',exact:true}).click();
  await fresh.getByRole('button',{name:'Resume cloud company account-browser-company',exact:true}).click();
  await fresh.getByRole('button',{name:'Continue company',exact:true}).click();await expectRoom(fresh);
  expect((await savedGame(fresh)).campaign!.step).toBe(1);await fresh.close();
});
test('cancelled Google sign-in preserves the guest company',async({page})=>{
  await seedSave(page,newGame(5,'cancel-company'));
  await page.route('**/api/session',route=>route.fulfill({status:401,json:{error:'guest'}}));
  await page.route('**/api/auth/google',route=>route.fulfill({status:302,headers:{location:'/?auth=cancelled'}}));
  await page.goto('/');await page.getByText('Account and cloud saves',{exact:true}).click();
  await page.getByRole('link',{name:'Sign in with Google'}).click();await expect(page).toHaveURL(/auth=cancelled/);
  expect((await savedGame(page)).campaign!.runId).toBe('cancel-company');
  await page.getByRole('button',{name:'Continue company',exact:true}).click();await expectRoom(page);
});
