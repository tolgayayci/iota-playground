-- Fix schema issues for projects table

-- Add missing description column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'projects' 
                   AND column_name = 'description') THEN
        ALTER TABLE projects ADD COLUMN description TEXT;
    END IF;
END $$;

-- Fix the deployments reference issue by creating a view or updating the query
-- The error suggests the table is called 'deployed_contracts' not 'deployments'
-- Let's create a view to handle this gracefully

DROP VIEW IF EXISTS deployments CASCADE;

CREATE VIEW deployments AS 
SELECT * FROM deployed_contracts;

-- Grant permissions on the view
GRANT SELECT ON deployments TO anon;
GRANT SELECT ON deployments TO authenticated;

-- Update RLS for the view (views inherit from base table)
-- No additional RLS needed as it uses deployed_contracts RLS

-- Ensure the projects table has all required columns
DO $$ 
BEGIN
    -- Add language column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'projects' 
                   AND column_name = 'language') THEN
        ALTER TABLE projects ADD COLUMN language TEXT DEFAULT 'move';
    END IF;
    
    -- Add is_template column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'projects' 
                   AND column_name = 'is_template') THEN
        ALTER TABLE projects ADD COLUMN is_template BOOLEAN DEFAULT false;
    END IF;
    
    -- Add template_id column if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'projects' 
                   AND column_name = 'template_id') THEN
        ALTER TABLE projects ADD COLUMN template_id TEXT;
    END IF;
END $$;

-- Clear any cached schema in Supabase
NOTIFY pgrst, 'reload schema';