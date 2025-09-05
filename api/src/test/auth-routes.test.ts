import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { signAccessToken } from '../auth/jwt';

describe('POST /auth/google/token', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-123';
    process.env.GOOGLE_CLIENT_IDS = 'client-1.apps.googleusercontent.com';
  });

  it('returns 200 with access token and sets refresh cookie on valid id token', async () => {
    // Mock the google verifier to avoid network calls
    const payload = {
      sub: 'sub-123',
      email: 'u@example.com',
      name: 'User',
      picture: 'https://img',
      email_verified: true,
    };
    const { default: buildRouter } = await import('../routes/auth');
    const router = await buildRouter({
      verifyGoogleIdToken: async () => payload,
    });

    const app = express();
    app.use(express.json());
    app.use('/auth', router);

    const res = await request(app)
      .post('/auth/google/token')
      .send({ idToken: 'fake-id-token' })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
    const cookie = String(res.headers['set-cookie'][0] || '');
    expect(cookie).toMatch(/refresh_token=/);
  });

  it('returns 401 when id token is invalid', async () => {
    const { default: buildRouter } = await import('../routes/auth');
    const router = await buildRouter({
      verifyGoogleIdToken: async () => {
        throw new Error('bad token');
      },
    });

    const app = express();
    app.use(express.json());
    app.use('/auth', router);

    const res = await request(app)
      .post('/auth/google/token')
      .send({ idToken: 'this-looks-like-a-token' })
      .expect(401);
    expect(res.body.error).toMatch(/invalid token/i);
  });

  it('GET /auth/config returns audiences for admins only', async () => {
    const { default: buildRouter } = await import('../routes/auth');
    const router = await buildRouter();

    const app = express();
    app.use(express.json());
    app.use('/auth', router);

    // Unauthed
    await request(app).get('/auth/config').expect(401);

    // Non-admin
    const userToken = await signAccessToken({ userId: 'u', isAdmin: false }, '5m');
    await request(app).get('/auth/config').set('Authorization', `Bearer ${userToken}`).expect(403);

    // Admin
    process.env.GOOGLE_CLIENT_IDS = 'a,b';
    const adminToken = await signAccessToken({ userId: 'a1', isAdmin: true }, '5m');
    const res = await request(app)
      .get('/auth/config')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(res.body.audiences).toEqual(['a', 'b']);
  });
});
