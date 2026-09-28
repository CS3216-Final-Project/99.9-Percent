import { Router } from 'express';
import type { HealthResponse } from '../../../shared/common.ts';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const body: HealthResponse = { status: 'ok', time: new Date().toISOString() };
  res.json(body);
});
