import { getSupabaseAdmin } from './supabaseAdmin';

export interface ChatSessionRow {
  id: string;
  client_session_id: string;
  source: string;
  persona: string | null;
  bitrix_deal_id: number | null;
  bitrix_contact_id: number | null;
  lead_nome: string | null;
  lead_cpf: string | null;
  lead_telefone: string | null;
  stage_final: string | null;
  resultado: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_content: string | null;
  utm_term: string | null;
  referrer: string | null;
  started_at: string;
  ended_at: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessageRow {
  id: string;
  session_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  kind: string;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface IntegrationEventRow {
  id: string;
  session_id: string | null;
  service: string;
  operation: string;
  status: 'success' | 'error';
  http_status: number | null;
  latency_ms: number | null;
  error_message: string | null;
  request_summary: Record<string, any> | null;
  response_summary: Record<string, any> | null;
  created_at: string;
}

export interface ListChatSessionsParams {
  persona?: string;
  resultado?: string;
  stageFinal?: string;
  dealId?: number;
  busca?: string;
  dataInicio?: string;
  dataFim?: string;
  page?: number;
  pageSize?: number;
}

export interface ListChatSessionsResult {
  sessions: ChatSessionRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listChatSessions(params: ListChatSessionsParams = {}): Promise<ListChatSessionsResult> {
  const page = params.page && params.page > 0 ? params.page : 1;
  const pageSize = params.pageSize && params.pageSize > 0 ? params.pageSize : 25;

  const db = getSupabaseAdmin();
  if (!db) return { sessions: [], total: 0, page, pageSize };

  try {
    let query = db.from('chat_sessions').select('*', { count: 'exact' });

    if (params.persona) query = query.eq('persona', params.persona);
    if (params.resultado) query = query.eq('resultado', params.resultado);
    if (params.stageFinal) query = query.eq('stage_final', params.stageFinal);
    if (params.dealId) query = query.eq('bitrix_deal_id', params.dealId);
    if (params.dataInicio) query = query.gte('started_at', params.dataInicio);
    if (params.dataFim) query = query.lte('started_at', params.dataFim);
    if (params.busca?.trim()) {
      const termo = params.busca.trim().replace(/[%,]/g, '');
      query = query.or(`lead_nome.ilike.%${termo}%,lead_cpf.ilike.%${termo}%`);
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const { data, count, error } = await query.order('started_at', { ascending: false }).range(from, to);

    if (error) {
      console.warn('[hubQueries] listChatSessions falhou:', error);
      return { sessions: [], total: 0, page, pageSize };
    }

    return { sessions: (data as ChatSessionRow[]) || [], total: count || 0, page, pageSize };
  } catch (err) {
    console.warn('[hubQueries] listChatSessions falhou:', err);
    return { sessions: [], total: 0, page, pageSize };
  }
}

export async function getChatSessionDetail(id: string): Promise<{
  session: ChatSessionRow | null;
  messages: ChatMessageRow[];
  events: IntegrationEventRow[];
}> {
  const db = getSupabaseAdmin();
  if (!db) return { session: null, messages: [], events: [] };

  try {
    const { data: session } = await db.from('chat_sessions').select('*').eq('id', id).maybeSingle();
    if (!session) return { session: null, messages: [], events: [] };

    const [{ data: messages }, { data: events }] = await Promise.all([
      db.from('chat_messages').select('*').eq('session_id', id).order('created_at', { ascending: true }),
      db.from('integration_events').select('*').eq('session_id', id).order('created_at', { ascending: true }),
    ]);

    return {
      session: session as ChatSessionRow,
      messages: (messages as ChatMessageRow[]) || [],
      events: (events as IntegrationEventRow[]) || [],
    };
  } catch (err) {
    console.warn('[hubQueries] getChatSessionDetail falhou:', err);
    return { session: null, messages: [], events: [] };
  }
}

export interface MetricasAgregadas {
  totalSessoes: number;
  sessoes7dias: number;
  sessoes30dias: number;
  porResultado: Record<string, number>;
  porPersona: Record<string, number>;
  errosPorServico24h: Record<string, number>;
}

function metricasVazias(): MetricasAgregadas {
  return {
    totalSessoes: 0,
    sessoes7dias: 0,
    sessoes30dias: 0,
    porResultado: {},
    porPersona: {},
    errosPorServico24h: {},
  };
}

export async function getMetricasAgregadas(): Promise<MetricasAgregadas> {
  const db = getSupabaseAdmin();
  if (!db) return metricasVazias();

  try {
    const agora = Date.now();
    const ha7dias = new Date(agora - 7 * 24 * 60 * 60 * 1000).toISOString();
    const ha30dias = new Date(agora - 30 * 24 * 60 * 60 * 1000).toISOString();
    const ha24h = new Date(agora - 24 * 60 * 60 * 1000).toISOString();

    const [
      { count: totalSessoes },
      { count: sessoes7dias },
      { count: sessoes30dias },
      { data: sessoesResultado },
      { data: sessoesPersona },
      { data: eventosErro },
    ] = await Promise.all([
      db.from('chat_sessions').select('*', { count: 'exact', head: true }),
      db.from('chat_sessions').select('*', { count: 'exact', head: true }).gte('started_at', ha7dias),
      db.from('chat_sessions').select('*', { count: 'exact', head: true }).gte('started_at', ha30dias),
      db.from('chat_sessions').select('resultado'),
      db.from('chat_sessions').select('persona'),
      db.from('integration_events').select('service').eq('status', 'error').gte('created_at', ha24h),
    ]);

    const porResultado: Record<string, number> = {};
    (sessoesResultado || []).forEach((row: any) => {
      const chave = row.resultado || 'desconhecido';
      porResultado[chave] = (porResultado[chave] || 0) + 1;
    });

    const porPersona: Record<string, number> = {};
    (sessoesPersona || []).forEach((row: any) => {
      const chave = row.persona || 'desconhecido';
      porPersona[chave] = (porPersona[chave] || 0) + 1;
    });

    const errosPorServico24h: Record<string, number> = {};
    (eventosErro || []).forEach((row: any) => {
      errosPorServico24h[row.service] = (errosPorServico24h[row.service] || 0) + 1;
    });

    return {
      totalSessoes: totalSessoes || 0,
      sessoes7dias: sessoes7dias || 0,
      sessoes30dias: sessoes30dias || 0,
      porResultado,
      porPersona,
      errosPorServico24h,
    };
  } catch (err) {
    console.warn('[hubQueries] getMetricasAgregadas falhou:', err);
    return metricasVazias();
  }
}

const SERVICOS_MONITORADOS = ['bitrix', 'meta_capi', 'infosimples', 'openai', 'rag_webhook'] as const;

export interface IntegrationHealth {
  service: string;
  ultimaChamada: string | null;
  ultimoStatus: 'success' | 'error' | null;
  totalChamadas24h: number;
  totalErros24h: number;
  taxaErro24h: number;
}

function healthVazio(): IntegrationHealth[] {
  return SERVICOS_MONITORADOS.map((service) => ({
    service,
    ultimaChamada: null,
    ultimoStatus: null,
    totalChamadas24h: 0,
    totalErros24h: 0,
    taxaErro24h: 0,
  }));
}

export async function getIntegrationsHealth(): Promise<IntegrationHealth[]> {
  const db = getSupabaseAdmin();
  if (!db) return healthVazio();

  try {
    const ha24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    return await Promise.all(
      SERVICOS_MONITORADOS.map(async (service) => {
        const [{ data: ultimo }, { data: eventos24h }] = await Promise.all([
          db
            .from('integration_events')
            .select('status, created_at')
            .eq('service', service)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
          db.from('integration_events').select('status').eq('service', service).gte('created_at', ha24h),
        ]);

        const total = eventos24h?.length || 0;
        const erros = (eventos24h || []).filter((e: any) => e.status === 'error').length;

        return {
          service,
          ultimaChamada: ultimo?.created_at ?? null,
          ultimoStatus: (ultimo?.status as 'success' | 'error' | undefined) ?? null,
          totalChamadas24h: total,
          totalErros24h: erros,
          taxaErro24h: total > 0 ? erros / total : 0,
        };
      })
    );
  } catch (err) {
    console.warn('[hubQueries] getIntegrationsHealth falhou:', err);
    return healthVazio();
  }
}
