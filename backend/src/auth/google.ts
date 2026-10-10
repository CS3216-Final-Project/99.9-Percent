import * as oidc from 'openid-client';
export interface GoogleAttempt { nonce: string; verifier: string }
export interface GoogleIdentity { issuer: string; subject: string; displayName: string }
let configuration: Promise<oidc.Configuration> | undefined;
function config() {
  configuration ??= oidc.discovery(new URL('https://accounts.google.com'), process.env.GOOGLE_CLIENT_ID!, process.env.GOOGLE_CLIENT_SECRET!, undefined,
    {execute:[oidc.enableNonRepudiationChecks]}).catch(error => { configuration=undefined; throw error; });
  return configuration;
}
export async function authorizationUrl(state: string, attempt: GoogleAttempt): Promise<string> {
  return oidc.buildAuthorizationUrl(await config(), {redirect_uri:process.env.GOOGLE_REDIRECT_URI!, scope:'openid email profile',
    state, nonce:attempt.nonce, code_challenge:await oidc.calculatePKCECodeChallenge(attempt.verifier), code_challenge_method:'S256', prompt:'select_account'}).href;
}
export async function exchangeGoogle(url: URL, state: string, attempt: GoogleAttempt): Promise<GoogleIdentity> {
  const tokens=await oidc.authorizationCodeGrant(await config(), url, {expectedState:state, expectedNonce:attempt.nonce,
    pkceCodeVerifier:attempt.verifier, idTokenExpected:true});
  const claims=tokens.claims();
  if(!claims?.sub || claims.iss!=='https://accounts.google.com') throw Error('Invalid identity');
  return {issuer:claims.iss, subject:claims.sub, displayName:typeof claims.name==='string'?claims.name.slice(0,120):'Player'};
}
