import { SignJWT, jwtVerify } from 'jose';

export interface HubSessionPayload {
  sub: string;
  memberId: string;
  domain: string;
  userId?: number;
}

const ALG = 'HS256';

function getSecret(): Uint8Array {
  const secret = process.env.HUB_SESSION_SECRET;
  if (!secret) throw new Error('HUB_SESSION_SECRET nao configurado.');
  return new TextEncoder().encode(secret);
}

export async function signHubSession(payload: HubSessionPayload, expiresIn = '7d'): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getSecret());
}

export async function verifyHubSession(token: string): Promise<HubSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.sub !== 'string' || typeof payload.domain !== 'string') return null;
    return payload as unknown as HubSessionPayload;
  } catch {
    return null;
  }
}
