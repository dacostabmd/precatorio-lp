import { MensagemChat } from './chatSecurity';
import { Persona } from './calculator';

export interface SolicitacaoRagWebhook {
  messages: MensagemChat[];
  persona: Persona;
  bitrixDealId?: number;
}

export interface RespostaRagWebhook {
  text: string;
  metadata?: Record<string, any>;
}

/**
 * Envia uma mensagem conversacional ao Webhook REST da Persona DAP IA.
 *
 * Formato do Payload (conforme especificação da DAP IA):
 * - mensagem (string): pergunta do usuário
 * - session_id (string, opcional): identificador de sessão/histórico
 * - historico (array, opcional): mensagens anteriores [{ role, content }]
 */
export async function consultarRagWebhook(
  params: SolicitacaoRagWebhook
): Promise<RespostaRagWebhook | null> {
  const usarRag = process.env.USE_RAG_WEBHOOK === 'true';
  const webhookUrl = process.env.RAG_WEBHOOK_URL;

  if (!usarRag || !webhookUrl) {
    return null;
  }

  const apiKey = process.env.RAG_WEBHOOK_API_KEY;
  const origin = process.env.RAG_WEBHOOK_ORIGIN || 'https://dapadvocacia.com.br';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Origin': origin,
    'Referer': `${origin}/`,
  };

  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-API-Key'] = apiKey;
  }

  const ultimaMensagem = params.messages[params.messages.length - 1]?.content || '';

  // Formato exato da especificação DAP IA REST Webhook
  const payload = {
    mensagem: ultimaMensagem,
    session_id: params.bitrixDealId ? `deal-${params.bitrixDealId}` : undefined,
    historico: params.messages.slice(0, -1).map((m) => ({
      role: m.role,
      content: m.content,
    })),
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`[ragWebhook] DAP IA Webhook respondeu com status ${response.status}:`, errorText);
      return null;
    }

    const data = await response.json();

    // Procura o campo de resposta retornado pela DAP IA (resposta, response, text, mensagem, output)
    const textoResposta =
      data?.resposta ||
      data?.text ||
      data?.response ||
      data?.output ||
      data?.answer ||
      data?.mensagem ||
      data?.message ||
      (typeof data === 'string' ? data : null);

    if (typeof textoResposta === 'string' && textoResposta.trim().length > 0) {
      return {
        text: textoResposta.trim(),
        metadata: data?.metadata || data?.sources ? { sources: data.sources } : undefined,
      };
    }

    console.warn('[ragWebhook] DAP IA Webhook não retornou um campo de texto reconhecido no JSON:', data);
    return null;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.warn('[ragWebhook] Requisição ao webhook do RAG excedeu o timeout de 15s.');
    } else {
      console.warn('[ragWebhook] Erro ao conectar ao webhook do RAG:', error.message || error);
    }
    return null;
  }
}
