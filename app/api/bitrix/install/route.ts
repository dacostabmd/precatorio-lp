import { NextRequest, NextResponse } from 'next/server';
import { saveBitrixOAuthTokens } from '@/lib/bitrixOAuth';

export const runtime = 'nodejs';

async function parsePayload(request: NextRequest): Promise<Record<string, any>> {
  const result: Record<string, any> = {};

  // 1. Query parameters
  try {
    request.nextUrl.searchParams.forEach((val, key) => {
      result[key] = val;
    });
  } catch {}

  // 2. Body parsing (FormData, URLSearchParams, JSON, Text)
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
  // Suporte a objeto aninhado data.auth (ex: auth: { access_token: ... })
  if (data.auth && typeof data.auth === 'object') {
    for (const key of keys) {
      if (data.auth[key] !== undefined && data.auth[key] !== null && String(data.auth[key]).trim() !== '') {
        return String(data.auth[key]);
      }
    }
  }
  return undefined;
}

async function handleInstall(request: NextRequest) {
  const payload = await parsePayload(request);

  // Extrai tokens e metadados suportando todas as variações do Bitrix24
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

  if (!authId || !refreshId) {
    console.error('[bitrix/install] Payload incompleto recebido:', JSON.stringify(payload));
    return NextResponse.json(
      {
        error: 'Payload de instalacao incompleto.',
        receivedKeys: Object.keys(payload),
        tip: 'Verifique se o Bitrix enviou AUTH_ID e REFRESH_ID (ou auth[access_token]/auth[refresh_token]).',
      },
      { status: 400 }
    );
  }

  await saveBitrixOAuthTokens({
    access_token: authId,
    refresh_token: refreshId,
    expires_in: authExpires ? Number(authExpires) : 3600,
    domain,
    member_id: memberId,
    scope,
    user_id: userIdStr ? Number(userIdStr) : undefined,
  });

  console.log(`[bitrix/install] Tokens salvos com sucesso para o domínio: ${domain} (member_id: ${memberId})`);

  return new NextResponse(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Instalação do Aplicativo</title>
  <script src="//api.bitrix24.com/api/v1/"></script>
</head>
<body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f8fafc; color: #1e293b;">
  <div style="text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);">
    <h2 style="margin-top: 0; color: #0284c7;">Aplicativo Instalado com Sucesso!</h2>
    <p>Os tokens OAuth foram registrados no servidor.</p>
  </div>
  <script>
    if (window.BX24) {
      BX24.init(function() {
        BX24.installFinish();
      });
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
}

export async function POST(request: NextRequest) {
  return handleInstall(request);
}

export async function GET(request: NextRequest) {
  return handleInstall(request);
}
