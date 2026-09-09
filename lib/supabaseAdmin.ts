import { createClient, SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;
let warned = false;

export function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    if (!warned) {
      console.warn('[supabase] SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes - observabilidade desativada.');
      warned = true;
    }
    return null;
  }

  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false } });
  }

  return client;
}
