-- Create compilation_history table
CREATE TABLE IF NOT EXISTS compilation_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_snapshot TEXT NOT NULL,
    result JSONB,
    status TEXT CHECK (status IN ('success', 'error', 'pending')),
    exit_code INTEGER,
    stdout TEXT,
    stderr TEXT,
    abi JSONB,
    error_type TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_compilation_history_project_id ON compilation_history(project_id);
CREATE INDEX IF NOT EXISTS idx_compilation_history_user_id ON compilation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_compilation_history_created_at ON compilation_history(created_at DESC);

-- Enable RLS
ALTER TABLE compilation_history ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own compilation history"
    ON compilation_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own compilation history"
    ON compilation_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own compilation history"
    ON compilation_history FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own compilation history"
    ON compilation_history FOR DELETE
    USING (auth.uid() = user_id);