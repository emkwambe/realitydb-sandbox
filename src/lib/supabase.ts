import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.info(
    '[RealityDB] Supabase not configured. Auth and progress features are disabled.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
