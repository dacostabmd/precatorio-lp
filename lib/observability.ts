import { getSupabaseAdmin } from './supabaseAdmin';

type IntegrationService = 'bitrix' | 'meta_capi' | 'infosimples' | 'openai' | 'rag_webhook';
type IntegrationStatus = 'success' | 'error';

export async function upsertChatSession(clientSessionId: string | undefined | null, patch: Record<string, any>) {
  const db = getSupabaseAdmin();
  if (!db || !clientSessionId) return;
  try {
    await db
      .from('chat_sessions')
      .upsert(
        { client_session_id: clientSessionId, ...patch, last_activity_at: new Date().toISOString() },
        { onConflict: 'client_session_id' }
      );
  } catch (err) {
    console.warn('[observability] upsertChatSession falhou:', err);
  }
}

export async function logChatMessage(
  clientSessionId: string | undefined | null,
  role: 'user' | 'assistant' | 'system',
  content: string,
  kind: string = 'text',
  metadata?: object
) {
  const db = getSupabaseAdmin();
  if (!db || !clientSessionId) return;
  try {
    const { data: session } = await db
      .from('chat_sessions')
      .select('id')
      .eq('client_session_id', clientSessionId)
      .maybeSingle();
    if (!session) return; // sessao precisa existir (criada via upsertChatSession em /api/lead ou lazy-upsert no proprio /api/chat)
    await db.from('chat_messages').insert({ session_id: session.id, role, content, kind, metadata });
  } catch (err) {
    console.warn('[observability] logChatMessage falhou:', err);
  }
}

export async function logIntegrationEvent(params: {
  clientSessionId?: string | null;
  service: IntegrationService;
  operation: string;
  status: IntegrationStatus;
  httpStatus?: number;
  latencyMs?: number;
  errorMessage?: string;
  requestSummary?: object;
  responseSummary?: object;
}) {
  const db = getSupabaseAdmin();
  if (!db) return;
  try {
    let sessionRowId: string | null = null;
    if (params.clientSessionId) {
      const { data } = await db
        .from('chat_sessions')
        .select('id')
        .eq('client_session_id', params.clientSessionId)
        .maybeSingle();
      sessionRowId = data?.id ?? null;
    }
    await db.from('integration_events').insert({
      session_id: sessionRowId,
      service: params.service,
      operation: params.operation,
      status: params.status,
      http_status: params.httpStatus,
      latency_ms: params.latencyMs,
      error_message: params.errorMessage,
      request_summary: params.requestSummary,
      response_summary: params.responseSummary,
    });
  } catch (err) {
    console.warn('[observability] logIntegrationEvent falhou:', err);
  }
}
