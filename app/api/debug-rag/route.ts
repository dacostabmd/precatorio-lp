import { NextResponse } from 'next/server';

// Rota TEMPORÁRIA de diagnóstico — remover após identificar por que o embed em
// produção não está batendo no webhook RAG da DAP IA. Não expõe segredos: só
// confirma presença/tamanho das env vars e o resultado bruto da chamada.
export async function GET() {
  const usarRag = process.env.USE_RAG_WEBHOOK;
  const webhookUrl = process.env.RAG_WEBHOOK_URL;
  const apiKey = process.env.RAG_WEBHOOK_API_KEY;
  const origin = process.env.RAG_WEBHOOK_ORIGIN || 'https://dapadvocacia.com.br';

  const diagnostico: Record<string, any> = {
    env: {
      USE_RAG_WEBHOOK_valor: usarRag ?? null,
      USE_RAG_WEBHOOK_igual_true: usarRag === 'true',
      RAG_WEBHOOK_URL_presente: !!webhookUrl,
      RAG_WEBHOOK_URL_valor: webhookUrl ?? null,
      RAG_WEBHOOK_API_KEY_presente: !!apiKey,
      RAG_WEBHOOK_API_KEY_tamanho: apiKey?.length ?? 0,
      origin_usado: origin,
    },
  };

  if (usarRag !== 'true' || !webhookUrl) {
    diagnostico.resultado = 'ABORTOU_ANTES_DO_FETCH';
    diagnostico.motivo = usarRag !== 'true'
      ? 'USE_RAG_WEBHOOK não é a string "true" neste ambiente'
      : 'RAG_WEBHOOK_URL está vazia/ausente neste ambiente';
    return NextResponse.json(diagnostico);
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Origin: origin,
    Referer: `${origin}/`,
  };
  if (apiKey) {
    headers['Authorization'] = `Bearer ${apiKey}`;
    headers['X-API-Key'] = apiKey;
  }

  const payload = {
    mensagem: 'teste de diagnostico',
    session_id: 'debug-rag',
    historico: [],
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

    const textoBruto = await response.text();

    diagnostico.resultado = response.ok ? 'FETCH_OK' : 'FETCH_STATUS_NAO_OK';
    diagnostico.http_status = response.status;
    diagnostico.resposta_bruta = textoBruto.slice(0, 2000);

    return NextResponse.json(diagnostico);
  } catch (error: any) {
    diagnostico.resultado = 'EXCECAO';
    diagnostico.erro_nome = error?.name ?? null;
    diagnostico.erro_mensagem = error?.message ?? String(error);
    return NextResponse.json(diagnostico);
  }
}
