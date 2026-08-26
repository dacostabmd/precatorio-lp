import { NextResponse } from 'next/server';
import { Persona } from '@/lib/calculator';
import { enviarLeadParaMeta } from '@/lib/metaConversionsApi';

interface LeadPayload {
  nomeCompleto: string;
  celular: string;
  persona: Persona;
}

// Pipeline (categoria) de Deal "IA PRECATORIO CALC" no Bitrix — funil alvo
// desta LP. Estágio inicial "LISTA FRIA" (C602:NEW).
const BITRIX_DEAL_CATEGORY_ID = 602;
const BITRIX_DEAL_STAGE_ID = 'C602:NEW';
// Uma automação desse pipeline descarta deals sem responsável atribuído —
// confirmado via teste direto na API (deal sem ASSIGNED_BY_ID some
// silenciosamente logo após a criação). Enquanto não há uma fila/usuário
// definitivo, atribui ao dono do Inbound Webhook.
const BITRIX_DEAL_ASSIGNED_BY_ID = 178968;

async function bitrixCall(webhookUrl: string, method: string, payload: object) {
  const res = await fetch(`${webhookUrl.replace(/\/$/, '')}/${method}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || `Falha ao chamar ${method} no Bitrix`);
  }
  return data.result;
}

/**
 * Cria o Contato (nome + celular) e o Negócio (Deal) vinculado a ele, direto
 * no pipeline "IA PRECATORIO CALC" (categoria 602) do Bitrix24, via Inbound
 * Webhook. BITRIX_WEBHOOK_URL ainda não foi fornecida — enquanto estiver
 * vazia, a chamada é pulada (não bloqueia o usuário) e fica registrada no
 * log do servidor.
 */
async function enviarLeadParaBitrix(payload: LeadPayload) {
  const webhookUrl = process.env.BITRIX_WEBHOOK_URL;

  if (!webhookUrl) {
    console.warn(
      '[bitrix] BITRIX_WEBHOOK_URL não configurada — negócio não enviado ao Bitrix:',
      payload
    );
    return { enviado: false };
  }

  const personaLabel: Record<Persona, string> = {
    autor: 'Titular do crédito',
    advogado: 'Advogado(a)',
    broker: 'Associado / Broker',
  };

  const contactId = await bitrixCall(webhookUrl, 'crm.contact.add', {
    fields: {
      NAME: payload.nomeCompleto,
      PHONE: [{ VALUE: payload.celular, VALUE_TYPE: 'WORK' }],
      SOURCE_ID: 'WEB',
    },
  });

  const dealId = await bitrixCall(webhookUrl, 'crm.deal.add', {
    fields: {
      TITLE: `${payload.nomeCompleto} - LP Calculadora`,
      CATEGORY_ID: BITRIX_DEAL_CATEGORY_ID,
      STAGE_ID: BITRIX_DEAL_STAGE_ID,
      CONTACT_ID: contactId,
      ASSIGNED_BY_ID: BITRIX_DEAL_ASSIGNED_BY_ID,
      SOURCE_ID: 'WEB',
      SOURCE_DESCRIPTION: 'Calculadora de Precatórios - LP',
      COMMENTS: `Perfil selecionado: ${personaLabel[payload.persona] || payload.persona}`,
    },
    params: { REGISTER_SONET_EVENT: 'Y' },
  });

  return { enviado: true, leadId: dealId, contactId };
}

export async function POST(request: Request) {
  try {
    const { nomeCompleto, celular, persona } = await request.json();

    if (!nomeCompleto || typeof nomeCompleto !== 'string' || nomeCompleto.trim().length < 3) {
      return NextResponse.json({ error: 'Nome completo inválido.' }, { status: 400 });
    }
    if (!celular || typeof celular !== 'string' || celular.replace(/\D/g, '').length < 10) {
      return NextResponse.json({ error: 'Número de celular inválido.' }, { status: 400 });
    }

    const resultado = await enviarLeadParaBitrix({
      nomeCompleto: nomeCompleto.trim(),
      celular: celular.trim(),
      persona: (persona as Persona) || 'autor',
    });

    // Card criado no Bitrix -> dispara o evento "Lead" para a Meta Conversions
    // API (controle do marketing). Não bloqueia/quebra a resposta ao usuário
    // se a Meta falhar: o lead já está registrado no CRM.
    if (resultado.enviado && resultado.leadId) {
      const ip =
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        request.headers.get('x-real-ip') ||
        undefined;
      const userAgent = request.headers.get('user-agent') || undefined;

      await enviarLeadParaMeta({
        nomeCompleto: nomeCompleto.trim(),
        celular: celular.trim(),
        eventId: `bitrix-deal-${resultado.leadId}`,
        ip,
        userAgent,
      }).catch((error) => {
        console.error('Erro ao enviar evento Lead para a Meta Conversions API:', error);
      });
    }

    return NextResponse.json({ ok: true, ...resultado });
  } catch (error: any) {
    console.error('Erro na rota /api/lead (Bitrix):', error);
    return NextResponse.json(
      { error: 'Falha ao registrar o lead. Tente novamente.' },
      { status: 500 }
    );
  }
}
