-- Add wallet metadata columns to deployed_contracts
ALTER TABLE deployed_contracts 
ADD COLUMN IF NOT EXISTS wallet_type text DEFAULT 'playground' CHECK (wallet_type IN ('playground', 'external')),
ADD COLUMN IF NOT EXISTS deployer_address text;

-- Update existing deployments - set all to playground for now
UPDATE deployed_contracts 
SET wallet_type = 'playground' 
WHERE wallet_type IS NULL;

-- Add comment for clarity
COMMENT ON COLUMN deployed_contracts.wallet_type IS 'Type of wallet used for deployment: playground (backend) or external (user wallet)';
COMMENT ON COLUMN deployed_contracts.deployer_address IS 'Address of the wallet that deployed the contract';