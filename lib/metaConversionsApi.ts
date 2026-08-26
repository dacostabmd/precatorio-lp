import crypto from 'crypto';

const META_PIXEL_ID = process.env.META_PIXEL_ID;
const META_CONVERSION_API_TOKEN = process.env.META_CONVERSION_API_TOKEN;
const META_API_VERSION = 'v21.0';

function hash(value: string) {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

function normalizarCelularBR(celular: string) {
  const digitos = celular.replace(/\D/g, '');
  return digitos.startsWith('55') ? digitos : `55${digitos}`;
}

interface LeadEventInput {
  nomeCompleto: string;
  celular: string;
  eventId: string;
  ip?: string | null;
  userAgent?: string | null;
}

/**
 * Envia o evento padrão "Lead" para a Meta Conversions API (server-side),
 * associado ao dataset configurado (META_PIXEL_ID). Dados de PII (nome,
 * celular) vão hasheados em SHA-256 conforme exigido pela Meta. Falha
 * silenciosamente (loga e segue) se as credenciais não estiverem
 * configuradas — o chamador decide se propaga erros de chamada.
 */
export async function enviarLeadParaMeta({
  nomeCompleto,
  celular,
  eventId,
  ip,
  userAgent,
}: LeadEventInput) {
  if (!META_PIXEL_ID || !META_CONVERSION_API_TOKEN) {
    console.warn(
      '[meta-capi] META_PIXEL_ID/META_CONVERSION_API_TOKEN não configurados — evento Lead não enviado.'
    );
    return { enviado: false };
  }

  const [primeiroNome, ...resto] = nomeCompleto.trim().split(/\s+/);
  const sobrenome = resto.join(' ');

  const userData: Record<string, unknown> = {
    ph: [hash(normalizarCelularBR(celular))],
    fn: [hash(primeiroNome)],
  };
  if (sobrenome) userData.ln = [hash(sobrenome)];
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;

  const body = {
    data: [
      {
        event_name: 'Lead',
        event_time: Math.floor(Date.now() / 1000),
        action_source: 'website',
        event_id: eventId,
        user_data: userData,
      },
    ],
    access_token: META_CONVERSION_API_TOKEN,
  };

  const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${META_PIXEL_ID}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || 'Falha ao enviar evento Lead para a Meta Conversions API');
  }

  return { enviado: true, eventsReceived: data.events_received };
}
