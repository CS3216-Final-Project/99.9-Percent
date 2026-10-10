/** Only account endpoints may pass through the browser-facing proxy. */
export function accountPathAllowed(path:string):boolean {
  if(!path.startsWith('/api/')||path.split('?')[0].includes('%'))return false;
  const url=new URL(path,'https://proxy.invalid');
  return /^\/api\/(?:session|auth\/(?:google(?:\/callback)?|logout)|runs(?:\/[A-Za-z0-9_-]{1,128})?)$/.test(url.pathname);
}
export function proxyTarget(value:string|undefined):URL {
  const url=new URL(value??'');
  if(url.protocol!=='https:' || url.username || url.password || url.pathname!=='/' || url.search || url.hash)throw Error('Invalid account proxy target');
  return url;
}
