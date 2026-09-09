import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, saveBitrixOAuthTokens } from '@/lib/bitrixOAuth';
import { signHubSession } from '@/lib/hubSession';

export const runtime = 'nodejs';

function erroUrl(request: NextRequest, motivo: string): URL {
  const url = new URL('/login', request.url);
  url.searchParams.set('erro', motivo);
  return url;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const state = request.nextUrl.searchParams.get('state');
  const cookieState = request.cookies.get('bitrix_oauth_state')?.value;

  if (!code || !state || !cookieState || state !== cookieState) {
    return NextResponse.redirect(erroUrl(request, 'state_invalido'));
  }

  const portalEsperado = process.env.BITRIX_OAUTH_PORTAL_DOMAIN;

  try {
    const token = await exchangeCodeForToken(code);

    if (portalEsperado && token.domain && token.domain !== portalEsperado) {
      console.warn(`[bitrix-oauth] portal nao autorizado tentou login: ${token.domain}`);
      return NextResponse.redirect(erroUrl(request, 'portal_nao_autorizado'));
    }

    await saveBitrixOAuthTokens(token);

    const sessionToken = await signHubSession({
      sub: token.member_id,
      memberId: token.member_id,
      domain: token.domain,
      userId: token.user_id,
    });

    const response = NextResponse.redirect(new URL('/dashboard/sessoes', request.url));
    response.cookies.set('hub_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });
    response.cookies.delete('bitrix_oauth_state');
    return response;
  } catch (err: any) {
    console.error('[bitrix-oauth] falha no callback:', err?.message);
    return NextResponse.redirect(erroUrl(request, 'falha_token'));
  }
}
