import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { isAllowedOrigin, parseAllowedOrigins } from './cors.js';
import { dialogueRouter } from './routes/dialogue.js';
import { healthRouter } from './routes/health.js';

const app = express();

const allowedOrigins = parseAllowedOrigins(process.env.CORS_ORIGINS);

app.use(
  cors({
    origin: (origin, cb) => {
      // Allow same-origin/curl (no origin) and origins matching CORS_ORIGINS.
      // Other origins get no CORS headers, so the browser blocks them.
      cb(null, !origin || isAllowedOrigin(origin, allowedOrigins));
    },
  }),
);
app.use(express.json({ limit: '1mb' }));

app.use('/api/health', healthRouter);
app.use('/api/dialogue', dialogueRouter);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Handle every error here so Express never leaves the Vercel function in a bad state.
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

export default app;
