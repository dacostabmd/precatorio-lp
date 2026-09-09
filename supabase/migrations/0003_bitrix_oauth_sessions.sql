create table if not exists bitrix_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  bitrix_member_id text not null unique, -- identifica o portal Bitrix (member_id do OAuth)
  bitrix_user_id bigint,
  domain text not null,                  -- ex: suaempresa.bitrix24.com.br
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scope text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bitrix_oauth_tokens enable row level security;
-- deny-all implicito de novo; so service role toca essa tabela.

drop trigger if exists trg_bitrix_oauth_tokens_updated_at on bitrix_oauth_tokens;
create trigger trg_bitrix_oauth_tokens_updated_at
  before update on bitrix_oauth_tokens
  for each row execute function set_updated_at();
