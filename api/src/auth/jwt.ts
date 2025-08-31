import * as Jose from 'jose';

export interface AccessClaims {
  userId: string;
  isAdmin: boolean;
}

function getSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not set');
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(claims: AccessClaims, ttl: string = '15m'): Promise<string> {
  const alg = 'HS256';
  const secret = getSecret();
  const now = Math.floor(Date.now() / 1000);
  const jwt = await new Jose.SignJWT({ ...claims })
    .setProtectedHeader({ alg })
    .setIssuedAt(now)
    .setExpirationTime(ttl)
    .sign(secret);
  return jwt;
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const secret = getSecret();
  const { payload } = await Jose.jwtVerify(token, secret, {
    algorithms: ['HS256'],
  });
  return {
    userId: String(payload.userId),
    isAdmin: Boolean(payload.isAdmin),
  };
}
