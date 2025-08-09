import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requireUser } from '../middleware/auth';
import { signAccessToken } from '../auth/jwt';

describe('requireUser middleware', () => {
  it('rejects when no token', async () => {
    const app = express();
    app.get('/x', requireUser(), (_req, res) => res.json({ ok: true }));
    await request(app).get('/x').expect(401);
  });

  it('accepts valid token and exposes req.user', async () => {
    process.env.JWT_SECRET = 'test-secret-123';
    const token = await signAccessToken({ userId: 'u1', isAdmin: false }, '2m');
    const app = express();
    app.get('/x', requireUser(), (req, res) =>
      res.json({ user: (req as any).user })
    );
    const res = await request(app)
      .get('/x')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(res.body.user.userId).toBe('u1');
  });
});
