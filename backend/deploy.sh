#!/bin/bash

# IOTA Playground Backend Deployment Script
# For Ubuntu ARM server deployment

set -e

echo "🚀 Starting IOTA Playground Backend Deployment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}Please run with sudo or as root${NC}"
    exit 1
fi

# Function to check command existence
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Install Docker if not present
if ! command_exists docker; then
    echo -e "${YELLOW}Installing Docker...${NC}"
    apt-get update
    apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker's official GPG key
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    # Set up the repository
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    
    # Start Docker
    systemctl start docker
    systemctl enable docker
    
    echo -e "${GREEN}Docker installed successfully${NC}"
else
    echo -e "${GREEN}Docker is already installed${NC}"
fi

# Step 2: Install Docker Compose if not present
if ! command_exists docker-compose; then
    echo -e "${YELLOW}Installing Docker Compose...${NC}"
    
    # Install Docker Compose V2 as a Docker plugin
    apt-get update
    apt-get install -y docker-compose-plugin
    
    # Create symbolic link for backward compatibility
    ln -sf /usr/libexec/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose
    
    echo -e "${GREEN}Docker Compose installed successfully${NC}"
else
    echo -e "${GREEN}Docker Compose is already installed${NC}"
fi

# Step 3: Check for .env file
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file from template...${NC}"
    
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${YELLOW}Please edit .env file with your configuration:${NC}"
        echo "  - PLAYGROUND_WALLET_PRIVATE_KEY (required)"
        echo "  - IOTA_NODE_URL (optional, defaults to testnet)"
        echo "  - Other settings as needed"
        echo ""
        echo -e "${RED}Deployment paused. Please configure .env and run this script again.${NC}"
        exit 1
    else
        echo -e "${RED}.env.example not found. Please create .env file manually.${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}.env file found${NC}"
fi

# Step 4: Create necessary directories
echo -e "${YELLOW}Creating necessary directories...${NC}"
mkdir -p projects
mkdir -p logs
chmod 755 projects logs

# Step 5: Build Docker image
echo -e "${YELLOW}Building Docker image...${NC}"
docker-compose build --no-cache

# Step 6: Stop existing containers if any
echo -e "${YELLOW}Stopping existing containers...${NC}"
docker-compose down || true

# Step 7: Start services
echo -e "${YELLOW}Starting services...${NC}"
docker-compose up -d

# Step 8: Check service health
echo -e "${YELLOW}Waiting for service to be healthy...${NC}"
sleep 10

# Check if service is running
if docker-compose ps | grep -q "Up"; then
    echo -e "${GREEN}✅ Deployment successful!${NC}"
    echo ""
    echo "Service Status:"
    docker-compose ps
    echo ""
    echo "To view logs:"
    echo "  docker-compose logs -f"
    echo ""
    echo "To stop services:"
    echo "  docker-compose down"
    echo ""
    
    # Test the API endpoint
    echo -e "${YELLOW}Testing API health endpoint...${NC}"
    sleep 5
    
    if curl -f http://localhost:8081/api/health > /dev/null 2>&1; then
        echo -e "${GREEN}✅ API is responding on http://localhost:8081${NC}"
    else
        echo -e "${YELLOW}⚠️  API might still be starting up. Check logs with: docker-compose logs -f${NC}"
    fi
    
    echo ""
    echo "Your backend is now running on:"
    echo "  - Internal API: http://localhost:8081"
    echo "  - HTTPS (after SSL setup): https://api.iotaplay.app:8444"
    echo "  - HTTP (for Let's Encrypt): http://api.iotaplay.app"
else
    echo -e "${RED}❌ Deployment failed. Check logs with: docker-compose logs${NC}"
    exit 1
fi