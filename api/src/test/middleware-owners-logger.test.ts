import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requireStudioOwner, requestLogger } from '../middleware/auth';
import { getDbClient } from '../db';

function appWithOwnerRoute() {
  const app = express();
  app.get(
    '/studios/:studioId/owners-only',
    // stub user middleware
    (req, _res, next) => {
      (req as express.Request & { user?: { userId: string; isAdmin: boolean } }).user = req.headers[
        'x-user'
      ]
        ? { userId: String(req.headers['x-user']), isAdmin: false }
        : undefined;
      next();
    },
    requireStudioOwner(),
    (_req, res) => res.json({ ok: true }),
  );
  return app;
}

function appWithLogger() {
  const app = express();
  app.use(requestLogger);
  app.get('/ok', (_req, res) => res.json({ ok: true }));
  app.get('/bad', (_req, res) => res.status(400).json({ error: 'bad' }));
  return app;
}

describe('middleware: requireStudioOwner and requestLogger', () => {
  it('requireStudioOwner: 403 without user; 403 when not owner; 200 when owner', async () => {
    const app = appWithOwnerRoute();
    const studioId = '550e8400-e29b-41d4-a716-446655440000';
    // No user
    await request(app).get(`/studios/${studioId}/owners-only`).expect(403);

    // Not owner (use valid UUID that is not related)
    await request(app)
      .get(`/studios/${studioId}/owners-only`)
      .set('X-USER', '11111111-1111-1111-1111-111111111111')
      .expect(403);

    // Insert user and owner relation
    const client = getDbClient();
    await client.query(
      `insert into users (id, google_sub, email) values ($1, $2, $3) on conflict do nothing`,
      ['b9d5f7f0-0000-4000-8000-000000000001', 'sub-owner', 'o@o'],
    );
    await client.query(
      `insert into studios (id, slug, name, timezone, currency)
       values ($1, 'own-slug', 'Own', 'Asia/Jerusalem', 'ILS') on conflict do nothing`,
      [studioId],
    );
    await client.query(
      `insert into studio_owners (studio_id, user_id, role)
       values ($1, $2, 'owner') on conflict do nothing`,
      [studioId, 'b9d5f7f0-0000-4000-8000-000000000001'],
    );

    await request(app)
      .get(`/studios/${studioId}/owners-only`)
      .set('X-USER', 'b9d5f7f0-0000-4000-8000-000000000001')
      .expect(200);
  });

  it('requestLogger covers success and error branches', async () => {
    const app = appWithLogger();
    const ok = await request(app).get('/ok').expect(200);
    expect(ok.body.ok).toBe(true);
    await request(app).get('/bad').expect(400);
  });
});
