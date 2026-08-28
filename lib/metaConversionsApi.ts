import crypto from 'crypto';

const META_PIXEL_ID = process.env.META_PIXEL_ID;
const META_CONVERSION_API_TOKEN = process.env.META_CONVERSION_API_TOKEN;
const META_API_VERSION = 'v21.0';

function hash(value: string) {
  return crypto.createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}

interface LeadEventInput {
  nomeCompleto: string;
  cpf: string;
  eventId: string;
  eventName?: string;
  eventSourceUrl?: string;
  ip?: string | null;
  userAgent?: string | null;
  customData?: Record<string, unknown>;
}

/**
 * Envia o evento de conversão ("AIChatLead" e "Lead") para a Meta Conversions API (server-side),
 * associado ao dataset configurado (META_PIXEL_ID). Dados de PII (nome,
 * CPF) vão hasheados em SHA-256 conforme exigido pela Meta. O CPF é enviado
 * como external_id (identificador único de cliente) — permitindo deduplicação
 * automática e alta pontuação no Event Match Quality (EMQ).
 */
export async function enviarLeadParaMeta({
  nomeCompleto,
  cpf,
  eventId,
  eventName = 'AIChatLead',
  eventSourceUrl = 'https://premiumofficeprecatorio.com.br/lp-premium-office-b/',
  ip,
  userAgent,
  customData,
}: LeadEventInput) {
  if (!META_PIXEL_ID || !META_CONVERSION_API_TOKEN) {
    console.warn(
      '[meta-capi] META_PIXEL_ID/META_CONVERSION_API_TOKEN não configurados — evento de conversão não enviado.'
    );
    return { enviado: false };
  }

  const [primeiroNome, ...resto] = nomeCompleto.trim().split(/\s+/);
  const sobrenome = resto.join(' ');

  const userData: Record<string, unknown> = {
    external_id: [hash(cpf.replace(/\D/g, ''))],
    fn: [hash(primeiroNome)],
  };
  if (sobrenome) userData.ln = [hash(sobrenome)];
  if (ip) userData.client_ip_address = ip;
  if (userAgent) userData.client_user_agent = userAgent;

  const nowSeconds = Math.floor(Date.now() / 1000);

  // Envia o evento customizado AIChatLead (com o event_id correspondente para deduplicar com o Pixel do navegador)
  // e o evento padrão Lead
  const events = [
    {
      event_name: eventName,
      event_time: nowSeconds,
      action_source: 'website',
      event_source_url: eventSourceUrl,
      event_id: eventId,
      user_data: userData,
      custom_data: {
        content_name: 'Lead Qualificado Chat IA',
        ...customData,
      },
    },
    {
      event_name: 'Lead',
      event_time: nowSeconds,
      action_source: 'website',
      event_source_url: eventSourceUrl,
      event_id: `${eventId}-standard-lead`,
      user_data: userData,
      custom_data: {
        content_name: 'Lead Qualificado Chat IA',
        ...customData,
      },
    },
  ];

  const body = {
    data: events,
    access_token: META_CONVERSION_API_TOKEN,
  };

  const res = await fetch(`https://graph.facebook.com/${META_API_VERSION}/${META_PIXEL_ID}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || 'Falha ao enviar evento de conversão para a Meta Conversions API');
  }

  return { enviado: true, eventsReceived: data.events_received };
}

