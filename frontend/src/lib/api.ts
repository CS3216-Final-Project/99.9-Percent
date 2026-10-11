import type { HealthResponse } from '../../../shared/common.ts';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json() as Promise<HealthResponse>;
}

import type { AppSession, CloudRun, RunSummary, CampaignEnvelope, SaveConflict } from '../../../shared/campaign.ts';
export class AccountApiError extends Error {
  status: number; detail: SaveConflict;
  constructor(status: number, detail: SaveConflict) {super(detail.error);this.status=status;this.detail=detail;}
}
async function accountRequest<T>(path:string, options:RequestInit={}):Promise<T> {
  const response=await fetch(`/api${path}`,{...options,credentials:'same-origin',headers:{...options.headers,'Content-Type':'application/json'}});
  if(response.status===204)return undefined as T;
  const body=await response.json();
  if(!response.ok)throw new AccountApiError(response.status,body);
  return body as T;
}
export const getSession=()=>accountRequest<AppSession>('/session');
export const listRuns=()=>accountRequest<RunSummary[]>('/runs');
export const getRun=(id:string)=>accountRequest<CloudRun>(`/runs/${encodeURIComponent(id)}`);
export const putRun=(envelope:CampaignEnvelope,expectedRevision:number,csrfToken:string)=>accountRequest<CloudRun>(`/runs/${encodeURIComponent(envelope.runId)}`,{
  method:'PUT',headers:{'X-CSRF-Token':csrfToken},body:JSON.stringify({envelope,expectedRevision})});
export const logout=(csrfToken:string)=>accountRequest<void>('/auth/logout',{method:'POST',headers:{'X-CSRF-Token':csrfToken}});
