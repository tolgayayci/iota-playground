-- Fix users table to properly reference auth.users
-- The id should match the auth.users id, not be auto-generated

-- First, drop the default value for the id column
ALTER TABLE users ALTER COLUMN id DROP DEFAULT;

-- Add a foreign key constraint to auth.users if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'users_id_fkey'
  ) THEN
    ALTER TABLE users 
    ADD CONSTRAINT users_id_fkey 
    FOREIGN KEY (id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure the users table can properly accept auth user IDs
COMMENT ON COLUMN users.id IS 'References auth.users.id - must match the authenticated user ID';

-- Refresh the schema
NOTIFY pgrst, 'reload schema';