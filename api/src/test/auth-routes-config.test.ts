import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import buildAuthRouter from '../routes/auth';
import { signAccessToken } from '../auth/jwt';

describe('Auth routes - /auth/config', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-123';
  });

  it('returns 401 without token, 403 for non-admin, 200 for admin', async () => {
    const router = await buildAuthRouter();
    const app = express();
    app.use(express.json());
    app.use('/auth', router);

    await request(app).get('/auth/config').expect(401);

    const userToken = await signAccessToken({ userId: 'u', isAdmin: false }, '5m');
    await request(app).get('/auth/config').set('Authorization', `Bearer ${userToken}`).expect(403);

    process.env.GOOGLE_CLIENT_IDS = 'c1,c2';
    const adminToken = await signAccessToken({ userId: 'a', isAdmin: true }, '5m');
    const ok = await request(app)
      .get('/auth/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(ok.body.audiences).toEqual(['c1', 'c2']);
  });
});
