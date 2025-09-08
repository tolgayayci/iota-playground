-- Create external_packages table for PTB Builder
CREATE TABLE IF NOT EXISTS external_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  package_id TEXT NOT NULL,
  network TEXT NOT NULL CHECK (network IN ('testnet', 'mainnet', 'devnet')),
  package_name TEXT, -- Optional friendly name
  description TEXT, -- Optional description
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_used TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}', -- For storing additional data like ABI if needed
  
  -- Ensure unique package per project and network
  CONSTRAINT unique_package_per_project_network UNIQUE (project_id, package_id, network)
);

-- Add RLS policies for external_packages
ALTER TABLE external_packages ENABLE ROW LEVEL SECURITY;

-- Users can only see their own external packages
CREATE POLICY "Users can view their own external packages" ON external_packages
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own external packages
CREATE POLICY "Users can add external packages" ON external_packages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own external packages
CREATE POLICY "Users can update their own external packages" ON external_packages
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own external packages
CREATE POLICY "Users can delete their own external packages" ON external_packages
  FOR DELETE USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_external_packages_project_id ON external_packages(project_id);
CREATE INDEX idx_external_packages_package_id ON external_packages(package_id);
CREATE INDEX idx_external_packages_user_id ON external_packages(user_id);
CREATE INDEX idx_external_packages_network ON external_packages(network);