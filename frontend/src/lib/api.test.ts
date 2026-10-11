import { afterEach, describe, expect, it, vi } from 'vitest';
import { getHealth } from './api.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getHealth', () => {
  it('returns the health response', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ status: 'ok', time: 't' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getHealth()).resolves.toEqual({ status: 'ok', time: 't' });
    expect(fetchMock).toHaveBeenCalledWith(expect.stringMatching(/\/api\/health$/));
  });

  it('throws when the API returns an error status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 503 })));

    await expect(getHealth()).rejects.toThrow('API returned 503');
  });
});

it('uses same-origin app sessions and CSRF for cloud operations',async()=>{
  const api=await import('./api');const mock=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>[]});vi.stubGlobal('fetch',mock);
  await api.listRuns();expect(mock).toHaveBeenLastCalledWith('/api/runs',expect.objectContaining({credentials:'same-origin'}));
  await api.putRun({runId:'company'} as Parameters<typeof api.putRun>[0],3,'csrf');
  expect(mock).toHaveBeenLastCalledWith('/api/runs/company',expect.objectContaining({method:'PUT',headers:expect.objectContaining({'X-CSRF-Token':'csrf'}),body:expect.stringContaining('"expectedRevision":3')}));
  mock.mockResolvedValue({ok:false,status:409,json:async()=>({error:'conflict',current:{revision:4}})});
  await expect(api.getRun('company')).rejects.toMatchObject({status:409,detail:{current:{revision:4}}});
  mock.mockResolvedValue({ok:true,status:204});await expect(api.logout('csrf')).resolves.toBeUndefined();
});
