import { createClient } from '@supabase/supabase-js';

export const supabaseUrl: string = import.meta.env.VITE_SUPABASE_URL;
export const supabaseAnonKey: string = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
