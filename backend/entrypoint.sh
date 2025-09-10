#!/bin/bash
set -e

DOMAIN="api.iotaplay.app"
EMAIL="${EMAIL:-tolga+iotaplay@yk-labs.com}"

echo "Starting IOTA Playground Backend with SSL for $DOMAIN"

# Create necessary directories
mkdir -p /var/www/certbot
mkdir -p /var/log/supervisor
mkdir -p /run/nginx

# Check if certificates exist
if [ ! -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "Getting Let's Encrypt certificate for $DOMAIN..."
    
    # Remove any existing nginx configs that might interfere
    rm -f /etc/nginx/http.d/*.conf
    
    # Create a simple nginx config just for certbot
    cat > /etc/nginx/http.d/certbot.conf <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    location / {
        return 404;
    }
}
EOF
    
    # Test nginx config
    nginx -t
    
    # Start nginx for certbot
    nginx
    sleep 5
    
    # Test that nginx is serving on port 80
    echo "Testing nginx on port 80..."
    curl -f http://localhost/.well-known/acme-challenge/ || echo "Nginx test path accessible"
    
    # Get certificate
    certbot certonly --webroot -w /var/www/certbot \
        --email $EMAIL \
        --agree-tos \
        --no-eff-email \
        --non-interactive \
        -d $DOMAIN || {
            echo "Failed to get certificate, using self-signed as fallback"
            mkdir -p /etc/nginx/ssl
            openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout /etc/nginx/ssl/privkey.pem \
                -out /etc/nginx/ssl/fullchain.pem \
                -subj "/CN=$DOMAIN"
            
            # Update nginx config to use self-signed
            sed -i 's|/etc/letsencrypt/live/api.iotaplay.app/|/etc/nginx/ssl/|g' /etc/nginx/http.d/api.conf
        }
    
    # Stop nginx and clean up
    nginx -s stop || true
    sleep 2
    rm -f /etc/nginx/http.d/certbot.conf
fi

# Copy the main nginx config
cp /etc/nginx/http.d/api.conf.tmp /etc/nginx/http.d/api.conf 2>/dev/null || true

# Setup auto-renewal cron job
echo "0 3 * * * certbot renew --quiet --post-hook 'nginx -s reload'" | crontab -

# Set proper permissions for iota user
chown -R iota:iota /app/projects || true
chmod -R 755 /app/projects || true

# Ensure the backend user can write to projects
if [ ! -d "/app/projects" ]; then
    mkdir -p /app/projects
    chown -R iota:iota /app/projects
fi

# Start services with supervisor
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf