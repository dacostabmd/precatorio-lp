-- RLS habilitado e restritivo. O app acessa exclusivamente via service role key
-- (que ignora RLS por definicao no Supabase), entao estas policies so importam
-- se alguem um dia usar a anon/authenticated key contra essas tabelas.
alter table chat_sessions enable row level security;
alter table chat_messages enable row level security;
alter table integration_events enable row level security;

-- Nenhuma policy criada para anon/authenticated = deny-all implicito.
