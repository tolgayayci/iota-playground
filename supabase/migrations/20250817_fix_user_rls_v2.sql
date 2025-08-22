-- Fix RLS policies for users table to allow authenticated users to create their own records
-- This version properly handles existing policies

-- First, drop ALL existing policies for users table
DO $$ 
BEGIN
    -- Drop all policies on users table
    DROP POLICY IF EXISTS "Users can read own data" ON users;
    DROP POLICY IF EXISTS "Users can update own data" ON users;
    DROP POLICY IF EXISTS "Users can create their own profile" ON users;
    DROP POLICY IF EXISTS "Users can insert their own record" ON users;
    DROP POLICY IF EXISTS "Users can view their own record" ON users;
    DROP POLICY IF EXISTS "Users can update their own record" ON users;
END $$;

-- Create new policies for users table
CREATE POLICY "Users can insert their own record" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can view their own record" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own record" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Drop ALL existing policies for projects table
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can CRUD own projects" ON projects;
    DROP POLICY IF EXISTS "Users can create projects" ON projects;
    DROP POLICY IF EXISTS "Users can view own projects" ON projects;
    DROP POLICY IF EXISTS "Users can update own projects" ON projects;
    DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
END $$;

-- Create new policies for projects table
CREATE POLICY "Users can create projects" ON projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own projects" ON projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON projects
  FOR DELETE USING (auth.uid() = user_id);

-- Drop ALL existing policies for deployed_contracts table
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can CRUD own contracts" ON deployed_contracts;
    DROP POLICY IF EXISTS "Users can insert contracts" ON deployed_contracts;
    DROP POLICY IF EXISTS "Users can view own contracts" ON deployed_contracts;
    DROP POLICY IF EXISTS "Users can update own contracts" ON deployed_contracts;
    DROP POLICY IF EXISTS "Users can delete own contracts" ON deployed_contracts;
END $$;

-- Create new policies for deployed_contracts table
CREATE POLICY "Users can insert contracts" ON deployed_contracts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own contracts" ON deployed_contracts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own contracts" ON deployed_contracts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own contracts" ON deployed_contracts
  FOR DELETE USING (auth.uid() = user_id);

-- Drop ALL existing policies for ptb_history table
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Users can CRUD own history" ON ptb_history;
    DROP POLICY IF EXISTS "Users can insert history" ON ptb_history;
    DROP POLICY IF EXISTS "Users can view own history" ON ptb_history;
    DROP POLICY IF EXISTS "Users can delete own history" ON ptb_history;
END $$;

-- Create new policies for ptb_history table
CREATE POLICY "Users can insert history" ON ptb_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own history" ON ptb_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own history" ON ptb_history
  FOR DELETE USING (auth.uid() = user_id);