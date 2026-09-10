import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForToken, saveBitrixOAuthTokens } from '@/lib/bitrixOAuth';
import { signHubSession } from '@/lib/hubSession';

export const runtime = 'nodejs';

function erroUrl(request: NextRequest, motivo: string): URL {
  const url = new URL('/login', request.url);
  url.searchParams.set('erro', motivo);
  return url;
}

async function parsePayload(request: NextRequest): Promise<Record<string, any>> {
  const result: Record<string, any> = {};

  try {
    request.nextUrl.searchParams.forEach((val, key) => {
      result[key] = val;
    });
  } catch {}

  const contentType = request.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    try {
      const json = await request.json();
      if (json && typeof json === 'object') {
        Object.assign(result, json);
      }
    } catch {}
  } else {
    try {
      const cloned = request.clone();
      try {
        const formData = await cloned.formData();
        formData.forEach((val, key) => {
          result[key] = val.toString();
        });
      } catch {
        const text = await request.text();
        if (text) {
          const searchParams = new URLSearchParams(text);
          searchParams.forEach((val, key) => {
            result[key] = val;
          });
        }
      }
    } catch {}
  }

  return result;
}

function extractParam(data: Record<string, any>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    if (data[key] !== undefined && data[key] !== null && String(data[key]).trim() !== '') {
      return String(data[key]);
    }
  }
  if (data.auth && typeof data.auth === 'object') {
    for (const key of keys) {
      if (data.auth[key] !== undefined && data.auth[key] !== null && String(data.auth[key]).trim() !== '') {
        return String(data.auth[key]);
      }
    }
  }
  return undefined;
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

    const isProd = process.env.NODE_ENV === 'production';
    const response = NextResponse.redirect(new URL('/dashboard/sessoes', request.url));
    response.cookies.set('hub_session', sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      partitioned: isProd,
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

export async function POST(request: NextRequest) {
  const payload = await parsePayload(request);

  const authId = extractParam(
    payload,
    'AUTH_ID',
    'auth_id',
    'access_token',
    'auth[access_token]',
    'auth[AUTH_ID]'
  );

  const refreshId = extractParam(
    payload,
    'REFRESH_ID',
    'refresh_id',
    'refresh_token',
    'auth[refresh_token]',
    'auth[REFRESH_ID]'
  );

  const authExpires = extractParam(
    payload,
    'AUTH_EXPIRES',
    'auth_expires',
    'expires_in',
    'auth[expires_in]'
  );

  const domain = extractParam(
    payload,
    'DOMAIN',
    'domain',
    'auth[domain]'
  ) || process.env.BITRIX_OAUTH_PORTAL_DOMAIN || '';

  const memberId = extractParam(
    payload,
    'member_id',
    'MEMBER_ID',
    'auth[member_id]'
  ) || domain || 'default';

  const scope = extractParam(payload, 'SCOPE', 'scope', 'auth[scope]');
  const userIdStr = extractParam(payload, 'USER_ID', 'user_id', 'auth[user_id]');

  const portalEsperado = process.env.BITRIX_OAUTH_PORTAL_DOMAIN;
  if (portalEsperado && domain && domain !== portalEsperado) {
    console.warn(`[bitrix-callback] portal nao autorizado tentou POST: ${domain}`);
    return NextResponse.redirect(erroUrl(request, 'portal_nao_autorizado'));
  }

  if (authId && refreshId) {
    await saveBitrixOAuthTokens({
      access_token: authId,
      refresh_token: refreshId,
      expires_in: authExpires ? Number(authExpires) : 3600,
      domain,
      member_id: memberId,
      scope,
      user_id: userIdStr ? Number(userIdStr) : undefined,
    });

    const sessionToken = await signHubSession({
      sub: memberId,
      memberId,
      domain,
      userId: userIdStr ? Number(userIdStr) : undefined,
    });

    const isProd = process.env.NODE_ENV === 'production';

    const htmlResponse = new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Premium Office</title>
  <script src="//api.bitrix24.com/api/v1/"></script>
</head>
<body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b;">
  <div style="text-align: center;">
    <p>Carregando painel...</p>
  </div>
  <script>
    if (window.BX24) {
      BX24.init(function() {
        window.location.replace('/dashboard/sessoes');
      });
    } else {
      window.location.replace('/dashboard/sessoes');
    }
  </script>
</body>
</html>`,
      {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }
    );

    htmlResponse.cookies.set('hub_session', sessionToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      partitioned: isProd,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    });

    return htmlResponse;
  }

  return NextResponse.redirect(new URL('/dashboard/sessoes', request.url));
}
