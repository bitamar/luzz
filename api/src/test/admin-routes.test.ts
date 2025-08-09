import { describe, it, expect, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import adminRouter from '../routes/admin';
import { signAccessToken } from '../auth/jwt';

function appWithAdmin() {
  const app = express();
  app.use(express.json());
  app.use('/admin', adminRouter);
  return app;
}

async function adminAuth() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-123';
  const token = await signAccessToken({ userId: 'u1', isAdmin: true }, '5m');
  return { Authorization: `Bearer ${token}` };
}

async function userAuth() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-123';
  const token = await signAccessToken({ userId: 'u2', isAdmin: false }, '5m');
  return { Authorization: `Bearer ${token}` };
}

describe('Admin routes', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-123';
  });

  it('rejects unauthenticated and non-admin requests', async () => {
    const app = appWithAdmin();
    await request(app).get('/admin/metrics').expect(401);
    await request(app)
      .get('/admin/metrics')
      .set(await userAuth())
      .expect(403);
  });

  it('GET /admin/metrics returns system metrics for admin', async () => {
    const app = appWithAdmin();
    const res = await request(app)
      .get('/admin/metrics')
      .set(await adminAuth())
      .expect(200);
    expect(res.body).toHaveProperty('counts');
    expect(res.body).toHaveProperty('booking_stats');
    expect(res.body).toHaveProperty('popular_studios');
  });

  it('GET /admin/health returns health info', async () => {
    const app = appWithAdmin();
    const res = await request(app)
      .get('/admin/health')
      .set(await adminAuth())
      .expect(200);
    expect(res.body).toHaveProperty('status', 'healthy');
    expect(res.body).toHaveProperty('services');
  });

  it('GET /admin/database/status returns db status', async () => {
    const app = appWithAdmin();
    const res = await request(app)
      .get('/admin/database/status')
      .set(await adminAuth())
      .expect(200);
    expect(res.body).toHaveProperty('database');
    expect(res.body).toHaveProperty('tables');
  });
});


