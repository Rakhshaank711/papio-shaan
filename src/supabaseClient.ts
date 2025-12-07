import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Debug log for environment wiring (remove or comment out for production).
console.log('VITE_SUPABASE_URL =', SUPABASE_URL);
console.log('VITE_SUPABASE_ANON_KEY =', SUPABASE_KEY ? `${SUPABASE_KEY.slice(0, 6)}...` : undefined);

export const supabaseEnabled = Boolean(SUPABASE_URL && SUPABASE_KEY);

export const supabase: SupabaseClient | null = supabaseEnabled
  ? createClient(SUPABASE_URL!, SUPABASE_KEY!)
  : null;
