import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente de Supabase. Se configura con .env.local (no se sube a git):
 *   VITE_SUPABASE_URL=https://<proyecto>.supabase.co
 *   VITE_SUPABASE_ANON_KEY=<anon key>
 * Si faltan, `supabase` queda undefined y la app sigue con los datos de ejemplo en memoria.
 */
const url = import.meta.env?.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | undefined = url && anonKey ? createClient(url, anonKey) : undefined;
