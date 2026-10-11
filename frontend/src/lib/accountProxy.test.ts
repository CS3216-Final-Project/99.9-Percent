// @vitest-environment node
import {it,expect} from 'vitest';
import {accountPathAllowed,proxyTarget} from './accountProxy';
it('limits the proxy to account endpoints and rejects ambiguous paths',()=>{
  for(const path of ['/api/session','/api/auth/google','/api/auth/google/callback?code=a&state=b','/api/auth/logout','/api/runs','/api/runs/company-1'])expect(accountPathAllowed(path)).toBe(true);
  for(const path of ['/api/dialogue','/api/health','/api/runs/a/b','/api/runs/%2e%2e/auth','//evil.test/api/session'])expect(accountPathAllowed(path)).toBe(false);
});
it('requires a configured HTTPS backend origin without credentials or paths',()=>{
  expect(proxyTarget('https://backend.test').origin).toBe('https://backend.test');
  for(const value of [undefined,'http://backend.test','https://user:password@backend.test','https://backend.test/api','https://backend.test?x=y'])expect(()=>proxyTarget(value)).toThrow();
});
