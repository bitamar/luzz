import { describe, it, expect, beforeAll } from 'vitest';

describe('auth jwt service', () => {
  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-123';
  });

  it('signs and verifies an access token', async () => {
    const { signAccessToken, verifyAccessToken } = await import('../auth/jwt');
    const token = await signAccessToken({ userId: 'u1', isAdmin: false }, '2m');
    expect(typeof token).toBe('string');
    const payload = await verifyAccessToken(token);
    expect(payload.userId).toBe('u1');
    expect(payload.isAdmin).toBe(false);
  });

  it('rejects invalid token', async () => {
    const { verifyAccessToken } = await import('../auth/jwt');
    await expect(verifyAccessToken('not-a-jwt')).rejects.toBeTruthy();
  });
});
