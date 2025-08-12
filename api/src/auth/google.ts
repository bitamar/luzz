import * as Jose from 'jose';

export interface GoogleProfile {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

/**
 * Verify a Google ID token and return its payload.
 * allowedClientIds: one or more OAuth client IDs this backend accepts as audience.
 */
export async function verifyGoogleIdToken(idToken: string, allowedClientIds: string[]): Promise<GoogleProfile> {
  if (!idToken) throw new Error('missing id token');
  if (!allowedClientIds || allowedClientIds.length === 0) throw new Error('no allowed client ids');

  const JWKS = Jose.createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
  const { payload } = await Jose.jwtVerify(idToken, JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: allowedClientIds,
  });

  return normalizeGooglePayload(payload);
}

function normalizeGooglePayload(payload: Jose.JWTPayload): GoogleProfile {
  return {
    sub: String(payload.sub || ''),
    email: typeof payload.email === 'string' ? payload.email : undefined,
    email_verified: payload.email_verified as boolean | undefined,
    name: typeof payload.name === 'string' ? payload.name : undefined,
    picture: typeof payload.picture === 'string' ? payload.picture : undefined,
  };
}
