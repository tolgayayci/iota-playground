# IOTA Playground Backend

Backend service for IOTA Playground - handles Move smart contract compilation and deployment on the IOTA network.

## Features

- Move smart contract compilation
- Deployment to IOTA testnet/mainnet
- Project management API
- User authentication via Supabase
- Rate limiting and security measures

## Prerequisites

- Node.js 18+
- IOTA CLI installed (`curl -L https://github.com/iotaledger/iota/releases/latest/download/iota -o iota`)
- PostgreSQL database (via Supabase)

## Installation

1. Install dependencies:
```bash
cd backend
npm install
```

2. Copy environment variables:
```bash
cp .env.example .env
```

3. Configure your `.env` file with:
   - Supabase credentials
   - IOTA network configuration
   - API keys

## Running the Backend

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## API Endpoints

### Health Check
- `GET /api/health` - Check service health

### Projects
- `GET /api/projects` - List user projects
- `GET /api/projects/:id` - Get project details
- `POST /api/projects` - Create new project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete project
- `GET /api/projects/templates/list` - Get template projects

### Compilation
- `POST /api/compile` - Compile Move code
  ```json
  {
    "project_id": "uuid",
    "code": "module hello {...}"
  }
  ```

### Deployment
- `POST /api/deploy` - Deploy to IOTA
  ```json
  {
    "project_id": "uuid",
    "network": "testnet"
  }
  ```
- `GET /api/deploy/history/:projectId` - Get deployment history

## Authentication

All API endpoints (except health) require a Bearer token from Supabase Auth:
```
Authorization: Bearer <supabase_access_token>
```

## Rate Limits

- General API: 100 requests per 15 minutes
- Compilation: 10 requests per minute
- Deployment: 5 requests per minute

## Development

### Linting
```bash
npm run lint
```

### Testing
```bash
npm test
```

### Format Code
```bash
npm run format
```

## Architecture

```
backend/
├── src/
│   ├── config/        # Configuration files
│   ├── middleware/    # Express middleware
│   ├── routes/        # API routes
│   ├── services/      # Business logic
│   └── index.ts       # Entry point
├── tests/            # Test files
└── scripts/          # Utility scripts
```

## Security

- Helmet.js for security headers
- Rate limiting on all endpoints
- Input validation with Joi
- SQL injection protection via Supabase
- Authentication required for all operations

## Deployment

The backend can be deployed to any Node.js hosting service:
- Railway
- Render
- Heroku
- AWS EC2/ECS
- Google Cloud Run
- Digital Ocean App Platform

Make sure to:
1. Set all environment variables
2. Install IOTA CLI on the server
3. Configure proper CORS origins
4. Set up SSL/TLS certificates