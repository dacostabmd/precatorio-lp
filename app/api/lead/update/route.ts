import { NextResponse, after } from 'next/server';
import { upsertChatSession, logIntegrationEvent } from '@/lib/observability';

interface UpdatePayload {
  dealId: number;
  acao: 'simulacao_calculada' | 'agendou_reuniao' | 'falar_consultor' | 'solicitar_revisao' | 'aceitou_proposta';
  simulacao?: {
    valorAtualizado?: number;
    projecaoFutura?: number;
    valorMinimo?: number;
    valorMaximo?: number;
    items?: { label: string; value: string }[];
  };
  horarioReuniao?: string;
  honorarios?: string;
  sessionId?: string;
}

const RESULTADO_POR_ACAO: Record<UpdatePayload['acao'], string> = {
  simulacao_calculada: 'lead_qualificado',
  agendou_reuniao: 'reuniao_agendada',
  falar_consultor: 'falou_consultor',
  solicitar_revisao: 'revisao_solicitada',
  aceitou_proposta: 'documentos_enviados',
};

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

export async function POST(request: Request) {
  try {
    const body: UpdatePayload = await request.json();
    const { dealId, acao, simulacao, horarioReuniao, honorarios, sessionId } = body;

    if (!dealId || typeof dealId !== 'number') {
      return NextResponse.json({ error: 'dealId é obrigatório.' }, { status: 400 });
    }

    const webhookUrl = process.env.BITRIX_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json({ ok: false, message: 'Webhook não configurado' });
    }

    const bitrixStart = Date.now();

    // 1. Busca dados atuais do Deal para concatenar nos comentários
    const dealAtual = await bitrixCall(webhookUrl, 'crm.deal.get', { id: dealId }).catch(() => null);
    const commentsAntigos = dealAtual?.COMMENTS || '';

    let novoComentario = `\n\n--- ATUALIZAÇÃO DO FLUXO (${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}) ---\n`;
    const updateFields: Record<string, any> = {};

    if (acao === 'simulacao_calculada' && simulacao) {
      novoComentario += `💰 SIMULAÇÃO CALCULADA PELA IA:\n`;
      if (simulacao.items && simulacao.items.length > 0) {
        simulacao.items.forEach((item) => {
          novoComentario += `• ${item.label}: ${item.value}\n`;
        });
      }
      if (simulacao.valorMinimo && simulacao.valorMaximo) {
        novoComentario += `• Faixa de Antecipação: R$ ${simulacao.valorMinimo.toLocaleString('pt-BR')} até R$ ${simulacao.valorMaximo.toLocaleString('pt-BR')}\n`;
        // Atualiza a oportunidade no Bitrix com a média ou valor máximo da proposta
        updateFields.OPPORTUNITY = simulacao.valorMaximo;
        updateFields.CURRENCY_ID = 'BRL';
      }
      if (honorarios) {
        novoComentario += `• Honorários Informados: ${honorarios}\n`;
      }
    } else if (acao === 'agendou_reuniao') {
      novoComentario += `📅 REUNIÃO AGENDADA PELO CLIENTE:\n`;
      novoComentario += `• Horário Selecionado: ${horarioReuniao || 'Não informado'}\n`;
      novoComentario += `• Status: Cliente aguardando contato no horário marcado.`;
    } else if (acao === 'falar_consultor') {
      novoComentario += `💬 CLIENTE OPTOU POR ATENDIMENTO NO WHATSAPP:\n`;
      novoComentario += `• O cliente solicitou contato imediato de um consultor humano via WhatsApp.`;
    } else if (acao === 'solicitar_revisao') {
      novoComentario += `📋 SOLICITAÇÃO DE REVISÃO JURÍDICA / FINANCEIRA:\n`;
      novoComentario += `• O cliente solicitou revisão manual antes de qualquer proposta final.`;
    } else if (acao === 'aceitou_proposta') {
      novoComentario += `🤝 PROPOSTA INDICATIVA ACEITA PELO CLIENTE:\n`;
      novoComentario += `• O cliente avançou para a etapa de envio de documentos.`;
    }

    updateFields.COMMENTS = `${commentsAntigos}${novoComentario}`;

    await bitrixCall(webhookUrl, 'crm.deal.update', {
      id: dealId,
      fields: updateFields,
    });

    after(() =>
      logIntegrationEvent({
        clientSessionId: sessionId,
        service: 'bitrix',
        operation: `deal.update.${acao}`,
        status: 'success',
        latencyMs: Date.now() - bitrixStart,
      })
    );
    after(() =>
      upsertChatSession(sessionId, {
        resultado: RESULTADO_POR_ACAO[acao] || 'em_andamento',
        stage_final: acao,
      })
    );

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error('Erro na rota /api/lead/update (Bitrix):', error);
    after(() =>
      logIntegrationEvent({
        service: 'bitrix',
        operation: 'deal.update',
        status: 'error',
        errorMessage: error?.message,
      })
    );
    return NextResponse.json(
      { error: 'Falha ao atualizar o lead no Bitrix.', details: error.message },
      { status: 500 }
    );
  }
}
