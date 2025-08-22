# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

IOTA Playground is a browser-based IDE for developing Move smart contracts on the IOTA blockchain. Originally forked from Wizard (Arbitrum Stylus IDE), it has been adapted to provide a zero-setup environment for writing, compiling, and deploying Move-based smart contracts directly in the browser.

**Current Status:** Transitioning from Arbitrum Stylus (Rust) to IOTA Move development platform.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server (runs on port 5173)
npm run dev

# Build for production
npm run build

# Run linter
npm run lint

# Preview production build
npm run preview

# Documentation commands
npm run docs:dev     # Start VitePress documentation server
npm run docs:build   # Build documentation
npm run docs:preview # Preview built documentation
```

## Architecture

### Tech Stack
- **Frontend**: React 18 with TypeScript, Vite build system
- **Backend**: Express.js with TypeScript, rate limiting, security middleware
- **Routing**: React Router v6 with protected routes
- **Styling**: Tailwind CSS with shadcn/ui components, next-themes
- **Editor**: Monaco Editor with custom Move language support
- **State Management**: React Context (Auth, Wallet) + React Query for API caching
- **Authentication**: Supabase Auth (GitHub OAuth, Magic Links)
- **Database**: PostgreSQL via Supabase with Row Level Security (RLS)
- **Blockchain SDK**: @iota/iota-sdk v1.1.1 (IOTA TypeScript SDK)
- **Smart Contracts**: IOTA Move (Move → Bytecode compilation)

### Key Directories

**Frontend (`src/`)**
- `src/pages/` - Main application pages
  - `LandingPage.tsx` - Public landing page with marketing content
  - `ProjectsPage.tsx` - User's project dashboard (protected)
  - `EditorPage.tsx` - IDE interface with split-pane layout (protected)
  - `AuthCallbackPage.tsx` - OAuth callback handler
- `src/components/` - Reusable React components
  - `ui/` - 30+ shadcn/ui base components
  - `editor/` - Monaco editor with Move syntax highlighting
  - `views/` - Main view components (Compiler, Module Interface, PTB Builder)
  - `module-interface/` - Contract interaction UI components
  - `projects/` - Project management components
- `src/contexts/` - React Context providers
  - `AuthContext.tsx` - Supabase authentication state
  - `WalletContext.tsx` - IOTA wallet integration (playground + external)
- `src/lib/` - Core utilities and services
  - `api.ts` - Backend API communication with JWT injection
  - `supabase.ts` - Supabase client with auto-refresh
  - `deployV2.ts` - IOTA SDK deployment service
  - `templates.ts` - 6 Move project templates
  - `languages/move.ts` - Monaco Move language definition
- `src/hooks/` - Custom React hooks

**Backend (`backend/`)**
- `backend/src/config/` - Configuration management
  - `database.ts` - Supabase client & TypeScript types
  - `iota.ts` - IOTA network & compiler configuration
  - `wallet.ts` - Playground wallet Ed25519 keypair
- `backend/src/middleware/` - Express middleware
  - `authentication.ts` - Supabase JWT verification
  - `rateLimiter.ts` - API rate limiting (compilation: 10/min, deploy: 5/min)
  - `errorHandler.ts` - Custom error handling with AppError class
- `backend/src/routes/` - API endpoint definitions
  - `compile.ts` - Move compilation with `iota move build`
  - `deployV2.ts` - IOTA SDK deployment (playground + external wallets)
  - `projects.ts` - Project CRUD operations
  - `health.ts` - Service health check
- `backend/src/services/` - Business logic layer
  - `compileService.ts` - Move compilation & ABI generation
  - `iotaDeployService.ts` - IOTA SDK transaction building
  - `simulationService.ts` - Deployment simulation & gas estimation

**Database (`supabase/`)**
- `supabase/migrations/` - Database schema evolution
  - `20250817_iota_complete_setup.sql` - Main schema with 5 core tables
  - Row Level Security (RLS) policies for multi-tenant security

### Authentication Flow

**Multi-Provider Authentication:**
- **GitHub OAuth**: Primary authentication method with avatar sync
- **Magic Links**: Email-based authentication fallback
- **Session Management**: Auto-refresh tokens, persistent sessions, cross-tab sync
- **User Provisioning**: Automatic database user creation with starter projects
- **Route Protection**: `ProtectedRoute` wrapper redirects unauthenticated users

**Implementation Details:**
- Supabase Auth handles provider configuration and JWT verification
- User profiles stored in custom `users` table with foreign key to `auth.users`
- GitHub avatars automatically synced via database triggers
- Session key: `'iota-playground-auth'` in localStorage

### API Integration & Backend Services

**Express.js Backend** (Port 3001):
- **Authentication**: Bearer token verification via Supabase JWT
- **Rate Limiting**: Tiered limits (general: 100/15min, compilation: 10/min, deploy: 5/min)
- **Security**: Helmet.js, CORS, input validation with Joi schemas

**Core API Endpoints:**
- **Health**: `GET /api/health` - Service status with database/compiler checks
- **Projects**: Full CRUD via `GET/POST/PUT/DELETE /api/projects`
- **Compilation**: `POST /api/compile` - Move source → bytecode + ABI
- **Deployment**: `POST /api/v2/deploy/*` - Dual wallet support (playground/external)
- **Templates**: `GET /api/projects/templates/list` - Built-in project templates

**IOTA Integration:**
- **Compiler**: `iota move build` via configurable CLI path
- **Networks**: Dynamic testnet/mainnet RPC endpoints
- **Transactions**: IOTA SDK with Ed25519 signing
- **Gas Management**: Simulation and estimation (1 IOTA = 1B units)

### Routing Structure

- `/` - Landing page (public)
- `/projects` - User's projects list (protected)
- `/projects/:id` - Project editor (protected)
- `/projects/:id/shared` - Shared project viewer (public)

## Component Patterns

The project uses:
- Functional components with TypeScript
- Custom hooks in `src/hooks/`
- shadcn/ui components for UI consistency
- Tailwind CSS for styling
- Form handling with react-hook-form and zod validation

## Testing Approach

While no test files are currently present, the project structure suggests:
- Use `npm run lint` for code quality checks
- Manual testing through the development server
- Contract testing through the built-in ABI testing interface

## Database Schema

Comprehensive Supabase PostgreSQL schema with Row Level Security (RLS) for multi-tenant data isolation:

### Core Tables

**`users` Table**
- **Fields**: `id` (uuid, PK), `email`, `username`, `avatar_url`, `name`, `company`, `bio`
- **Security**: RLS policy restricts access to own profile (`auth.uid() = id`)
- **Integration**: Foreign key to `auth.users(id)` with CASCADE delete
- **Features**: GitHub avatar auto-sync via database triggers

**`projects` Table**
- **Core Fields**: `id` (uuid, PK), `user_id`, `name`, `description`, `code`
- **IOTA-Specific**: `language` (move/rust), `network` (testnet/mainnet/devnet)
- **Move Integration**: `move_toml`, `deployed_modules` (jsonb), `ptb_templates` (jsonb)
- **Deployment**: `package_id`, `module_address`, `last_compilation` (jsonb), `last_deployment` (jsonb)
- **Sharing**: `is_public`, `share_id` for public project access
- **Security**: Owner full CRUD, public read for shared projects

**`deployed_contracts` Table**
- **Deployment Tracking**: `package_id`, `module_name`, `network`, `transaction_hash`
- **Performance Data**: `gas_used`, `abi` (jsonb)
- **Constraints**: Unique `(package_id, network)` prevents duplicate deployments
- **Security**: Owner-only access via RLS

**`ptb_history` Table**
- **PTB Execution**: `ptb_config` (jsonb), `execution_result` (jsonb), `status`
- **Network Support**: Multi-network PTB tracking with gas cost analysis
- **Security**: User-scoped access via RLS policies

**`move_templates` Table**
- **Template System**: `name`, `description`, `category`, `code`, `move_toml`
- **Metadata**: `dependencies` (jsonb), `tags` (array), `is_official` flag
- **Security**: Public read for official templates, owner CRUD for custom templates

### Performance Optimizations
- **Indexing**: User ID indexes on all tables, GIN index on template tags
- **Network Indexes**: Optimized queries for deployment filtering
- **Share ID Index**: Fast public project lookups

### Migration Evolution
- `20250817_iota_complete_setup.sql`: Complete IOTA schema with initial templates
- `20250817_complete_schema_fix.sql`: Additional columns and materialized views
- `20250818_fix_users_table_id.sql`: Foreign key constraint fixes
- `20250818_add_avatar_url_update.sql`: GitHub avatar sync triggers

### Storage Buckets
- **`avatars` Bucket**: User profile images with path-based security (`auth.uid()::text = (regexp_split_to_array(name, '/'))[1]`)

## Environment Variables

**Frontend (`.env`)**:
```bash
# Supabase Configuration
VITE_SUPABASE_URL=<supabase-project-url>
VITE_SUPABASE_ANON_KEY=<anon-key>

# Backend API
VITE_API_BASE_URL=http://localhost:3001

# IOTA Network URLs
VITE_IOTA_TESTNET_URL=https://api.testnet.iota.cafe
VITE_IOTA_MAINNET_URL=https://api.mainnet.iota.cafe

# Application Branding
VITE_APP_NAME=IOTA Playground
VITE_GITHUB_URL=https://github.com/your-org/iota-playground
```

**Backend (`.env`)**:
```bash
# Database
SUPABASE_URL=<supabase-project-url>
SUPABASE_SERVICE_KEY=<service-role-key>

# IOTA Configuration
IOTA_NETWORK=testnet
IOTA_NODE_URL=https://api.testnet.iota.cafe
PLAYGROUND_WALLET_PRIVATE_KEY=<ed25519-private-key-base64>
MOVE_COMPILER_PATH=/usr/local/bin/iota

# API Configuration
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development

# Security & Performance
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

## Completed Features

### Authentication & User Management ✅
- **Multi-Provider Auth**: GitHub OAuth (primary) + Magic Links (fallback)
- **Auto-Provisioning**: New users get starter projects (Hello World, Counter)
- **Avatar Integration**: GitHub avatars synced via database triggers
- **Session Management**: Auto-refresh tokens with cross-tab synchronization
- **Route Protection**: Protected routes with automatic redirects

### Wallet Integration ✅
- **Dual Wallet System**: 
  - Playground wallet (Ed25519, backend-managed, testnet-only)
  - External wallets (IOTA dapp-kit, client-side signing)
- **Network Support**: Dynamic testnet/mainnet switching with validation
- **Connection UI**: Header wallet status with address, balance, network indicator
- **State Persistence**: Wallet connection state saved in localStorage

### Smart Contract Development ✅
- **Monaco Editor**: Custom Move language with 80+ keywords, syntax highlighting
- **Real-time Compilation**: `iota move build` with error diagnostics and ANSI color parsing
- **6 Project Templates**: Counter, Fungible Token, NFT Collection, Multi-sig Wallet, Staking Pool, DEX
- **Auto-save**: 1-second debounced saves with optimistic UI updates
- **Code Intelligence**: IntelliSense, bracket matching, indentation rules
- **Theme Support**: Dark/light theme integration

### Advanced IDE Features ✅
- **Module Interface Viewer**: Real-time module fetching with normalized type system
- **PTB Builder**: Visual Programmable Transaction Block creation with 6 command types
- **ABI Generator**: Automatic interface generation from Move source parsing
- **Code Templates**: TypeScript code generation for blockchain interactions

### Deployment System ✅
- **Dual Deployment Modes**:
  - Playground deployment (backend signing, testnet)
  - External wallet deployment (client signing, testnet/mainnet)
- **Transaction Pipeline**: Simulation → Gas estimation → Execution → Confirmation
- **Deployment History**: Database tracking with transaction explorer links
- **Gas Management**: Configurable budgets with 1 IOTA = 1B units conversion
- **Error Handling**: Detailed error messages with retry logic

### Backend Services ✅
- **Express.js API**: TypeScript, rate limiting, security middleware (Helmet, CORS)
- **IOTA SDK Integration**: @iota/iota-sdk v1.1.1 with Ed25519 signing
- **Compilation Service**: Move source → bytecode + ABI via CLI integration
- **Authentication**: Supabase JWT verification with automatic token injection
- **Health Monitoring**: Service status with database/compiler availability checks

## Milestone Development Plan

### Milestone #1: Core Development Environment ($10,000) ✅
- Monaco Editor with Move syntax highlighting ✅
- Real-time error checking and compilation feedback ✅
- IOTA TypeScript SDK integration ✅
- Move.toml configuration editor ✅
- Template-based project creation system ✅
- Split-pane interface with editor, console, and deployment views ✅

### Milestone #2: Wallet Integration & Network Support ($7,000) ✅
- Wallet connection (IOTA Wallet, Sui Wallet, etc.) ✅
- IOTA Playground wallet for testnet development ✅
- Network switching (testnet ↔ mainnet) ✅
- Secure client-side signing (no private key exposure to backend) ✅
- Transaction broadcast and status tracking ✅
- Wallet state management and persistence ✅

### Milestone #3: Build and Deploy System ($8,000) ✅
- Real-time compilation with `iota move build` ✅
- One-click deployment system using connected wallet ✅
- Deploy with playground wallet (backend signing) ✅
- Deploy with external wallet (client signing) ✅
- Transaction simulation and gas estimation ✅
- Bytecode verification ✅
- Deployment history tracking ✅
- Integration with IOTA TypeScript SDK ✅

### Milestone #4: Smart Contract Interaction Interface ($7,000) ✅
- **Auto-generated Contract Interfaces**: Module interface viewer with real-time fetching ✅
- **PTB Support**: Full Programmable Transaction Block creation and execution ✅
- **Real-time Contract State**: Module interface monitoring with normalized types ✅
- **Address Management**: Wallet integration with address/balance display ✅
- **Transaction Signing**: Both playground and external wallet signing ✅
- **Documentation Templates**: 6 comprehensive Move project examples ✅

### Milestone #5: PTB Creation Interface ($8,000) ✅
- **Visual PTB Builder**: Step-by-step command composition interface ✅
- **Command Support**: MoveCall, TransferObjects, SplitCoins, MergeCoins, MakeMoveVec, Publish ✅
- **Reference Management**: Auto-handle input/output references between PTB steps ✅
- **Dynamic Selection**: Module/function selection with ABI parsing and validation ✅
- **Real-time Validation**: Type checking, ownership verification, error detection ✅
- **Simulation**: Preview/dry-run option with gas estimation before execution ✅
- **Multi-Network Execution**: Deploy to testnet/mainnet via connected wallet ✅

## Technical Implementation Summary

### Current Architecture Status
- **Frontend**: React 18 + TypeScript with Monaco editor and shadcn/ui
- **Backend**: Express.js API with IOTA SDK integration and Supabase auth
- **Database**: PostgreSQL with comprehensive RLS security and optimized indexing
- **Blockchain**: Full IOTA Move support with dual wallet system and PTB builder
- **Development Workflow**: Complete IDE with compilation, deployment, and interaction tools

### Performance Optimizations
- **Caching**: React Query for API responses, module interface caching (5-min TTL)
- **Code Splitting**: Route-based lazy loading, Monaco editor dynamic imports
- **Database**: Indexed queries, RLS security, real-time subscriptions
- **Rate Limiting**: Tiered API limits to protect backend resources
- **Bundle**: Vite optimization with tree shaking and asset compression

### Security Measures
- **Authentication**: Multi-provider auth with JWT verification
- **Database**: Row Level Security (RLS) for multi-tenant isolation
- **API**: Rate limiting, input validation, CORS, Helmet security headers
- **Wallet**: Secure key management (playground backend-only, external client-side)
- **Deployment**: Transaction simulation and gas estimation before execution