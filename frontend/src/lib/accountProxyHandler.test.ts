// @vitest-environment node
import {it,expect,vi,afterEach} from 'vitest';
import handler from './accountProxyHandler';
import session from '../../api/session';
import google from '../../api/auth/google';
import callback from '../../api/auth/google/callback';
import logout from '../../api/auth/logout';
import emailLogin from '../../api/auth/email/login';
import emailRegister from '../../api/auth/email/register';
import runs from '../../api/runs/index';
import run from '../../api/runs/[runId]';
type Req=Parameters<typeof handler>[0];type Res=Parameters<typeof handler>[1];
function response(){return {statusCode:200,setHeader:vi.fn(),end:vi.fn()};}
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it.each([
  ['/api/session','GET',session],
  ['/api/auth/google','GET',google],
  ['/api/auth/google/callback?code=a&state=b','GET',callback],
  ['/api/auth/logout','POST',logout],
  ['/api/auth/email/login','POST',emailLogin],
  ['/api/auth/email/register','POST',emailRegister],
  ['/api/runs','GET',runs],
  ['/api/runs/company-1','GET',run],
  ['/api/runs/company-1','PUT',run],
] as const)('serves %s (%s) through a Vercel file route',async(path,method,entry)=>{
  vi.stubEnv('API_PROXY_TARGET','https://backend.test');
  const fetch=vi.fn<typeof globalThis.fetch>(async()=>new Response('{}',{status:200}));
  vi.stubGlobal('fetch',fetch);const res=response();
  await entry({url:path,method,headers:{}} as unknown as Req,res as unknown as Res);
  expect(String(fetch.mock.calls[0][0])).toBe(`https://backend.test${path}`);
  expect(res.statusCode).toBe(200);
});
it('fails closed without a configured backend and blocks non-account paths',async()=>{
  vi.stubEnv('API_PROXY_TARGET','');const fetch=vi.fn();vi.stubGlobal('fetch',fetch);let res=response();
  await handler({url:'/api/session',method:'GET',headers:{}} as unknown as Req,res as unknown as Res);expect(res.statusCode).toBe(503);expect(fetch).not.toHaveBeenCalled();
  res=response();await handler({url:'//evil.test/api/session',method:'GET',headers:{}} as unknown as Req,res as unknown as Res);expect(res.statusCode).toBe(404);
});
it('forwards only browser account headers and preserves separate secure cookies and redirects',async()=>{
  vi.stubEnv('API_PROXY_TARGET','https://backend.test');const headers=new Headers({'location':'https://app.test/?auth=signed-in','content-type':'application/json'});
  headers.append('set-cookie','nn_auth=; Path=/; HttpOnly; Secure; SameSite=Lax');headers.append('set-cookie','nn_session=opaque; Path=/; HttpOnly; Secure; SameSite=Lax');
  const fetch=vi.fn<typeof globalThis.fetch>(async()=>new Response(null,{status:302,headers}));vi.stubGlobal('fetch',fetch);const res=response();
  await handler({url:'/api/auth/google/callback?code=a&state=b',method:'GET',headers:{cookie:'nn_auth=binding',origin:'https://app.test',authorization:'never-forward',host:'untrusted.test'}} as unknown as Req,res as unknown as Res);
  expect(String(fetch.mock.calls[0][0])).toBe('https://backend.test/api/auth/google/callback?code=a&state=b');
  const options=fetch.mock.calls[0][1]!;const forwarded=options.headers as Headers;expect(options.redirect).toBe('manual');expect(forwarded.get('cookie')).toBe('nn_auth=binding');expect(forwarded.has('authorization')).toBe(false);expect(forwarded.has('host')).toBe(false);
  expect(res.statusCode).toBe(302);expect(res.setHeader).toHaveBeenCalledWith('Set-Cookie',expect.arrayContaining([expect.stringContaining('nn_auth='),expect.stringContaining('nn_session=')]));
  expect(res.setHeader).toHaveBeenCalledWith('Vercel-CDN-Cache-Control','no-store');
});
it('forwards write payload and CSRF and handles upstream network failure',async()=>{
  vi.stubEnv('API_PROXY_TARGET','https://backend.test');const fetch=vi.fn().mockRejectedValue(Error('offline'));vi.stubGlobal('fetch',fetch);const res=response();
  await handler({url:'/api/runs/company',method:'PUT',headers:{'x-csrf-token':'csrf','content-type':'application/json'},body:{expectedRevision:1}} as unknown as Req,res as unknown as Res);
  expect(fetch.mock.calls[0][1].body).toBe('{"expectedRevision":1}');expect(fetch.mock.calls[0][1].headers.get('x-csrf-token')).toBe('csrf');expect(res.statusCode).toBe(502);expect(res.end).toHaveBeenCalledWith(expect.stringContaining('Local progress is retained'));
});
