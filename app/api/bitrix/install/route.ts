import { NextRequest, NextResponse } from 'next/server';
import { saveBitrixOAuthTokens } from '@/lib/bitrixOAuth';

export const runtime = 'nodejs';

// Handler do evento ONAPPINSTALL: o Bitrix chama esta URL via POST (form-urlencoded)
// quando o app local e instalado ou reinstalado no portal, entregando o primeiro
// par de tokens OAuth diretamente (sem o fluxo authorization_code do login humano).
async function handleInstall(request: NextRequest) {
  const form = await request.formData();

  const authId = form.get('AUTH_ID')?.toString();
  const refreshId = form.get('REFRESH_ID')?.toString();
  const authExpires = form.get('AUTH_EXPIRES')?.toString();
  const memberId = form.get('member_id')?.toString();
  const domain = form.get('DOMAIN')?.toString();

  if (!authId || !refreshId || !memberId || !domain) {
    return NextResponse.json({ error: 'Payload de instalacao incompleto.' }, { status: 400 });
  }

  await saveBitrixOAuthTokens({
    access_token: authId,
    refresh_token: refreshId,
    expires_in: authExpires ? Number(authExpires) : 3600,
    domain,
    member_id: memberId,
  });

  // Responde a pagina que o Bitrix exibe dentro do iframe de instalacao.
  return new NextResponse(
    `<html><body><script>
      if (window.BX24) { BX24.installFinish(); }
    </script>Aplicativo instalado com sucesso.</body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export async function POST(request: NextRequest) {
  return handleInstall(request);
}

export async function GET(request: NextRequest) {
  return handleInstall(request);
}
