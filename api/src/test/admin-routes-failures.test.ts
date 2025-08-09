import { describe, it, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { signAccessToken } from '../auth/jwt';

async function adminAuth() {
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-123';
  const token = await signAccessToken({ userId: 'u', isAdmin: true }, '5m');
  return { Authorization: `Bearer ${token}` };
}

describe('Admin routes - failure branches', () => {
  beforeEach(() => {
    // Reset modules before each to apply fresh mocks
    vi.resetModules();
  });

  it('metrics returns 500 on DB failure', async () => {
    vi.doMock('../db', async () => ({
      getDbClient: () => ({
        query: async () => {
          throw new Error('db fail');
        },
      }),
    }));
    const originalErr = console.error;
    const errSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((...args: any[]) => {
        const msg = String(args[0] ?? '');
        if (msg.includes('Error fetching metrics:')) return;
        originalErr(...(args as any));
      });
    const { default: adminRouter } = await import('../routes/admin');
    const app = express();
    app.use(express.json());
    app.use('/admin', adminRouter);
    await request(app)
      .get('/admin/metrics')
      .set(await adminAuth())
      .expect(500);
    errSpy.mockRestore();
  });

  it('health returns 503 on DB failure', async () => {
    vi.doMock('../db', async () => ({
      getDbClient: () => ({
        query: async () => {
          throw new Error('db fail');
        },
      }),
    }));
    const originalErr = console.error;
    const errSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((...args: any[]) => {
        const msg = String(args[0] ?? '');
        if (msg.includes('Health check failed:')) return;
        originalErr(...(args as any));
      });
    const { default: adminRouter } = await import('../routes/admin');
    const app = express();
    app.use(express.json());
    app.use('/admin', adminRouter);
    await request(app)
      .get('/admin/health')
      .set(await adminAuth())
      .expect(503);
    errSpy.mockRestore();
  });

  it('database/status returns 500 on DB failure', async () => {
    vi.doMock('../db', async () => ({
      getDbClient: () => ({
        query: async () => {
          throw new Error('db fail');
        },
      }),
    }));
    const originalErr = console.error;
    const errSpy = vi
      .spyOn(console, 'error')
      .mockImplementation((...args: any[]) => {
        const msg = String(args[0] ?? '');
        if (msg.includes('Error fetching database status:')) return;
        originalErr(...(args as any));
      });
    const { default: adminRouter } = await import('../routes/admin');
    const app = express();
    app.use(express.json());
    app.use('/admin', adminRouter);
    await request(app)
      .get('/admin/database/status')
      .set(await adminAuth())
      .expect(500);
    errSpy.mockRestore();
  });
});
