import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requireApiKey, optionalAuth, rateLimit } from '../middleware/auth';

describe('middleware: auth basics', () => {
  it('requireApiKey: 401 without key; 403 invalid; 200 with valid', async () => {
    const app = express();
    app.get('/x', requireApiKey, (_req, res) => res.json({ ok: true }));

    await request(app).get('/x').expect(401);
    await request(app).get('/x').set('X-API-Key', 'bad').expect(403);
    await request(app).get('/x').set('X-API-Key', 'dev-key-123').expect(200);
    await request(app).get('/x').set('Authorization', 'Bearer dev-key-123').expect(200);
  });

  it('optionalAuth toggles authenticated flag', async () => {
    const app = express();
    app.get('/y', optionalAuth, (req, res) =>
      res.json({
        authed: (req as express.Request & { authenticated?: boolean }).authenticated || false,
      }),
    );
    const r1 = await request(app).get('/y').expect(200);
    expect(r1.body.authed).toBe(false);
    const r2 = await request(app).get('/y').set('X-API-Key', 'dev-key-123').expect(200);
    expect(r2.body.authed).toBe(true);
  });

  it('rateLimit returns 429 after threshold', async () => {
    const app = express();
    app.get('/z', rateLimit(2, 1000), (_req, res) => res.json({ ok: true }));
    await request(app).get('/z').expect(200);
    await request(app).get('/z').expect(200);
    const r3 = await request(app).get('/z').expect(429);
    expect(r3.body).toHaveProperty('retryAfter');
  });
});
