import { Router } from 'express';
import type { Response } from 'express';
import { z } from 'zod';
import { verifyGoogleIdToken as realVerify } from '../auth/google';
import { upsertUserFromGoogle } from '../auth/service';
import { signAccessToken } from '../auth/jwt';

const schema = z.object({ idToken: z.string().min(10) });

export interface AuthDeps {
  verifyGoogleIdToken: typeof realVerify;
}

export default async function buildAuthRouter(deps?: Partial<AuthDeps>) {
  const router = Router();
  const verifyGoogleIdToken = deps?.verifyGoogleIdToken || realVerify;

  router.post('/google/token', async (req, res) => {
    try {
      const parse = schema.safeParse(req.body);
      if (!parse.success) {
        return res.status(400).json({ error: 'invalid body', details: parse.error.issues });
      }
      const { idToken } = parse.data;
      const allowed = (process.env.GOOGLE_CLIENT_IDS || '').split(',').filter(Boolean);
      const profile = await verifyGoogleIdToken(idToken, allowed);
      const user = await upsertUserFromGoogle(profile);

      const accessToken = await signAccessToken({
        userId: user.id,
        isAdmin: user.is_admin,
      });
      // For now, a dummy opaque refresh token; to be replaced with rotate+store if needed
      const refreshToken = 'r.' + Buffer.from(user.id + ':' + Date.now()).toString('base64url');
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.json({
        accessToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatar_url,
          isAdmin: user.is_admin,
        },
      });
    } catch {
      return res.status(401).json({ error: 'invalid token' });
    }
  });

  // Admin-only: expose auth config for debugging
  router.get('/config', async (req, res: Response) => {
    try {
      const header = req.headers.authorization || '';
      const token = header.startsWith('Bearer ') ? header.slice(7) : '';
      if (!token) return res.status(401).json({ error: 'unauthorized' });
      const { verifyAccessToken } = await import('../auth/jwt');
      const claims = await verifyAccessToken(token);
      if (!claims.isAdmin) return res.status(403).json({ error: 'forbidden' });

      const audiences = (process.env.GOOGLE_CLIENT_IDS || '').split(',').filter(Boolean);
      return res.json({ audiences });
    } catch {
      return res.status(401).json({ error: 'unauthorized' });
    }
  });

  return router;
}
