#!/bin/bash
set -e

DOMAIN="${DOMAIN:-api.iotaplay.app}"
EMAIL="${EMAIL:-tolga+iotaplay@yk-labs.com}"

echo "Starting IOTA Playground Backend with SSL setup"

# Create necessary directories
mkdir -p /var/www/certbot
mkdir -p /var/log/supervisor
mkdir -p /run/nginx
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/sites-enabled
mkdir -p /etc/nginx/ssl

# Function to setup nginx for certbot
setup_nginx_for_certbot() {
    echo "Setting up nginx for Let's Encrypt challenge..."
    
    # Create nginx config for certbot challenge
    cat > /etc/nginx/sites-available/certbot <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files \$uri =404;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF
    
    # Enable the certbot config
    ln -sf /etc/nginx/sites-available/certbot /etc/nginx/sites-enabled/certbot
    
    # Remove default site if exists
    rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx config
    nginx -t
}

# Function to get certificates
get_certificates() {
    echo "Attempting to get Let's Encrypt certificates for $DOMAIN..."
    
    # Setup nginx for webroot challenge
    setup_nginx_for_certbot
    
    # Start nginx
    nginx
    sleep 2
    
    # Use webroot method
    certbot certonly --webroot \
        -w /var/www/certbot \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        --non-interactive \
        --keep-until-expiring \
        --expand \
        -d $DOMAIN
    
    local result=$?
    
    # Stop nginx temporarily
    nginx -s stop 2>/dev/null || true
    sleep 2
    
    return $result
}

# Check if certificates exist
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "No certificates found. Attempting to obtain them..."
    
    # Try to get certificates
    if get_certificates; then
        echo "✅ Successfully obtained Let's Encrypt certificates!"
    else
        echo "⚠️ Let's Encrypt certificate generation failed."
        echo ""
        echo "This might be because:"
        echo "1. Port 80 is not accessible from outside (blocked by Wizard container)"
        echo "2. DNS for $DOMAIN doesn't point to this server"
        echo ""
        echo "Creating self-signed certificate as fallback..."
        
        # Create self-signed certificate
        mkdir -p /etc/nginx/ssl
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout /etc/nginx/ssl/privkey.pem \
            -out /etc/nginx/ssl/fullchain.pem \
            -subj "/CN=$DOMAIN"
        
        echo "Self-signed certificate created."
        
        # Update nginx config to use self-signed certificates
        if [ -f "/etc/nginx/sites-available/api" ]; then
            sed -i 's|/etc/letsencrypt/live/api.iotaplay.app/|/etc/nginx/ssl/|g' /etc/nginx/sites-available/api
        fi
    fi
else
    echo "Certificates already exist for $DOMAIN"
fi

# Setup auto-renewal with cron
if ! crontab -l 2>/dev/null | grep -q "certbot renew"; then
    (crontab -l 2>/dev/null; echo "0 3,15 * * * certbot renew --webroot -w /var/www/certbot --quiet --deploy-hook 'nginx -s reload' >> /var/log/certbot-renew.log 2>&1") | crontab -
    echo "Auto-renewal cron job installed"
fi

# Enable the main API config
rm -f /etc/nginx/sites-enabled/certbot
rm -f /etc/nginx/sites-enabled/default

if [ -f "/etc/nginx/sites-available/api" ]; then
    ln -sf /etc/nginx/sites-available/api /etc/nginx/sites-enabled/api
    echo "Main API nginx configuration enabled"
fi

# Set proper permissions for iota user
chown -R iota:iota /app/projects 2>/dev/null || true
chmod -R 755 /app/projects 2>/dev/null || true

# Ensure the backend user can write to projects
if [ ! -d "/app/projects" ]; then
    mkdir -p /app/projects
    chown -R iota:iota /app/projects
fi

# Start services with supervisor
echo "Starting supervisor with nginx and backend..."
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf