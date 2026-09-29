import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import app from '../src/app.js';

describe('API', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /api/health/db returns 503 when no database is configured', async () => {
    vi.stubEnv('DATABASE_URL', '');
    const res = await request(app).get('/api/health/db');
    vi.unstubAllEnvs();
    expect(res.status).toBe(503);
  });

  it('POST /api/dialogue rejects a missing playerText', async () => {
    const res = await request(app).post('/api/dialogue').send({ npcId: 'tan', missionId: 'lunch' });
    expect(res.status).toBe(400);
  });

  it('POST /api/dialogue returns an NPC reply', async () => {
    const res = await request(app)
      .post('/api/dialogue')
      .send({
        sessionId: 's1',
        missionId: 'lunch',
        npcId: 'tan',
        language: 'ja-JP',
        level: 'beginner',
        playerText: 'こんにちは',
      });
    expect(res.status).toBe(200);
    expect(typeof res.body.npcText).toBe('string');
  });

  it('unknown routes return 404', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
  });
});
