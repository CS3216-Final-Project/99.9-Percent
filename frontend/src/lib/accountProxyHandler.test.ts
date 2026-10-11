// @vitest-environment node
import {it,expect,vi,afterEach} from 'vitest';
import handler from '../../api/[...path]';
type Req=Parameters<typeof handler>[0];type Res=Parameters<typeof handler>[1];
function response(){return {statusCode:200,setHeader:vi.fn(),end:vi.fn()};}
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
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
