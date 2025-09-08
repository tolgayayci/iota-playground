-- Add source_code column to deployed_contracts table
-- This stores the actual Move source code that was deployed

ALTER TABLE deployed_contracts 
ADD COLUMN source_code TEXT;

-- Add comment to explain the purpose
COMMENT ON COLUMN deployed_contracts.source_code IS 'The Move source code that was deployed for this contract. Preserved to show the exact code that was compiled and deployed, even if the project code changes later.';