import { eq } from 'drizzle-orm';
import { Router } from 'express';
import { FEEDBACK_MAX_LENGTH, type FeedbackRequest, type FeedbackResponse } from '../../../shared/feedback.ts';
import { getDb, isDbConfigured } from '../db/client.js';
import { gameFeedback } from '../db/schema.js';

export const feedbackRouter = Router();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Guest feedback is public; reading feedback is deliberately not exposed.
feedbackRouter.post('/', async (req, res) => {
  const body: unknown = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    res.status(400).json({ error: 'Invalid feedback.' });
    return;
  }
  const { id, message, mode } = body as Record<string, unknown>;
  if (typeof id !== 'string' || !uuid.test(id) || typeof message !== 'string' ||
      !message.trim() || message.trim().length > FEEDBACK_MAX_LENGTH ||
      (mode !== 'campaign' && mode !== 'classic')) {
    res.status(400).json({ error: 'Provide a valid submission ID, game mode and 1–2000 characters of feedback.' });
    return;
  }
  if (!isDbConfigured()) {
    res.status(503).json({ error: 'Feedback is temporarily unavailable. Please try again later.' });
    return;
  }

  const value: FeedbackRequest = { id: id.toLowerCase(), message: message.trim(), mode };
  try {
    const db = getDb();
    const [saved] = await db.insert(gameFeedback).values(value)
      .onConflictDoNothing({ target: gameFeedback.id }).returning({ id: gameFeedback.id });
    if (saved) {
      res.status(201).json(saved satisfies FeedbackResponse);
      return;
    }
    // A response can be lost after the insert succeeds. Retrying that draft
    // acknowledges the original row instead of storing duplicate feedback.
    const [existing] = await db.select().from(gameFeedback).where(eq(gameFeedback.id, value.id));
    if (existing?.message === value.message && existing.mode === value.mode) {
      res.status(200).json({ id: existing.id } satisfies FeedbackResponse);
      return;
    }
    res.status(409).json({ error: 'Submission ID already used for different feedback.' });
  } catch {
    // Do not log submitted text or database query parameters.
    console.error('Feedback persistence failed.');
    res.status(503).json({ error: 'Feedback is temporarily unavailable. Please try again later.' });
  }
});
