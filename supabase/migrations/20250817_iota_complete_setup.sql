/*
  # IOTA Playground Complete Database Setup
  
  This is the complete database schema for IOTA Playground.
  Includes all tables, policies, and initial data needed.

  1. Core Tables
    - users: User accounts
    - projects: Move/Rust projects
    - deployed_contracts: Deployed Move modules
    - ptb_history: PTB execution history
    - move_templates: Project templates

  2. Security
    - RLS enabled on all tables
    - Proper policies for authenticated users
*/

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  username text UNIQUE,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create projects table with IOTA support
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  code text NOT NULL DEFAULT '',
  language text DEFAULT 'move' CHECK (language IN ('move', 'rust')),
  network text DEFAULT 'testnet' CHECK (network IN ('testnet', 'mainnet', 'devnet')),
  move_toml text,
  deployed_modules jsonb DEFAULT '[]'::jsonb,
  ptb_templates jsonb DEFAULT '[]'::jsonb,
  last_compilation jsonb,
  last_deployment jsonb,
  package_id text,
  module_address text,
  is_public boolean DEFAULT false,
  share_id text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_name CHECK (char_length(name) > 0)
);

-- Create deployed_contracts table
CREATE TABLE IF NOT EXISTS deployed_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  module_address text NOT NULL,
  package_id text NOT NULL,
  module_name text NOT NULL,
  network text NOT NULL CHECK (network IN ('testnet', 'mainnet', 'devnet')),
  abi jsonb NOT NULL,
  transaction_hash text NOT NULL,
  gas_used bigint,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_deployment UNIQUE (package_id, network)
);

-- Create PTB history table
CREATE TABLE IF NOT EXISTS ptb_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  ptb_config jsonb NOT NULL,
  execution_result jsonb,
  network text NOT NULL CHECK (network IN ('testnet', 'mainnet', 'devnet')),
  transaction_hash text,
  gas_used bigint,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  created_at timestamptz DEFAULT now()
);

-- Create Move templates table
CREATE TABLE IF NOT EXISTS move_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  category text NOT NULL,
  code text NOT NULL,
  move_toml text NOT NULL,
  dependencies jsonb DEFAULT '[]'::jsonb,
  tags text[] DEFAULT '{}',
  is_official boolean DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_template_name CHECK (char_length(name) > 0)
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE deployed_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ptb_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE move_templates ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read own data"
  ON users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own data"
  ON users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Projects policies
CREATE POLICY "Users can read own projects"
  ON projects
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can read public projects"
  ON projects
  FOR SELECT
  TO public
  USING (is_public = true);

CREATE POLICY "Users can create own projects"
  ON projects
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects"
  ON projects
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects"
  ON projects
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Deployed contracts policies
CREATE POLICY "Users can view own deployed contracts"
  ON deployed_contracts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own deployed contracts"
  ON deployed_contracts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own deployed contracts"
  ON deployed_contracts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own deployed contracts"
  ON deployed_contracts
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- PTB history policies
CREATE POLICY "Users can view own PTB history"
  ON ptb_history
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own PTB history"
  ON ptb_history
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own PTB history"
  ON ptb_history
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Move templates policies
CREATE POLICY "Anyone can view official templates"
  ON move_templates
  FOR SELECT
  TO public
  USING (is_official = true);

CREATE POLICY "Users can view own templates"
  ON move_templates
  FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Users can create own templates"
  ON move_templates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by AND is_official = false);

CREATE POLICY "Users can update own templates"
  ON move_templates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by AND is_official = false)
  WITH CHECK (auth.uid() = created_by AND is_official = false);

CREATE POLICY "Users can delete own templates"
  ON move_templates
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by AND is_official = false);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_language ON projects(language);
CREATE INDEX IF NOT EXISTS idx_projects_network ON projects(network);
CREATE INDEX IF NOT EXISTS idx_projects_package_id ON projects(package_id);
CREATE INDEX IF NOT EXISTS idx_projects_share_id ON projects(share_id);

CREATE INDEX IF NOT EXISTS idx_deployed_contracts_user_id ON deployed_contracts(user_id);
CREATE INDEX IF NOT EXISTS idx_deployed_contracts_project_id ON deployed_contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_deployed_contracts_network ON deployed_contracts(network);
CREATE INDEX IF NOT EXISTS idx_deployed_contracts_package_id ON deployed_contracts(package_id);

CREATE INDEX IF NOT EXISTS idx_ptb_history_user_id ON ptb_history(user_id);
CREATE INDEX IF NOT EXISTS idx_ptb_history_project_id ON ptb_history(project_id);
CREATE INDEX IF NOT EXISTS idx_ptb_history_network ON ptb_history(network);
CREATE INDEX IF NOT EXISTS idx_ptb_history_status ON ptb_history(status);

CREATE INDEX IF NOT EXISTS idx_move_templates_category ON move_templates(category);
CREATE INDEX IF NOT EXISTS idx_move_templates_is_official ON move_templates(is_official);
CREATE INDEX IF NOT EXISTS idx_move_templates_tags ON move_templates USING gin(tags);

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create update triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE
  ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE
  ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_deployed_contracts_updated_at BEFORE UPDATE
  ON deployed_contracts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_move_templates_updated_at BEFORE UPDATE
  ON move_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default Move templates
