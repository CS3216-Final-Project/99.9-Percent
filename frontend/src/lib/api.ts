import type { HealthResponse } from '../../../shared/common.ts';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_URL}/api/health`);
  if (!res.ok) throw new Error(`API returned ${res.status}`);
  return res.json() as Promise<HealthResponse>;
}
