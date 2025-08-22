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

-- Fix RLS policies for deployed_contracts table  
DROP POLICY IF EXISTS "Users can CRUD own contracts" ON deployed_contracts;

CREATE POLICY "Users can insert contracts" ON deployed_contracts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own contracts" ON deployed_contracts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own contracts" ON deployed_contracts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contracts" ON deployed_contracts
  FOR DELETE USING (auth.uid() = user_id);

-- Fix RLS policies for ptb_history table
DROP POLICY IF EXISTS "Users can CRUD own history" ON ptb_history;

CREATE POLICY "Users can insert history" ON ptb_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own history" ON ptb_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own history" ON ptb_history
  FOR DELETE USING (auth.uid() = user_id);