INSERT INTO move_templates (name, description, category, code, move_toml, is_official, tags)
VALUES 
  (
    'Hello World',
    'A simple Move module to get started',
    'Basic',
    '// A simple Hello World module in Move
module hello_world::greetings {
    use std::string::{Self, String};
    use sui::event;

    // Event emitted when someone is greeted
    public struct GreetingEvent has copy, drop {
        name: String,
        message: String,
    }

    // Function to greet someone
    public fun greet(name: String): String {
        let message = string::utf8(b"Hello, ");
        string::append(&mut message, name);
        string::append(&mut message, string::utf8(b"!"));
        
        event::emit(GreetingEvent {
            name,
            message,
        });
        
        message
    }

    #[test]
    fun test_greet() {
        let name = string::utf8(b"IOTA");
        let greeting = greet(name);
        assert!(greeting == string::utf8(b"Hello, IOTA!"), 0);
    }
}',
    '[package]
name = "hello_world"
version = "0.0.1"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/iotaledger/iota.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
hello_world = "0x0"',
    true,
    ARRAY['beginner', 'tutorial', 'events']
  ),
  (
    'NFT Collection',
    'Create and manage an NFT collection on IOTA',
    'NFT',
    '// NFT Collection module for IOTA
module nft_collection::collection {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use std::string::{Self, String};
    use sui::event;

    // NFT struct
    public struct NFT has key, store {
        id: UID,
        name: String,
        description: String,
        url: String,
        attributes: vector<Attribute>,
    }

    public struct Attribute has store, copy, drop {
        trait_type: String,
        value: String,
    }

    // Events
    public struct NFTMinted has copy, drop {
        id: address,
        name: String,
        recipient: address,
    }

    // Mint a new NFT
    public fun mint(
        name: String,
        description: String,
        url: String,
        attributes: vector<Attribute>,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let nft = NFT {
            id: object::new(ctx),
            name,
            description,
            url,
            attributes,
        };

        let nft_id = object::uid_to_address(&nft.id);
        
        event::emit(NFTMinted {
            id: nft_id,
            name: nft.name,
            recipient,
        });

        transfer::transfer(nft, recipient);
    }

    // Transfer NFT
    public fun transfer_nft(nft: NFT, recipient: address) {
        transfer::transfer(nft, recipient);
    }

    // Get NFT details
    public fun get_name(nft: &NFT): &String {
        &nft.name
    }

    public fun get_description(nft: &NFT): &String {
        &nft.description
    }

    public fun get_url(nft: &NFT): &String {
        &nft.url
    }
}',
    '[package]
name = "nft_collection"
version = "0.0.1"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/iotaledger/iota.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
nft_collection = "0x0"',
    true,
    ARRAY['nft', 'collection', 'digital-assets']
  ),
  (
    'Token Contract',
    'A fungible token implementation',
    'DeFi',
    '// Fungible Token module for IOTA
module fungible_token::token {
    use sui::coin::{Self, Coin, TreasuryCap};
    use sui::tx_context::{Self, TxContext};

    // Token witness
    public struct TOKEN has drop {}

    // Initialize the token
    fun init(witness: TOKEN, ctx: &mut TxContext) {
        let (treasury_cap, metadata) = coin::create_currency(
            witness, 
            9, // decimals
            b"TOKEN", // symbol
            b"Example Token", // name
            b"An example fungible token on IOTA", // description
            option::none(), // icon url
            ctx
        );

        transfer::public_freeze_object(metadata);
        transfer::public_transfer(treasury_cap, tx_context::sender(ctx));
    }

    // Mint new tokens
    public fun mint(
        treasury_cap: &mut TreasuryCap<TOKEN>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        coin::mint_and_transfer(treasury_cap, amount, recipient, ctx);
    }

    // Burn tokens
    public fun burn(
        treasury_cap: &mut TreasuryCap<TOKEN>,
        coin: Coin<TOKEN>
    ) {
        coin::burn(treasury_cap, coin);
    }
}',
    '[package]
name = "fungible_token"
version = "0.0.1"
edition = "2024.beta"

[dependencies]
Sui = { git = "https://github.com/iotaledger/iota.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
fungible_token = "0x0"',
    true,
    ARRAY['defi', 'token', 'fungible']
  )
ON CONFLICT DO NOTHING;

-- Create storage bucket for avatars
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for avatars
CREATE POLICY "Users can upload their own avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (regexp_split_to_array(name, '/'))[1]
);

CREATE POLICY "Anyone can view avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');

CREATE POLICY "Users can update their own avatars"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (regexp_split_to_array(name, '/'))[1]
)
WITH CHECK (
  bucket_id = 'avatars' AND
  auth.uid()::text = (regexp_split_to_array(name, '/'))[1]
);

CREATE POLICY "Users can delete their own avatars"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND
  auth.uid()::text = (regexp_split_to_array(name, '/'))[1]
);

-- Add comments for documentation
COMMENT ON TABLE users IS 'User accounts for IOTA Playground';
COMMENT ON TABLE projects IS 'Move and Rust projects created by users';
COMMENT ON TABLE deployed_contracts IS 'Deployed Move modules on IOTA';
COMMENT ON TABLE ptb_history IS 'Programmable Transaction Block execution history';
COMMENT ON TABLE move_templates IS 'Project templates for quick start';
COMMENT ON COLUMN projects.language IS 'Programming language: move or rust';
COMMENT ON COLUMN projects.network IS 'IOTA network: testnet, mainnet, or devnet';
COMMENT ON COLUMN projects.move_toml IS 'Move.toml configuration content';
COMMENT ON COLUMN projects.deployed_modules IS 'JSON array of deployed module information';
COMMENT ON COLUMN projects.ptb_templates IS 'Saved PTB configurations for reuse';