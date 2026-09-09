-- Extensao para gen_random_uuid()
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- chat_sessions: 1 registro por conversa completa
-- ---------------------------------------------------------------------
create table if not exists chat_sessions (
  id uuid primary key default gen_random_uuid(),
  client_session_id text not null unique, -- uuid gerado no browser (ChatSection), correlaciona todas as chamadas dessa sessao
  source text not null default 'embed' check (source in ('embed', 'home', 'unknown')),
  persona text check (persona in ('autor', 'advogado', 'broker')),
  bitrix_deal_id bigint,
  bitrix_contact_id bigint,
  lead_nome text,
  lead_cpf text,          -- ver nota LGPD no plano de implementacao
  lead_telefone text,
  stage_final text,        -- ultimo Stage conhecido do componente (qualify..done)
  resultado text check (resultado in ('em_andamento', 'lead_qualificado', 'documentos_enviados', 'reuniao_agendada', 'falou_consultor', 'revisao_solicitada', 'abandonado')) default 'em_andamento',
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_content text,
  utm_term text,
  referrer text,
  user_agent text,
  ip_hash text,             -- hash (nao o IP cru) por LGPD
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_chat_sessions_bitrix_deal_id on chat_sessions (bitrix_deal_id);
create index if not exists idx_chat_sessions_persona on chat_sessions (persona);
create index if not exists idx_chat_sessions_started_at on chat_sessions (started_at desc);
create index if not exists idx_chat_sessions_resultado on chat_sessions (resultado);
create index if not exists idx_chat_sessions_stage_final on chat_sessions (stage_final);

-- ---------------------------------------------------------------------
-- chat_messages: 1 registro por mensagem trocada (user/ai)
-- ---------------------------------------------------------------------
create table if not exists chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references chat_sessions(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  kind text not null default 'text', -- 'text' | 'file' | 'card'
  metadata jsonb,          -- ex: { fileName, mimeType, extraido, resultado } quando kind = 'file'
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_session_id on chat_messages (session_id, created_at);

-- ---------------------------------------------------------------------
-- integration_events: 1 registro por chamada a servico externo
-- ---------------------------------------------------------------------
create table if not exists integration_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references chat_sessions(id) on delete set null,
  service text not null check (service in ('bitrix', 'meta_capi', 'infosimples', 'openai', 'rag_webhook')),
  operation text not null,         -- ex: 'crm.deal.add', 'crm.timeline.comment.add', 'consulta_cpf', 'chat_completion'
  status text not null check (status in ('success', 'error')),
  http_status int,
  latency_ms int,
  error_message text,
  request_summary jsonb,           -- payload resumido (nunca o base64 do arquivo inteiro)
  response_summary jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_integration_events_session_id on integration_events (session_id);
create index if not exists idx_integration_events_service on integration_events (service);
create index if not exists idx_integration_events_created_at on integration_events (created_at desc);
create index if not exists idx_integration_events_status on integration_events (status);
create index if not exists idx_integration_events_service_status_created on integration_events (service, status, created_at desc);

-- ---------------------------------------------------------------------
-- trigger simples para updated_at em chat_sessions
-- ---------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_chat_sessions_updated_at on chat_sessions;
create trigger trg_chat_sessions_updated_at
  before update on chat_sessions
  for each row execute function set_updated_at();
