import {beforeEach,it,expect,vi} from 'vitest';
vi.mock('openid-client',()=>({discovery:vi.fn(async()=>({})),enableNonRepudiationChecks:vi.fn(),calculatePKCECodeChallenge:vi.fn(async()=> 'challenge'),
  buildAuthorizationUrl:vi.fn(()=>new URL('https://accounts.google.com/auth')),authorizationCodeGrant:vi.fn(async()=>({claims:()=>({iss:'https://accounts.google.com',sub:'subject',name:'Player'})}))}));
import * as oidc from 'openid-client';
import {authorizationUrl,exchangeGoogle} from '../src/auth/google.js';
beforeEach(()=>{vi.stubEnv('GOOGLE_CLIENT_ID','client');vi.stubEnv('GOOGLE_CLIENT_SECRET','secret');vi.stubEnv('GOOGLE_REDIRECT_URI','https://app.test/api/auth/google/callback');});
it('uses signature validation and binds authorization to state, nonce and PKCE',async()=>{
  await authorizationUrl('state',{nonce:'nonce',verifier:'verifier'});
  expect(oidc.discovery).toHaveBeenCalledWith(new URL('https://accounts.google.com'),'client','secret',undefined,{execute:[oidc.enableNonRepudiationChecks]});
  expect(oidc.buildAuthorizationUrl).toHaveBeenCalledWith({},expect.objectContaining({state:'state',nonce:'nonce',code_challenge:'challenge',code_challenge_method:'S256'}));
  const url=new URL('https://app.test/api/auth/google/callback?code=code&state=state');
  expect(await exchangeGoogle(url,'state',{nonce:'nonce',verifier:'verifier'})).toEqual({issuer:'https://accounts.google.com',subject:'subject',displayName:'Player'});
  expect(oidc.authorizationCodeGrant).toHaveBeenCalledWith({},url,{expectedState:'state',expectedNonce:'nonce',pkceCodeVerifier:'verifier',idTokenExpected:true});
});
it('propagates rejected signature/nonce/token exchanges without creating an identity',async()=>{
  vi.mocked(oidc.authorizationCodeGrant).mockRejectedValueOnce(Error('Invalid token'));
  await expect(exchangeGoogle(new URL('https://app.test'),'state',{nonce:'nonce',verifier:'verifier'})).rejects.toThrow('Invalid token');
});
