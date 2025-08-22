import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from './config';

export const supabase = createClient(
  SUPABASE_CONFIG.url,
  SUPABASE_CONFIG.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storageKey: 'iota-playground-auth',
      storage: window.localStorage,
    },
    global: {
      headers: {
        'X-Client-Info': 'iota-playground-web',
      },
    },
  }
);