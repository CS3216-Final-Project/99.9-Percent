import type {
  LeaderboardResponse, LeaderboardSubmission, LeaderboardSubmitResponse,
} from '../../../shared/leaderboard.ts';

// The leaderboard is a public route, like feedback: called directly at the configured API origin, without cookies.
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');

export async function postScore(value: LeaderboardSubmission, signal?: AbortSignal): Promise<LeaderboardSubmitResponse> {
  const timeout = AbortSignal.timeout(15000);
  const response = await fetch(API_URL + '/api/leaderboard', {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error('Score could not be posted.');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('id' in body) || body.id !== value.id ||
      !('rank' in body) || typeof body.rank !== 'number' || !('total' in body) || typeof body.total !== 'number') {
    throw new Error('Score confirmation was not received.');
  }
  return body as LeaderboardSubmitResponse;
}

export async function fetchBoard(signal?: AbortSignal): Promise<LeaderboardResponse> {
  const timeout = AbortSignal.timeout(10000);
  const response = await fetch(API_URL + '/api/leaderboard', {
    credentials: 'omit',
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  });
  if (!response.ok) throw new Error('Leaderboard unavailable.');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('top' in body) || !Array.isArray(body.top) ||
      !('recent' in body) || !Array.isArray(body.recent) || !('total' in body) || typeof body.total !== 'number') {
    throw new Error('Leaderboard response was malformed.');
  }
  return body as LeaderboardResponse;
}
