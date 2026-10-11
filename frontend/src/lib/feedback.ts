import type { FeedbackRequest, FeedbackResponse } from '../../../shared/feedback.ts';

// Reuse the public API origin already configured for this frontend deployment.
const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');

export async function sendFeedback(value: FeedbackRequest, signal: AbortSignal): Promise<FeedbackResponse> {
  const response = await fetch(API_URL + '/api/feedback', {
    method: 'POST',
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(value),
    signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
  });
  if (!response.ok) throw new Error('Feedback could not be saved.');
  const body: unknown = await response.json();
  if (!body || typeof body !== 'object' || !('id' in body) || body.id !== value.id) {
    throw new Error('Feedback confirmation was not received.');
  }
  return body as FeedbackResponse;
}
