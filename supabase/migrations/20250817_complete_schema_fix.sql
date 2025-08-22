-- Complete schema fix for IOTA Playground

-- 1. Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;

-- 2. Ensure projects table has all required columns
ALTER TABLE projects ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'move';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS is_template BOOLEAN DEFAULT false;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS template_id TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_compiled_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS last_compilation_result JSONB;

-- 3. Create deployments view if not exists
DROP VIEW IF EXISTS deployments CASCADE;
CREATE VIEW deployments AS 
SELECT 
  id,
  project_id,
  user_id,
  contract_address,
  abi,
  created_at,
  network,
  transaction_hash,
  gas_used
FROM deployed_contracts;

-- Grant permissions on the view
GRANT SELECT ON deployments TO anon;
GRANT SELECT ON deployments TO authenticated;
GRANT INSERT ON deployments TO authenticated;
GRANT UPDATE ON deployments TO authenticated;
GRANT DELETE ON deployments TO authenticated;

-- 4. Update RLS policies for projects table (fix any missing ones)
DO $$ 
BEGIN
    -- Drop existing policies to avoid conflicts
    DROP POLICY IF EXISTS "Users can create projects" ON projects;
    DROP POLICY IF EXISTS "Users can view own projects" ON projects;
    DROP POLICY IF EXISTS "Users can update own projects" ON projects;
    DROP POLICY IF EXISTS "Users can delete own projects" ON projects;
    
    -- Create clean policies
    CREATE POLICY "Users can create projects" ON projects
      FOR INSERT WITH CHECK (auth.uid() = user_id);
    
    CREATE POLICY "Users can view own projects" ON projects
      FOR SELECT USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can update own projects" ON projects
      FOR UPDATE USING (auth.uid() = user_id);
    
    CREATE POLICY "Users can delete own projects" ON projects
      FOR DELETE USING (auth.uid() = user_id);
END $$;

-- 5. Ensure users table has proper RLS
DO $$ 
BEGIN
    -- Drop existing policies
    DROP POLICY IF EXISTS "Users can insert their own record" ON users;
    DROP POLICY IF EXISTS "Users can view their own record" ON users;
    DROP POLICY IF EXISTS "Users can update their own record" ON users;
    
    -- Create new policies
    CREATE POLICY "Users can insert their own record" ON users
      FOR INSERT WITH CHECK (auth.uid() = id);
    
    CREATE POLICY "Users can view their own record" ON users
      FOR SELECT USING (auth.uid() = id);
    
    CREATE POLICY "Users can update their own record" ON users
      FOR UPDATE USING (auth.uid() = id);
END $$;

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_deployed_contracts_user_id ON deployed_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_deployed_contracts_project_id ON deployed_contracts(project_id);

-- 7. Refresh the schema cache
NOTIFY pgrst, 'reload schema';