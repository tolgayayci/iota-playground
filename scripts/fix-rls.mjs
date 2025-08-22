import { createClient } from '@supabase/supabase-js';

// Supabase credentials
const supabaseUrl = 'https://jsbiywkhjfxgwwbyubfc.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpzYml5d2toamZ4Z3d3Ynl1YmZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU0MjExMTUsImV4cCI6MjA3MDk5NzExNX0.e-B_tQMV-J1t6onAbKSyY8qDCsbkLKjt99T_pompbyg';

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔧 RLS Policy Fix Instructions for IOTA Playground\n');
console.log('═══════════════════════════════════════════════════\n');
console.log('The Row Level Security policies need to be updated to allow user authentication.\n');
console.log('Please follow these steps:\n');
console.log('1. Go to Supabase Dashboard:');
console.log('   https://supabase.com/dashboard/project/jsbiywkhjfxgwwbyubfc/sql/new\n');
console.log('2. Copy and paste the following SQL:\n');
console.log('─────────────────────────────────────────');

const sqlCommands = `
-- Fix RLS policies for users table to allow authenticated users to create their own records

-- Drop existing policies that might be causing issues
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Users can update own data" ON users;
DROP POLICY IF EXISTS "Users can create their own profile" ON users;

-- Create new policies with proper permissions
CREATE POLICY "Users can insert their own record" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own record" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own record" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Fix RLS policies for projects table
DROP POLICY IF EXISTS "Users can CRUD own projects" ON projects;

CREATE POLICY "Users can create projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);
`;

console.log(sqlCommands);
console.log('─────────────────────────────────────────\n');
console.log('3. Click "Run" to execute the SQL\n');
console.log('4. After running, you should be able to log in with GitHub OAuth\n');
console.log('✅ That\'s it! The authentication should work properly now.\n');