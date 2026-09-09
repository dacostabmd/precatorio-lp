import { getSupabaseAdmin } from './supabaseAdmin';

const OAUTH_AUTHORIZE_PATH = '/oauth/authorize/';
const OAUTH_TOKEN_URL = 'https://oauth.bitrix.info/oauth/token/';

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} nao configurado.`);
  return value;
}

function getRedirectUri(): string {
  return `${getEnv('HUB_BASE_URL').replace(/\/$/, '')}/api/auth/bitrix/callback`;
}

export function buildAuthorizationUrl(state: string): string {
  const domain = getEnv('BITRIX_OAUTH_PORTAL_DOMAIN');
  const clientId = getEnv('BITRIX_OAUTH_CLIENT_ID');

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    state,
  });

  return `https://${domain}${OAUTH_AUTHORIZE_PATH}?${params.toString()}`;
}

export interface BitrixTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope?: string;
  domain: string;
  member_id: string;
  user_id?: number;
}

export async function exchangeCodeForToken(code: string): Promise<BitrixTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: getEnv('BITRIX_OAUTH_CLIENT_ID'),
    client_secret: getEnv('BITRIX_OAUTH_CLIENT_SECRET'),
    redirect_uri: getRedirectUri(),
    code,
  });

  const res = await fetch(`${OAUTH_TOKEN_URL}?${params.toString()}`);
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Falha ao trocar code por token no Bitrix.');
  }

  return data as BitrixTokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<BitrixTokenResponse> {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: getEnv('BITRIX_OAUTH_CLIENT_ID'),
    client_secret: getEnv('BITRIX_OAUTH_CLIENT_SECRET'),
    refresh_token: refreshToken,
  });

  const res = await fetch(`${OAUTH_TOKEN_URL}?${params.toString()}`);
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || 'Falha ao renovar token no Bitrix.');
  }

  return data as BitrixTokenResponse;
}

export async function saveBitrixOAuthTokens(token: BitrixTokenResponse): Promise<void> {
  const db = getSupabaseAdmin();
  if (!db) return;

  const expiresAt = new Date(Date.now() + token.expires_in * 1000).toISOString();

  try {
    await db.from('bitrix_oauth_tokens').upsert(
      {
        bitrix_member_id: token.member_id,
        bitrix_user_id: token.user_id ?? null,
        domain: token.domain,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: expiresAt,
        scope: token.scope ?? null,
      },
      { onConflict: 'bitrix_member_id' }
    );
  } catch (err) {
    console.warn('[bitrixOAuth] saveBitrixOAuthTokens falhou:', err);
  }
}
