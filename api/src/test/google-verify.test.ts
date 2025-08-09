import { describe, it, expect, vi, beforeEach } from 'vitest';
// Note: import implementation dynamically inside tests to allow module mocking

describe('verifyGoogleIdToken', () => {
  const validAud = ['client-1.apps.googleusercontent.com'];

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('throws on missing token', async () => {
    const { verifyGoogleIdToken } = await import('../auth/google');
    await expect(verifyGoogleIdToken('', validAud)).rejects.toThrow(
      'missing id token'
    );
  });

  it('throws on missing audience allowlist', async () => {
    const { verifyGoogleIdToken } = await import('../auth/google');
    await expect(verifyGoogleIdToken('x', [])).rejects.toThrow(
      'no allowed client ids'
    );
  });

  it('verifies token via jose and returns normalized profile', async () => {
    const payload = {
      sub: '123',
      email: 'a@b.co',
      email_verified: true,
      name: 'User',
      picture: 'https://img',
      aud: validAud[0],
      iss: 'https://accounts.google.com',
    } as any;

    vi.resetModules();
    vi.doMock('jose', async () => ({
      createRemoteJWKSet: () => (async () => ({})) as any,
      jwtVerify: async () => ({ payload }),
    }));
    const { verifyGoogleIdToken: impl } = await import('../auth/google');

    const profile = await impl('token', validAud);
    expect(profile).toEqual({
      sub: '123',
      email: 'a@b.co',
      email_verified: true,
      name: 'User',
      picture: 'https://img',
    });
  });

  it('fails if jwtVerify rejects', async () => {
    vi.resetModules();
    vi.doMock('jose', async () => ({
      createRemoteJWKSet: () => (async () => ({})) as any,
      jwtVerify: async () => {
        throw new Error('bad token');
      },
    }));
    const { verifyGoogleIdToken: impl2 } = await import('../auth/google');
    await expect(impl2('token', validAud)).rejects.toThrow('bad token');
  });
});
