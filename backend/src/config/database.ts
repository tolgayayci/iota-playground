import { createClient } from '@supabase/supabase-js';

// Lazy initialization of Supabase client
let supabaseClient: any = null;
let supabaseInitialized = false;

function initSupabase() {
  if (supabaseInitialized) return supabaseClient;
  
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
  
  
  if (supabaseUrl && supabaseServiceKey) {
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } else {
    supabaseClient = null;
  }
  
  supabaseInitialized = true;
  return supabaseClient;
}

// Export a proxy that initializes on first access
export const supabase = new Proxy({}, {
  get(target, prop) {
    const client = initSupabase();
    if (!client) {
      throw new Error('Supabase client not initialized - check environment variables');
    }
    return client[prop];
  }
});

// Check configuration on first use
export function checkSupabaseConfig() {
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase configuration');
    console.warn('Please set SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env file');
    // For development, continue without Supabase
    if (process.env.NODE_ENV === 'development') {
      console.warn('Running in development mode without complete Supabase configuration');
      return false;
    } else {
      process.exit(1);
    }
  }
  return true;
}

// Database types
export interface Project {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  code: string;
  language: string;
  is_template: boolean;
  created_at: string;
  updated_at: string;
  last_compiled_at?: string;
  last_compilation_result?: any;
}

export interface DeployedContract {
  id: string;
  project_id: string;
  user_id: string;
  contract_address: string;
  package_id?: string;
  module_ids?: string[];
  abi: any;
  network: string;
  transaction_hash: string;
  gas_used?: number;
  created_at: string;
}