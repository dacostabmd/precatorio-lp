import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { buildAuthorizationUrl } from '@/lib/bitrixOAuth';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const state = randomBytes(16).toString('hex');

  let authUrl: string;
  try {
    authUrl = buildAuthorizationUrl(state);
  } catch (err: any) {
    console.error('[bitrix-oauth] login mal configurado:', err?.message);
    return NextResponse.redirect(new URL('/login?erro=oauth_nao_configurado', request.url));
  }

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('bitrix_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
  });
  return response;
}
