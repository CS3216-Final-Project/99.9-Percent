import type {IncomingMessage,ServerResponse} from 'node:http';
import {accountPathAllowed,proxyTarget} from '../src/lib/accountProxy.js';
/** Vercel function: API_PROXY_TARGET is a server-only origin configured per deployment. */
export default async function handler(req:IncomingMessage & {body?:unknown},res:ServerResponse) {
  res.setHeader('Cache-Control','private, no-store');res.setHeader('CDN-Cache-Control','no-store');res.setHeader('Vercel-CDN-Cache-Control','no-store');
  if(!req.url||!accountPathAllowed(req.url)||!['GET','POST','PUT'].includes(req.method??'')){res.statusCode=404;res.end();return;}
  let target:URL;try{target=proxyTarget(process.env.API_PROXY_TARGET);}catch{res.statusCode=503;res.end(JSON.stringify({error:'Account proxy is not configured. Local play is available.'}));return;}
  const headers=new Headers();
  for(const name of ['cookie','origin','x-csrf-token','content-type']){const value=req.headers[name];if(typeof value==='string')headers.set(name,value);}
  try {
    const upstream=await fetch(new URL(req.url,target),{method:req.method,headers,redirect:'manual',signal:AbortSignal.timeout(15000),
      body:['POST','PUT'].includes(req.method!)?JSON.stringify(req.body??{}):undefined});
    res.statusCode=upstream.status;
    for(const name of ['content-type','location']){const value=upstream.headers.get(name);if(value)res.setHeader(name,value);}
    const cookies=upstream.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies);
    res.end(Buffer.from(await upstream.arrayBuffer()));
  }catch{res.statusCode=502;res.end(JSON.stringify({error:'Account service unavailable. Local progress is retained.'}));}
}
