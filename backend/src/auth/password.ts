import {randomBytes, scrypt, timingSafeEqual} from 'node:crypto';
/** Email accounts use this issuer, so an email subject never collides with a Google `sub`. */
export const EMAIL_ISSUER='email';
export const PASSWORD_MIN=8, PASSWORD_MAX=200, NAME_MAX=60;
const COST=16384, BLOCK=8, PARALLEL=1, KEY_LENGTH=64;
function derive(password:string,salt:Buffer,cost=COST,block=BLOCK,parallel=PARALLEL):Promise<Buffer> {
  return new Promise((resolve,reject)=>scrypt(password.normalize('NFKC'),salt,KEY_LENGTH,{N:cost,r:block,p:parallel,maxmem:64*1024*1024},
    (error,key)=>error?reject(error):resolve(key)));
}
/** Stored as `scrypt$N$r$p$salt$key`, so the cost can be raised later without breaking older hashes. */
export async function hashPassword(password:string):Promise<string> {
  const salt=randomBytes(16);
  return ['scrypt',COST,BLOCK,PARALLEL,salt.toString('base64url'),(await derive(password,salt)).toString('base64url')].join('$');
}
export async function verifyPassword(password:string,stored:string):Promise<boolean> {
  const [scheme,cost,block,parallel,salt,key]=stored.split('$');
  if(scheme!=='scrypt'||!salt||!key)return false;
  const expected=Buffer.from(key,'base64url');
  const actual=await derive(password,Buffer.from(salt,'base64url'),Number(cost),Number(block),Number(parallel));
  return actual.length===expected.length&&timingSafeEqual(actual,expected);
}
/** Unknown emails still pay for one hash, so response time does not reveal which emails have accounts. */
let decoy:Promise<string>|undefined;
export async function rejectUnknown(password:string):Promise<false> {
  decoy??=hashPassword(randomBytes(16).toString('base64url'));
  await verifyPassword(password,await decoy);
  return false;
}
export function normaliseEmail(value:unknown):string|null {
  if(typeof value!=='string')return null;
  const email=value.trim().toLowerCase();
  return email.length<=254&&/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email)?email:null;
}
export function validPassword(value:unknown):value is string {
  return typeof value==='string'&&value.length>=PASSWORD_MIN&&value.length<=PASSWORD_MAX;
}
/** An optional display name; the email's local part stands in when it is blank. */
export function displayName(value:unknown,email:string):string|null {
  if(value!==undefined&&value!==null&&typeof value!=='string')return null;
  const name=(value??'').trim().replace(/\s+/g,' ');
  if(!name)return email.split('@')[0].slice(0,NAME_MAX);
  return name.length<=NAME_MAX?name:null;
}
