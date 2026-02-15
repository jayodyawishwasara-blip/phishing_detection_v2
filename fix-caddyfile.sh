#!/bin/bash

# Quick fix for Caddyfile syntax error

echo "Fixing Caddyfile configuration..."

# Backup current Caddyfile
sudo cp /etc/caddy/Caddyfile /etc/caddy/Caddyfile.backup

# Create corrected Caddyfile
sudo tee /etc/caddy/Caddyfile > /dev/null << 'EOF'
# Phishing Defense Platform - Production Caddyfile

194.233.84.223 {
    # API endpoints - reverse proxy to Node.js backend
    handle /api/* {
        reverse_proxy localhost:5000 {
            transport http {
                dial_timeout 10s
                response_header_timeout 120s
            }
        }
    }

    # Screenshot serving
    handle /screenshots/* {
        root * /opt/phishing-defense/phishing-data
        file_server
    }

    # Frontend - serve React production build
    handle {
        root * /opt/phishing-defense/frontend/build
        try_files {path} /index.html
        file_server
    }

    # Security headers
    header {
        X-Content-Type-Options "nosniff"
        X-Frame-Options "SAMEORIGIN"
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self'"
        -Server
    }

    # Enable compression
    encode gzip

    # Logging
    log {
        output file /var/log/caddy/phishing-defense.log {
            roll_size 100mb
            roll_keep 5
            roll_keep_for 720h
        }
    }
}
EOF

echo "✅ Caddyfile fixed"

# Validate
echo "Validating Caddyfile..."
sudo caddy validate --config /etc/caddy/Caddyfile

if [ $? -eq 0 ]; then
    echo "✅ Caddyfile is valid"
    
    # Restart Caddy
    echo "Restarting Caddy..."
    sudo systemctl restart caddy
    
    echo "✅ Caddy restarted successfully"
    
    # Check status
    sudo systemctl status caddy --no-pager
else
    echo "❌ Caddyfile validation failed"
    echo "Restoring backup..."
    sudo cp /etc/caddy/Caddyfile.backup /etc/caddy/Caddyfile
    exit 1
fi
