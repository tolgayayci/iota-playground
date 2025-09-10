#!/bin/bash

# Deploy script for IOTA Playground with automatic SSL via Traefik
# This script sets up Traefik reverse proxy and deploys IOTA Playground with SSL

set -e

echo "======================================"
echo "IOTA Playground SSL Deployment Script"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

# Set deployment directory
DEPLOY_DIR="/root/iota-playground/backend"
WIZARD_DIR="/root/wizard/backend"

# Step 1: Create the proxy network if it doesn't exist
print_status "Creating Docker proxy network..."
docker network create proxy 2>/dev/null || print_warning "Proxy network already exists"

# Step 2: Stop any existing containers using port 80/443
print_status "Checking for services on ports 80 and 443..."
if lsof -Pi :80 -sTCP:LISTEN -t >/dev/null ; then
    print_warning "Port 80 is in use. Stopping Wizard backend..."
    if [ -f "$WIZARD_DIR/docker-compose.yml" ]; then
        cd $WIZARD_DIR
        docker-compose stop || true
    fi
    
    # Kill any remaining processes on port 80
    lsof -ti:80 | xargs -r kill -9 2>/dev/null || true
fi

if lsof -Pi :443 -sTCP:LISTEN -t >/dev/null ; then
    print_warning "Port 443 is in use. Attempting to free it..."
    lsof -ti:443 | xargs -r kill -9 2>/dev/null || true
fi

# Step 3: Deploy Traefik
print_status "Starting Traefik reverse proxy..."
cd $DEPLOY_DIR

# Check if Traefik is already running
if docker ps | grep -q traefik; then
    print_warning "Traefik is already running. Restarting..."
    docker-compose -f traefik-docker-compose.yml down
fi

docker-compose -f traefik-docker-compose.yml up -d

# Wait for Traefik to start
print_status "Waiting for Traefik to initialize..."
sleep 5

# Step 4: Build and deploy IOTA Playground
print_status "Building IOTA Playground Docker image..."
docker-compose build --no-cache

print_status "Starting IOTA Playground backend..."
docker-compose up -d

# Step 5: Check deployment status
print_status "Checking container status..."
echo ""
echo "Running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Step 6: Test the endpoints
print_status "Waiting for services to be ready..."
sleep 10

echo ""
print_status "Testing IOTA Playground API endpoint..."
if curl -s -o /dev/null -w "%{http_code}" https://api.iotaplay.app/api/health | grep -q "200"; then
    print_status "✅ IOTA Playground API is accessible at https://api.iotaplay.app"
else
    print_warning "API might still be initializing. Check in a few moments."
    echo "You can test manually with: curl https://api.iotaplay.app/api/health"
fi

echo ""
echo "======================================"
echo "Deployment Complete!"
echo "======================================"
echo ""
echo "📝 Important Information:"
echo "  - Traefik dashboard: http://your-server-ip:8080 (if enabled)"
echo "  - IOTA API: https://api.iotaplay.app"
echo "  - SSL certificates will be auto-generated on first HTTPS request"
echo ""
echo "📊 Check logs:"
echo "  - Traefik: docker logs traefik"
echo "  - IOTA Backend: docker logs iota-playground-backend"
echo ""
echo "🔧 Useful commands:"
echo "  - View all containers: docker ps -a"
echo "  - Stop IOTA Playground: cd $DEPLOY_DIR && docker-compose down"
echo "  - Restart services: cd $DEPLOY_DIR && docker-compose restart"
echo ""

# Optional: Show Traefik logs for SSL certificate generation
print_status "Monitoring SSL certificate generation (press Ctrl+C to exit)..."
docker logs -f traefik 2>&1 | grep -E "(acme|certificate|letsencrypt)" &
LOGS_PID=$!

# Wait 20 seconds then stop log monitoring
sleep 20
kill $LOGS_PID 2>/dev/null || true

echo ""
print_status "SSL setup should be complete. Your API is ready at https://api.iotaplay.app"