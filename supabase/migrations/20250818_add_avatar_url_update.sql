-- Migration to ensure avatar_url column exists and update existing users
-- This migration helps populate GitHub avatar URLs for existing users

-- 1. Ensure avatar_url column exists (idempotent)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Create a function to extract and update avatar URL from auth metadata
CREATE OR REPLACE FUNCTION update_user_avatar_from_auth()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if the user has GitHub identity and extract avatar URL
  IF NEW.raw_user_meta_data->>'avatar_url' IS NOT NULL THEN
    UPDATE users 
    SET avatar_url = NEW.raw_user_meta_data->>'avatar_url'
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger to update avatar on auth changes (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_user_avatar_on_auth_change'
  ) THEN
    CREATE TRIGGER update_user_avatar_on_auth_change
      AFTER INSERT OR UPDATE ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION update_user_avatar_from_auth();
  END IF;
END $$;

-- 4. Backfill avatar URLs for existing users from auth metadata
UPDATE users u
SET avatar_url = au.raw_user_meta_data->>'avatar_url'
FROM auth.users au
WHERE u.id = au.id
  AND au.raw_user_meta_data->>'avatar_url' IS NOT NULL
  AND (u.avatar_url IS NULL OR u.avatar_url = '');

-- 5. Add index for performance
CREATE INDEX IF NOT EXISTS idx_users_avatar_url ON users(avatar_url);

-- 6. Refresh schema
NOTIFY pgrst, 'reload schema';